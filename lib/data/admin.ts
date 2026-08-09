import "server-only";

import { and, count, desc, eq, gte, isNull, sql } from "drizzle-orm";

import { db } from "@/lib/db";
import {
  aiRequestLogs,
  auditLog,
  organizations,
  patients,
  invoices,
  sessions,
  subscriptions,
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

export async function setVerification(
  userId: string,
  verificationStatus: "unverified" | "pending" | "verified" | "rejected",
) {
  await db
    .update(users)
    .set({ verificationStatus, updatedAt: new Date() })
    .where(eq(users.id, userId));
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
