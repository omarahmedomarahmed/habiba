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
  historyGrants,
  manualPayments,
  notifications,
  patientNotifications,
  organizations,
  patientAccounts,
  patients,
  people,
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
  } finally {
    await clean();
  }

  finish("Patient side");
}

void main();
