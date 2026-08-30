import "server-only";

import { and, asc, eq, inArray } from "drizzle-orm";

import { logUsage, openai, parseJson } from "@/lib/ai/client";
import { db } from "@/lib/db";
import { transcriptSegments } from "@/lib/db/schema";
import { log, ref, safeErrorMessage } from "@/lib/logger";

/**
 * Work out who said what, when only one microphone was running.
 *
 * ## Why this exists
 *
 * Attribution in this product is normally physical: a video session records the
 * clinician and the patient on separate tracks, so a chunk's speaker is simply
 * whose track it arrived on. That is exact, and where it is available nothing
 * here runs.
 *
 * It is not available for an in-person session — one microphone in a room,
 * hearing two people — and it is not available when a patient's track never
 * connects. Both used to produce a transcript that was either entirely
 * `unknown` or, worse, entirely attributed to the clinician. A clinical record
 * that puts the patient's words in the clinician's mouth is not a cosmetic
 * problem, and neither is a note written from one.
 *
 * ## Why the words rather than the audio
 *
 * Acoustic diarisation — separating voices by how they sound — needs a provider
 * that offers it, and the transcription model here does not. What this does
 * instead is read the transcript and assign turns from its structure: in a
 * first therapy session the clinician asks and reflects, the patient discloses
 * and answers. Two speakers, alternating, in a genre with strong conventions.
 *
 * That is a real limitation and the schema records it. Every row this touches
 * is marked `speaker_inferred`, the transcript panel says so, and nothing
 * downstream is allowed to present an inference as a measurement.
 *
 * If acoustic diarisation is added later, it belongs in front of this, not
 * instead of it: use the provider's turns where they exist, fall back here.
 */

/** Long enough to have structure to reason about, short enough to be cheap. */
const MIN_SEGMENTS = 4;
/** Beyond this a single call gets unreliable about indices; the tail is left alone. */
const MAX_SEGMENTS = 160;

const SYSTEM = `You are labelling the turns of a recorded therapy session.

The transcript comes from one microphone that heard both people, so the turns
are not marked. Decide, for each numbered line, whether it was spoken by the
"therapist" or the "patient".

How to tell them apart:
- The therapist asks questions, reflects back, summarises, normalises, and
  proposes what to try before next time.
- The patient describes their own experience, answers questions, and discloses.
- A single line may contain the end of one speaker's turn and the start of the
  other's, because the recording was cut into fixed chunks rather than at turn
  boundaries. Label the line by whoever speaks most of it.
- If a line genuinely could be either, use "unknown". Do not guess to be tidy.

Reply with JSON only: {"turns":[{"i":0,"speaker":"therapist"}, ...]}
Include every index you were given, in order.`;

type Turn = { i: number; speaker: "therapist" | "patient" | "unknown" };

export type DiariseResult = {
  /** Segments whose speaker this changed. Zero is a normal outcome. */
  updated: number;
  /** Why it did nothing, when it did nothing. */
  skipped?: "two-track" | "too-short" | "no-transcript" | "unavailable";
};

export async function diariseSession(opts: {
  sessionId: string;
  organizationId: string;
  userId: string;
}): Promise<DiariseResult> {
  const rows = await db
    .select({
      id: transcriptSegments.id,
      speaker: transcriptSegments.speaker,
      text: transcriptSegments.text,
    })
    .from(transcriptSegments)
    .where(eq(transcriptSegments.sessionId, opts.sessionId))
    .orderBy(asc(transcriptSegments.sequence))
    .limit(MAX_SEGMENTS);

  if (rows.length === 0) return { updated: 0, skipped: "no-transcript" };

  /*
   * If any row was attributed to the patient, the two-track capture worked and
   * the physical answer is already on the table. Guessing over the top of a
   * measurement would only make the record less true.
   */
  if (rows.some((row) => row.speaker === "patient")) {
    return { updated: 0, skipped: "two-track" };
  }
  if (rows.length < MIN_SEGMENTS) return { updated: 0, skipped: "too-short" };

  const numbered = rows.map((row, i) => `${i}: ${row.text}`).join("\n");

  let turns: Turn[];
  try {
    const started = Date.now();
    const response = await openai().chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: SYSTEM },
        { role: "user", content: numbered },
      ],
    });

    await logUsage({
      organizationId: opts.organizationId,
      userId: opts.userId,
      sessionId: opts.sessionId,
      kind: "diarise",
      model: "gpt-4o-mini",
      inputTokens: response.usage?.prompt_tokens ?? 0,
      outputTokens: response.usage?.completion_tokens ?? 0,
      durationMs: Date.now() - started,
      status: "success",
    });

    const parsed = parseJson<{ turns?: Turn[] }>(
      response.choices[0]?.message?.content ?? "",
      { turns: [] },
      "diarise",
    );
    turns = Array.isArray(parsed.turns) ? parsed.turns : [];
  } catch (error) {
    // A transcript with no speakers is worse than one with them and better than
    // no session record at all. This never fails the note it runs before.
    log.warn("diarisation unavailable", {
      session: ref(opts.sessionId),
      reason: safeErrorMessage(error),
    });
    return { updated: 0, skipped: "unavailable" };
  }

  /*
   * Group by speaker and write one statement per group rather than one per
   * segment: a fifty-minute session is a hundred or so rows, and a hundred
   * round trips to say two distinct things is a waste of a database that
   * charges by the second it is awake.
   */
  const byLabel = new Map<"therapist" | "patient", string[]>();
  for (const turn of turns) {
    const row = rows[turn.i];
    if (!row) continue;
    if (turn.speaker !== "therapist" && turn.speaker !== "patient") continue;
    if (row.speaker === turn.speaker) continue;
    const list = byLabel.get(turn.speaker) ?? [];
    list.push(row.id);
    byLabel.set(turn.speaker, list);
  }

  let updated = 0;
  for (const [speaker, ids] of byLabel) {
    if (ids.length === 0) continue;
    await db
      .update(transcriptSegments)
      .set({ speaker, speakerInferred: true })
      .where(
        and(
          eq(transcriptSegments.sessionId, opts.sessionId),
          inArray(transcriptSegments.id, ids),
        ),
      );
    updated += ids.length;
  }

  log.info("diarisation complete", { session: ref(opts.sessionId), updated });
  return { updated };
}
