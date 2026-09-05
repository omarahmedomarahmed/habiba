/**
 * How often does a transcript line stop in the middle of what someone was saying?
 *
 * Sprint 3's acceptance is "no transcript line ends mid-word across a 10-session
 * sample". This measures it.
 *
 * ## What it can and cannot prove
 *
 * It can measure the corpus as it stands. It **cannot** prove the fix, because
 * every segment in this database was recorded by the old cutter — a metronome
 * that flushed every 8 seconds wherever the speaker happened to be. The new
 * rule only applies to audio recorded after it ships, so the honest use of this
 * script is: run it now for a baseline, run it again after real sessions have
 * been recorded, and compare.
 *
 * ## The heuristic
 *
 * "Mid-word" in the strict sense is not decidable from text alone — a truncated
 * Arabic or English token is still a sequence of letters. Two signals are
 * reported instead, both of which the old cutter produces and a pause-aligned
 * cutter should not:
 *
 *   - **no terminal punctuation**: the line stops without ., !, ?, …, ، or ؟
 *   - **continuation**: the next line begins with a lowercase letter or an
 *     Arabic continuation word, i.e. it reads as the second half of a sentence
 *
 * Neither is proof on its own. Together they bound the problem, and both should
 * fall sharply once cuts land in pauses.
 */
import { asc, eq } from "drizzle-orm";

import { connect, schema } from "./db";

const { transcriptSegments } = schema;

const TERMINAL = /[.!?…،؟]\s*$/u;
/** Arabic words that almost never begin a sentence. */
const AR_CONTINUATION = /^(و|ف|عشان|لأن|إن|أن|اللي|يعني|بس|كمان|علشان)\b/u;
const LOWER_START = /^[a-z]/u;

async function main() {
  const { pool, db } = connect();
  try {
    const sessionIds = (
      await db
        .selectDistinct({ id: transcriptSegments.sessionId })
        .from(transcriptSegments)
    ).map((r) => r.id);

    let lines = 0;
    let noTerminal = 0;
    let continuation = 0;
    let sampled = 0;

    for (const id of sessionIds) {
      const rows = await db
        .select({ text: transcriptSegments.text })
        .from(transcriptSegments)
        .where(eq(transcriptSegments.sessionId, id))
        .orderBy(asc(transcriptSegments.sequence));

      // A session with one segment has no interior cut to judge.
      if (rows.length < 2) continue;
      sampled += 1;

      for (let i = 0; i < rows.length - 1; i += 1) {
        const text = rows[i]!.text.trim();
        const next = rows[i + 1]!.text.trim();
        lines += 1;
        if (!TERMINAL.test(text)) noTerminal += 1;
        if (LOWER_START.test(next) || AR_CONTINUATION.test(next)) continuation += 1;
      }
    }

    const pct = (n: number) => (lines === 0 ? "0.0" : ((100 * n) / lines).toFixed(1));
    console.log(
      [
        `sessions with an interior cut: ${sampled} of ${sessionIds.length}`,
        `interior cuts measured:        ${lines}`,
        `ending without punctuation:    ${noTerminal}  (${pct(noTerminal)}%)`,
        `next line reads as a continuation: ${continuation}  (${pct(continuation)}%)`,
      ].join("\n"),
    );
  } finally {
    await pool.end();
  }
}

main();
