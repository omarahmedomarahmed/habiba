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
import { migrationLedgerAudit, writesTo } from "./_verify";

const LOCK_KEY = 24107;

async function main() {
  /*
   * 🔴 76.61 — THE BIGGEST UNGUARDED WRITE IN THE REPOSITORY, FOUND BY AUDITING
   *            THE RUN'S OWN COMMANDS AGAINST THE ALLOW-LIST.
   *
   * Thirty-nine scripts call `writesTo()`. This one did not, and it is the one
   * that changes the SHAPE of production rather than its contents. Pointing
   * `.env.local` at production and typing `npm run db:migrate` migrated it
   * silently: no announcement, no override, no line in the output naming the
   * database. `HAZARDS.md` already records `.env.local` sitting on production
   * for part of an afternoon while write scripts were being run, which is
   * exactly the afternoon this would have been irreversible.
   *
   * 🔴 AND THE SANCTIONED PATH DID NOT COVER IT EITHER. H16 says to apply a
   * migration to production BEFORE pushing `main`, and `npm run on:production`
   * is how a write to production is supposed to happen, and `db:migrate` was
   * not on its allow-list. So the documented safe procedure could not be
   * followed, which is H26: a guard that severs the path people legitimately
   * need is a guard people route around. `DEPLOY.md` told a reader to type a
   * command that would have been refused for not existing.
   *
   * `productionIsAllowed: true` because migrating production is a real and
   * necessary act. What it now requires is `I_MEAN_PRODUCTION` naming the
   * endpoint, which `on:production` sets and a tired person cannot type by
   * accident. Dev is unaffected beyond one line saying where it is writing.
   */
  writesTo({ productionIsAllowed: true });

  /*
   * 🔴 H52: THE LOCK NEEDS ONE SERVER SESSION, AND THE POOLER DOES NOT GIVE ONE.
   *
   * Neon's `-pooler` endpoint is PgBouncer in transaction mode: each statement
   * may run on a different server connection. `pg_advisory_lock` is held by a
   * SESSION, so the unlock below ran on another backend and the lock stayed on
   * an idle one, and the next run on that database refused with "Another
   * migration is already running". The direct endpoint is the same database
   * without the pooler, so the lock and the unlock meet.
   */
  const { pool, db } = connect(directEndpoint(process.env.DATABASE_URL));

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

/** The same Neon database without PgBouncer: `ep-x-pooler.region...` becomes `ep-x.region...`. */
function directEndpoint(url: string | undefined): string | undefined {
  if (!url) return url;
  try {
    const parsed = new URL(url);
    parsed.hostname = parsed.hostname.replace(/-pooler(?=\.)/, "");
    return parsed.toString();
  } catch {
    return url;
  }
}
