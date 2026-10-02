/**
 * Replace one exact phrase inside the text of every content block, on every page and locale.
 *
 *     npm run content:rename -- "Crisis Radar" "Radar" --dry
 *     npm run on:production -- content:rename -- "Crisis Radar" "Radar" --i-understand-this-deletes-production-data
 *
 * For copy that has no code default to sync from (a hand-written hero, a comparison row).
 * It changes copy only, never keys and never a link, image, id or block kind
 * (`RENAME_SKIPS`), and refuses a row whose blocks would change in any other way: same
 * number of blocks, same types, same keys. Every row is checked before any is written,
 * and the writes land in one transaction, so a refusal leaves nothing half renamed.
 */
import { eq } from "drizzle-orm";

import type { ContentBlock } from "../lib/db/schema";
import { renameIn, shapeOf } from "./_content-rename";
import { connect, schema } from "./db";
import { writesTo } from "./_verify";

const { contentPages } = schema;

const DRY = process.argv.includes("--dry");
const [from, to] = process.argv.slice(2).filter((a) => !a.startsWith("--"));

async function main() {
  if (!from || to === undefined || from === to) {
    console.error('Usage: npm run content:rename -- "<exact phrase>" "<replacement>" [--dry]');
    process.exit(1);
  }
  writesTo({ productionIsAllowed: true });
  const { pool, db } = connect();
  console.log(`replace: "${from}" -> "${to}"${DRY ? " (dry run, nothing is written)" : ""}\n`);

  /* First every row, checked; nothing is written if any one is refused. */
  const changes: { id: string; blocks: ContentBlock[] }[] = [];
  let total = 0;
  for (const row of await db.select().from(contentPages)) {
    const count = { n: 0 };
    const next = renameIn(row.blocks, from, to, count) as ContentBlock[];
    if (count.n === 0) continue;
    if (shapeOf(next) !== shapeOf(row.blocks)) throw new Error(`${row.slug} [${row.locale}]: shape changed, refusing`);
    console.log(`${row.slug} [${row.locale}] ${row.status}: ${count.n} replacement(s)`);
    changes.push({ id: row.id, blocks: next });
    total += count.n;
  }

  if (!DRY && changes.length > 0) {
    await db.transaction(async (tx) => {
      for (const change of changes) {
        await tx
          .update(contentPages)
          .set({ blocks: change.blocks, updatedAt: new Date() })
          .where(eq(contentPages.id, change.id));
      }
    });
  }
  console.log(`\n${DRY ? "would change" : "changed"} ${total} phrase(s) in ${changes.length} row(s).`);
  if (!DRY && changes.length > 0) console.log("The public pages cache for up to 300 seconds.");
  await pool.end();
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
