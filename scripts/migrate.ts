/**
 * Migration runner.
 *
 * Two behaviours carried over from the old runner because both were paid for
 * in failed deploys:
 *   1. A Postgres advisory lock, so two deploys racing each other serialise
 *      instead of both applying the same migration.
 *   2. Failing loudly. There is deliberately no `--auto-baseline` flag here:
 *      the old one rewrote stored checksums on mismatch, which meant editing an
 *      already-applied migration passed silently in production and only blew up
 *      locally.
 *
 * ## 🔴 AND A THIRD, WHICH IS WHY "Migrations applied." IS NO LONGER SAYABLE BY ITSELF
 *
 * Sprint 52 wrote `0083_verification_one_truth.sql` and never generated a journal entry for it.
 * Drizzle reads the JOURNAL, not the directory, so this script skipped the file entirely and
 * printed **"Migrations applied."** — a true sentence about the journal and a false one about the
 * repository. Production sat without C285 while a fifteen-check verifier passed green against a
 * database a one-off script had built.
 *
 * A runner whose success message can be true while a migration on disk has never run is a runner
 * that reports on itself rather than on the schema. So it REFUSES before it starts if the files and
 * the journal disagree, or if any entry is stamped behind its predecessor and therefore
 * unreachable, and it says which file. Failing loudly, applied to the one thing the old version
 * could not see.
 */
import { migrate } from "drizzle-orm/neon-serverless/migrator";

import { connect } from "./db";
import { migrationLedgerAudit } from "./_verify";

const LOCK_KEY = 24107;

async function main() {
  const { pool, db } = connect();

  const locked = await pool.query<{ locked: boolean }>(
    "SELECT pg_try_advisory_lock($1) AS locked",
    [LOCK_KEY],
  );

  if (!locked.rows[0]?.locked) {
    console.error("Another migration is already running (advisory lock held). Aborting.");
    await pool.end();
    process.exit(1);
  }

  try {
    /*
     * 🔴 Before anything is applied: does the journal describe the directory?
     *
     * Checked here rather than only in a verifier because the verifier runs when somebody runs it,
     * and this runs on every deploy. The ledger comparison is deliberately NOT a refusal — a
     * database legitimately behind the journal is the normal reason to be running this at all — so
     * only the two file-level disagreements stop the run.
     */
    const audit = await migrationLedgerAudit((query) =>
      pool.query(query).then((r) => ({ rows: r.rows as Record<string, unknown>[] })),
    );

    if (audit.inFilesNotInJournal.length > 0) {
      console.error(
        `Refusing to run: ${audit.inFilesNotInJournal.join(", ")} ` +
          "has no entry in drizzle/meta/_journal.json, so drizzle cannot see it and would report " +
          "success without applying it. Generate the entry (drizzle-kit generate --custom) rather " +
          "than applying the file by hand.",
      );
      process.exitCode = 1;
      return;
    }

    if (audit.unreachable.length > 0) {
      console.error(
        `Refusing to run: ${audit.unreachable.join(", ")}. Drizzle applies a migration only when ` +
          "the previous one's timestamp is lower, so an entry stamped behind its predecessor is " +
          "skipped as silently as a missing one.",
      );
      process.exitCode = 1;
      return;
    }

    console.log(
      `Journal and directory agree: ${audit.journalCount} migrations, database at ${audit.ledgerCount}.`,
    );
    console.log("Applying migrations…");
    await migrate(db, { migrationsFolder: "./drizzle" });
    console.log("Migrations applied.");
  } catch (error) {
    console.error("Migration failed:", error instanceof Error ? error.message : error);
    process.exitCode = 1;
  } finally {
    await pool.query("SELECT pg_advisory_unlock($1)", [LOCK_KEY]);
    await pool.end();
  }
}

main();
