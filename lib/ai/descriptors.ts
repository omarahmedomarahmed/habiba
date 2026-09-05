/**
 * Acoustic descriptors: speaking rate and pause length.
 *
 * ## Descriptors, never emotion labels
 *
 * PLAN.md 3.3 draws this line and it is a clinical one rather than a stylistic
 * one. "190 words per minute, after a 4-second pause" is an observation the
 * clinician was in the room for and can disagree with. "Anxious" is a
 * diagnosis, inferred from timing by software that never heard the person — and
 * once it is in a record it is very hard to remove, because the next reader
 * sees a label rather than the thin evidence behind it.
 *
 * So this module computes two numbers and offers no interpretation of them.
 * There is deliberately no `affect`, `tone` or `sentiment` here, and adding one
 * is a decision to be argued for rather than a function to be written.
 *
 * ## Why there is no audio analysis
 *
 * Both figures fall out of data already captured — the transcribed words, the
 * chunk's duration, and the gap to the previous segment. No DSP, no second
 * model call, nothing shipped to the browser. A descriptor that cost a request
 * per segment would not survive contact with a fifty-minute session.
 *
 * Pure, so it can be tested without a database.
 */

/**
 * Words, counted the way a clinician would count them.
 *
 * Whitespace-split, which is right for English and wrong-but-consistent for
 * Arabic — Arabic is written with spaces between words, so this holds. It does
 * not hold for a language written without them, and if one is ever added this
 * is the function to revisit rather than the schema.
 */
export function countWords(text: string): number {
  const trimmed = text.trim();
  if (!trimmed) return 0;
  return trimmed.split(/\s+/).length;
}

/**
 * Words per minute over a segment, or null when it cannot be known.
 *
 * Null rather than zero for a segment with no duration: zero is a measurement
 * meaning "silent", and a missing duration is not a measurement at all. A chart
 * that averages those together reports a slower session than happened.
 *
 * Capped at 400. Human speech tops out around 300wpm and anything above that is
 * a duration bug — a chunk whose length was recorded as a fraction of a second —
 * so it is dropped rather than stored as a number somebody might believe.
 */
export function wordsPerMinute(text: string, durationMs: number): number | null {
  if (!Number.isFinite(durationMs) || durationMs <= 0) return null;
  const words = countWords(text);
  if (words === 0) return null;
  const wpm = Math.round((words / durationMs) * 60_000);
  if (wpm <= 0 || wpm > 400) return null;
  return wpm;
}

/**
 * The gap before this segment started.
 *
 * Null for the first segment of a session — there is no previous utterance to
 * measure from, and calling that "a zero-second pause" would put a fictional
 * data point at the start of every transcript.
 *
 * Negative gaps are clamped to zero rather than dropped: two recorders running
 * on one session produce genuinely overlapping segments when both people speak
 * at once, and "they overlapped" is better recorded as no pause than as a
 * missing value.
 */
export function pauseBeforeMs(
  startMs: number,
  previousEndMs: number | null | undefined,
): number | null {
  if (previousEndMs === null || previousEndMs === undefined) return null;
  if (!Number.isFinite(startMs) || !Number.isFinite(previousEndMs)) return null;
  return Math.max(0, Math.round(startMs - previousEndMs));
}
