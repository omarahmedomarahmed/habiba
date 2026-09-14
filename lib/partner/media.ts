import "server-only";

import { eq, sql } from "drizzle-orm";

import { transcribeAudio } from "@/lib/ai/transcribe";
import { controlDb } from "@/lib/db";
import { partnerSessions } from "@/lib/db/schema";
import { log } from "@/lib/logger";

/**
 * Audio in, transcript out. PLAN.md 68.3, 68.5.
 *
 * ## 🔴 `transcribeAudio` AND NOT `transcribeChunk`, AND THE DIFFERENCE MATTERS
 *
 * `transcribeChunk` wraps the same call and then writes an `ai_usage` row keyed on an
 * organisation, a user and a session, all three of which are OUR rows. A partner's
 * session has none of them, so calling it would mean inventing three ids or
 * loosening a usage ledger that every cost figure in the product is computed from.
 *
 * Partner usage is counted per SESSION (68.14), in `partner_sessions.billable`, which
 * is a different unit on purpose: they do the work and we do the intelligence, so a
 * per-token ledger would be measuring the wrong thing and would tempt an integrator
 * to optimise against the product.
 *
 * ## 🔴 THE CONSENT BOUNDARY IS NOT NEGOTIABLE HERE
 *
 * `fromSeconds` arrives from the route, which got it from OUR consent log rather than
 * from the partner's request body. A partner could otherwise post a whole session
 * while claiming it starts at minute ten, and the note would cover a period nobody
 * agreed to.
 *
 * We cannot verify that the bytes they sent actually begin at that offset, and
 * pretending otherwise would be worse than saying so: what we can do is record the
 * boundary WE were told about by the patient, put it in the coverage sentence on
 * every surface, and make the discrepancy something a partner has to lie about
 * explicitly rather than something they can drift into.
 */

export async function ingestPartnerAudio(input: {
  partnerSessionId: string;
  audio: Buffer;
  contentType: string;
  fromSeconds: number;
}): Promise<{ ready?: boolean; error?: string }> {
  let text: string;

  try {
    text = await transcribeAudio({
      /*
       * A fresh `ArrayBuffer` rather than `buffer.buffer`, which on a pooled Node
       * Buffer is the whole pool: passing it would hand the transcriber unrelated
       * bytes that happened to share an allocation, which is both a wrong transcript
       * and a small data leak between requests.
       */
      audio: input.audio.buffer.slice(
        input.audio.byteOffset,
        input.audio.byteOffset + input.audio.byteLength,
      ) as ArrayBuffer,
      mimeType: input.contentType,
      /*
       * 🔴 NULL, so the model detects the language.
       *
       * A partner's platform serves whoever it serves and we have no profile to read
       * a language off. Guessing English is the mistake this repository already made
       * once in production: every Arabic session was handed to the model asserted to
       * be English, which produces English words that sound vaguely like what
       * somebody said and a clinical note written from them.
       */
      language: null,
    });
  } catch {
    /*
     * 🔴 The transcript is not written and the session is not marked. A retry is
     * safe, and a partner gets a sentence rather than a half-transcribed session
     * whose note would be written from the half that arrived.
     */
    log.error("partner audio could not be transcribed");
    return { error: "We could not transcribe that audio. Try again." };
  }

  /*
   * 🔴 APPENDED, NOT REPLACED, because a long session arrives in pieces.
   *
   * Replacing would mean the last chunk is the whole transcript, which is a session
   * whose note covers its final ninety seconds and says nothing about it. The
   * concatenation happens in SQL so two chunks arriving together cannot each read
   * the same prefix and write over one another.
   */
  await controlDb
    .update(partnerSessions)
    .set({
      transcriptText: sql`COALESCE(${partnerSessions.transcriptText}, '') || ${text} || ' '`,
      updatedAt: new Date(),
    })
    .where(eq(partnerSessions.id, input.partnerSessionId));

  return { ready: text.trim().length > 0 };
}

/** The transcript so far, for the read route. Null when nothing has arrived. */
export async function transcriptFor(partnerSessionId: string): Promise<string | null> {
  const [row] = await controlDb
    .select({ transcriptText: partnerSessions.transcriptText })
    .from(partnerSessions)
    .where(eq(partnerSessions.id, partnerSessionId))
    .limit(1);

  const text = row?.transcriptText?.trim() ?? "";
  return text.length > 0 ? text : null;
}
