import "server-only";

import { and, count, desc, eq, gte, isNull, sql } from "drizzle-orm";

import { db } from "@/lib/db";
import {
  aiRequestLogs,
  auditLog,
  copilotMessages,
  copilotThreads,
  organizations,
  patients,
  invoices,
  sessions,
  subscriptions,
  therapistVerifications,
  transcriptSegments,
  users,
} from "@/lib/db/schema";

/**
 * Admin reads. Cross-organisation by definition, so every function in this file
 * must only ever be called behind `requireRole("super_admin")`.
 *
 * Note what is not here: user impersonation. The old console could mint a token
 * as any user, but never recorded it — the audit insert named columns that did
 * not exist and swallowed the failure, so impersonation was untraceable. An
 * untraceable "become this clinician" button over a chart of therapy
 * transcripts is not a feature worth rebuilding.
 */

export async function platformStats() {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const [orgs] = await db.select({ value: count() }).from(organizations).where(isNull(organizations.deletedAt));
  const [clinicians] = await db.select({ value: count() }).from(users).where(isNull(users.deletedAt));
  const [charts] = await db.select({ value: count() }).from(patients).where(isNull(patients.deletedAt));
  const [completed] = await db
    .select({ value: count() })
    .from(sessions)
    .where(and(eq(sessions.status, "completed"), gte(sessions.createdAt, thirtyDaysAgo)));

  const [ai] = await db
    .select({
      calls: count(),
      costCents: sql<number>`COALESCE(SUM(${aiRequestLogs.costCents}), 0)::int`,
      errors: sql<number>`COALESCE(SUM(CASE WHEN ${aiRequestLogs.status} = 'error' THEN 1 ELSE 0 END), 0)::int`,
    })
    .from(aiRequestLogs)
    .where(gte(aiRequestLogs.createdAt, thirtyDaysAgo));

  const [revenue] = await db
    .select({
      collectedCents: sql<number>`COALESCE(SUM(CASE WHEN ${invoices.status} = 'paid' THEN ${invoices.amountCents} ELSE 0 END), 0)::int`,
      pendingCents: sql<number>`COALESCE(SUM(CASE WHEN ${invoices.status} = 'pending' THEN ${invoices.amountCents} ELSE 0 END), 0)::int`,
    })
    .from(invoices)
    .where(gte(invoices.issuedAt, thirtyDaysAgo));

  return {
    organizations: orgs?.value ?? 0,
    clinicians: clinicians?.value ?? 0,
    patients: charts?.value ?? 0,
    sessions30d: completed?.value ?? 0,
    aiCalls30d: ai?.calls ?? 0,
    aiCostCents30d: ai?.costCents ?? 0,
    aiErrors30d: ai?.errors ?? 0,
    collectedCents30d: revenue?.collectedCents ?? 0,
    pendingCents30d: revenue?.pendingCents ?? 0,
  };
}

export async function listClinicians() {
  return db
    .select({
      id: users.id,
      email: users.email,
      firstName: users.firstName,
      lastName: users.lastName,
      role: users.role,
      status: users.status,
      verificationStatus: users.verificationStatus,
      createdAt: users.createdAt,
      lastLoginAt: users.lastLoginAt,
      organizationName: organizations.name,
      plan: subscriptions.plan,
      sessionCount: sql<number>`(
        SELECT count(*)::int FROM ${sessions}
        WHERE ${sessions.therapistId} = ${users.id} AND ${sessions.status} = 'completed'
      )`,
    })
    .from(users)
    .innerJoin(organizations, eq(organizations.id, users.organizationId))
    .leftJoin(subscriptions, eq(subscriptions.organizationId, users.organizationId))
    .where(isNull(users.deletedAt))
    .orderBy(desc(users.createdAt))
    .limit(200);
}

export async function setUserStatus(userId: string, status: "active" | "suspended") {
  await db.update(users).set({ status, updatedAt: new Date() }).where(eq(users.id, userId));
}

/**
 * An administrator's verdict on a clinician, written to both places that store it.
 *
 * `users.verification_status` is the badge on the clinician list.
 * `therapist_verifications.state` is what the onboarding gate reads. Writing
 * only the first is how a clinician came to be shown as verified in admin
 * while still locked on the onboarding page — verified everywhere except the
 * one column that decided whether they could work.
 *
 * The row is created if it does not exist. An admin verifying someone who
 * never submitted documents is a deliberate act — usually because they were
 * checked another way — and it must not silently fail because there was
 * nothing to update.
 */
export async function setVerification(
  userId: string,
  verificationStatus: "unverified" | "pending" | "verified" | "rejected",
  reviewedBy?: string,
) {
  const [user] = await db
    .select({ organizationId: users.organizationId })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  if (!user) return;

  await db
    .update(users)
    .set({ verificationStatus, updatedAt: new Date() })
    .where(eq(users.id, userId));

  const state =
    verificationStatus === "verified"
      ? "approved"
      : verificationStatus === "rejected"
        ? "rejected"
        : verificationStatus === "pending"
          ? "submitted"
          : "draft";

  await db
    .insert(therapistVerifications)
    .values({
      userId,
      organizationId: user.organizationId,
      state,
      reviewedAt: new Date(),
      reviewedBy: reviewedBy ?? null,
    })
    .onConflictDoUpdate({
      target: therapistVerifications.userId,
      set: { state, reviewedAt: new Date(), reviewedBy: reviewedBy ?? null, updatedAt: new Date() },
    });
}

/**
 * The audit trail. Deliberately does not join to patients: an administrator
 * reviewing who accessed what does not need the patient's name to do it, and
 * putting it on this screen would make the compliance tool itself a source of
 * casual PHI exposure.
 */
export async function listAuditLog(opts: { category?: string; limit?: number } = {}) {
  const base = db
    .select({
      id: auditLog.id,
      category: auditLog.category,
      action: auditLog.action,
      resourceType: auditLog.resourceType,
      resourceId: auditLog.resourceId,
      patientId: auditLog.patientId,
      createdAt: auditLog.createdAt,
      ipAddress: auditLog.ipAddress,
      actorEmail: users.email,
      organizationName: organizations.name,
    })
    .from(auditLog)
    .leftJoin(users, eq(users.id, auditLog.actorUserId))
    .leftJoin(organizations, eq(organizations.id, auditLog.organizationId))
    .orderBy(desc(auditLog.createdAt))
    .limit(opts.limit ?? 100);

  if (opts.category) {
    return base.where(eq(auditLog.category, opts.category as never));
  }
  return base;
}

/* ------------------------------------------------- one clinician, in full -- */

/**
 * The administrator's view of a single clinician.
 *
 * Where the PHI line is drawn, and why it is drawn there:
 *
 *  - **Shown:** who their patients are (name, email), when sessions happened,
 *    how long they ran, whether a note exists, how much copilot they use, and
 *    every penny in both directions. An operator has to be able to answer
 *    "this therapist says they were charged twice" and "is this account real",
 *    and cannot do either blind.
 *
 *  - **Never shown, by construction:** transcript text, note content, risk
 *    indicators, copilot messages. Not hidden behind a toggle — the queries
 *    below do not select those columns, so there is no admin screen from which
 *    a session can be read. That is the difference between a policy and a
 *    guarantee.
 *
 * Every call site writes a `break_glass` audit entry. Looking at someone's
 * caseload is a thing that should leave a mark.
 */
export async function therapistOverview(userId: string) {
  const [row] = await db
    .select({
      id: users.id,
      email: users.email,
      firstName: users.firstName,
      lastName: users.lastName,
      role: users.role,
      status: users.status,
      verificationStatus: users.verificationStatus,
      profile: users.profile,
      createdAt: users.createdAt,
      lastLoginAt: users.lastLoginAt,
      organizationId: users.organizationId,
      organizationName: organizations.name,
      stripeAccountId: users.stripeAccountId,
      chargesEnabled: users.chargesEnabled,
      payoutsEnabled: users.payoutsEnabled,
      sessionRateCents: users.sessionRateCents,
      plan: subscriptions.plan,
      subscriptionStatus: subscriptions.status,
    })
    .from(users)
    .innerJoin(organizations, eq(organizations.id, users.organizationId))
    .leftJoin(subscriptions, eq(subscriptions.organizationId, users.organizationId))
    .where(and(eq(users.id, userId), isNull(users.deletedAt)))
    .limit(1);

  return row ?? null;
}

/** Their caseload. Identifiers only — nothing clinical is selected. */
export async function therapistPatients(userId: string) {
  return db
    .select({
      id: patients.id,
      firstName: patients.firstName,
      lastName: patients.lastName,
      email: patients.email,
      phone: patients.phone,
      source: patients.source,
      createdAt: patients.createdAt,
      lastSessionAt: patients.lastSessionAt,
      sessionCount: sql<number>`(
        SELECT count(*)::int FROM ${sessions}
        WHERE ${sessions.patientId} = ${patients.id} AND ${sessions.status} = 'completed'
      )`,
      copilotMessages: sql<number>`(
        SELECT count(*)::int FROM ${copilotMessages} m
        JOIN ${copilotThreads} t ON t.id = m.thread_id
        WHERE t.patient_id = ${patients.id} AND m.role = 'therapist'
      )`,
    })
    .from(patients)
    .where(and(eq(patients.therapistId, userId), isNull(patients.deletedAt)))
    .orderBy(desc(patients.lastSessionAt), desc(patients.createdAt))
    .limit(300);
}

/**
 * Session history: when, how long, what state.
 *
 * `noteStatus` is here and note *content* is not, deliberately — an operator
 * needs to know a note failed to generate; they do not need to read it.
 */
export async function therapistSessions(userId: string, limit = 200) {
  return db
    .select({
      id: sessions.id,
      status: sessions.status,
      modality: sessions.modality,
      noteStatus: sessions.noteStatus,
      createdAt: sessions.createdAt,
      startedAt: sessions.startedAt,
      endedAt: sessions.endedAt,
      durationMinutes: sessions.durationMinutes,
      priceCents: sessions.priceCents,
      paymentStatus: sessions.paymentStatus,
      reportSentAt: sessions.reportSentAt,
      patientFirstName: patients.firstName,
      patientLastName: patients.lastName,
      guestName: sessions.guestName,
      segmentCount: sql<number>`(
        SELECT count(*)::int FROM ${transcriptSegments}
        WHERE ${transcriptSegments.sessionId} = ${sessions.id}
      )`,
    })
    .from(sessions)
    .leftJoin(patients, eq(patients.id, sessions.patientId))
    .where(eq(sessions.therapistId, userId))
    .orderBy(desc(sessions.createdAt))
    .limit(limit);
}

/** Copilot activity: volume and recency, never a single word of content. */
export async function therapistCopilotUsage(userId: string) {
  const startOfMonth = new Date();
  startOfMonth.setUTCDate(1);
  startOfMonth.setUTCHours(0, 0, 0, 0);

  const threads = await db
    .select({
      threadId: copilotThreads.id,
      patientFirstName: patients.firstName,
      patientLastName: patients.lastName,
      lastMessageAt: copilotThreads.lastMessageAt,
      asked: sql<number>`(
        SELECT count(*)::int FROM ${copilotMessages}
        WHERE ${copilotMessages.threadId} = ${copilotThreads.id}
          AND ${copilotMessages.role} = 'therapist'
      )`,
      askedThisMonth: sql<number>`(
        SELECT count(*)::int FROM ${copilotMessages}
        WHERE ${copilotMessages.threadId} = ${copilotThreads.id}
          AND ${copilotMessages.role} = 'therapist'
          AND ${copilotMessages.createdAt} >= ${startOfMonth.toISOString()}
      )`,
      corrections: sql<number>`(
        SELECT count(*)::int FROM ${copilotMessages}
        WHERE ${copilotMessages.threadId} = ${copilotThreads.id}
          AND ${copilotMessages.role} = 'correction'
      )`,
    })
    .from(copilotThreads)
    .innerJoin(patients, eq(patients.id, copilotThreads.patientId))
    .where(eq(copilotThreads.therapistId, userId))
    .orderBy(desc(copilotThreads.lastMessageAt))
    .limit(200);

  return threads;
}

/** What their AI usage has actually cost us, by purpose. */
export async function therapistAiSpend(userId: string) {
  const rows = await db
    .select({
      kind: aiRequestLogs.kind,
      calls: count(),
      costCents: sql<number>`COALESCE(SUM(${aiRequestLogs.costCents}), 0)::int`,
      errors: sql<number>`COALESCE(SUM(CASE WHEN ${aiRequestLogs.status} = 'error' THEN 1 ELSE 0 END), 0)::int`,
    })
    .from(aiRequestLogs)
    .where(eq(aiRequestLogs.userId, userId))
    .groupBy(aiRequestLogs.kind);

  return rows;
}

/** Every therapist's email, for an announcement. */
export async function allTherapistRecipients() {
  return db
    .select({
      id: users.id,
      email: users.email,
      firstName: users.firstName,
      lastName: users.lastName,
    })
    .from(users)
    .where(and(isNull(users.deletedAt), eq(users.status, "active"), eq(users.role, "therapist")))
    .orderBy(users.email);
}

export async function aiUsageByDay(days = 14) {
  return db
    .select({
      day: sql<string>`to_char(date_trunc('day', ${aiRequestLogs.createdAt}), 'YYYY-MM-DD')`,
      calls: count(),
      costCents: sql<number>`COALESCE(SUM(${aiRequestLogs.costCents}), 0)::int`,
    })
    .from(aiRequestLogs)
    .where(gte(aiRequestLogs.createdAt, new Date(Date.now() - days * 24 * 60 * 60 * 1000)))
    .groupBy(sql`date_trunc('day', ${aiRequestLogs.createdAt})`)
    .orderBy(sql`date_trunc('day', ${aiRequestLogs.createdAt}) DESC`);
}
