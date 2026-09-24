/**
 * 🔴 76.1 — THE BOARD THE FOUNDERS RUN THE COMPANY FROM.
 *
 * ## What this is, and why it is not the console beside it
 *
 * `reads.ts` is the LIVE console: who is in a session right now, who is on the
 * radar, what happened in the last hour. It answers "what is going on" and it is
 * behind an elevation gate because it reaches clinical rows.
 *
 * This answers a completely different question: **"how is the business doing,
 * and who is doing it."** Every company, every clinic, every therapist, every
 * dollar, this week and this month. Nothing here reads a note, a transcript or a
 * message. It counts.
 *
 * ## 🔴 EVERY SECTION IS ITS OWN QUERY, ON PURPOSE
 *
 * The screen has a refresh button per section as well as one for everything,
 * because a founder watching the money does not want the roster re-sorted under
 * them, and because one slow count must not hold up eight fast ones. So each
 * export below is independent and none of them shares a transaction.
 *
 * ## 🔴 AND EVERY SECTION HAS A DOOR
 *
 * Each returns a `manageHref` pointing at the admin page that already manages
 * that thing. A dashboard you can only look at is a dashboard that becomes a
 * second place to keep numbers; this one hands you to the screen with the
 * buttons on it. Nothing here writes.
 */
import "server-only";

import { and, eq, gte, sql } from "drizzle-orm";

import { controlDb as db } from "@/lib/db";
import { qualified } from "@/lib/db/qualified";
import {
  aiRequestLogs,
  auditLog,
  clinicSeats,
  invoices,
  manualPayments,
  enrolments,
  organizations,
  patients,
  sessions,
  sponsorPots,
  sponsors,
  subscriptions,
  users,
} from "@/lib/db/schema";

/* ------------------------------------------------------------- windows -- */

/**
 * 🔴 A WEEK AND A MONTH, BOTH, EVERYWHERE.
 *
 * One number with no window is a number nobody can act on: eleven sessions is
 * wonderful in a week and alarming in a month. Every count below carries both,
 * measured from now rather than from a calendar boundary, because a founder
 * looking on a Wednesday wants the last seven days and not "since Monday".
 */
export function windows(now = new Date()) {
  const week = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const month = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  return { now, week, month };
}

export type Money = { weekCents: number; monthCents: number; totalCents: number };

/* ============================================================== 1 · money = */

/**
 * What came in, what went out, and what is left. Read from invoices and the AI
 * log rather than from the ledger, because this is the operating view and the
 * ledger is the accounting one; `/admin/vault` is where the two are reconciled.
 */
export async function moneyBoard() {
  const { week, month } = windows();

  const [row] = await db
    .select({
      weekCents: sql<number>`COALESCE(SUM(${invoices.amountCents} - ${invoices.discountCents}) FILTER (WHERE ${invoices.issuedAt} >= ${week} AND ${invoices.status} = 'paid'), 0)::int`,
      monthCents: sql<number>`COALESCE(SUM(${invoices.amountCents} - ${invoices.discountCents}) FILTER (WHERE ${invoices.issuedAt} >= ${month} AND ${invoices.status} = 'paid'), 0)::int`,
      totalCents: sql<number>`COALESCE(SUM(${invoices.amountCents} - ${invoices.discountCents}) FILTER (WHERE ${invoices.status} = 'paid'), 0)::int`,
      /* 🔴 Due is NOT revenue. It is what somebody has been asked for and has not sent. */
      dueCents: sql<number>`COALESCE(SUM(${invoices.amountCents} - ${invoices.discountCents}) FILTER (WHERE ${invoices.status} = 'due'), 0)::int`,
      dueCount: sql<number>`COUNT(*) FILTER (WHERE ${invoices.status} = 'due')::int`,
      subscriptionCents: sql<number>`COALESCE(SUM(${invoices.amountCents} - ${invoices.discountCents}) FILTER (WHERE ${invoices.kind} = 'subscription' AND ${invoices.status} = 'paid' AND ${invoices.issuedAt} >= ${month}), 0)::int`,
      sessionCents: sql<number>`COALESCE(SUM(${invoices.amountCents} - ${invoices.discountCents}) FILTER (WHERE ${invoices.kind} = 'session' AND ${invoices.status} = 'paid' AND ${invoices.issuedAt} >= ${month}), 0)::int`,
      waivedCents: sql<number>`COALESCE(SUM(${invoices.discountCents}) FILTER (WHERE ${invoices.issuedAt} >= ${month}), 0)::int`,
    })
    .from(invoices);

  /* The expense side, in the same shape, from what the product actually spent. */
  const [spend] = await db
    .select({
      weekMicro: sql<number>`COALESCE(SUM(${aiRequestLogs.costMicrocents}) FILTER (WHERE ${aiRequestLogs.createdAt} >= ${week}), 0)::bigint`,
      monthMicro: sql<number>`COALESCE(SUM(${aiRequestLogs.costMicrocents}) FILTER (WHERE ${aiRequestLogs.createdAt} >= ${month}), 0)::bigint`,
      totalMicro: sql<number>`COALESCE(SUM(${aiRequestLogs.costMicrocents}), 0)::bigint`,
    })
    .from(aiRequestLogs);

  const micro = (v: unknown) => Number(v ?? 0) / 1_000_000;

  return {
    manageHref: "/admin/vault",
    inWeekCents: row?.weekCents ?? 0,
    inMonthCents: row?.monthCents ?? 0,
    inTotalCents: row?.totalCents ?? 0,
    dueCents: row?.dueCents ?? 0,
    dueCount: row?.dueCount ?? 0,
    subscriptionCents: row?.subscriptionCents ?? 0,
    sessionCents: row?.sessionCents ?? 0,
    waivedCents: row?.waivedCents ?? 0,
    aiWeekCents: micro(spend?.weekMicro),
    aiMonthCents: micro(spend?.monthMicro),
    aiTotalCents: micro(spend?.totalMicro),
  };
}

/* ========================================================== 2 · companies = */

/** Every sponsor, with what they hold and what they have spent. */
export async function companiesBoard() {
  const { month } = windows();

  const rows = await db
    .select({
      id: sponsors.id,
      name: sponsors.name,
      kind: sponsors.kind,
      state: sponsors.state,
      entity: sponsors.entity,
      coverageBps: sponsorPots.coverageBps,
      balanceCents: sponsorPots.balanceCents,
      expiresAt: sponsorPots.expiresAt,
      createdAt: sponsors.createdAt,
    })
    .from(sponsors)
    .leftJoin(sponsorPots, eq(sponsorPots.sponsorId, sponsors.id))
    .orderBy(sponsors.createdAt);

  /*
   * 🔴 SESSIONS COVERED THIS MONTH, THROUGH THE ENROLMENT AND NOT OFF THE SESSION.
   *
   * There is no `sponsor_id` on a patient and there should not be: who funds
   * somebody is a live relationship on `enrolments`, and a copy on the patient
   * row would be a second opinion that goes stale the day they change employer.
   * `P5` in the simulation does exactly that in month 4.
   */
  const covered = await db
    .select({
      sponsorId: enrolments.sponsorId,
      sessions: sql<number>`count(*)::int`,
    })
    .from(sessions)
    .innerJoin(patients, eq(patients.id, sessions.patientId))
    .innerJoin(enrolments, eq(enrolments.personId, patients.personId))
    .where(and(gte(sessions.createdAt, month), eq(enrolments.state, "active")))
    .groupBy(enrolments.sponsorId);

  const bySponsor = new Map(covered.map((c) => [c.sponsorId, c.sessions]));

  return {
    manageHref: "/admin/sponsors",
    rows: rows.map((r) => ({
      ...r,
      balanceCents: r.balanceCents ?? 0,
      sessionsThisMonth: bySponsor.get(r.id) ?? 0,
      /** 🔴 A pot balance is a LIABILITY: somebody else's money on our books. */
      committedCents: r.balanceCents ?? 0,
    })),
  };
}

/* ============================================================ 3 · clinics = */

/** Every practice with more than one seat, and what it is billed for them. */
export async function clinicsBoard() {
  const rows = await db
    .select({
      id: organizations.id,
      name: organizations.name,
      state: organizations.clinicState,
      region: organizations.region,
      seats: organizations.seats,
      createdAt: organizations.createdAt,
      /*
       * 🔴 W2-Q01: qualified(), because this select has no join, and there
       * Drizzle renders `${organizations.id}` as a bare "id" that each subquery
       * bound to its own row (`u.organization_id = u.id`): every clinic read 0
       * clinicians, 0 live seats and 0 due.
       */
      clinicians: sql<number>`(SELECT count(*)::int FROM users u WHERE u.organization_id = ${qualified(organizations.id)} AND u.role = 'therapist' AND u.deleted_at IS NULL)`,
      liveSeats: sql<number>`(SELECT count(*)::int FROM clinic_seats cs WHERE cs.organization_id = ${qualified(organizations.id)} AND cs.released_at IS NULL)`,
      dueCents: sql<number>`(SELECT COALESCE(SUM(i.amount_cents - i.discount_cents), 0)::int FROM invoices i WHERE i.organization_id = ${qualified(organizations.id)} AND i.status = 'due')`,
    })
    .from(organizations)
    .where(eq(organizations.kind, "clinic"))
    .orderBy(organizations.createdAt);

  return { manageHref: "/admin/clinics", rows };
}

/* ========================================================= 4 · therapists = */

/**
 * Every clinician, with the one thing each of them is: **which way they pay.**
 *
 * 🔴 The plan/metered split is the single most load-bearing count in the whole
 * business, and nothing on any other screen shows it. A month where subscribers
 * fall and metered rises is a month the plan is not worth buying, and it looks
 * identical to a good month in every revenue total.
 */
export async function therapistsBoard() {
  const { month } = windows();

  const rows = await db
    .select({
      id: users.id,
      firstName: users.firstName,
      lastName: users.lastName,
      email: users.email,
      organizationId: users.organizationId,
      orgName: organizations.name,
      orgKind: organizations.kind,
      region: organizations.region,
      plan: subscriptions.plan,
      status: subscriptions.status,
      sessionsThisMonth: sql<number>`(SELECT count(*)::int FROM sessions s WHERE s.therapist_id = ${qualified(users.id)} AND s.created_at >= ${month})`,
      dueCents: sql<number>`(SELECT COALESCE(SUM(i.amount_cents - i.discount_cents), 0)::int FROM invoices i WHERE i.organization_id = ${qualified(users.organizationId)} AND i.status = 'due')`,
      aiMicro: sql<number>`(SELECT COALESCE(SUM(l.cost_microcents), 0)::bigint FROM ai_request_logs l WHERE l.organization_id = ${qualified(users.organizationId)} AND l.created_at >= ${month})`,
    })
    .from(users)
    .leftJoin(organizations, eq(organizations.id, users.organizationId))
    .leftJoin(subscriptions, eq(subscriptions.organizationId, users.organizationId))
    .where(and(eq(users.role, "therapist"), sql`${users.deletedAt} IS NULL`))
    .orderBy(users.createdAt);

  const onPlan = rows.filter((r) => r.plan && r.plan !== "payg").length;

  return {
    manageHref: "/admin/therapists",
    onPlan,
    metered: rows.length - onPlan,
    rows: rows.map((r) => ({ ...r, aiCents: Number(r.aiMicro ?? 0) / 1_000_000 })),
  };
}

/* =========================================================== 5 · sessions = */

/** What happened, by week and month, split the three ways that matter. */
export async function sessionsBoard() {
  const { week, month } = windows();

  const [row] = await db
    .select({
      week: sql<number>`COUNT(*) FILTER (WHERE ${sessions.createdAt} >= ${week})::int`,
      month: sql<number>`COUNT(*) FILTER (WHERE ${sessions.createdAt} >= ${month})::int`,
      total: sql<number>`COUNT(*)::int`,
      consented: sql<number>`COUNT(*) FILTER (WHERE ${sessions.recordingConsent} = 'granted' AND ${sessions.createdAt} >= ${month})::int`,
      declined: sql<number>`COUNT(*) FILTER (WHERE ${sessions.recordingConsent} = 'declined' AND ${sessions.createdAt} >= ${month})::int`,
      inPerson: sql<number>`COUNT(*) FILTER (WHERE ${sessions.modality} <> 'video' AND ${sessions.createdAt} >= ${month})::int`,
      paid: sql<number>`COUNT(*) FILTER (WHERE ${sessions.paymentStatus} = 'paid' AND ${sessions.createdAt} >= ${month})::int`,
      awaiting: sql<number>`COUNT(*) FILTER (WHERE ${sessions.paymentStatus} = 'pending' AND ${sessions.priceCents} > 0)::int`,
    })
    .from(sessions);

  return { manageHref: "/admin/usage", ...(row ?? {}) };
}

/* ========================================================== 6 · AI dollars = */

/** What the models cost, by kind, which is the only expense that scales. */
export async function aiBoard() {
  const { week, month } = windows();

  const rows = await db
    .select({
      kind: aiRequestLogs.kind,
      weekMicro: sql<number>`COALESCE(SUM(${aiRequestLogs.costMicrocents}) FILTER (WHERE ${aiRequestLogs.createdAt} >= ${week}), 0)::bigint`,
      monthMicro: sql<number>`COALESCE(SUM(${aiRequestLogs.costMicrocents}) FILTER (WHERE ${aiRequestLogs.createdAt} >= ${month}), 0)::bigint`,
      calls: sql<number>`COUNT(*) FILTER (WHERE ${aiRequestLogs.createdAt} >= ${month})::int`,
      tokensIn: sql<number>`COALESCE(SUM(${aiRequestLogs.inputTokens}) FILTER (WHERE ${aiRequestLogs.createdAt} >= ${month}), 0)::bigint`,
      tokensOut: sql<number>`COALESCE(SUM(${aiRequestLogs.outputTokens}) FILTER (WHERE ${aiRequestLogs.createdAt} >= ${month}), 0)::bigint`,
    })
    .from(aiRequestLogs)
    .groupBy(aiRequestLogs.kind);

  return {
    manageHref: "/admin/usage",
    rows: rows.map((r) => ({
      kind: r.kind,
      weekCents: Number(r.weekMicro ?? 0) / 1_000_000,
      monthCents: Number(r.monthMicro ?? 0) / 1_000_000,
      calls: r.calls,
      tokensIn: Number(r.tokensIn ?? 0),
      tokensOut: Number(r.tokensOut ?? 0),
    })),
  };
}

/* =========================================================== 7 · payments = */

/**
 * The transfer queue, which is the one section where a number going up is
 * somebody waiting rather than somebody paying.
 */
export async function paymentsBoard() {
  const { week, month } = windows();

  const [row] = await db
    .select({
      waiting: sql<number>`COUNT(*) FILTER (WHERE ${manualPayments.state} = 'submitted')::int`,
      awaitingProof: sql<number>`COUNT(*) FILTER (WHERE ${manualPayments.state} = 'awaiting_proof')::int`,
      confirmedWeek: sql<number>`COUNT(*) FILTER (WHERE ${manualPayments.state} = 'confirmed' AND ${manualPayments.decidedAt} >= ${week})::int`,
      rejectedWeek: sql<number>`COUNT(*) FILTER (WHERE ${manualPayments.state} = 'rejected' AND ${manualPayments.decidedAt} >= ${week})::int`,
      settledMonthCents: sql<number>`COALESCE(SUM(${manualPayments.settlesCents}) FILTER (WHERE ${manualPayments.state} = 'confirmed' AND ${manualPayments.decidedAt} >= ${month}), 0)::int`,
      /* 🔴 The longest anybody has been waiting, in minutes. The number to act on. */
      oldestMinutes: sql<number>`COALESCE(EXTRACT(EPOCH FROM (now() - MIN(${manualPayments.submittedAt}) FILTER (WHERE ${manualPayments.state} = 'submitted'))) / 60, 0)::int`,
    })
    .from(manualPayments);

  return { manageHref: "/admin/transfers", ...(row ?? {}) };
}

/* =========================================================== 8 · patients = */

export async function patientsBoard() {
  const { week, month } = windows();

  const [row] = await db
    .select({
      total: sql<number>`COUNT(*) FILTER (WHERE ${patients.deletedAt} IS NULL)::int`,
      week: sql<number>`COUNT(*) FILTER (WHERE ${patients.createdAt} >= ${week})::int`,
      month: sql<number>`COUNT(*) FILTER (WHERE ${patients.createdAt} >= ${month})::int`,
      /* Funded by an employer, asked of the live enrolment rather than a copy. */
      /*
       * 🔴 W2-Q01: qualified(). Bare, `${patients.personId}` rendered as
       * "person_id" in this join-less select and bound to the subquery's own
       * column, so both counts were true of every patient once one active
       * enrolment, or one account, existed anywhere.
       */
      sponsored: sql<number>`COUNT(*) FILTER (WHERE ${patients.deletedAt} IS NULL AND EXISTS (SELECT 1 FROM enrolments e WHERE e.person_id = ${qualified(patients.personId)} AND e.state = 'active'))::int`,
      /* Claimed: the person behind the record has made themselves an account. */
      claimed: sql<number>`COUNT(*) FILTER (WHERE EXISTS (SELECT 1 FROM patient_accounts pa WHERE pa.person_id = ${qualified(patients.personId)}))::int`,
    })
    .from(patients);

  return { manageHref: "/admin/radar", ...(row ?? {}) };
}

/* =========================================================== 9 · activity = */

/**
 * 🔴 EVERY ACTION, BY WHO DID IT, THIS WEEK AND THIS MONTH.
 *
 * The audit log already records every consequential act. What it has never had
 * is a shape a founder can read: it is a stream, and a stream answers "what just
 * happened" rather than "what is this company doing".
 *
 * So this groups by category and by actor kind. A week where `billing` is busy
 * and `clinical` is quiet is a completely different week from the reverse, and
 * both look the same in a list of 200 rows.
 */
export async function activityBoard() {
  const { week, month } = windows();

  const rows = await db
    .select({
      category: auditLog.category,
      week: sql<number>`COUNT(*) FILTER (WHERE ${auditLog.createdAt} >= ${week})::int`,
      month: sql<number>`COUNT(*) FILTER (WHERE ${auditLog.createdAt} >= ${month})::int`,
    })
    .from(auditLog)
    .groupBy(auditLog.category);

  /* Who is acting: our own staff, a clinician, a company, or a patient. */
  const [actors] = await db
    .select({
      staff: sql<number>`COUNT(*) FILTER (WHERE ${auditLog.actorUserId} IS NOT NULL AND ${auditLog.createdAt} >= ${month})::int`,
      sponsor: sql<number>`COUNT(*) FILTER (WHERE ${auditLog.actorSponsorUserId} IS NOT NULL AND ${auditLog.createdAt} >= ${month})::int`,
      unattributed: sql<number>`COUNT(*) FILTER (WHERE ${auditLog.actorUserId} IS NULL AND ${auditLog.actorSponsorUserId} IS NULL AND ${auditLog.createdAt} >= ${month})::int`,
    })
    .from(auditLog);

  return {
    manageHref: "/admin/audit",
    rows: rows.sort((a, b) => b.month - a.month),
    actors: actors ?? { staff: 0, sponsor: 0, unattributed: 0 },
  };
}

/* ------------------------------------------------------------ everything -- */

/**
 * All nine, in parallel, for the "refresh everything" button.
 *
 * 🔴 `Promise.all` rather than sequential: nine independent counts against one
 * database take as long as the slowest one, and a board that takes nine times
 * as long as it needs to is a board nobody refreshes.
 */
export async function wholeBoard() {
  const [money, companies, clinics, therapists, sessionStats, ai, payments, people, activity] =
    await Promise.all([
      moneyBoard(),
      companiesBoard(),
      clinicsBoard(),
      therapistsBoard(),
      sessionsBoard(),
      aiBoard(),
      paymentsBoard(),
      patientsBoard(),
      activityBoard(),
    ]);

  return { money, companies, clinics, therapists, sessions: sessionStats, ai, payments, people, activity };
}

export type WholeBoard = Awaited<ReturnType<typeof wholeBoard>>;
