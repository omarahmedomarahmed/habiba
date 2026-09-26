/**
 * The room's live transcript, keyed by the STORED sequence.
 *
 * Video shoot note 1: the room only ever added the lines that came back on its
 * own uploads, so anything saved by another writer (the patient's track posted
 * from elsewhere, a second tab, a rejoin) reached the note and the copilot but
 * never the panel the clinician was reading. The room now also reads the saved
 * segments on its poll, and both sources meet here. One key for both, the
 * sequence the writer assigned, so a line that arrives twice is shown once.
 */
export type LiveLine = {
  id: string;
  speaker: "therapist" | "patient" | "unknown";
  text: string;
};

export function lineId(sequence: number): string {
  return `seq-${sequence}`;
}

function sequenceOf(id: string): number {
  const match = /^seq-(\d+)$/.exec(id);
  return match ? Number(match[1]) : Number.POSITIVE_INFINITY;
}

/** The highest stored sequence already on screen, or 0. */
export function lastSequence(lines: readonly { id: string }[]): number {
  let max = 0;
  for (const line of lines) {
    const n = sequenceOf(line.id);
    if (Number.isFinite(n) && n > max) max = n;
  }
  return max;
}

/** Adds what is new, keeps what is there, and orders by the stored sequence. */
export function mergeLiveLines<T extends LiveLine>(current: readonly T[], incoming: readonly T[]): T[] {
  const seen = new Set(current.map((line) => line.id));
  const added = incoming.filter((line) => {
    if (seen.has(line.id)) return false;
    seen.add(line.id);
    return true;
  });
  if (added.length === 0) return current as T[];
  return [...current, ...added].sort((a, b) => {
    const x = sequenceOf(a.id);
    const y = sequenceOf(b.id);
    return x === y ? 0 : x < y ? -1 : 1;
  });
}
