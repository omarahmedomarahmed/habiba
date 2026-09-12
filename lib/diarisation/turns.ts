/**
 * Acoustic turns, as arithmetic. PLAN.md 37.1.
 *
 * ## What this is, and what it is deliberately not
 *
 * A diarisation provider answers one question: *between these two timestamps,
 * voice number two was speaking.* It does not know who voice number two is, it
 * cannot know, and nothing in this file pretends otherwise. Everything here
 * operates on an opaque `label` — `"spk_0"`, `"B"`, `"2"` — and the question of
 * whose voice that is belongs to `voices.ts`, which will only answer it from
 * evidence.
 *
 * ## Why it is pure
 *
 * The half of sprint 37 that needs a provider is the half that cannot be
 * measured without one. This half can be measured exactly, today, against
 * fixtures with gold labels, and the properties that matter are properties of
 * the arithmetic rather than of the model:
 *
 *   - a turn list with negative, zero-length, out-of-order or overlapping
 *     turns comes back usable, because providers emit all four;
 *   - two people talking at once is **kept as two turns**, never flattened
 *     into whoever was louder;
 *   - no interval is invented, extended past the recording, or dropped
 *     silently.
 *
 * ⚠️ **37.4 is the named gap.** Nothing here calls a provider, and the acoustic
 * diarisation error rate — the number that says how well a provider separates
 * two voices in one room — is not measured in this sprint. It is recorded as a
 * gap in PLAN.md rather than absorbed, in the same way 35R.4 is.
 */

export type Interval = {
  startMs: number;
  endMs: number;
};

/** One stretch of speech by one voice, as a provider reports it. */
export type AcousticTurn = Interval & {
  /** The provider's opaque voice label. Not a person. Not a role. */
  label: string;
};

/**
 * The largest gap two turns by the same voice may have and still be one turn.
 *
 * A quarter of a second is a breath, not a turn change. Providers routinely
 * emit a run of 200ms fragments for one continuous sentence, and leaving them
 * separate makes every downstream count — turns taken, longest turn, speaking
 * time — describe the provider's framing rather than the conversation.
 */
export const MERGE_GAP_MS = 250;

export function durationOf(interval: Interval): number {
  return Math.max(0, interval.endMs - interval.startMs);
}

/** Milliseconds two intervals share. Zero when they merely touch. */
export function overlapMs(a: Interval, b: Interval): number {
  return Math.max(0, Math.min(a.endMs, b.endMs) - Math.max(a.startMs, b.startMs));
}

function usable(turn: AcousticTurn): boolean {
  return (
    typeof turn.label === "string" &&
    turn.label.length > 0 &&
    Number.isFinite(turn.startMs) &&
    Number.isFinite(turn.endMs) &&
    turn.endMs > turn.startMs &&
    turn.startMs >= 0
  );
}

export type NormalisedTurns = {
  turns: AcousticTurn[];
  /** Turns thrown away for being unusable. Reported, never swallowed. */
  discarded: number;
  /** Same-voice fragments joined into one turn. */
  merged: number;
};

/**
 * Put a provider's turn list into the shape the rest of the code may assume.
 *
 * Sorted by start, then end. Unusable turns discarded **and counted**, because
 * a provider that starts emitting nonsense should be visible as a number
 * rather than as a transcript that quietly attributes less of itself each week.
 * Adjacent fragments of one voice merged when the gap is a breath.
 *
 * 🔴 Overlapping turns by *different* voices are preserved exactly as given.
 * Two people talking at once is the single most common reason a transcript
 * line cannot honestly be attributed, and a normaliser that resolved it here —
 * by keeping the longer turn, say — would delete the evidence that the line is
 * contested before anything had the chance to refuse it.
 */
export function normaliseTurns(
  input: readonly AcousticTurn[],
  mergeGapMs: number = MERGE_GAP_MS,
): NormalisedTurns {
  const keep = input.filter(usable);
  const discarded = input.length - keep.length;

  const sorted = [...keep].sort((a, b) =>
    a.startMs === b.startMs ? a.endMs - b.endMs : a.startMs - b.startMs,
  );

  const turns: AcousticTurn[] = [];
  let merged = 0;

  for (const turn of sorted) {
    const last = turns[turns.length - 1];
    /*
     * Only the immediately preceding turn is a merge candidate. A turn by
     * another voice in between means the two fragments are not adjacent in the
     * conversation, whatever the clock says, so they stay two turns.
     */
    if (last && last.label === turn.label && turn.startMs - last.endMs <= mergeGapMs) {
      last.endMs = Math.max(last.endMs, turn.endMs);
      merged += 1;
      continue;
    }
    turns.push({ label: turn.label, startMs: turn.startMs, endMs: turn.endMs });
  }

  return { turns, discarded, merged };
}

/** Speaking time per voice, in milliseconds. Overlap is counted for both. */
export function speakingTime(turns: readonly AcousticTurn[]): Map<string, number> {
  const totals = new Map<string, number>();
  for (const turn of turns) {
    totals.set(turn.label, (totals.get(turn.label) ?? 0) + durationOf(turn));
  }
  return totals;
}

/**
 * The regions where more than one voice is speaking.
 *
 * Kept as a first-class output rather than a side effect of alignment: it is
 * the clinical fact that a couples session has two people talking over each
 * other for four minutes, and it is the reason those minutes are unattributed.
 */
export function crosstalk(turns: readonly AcousticTurn[]): Interval[] {
  const out: Interval[] = [];
  for (let i = 0; i < turns.length; i += 1) {
    for (let j = i + 1; j < turns.length; j += 1) {
      const a = turns[i]!;
      const b = turns[j]!;
      if (a.label === b.label) continue;
      /* Sorted by start, so nothing later can reach back past this one. */
      if (b.startMs >= a.endMs) break;
      const shared = overlapMs(a, b);
      if (shared > 0) out.push({ startMs: Math.max(a.startMs, b.startMs), endMs: Math.min(a.endMs, b.endMs) });
    }
  }
  return merge(out);
}

/** Union of intervals, so overlapping crosstalk regions are reported once. */
function merge(intervals: Interval[]): Interval[] {
  const sorted = [...intervals].sort((a, b) => a.startMs - b.startMs);
  const out: Interval[] = [];
  for (const interval of sorted) {
    const last = out[out.length - 1];
    if (last && interval.startMs <= last.endMs) {
      last.endMs = Math.max(last.endMs, interval.endMs);
      continue;
    }
    out.push({ ...interval });
  }
  return out;
}

/** How much of a recording anybody was speaking at all. The VAD arithmetic. */
export function speechCoverage(turns: readonly AcousticTurn[], durationMs: number): number {
  if (durationMs <= 0) return 0;
  const spoken = merge(turns.map((turn) => ({ startMs: turn.startMs, endMs: turn.endMs })))
    .reduce((total, interval) => total + durationOf(interval), 0);
  return Math.min(1, spoken / durationMs);
}

/**
 * The voices of a recording, in the order they are first heard.
 *
 * The order is what makes "Speaker 3" mean the same thing to the clinician
 * reading the transcript as it does to the code: the third distinct voice in
 * the room. It is derived from the audio and nothing else, so it is stable
 * across re-runs of the same recording and carries no identity at all.
 */
export function voiceOrder(turns: readonly AcousticTurn[]): string[] {
  const seen: string[] = [];
  for (const turn of turns) {
    if (!seen.includes(turn.label)) seen.push(turn.label);
  }
  return seen;
}
