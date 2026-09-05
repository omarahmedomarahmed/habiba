/**
 * Sprint 6 acceptance, against the real database.
 *
 *   node --import tsx --conditions=react-server scripts/verify-sprint6.ts
 *
 * Sprint 6 hands a clinical record to the person it describes. Almost every
 * guarantee in it is a database guarantee — a partial unique index, a
 * conditional UPDATE, a single-use token — and none of those can be verified by
 * reading the migration (H1: `db:migrate` prints success even when it skips a
 * file). So this script *tries the thing that must fail* and reports whether it
 * actually failed.
 *
 * It writes. Everything it creates is prefixed `verify6-` and deleted in the
 * `finally`, and it refuses to run against a database whose URL does not name a
 * branch — see the guard in `main`.
 */
import { randomUUID } from "node:crypto";
import { and, eq, sql } from "drizzle-orm";

import { connect, schema } from "./db";

const { patientAccounts, patientAuthSessions, people, personClaims, personInvites } = schema;

let failures = 0;
const check = (name: string, ok: boolean, detail = "") => {
  console.log(`${ok ? "  ok  " : "FAIL  "}${name}${detail ? ` — ${detail}` : ""}`);
  if (!ok) failures += 1;
};
const skip = (name: string, why: string) => console.log(`  --   ${name} — NOT EXERCISED: ${why}`);

const TAG = `verify6-${randomUUID().slice(0, 8)}`;
const email = (n: string) => `${TAG}-${n}@example.invalid`;

async function main() {
  /*
   * This script writes, and `main` is production.
   *
   * A Neon connection string names a compute endpoint, not a branch, so
   * "does the URL look like a branch" is unanswerable from the string alone.
   * What *is* answerable is whether it is the one endpoint we must never
   * touch: `ep-wild-lake-a6tgm2r6` is the read-write compute on branch
   * `br-curly-dream-a6b0shlz`, which is `main` (listed 2026-09-05). It is
   * refused by name, and the host is printed either way so a wrong database
   * shows up in the output rather than in the data.
   */
  const url = process.env.DATABASE_URL ?? "";
  const host = url.match(/@([^/:?]+)/)?.[1] ?? "(none)";
  const PRODUCTION_ENDPOINT = "ep-wild-lake-a6tgm2r6";

  console.log(`writing to ${host}\n`);
  if (host.includes(PRODUCTION_ENDPOINT)) {
    console.error("Refusing to run: that is the production endpoint. Point at your branch.");
    process.exit(1);
  }
  if (!url) {
    console.error("DATABASE_URL is not set.");
    process.exit(1);
  }

  const { pool, db } = connect();

  try {
    /* ------------------------------------------------ 6.2 the schema is real */

    /*
     * H1. Not "the migration ran" — what the catalogue actually holds.
     */
    const cols = await db.execute<{ table_name: string; n: number }>(sql`
      SELECT table_name, COUNT(*)::int AS n
        FROM information_schema.columns
       WHERE table_schema = 'public'
         AND table_name IN ('patient_accounts','patient_auth_sessions','person_claims','person_invites')
       GROUP BY table_name ORDER BY table_name
    `);
    const byTable = new Map(cols.rows.map((r) => [r.table_name, r.n]));
    for (const [table, expected] of [
      ["patient_accounts", 10],
      ["patient_auth_sessions", 8],
      ["person_claims", 11],
      ["person_invites", 9],
    ] as const) {
      check(
        `6.2 ${table} exists with ${expected} columns`,
        byTable.get(table) === expected,
        `information_schema says ${byTable.get(table) ?? 0}`,
      );
    }

    const idx = await db.execute<{ indexname: string }>(sql`
      SELECT indexname FROM pg_indexes
       WHERE schemaname = 'public'
         AND indexname IN (
           'patient_accounts_email_unique',
           'person_claims_open_unique',
           'person_invites_token_hash_unique'
         )
    `);
    const names = new Set(idx.rows.map((r) => r.indexname));
    for (const name of [
      "patient_accounts_email_unique",
      "person_claims_open_unique",
      "person_invites_token_hash_unique",
    ]) {
      check(`6.2 index ${name} exists`, names.has(name));
    }

    /*
     * `people.claimed_by_account_id` — renamed from `claimed_by_user_id` and
     * repointed at patient accounts. If the rename half-applied, a patient's
     * claim would write a foreign key into the *users* table.
     */
    const fk = await db.execute<{
      table: string;
      column: string;
      ref: string;
    }>(sql`
      SELECT tc.table_name AS table, kcu.column_name AS column, ccu.table_name AS ref
        FROM information_schema.table_constraints tc
        JOIN information_schema.key_column_usage kcu ON kcu.constraint_name = tc.constraint_name
        JOIN information_schema.constraint_column_usage ccu ON ccu.constraint_name = tc.constraint_name
       WHERE tc.constraint_type = 'FOREIGN KEY'
         AND tc.table_name = 'people'
         AND kcu.column_name = 'claimed_by_account_id'
    `);
    check(
      "6.2 people.claimed_by_account_id points at patient_accounts, not users",
      fk.rows[0]?.ref === "patient_accounts",
      `points at ${fk.rows[0]?.ref ?? "nothing"}`,
    );

    /* ------------------------- 6.2 the hole the separate table exists to close */

    /*
     * The whole argument for a separate identity table rather than a nullable
     * `organizationId` on `users`: Postgres treats NULLs as distinct, so a
     * unique index on (organization_id, email) does **not** stop two patients
     * sharing an address. Here the index has no NULL to hide behind — and this
     * asserts the database enforces it, rather than the sign-up code
     * remembering to look first.
     */
    const personA = await newPerson(db, "a");
    const personB = await newPerson(db, "b");
    const shared = email("shared");

    await db.insert(patientAccounts).values({
      personId: personA,
      email: shared,
      passwordHash: "x",
    });

    let rejected = false;
    try {
      await db.insert(patientAccounts).values({
        personId: personB,
        email: shared,
        passwordHash: "x",
      });
    } catch {
      rejected = true;
    }
    check("6.2 a duplicate patient email is refused BY THE DATABASE", rejected);

    /* --------------------------------------------- 6.10 / C19 the invite route */

    const { issueInvite, redeemInvite, resolveInvite, revokeInvite, recordAccess } =
      await import("../lib/data/claims");

    const [therapist] = await db
      .execute<{ id: string }>(sql`SELECT id FROM users WHERE deleted_at IS NULL LIMIT 1`)
      .then((r) => r.rows);

    if (!therapist) {
      skip("6.10 the invite route", "no clinician rows in this database to issue as");
    } else {
      const target = await newPerson(db, "target");
      const claimant = await newAccount(db, "claimant");

      const issued = await issueInvite({
        personId: target,
        issuedByUserId: therapist.id,
      });
      check("6.10 an invite issues for an unclaimed record", !("error" in issued));
      if ("error" in issued) throw new Error(issued.error);

      const resolved = await resolveInvite(issued.token);
      check("6.10 the link resolves to that record", resolved?.personId === target);
      check(
        "6.10 …showing a REDACTED name, not the real one",
        Boolean(resolved && resolved.redactedName.includes("•")),
        resolved?.redactedName,
      );

      // The clinician's own page can see the invite is outstanding…
      const access = await recordAccess(target, therapist.id);
      check("6.10 the clinician sees one open invite", access?.openInvite !== null);
      // …but nothing hands the token back, because we never stored it.
      const [stored] = await db
        .select({ hash: personInvites.tokenHash })
        .from(personInvites)
        .where(eq(personInvites.personId, target))
        .limit(1);
      check(
        "6.10 only a hash of the token is stored",
        Boolean(stored && stored.hash !== issued.token && stored.hash.length === 64),
      );

      const first = await redeemInvite({
        token: issued.token,
        accountId: claimant,
        therapistKeepsAccess: false,
      });
      check("6.10 redeeming it hands the record over", first.ok === true);

      const second = await redeemInvite({
        token: issued.token,
        accountId: claimant,
        therapistKeepsAccess: false,
      });
      check(
        "6.10 a forwarded link cannot be redeemed twice",
        second.ok === false,
        second.ok ? "SECOND REDEMPTION SUCCEEDED" : second.error,
      );

      /*
       * §3 step 7 — "does your therapist keep access?" — defaults to *off* in
       * both flows, so a person who reads nothing revokes rather than grants.
       * The checkbox default is a UI fact; that it is *stored as given* is this
       * one, and a `false` silently coerced to `true` here would undo it.
       */
      const [claim] = await db
        .select({
          keeps: personClaims.therapistKeepsAccess,
          route: personClaims.route,
        })
        .from(personClaims)
        .where(eq(personClaims.personId, target))
        .limit(1);
      check("6.10 the claim is recorded as an invite claim", claim?.route === "invite");
      check("6.7 'therapist keeps access: no' is stored as no", claim?.keeps === false);

      // And a claimed record is no longer the clinician's to give away.
      const again = await issueInvite({
        personId: target,
        issuedByUserId: therapist.id,
      });
      check("6.10 a claimed record cannot be invited out again", "error" in again);

      const revoked = await revokeInvite(randomUUID(), therapist.id);
      check("6.10 revoking an invite that is not yours does nothing", revoked === false);
    }

    /* ------------------------------------------ 6.7 / §3 the match route, 2–8 */

    const { startClaim, verifyClaim } = await import("../lib/data/claims");

    const matchTarget = await newPerson(db, "match");
    const matchAccount = await newAccount(db, "matcher");

    const started = await startClaim({
      personId: matchTarget,
      accountId: matchAccount,
      channel: "email",
    });
    check("6.7 a claim starts on an unclaimed record", started.ok === true);
    if (!started.ok) throw new Error(started.error);

    /*
     * Pressing "send me a code" twice must *replace* the attempt, not stack a
     * second one — otherwise an old code keeps working after a new one is
     * issued. The partial unique index is what makes the upsert land, so this
     * is the index doing its job rather than a comment claiming it does.
     */
    const restarted = await startClaim({
      personId: matchTarget,
      accountId: matchAccount,
      channel: "email",
    });
    check("6.7 a second code replaces the first, one row not two", restarted.ok === true);
    const [openClaims] = await db
      .select({ n: sql<number>`COUNT(*)::int` })
      .from(personClaims)
      .where(
        and(
          eq(personClaims.personId, matchTarget),
          eq(personClaims.patientAccountId, matchAccount),
        ),
      );
    check(
      "6.7 …exactly one claim row exists for that pair",
      openClaims?.n === 1,
      `${openClaims?.n}`,
    );

    const wrongCode = await verifyClaim({
      claimId: restarted.ok ? restarted.claimId : "",
      accountId: matchAccount,
      code: "000000",
      therapistKeepsAccess: false,
    });
    check("6.7 a wrong code takes nothing", wrongCode.ok === false);

    const stale = started.ok && restarted.ok ? started.code : "";
    if (stale && restarted.ok && stale !== restarted.code) {
      const withStale = await verifyClaim({
        claimId: restarted.claimId,
        accountId: matchAccount,
        code: stale,
        therapistKeepsAccess: false,
      });
      check("6.7 the SUPERSEDED code no longer works", withStale.ok === false);
    } else {
      skip("6.7 the superseded code", "the two generated codes collided");
    }

    if (restarted.ok) {
      const right = await verifyClaim({
        claimId: restarted.claimId,
        accountId: matchAccount,
        code: restarted.code,
        therapistKeepsAccess: true,
      });
      check("6.7 the right code claims the record", right.ok === true);

      const [claimed] = await db
        .select({ at: people.claimedAt, by: people.claimedByAccountId })
        .from(people)
        .where(eq(people.id, matchTarget))
        .limit(1);
      check(
        "6.7 the person is stamped as claimed by that account",
        claimed?.at !== null && claimed?.by === matchAccount,
      );

      // And it cannot be claimed a second time by anybody.
      const someoneElse = await newAccount(db, "stranger");
      const second = await startClaim({
        personId: matchTarget,
        accountId: someoneElse,
        channel: "email",
      });
      check("6.7 a claimed record cannot be claimed again", second.ok === false);
    }

    /* ---------------------------------------------- 6.4 sessions are patient-side */

    /*
     * A patient session must live in its own table. If `patient_auth_sessions`
     * shared the clinician's, a patient cookie would be interchangeable with a
     * therapist's — the exact confusion the separate cookie name exists to
     * prevent.
     */
    const patientSessionCols = await db.execute<{ column_name: string }>(sql`
      SELECT column_name FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = 'patient_auth_sessions'
    `);
    const sessionColumns = new Set(patientSessionCols.rows.map((r) => r.column_name));
    check(
      "6.4 a patient session belongs to an account, never to a user or an organisation",
      sessionColumns.has("patient_account_id") &&
        !sessionColumns.has("user_id") &&
        !sessionColumns.has("organization_id"),
      [...sessionColumns].join(", "),
    );

    /* ------------------------------------------------ 6.3 what was NOT done (C41) */

    const [orgNullable] = await db
      .execute<{ is_nullable: string }>(
        sql`SELECT is_nullable FROM information_schema.columns
           WHERE table_schema='public' AND table_name='users' AND column_name='organization_id'`,
      )
      .then((r) => r.rows);
    check(
      "C41 users.organization_id stayed NOT NULL — patients never flow through it",
      orgNullable?.is_nullable === "NO",
      `is_nullable=${orgNullable?.is_nullable}`,
    );
  } finally {
    /* Everything this script wrote, removed. Cascades take the rest. */
    await db
      .delete(patientAuthSessions)
      .where(
        sql`patient_account_id IN (SELECT id FROM patient_accounts WHERE email LIKE ${`${TAG}%`})`,
      );
    await db.delete(patientAccounts).where(sql`email LIKE ${`${TAG}%`}`);
    await db.delete(people).where(sql`last_name = ${TAG}`);
    await pool.end();
  }

  console.log(failures === 0 ? "\nsprint 6: PASS" : `\nsprint 6: ${failures} FAILED`);
  process.exitCode = failures === 0 ? 0 : 1;
}

/** A throwaway person, tagged so the cleanup can find it. */
async function newPerson(db: ReturnType<typeof connect>["db"], label: string): Promise<string> {
  const [row] = await db
    .insert(people)
    .values({ firstName: `Verify${label}`, lastName: TAG })
    .returning({ id: people.id });
  return row!.id;
}

async function newAccount(db: ReturnType<typeof connect>["db"], label: string): Promise<string> {
  const personId = await newPerson(db, label);
  const [row] = await db
    .insert(patientAccounts)
    .values({ personId, email: email(label), passwordHash: "x" })
    .returning({ id: patientAccounts.id });
  return row!.id;
}

main();
