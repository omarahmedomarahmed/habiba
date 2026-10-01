/**
 * Replace one exact phrase inside the text of every content block, on every page and locale.
 *
 *     npm run content:rename -- "Crisis Radar" "Radar" --dry
 *     npm run on:production -- content:rename -- "Crisis Radar" "Radar" --i-understand-this-deletes-production-data
 *
 * For copy that has no code default to sync from (a hand-written hero, a comparison row).
 * It changes string values only, never keys, and refuses to write a row whose blocks
 * would change in any other way: same number of blocks, same types, same keys.
 */
import { eq } from "drizzle-orm";

import type { ContentBlock } from "../lib/db/schema";
import { connect, schema } from "./db";
import { writesTo } from "./_verify";

const { contentPages } = schema;

const DRY = process.argv.includes("--dry");
const [from, to] = process.argv.slice(2).filter((a) => !a.startsWith("--"));

function rename(value: unknown, count: { n: number }): unknown {
  if (typeof value === "string") {
    if (!value.includes(from!)) return value;
    count.n += value.split(from!).length - 1;
    return value.split(from!).join(to!);
  }
  if (Array.isArray(value)) return value.map((v) => rename(v, count));
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, rename(v, count)]));
  }
  return value;
}

function shape(blocks: ContentBlock[]): string {
  const keys = (v: unknown): unknown =>
    Array.isArray(v) ? v.map(keys) : v && typeof v === "object"
      ? Object.fromEntries(Object.entries(v).map(([k, x]) => [k, keys(x)]))
      : typeof v === "string" ? "s" : v;
  return JSON.stringify(blocks.map((b) => [b.type, keys(b)]));
}

async function main() {
  if (!from || to === undefined || from === to) {
    console.error('Usage: npm run content:rename -- "<exact phrase>" "<replacement>" [--dry]');
    process.exit(1);
  }
  writesTo({ productionIsAllowed: true });
  const { pool, db } = connect();
  console.log(`replace: "${from}" -> "${to}"${DRY ? " (dry run, nothing is written)" : ""}\n`);

  let rows = 0;
  let total = 0;
  for (const row of await db.select().from(contentPages)) {
    const count = { n: 0 };
    const next = rename(row.blocks, count) as ContentBlock[];
    if (count.n === 0) continue;
    if (shape(next) !== shape(row.blocks)) throw new Error(`${row.slug} [${row.locale}]: shape changed, refusing`);
    console.log(`${row.slug} [${row.locale}] ${row.status}: ${count.n} replacement(s)`);
    rows += 1;
    total += count.n;
    if (!DRY) await db.update(contentPages).set({ blocks: next, updatedAt: new Date() }).where(eq(contentPages.id, row.id));
  }
  console.log(`\n${DRY ? "would change" : "changed"} ${total} phrase(s) in ${rows} row(s).`);
  if (!DRY && rows > 0) console.log("The public pages cache for up to 300 seconds.");
  await pool.end();
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
