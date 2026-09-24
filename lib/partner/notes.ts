import "server-only";

import { and, eq, isNull } from "drizzle-orm";

import { controlDb } from "@/lib/db";
import { partnerSessions } from "@/lib/db/schema";
import { log } from "@/lib/logger";

import { coverageSentence } from "./consent";

/**
 * The note their therapist approves. PLAN.md 68.6, 68.9, §7.
 *
 * ## 🔴 THE ONE RULE THAT DOES NOT SOFTEN ACROSS A COMMERCIAL BOUNDARY
 *
 * > *Content in a chart needs a named clinician who approved that exact text, and a
 * > partner's server is not one.*
 *
 * Everything in this file follows from that sentence:
 *
 *   - `draftNote` writes `note_draft` and can never write `note_approved_text`. There
 *     is no argument it takes that would let it.
 *   - `approveNote` requires a clinician reference and stamps a time, and a database
 *     CHECK refuses the row if any of the three is missing.
 *   - The approved text is what the CLINICIAN sent back, not what we wrote. An
 *     approval endpoint that took a boolean and promoted our draft would record a
 *     human's name against text they may have edited away.
 *
 * That last one is the subtle one and it is why `approveNote` takes `text`. "I
 * approve" against a draft the server holds is a signature on a document the signer
 * cannot be shown to have read the final version of.
 */

/**
 * 🔴 68.6 / W1-24: WRITE THE DRAFT. THE COVERAGE SENTENCE IS BESIDE IT, NEVER IN IT.
 *
 * This used to prepend `coverageSentence` to the draft, on the reasoning that the
 * note is the artefact that travels. The 2025 AI scribe cases (takeover/design
 * RESEARCH-2 section 3) turned on exactly that: consent and recording text written
 * into a chart by the machine, which then reads as the clinician's attestation. So
 * the draft is the clinical text and nothing else, and coverage is its own field on
 * every response (`coverage` on the note, transcript and consent routes), for the
 * partner to show beside the note in their own interface.
 *
 * Defensive as well: a model that echoes a coverage sentence at the top of its
 * output has it removed before anything is stored.
 */
export async function draftNote(input: {
  partnerSessionId: string;
  text: string;
  recordingFromSeconds: number | null;
}): Promise<{ ok: true }> {
  const body = withoutCoverage(input.text, input.recordingFromSeconds);

  await controlDb
    .update(partnerSessions)
    .set({ noteDraft: body, updatedAt: new Date() })
    .where(eq(partnerSessions.id, input.partnerSessionId));

  return { ok: true };
}

/** The text with any leading coverage sentence of ours taken off. */
function withoutCoverage(text: string, recordingFromSeconds: number | null): string {
  let body = text.trim();
  for (const sentence of new Set([
    coverageSentence(recordingFromSeconds),
    coverageSentence(0),
    coverageSentence(null),
  ])) {
    if (body.startsWith(sentence)) body = body.slice(sentence.length).trim();
  }
  return body;
}

/**
 * 🔴 68.6 — A NAMED HUMAN PUTS THEIR NAME TO EXACT TEXT.
 *
 * `text` is what the clinician is approving, which may differ from our draft in any
 * way at all including entirely. We do not compare them, do not warn about the
 * difference, and do not keep a diff: the clinician's version IS the note, and
 * treating our draft as the baseline would make the AI the author and the human an
 * editor, which is backwards.
 *
 * 🔴 GUARDED ON `note_approved_at IS NULL`, so a second approval does not overwrite
 * the first with a different name. An approval is a signature; two signatures on one
 * document is a different document, and the honest answer to the second is that it is
 * already signed.
 */
export async function approveNote(input: {
  partnerSessionId: string;
  text: string;
  clinicianRef: string;
  now?: Date;
}): Promise<{ ok?: true; error?: string }> {
  const text = input.text.trim();
  if (text.length < 10) return { error: "That note is too short to be a note." };
  if (text.length > 50_000) return { error: "That note is too long." };

  const clinicianRef = input.clinicianRef.trim().slice(0, 200);
  if (!clinicianRef) {
    /*
     * 🔴 THE REFUSAL §7 EXISTS FOR, and the message says whose name is missing
     * rather than naming a field. An integrator reading "clinician is required" adds
     * a constant; an integrator reading this one asks their product team who
     * approved it.
     */
    return {
      error:
        "A note needs the clinician who approved it. Not the integration, not a service account: the person who read this text and stands behind it.",
    };
  }

  const [row] = await controlDb
    .update(partnerSessions)
    .set({
      noteApprovedText: text,
      noteApprovedByRef: clinicianRef,
      noteApprovedAt: input.now ?? new Date(),
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(partnerSessions.id, input.partnerSessionId),
        isNull(partnerSessions.noteApprovedAt),
      ),
    )
    .returning({ id: partnerSessions.id });

  if (!row) return { error: "That note has already been approved." };

  log.info("partner note approved by their clinician");
  return { ok: true };
}

/**
 * 🔴 68.9 — THE SUMMARY REACHES THE PATIENT ONLY AFTER THE NOTE IS APPROVED.
 *
 * *Reviewed and edited by their therapist before anybody sees it, like ours.*
 *
 * The database refuses `summary_delivered_at` on a row with no `note_approved_at`, so
 * this function's check is the sentence somebody reads and the constraint is the
 * guarantee. Both, because a message an integrator can act on is worth having and a
 * rule that lives only in the message is one endpoint away from being skipped.
 */
export async function deliverSummary(input: {
  partnerSessionId: string;
  text: string;
  now?: Date;
}): Promise<{ ok?: true; error?: string }> {
  const text = input.text.trim();
  if (text.length < 10) return { error: "That summary is too short." };
  if (text.length > 20_000) return { error: "That summary is too long." };

  const [session] = await controlDb
    .select({ noteApprovedAt: partnerSessions.noteApprovedAt })
    .from(partnerSessions)
    .where(eq(partnerSessions.id, input.partnerSessionId))
    .limit(1);

  if (!session?.noteApprovedAt) {
    return {
      error:
        "Nobody has approved this session's note yet. A summary reaching a patient before a clinician has read anything is the AI talking to somebody about their own therapy with nobody in between.",
    };
  }

  await controlDb
    .update(partnerSessions)
    .set({
      summaryText: text,
      summaryDeliveredAt: input.now ?? new Date(),
      updatedAt: new Date(),
    })
    .where(eq(partnerSessions.id, input.partnerSessionId));

  return { ok: true };
}

/** The note in both its states, for the review route. */
export async function noteFor(partnerSessionId: string) {
  const [row] = await controlDb
    .select({
      draft: partnerSessions.noteDraft,
      approvedText: partnerSessions.noteApprovedText,
      approvedByRef: partnerSessions.noteApprovedByRef,
      approvedAt: partnerSessions.noteApprovedAt,
      recordingFromSeconds: partnerSessions.recordingFromSeconds,
    })
    .from(partnerSessions)
    .where(eq(partnerSessions.id, partnerSessionId))
    .limit(1);

  return row ?? null;
}
