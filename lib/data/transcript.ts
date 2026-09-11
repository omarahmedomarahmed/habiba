import "server-only";

import { and, desc, eq, lt } from "drizzle-orm";

import { raiseCrisisAlert, scanForCrisisLanguage } from "@/lib/ai/crisis";
import { db } from "@/lib/db";
import { transcriptSegments } from "@/lib/db/schema";
import { pauseBeforeMs, wordsPerMinute } from "@/lib/transcript/descriptors";

/**
 * Writing a transcript segment. PLAN.md 3.3, 24.2.
 *
 * ## 🔴 Why this left `lib/data/sessions.ts`
 *
 * Sprint 24.2 forbids anything a patient can reach from importing `lib/ai/*`,
 * transitively. Sprint 25 brought the radar and the clinician profile inside
 * the patient app, and the guard immediately found a five-hop path: a patient
 * page, to the radar console, to the booking sheet, to the public booking
 * action, to `lib/data/sessions.ts`, to the crisis scanner.
 *
 * Nothing was leaking. But the module a patient reaches to book an hour was
 * also the module that writes transcripts and raises risk alerts, and a rule
 * that has to be argued about is a rule that will be lost. Booking and
 * transcription had no business in one file, so the writer moved here and the
 * import graph now says what the product already meant.
 *
 * It is still the ONE writer, which is what makes the crisis scan below
 * impossible to bypass: before sprint 3, audio-transcribed sessions went
 * through a different function with no scan at all, so detection was
 * effectively off in production while the marketing page advertised it.
 */

/**
 * The one and only place a transcript segment is written.
 *
 * Because it is the only writer, the crisis scan below cannot be bypassed by
 * arriving through a different code path — which is exactly what happened
 * before, when audio-transcribed sessions went through a function that had no
 * scan in it at all.
 */
export async function appendTranscriptSegment(input: {
  sessionId: string;
  organizationId: string;
  therapistId: string;
  patientId: string | null;
  sequence: number;
  speaker: "therapist" | "patient" | "unknown";
  text: string;
  startMs: number;
  endMs: number;
}): Promise<{ inserted: boolean; crisis: boolean }> {
  const text = input.text.trim();
  if (!text) return { inserted: false, crisis: false };

  /*
   * Descriptors, computed here because this is the only writer.
   *
   * The previous segment's end is read rather than passed in: the caller is an
   * upload handler that knows about one chunk, and asking it to track the last
   * one would put the same state in two places and let them drift. One indexed
   * lookup on `(session_id, sequence)`, which is the index that already exists.
   */
  const [previous] = await db
    .select({ endMs: transcriptSegments.endMs })
    .from(transcriptSegments)
    .where(
      and(
        eq(transcriptSegments.sessionId, input.sessionId),
        lt(transcriptSegments.sequence, input.sequence),
      ),
    )
    .orderBy(desc(transcriptSegments.sequence))
    .limit(1);

  const result = await db
    .insert(transcriptSegments)
    .values({
      sessionId: input.sessionId,
      organizationId: input.organizationId,
      sequence: input.sequence,
      speaker: input.speaker,
      text,
      startMs: input.startMs,
      endMs: input.endMs,
      wordsPerMinute: wordsPerMinute(text, input.endMs - input.startMs),
      pauseBeforeMs: pauseBeforeMs(input.startMs, previous?.endMs ?? null),
    })
    // A retried chunk must not duplicate the segment.
    .onConflictDoNothing({
      target: [transcriptSegments.sessionId, transcriptSegments.sequence],
    })
    .returning({ id: transcriptSegments.id });

  const inserted = result.length > 0;

  const matches = scanForCrisisLanguage(text);
  if (inserted && matches.length > 0) {
    await raiseCrisisAlert({
      sessionId: input.sessionId,
      organizationId: input.organizationId,
      therapistId: input.therapistId,
      patientId: input.patientId,
      level: "high",
      source: "keyword",
      indicators: matches,
    });
  }

  return { inserted, crisis: matches.length > 0 };
}
