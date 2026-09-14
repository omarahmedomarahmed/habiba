/**
 * Does `scripts/age.ts` obey its own one rule?
 *
 *   npm run verify:age
 *
 * > **A timestamp in the past is a record of something that happened, and it
 * > moves. A timestamp in the future is a deadline, and it does not.**
 *
 * ## 🔴 Why this exists and is not optional
 *
 * `05-AGEING.md` names this as the script's gate, in these words: *age a table
 * containing one past and one future timestamp **in the same row**, and prove
 * the past one moved while the future one did not. Without it the script could
 * be shifting everything and nobody would know until a subscription renewed in
 * 1824.*
 *
 * The failure it guards against is invisible by construction. A script that
 * shifts every column produces a database that is internally consistent and
 * wrong: every date lines up with every other date, and the only symptom is a
 * plan that renews in the past or an invitation that expired before it was
 * sent. Nothing crashes. Nothing looks odd on a screen.
 *
 * So it is run against a real table with a real row, on whichever database
 * `DATABASE_URL` names, and it cleans up after itself.
 */
import { execFileSync } from "node:child_process";
import { existsSync, rmSync } from "node:fs";

import { sql } from "drizzle-orm";

import { reporter, required, writesTo } from "./_verify";
import { connect } from "./db";

const { check, finish } = reporter();

const MARKER = `agecheck${Date.now().toString(36).slice(-6)}`;
const TAG = `verify-age-${MARKER}`;
const DAYS = 30;

function runAge(...flags: string[]): string {
  return execFileSync("node", ["--import", "tsx", "scripts/age.ts", "--marker", MARKER, ...flags], {
    encoding: "utf8",
    env: process.env,
  });
}

async function main() {
  writesTo();

  const { pool, db } = connect();
  const markerFile = `.simulation-${MARKER}.json`;

  try {
    /*
     * 🔴 `person_invites` is the fixture because it is the shape the rule is
     * about: `created_at` in the past, `expires_at` in the future, in one row.
     * A synthetic table would prove the arithmetic and nothing about whether
     * the script's column discovery finds a real one.
     */
    runAge("--start");

    const personId = required(
      (
        await db.execute<{ id: string }>(sql`
          INSERT INTO people (first_name, last_name) VALUES ('Age', ${TAG}) RETURNING id`)
      ).rows[0],
      "fixture person",
    );

    /*
     * The invitation needs an issuer, and an EMPTY simulation branch has no
     * users on it. So the fixture brings its own rather than borrowing a row
     * that may not exist: a verifier that only passes on a populated database
     * is a verifier that cannot be run before the thing it gates.
     */
    const org = required(
      (
        await db.execute<{ id: string }>(sql`
          INSERT INTO organizations (name, slug) VALUES (${TAG}, ${TAG}) RETURNING id`)
      ).rows[0],
      "fixture organization",
    );

    const issuer = required(
      (
        await db.execute<{ id: string }>(sql`
          INSERT INTO users (organization_id, email, password_hash, role, first_name, last_name)
          VALUES (${org.id}, ${`${TAG}@example.com`}, 'x', 'therapist', 'Age', 'Example')
          RETURNING id`)
      ).rows[0],
      "fixture issuer",
    );

    /*
     * 🔴 `created_at` IS LEFT AT ITS DEFAULT, AND THE FIRST DRAFT OF THIS TEST
     * BACKDATED IT AND PROVED NOTHING.
     *
     * The wave filter is `created_at >= <the marker's start>`, which is how one
     * wave's rows are told from the previous wave's already-aged ones. A fixture
     * with a hand-set `created_at` two days ago sits OUTSIDE its own wave, so
     * nothing moved, and the test read as a script that does not work.
     *
     * A row written now is what the simulation actually produces, and `now()`
     * a moment ago is already in the past, so the rule applies to it exactly as
     * it will to a real session. The future half is `expires_at`, in the same
     * row, which is the pairing the whole gate is about.
     */
    const future = new Date(Date.now() + 10 * 86_400_000);

    const invite = required(
      (
        await db.execute<{ id: string }>(sql`
          INSERT INTO person_invites (person_id, issued_by_user_id, token_hash, expires_at)
          VALUES (${personId.id}, ${issuer.id}, ${TAG}, ${future.toISOString()})
          RETURNING id`)
      ).rows[0],
      "fixture invite",
    );

    const read = async () =>
      required(
        (
          await db.execute<{ created_at: string; expires_at: string }>(sql`
            SELECT created_at, expires_at FROM person_invites WHERE id = ${invite.id}`)
        ).rows[0],
        "fixture invite state",
      );

    const before = await read();

    /* ------------------------------------------------------------ dry run -- */

    const dry = runAge("--days", String(DAYS), "--dry");
    const afterDry = await read();

    check(
      "🔴 --dry writes nothing at all",
      new Date(afterDry.created_at).getTime() === new Date(before.created_at).getTime(),
      "a dry run that moved a row is worse than no dry run",
    );

    check(
      "…and still reports what it would have done",
      /person_invites/.test(dry) && /WOULD MOVE/.test(dry),
      "a preview nobody can read is not a preview",
    );

    /* -------------------------------------------------------------- the rule */

    runAge("--days", String(DAYS));
    const after = await read();

    const movedDays =
      (new Date(before.created_at).getTime() - new Date(after.created_at).getTime()) / 86_400_000;

    check(
      "🔴 the PAST timestamp moved back, by exactly the interval",
      Math.abs(movedDays - DAYS) < 0.01,
      `created_at moved ${movedDays.toFixed(2)} days`,
    );

    check(
      "🔴 …and the FUTURE timestamp in the SAME ROW did not move at all",
      new Date(after.expires_at).getTime() === new Date(before.expires_at).getTime(),
      "an invitation that expires in ten days still expires in ten days",
    );

    check(
      "🔴 CONTROL the two were genuinely different, one past and one future",
      new Date(before.created_at).getTime() < Date.now() &&
        new Date(before.expires_at).getTime() > Date.now(),
      "two past timestamps both moving would pass the check above and prove nothing",
    );

    /* --------------------------------------------------- the second refusal */

    let refused = false;
    try {
      runAge("--days", String(DAYS));
    } catch {
      refused = true;
    }

    check(
      "🔴 ageing the same wave twice is refused",
      refused,
      "a double shift leaves no trace in the data, so the refusal is the only evidence there is",
    );

    const stillOnce = await read();
    check(
      "🔴 …and the refusal happened BEFORE anything was written",
      new Date(stillOnce.created_at).getTime() === new Date(after.created_at).getTime(),
      "refusing after the update is not refusing",
    );

    /* ------------------------------------------------------- the guardrails */

    let badDays = false;
    try {
      execFileSync(
        "node",
        ["--import", "tsx", "scripts/age.ts", "--marker", `${MARKER}x`, "--days", "9000"],
        { encoding: "utf8", env: process.env, stdio: "pipe" },
      );
    } catch {
      badDays = true;
    }

    check(
      "a mistyped interval is refused rather than applied",
      badDays,
      "the one mistake here that running it again cannot undo",
    );
  } finally {
    await db.execute(sql`DELETE FROM person_invites WHERE token_hash = ${TAG}`);
    await db.execute(sql`DELETE FROM people WHERE last_name = ${TAG}`);
    await db.execute(sql`DELETE FROM users WHERE email = ${`${TAG}@example.com`}`);
    await db.execute(sql`DELETE FROM organizations WHERE slug = ${TAG}`);
    if (existsSync(markerFile)) rmSync(markerFile);
    if (existsSync(`.simulation-${MARKER}x.json`)) rmSync(`.simulation-${MARKER}x.json`);
    await pool.end();
  }

  finish("age");
}

main();
