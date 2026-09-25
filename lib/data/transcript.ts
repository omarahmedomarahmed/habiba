import "server-only";

import { desc, eq, sql } from "drizzle-orm";

import { raiseCrisisAlert, scanForCrisisLanguage } from "@/lib/crisis/alerts";
import { dbFor} from "@/lib/db";
import { pinnedToDefaultRegion } from "@/lib/db/region";
import { transcriptSegments } from "@/lib/db/schema";
import { pauseBeforeMs, wordsPerMinute } from "@/lib/transcript/descriptors";

/*
 * ⚠️ 30.1 — NOT ROUTED YET, and counted rather than hidden.
 *
 * `pinnedToDefaultRegion` returns the default region and registers this
 * module so `verify:sprint30` can print it. The alternative, `dbFor("us")`
 * with a comment, compiles and is indistinguishable from a decision, which
 * is the "seam by convention" this sprint exists to prevent.
 */
const db = dbFor(pinnedToDefaultRegion("lib/data/transcript.ts", "not routed yet: this call site has no entity in hand, so 30.x threads one"));


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
  /**
   * 🔴 K11: the recorder's own id for this chunk, which is how a RETRY is
   * recognised. The stored `sequence` is assigned here, never by a client.
   *
   * It used to be the other way round: the room numbered chunks from the count
   * of lines it had loaded, so after a rejoin, or with the room open in two
   * tabs, two different chunks carried the same number and the second was
   * dropped as a duplicate, silently, out of the clinical record.
   */
  chunkId: string;
  speaker: "therapist" | "patient" | "unknown";
  text: string;
  startMs: number;
  endMs: number;
}): Promise<{ inserted: boolean; crisis: boolean; sequence: number | null }> {
  const text = input.text.trim();
  if (!text) return { inserted: false, crisis: false, sequence: null };

  let inserted = false;
  let sequence: number | null = null;

  /*
   * Next number after the highest stored one. Two chunks of one session can
   * race for the same number (two recorders, two tabs); the loser hits the
   * `(session_id, sequence)` index and takes the next. A conflict on the CHUNK
   * id is a retry, and that one is the only thing ever dropped.
   */
  for (let attempt = 0; attempt < 8 && !inserted; attempt += 1) {
    /*
     * Descriptors, computed here because this is the only writer. The previous
     * segment is read rather than passed in: the caller knows about one chunk.
     */
    const [previous] = await db
      .select({ endMs: transcriptSegments.endMs, sequence: transcriptSegments.sequence })
      .from(transcriptSegments)
      .where(eq(transcriptSegments.sessionId, input.sessionId))
      .orderBy(desc(transcriptSegments.sequence))
      .limit(1);
    const next = (previous?.sequence ?? 0) + 1;

    try {
      const result = await db
        .insert(transcriptSegments)
        .values({
          sessionId: input.sessionId,
          organizationId: input.organizationId,
          sequence: next,
          chunkId: input.chunkId,
          speaker: input.speaker,
          text,
          startMs: input.startMs,
          endMs: input.endMs,
          wordsPerMinute: wordsPerMinute(text, input.endMs - input.startMs),
          pauseBeforeMs: pauseBeforeMs(input.startMs, previous?.endMs ?? null),
        })
        // A retried chunk must not duplicate the segment.
        .onConflictDoNothing({
          target: [transcriptSegments.sessionId, transcriptSegments.chunkId],
          where: sql`chunk_id IS NOT NULL`,
        })
        .returning({ id: transcriptSegments.id });

      if (result.length === 0) break;
      inserted = true;
      sequence = next;
    } catch (error) {
      if (!lostTheNumber(error)) throw error;
    }
  }

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

  return { inserted, crisis: matches.length > 0, sequence };
}

/** Another chunk of this session took the number first; take the next one. */
function lostTheNumber(error: unknown): boolean {
  const seen = [error, (error as { cause?: unknown } | null)?.cause];
  return seen.some(
    (e) =>
      typeof e === "object" &&
      e !== null &&
      (e as { code?: string }).code === "23505" &&
      String((e as { constraint?: string }).constraint ?? (e as Error).message).includes(
        "transcript_segments_session_seq_unique",
      ),
  );
}

/**
 * 🔴 B63: the language to transcribe in when nobody set one in the room.
 *
 * Null used to mean "detect it", and detection on eight seconds of Egyptian
 * Arabic came back in Latin letters ("Jani, sa ba' li tirfudi" for «يعني صعب
 * عليكي ترفضي»), which no reader, search or note writer can use. When either
 * person in the session works in Arabic, the chunk is transcribed as Arabic.
 * Anybody else is still detected, and a language set in the room always wins.
 */
export async function spokenLanguageFor(session: {
  therapistId: string;
  patientId: string | null;
  transcriptLanguage: string | null;
}): Promise<string | null> {
  if (session.transcriptLanguage) return session.transcriptLanguage;
  const { rows } = await db.execute(sql`
    SELECT
      (SELECT u.locale FROM users u WHERE u.id = ${session.therapistId}) AS clinician,
      (SELECT pe.locale FROM patients p JOIN people pe ON pe.id = p.person_id
        WHERE p.id = ${session.patientId}) AS patient`);
  const found = rows[0] as { clinician: string | null; patient: string | null } | undefined;
  return found?.clinician === "ar" || found?.patient === "ar" ? "ar" : null;
}
