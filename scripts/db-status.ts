/**
 * Which migrations a database has, and which it is missing. Reads only.
 *
 *     npm run db:status                          # dev, from .env.local
 *     npm run on:production -- db:status         # production
 *
 * Run it on production before merging a pull request that adds a migration:
 * every migration the new code needs must already be applied there, because
 * nothing applies migrations on deploy. It exits 1 when anything is pending,
 * so "nothing pending" is a green line rather than a reading of the output.
 */
import { readFileSync } from "node:fs";

import { connect } from "./db";
import { migrationHash, migrationStatus, type JournalEntry, type LedgerRow } from "./_migration-ledger";

async function main(): Promise<void> {
  const url = process.env.DATABASE_URL ?? "";
  const host = url.match(/@([^/:?]+)/)?.[1] ?? "(none)";
  console.log(`reading ${host}\n`);

  const journal = (JSON.parse(readFileSync("drizzle/meta/_journal.json", "utf8")) as { entries: JournalEntry[] })
    .entries.map((entry) => ({ ...entry, hash: migrationHash(readFileSync(`drizzle/${entry.tag}.sql`, "utf8")) }));

  const { pool } = connect();
  let ledger: LedgerRow[] = [];
  try {
    const result = await pool.query("SELECT hash, created_at FROM drizzle.__drizzle_migrations");
    ledger = result.rows as LedgerRow[];
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (!/does not exist/.test(message)) throw error;
  } finally {
    await pool.end();
  }

  const status = migrationStatus(journal, ledger);
  console.log(`journal ${String(journal.length)} migrations, database has ${String(status.applied)}`);

  if (status.changed.length > 0) {
    console.log(`\napplied from a different file than the repository holds now (${String(status.changed.length)}):`);
    for (const tag of status.changed) console.log(`  ${tag}`);
  }
  if (status.skipped.length > 0) {
    console.log(`\nNEVER APPLIED and older than the last applied one, so db:migrate will skip them:`);
    for (const tag of status.skipped) console.log(`  ${tag}`);
  }
  if (status.pending.length > 0) {
    console.log(`\npending (${String(status.pending.length)}), applied by db:migrate:`);
    for (const tag of status.pending) console.log(`  ${tag}`);
    console.log("\nApply them before merging: npm run on:production -- db:migrate");
  } else {
    console.log("\nnothing pending.");
  }

  process.exit(status.pending.length > 0 || status.skipped.length > 0 ? 1 : 0);
}

void main();
