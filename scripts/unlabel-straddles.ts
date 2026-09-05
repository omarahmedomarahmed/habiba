/**
 * Take back the labels that were never safe to give.
 *
 *   npx tsx scripts/unlabel-straddles.ts --dry
 *   npx tsx scripts/unlabel-straddles.ts
 *
 * C35: a line holding two speakers cannot carry one label. `diariseSession`
 * now refuses those going forward; this reclassifies the ones already written.
 *
 * Only touches `speaker_inferred` rows. A label that came from a real second
 * microphone is a measurement and is never revisited, however the text reads —
 * two-track capture knows whose track it arrived on, and a question mark in the
 * middle of it just means both people were recorded talking over each other.
 */
import { and, eq, inArray } from "drizzle-orm";

import { straddlesTurnBoundary } from "../lib/ai/diarise";
import { connect, schema } from "./db";

const { transcriptSegments } = schema;
const DRY = process.argv.includes("--dry");

async function main() {
  const { pool, db } = connect();
  try {
    const rows = await db
      .select({
        id: transcriptSegments.id,
        text: transcriptSegments.text,
        speaker: transcriptSegments.speaker,
      })
      .from(transcriptSegments)
      .where(eq(transcriptSegments.speakerInferred, true));

    const bad = rows.filter((r) => straddlesTurnBoundary(r.text));

    console.log(
      `${rows.length} inferred label(s); ${bad.length} sit on a line containing two speakers ` +
        `(${((100 * bad.length) / Math.max(1, rows.length)).toFixed(1)}%)`,
    );

    for (const r of bad.slice(0, 6)) {
      console.log(`  was ${r.speaker}: ${r.text.slice(0, 100)}`);
    }

    if (DRY) {
      console.log("\ndry run — nothing written");
      return;
    }
    if (bad.length === 0) return;

    let cleared = 0;
    const ids = bad.map((r) => r.id);
    // Chunked: `inArray` is one bind parameter per id (H7 — bound, never raw).
    for (let i = 0; i < ids.length; i += 500) {
      const slice = ids.slice(i, i + 500);
      const done = await db
        .update(transcriptSegments)
        .set({ speaker: "unknown", speakerInferred: false })
        .where(
          and(
            inArray(transcriptSegments.id, slice),
            // Guarded: only ever clears an inference, never a measurement.
            eq(transcriptSegments.speakerInferred, true),
          ),
        )
        .returning({ id: transcriptSegments.id });
      cleared += done.length;
    }

    console.log(`\n${cleared} label(s) returned to unknown`);
  } finally {
    await pool.end();
  }
}

main();
