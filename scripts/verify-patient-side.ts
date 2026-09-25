/**
 * The patient side, attempted: who is told, who may look, what is kept.
 *
 *   npm run verify:patient-side
 *
 * Every check here is a fix from the patient-side pass (area C), and each one
 * that touches safety or privacy carries a control that fails on the code
 * before the fix. It PLANTS its own practice, two clinicians and two people,
 * and removes them in a `finally`, so it runs on an empty branch (H29) and
 * never reads whatever else happens to be there.
 */
import { randomBytes } from "node:crypto";

import { and, eq, inArray, sql } from "drizzle-orm";

import { dbFor } from "../lib/db";
import { DEFAULT_REGION } from "../lib/db/region";
import {
  assessmentAssignments,
  historyGrants,
  instruments,
  manualPayments,
  notifications,
  patientAuthSessions,
  patientAuthTokens,
  patientNotifications,
  organizations,
  patientAccounts,
  patients,
  people,
  personProfiles,
  riskAssessments,
  sessionFeedback,
  sessions,
  therapistVerifications,
  transcriptSegments,
  users,
} from "../lib/db/schema";
import { stripComments } from "./_dashes";
import { readSource, reporter, writesTo } from "./_verify";

const db = dbFor(DEFAULT_REGION);
const { check, finish } = reporter();

const TAG = `verify-patient-side-${randomBytes(4).toString("hex")}`;

type Fixture = {
  orgId: string;
  t1: string;
  t2: string;
  /** The person the checks are about, and a second one who must never leak into them. */
  p: string;
  q: string;
  account: string;
  t1p: string;
  t1q: string;
  t2p: string;
};

async function plant(): Promise<Fixture> {
  const [org] = await db
    .insert(organizations)
    .values({ name: "Patient Side Demo Practice", slug: TAG, kind: "solo" })
    .returning({ id: organizations.id });
  const orgId = org!.id;

  const therapist = async (n: number) => {
    const [row] = await db
      .insert(users)
      .values({
        organizationId: orgId,
        email: `${TAG}-t${n}@example.com`,
        passwordHash: "not-a-hash",
        firstName: `T${n}`,
        lastName: "Demo",
        role: "therapist",
      })
      .returning({ id: users.id });
    /* A clinical grant to an unverified clinician is refused by a trigger (C106). */
    await db.insert(therapistVerifications).values({
      userId: row!.id,
      organizationId: orgId,
      state: "approved",
      licenseBody: "Demo register",
      licenseNumber: `${TAG}-${n}`,
    });
    return row!.id;
  };
  const t1 = await therapist(1);
  const t2 = await therapist(2);

  const person = async (name: string, phone: string) => {
    const [row] = await db
      .insert(people)
      .values({ firstName: `${TAG}-${name}`, phone, claimedAt: new Date() })
      .returning({ id: people.id });
    return row!.id;
  };
  const p = await person("P", "+201555000173");
  const q = await person("Q", "+201555000174");

  const [account] = await db
    .insert(patientAccounts)
    .values({ personId: p, phone: "+201555000173", passwordHash: null })
    .returning({ id: patientAccounts.id });

  const chart = async (therapistId: string, personId: string, name: string) => {
    const [row] = await db
      .insert(patients)
      .values({
        organizationId: orgId,
        therapistId,
        personId,
        firstName: `${TAG}-${name}`,
        phone: personId === p ? "+201555000173" : "+201555000174",
      })
      .returning({ id: patients.id });
    return row!.id;
  };

  return {
    orgId,
    t1,
    t2,
    p,
    q,
    account: account!.id,
    t1p: await chart(t1, p, "t1p"),
    t1q: await chart(t1, q, "t1q"),
    t2p: await chart(t2, p, "t2p"),
  };
}

/**
 * By TAG rather than by the ids `plant` returned, so a plant that dies half
 * way (a constraint, a timeout) still leaves nothing behind. The prefix is
 * also how a run that was killed outright is found and removed by the next.
 */
async function clean() {
  const orgs = await db
    .select({ id: organizations.id })
    .from(organizations)
    .where(sql`${organizations.slug} LIKE 'verify-patient-side-%'`);
  const persons = (
    await db
      .select({ id: people.id })
      .from(people)
      .where(sql`${people.firstName} LIKE 'verify-patient-side-%'`)
  ).map((row) => row.id);
  const orgIds = orgs.map((row) => row.id);
  const clinicians = orgIds.length
    ? (await db.select({ id: users.id }).from(users).where(inArray(users.organizationId, orgIds))).map(
        (row) => row.id,
      )
    : [];

  if (orgIds.length) {
    await db.delete(manualPayments).where(inArray(manualPayments.organizationId, orgIds));
    await db.delete(assessmentAssignments).where(inArray(assessmentAssignments.organizationId, orgIds));
    await db.delete(riskAssessments).where(inArray(riskAssessments.organizationId, orgIds));
    await db.delete(sessionFeedback).where(inArray(sessionFeedback.organizationId, orgIds));
    await db.delete(sessions).where(inArray(sessions.organizationId, orgIds));
    await db.delete(patients).where(inArray(patients.organizationId, orgIds));
  }
  if (clinicians.length) {
    await db.delete(notifications).where(inArray(notifications.userId, clinicians));
    await db.execute(
      sql`UPDATE audit_log SET actor_user_id = NULL WHERE actor_user_id IN (${sql.join(clinicians, sql`, `)})`,
    );
  }
  if (persons.length) {
    const accounts = (
      await db
        .select({ id: patientAccounts.id })
        .from(patientAccounts)
        .where(inArray(patientAccounts.personId, persons))
    ).map((row) => row.id);
    if (accounts.length) {
      await db.execute(
        sql`UPDATE audit_log SET actor_account_id = NULL WHERE actor_account_id IN (${sql.join(accounts, sql`, `)})`,
      );
    }
    await db.execute(sql`DELETE FROM journals WHERE person_id IN (${sql.join(persons, sql`, `)})`);
    await db.delete(historyGrants).where(inArray(historyGrants.personId, persons));
    await db.delete(patientAccounts).where(inArray(patientAccounts.personId, persons));
    await db.delete(people).where(inArray(people.id, persons));
  }
  if (orgIds.length) {
    await db.delete(therapistVerifications).where(inArray(therapistVerifications.organizationId, orgIds));
    await db.delete(users).where(inArray(users.organizationId, orgIds));
    await db.delete(organizations).where(inArray(organizations.id, orgIds));
  }
}

/**
 * Nothing this script sends leaves the machine. Several fixes here are about a
 * person being TOLD, so real senders run; a provider call is answered here and
 * recorded, the way `verify:message-language` does it.
 */
const outbound: string[] = [];
const realFetch = globalThis.fetch;
globalThis.fetch = (async (input: Parameters<typeof fetch>[0], init?: RequestInit) => {
  const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
  if (/resend|facebook|twilio/.test(url)) {
    outbound.push(url);
    return new Response(JSON.stringify({ id: "verify", messages: [{ id: "verify" }] }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  }
  return realFetch(input, init);
}) as typeof fetch;

async function main() {
  writesTo();

  await clean();
  let f: Fixture | null = null;
  try {
    f = await plant();

    /* ------------------------------------------------ K8 · who is told */

    /*
     * T1 holds an open-ended grant ("until I change my mind", expiry NULL); T2
     * held a 24-hour grant that ran out yesterday. The old query compared
     * `expires_at >= now`, false against NULL, so the most trusted clinician
     * heard nothing about a 3am entry.
     */
    await db.insert(historyGrants).values([
      { personId: f.p, therapistUserId: f.t1, status: "granted", shape: "open", expiresAt: null },
      {
        personId: f.p,
        therapistUserId: f.t2,
        status: "granted",
        shape: "24h",
        expiresAt: new Date(Date.now() - 86_400_000),
      },
    ]);

    const { writeJournal } = await import("../lib/data/journals");
    await writeJournal({
      personId: f.p,
      accountId: f.account,
      body: "I do not want to be here any more. I want to die.",
      source: "typed",
    });
    const told = await db
      .select({ userId: notifications.userId })
      .from(notifications)
      .where(and(inArray(notifications.userId, [f.t1, f.t2]), eq(notifications.kind, "crisis")));
    check(
      "🔴 K8 a crisis journal alerts the clinician holding an OPEN-ENDED grant",
      told.some((row) => row.userId === f!.t1),
      `${told.length} crisis notice(s)`,
    );
    check(
      "K8 CONTROL: a clinician whose 24-hour grant ran out is not told",
      !told.some((row) => row.userId === f!.t2),
    );

    /* ------------------------------------- avatar · PE80, a live relationship */

    const { clinicianMaySeeFace } = await import("../lib/data/people");
    check(
      "🔴 PE80 a clinician with a patient row but no live grant does NOT see the photo",
      !(await clinicianMaySeeFace(f.p, f.t2, f.orgId)),
      "T2 holds a chart for P and a lapsed grant",
    );
    check(
      "PE80 CONTROL: the clinician holding a live grant does",
      await clinicianMaySeeFace(f.p, f.t1, f.orgId),
    );

    /* ------------------------------- prior risk · other patients' alerts */

    const session = async (therapistId: string, patientId: string) => {
      const [row] = await db
        .insert(sessions)
        .values({
          organizationId: f!.orgId,
          therapistId,
          patientId,
          status: "completed",
          modality: "video",
          feedbackToken: randomBytes(16).toString("hex"),
        })
        .returning({ id: sessions.id });
      return row!.id;
    };
    const before = await session(f.t1, f.t1p);
    const otherPerson = await session(f.t1, f.t1q);
    const now = await session(f.t1, f.t1p);
    await db.insert(riskAssessments).values([
      { sessionId: before, organizationId: f.orgId, therapistId: f.t1, patientId: f.t1p, level: "elevated", source: "keyword", indicators: ["P-before"] },
      { sessionId: otherPerson, organizationId: f.orgId, therapistId: f.t1, patientId: f.t1q, level: "high", source: "keyword", indicators: ["Q-someone-else"] },
      { sessionId: now, organizationId: f.orgId, therapistId: f.t1, patientId: f.t1p, level: "high", source: "keyword", indicators: ["P-now"] },
    ]);

    const { priorRiskFor } = await import("../lib/data/session-risk");
    const prior = await priorRiskFor(now, f.t1p, f.t1, f.orgId);
    const labels = prior.flatMap((row) => row.indicators);
    check(
      "🔴 prior risk shows THIS patient's earlier alert",
      labels.includes("P-before") && !labels.includes("P-now"),
      labels.join(", ") || "nothing",
    );
    check(
      "🔴 …and never another patient's on the same caseload",
      !labels.includes("Q-someone-else"),
      labels.join(", ") || "nothing",
    );
    check(
      "prior risk CONTROL: a session nobody has named yet has no history",
      (await priorRiskFor(now, null, f.t1, f.orgId)).length === 0,
    );

    /* -------------------------- check-ins · who is woken, and how to stop */

    const day = 86_400_000;
    const [qSeen] = await db
      .insert(sessions)
      .values({
        organizationId: f.orgId,
        therapistId: f.t1,
        patientId: f.t1q,
        status: "completed",
        modality: "video",
        feedbackToken: randomBytes(16).toString("hex"),
        scheduledAt: new Date(Date.now() - 3 * day),
        startedAt: new Date(Date.now() - 3 * day),
      })
      .returning({ id: sessions.id });
    await db.insert(sessions).values([
      {
        organizationId: f.orgId,
        therapistId: f.t1,
        patientId: f.t1q,
        status: "cancelled",
        modality: "video",
        feedbackToken: randomBytes(16).toString("hex"),
        scheduledAt: new Date(Date.now() + day),
      },
    ]);
    const { mostRecentSessionFor } = await import("../lib/checkins/receive");
    const woken = await mostRecentSessionFor(f.q);
    check(
      "🔴 a worrying check-in reply wakes the clinician who last SAW them, not a cancelled or unscheduled row",
      woken?.sessionId === qSeen!.id,
      woken?.sessionId === qSeen!.id ? "the session three days ago" : `picked ${woken?.sessionId ?? "nothing"}`,
    );

    const { en, ar } = await import("../lib/i18n/messages");
    const sendSource = stripComments(readSource("lib/checkins/send.ts"));
    check(
      "🔴 no check-in tells a person to reply stop, because nothing receives a reply",
      !/reply/i.test(en["checkin.howToStop"]) && !/ردّ|رد /.test(ar["checkin.howToStop"]),
      en["checkin.howToStop"],
    );
    check(
      "…and the message carries the link to the switch that does stop them",
      /link: \{ label: t\("checkin\.stopLink"\), url: `\$\{env\.appUrl\}\/patient\/messages` \}/.test(sendSource),
    );

    /* ------------------------------ K11 · no distinct chunk is ever dropped */

    const { appendTranscriptSegment } = await import("../lib/data/transcript");
    const chunk = (chunkId: string, words: string) =>
      appendTranscriptSegment({
        sessionId: before,
        organizationId: f!.orgId,
        therapistId: f!.t1,
        patientId: f!.t1p,
        chunkId,
        speaker: "therapist",
        text: words,
        startMs: 0,
        endMs: 8000,
      });
    /*
     * The shape that used to lose words: a rejoin or a second tab sends a NEW
     * chunk whose client number collides with a stored one, and three chunks
     * from two recorders arrive at once.
     */
    await chunk("room-tab-one-0001", "First chunk from the first tab.");
    const raced = await Promise.all([
      chunk("room-tab-two-0001", "Same number, second tab."),
      chunk("room-tab-two-0002", "Another from the second tab."),
      chunk("room-tab-one-0002", "And the first tab carries on."),
    ]);
    const retry = await chunk("room-tab-one-0001", "First chunk from the first tab.");
    const stored = await db
      .select({ sequence: transcriptSegments.sequence, text: transcriptSegments.text })
      .from(transcriptSegments)
      .where(eq(transcriptSegments.sessionId, before));
    check(
      "🔴 K11 four distinct chunks, three of them racing, are ALL kept with distinct numbers",
      raced.every((r) => r.inserted) &&
        stored.length === 4 &&
        new Set(stored.map((row) => row.sequence)).size === 4,
      `${stored.length} stored: ${stored.map((row) => row.sequence).sort().join(", ")}`,
    );
    check("K11 CONTROL: a retried chunk (same id) is still a no-op", retry.inserted === false);

    /* ------------------------- K10 · a signed-in patient paying by transfer */

    /*
     * P is signed in (an account on their person) and pays for the session on
     * their chart through the link, so the row's payer is the SESSION and no
     * receipt email was typed. The old lookup found no guest email and told
     * nobody, at either moment.
     */
    const [claim] = await db
      .insert(manualPayments)
      .values({
        purpose: "session",
        refId: now,
        amountCents: 2000,
        currency: "EGP",
        settlesCents: 2000,
        payerKind: "session",
        organizationId: f.orgId,
        state: "submitted",
      } as never)
      .returning({ id: manualPayments.id });
    const { noticePaymentSubmitted, noticePaymentConfirmed } = await import(
      "../lib/billing/payment-notices"
    );
    await noticePaymentSubmitted(claim!.id);
    await db
      .update(manualPayments)
      .set({ state: "confirmed", decidedAt: new Date() } as never)
      .where(eq(manualPayments.id, claim!.id));
    await noticePaymentConfirmed(claim!.id);
    const told10 = await db
      .select({ kind: patientNotifications.kind })
      .from(patientNotifications)
      .where(eq(patientNotifications.personId, f.p));
    const kinds = told10.map((row) => row.kind);
    check(
      "🔴 K10 a signed-in patient paying through the link is told in the app when the claim arrives",
      kinds.includes("payment_submitted"),
      kinds.join(", ") || "nothing",
    );
    check(
      "🔴 K10 …and when the money is confirmed, with no receipt email typed",
      kinds.includes("payment_confirmed"),
      kinds.join(", ") || "nothing",
    );

    /* ------------------------------ K18 · homework and questionnaires reach them */

    const { tellPatientOfWork } = await import("../lib/notify/patient-work");
    await tellPatientOfWork({ personId: f.p, therapistUserId: f.t1, what: "homework" });
    await tellPatientOfWork({ personId: f.p, therapistUserId: f.t1, what: "assessment" });
    await tellPatientOfWork({ personId: f.q, therapistUserId: f.t1, what: "homework" });
    const told18 = await db
      .select({ personId: patientNotifications.personId, kind: patientNotifications.kind })
      .from(patientNotifications)
      .where(inArray(patientNotifications.personId, [f.p, f.q]));
    check(
      "🔴 K18 a step or a questionnaire set for a patient lands in their app",
      told18.some((row) => row.personId === f!.p && row.kind === "homework_set") &&
        told18.some((row) => row.personId === f!.p && row.kind === "assessment_sent"),
      told18.map((row) => row.kind).join(", "),
    );
    check(
      "K18 CONTROL: a person with no account is not addressed as if they had an app",
      !told18.some((row) => row.personId === f!.q),
    );
    const { existsSync } = await import("node:fs");
    const stale: string[] = [];
    for (const file of [
      "app/(app)/patients/[id]/homework/actions.ts",
      "app/(app)/patients/[id]/assessments/actions.ts",
    ]) {
      const source = stripComments(readSource(file));
      if (!/tellPatientOfWork\(/.test(source)) stale.push(`${file} tells nobody`);
      for (const [, path] of [
        ...source.matchAll(/revalidatePath\(`([^`]+)`\)|revalidatePath\("([^"]+)"\)/g),
      ].map((m) => [m[0], m[1] ?? m[2]] as const)) {
        const route = path!.replace(/^\/patients\/\$\{patientId\}/, "/patients/[id]");
        const group = route.startsWith("/patients/") ? "(app)" : "(patient)";
        if (!existsSync(`app/${group}${route}/page.tsx`)) stale.push(`${path} has no page`);
      }
    }
    check(
      "🔴 K18 both actions tell the patient and revalidate only paths that have a page",
      stale.length === 0,
      stale.join("; ") || "every path is a real page",
    );

    /* ----------------- K19 · a claim after a booking, and codes that coexist */

    /*
     * PE43: A signed up (their own person S), booked T2 (a chart on S) and
     * wrote a journal, THEN claimed T1's record C by invite. The account used
     * to stay on S ("kept"), with C's sessions out of the app.
     */
    const phone = "+201555000175";
    const [s43] = await db
      .insert(people)
      .values({ firstName: `${TAG}-S`, phone })
      .returning({ id: people.id });
    const [c43] = await db
      .insert(people)
      .values({ firstName: `${TAG}-C`, phone })
      .returning({ id: people.id });
    const [a43] = await db
      .insert(patientAccounts)
      .values({ personId: s43!.id, phone, phoneVerifiedAt: new Date(), passwordHash: null })
      .returning({ id: patientAccounts.id });
    await db.insert(patients).values([
      { organizationId: f.orgId, therapistId: f.t2, personId: s43!.id, firstName: `${TAG}-booked`, phone },
      { organizationId: f.orgId, therapistId: f.t1, personId: c43!.id, firstName: `${TAG}-kept`, phone },
    ]);
    await writeJournal({ personId: s43!.id, accountId: a43!.id, body: "Wrote this before claiming.", source: "typed" });

    const { issueInvite, redeemInvite } = await import("../lib/data/claims");
    const invite = await issueInvite({ personId: c43!.id, issuedByUserId: f.t1 });
    const redeemed =
      "token" in invite
        ? await redeemInvite({ token: invite.token, accountId: a43!.id, therapistKeepsAccess: false })
        : { ok: false as const, error: invite.error };
    const [after] = await db
      .select({ personId: patientAccounts.personId })
      .from(patientAccounts)
      .where(eq(patientAccounts.id, a43!.id));
    const charts = await db
      .select({ therapistId: patients.therapistId })
      .from(patients)
      .where(eq(patients.personId, c43!.id));
    const [journal43] = await db.execute(
      sql`SELECT count(*)::int AS n FROM journals WHERE person_id = ${c43!.id}`,
    ).then((r) => r.rows as { n: number }[]);
    check(
      "🔴 PE43 claiming after a booking moves the account onto the claimed record, with both charts",
      redeemed.ok === true && after?.personId === c43!.id && charts.length === 2,
      redeemed.ok ? `${charts.length} chart(s) on the claimed record` : redeemed.error,
    );
    check(
      "PE43 …and what they wrote before claiming comes with them",
      journal43?.n === 1,
      `${journal43?.n ?? 0} journal(s) on the claimed record`,
    );
    const { accessFor } = await import("../lib/data/grants");
    const [bookedChart] = await db
      .select({ id: patients.id })
      .from(patients)
      .where(and(eq(patients.personId, c43!.id), eq(patients.therapistId, f.t2)));
    const t2Access = await accessFor(
      { userId: f.t2, organizationId: f.orgId, role: "therapist" } as never,
      bookedChart!.id,
    );
    check(
      "PE43 CONTROL: the fold grants nobody anything; an unticked claim leaves the booked clinician without the live profile",
      !t2Access.capabilities.liveProfile,
      t2Access.state,
    );

    /*
     * 🔴 B6: after that claim, the signup row S is left behind unclaimed with
     * the same number. /patient/claim offered it back as "a therapist keeps
     * notes for someone with your phone number", and claiming it hit
     * `people_claimed_phone_unique` and showed the error page. A second
     * clinician's chart on the same number (D) is the same collision with a
     * real chart behind it.
     */
    {
      const { suggestionsForAccount, startClaim, HANDLE_TAKEN } = await import("../lib/data/claims");
      const { findMatches } = await import("../lib/data/people");
      const [d43] = await db
        .insert(people)
        .values({ firstName: `${TAG}-D`, phone })
        .returning({ id: people.id });
      await db.insert(patients).values({
        organizationId: f.orgId,
        therapistId: f.t2,
        personId: d43!.id,
        firstName: `${TAG}-second`,
        phone,
      });
      const raw = (await findMatches({ phone })).filter((m) => !m.claimed).map((m) => m.personId);
      check(
        "B6 CONTROL: the matcher still finds the left-behind signup row and the second chart, unclaimed",
        raw.includes(s43!.id) && raw.includes(d43!.id),
        `${raw.length} unclaimed match(es)`,
      );
      const offered = (await suggestionsForAccount(a43!.id)).map((s) => s.personId);
      check(
        "🔴 B6 a claimed patient is not offered their own left-behind signup row, nor a record their number can no longer take",
        !offered.includes(s43!.id) && !offered.includes(d43!.id),
        `${offered.length} offered`,
      );
      const bySignupRow = await startClaim({ personId: s43!.id, accountId: a43!.id, channel: "email" });
      const bySecond = await startClaim({ personId: d43!.id, accountId: a43!.id, channel: "email", route: "invite" });
      check(
        "🔴 B6 …and starting a claim on either is refused with a sentence, not a database error",
        !bySignupRow.ok && !bySecond.ok && bySecond.error === HANDLE_TAKEN,
        bySecond.ok ? "STARTED" : bySecond.error,
      );
      const inviteD = await issueInvite({ personId: d43!.id, issuedByUserId: f.t2 });
      const redeemD =
        "token" in inviteD
          ? await redeemInvite({ token: inviteD.token, accountId: a43!.id, therapistKeepsAccess: false }).catch(
              (error: unknown) => ({ ok: false as const, error: `THREW ${String(error)}` }),
            )
          : { ok: false as const, error: inviteD.error };
      check(
        "🔴 B6 an invite to a second record on a number already claimed answers with a sentence and stays unspent",
        !redeemD.ok && redeemD.error === HANDLE_TAKEN,
        redeemD.ok ? "CLAIMED" : redeemD.error,
      );
    }

    /* PE42: the person is taken first and the invite spent second, in one transaction. */
    const claimsSource = stripComments(readSource("lib/data/claims.ts"));
    const redeem = claimsSource.slice(claimsSource.indexOf("export async function redeemInvite"));
    check(
      "🔴 PE42 an invite is spent only by the claim it makes (person first, invite second, a lost race rolls back)",
      redeem.indexOf(".update(people)") > 0 &&
        redeem.indexOf(".update(people)") < redeem.indexOf(".update(personInvites)") &&
        /throw new InviteRaceLost\(\)/.test(redeem),
    );

    /* The add-email code and the sign-in code no longer cancel each other. */
    const { issueEmailCode, confirmEmailCode } = await import("../lib/patient-auth/email");
    const address = `${TAG}@example.com`;
    const issued = await issueEmailCode(a43!.id, address);
    /* A sign-in code asked for AFTER it, as `requestSignInCode` writes one. */
    await db.insert(patientAuthTokens).values({
      patientAccountId: a43!.id,
      purpose: "sign_in",
      tokenHash: randomBytes(32).toString("hex"),
      channel: "email",
      expiresAt: new Date(Date.now() + 900_000),
    });
    const confirmed =
      issued.ok && issued.code ? await confirmEmailCode(a43!.id, address, issued.code) : { ok: false as const, error: "no code issued" };
    check(
      "🔴 K19 asking for a sign-in code does not cancel the add-an-email code already sent",
      confirmed.ok === true,
      confirmed.ok ? "the email code still confirms" : confirmed.error,
    );
    const purposes = [
      stripComments(readSource("lib/patient-auth/code-signin.ts")),
      stripComments(readSource("lib/patient-auth/email.ts")),
      stripComments(readSource("lib/patient-auth/handle.ts")),
    ].map((source) => [...new Set([...source.matchAll(/purpose(?:: |, )"([a-z_]+)"/g)].map((m) => m[1]))].join("/"));
    check(
      "K19 CONTROL: sign-in, add-email and the claim's handle code each use their own purpose",
      new Set(purposes).size === 3 && purposes.every((p) => p.length > 0 && !p.includes("/")),
      purposes.join(", "),
    );

    /* ----------------------------------------- K9 · the arrival rating */

    const joinToken = randomBytes(16).toString("hex");
    await db.update(sessions).set({ joinToken, status: "in_progress" }).where(eq(sessions.id, now));
    const { recordArrival } = await import("../lib/data/feedback");
    const rated = await recordArrival({ token: joinToken, serviceStars: 4, email: "", via: "join" });
    const [kept] = await db
      .select({ stars: sessionFeedback.serviceStars })
      .from(sessionFeedback)
      .where(eq(sessionFeedback.sessionId, now));
    check(
      "🔴 K9 a rating given in the room with the JOIN token is saved",
      rated.ok === true && kept?.stars === 4,
      rated.error ?? `stored ${kept?.stars ?? "nothing"}`,
    );
    check(
      "K9 CONTROL: the join token is not a feedback link, so neither opens the other's door",
      Boolean((await recordArrival({ token: joinToken, serviceStars: 2, email: "" })).error),
    );
    const room = stripComments(readSource("components/join/patient-room.tsx"));
    check(
      "🔴 K9 the room says thank you only when the save came back ok",
      /if \(result\.ok\)[\s\S]{0,80}setDone\(true\)/.test(room) && !/await rateOnArrival\([^)]*\);\s*setDone\(true\)/.test(room),
    );

    /* ----------------------- the case copilot · the newest twelve, and `before` */

    const [t2q] = await db
      .insert(patients)
      .values({ organizationId: f.orgId, therapistId: f.t2, personId: f.q, firstName: `${TAG}-t2q`, phone: "+201555000174" })
      .returning({ id: patients.id });
    for (let n = 1; n <= 14; n += 1) {
      const at = new Date(Date.now() - (20 - n) * day);
      const [s] = await db
        .insert(sessions)
        .values({
          organizationId: f.orgId,
          therapistId: f.t2,
          patientId: t2q!.id,
          status: "completed",
          modality: "video",
          feedbackToken: randomBytes(16).toString("hex"),
          createdAt: at,
          startedAt: at,
          endedAt: at,
        })
        .returning({ id: sessions.id });
      await db.insert(transcriptSegments).values({
        sessionId: s!.id,
        organizationId: f.orgId,
        sequence: 1,
        speaker: "patient",
        text: `marker-session-${n}-end`,
      });
    }
    const { __patientContextForTest, __profileForTest } = await import("../lib/ai/case-copilot");
    const context = await __patientContextForTest(t2q!.id);
    check(
      "🔴 the case copilot reads the NEWEST twelve sessions, not the first twelve",
      context.sessionCount === 12 &&
        context.transcript.includes("marker-session-14-end") &&
        !context.transcript.includes("marker-session-2-end"),
      `${context.sessionCount} sessions read`,
    );
    check(
      "…in the order they happened",
      context.transcript.indexOf("marker-session-3-end") < context.transcript.indexOf("marker-session-14-end") &&
        context.transcript.indexOf("marker-session-3-end") >= 0,
    );

    await db.insert(personProfiles).values({
      personId: f.q,
      sections: [{ heading: "Rebuilt", body: "marker-profile-body", refs: ["S1:1"] }] as never,
      sessionCount: 1,
    });
    const liveStarted = new Date(Date.now() - 3_600_000);
    const inRoom = await __profileForTest(t2q!.id, undefined, liveStarted);
    const afterwards = await __profileForTest(t2q!.id, undefined, null);
    check(
      "🔴 C373 a profile rebuilt during the live session does not reach the in-room copilot",
      inRoom === "",
      inRoom ? "the rebuilt profile was handed over" : "left out",
    );
    check("C373 CONTROL: with no live bound the same profile is read", afterwards.includes("marker-profile-body"));

    const assistant = readSource("lib/ai/assistant.ts");
    const prompt = assistant.slice(assistant.indexOf("const SYSTEM = `"), assistant.indexOf("`;", assistant.indexOf("const SYSTEM = `")));
    check(
      "the home-screen assistant's prompt no longer denies the schedule its own roster carries",
      !/no appointment schedule/i.test(prompt) && /next booked session/.test(prompt) && /`next \$\{row\.nextSessionAt/.test(assistant),
    );

    /* ------------------------------ reading a document aloud · limit and reset */

    const speakRoute = stripComments(readSource("app/api/documents/[id]/speak/route.ts"));
    check(
      "a document is read aloud a bounded number of times per reader, after access and before the paid call",
      /consume\(subjectKey\("document:speak", reader\)/.test(speakRoute) &&
        speakRoute.indexOf("consume(") > speakRoute.indexOf("decision.allowed") &&
        speakRoute.indexOf("consume(") < speakRoute.indexOf("audio.speech.create"),
    );
    const list = stripComments(readSource("components/documents/document-list.tsx"));
    check(
      "…and a refusal puts the Read aloud button back instead of leaving it on Reading…",
      /if \(!response\.ok\) \{\s*setSpeaking\(false\);/.test(list) && !/if \(!response\.ok\) return;/.test(list),
    );

    /* ------------------------ questionnaires · only the published languages */

    const [phq] = await db
      .select({ id: instruments.id, version: instruments.version, questions: instruments.questions, locales: instruments.locales })
      .from(instruments)
      .where(eq(instruments.key, "phq9"))
      .limit(1);
    if (phq) {
      const [assigned] = await db
        .insert(assessmentAssignments)
        .values({
          instrumentId: phq.id,
          instrumentVersion: phq.version,
          patientId: f.t1p,
          organizationId: f.orgId,
          assignedByUserId: f.t1,
          mode: "homework",
        })
        .returning({ id: assessmentAssignments.id });
      const { assignmentForAnswering } = await import("../lib/data/assessments");
      const shown = await assignmentForAnswering(assigned!.id, f.p);
      const drafted = (phq.questions as { text: Record<string, string> }[]).some((q) =>
        Object.keys(q.text).some((locale) => !phq.locales.includes(locale)),
      );
      const leaked = (shown?.questions ?? []).flatMap((q) => [
        ...Object.keys(q.text),
        ...q.options.flatMap((o) => Object.keys(o.label)),
      ]).filter((locale) => !phq.locales.includes(locale));
      check(
        "🔴 an unreviewed translation of a questionnaire never reaches the patient's screen",
        Boolean(shown) && leaked.length === 0,
        `published ${phq.locales.join("/")}, ${leaked.length} draft string(s) sent`,
      );
      check(
        "CONTROL: the instrument really carries an unpublished draft, so the check above can fail",
        drafted,
      );
    } else {
      check("the PHQ-9 is seeded, so the questionnaire check has something to read", false, "no phq9 row");
    }

    /* ---------------------------- PE81 · a check-in for somebody with no zone */

    const { candidates } = await import("../lib/data/checkins");
    const pool = await candidates(5000);
    const mine = pool.find((c) => c.personId === f!.p);
    check(
      "🔴 PE81 a patient who never saved a zone, on an Egyptian number, is checked on in Cairo time",
      mine?.timezone === "Africa/Cairo",
      mine ? `zone ${mine.timezone ?? "none"}` : "not a candidate",
    );
    const { shouldSend } = await import("../lib/checkins/policy");
    check(
      "PE81 CONTROL: an unknown zone is still refused, so the fallback is what changed",
      shouldSend({
        settings: { enabled: true, everyHours: 24, quietFromHour: 21, quietToHour: 9, muteRateHalt: 0.5 },
        muteRate: 0,
        muted: false,
        timezone: null,
        lastSentAt: null,
        reachable: true,
        now: new Date(),
      }).send === false,
    );

    /* ------------------------------------------ K24 · closing an account (LAST) */

    await db.update(patientAccounts).set({ email: `${TAG}-p@example.com` }).where(eq(patientAccounts.id, f.account));
    await db.insert(patientAuthSessions).values({
      patientAccountId: f.account,
      tokenHash: randomBytes(32).toString("hex"),
      absoluteExpiresAt: new Date(Date.now() + 86_400_000),
    });
    const chartsBefore = (
      await db.select({ id: patients.id }).from(patients).where(eq(patients.personId, f.p))
    ).length;
    const { closePatientAccount } = await import("../lib/data/account-closure");
    const closedResult = await closePatientAccount({ accountId: f.account, personId: f.p });
    const [row24] = await db
      .select({ deletedAt: patientAccounts.deletedAt, email: patientAccounts.email, hash: patientAccounts.passwordHash })
      .from(patientAccounts)
      .where(eq(patientAccounts.id, f.account));
    const liveSessions = await db
      .select({ id: patientAuthSessions.id })
      .from(patientAuthSessions)
      .where(and(eq(patientAuthSessions.patientAccountId, f.account), sql`${patientAuthSessions.revokedAt} IS NULL`));
    const grants24 = await db
      .select({ status: historyGrants.status })
      .from(historyGrants)
      .where(and(eq(historyGrants.personId, f.p), eq(historyGrants.therapistUserId, f.t1)));
    const chartsAfter = (
      await db.select({ id: patients.id }).from(patients).where(eq(patients.personId, f.p))
    ).length;
    check(
      "🔴 K24 closing an account ends the login: closed, email released, no password, every session revoked",
      closedResult.ok === true &&
        row24?.deletedAt !== null &&
        row24?.email === null &&
        row24?.hash === null &&
        liveSessions.length === 0,
    );
    check(
      "🔴 K24 …and the clinician holding an open-ended grant loses it",
      grants24.every((grant) => grant.status !== "granted") && grants24.length > 0,
      grants24.map((grant) => grant.status).join(", "),
    );
    check(
      "K24 CONTROL: the clinical record the clinicians hold is untouched",
      chartsAfter === chartsBefore && chartsBefore > 0,
      `${chartsAfter} chart(s)`,
    );
    const page24 = stripComments(readSource("app/(patient)/patient/account/page.tsx"));
    check(
      "K24 the account page offers it, with the typed-word confirm",
      /<CloseAccount \/>/.test(page24) &&
        /accepted\.includes\(typed\)/.test(stripComments(readSource("app/(patient)/patient/account/actions.ts"))),
    );
  } finally {
    await clean();
  }

  finish("Patient side");
}

void main();
