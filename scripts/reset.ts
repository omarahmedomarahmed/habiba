/**
 * Empty the database and stand it back up. PLAN.md 12.6, run by sprint 22.
 *
 *   node --import tsx --conditions=react-server scripts/reset.ts --i-mean-it
 *   … --i-mean-it --demo     …and seed the demo therapist and session
 *
 * Every row in this product today is test data (§4 · THE RESET): the
 * therapists are real people who agreed to try it, the records are not
 * clinical records anybody is keeping. Before launch the whole thing is
 * emptied, admin is seeded fresh, and every key is rotated.
 *
 * ## Why this is one command and not a runbook
 *
 * A launch checklist that says "truncate these fifty-one tables, then seed, then
 * republish the pages" is a checklist somebody performs at midnight with a
 * deploy waiting. The order matters — foreign keys, then settings, then
 * content — and the failure mode of getting it wrong is a half-empty database
 * that looks fine until a therapist signs in.
 *
 * ## What it deliberately does not do
 *
 * **It does not rotate keys.** Rotating `AUTH_SECRET`, the OpenAI key, the
 * Stripe keys and the WhatsApp token happens in the hosting dashboards, by a
 * person, and a script that claimed to have done it would be the most
 * dangerous line in this repository. Sprint 22 lists them; this empties the
 * database.
 *
 * **It does not drop tables.** The schema is drizzle's to own — see
 * `verify-migrations.ts`. This removes rows, so the migration ledger and every
 * constraint survive and the database that comes back is the one the code
 * expects.
 *
 * ## The guard
 *
 * `--i-mean-it` is required, and the host is printed and re-typed. `reset.ts`
 * against production with no argument must be a no-op that prints what it
 * would have done, because the day somebody runs this from the wrong terminal
 * is the day it matters.
 */
import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";
import { sql } from "drizzle-orm";

import { connect } from "./db";

/**
 * Everything with rows, in no particular order.
 *
 * One `TRUNCATE ... CASCADE` handles the dependency graph, which is why the
 * order does not matter and why this is not a hand-maintained topological
 * sort that drifts from the schema every sprint.
 *
 * 🔴 `drizzle.__drizzle_migrations` is **not** here and must never be. Emptying
 * the ledger tells the next `db:migrate` that nothing has ever run, and it
 * would replay forty-two migrations against a database that already has every
 * object — H1, in its worst form.
 */
const KEEP: string[] = [
  // Nothing. Even settings and content are re-seeded below, from the
  // repository, so what comes back is what the code says rather than whatever
  // an admin last typed into a form.
];

export async function tableNames(db: ReturnType<typeof connect>["db"]): Promise<string[]> {
  const result = await db.execute<{ table_name: string }>(sql`
    SELECT table_name
      FROM information_schema.tables
     WHERE table_schema = 'public'
       AND table_type = 'BASE TABLE'
     ORDER BY table_name
  `);

  return result.rows.map((row) => row.table_name).filter((name) => !KEEP.includes(name));
}

/** `true` when this module was run directly rather than imported by a checker. */
const isEntrypoint = process.argv[1]?.endsWith("reset.ts") ?? false;

async function main() {
  const confirmed = process.argv.includes("--i-mean-it");
  const demo = process.argv.includes("--demo");

  const { db, pool } = connect();
  const host = process.env.DATABASE_URL?.split("@")[1]?.split("/")[0] ?? "unknown host";
  const tables = await tableNames(db);

  const [counts] = (
    await db.execute<{ rows: number }>(sql`
      SELECT (
        (SELECT COUNT(*) FROM users)
        + (SELECT COUNT(*) FROM patients)
        + (SELECT COUNT(*) FROM sessions)
      )::int AS rows
    `)
  ).rows;

  console.log(`\n  database   ${host}`);
  console.log(`  tables     ${tables.length}`);
  console.log(`  users + patients + sessions   ${counts?.rows ?? 0} rows\n`);

  if (!confirmed) {
    console.log("  Dry run. Nothing was deleted.");
    console.log("  Re-run with --i-mean-it to empty every table above and re-seed.\n");
    await pool.end();
    return;
  }

  /*
   * Typed, not just flagged. `--i-mean-it` can be in shell history; the host
   * name cannot be tab-completed from it, and typing the name of the database
   * you are about to empty is the last moment anybody notices it is the wrong
   * one.
   */
  const rl = createInterface({ input: stdin, output: stdout });
  const answer = await rl.question(`  Type the host to confirm (${host}): `);
  rl.close();

  if (answer.trim() !== host) {
    console.log("\n  That is not the host. Nothing was deleted.\n");
    await pool.end();
    process.exit(1);
  }

  const list = tables.map((name) => `"public"."${name}"`).join(", ");
  await db.execute(sql.raw(`TRUNCATE TABLE ${list} RESTART IDENTITY CASCADE`));
  console.log(`\n  ✓ truncated ${tables.length} tables`);

  await pool.end();

  /*
   * Re-seeded by running the real scripts as subprocesses rather than by
   * importing them. Each one owns its own connection and its own idempotency,
   * and a copy of their logic here would be a second implementation to keep in
   * step with the first.
   */
  const { execFileSync } = await import("node:child_process");
  const run = (args: string[]) => {
    console.log(`  → ${args.join(" ")}`);
    execFileSync("node", ["--import", "tsx", "--conditions=react-server", ...args], {
      stdio: "inherit",
    });
  };

  run(["scripts/settings.ts", "seed"]);
  // `--refresh-content` because the point of a reset is that the pages come
  // back from `defaults.ts`. Without it the seed leaves CMS rows alone, which
  // is right on a deploy and wrong here.
  run(["scripts/seed.ts", "--refresh-content", ...(demo ? ["--demo"] : [])]);

  console.log("\n  ✓ reset complete.");
  console.log("  🔴 Keys are NOT rotated by this script. Sprint 22 lists them.\n");
}

if (isEntrypoint) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
