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
 */
import { migrate } from "drizzle-orm/neon-serverless/migrator";

import { connect } from "./db";

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
