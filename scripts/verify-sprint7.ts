/**
 * Sprint 7 acceptance, against the real database.
 *
 *   npm run verify:sprint7
 *
 * Consent is only worth what the database enforces. The state machine is
 * tested pure in `tests/consent.test.ts`; what this script checks is the half
 * that cannot be: that the partial unique index really refuses a second
 * pending request, that a conditional UPDATE really makes a double-tap land
 * once, that a claim saying "no" really produces no grant, and that a
 * clinician and a patient cannot be recorded as the same actor.
 *
 * It writes. Everything it creates is tagged `verify7-` and removed in the
 * `finally`, and it refuses to run against the production endpoint.
 */
import { randomUUID } from "node:crypto";
import { eq, sql } from "drizzle-orm";

import { connect, schema } from "./db";

const { auditLog, historyGrants, patientAccounts, patients, people } = schema;

let failures = 0;
const check = (name: string, ok: boolean, detail = "") => {
  console.log(`${ok ? "  ok  " : "FAIL  "}${name}${detail ? ` — ${detail}` : ""}`);
  if (!ok) failures += 1;
};
const skip = (name: string, why: string) => console.log(`  --   ${name} — NOT EXERCISED: ${why}`);

const TAG = `verify7-${randomUUID().slice(0, 8)}`;

async function main() {
  const url = process.env.DATABASE_URL ?? "";
  const host = url.match(/@([^/:?]+)/)?.[1] ?? "(none)";
  // `ep-wild-lake-a6tgm2r6` is the read-write compute on branch
  // `br-curly-dream-a6b0shlz` — production. Refused by name.
  console.log(`writing to ${host}\n`);
  if (host.includes("ep-wild-lake-a6tgm2r6")) {
    console.error("Refusing to run: that is the production endpoint.");
    process.exit(1);
  }
  if (!url) {
    console.error("DATABASE_URL is not set.");
    process.exit(1);
  }

  const { pool, db } = connect();

  try {
    /* ------------------------------------------------- 7.1 the schema is real */

    const cols = await db.execute<{ n: number }>(sql`
      SELECT COUNT(*)::int AS n FROM information_schema.columns
       WHERE table_schema='public' AND table_name='history_grants'
    `);
    check(
      "7.1 history_grants exists with 14 columns",
      cols.rows[0]?.n === 14,
      `${cols.rows[0]?.n}`,
    );

    const idx = await db.execute<{ indexname: string }>(sql`
      SELECT indexname FROM pg_indexes WHERE schemaname='public' AND tablename='history_grants'
    `);
    const names = new Set(idx.rows.map((r) => r.indexname));
    check(
      "7.1 the live-grant partial unique index exists",
      names.has("history_grants_live_unique"),
    );

    const sessionCols = await db.execute<{ column_name: string }>(sql`
      SELECT column_name FROM information_schema.columns
       WHERE table_schema='public' AND table_name='sessions'
         AND column_name IN ('recording_started_at','profile_share_consent','profile_share_consent_at')
    `);
    check("7.8 the two controls and the recording clock exist", sessionCols.rows.length === 3);

    const auditCol = await db.execute<{ is_nullable: string }>(sql`
      SELECT is_nullable FROM information_schema.columns
       WHERE table_schema='public' AND table_name='audit_log' AND column_name='actor_account_id'
    `);
    check("7.6 audit_log can name a patient as the actor", auditCol.rows.length === 1);

    /*
     * The backfill that deliberately did not happen.
     *
     * `recording_started_at` is null for every session that predates this
     * migration, because we do not know when their microphones started.
     * Filling it from `started_at` would have asserted "recorded from the
     * beginning" for sessions where that may be false — which is the exact
     * claim the column exists to stop a note making.
     */
    const [old] = await db
      .execute<{ total: number; stamped: number }>(
        sql`
      SELECT COUNT(*)::int AS total,
             COUNT(recording_started_at)::int AS stamped
        FROM sessions
    `,
      )
      .then((r) => r.rows);
    check(
      "7.8 historical sessions were NOT backfilled with a guessed start",
      old?.stamped === 0,
      `${old?.stamped} of ${old?.total} sessions carry a recording start`,
    );

    /* ------------------------------------------- 7.3 one live request, enforced */

    const [therapist] = await db
      .execute<{ id: string; org: string }>(
        sql`SELECT id, organization_id AS org FROM users WHERE deleted_at IS NULL LIMIT 1`,
      )
      .then((r) => r.rows);

    if (!therapist) {
      skip("7.3 the request flow", "no clinician rows in this database");
    } else {
      const personId = await newPerson(db);
      const accountId = await newAccount(db, personId);

      const first = await db
        .insert(historyGrants)
        .values({
          personId,
          therapistUserId: therapist.id,
          organizationId: therapist.org,
          status: "pending",
          requestNote: "first",
          requestedAt: new Date(),
        })
        .returning({ id: historyGrants.id });
      check("7.3 a request can be made", first.length === 1);

      let secondRefused = false;
      try {
        await db.insert(historyGrants).values({
          personId,
          therapistUserId: therapist.id,
          organizationId: therapist.org,
          status: "pending",
          requestNote: "second",
          requestedAt: new Date(),
        });
      } catch {
        secondRefused = true;
      }
      check("7.3 a second pending request is refused BY THE DATABASE", secondRefused);

      /* ------------------------------------------------- 7.2 / 7.4 the answer */

      const { decideGrant, revokeGrant, accessFor, applyClaimDecision } =
        await import("../lib/data/grants");
      const { isLiveGrant } = await import("../lib/access/state");

      const grantId = first[0]!.id;

      const wrongPerson = await decideGrant({
        accountId,
        personId: await newPerson(db),
        grantId,
        decision: "granted",
        shape: "open",
      });
      check("7.4 a grant belonging to somebody else cannot be answered", wrongPerson.ok === false);

      const answered = await decideGrant({
        accountId,
        personId,
        grantId,
        decision: "granted",
        shape: "24h",
      });
      check("7.2 a 24-hour grant is accepted", answered.ok === true);

      const [row] = await db
        .select({ status: historyGrants.status, expiresAt: historyGrants.expiresAt })
        .from(historyGrants)
        .where(eq(historyGrants.id, grantId))
        .limit(1);

      const window = row?.expiresAt ? row.expiresAt.getTime() - Date.now() : 0;
      check(
        "7.2 …and its window is 24 hours, written once at the moment they agreed",
        row?.expiresAt !== null && Math.abs(window - 24 * 3600_000) < 60_000,
        `${Math.round(window / 3600_000)}h`,
      );
      check(
        "7.2 …and it reads as live",
        isLiveGrant({ status: "granted", expiresAt: row!.expiresAt }, new Date()),
      );

      const twice = await decideGrant({
        accountId,
        personId,
        grantId,
        decision: "rejected",
      });
      check("7.4 an answer that arrives twice lands once", twice.ok === false);

      /* ---------------------------------------------------------- 7.5 revoke */

      const revoked = await revokeGrant({ accountId, personId, grantId });
      check("7.5 revoke works in one call", revoked.ok === true);

      const again = await revokeGrant({ accountId, personId, grantId });
      check("7.5 …and revoking twice is not an error the second time round", again.ok === false);

      const [after] = await db
        .select({ status: historyGrants.status, revokedAt: historyGrants.revokedAt })
        .from(historyGrants)
        .where(eq(historyGrants.id, grantId))
        .limit(1);
      check(
        "7.5 …and the row records when, not just that",
        after?.status === "revoked" && after.revokedAt !== null,
      );

      /* --------------------------------- 7.7 the state a real patient row gets */

      const patientId = await newPatient(db, therapist.id, therapist.org, personId);
      const actor = {
        userId: therapist.id,
        organizationId: therapist.org,
        role: "therapist" as const,
      };

      // Unclaimed: the therapist's own file, and nobody to ask.
      const unclaimed = await accessFor(actor as never, patientId);
      check(
        "7.7 an unclaimed record reads as unclaimed, with no request button",
        unclaimed.state.startsWith("unclaimed") && !unclaimed.capabilities.canRequestAccess,
        unclaimed.state,
      );

      // Claim it, saying NO to the therapist keeping access.
      await db
        .update(people)
        .set({ claimedAt: new Date(), claimedByAccountId: accountId })
        .where(eq(people.id, personId));

      const kept = await applyClaimDecision({
        personId,
        accountId,
        therapistKeepsAccess: false,
      });
      check("7.7 step 7 saying NO creates no grant at all", kept === 0);

      const degraded = await accessFor(actor as never, patientId);
      check(
        "7.7 …and the therapist lands in the degraded state, not full access",
        degraded.state === "revoked",
        degraded.state,
      );
      check(
        "7.7 …keeping their own transcripts, notes and old chat",
        degraded.capabilities.ownTranscripts &&
          degraded.capabilities.ownNotes &&
          degraded.capabilities.oldChat,
      );
      check(
        "7.7 …and losing the live profile, the files and the diagnosis",
        !degraded.capabilities.liveProfile &&
          !degraded.capabilities.patientFiles &&
          !degraded.capabilities.diagnosisChanges,
      );

      /*
       * The write side of that. §3 says "no diagnosis changes" and the refusal
       * lives in `updatePatient`, not in the form — a hidden field is not a
       * withheld capability.
       */
      const { updatePatient, AccessRefusedError } = await import("../lib/data/patients");
      let refused = false;
      try {
        await updatePatient(actor as never, patientId, {
          clinical: { diagnoses: ["F41.1"], goals: [] },
        });
      } catch (error) {
        refused = error instanceof AccessRefusedError;
      }
      check("7.7 a revoked clinician cannot write a diagnosis", refused);

      const [untouched] = await db
        .select({ clinical: patients.clinical })
        .from(patients)
        .where(eq(patients.id, patientId))
        .limit(1);
      check(
        "7.7 …and nothing was written",
        (untouched?.clinical?.diagnoses?.length ?? 0) === 0,
        JSON.stringify(untouched?.clinical ?? null),
      );

      // Now say yes, and watch the same read flip.
      const created = await applyClaimDecision({
        personId,
        accountId,
        therapistKeepsAccess: true,
      });
      check("7.7 step 7 saying YES grants the clinician who holds the record", created === 1);

      const full = await accessFor(actor as never, patientId);
      check(
        "7.7 …and the state becomes granted, with the live profile back",
        full.state === "granted" && full.capabilities.liveProfile,
        full.state,
      );

      /* ------------------------------------------------------- 7.6 the audit */

      const trail = await db
        .select({
          action: auditLog.action,
          actorUserId: auditLog.actorUserId,
          actorAccountId: auditLog.actorAccountId,
        })
        .from(auditLog)
        .where(eq(auditLog.actorAccountId, accountId));

      const actions = new Set(trail.map((t) => t.action));
      check(
        "7.6 every decision the patient made is in the audit log",
        ["grant.granted", "grant.revoked", "grant.withheld_at_claim", "grant.kept_at_claim"].every(
          (a) => actions.has(a),
        ),
        [...actions].join(", "),
      );
      check(
        "7.6 …recorded as the PATIENT, never as a clinician",
        trail.every((t) => t.actorUserId === null && t.actorAccountId === accountId),
      );

      /*
       * And the invariant behind that column split: one action, one actor.
       * `audit` throws rather than writing a row that names both.
       */
      const { audit } = await import("../lib/audit");
      let bothRefused = false;
      try {
        await audit({
          actor: { userId: therapist.id, organizationId: therapist.org },
          patientAccountId: accountId,
          category: "clinical",
          action: "verify.both",
        });
      } catch {
        bothRefused = true;
      }
      check("7.6 an audit row cannot name a clinician AND a patient", bothRefused);
    }
  } finally {
    await db
      .delete(auditLog)
      .where(
        sql`actor_account_id IN (SELECT id FROM patient_accounts WHERE email LIKE ${`${TAG}%`})`,
      );
    await db.delete(patients).where(sql`last_name = ${TAG}`);
    await db.delete(patientAccounts).where(sql`email LIKE ${`${TAG}%`}`);
    // history_grants cascades from people.
    await db.delete(people).where(sql`last_name = ${TAG}`);
    await pool.end();
  }

  console.log(failures === 0 ? "\nsprint 7: PASS" : `\nsprint 7: ${failures} FAILED`);
  process.exitCode = failures === 0 ? 0 : 1;
}

type Db = ReturnType<typeof connect>["db"];

async function newPerson(db: Db): Promise<string> {
  const [row] = await db
    .insert(people)
    .values({ firstName: "Verify", lastName: TAG })
    .returning({ id: people.id });
  return row!.id;
}

async function newAccount(db: Db, personId: string): Promise<string> {
  const [row] = await db
    .insert(patientAccounts)
    .values({
      personId,
      email: `${TAG}-${randomUUID().slice(0, 6)}@example.invalid`,
      passwordHash: "x",
    })
    .returning({ id: patientAccounts.id });
  return row!.id;
}

async function newPatient(
  db: Db,
  therapistId: string,
  organizationId: string,
  personId: string,
): Promise<string> {
  const [row] = await db
    .insert(patients)
    .values({
      organizationId,
      therapistId,
      personId,
      firstName: "Verify",
      lastName: TAG,
      source: "therapist",
    })
    .returning({ id: patients.id });
  return row!.id;
}

main();
