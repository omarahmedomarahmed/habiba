import "server-only";

import { and, desc, eq, gt, gte, isNull, sql } from "drizzle-orm";

import { db } from "@/lib/db";
import {
  aiRequestLogs,
  invoices,
  organizations,
  sessionPayments,
  sessions,
  sessionCredits,
  subscriptions,
  users,
} from "@/lib/db/schema";

/**
 * The Vault: every dollar in, every dollar out, and the margin between them.
 *
 * Two layers, deliberately. The ledger is the money — it has to reconcile
 * against Stripe on one side and the model provider on the other. The metrics
 * sit on top of the ledger and are derived from it. Building them as one thing
 * is how the number quoted to an investor stops matching the number in Stripe.
 *
 * Money in is `invoices.status = 'paid'`, net of discounts. Money out is
 * `ai_request_logs.cost_cents`, which is estimated from public model rates at
 * the time of the call — treat it as accurate to a few percent, not to the
 * cent, and reconcile against the provider's own invoice monthly.
 */

export type LedgerSummary = {
  collectedCents: number;
  outstandingCents: number;
  discountedCents: number;
  waivedCount: number;
  aiCostCents: number;
  grossMarginCents: number;
  grossMarginPct: number;
  paidInvoiceCount: number;
  /** Application fees on patient→therapist payments. Our second revenue line. */
  connectFeeCents: number;
  /** Gross patient payments processed. Not our money — a volume metric. */
  gmvCents: number;
  connectPaymentCount: number;
};

export async function ledgerSummary(sinceDays?: number): Promise<LedgerSummary> {
  const since = sinceDays ? new Date(Date.now() - sinceDays * 86_400_000) : null;

  const [money] = await db
    .select({
      collected: sql<number>`COALESCE(SUM(CASE WHEN ${invoices.status} = 'paid' THEN ${invoices.amountCents} - ${invoices.discountCents} ELSE 0 END), 0)::int`,
      outstanding: sql<number>`COALESCE(SUM(CASE WHEN ${invoices.status} = 'due' THEN ${invoices.amountCents} - ${invoices.discountCents} ELSE 0 END), 0)::int`,
      discounted: sql<number>`COALESCE(SUM(${invoices.discountCents}), 0)::int`,
      waived: sql<number>`COUNT(*) FILTER (WHERE ${invoices.status} = 'waived')::int`,
      paidCount: sql<number>`COUNT(*) FILTER (WHERE ${invoices.status} = 'paid')::int`,
    })
    .from(invoices)
    .where(since ? gte(invoices.issuedAt, since) : undefined);

  const [cost] = await db
    .select({ total: sql<number>`COALESCE(SUM(${aiRequestLogs.costCents}), 0)::int` })
    .from(aiRequestLogs)
    .where(since ? gte(aiRequestLogs.createdAt, since) : undefined);

  /*
   * Connect revenue, net of settlement.
   *
   * Part of an application fee can be a therapist's own outstanding invoice
   * riding along inside the charge. That part already becomes a paid invoice
   * and is therefore already in `collected` — adding the whole fee here would
   * count it twice, which is the specific way a revenue figure stops matching
   * Stripe.
   */
  const [connect] = await db
    .select({
      fees: sql<number>`COALESCE(SUM(${sessionPayments.platformFeeCents} - ${sessionPayments.settledInvoiceCents}), 0)::int`,
      gmv: sql<number>`COALESCE(SUM(${sessionPayments.grossCents}), 0)::int`,
      count: sql<number>`COUNT(*)::int`,
    })
    .from(sessionPayments)
    .where(
      since
        ? and(eq(sessionPayments.status, "paid"), gte(sessionPayments.paidAt, since))
        : eq(sessionPayments.status, "paid"),
    );

  const connectFeeCents = connect?.fees ?? 0;
  const collectedCents = (money?.collected ?? 0) + connectFeeCents;
  const aiCostCents = cost?.total ?? 0;
  const grossMarginCents = collectedCents - aiCostCents;

  return {
    collectedCents,
    outstandingCents: money?.outstanding ?? 0,
    discountedCents: money?.discounted ?? 0,
    waivedCount: money?.waived ?? 0,
    aiCostCents,
    grossMarginCents,
    grossMarginPct: collectedCents > 0 ? (grossMarginCents / collectedCents) * 100 : 0,
    paidInvoiceCount: money?.paidCount ?? 0,
    connectFeeCents,
    gmvCents: connect?.gmv ?? 0,
    connectPaymentCount: connect?.count ?? 0,
  };
}

/** Every invoice across every practice — the ledger itself. */
export async function allInvoices(limit = 300) {
  return db
    .select({
      id: invoices.id,
      kind: invoices.kind,
      description: invoices.description,
      amountCents: invoices.amountCents,
      discountCents: invoices.discountCents,
      discountReason: invoices.discountReason,
      status: invoices.status,
      issuedAt: invoices.issuedAt,
      paidAt: invoices.paidAt,
      organizationId: invoices.organizationId,
      organizationName: organizations.name,
    })
    .from(invoices)
    .leftJoin(organizations, eq(organizations.id, invoices.organizationId))
    .orderBy(desc(invoices.issuedAt))
    .limit(limit);
}

/** Every patient→therapist payment we facilitated, newest first. */
export async function allSessionPayments(limit = 200) {
  return db
    .select({
      id: sessionPayments.id,
      sessionId: sessionPayments.sessionId,
      payerName: sessionPayments.payerName,
      grossCents: sessionPayments.grossCents,
      platformFeeCents: sessionPayments.platformFeeCents,
      settledInvoiceCents: sessionPayments.settledInvoiceCents,
      therapistNetCents: sessionPayments.therapistNetCents,
      status: sessionPayments.status,
      createdAt: sessionPayments.createdAt,
      paidAt: sessionPayments.paidAt,
      therapistName: sql<string>`trim(${users.firstName} || ' ' || COALESCE(${users.lastName}, ''))`,
      organizationName: organizations.name,
    })
    .from(sessionPayments)
    .leftJoin(users, eq(users.id, sessionPayments.therapistId))
    .leftJoin(organizations, eq(organizations.id, sessionPayments.organizationId))
    .orderBy(desc(sessionPayments.createdAt))
    .limit(limit);
}

/** Money in and model spend, month by month. */
export async function monthlyLedger(months = 6) {
  const since = new Date();
  since.setUTCMonth(since.getUTCMonth() - months);
  since.setUTCDate(1);
  since.setUTCHours(0, 0, 0, 0);

  const revenue = await db
    .select({
      month: sql<string>`to_char(date_trunc('month', ${invoices.issuedAt}), 'YYYY-MM')`,
      collected: sql<number>`COALESCE(SUM(CASE WHEN ${invoices.status} = 'paid' THEN ${invoices.amountCents} - ${invoices.discountCents} ELSE 0 END), 0)::int`,
    })
    .from(invoices)
    .where(gte(invoices.issuedAt, since))
    .groupBy(sql`date_trunc('month', ${invoices.issuedAt})`)
    .orderBy(sql`date_trunc('month', ${invoices.issuedAt})`);

  const cost = await db
    .select({
      month: sql<string>`to_char(date_trunc('month', ${aiRequestLogs.createdAt}), 'YYYY-MM')`,
      spent: sql<number>`COALESCE(SUM(${aiRequestLogs.costCents}), 0)::int`,
    })
    .from(aiRequestLogs)
    .where(gte(aiRequestLogs.createdAt, since))
    .groupBy(sql`date_trunc('month', ${aiRequestLogs.createdAt})`)
    .orderBy(sql`date_trunc('month', ${aiRequestLogs.createdAt})`);

  const byMonth = new Map<string, { month: string; collected: number; spent: number }>();
  for (const row of revenue) {
    byMonth.set(row.month, { month: row.month, collected: row.collected, spent: 0 });
  }
  for (const row of cost) {
    const entry = byMonth.get(row.month) ?? { month: row.month, collected: 0, spent: 0 };
    entry.spent = row.spent;
    byMonth.set(row.month, entry);
  }

  return [...byMonth.values()].sort((a, b) => a.month.localeCompare(b.month));
}

/**
 * Per-clinician economics. This is the answer to "who is burning the most
 * model spend, and are they paying us more than they cost".
 */
export async function therapistEconomics() {
  return db
    .select({
      userId: users.id,
      name: sql<string>`trim(${users.firstName} || ' ' || ${users.lastName})`,
      email: users.email,
      organizationId: users.organizationId,
      organizationName: organizations.name,
      plan: subscriptions.plan,
      sessionCount: sql<number>`(
        SELECT COUNT(*)::int FROM ${sessions}
        WHERE ${sessions.therapistId} = ${users.id} AND ${sessions.status} = 'completed'
      )`,
      aiCostCents: sql<number>`(
        SELECT COALESCE(SUM(${aiRequestLogs.costCents}), 0)::int FROM ${aiRequestLogs}
        WHERE ${aiRequestLogs.userId} = ${users.id}
      )`,
      aiCalls: sql<number>`(
        SELECT COUNT(*)::int FROM ${aiRequestLogs}
        WHERE ${aiRequestLogs.userId} = ${users.id}
      )`,
      revenueCents: sql<number>`(
        SELECT COALESCE(SUM(${invoices.amountCents} - ${invoices.discountCents}), 0)::int
        FROM ${invoices}
        WHERE ${invoices.organizationId} = ${users.organizationId}
          AND ${invoices.status} = 'paid'
      )`,
    })
    .from(users)
    .leftJoin(organizations, eq(organizations.id, users.organizationId))
    .leftJoin(subscriptions, eq(subscriptions.organizationId, users.organizationId))
    .where(and(isNull(users.deletedAt), eq(users.role, "therapist")))
    .orderBy(desc(sql`(
      SELECT COALESCE(SUM(${aiRequestLogs.costCents}), 0) FROM ${aiRequestLogs}
      WHERE ${aiRequestLogs.userId} = ${users.id}
    )`))
    .limit(100);
}

export type Traction = {
  signups: number;
  activated: number;
  activationPct: number;
  activeLast7: number;
  activeLast30: number;
  sessionsLast7: number;
  sessionsLast30: number;
  payingOrgs: number;
  mrrCents: number;
  arpuCents: number;
  costPerSessionCents: number;
  revenuePerSessionCents: number;
};

/**
 * Product traction and unit economics.
 *
 * "Activated" means a clinician who completed at least one session, not one who
 * signed up. A signup that never records a session has told us nothing.
 */
export async function tractionMetrics(): Promise<Traction> {
  const day7 = new Date(Date.now() - 7 * 86_400_000);
  const day30 = new Date(Date.now() - 30 * 86_400_000);

  const [people] = await db
    .select({
      signups: sql<number>`COUNT(*)::int`,
      activated: sql<number>`COUNT(*) FILTER (WHERE EXISTS (
        SELECT 1 FROM ${sessions} s
        WHERE s.therapist_id = ${users.id} AND s.status = 'completed'
      ))::int`,
      active7: sql<number>`COUNT(*) FILTER (WHERE EXISTS (
        SELECT 1 FROM ${sessions} s
        WHERE s.therapist_id = ${users.id} AND s.status = 'completed' AND s.ended_at >= ${day7}
      ))::int`,
      active30: sql<number>`COUNT(*) FILTER (WHERE EXISTS (
        SELECT 1 FROM ${sessions} s
        WHERE s.therapist_id = ${users.id} AND s.status = 'completed' AND s.ended_at >= ${day30}
      ))::int`,
    })
    .from(users)
    .where(and(isNull(users.deletedAt), eq(users.role, "therapist")));

  const [volume] = await db
    .select({
      last7: sql<number>`COUNT(*) FILTER (WHERE ${sessions.endedAt} >= ${day7})::int`,
      last30: sql<number>`COUNT(*) FILTER (WHERE ${sessions.endedAt} >= ${day30})::int`,
    })
    .from(sessions)
    .where(eq(sessions.status, "completed"));

  /*
   * "Paying customers" used to mean "on the unlimited plan", which no longer
   * exists. It now means an organisation holding unspent, unexpired credits —
   * somebody who has actually given us money and has not yet used it up. That
   * is a closer answer to the question this figure was always being asked for.
   */
  const [subs] = await db
    .select({ paying: sql<number>`COUNT(DISTINCT ${sessionCredits.organizationId})::int` })
    .from(sessionCredits)
    .where(
      and(
        eq(sessionCredits.status, "active"),
        gt(sessionCredits.expiresAt, new Date()),
        gt(sessionCredits.quantity, sessionCredits.consumed),
      ),
    );

  const [revenue30] = await db
    .select({
      collected: sql<number>`COALESCE(SUM(CASE WHEN ${invoices.status} = 'paid' THEN ${invoices.amountCents} - ${invoices.discountCents} ELSE 0 END), 0)::int`,
    })
    .from(invoices)
    .where(gte(invoices.issuedAt, day30));

  const [cost30] = await db
    .select({ spent: sql<number>`COALESCE(SUM(${aiRequestLogs.costCents}), 0)::int` })
    .from(aiRequestLogs)
    .where(gte(aiRequestLogs.createdAt, day30));

  const signups = people?.signups ?? 0;
  const activated = people?.activated ?? 0;
  const payingOrgs = subs?.paying ?? 0;
  const sessions30 = volume?.last30 ?? 0;
  const collected30 = revenue30?.collected ?? 0;
  const spent30 = cost30?.spent ?? 0;

  // MRR counts only recurring subscriptions. Metered revenue is real but is not
  // recurring, and folding it in is how a run-rate becomes fiction.
  const mrrCents = payingOrgs * 9900;

  return {
    signups,
    activated,
    activationPct: signups > 0 ? (activated / signups) * 100 : 0,
    activeLast7: people?.active7 ?? 0,
    activeLast30: people?.active30 ?? 0,
    sessionsLast7: volume?.last7 ?? 0,
    sessionsLast30: sessions30,
    payingOrgs,
    mrrCents,
    arpuCents: activated > 0 ? Math.round(collected30 / activated) : 0,
    costPerSessionCents: sessions30 > 0 ? Math.round(spent30 / sessions30) : 0,
    revenuePerSessionCents: sessions30 > 0 ? Math.round(collected30 / sessions30) : 0,
  };
}

/** Model spend split by what it was spent on. */
export async function costByKind(days = 30) {
  return db
    .select({
      kind: aiRequestLogs.kind,
      calls: sql<number>`COUNT(*)::int`,
      costCents: sql<number>`COALESCE(SUM(${aiRequestLogs.costCents}), 0)::int`,
      errors: sql<number>`COUNT(*) FILTER (WHERE ${aiRequestLogs.status} = 'error')::int`,
    })
    .from(aiRequestLogs)
    .where(gte(aiRequestLogs.createdAt, new Date(Date.now() - days * 86_400_000)))
    .groupBy(aiRequestLogs.kind)
    .orderBy(desc(sql`COALESCE(SUM(${aiRequestLogs.costCents}), 0)`));
}
