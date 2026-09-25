/**
 * 🔴 76.48 — WHAT PRODUCTION HELD BEFORE THE SIMULATION TOUCHED IT.
 *
 *   npm run baseline -- record    write the counts, before the run
 *   npm run baseline -- check     compare now against them, after the restore
 *
 * ## Why this exists
 *
 * The decision was to run the six month simulation against the PRODUCTION
 * database and the PRODUCTION deployment, because a simulation on a preview
 * with a forked database is evidence about a configuration nobody will ever
 * run. A Neon snapshot is taken first, so undoing it is a restore rather than a
 * hand-written sweep across a hundred and thirteen tables.
 *
 * 🔴 BUT A RESTORE THAT NOBODY CHECKED IS A BELIEF, NOT A FACT. Neon reports a
 * restore as done when the branch is ready, which says nothing about whether
 * the rows in it are the rows that were there before. This is the check, and it
 * is the only thing standing between "we put it back" and "we think we put it
 * back".
 *
 * ## Every table, not the interesting ones
 *
 * A list of tables somebody chose is a list somebody chose while thinking about
 * sessions and money, and the row that survives a bad cleanup is the one nobody
 * was thinking about: an `audit_log` entry, a `notifications` row, a
 * `rate_limits` counter, a `person_claims` attempt. So the tables are read out
 * of `pg_tables` at run time. A table added next sprint is counted by a script
 * nobody edited.
 *
 * ## 🔴 IT READS AND NEVER WRITES
 *
 * Which is the whole reason it can be pointed at production, and the same
 * argument `settings:check` makes: the database that most needs asking is the
 * one a write guard has always refused to let anybody ask.
 */
import { readFileSync, writeFileSync } from "node:fs";

import { sql } from "drizzle-orm";

import { hostOf } from "./_verify";
import { connect } from "./db";

const FILE = "evals/production-baseline.json";

/**
 * 🔴 76.50b — TABLES THAT MOVE ON THEIR OWN, and naming them is the point.
 *
 * Production is publicly reachable, so ordinary traffic writes rows nobody
 * asked for: a crawler, a health check or a person opening the pricing page
 * bumps `rate_limits`, and any runtime error appends to `error_events`. Between
 * taking a snapshot and checking a restore against it, both move without
 * anything from the simulation having happened.
 *
 * That is exactly how a check becomes a check nobody reads. It goes red for a
 * reason somebody explains away once, and the next time it is red for a real
 * reason it gets the same shrug, which is H20.
 *
 * So these two are REPORTED and do not fail. Everything else fails. The list is
 * deliberately two entries long: a table is on it because traffic alone writes
 * to it, not because it was inconvenient. A simulation row hiding in
 * `rate_limits` is a row nobody would learn anything from; one hiding in
 * `sessions` is the whole reason this file exists.
 */
const MOVES_ON_ITS_OWN: Record<string, string> = {
  rate_limits: "any request to a rate-limited route, including a crawler",
  error_events: "any runtime error, from anybody",
  /*
   * 🔴 76.55 — THE THREE AUTH TABLES, ADDED AFTER THIS CHECK FAILED ON STEP ONE
   * OF THE RUN FOR A REASON THAT WAS NOBODY'S FAULT.
   *
   * `auth_sessions` went 1 -> 0 between recording the baseline and reading it
   * back. Nothing wrote to the database in between: a sign-in from the day
   * before had simply expired. The founder signing in to look at a screen moves
   * it the other way.
   *
   * That matters more than one row, because of where the check sits. The prompt
   * puts `baseline -- check` in step 1 and tells the agent to STOP and report if
   * it does not come back clean, before a single agent acts. So a table that
   * drifts on its own, in a check designed to be believed, produces a false
   * alarm on the first command of a six month run, and the second time it
   * happens somebody waves it through, which is the habit H20 exists to prevent.
   *
   * The test for this list is "could this row have changed with nobody running
   * the simulation", and for a session or a one-time token the answer is yes,
   * twice over: it appears when a person signs in and disappears on its own when
   * the clock passes it.
   */
  auth_sessions: "a sign-in creates one and expiry removes one, with nobody running anything",
  patient_auth_sessions: "the same, on the patient's side",
  auth_tokens: "a sign-in link or a reset, which expires by itself",
  /*
   * 🔴 0165: the scheduler writes these every hour with nobody running anything:
   * a heartbeat per job, a lease per check-in sweep, and at most one alert row
   * per problem per day.
   */
  cron_heartbeats: "every scheduled job, every run",
  cron_leases: "the hourly check-in sweep takes one",
  ops_alerts: "the hourly watchdog, when a job is late or errors appeared",
};

type Baseline = {
  comment: string;
  host: string;
  recordedAt: string;
  /** The Neon snapshot this baseline belongs to. A restore goes back to this. */
  snapshot: string;
  counts: Record<string, number>;
};

async function countEveryTable(db: ReturnType<typeof connect>["db"]) {
  const { rows: tables } = await db.execute(
    sql`SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename`,
  );

  const counts: Record<string, number> = {};
  for (const row of tables as { tablename: string }[]) {
    /*
     * 🔴 `sql.raw` on an IDENTIFIER THAT CAME FROM THE CATALOGUE, which is the
     * one case H7 allows: the value is a table name Postgres itself just handed
     * back, not anything a person or a request supplied. Binding it as a
     * parameter is not possible, because a table name is not a value.
     */
    const { rows } = await db.execute(
      sql`SELECT count(*)::int AS n FROM ${sql.raw(`"${row.tablename}"`)}`,
    );
    counts[row.tablename] = Number((rows[0] as { n: number }).n);
  }
  return counts;
}

async function main() {
  const verb = process.argv[2] ?? "check";
  const host = hostOf();
  const { pool, db } = connect();

  try {
    const counts = await countEveryTable(db);
    const total = Object.values(counts).reduce((a, b) => a + b, 0);

    if (verb === "record") {
      const snapshot = process.argv[3] ?? "";
      if (!snapshot) {
        console.error(
          "Name the Neon snapshot this baseline belongs to:\n" +
            "  npm run baseline -- record snap-xxxxxxxx\n\n" +
            "A baseline with no snapshot beside it is a record of what was lost.",
        );
        process.exitCode = 1;
        return;
      }

      const baseline: Baseline = {
        comment:
          "🔴 76.48. What production held before the simulation ran on it. `npm run baseline -- check` " +
          "compares the database against this and fails on any difference. It is the proof that the " +
          "restore put things back, rather than the belief that it did. Recorded against a Neon snapshot; " +
          "restoring that snapshot is what makes this file true again.",
        host,
        recordedAt: new Date().toISOString(),
        snapshot,
        counts,
      };

      writeFileSync(FILE, `${JSON.stringify(baseline, null, 2)}\n`);
      console.log(`\n🔴 Baseline recorded from ${host}\n`);
      console.log(`  ${Object.keys(counts).length} tables, ${total} rows in total`);
      console.log(`  snapshot ${snapshot}`);
      for (const [table, n] of Object.entries(counts).filter(([, n]) => n > 0)) {
        console.log(`    ${String(n).padStart(6)}  ${table}`);
      }
      console.log(`\n  wrote ${FILE}\n`);
      return;
    }

    const recorded = JSON.parse(readFileSync(FILE, "utf8")) as Baseline;

    console.log(`\n🔴 Is this database back where it started?\n`);
    console.log(`  now:      ${host}`);
    console.log(`  baseline: ${recorded.host}, recorded ${recorded.recordedAt.slice(0, 10)}`);
    console.log(`  snapshot: ${recorded.snapshot}\n`);

    if (host !== recorded.host) {
      console.log(
        "🔴 DIFFERENT DATABASE. This baseline was taken somewhere else, so comparing\n" +
          "   against it would answer a question nobody asked.",
      );
      process.exitCode = 1;
      return;
    }

    /*
     * 🔴 THE UNION OF BOTH SIDES, so a table that has appeared since is a
     * difference rather than a silence. A comparison that walks only the
     * recorded keys cannot see a table the simulation created.
     */
    const every = [...new Set([...Object.keys(recorded.counts), ...Object.keys(counts)])].sort();
    const drift = every
      .map((table) => ({
        table,
        was: recorded.counts[table] ?? 0,
        now: counts[table] ?? 0,
      }))
      .filter((row) => row.was !== row.now);

    const incidental = drift.filter((row) => row.table in MOVES_ON_ITS_OWN);
    const real = drift.filter((row) => !(row.table in MOVES_ON_ITS_OWN));

    if (incidental.length > 0) {
      console.log("  moved on their own, which is not the simulation:\n");
      for (const row of incidental) {
        const sign = row.now > row.was ? "+" : "";
        console.log(
          `    ${row.table.padEnd(24)} ${String(row.was).padStart(5)} -> ${String(row.now).padStart(5)}  (${sign}${row.now - row.was})  ${MOVES_ON_ITS_OWN[row.table]}`,
        );
      }
      console.log("");
    }

    if (real.length === 0) {
      console.log(`  every one of ${every.length} tables holds what it held before`);
      console.log(
        incidental.length > 0
          ? `  ${total} rows, and the only movement is the ${incidental.length} above\n`
          : `  ${total} rows, unchanged\n`,
      );
      return;
    }

    console.log(`  🔴 ${real.length} table(s) differ:\n`);
    for (const row of real) {
      const sign = row.now > row.was ? "+" : "";
      console.log(
        `    ${row.table.padEnd(32)} ${String(row.was).padStart(6)} -> ${String(row.now).padStart(6)}  (${sign}${row.now - row.was})`,
      );
    }
    console.log(
      `\n  Restoring snapshot ${recorded.snapshot} is what makes this pass.\n` +
        "  Rows left behind by a hand-written cleanup show up here and nowhere else.\n",
    );
    process.exitCode = 1;
  } catch (error) {
    console.error("failed:", error instanceof Error ? error.message : error);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

main();
