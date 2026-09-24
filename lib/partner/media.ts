import "server-only";

import { and, eq, sql } from "drizzle-orm";

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
 * 🔴 W1-17: and it is ENFORCED, not only recorded. It used to be passed in and
 * ignored, so audio from before the patient said yes was transcribed and stored.
 * `startSeconds` is where this piece sits in the session (the
 * `X-Audio-Start-Seconds` header, 0 when absent, which is the safe reading: it
 * cuts more, never less). Then, before anything reaches the transcriber:
 *
 *   a WAV (PCM)   cut exactly at the boundary (`dropWavStart`); a piece wholly
 *                 before it is accepted and nothing of it is kept.
 *   anything else we cannot cut it (no audio tools here, and the model returns
 *                 no timestamps to drop by), so a piece that reaches back before
 *                 the boundary is REFUSED, and one that starts at or after it is
 *                 taken whole.
 */

export async function ingestPartnerAudio(input: {
  partnerSessionId: string;
  audio: Buffer;
  contentType: string;
  fromSeconds: number;
  /** Where this piece starts in the session, in seconds. */
  startSeconds?: number;
}): Promise<{
  ready?: boolean;
  error?: string;
  status?: number;
  droppedSeconds?: number;
  /** W2-X05: audio from after the consent boundary reached the transcriber. */
  transcribed?: boolean;
}> {
  const start = Math.max(0, input.startSeconds ?? 0);
  const before = Math.max(0, input.fromSeconds - start);
  let audio = input.audio;

  if (before > 0) {
    const { dropWavStart, isWavType, wavInfo } = await import("./wav");
    const info = isWavType(input.contentType) ? wavInfo(audio) : null;
    if (!info) {
      return {
        status: 422,
        error:
          "This audio starts before the patient consented, and we can only cut WAV. Send audio/wav, or only the audio from recording_from_seconds with X-Audio-Start-Seconds.",
      };
    }
    const kept = dropWavStart(audio, before);
    if (!kept) return { ready: false, droppedSeconds: info.durationSeconds };
    audio = kept;
  }

  let text: string;

  try {
    text = await transcribeAudio({
      /*
       * A fresh `ArrayBuffer` rather than `buffer.buffer`, which on a pooled Node
       * Buffer is the whole pool: passing it would hand the transcriber unrelated
       * bytes that happened to share an allocation, which is both a wrong transcript
       * and a small data leak between requests.
       */
      audio: audio.buffer.slice(
        audio.byteOffset,
        audio.byteOffset + audio.byteLength,
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

  return { ready: text.trim().length > 0, droppedSeconds: before, transcribed: true };
}

/**
 * 🔴 W1-17: a withdrawal takes back what the consent let us keep.
 *
 * The consent log is append only and says the withdrawal happened; this is the
 * material that was made under the consent: the transcript, the draft and the
 * summary. An approved note is the partner clinician's signed record and stays
 * theirs. Only when the session's effective answer is now no, so a withdrawal
 * that arrives before a later yes does not wipe a consented session.
 */
export async function purgeSessionMaterial(input: {
  partnerId: string;
  externalSessionRef: string;
}): Promise<{ purged: boolean }> {
  const { recordingFrom } = await import("./consent");
  if ((await recordingFrom(input)) !== null) return { purged: false };

  const rows = await controlDb
    .update(partnerSessions)
    .set({ transcriptText: null, noteDraft: null, summaryText: null, updatedAt: new Date() })
    .where(
      and(
        eq(partnerSessions.partnerId, input.partnerId),
        eq(partnerSessions.externalSessionRef, input.externalSessionRef),
      ),
    )
    .returning({ id: partnerSessions.id });
  if (rows.length > 0) log.info("partner session material purged on withdrawal");
  return { purged: rows.length > 0 };
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
