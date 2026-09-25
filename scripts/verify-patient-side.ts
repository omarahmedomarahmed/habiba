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
  notifications,
  organizations,
  patientAccounts,
  patients,
  people,
  riskAssessments,
  sessions,
  therapistVerifications,
  users,
} from "../lib/db/schema";
import { reporter, writesTo } from "./_verify";

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
    await db.delete(riskAssessments).where(inArray(riskAssessments.organizationId, orgIds));
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
  } finally {
    await clean();
  }

  finish("Patient side");
}

void main();
