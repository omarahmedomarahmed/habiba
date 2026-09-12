/**
 * Putting acoustic turns and transcript lines on the same clock. PLAN.md 37.1.
 *
 * ## The seam
 *
 * Two different machines cut the same audio in two different places. The
 * transcription model returns text in chunks aligned to nothing in particular;
 * the diarisation provider returns turns aligned to when people actually
 * started and stopped talking. Alignment is the arithmetic that decides which
 * voice owns a chunk, and — much more importantly — when **no voice owns it
 * enough to say so**.
 *
 * ## 🔴 Why refusing is the interesting half
 *
 * Sprint 32 established the position and it has not moved: a half-correct
 * speaker label is worse than no label, because it is written into a clinical
 * record as if it were certain, and a clinician reading the note acts on the
 * label rather than on the raw text. The failure that position exists to
 * prevent — a therapist's question and a patient's crisis disclosure inside one
 * chunk, labelled confidently as one of them — is *exactly* what a chunk
 * boundary that ignores turn boundaries produces.
 *
 * So this returns a refusal with a reason wherever the arithmetic is thin, and
 * the reasons are distinct on purpose. `silence` is a chunk of room tone.
 * `contested` is two people. They look identical in a transcript and mean
 * completely different things about the recording.
 *
 * Every threshold here is a constant with a test, not a number inside a
 * condition, so a change to one of them is a change somebody has to argue for.
 */
import { overlapMs, type AcousticTurn, type Interval } from "./turns";

/** A transcript chunk, as the segments table holds it. */
export type SegmentWindow = Interval & {
  /** Position in the transcript. Carried through so a caller can join back. */
  index: number;
};

export type AlignmentReason =
  /** Assigned: one voice holds the chunk. */
  | "assigned"
  /** The chunk has no usable window: zero or negative length. */
  | "no_window"
  /** Nobody was speaking for enough of the chunk to attribute it. */
  | "silence"
  /** Two or more voices, and no one of them holds it clearly. */
  | "contested";

export type Alignment = {
  index: number;
  /** The voice label, or null when this chunk is refused. */
  label: string | null;
  reason: AlignmentReason;
  /** Share of the chunk's *speech* held by the winning voice, 0 to 1. */
  share: number;
  /** Share of the chunk that was speech at all, 0 to 1. */
  coverage: number;
  /** How many distinct voices were heard inside this chunk. */
  voices: number;
};

/**
 * How much of a chunk must be speech before it is attributed at all.
 *
 * Low, because a chunk is mostly pauses and a therapy session is mostly
 * pauses. This is not a confidence threshold; it is the difference between a
 * sentence with thinking room in it and eight seconds of a radiator.
 */
export const MIN_COVERAGE = 0.2;

/**
 * How much of a chunk's speech one voice must hold to own the chunk.
 *
 * Three quarters. At exactly this figure the runner-up holds a quarter of the
 * chunk's speech, which in an eight-second chunk is around a second and a half
 * — enough for "I want to die" to be somebody else's words. Below it, the
 * chunk is contested and nobody is named.
 */
export const MIN_SHARE = 0.75;

/**
 * Assign each transcript chunk to a voice, or refuse it with a reason.
 *
 * Pure, total, and order-preserving: exactly one alignment comes back per
 * segment given, in the order given. That property is the descendant of H11 —
 * the bug that was not a wrong label but a segment nothing ever looked at — and
 * it is asserted rather than assumed.
 */
export function alignSegments(
  segments: readonly SegmentWindow[],
  turns: readonly AcousticTurn[],
  opts: { minCoverage?: number; minShare?: number } = {},
): Alignment[] {
  const minCoverage = opts.minCoverage ?? MIN_COVERAGE;
  const minShare = opts.minShare ?? MIN_SHARE;

  return segments.map((segment) => {
    const window = segment.endMs - segment.startMs;
    if (!Number.isFinite(window) || window <= 0) {
      return { index: segment.index, label: null, reason: "no_window", share: 0, coverage: 0, voices: 0 };
    }

    const heard = new Map<string, number>();
    for (const turn of turns) {
      const shared = overlapMs(segment, turn);
      if (shared > 0) heard.set(turn.label, (heard.get(turn.label) ?? 0) + shared);
    }

    /*
     * Speech in the chunk is the *union* of the turns, not their sum: when two
     * people talk over each other for two seconds, two seconds of audio have
     * passed, not four. Getting this wrong would let a crosstalk chunk clear
     * the coverage floor on arithmetic alone.
     */
    const spoken = spokenMs(segment, turns);
    const coverage = Math.min(1, spoken / window);
    const voices = heard.size;

    if (coverage < minCoverage) {
      return { index: segment.index, label: null, reason: "silence", share: 0, coverage, voices };
    }

    const ranked = [...heard.entries()].sort((a, b) => b[1] - a[1]);
    const total = ranked.reduce((sum, [, ms]) => sum + ms, 0);
    const [bestLabel, bestMs] = ranked[0]!;
    const share = total === 0 ? 0 : bestMs / total;

    if (share < minShare) {
      return { index: segment.index, label: null, reason: "contested", share, coverage, voices };
    }

    return { index: segment.index, label: bestLabel, reason: "assigned", share, coverage, voices };
  });
}

function spokenMs(window: Interval, turns: readonly AcousticTurn[]): number {
  const clipped = turns
    .map((turn) => ({
      startMs: Math.max(window.startMs, turn.startMs),
      endMs: Math.min(window.endMs, turn.endMs),
    }))
    .filter((interval) => interval.endMs > interval.startMs)
    .sort((a, b) => a.startMs - b.startMs);

  let total = 0;
  let cursor = -1;
  for (const interval of clipped) {
    const from = Math.max(interval.startMs, cursor);
    if (interval.endMs > from) total += interval.endMs - from;
    cursor = Math.max(cursor, interval.endMs);
  }
  return total;
}

export type AlignmentSummary = {
  assigned: number;
  silence: number;
  contested: number;
  noWindow: number;
  /** Share of chunks that came back with a voice on them. */
  attributed: number;
};

/**
 * What alignment did, as four numbers.
 *
 * The refusal counts are headline figures for the same reason the attribution
 * eval prints its refusal rate: a change that improves accuracy by refusing a
 * third of the transcript is not an improvement, and the only way anybody sees
 * that is if the cost is printed beside the benefit.
 */
export function summarise(alignments: readonly Alignment[]): AlignmentSummary {
  const count = (reason: AlignmentReason) => alignments.filter((a) => a.reason === reason).length;
  const assigned = count("assigned");
  return {
    assigned,
    silence: count("silence"),
    contested: count("contested"),
    noWindow: count("no_window"),
    attributed: alignments.length === 0 ? 0 : assigned / alignments.length,
  };
}
