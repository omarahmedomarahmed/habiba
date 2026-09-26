/**
 * 🔴 Board 334/344: WHERE NOTHING WAS CAPTURED, ON THE SESSION'S CLOCK.
 *
 * `offRecordGaps` read each line against the one stored before it. Our room
 * uploads two tracks (the clinician's microphone and the patient's audio),
 * each numbering its own chunks, so the stored order ran clinician 0:08,
 * patient 1:44, clinician 0:16, patient 1:52... and every jump forward counted
 * as a stretch off record. A two-minute session with nothing taken off record
 * read "6 minutes were not recorded" to the clinician and "Part of this session
 * was not recorded" to the patient.
 *
 * A stretch counts only when NEITHER track covers it: lines sorted by where
 * they start, each measured against the furthest point anything before it had
 * reached. Pure, so the rule is a test (`tests/board-care.test.ts`).
 */
export function uncoveredStretches(
  segments: { startMs: number; endMs: number }[],
  thresholdMs: number,
): { fromMs: number; toMs: number; seconds: number }[] {
  const sorted = [...segments]
    .map((s) => ({ startMs: Number(s.startMs), endMs: Math.max(Number(s.startMs), Number(s.endMs)) }))
    .sort((a, b) => a.startMs - b.startMs || a.endMs - b.endMs);
  const out: { fromMs: number; toMs: number; seconds: number }[] = [];
  let reached: number | null = null;
  for (const segment of sorted) {
    if (reached !== null && segment.startMs - reached > thresholdMs) {
      out.push({ fromMs: reached, toMs: segment.startMs, seconds: Math.round((segment.startMs - reached) / 1000) });
    }
    reached = reached === null ? segment.endMs : Math.max(reached, segment.endMs);
  }
  return out;
}
