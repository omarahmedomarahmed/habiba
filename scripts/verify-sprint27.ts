/**
 * Sprint 27 acceptance: portability. PLAN.md 27.1 to 27.8.
 *
 *   npm run verify:sprint27
 *
 * The three that carry the pitch, each attempted rather than read:
 *
 *   - **C106 / 27.1** a grant cannot be HELD by a clinician whose verification
 *     is not approved. Asserted by attempting the write, twice: on the insert
 *     and on the UPDATE that flips a pending row months later, which is the
 *     case that actually happens.
 *   - **C102b / 27.2** redeeming a patient's code creates a REQUEST and never
 *     access. Asserted by redeeming one and reading the row that appears.
 *   - **C108 / 27.7** a decline carries a reason. Asserted by attempting a
 *     decline with an empty one and being refused by the database.
 */
import { readFileSync } from "node:fs";

import { and, eq, sql } from "drizzle-orm";

import { db } from "../lib/db";
import {
  historyAsks,
  historyGrants,
  patientAccounts,
  patientInvites,
  people,
  therapistVerifications,
  users,
} from "../lib/db/schema";
import { stripComments } from "./_dashes";
import { reporter, required, writesTo } from "./_verify";

const { check, finish } = reporter();

const TAG = "verify27";

async function refused(fn: () => Promise<unknown>, fragment: string): Promise<boolean> {
  try {
    await fn();
    return false;
  } catch (error) {
    return String((error as Error).message).includes(fragment);
  }
}

async function main() {
  /*
   * 🔴 C147 — this script WRITES, so it says where and refuses production.
   *
   * It was missing here, and against the purged production database this file
   * died with a TypeError about `organizationId` rather than saying what was
   * actually wrong: an operator had pointed it at an empty database.
   */
  writesTo();

  const { createInvite, redeemInvite, askForHistory, answerAsk, invitesForPerson } = await import(
    "../lib/data/portability"
  );

  /*
   * Two clinicians: one approved, one not. Both planted, because a verifier
   * that borrows "the first therapist" is a verifier whose result depends on
   * which rows happen to exist (the second lesson of C93).
   */
  const [row] = await db
    .select({ organizationId: users.organizationId })
    .from(users)
    .where(eq(users.role, "therapist"))
    .limit(1);

  /* C147 — an empty database is an operator mistake, not a code failure. */
  const reference = required(row, "therapist whose organisation the fixtures can join");

  let personId: string | null = null;
  let accountId: string | null = null;
  let approvedId: string | null = null;
  let unverifiedId: string | null = null;

  try {
    const [approved] = await db
      .insert(users)
      .values({
        organizationId: reference.organizationId,
        email: `${TAG}-approved@example.test`,
        firstName: `${TAG}-Approved`,
        lastName: "Clinician",
        role: "therapist",
        passwordHash: "x",
      })
      .returning({ id: users.id });
    approvedId = approved!.id;

    await db.insert(therapistVerifications).values({
      userId: approvedId,
      organizationId: reference.organizationId,
      state: "approved",
      licenseBody: "Test register",
      licenseNumber: "TR-1",
    });

    const [unverified] = await db
      .insert(users)
      .values({
        organizationId: reference.organizationId,
        email: `${TAG}-waiting@example.test`,
        firstName: `${TAG}-Waiting`,
        lastName: "Clinician",
        role: "therapist",
        passwordHash: "x",
      })
      .returning({ id: users.id });
    unverifiedId = unverified!.id;

    await db.insert(therapistVerifications).values({
      userId: unverifiedId,
      organizationId: reference.organizationId,
      state: "submitted",
    });

    const [person] = await db
      .insert(people)
      .values({ firstName: `${TAG}-Dalia`, phone: "+201555000027" })
      .returning({ id: people.id });
    personId = person!.id;

    const [account] = await db
      .insert(patientAccounts)
      .values({ personId, phone: "+201555000027", passwordHash: null })
      .returning({ id: patientAccounts.id });
    accountId = account!.id;

    /* ------------------------------------------------ 27.1 · C106 */

    check(
      "🔴 27.1 / C106 the database REFUSES a granted row for an unverified clinician, on INSERT",
      await refused(
        () =>
          db.insert(historyGrants).values({
            personId: personId!,
            therapistUserId: unverifiedId!,
            organizationId: reference.organizationId,
            status: "granted",
            shape: "open",
          }),
        "verification is not approved",
      ),
      "refused by a trigger, not by a code path",
    );

    /*
     * 🔴 The case that actually happens, and the reason this is a trigger
     * rather than a check inside `decideGrant`: a pending row that has been
     * sitting for months, flipped to granted after the clinician's approval
     * lapsed or before it ever arrived.
     */
    const [pending] = await db
      .insert(historyGrants)
      .values({
        personId: personId!,
        therapistUserId: unverifiedId!,
        organizationId: reference.organizationId,
        status: "pending",
        requestedAt: new Date(),
      })
      .returning({ id: historyGrants.id });

    check(
      "27.3 / C131 …but a PENDING request for an unverified clinician is allowed, which is the point",
      Boolean(pending?.id),
      "a patient may invite somebody mid-verification",
    );

    check(
      "🔴 27.1 / C106 …and the UPDATE that flips it to granted is refused too",
      await refused(
        () =>
          db
            .update(historyGrants)
            .set({ status: "granted", shape: "open" })
            .where(eq(historyGrants.id, pending!.id)),
        "verification is not approved",
      ),
      "the case that actually happens, months after the request",
    );

    const { decideGrant } = await import("../lib/data/grants");
    const explained = await decideGrant({
      accountId: accountId!,
      personId: personId!,
      grantId: pending!.id,
      decision: "granted",
      shape: "open",
    });

    check(
      "🔴 27.3 / C131 the patient is told WHY their approval has not taken effect",
      explained.ok === false && /licence/.test(explained.error ?? ""),
      explained.ok ? "IT SUCCEEDED" : explained.error,
    );

    await db.delete(historyGrants).where(eq(historyGrants.id, pending!.id));

    /* ------------------------------------------------ 27.2 · C102b */

    const minted = await createInvite({ personId: personId!, accountId: accountId! });

    check(
      "🔴 27.2 / C102b the patient can mint an invite code, which is the mechanism the pitch lacked",
      minted.ok === true && /^[A-HJ-NP-Z2-9]{3}-[A-HJ-NP-Z2-9]{3}$/.test(minted.invite.code),
      minted.ok ? minted.invite.code : minted.error,
    );

    check(
      "27.2 …and the database refuses a code that is not that shape",
      await refused(
        () =>
          db.insert(patientInvites).values({
            personId: personId!,
            accountId: accountId!,
            code: "notacode",
            expiresAt: new Date(Date.now() + 1000),
          }),
        "patient_invites_shape",
      ),
    );

    const redeemed = await redeemInvite(
      { userId: approvedId!, organizationId: reference.organizationId, role: "therapist" } as never,
      minted.ok ? minted.invite.code : "AAA-AAA",
    );

    check(
      "🔴 27.2 redeeming it tells the clinician a FIRST NAME and nothing about the record",
      redeemed.ok === true &&
        !("record" in redeemed) &&
        !("sessions" in redeemed) &&
        !("diagnoses" in redeemed),
      redeemed.ok ? redeemed.patientName : redeemed.error,
    );

    const created = await db
      .select({ status: historyGrants.status })
      .from(historyGrants)
      .where(
        and(
          eq(historyGrants.personId, personId!),
          eq(historyGrants.therapistUserId, approvedId!),
        ),
      )
      .limit(1);

    check(
      "🔴 27.2 / 27.4 / C107 …and what it created is a PENDING request, never access",
      created[0]?.status === "pending",
      created[0]?.status ?? "nothing was created",
    );

    check(
      "27.2 a code is single use: the same one cannot be redeemed twice",
      (
        await redeemInvite(
          {
            userId: unverifiedId!,
            organizationId: reference.organizationId,
            role: "therapist",
          } as never,
          minted.ok ? minted.invite.code : "AAA-AAA",
        )
      ).ok === false,
    );

    const listed = await invitesForPerson(personId!);
    check(
      "27.2 …and the patient sees who used it, so a code handed to the wrong person is visible",
      listed.some((invite) => invite.redeemedBy?.includes("Approved")),
      listed.map((invite) => `${invite.code} ${invite.redeemedBy ?? "unused"}`).join(", "),
    );

    /* ------------------------------------------------ 27.7 · C108 */

    check(
      "🔴 27.7 the database REFUSES a decline with no reason, attempted rather than read",
      await refused(
        () =>
          db.insert(historyAsks).values({
            personId: personId!,
            accountId: accountId!,
            therapistUserId: approvedId!,
            status: "declined",
            declineReason: "   ",
          }),
        "history_asks_decline_has_reason",
      ),
      "a silent no is worse than a reason, so the row cannot hold one",
    );

    const cannotAsk = await askForHistory({
      personId: personId!,
      accountId: accountId!,
      therapistUserId: approvedId!,
      note: null,
    });

    check(
      "🔴 27.7 a patient can only ask a clinician they have ACTUALLY seen",
      cannotAsk.ok === false,
      cannotAsk.error ?? "IT ALLOWED IT",
    );

    const [planted] = await db
      .insert(historyAsks)
      .values({
        personId: personId!,
        accountId: accountId!,
        therapistUserId: approvedId!,
        note: "Could you add what you have from 2024?",
      })
      .returning({ id: historyAsks.id });

    const silent = await answerAsk(
      { userId: approvedId!, organizationId: reference.organizationId, role: "therapist" } as never,
      { askId: planted!.id, decision: "declined", reason: "  " },
    );

    check(
      "🔴 27.7 / C108 …and the action refuses a decline with no reason before the database has to",
      silent.ok === false,
      silent.error ?? "IT ALLOWED IT",
    );

    const answered = await answerAsk(
      { userId: approvedId!, organizationId: reference.organizationId, role: "therapist" } as never,
      {
        askId: planted!.id,
        decision: "declined",
        reason: "I am no longer in practice and my old records are with the clinic.",
      },
    );

    check(
      "27.7 a decline WITH a reason goes through, and the reason is what the patient reads",
      answered.ok === true,
      answered.error ?? "declined with a reason",
    );
  } finally {
    if (personId) {
      await db.execute(sql`DELETE FROM history_asks WHERE person_id = ${personId}`);
      await db.execute(sql`DELETE FROM history_grants WHERE person_id = ${personId}`);
      await db.execute(sql`DELETE FROM patient_invites WHERE person_id = ${personId}`);
    }
    if (accountId) {
      await db.execute(sql`UPDATE audit_log SET actor_account_id = NULL WHERE actor_account_id = ${accountId}`);
      await db.delete(patientAccounts).where(eq(patientAccounts.id, accountId));
    }
    if (personId) await db.delete(people).where(eq(people.id, personId));
    for (const id of [approvedId, unverifiedId]) {
      if (!id) continue;
      await db.execute(sql`UPDATE audit_log SET actor_user_id = NULL WHERE actor_user_id = ${id}`);
      await db.delete(therapistVerifications).where(eq(therapistVerifications.userId, id));
      await db.delete(users).where(eq(users.id, id));
    }
  }

  /* ------------------------------------------------------ 27.5 · C107 */

  const consentList = stripComments(readFileSync("components/patient/consent-list.tsx", "utf8"));
  const consentActions = stripComments(
    readFileSync("app/(patient)/patient/consent/actions.ts", "utf8"),
  );
  const grantsSource = stripComments(readFileSync("lib/data/grants.ts", "utf8"));

  /*
   * 🔴 Asserted on the SIGNATURES rather than by scanning the file for the word
   * "reason", which appears legitimately: declining a *request* may carry a
   * preset reason, and revoking a grant may not. The rule is about the revoke
   * path specifically, so the check follows that path: one argument in the
   * component, one argument in the action, three fields in the data function,
   * and none of them a reason.
   */
  const revokeSignature = /export async function revoke\(grantId: string\)/.test(consentActions);
  const revokeInput =
    /export async function revokeGrant\(input: \{\s*accountId: string;\s*personId: string;\s*grantId: string;\s*\}\)/.test(
      grantsSource,
    );

  check(
    "🔴 27.5 / C107 revoking is one tap and never asks why, which is a fact about the signature",
    /revoke\(grant\.id\)/.test(consentList) && revokeSignature && revokeInput,
    "the revoke path has nowhere to put a reason, so nobody can be asked for one",
  );

  const grants = stripComments(readFileSync("lib/data/grants.ts", "utf8"));
  check(
    "🔴 27.6 / C107 the patient is told on EVERY grant, from the one place a grant is decided",
    /notifyPatientOfGrant/.test(grants) && /input\.decision === "granted"/.test(grants),
  );

  /* --------------------------------------------------------- the copy */

  /*
   * 🔴 C102b and C108 are both rulings about WORDS, so they are checked as
   * words. "Send your record" and "get my history" are the two sentences that
   * would make this feature dishonest, and neither may appear on the screens
   * that carry it.
   */
  const invitePanel = stripComments(readFileSync("components/patient/invite-therapist.tsx", "utf8"));
  const askPanel = stripComments(readFileSync("components/patient/ask-history.tsx", "utf8"));

  check(
    "🔴 27.2 / C102b the invite copy never says send your record",
    !/send (your|my) (record|history|notes)|share (your|my) record/i.test(invitePanel),
    "it says invite, and says the patient is asked again",
  );

  check(
    "🔴 27.7 / C108 the ask copy says ask, and never get or retrieve",
    /Ask them/.test(askPanel) &&
      !/get (my|your) history|retrieve (my|your) history|import (my|your) history/i.test(askPanel),
  );

  /* ------------------------------------------------------------ 27.8 */

  check(
    "27.8 the 24-hour grant window is unchanged",
    /const GRANT_24H_MS = 24 \* 60 \* 60 \* 1000;/.test(grantsSource),
    "24 hours, still",
  );

  const { INVITE_DAYS } = await import("../lib/data/portability");
  check("27.3 an invite expires after thirty days", INVITE_DAYS === 30, `${INVITE_DAYS} days`);

  finish("sprint 27");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
