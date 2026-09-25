/*
 * 🔴 30.1 — the CONTROL PLANE: the spend vault is platform accounting.
 */
import "server-only";

import { and, desc, eq, gt, gte, isNull, sql } from "drizzle-orm";

import { controlDb as db} from "@/lib/db";
import { qualified } from "@/lib/db/qualified";
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
 * 🔴 MRR FROM WHAT IS ACTUALLY RECURRING, AT TODAY'S PRICES.
 *
 * This was `payingOrgs * 9900`: every organisation holding prepaid credit,
 * priced at a plan that no longer costs $99, which is two wrong numbers
 * multiplied. It is now each organisation on a plan right now, once, at its
 * tier's monthly price from settings: a paid month covering today (either
 * rail), else a Stripe subscription still running. A retired plan key counts
 * nothing, the same rule `entitledTier` applies.
 */
async function recurringMonthlyCents(now = new Date()): Promise<number> {
  const { getSettings } = await import("@/lib/settings");
  const { renewalObligations } = await import("@/lib/db/schema");
  const tiers = (await getSettings()).pricing.tiers;
  const onPlan = new Map<string, string>();

  const months = await db
    .select({ organizationId: renewalObligations.organizationId, plan: renewalObligations.plan })
    .from(renewalObligations)
    .where(
      and(
        eq(renewalObligations.state, "paid"),
        sql`${renewalObligations.periodStart} <= ${now}`,
        sql`${renewalObligations.periodEnd} > ${now}`,
      ),
    );
  for (const month of months) onPlan.set(month.organizationId, month.plan);

  const mirrored = await db
    .select({ organizationId: subscriptions.organizationId, plan: subscriptions.plan })
    .from(subscriptions)
    .where(
      and(
        sql`${subscriptions.status} IN ('active', 'past_due')`,
        sql`(${subscriptions.currentPeriodEnd} IS NULL OR ${subscriptions.currentPeriodEnd} > ${now})`,
      ),
    );
  for (const sub of mirrored) if (!onPlan.has(sub.organizationId)) onPlan.set(sub.organizationId, sub.plan);

  let cents = 0;
  for (const plan of onPlan.values()) {
    cents += tiers.find((t) => t.key === plan && t.monthlyCents > 0)?.monthlyCents ?? 0;
  }
  return cents;
}

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
    .select({
      total: sql<number>`ROUND(COALESCE(SUM(${aiRequestLogs.costMicrocents}), 0) / 1000.0)::int`,
    })
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

/**
 * Every patient→therapist payment we facilitated, newest first.
 *
 * ## 🔴 C243 / C244 — `payerName` is NOT selected, and this was the last reader
 *
 * It was, until sprint 53. Sprint 46 removed `payerName` from every
 * therapist-facing read under C243, and this one survived because C243 was
 * scoped to therapist surfaces and an admin vault page is not one. C244 closes
 * the rest: *no screen in this product, the admin console included, may join a
 * sponsor to a session, a booking, a date or a patient name.*
 *
 * A pot payment has no cardholder. So from the day sponsors exist, either the
 * sponsor's name lands in that column — putting sponsor, session and date on
 * one admin screen, which is the whole leak — or it is null and an operator
 * sorts one column to find every sponsored session. Both are the thing C244
 * forbids, and the second is the version that looks like nothing is wrong.
 *
 * 🔴 Removing it costs an operator nothing they need. Reconciling a payment is
 * keyed on `sessionId` and the amounts; the payer's NAME was never part of
 * that, it was there because it was available.
 */
export async function allSessionPayments(limit = 200) {
  return db
    .select({
      id: sessionPayments.id,
      sessionId: sessionPayments.sessionId,
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

/**
 * Money in and model spend, month by month.
 *
 * 🔴 C349 — THE SAME SCREEN REPORTED TWO DIFFERENT REVENUES AND NEITHER WAS
 * LABELLED AS PARTIAL.
 *
 * `ledgerSummary` has counted revenue as invoices **plus** the application fees
 * on patient payments since the Connect rail existed, and says so in its own
 * comment: the fee on a card charge is our second revenue line. This function
 * summed invoices alone. So the card at the top of `/admin/vault` and the bars
 * below it were computed from different definitions of the word income, and on
 * a month whose revenue is mostly session fees the chart reads near zero while
 * the card reads correctly.
 *
 * It is the exact failure the deprecated `cost_cents` column carries a fifty
 * line warning about, one table across: two screens, one question, two answers,
 * and no way to tell from either which one is short.
 *
 * Both lines now, per month, and the split is returned rather than folded, so a
 * reader can see whether a month was carried by subscriptions or by sessions.
 * `collected` stays the total, so every existing caller keeps its meaning and
 * gains the missing half.
 *
 * Settled invoice cents are netted off exactly as `ledgerSummary` nets them,
 * for the same reason: a therapist's own outstanding bill can ride along inside
 * an application fee, and it is already a paid invoice on the other line.
 */
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

  const fees = await db
    .select({
      month: sql<string>`to_char(date_trunc('month', ${sessionPayments.paidAt}), 'YYYY-MM')`,
      fees: sql<number>`COALESCE(SUM(${sessionPayments.platformFeeCents} - ${sessionPayments.settledInvoiceCents}), 0)::int`,
    })
    .from(sessionPayments)
    .where(and(eq(sessionPayments.status, "paid"), gte(sessionPayments.paidAt, since)))
    .groupBy(sql`date_trunc('month', ${sessionPayments.paidAt})`)
    .orderBy(sql`date_trunc('month', ${sessionPayments.paidAt})`);

  const cost = await db
    .select({
      month: sql<string>`to_char(date_trunc('month', ${aiRequestLogs.createdAt}), 'YYYY-MM')`,
      spent: sql<number>`ROUND(COALESCE(SUM(${aiRequestLogs.costMicrocents}), 0) / 1000.0)::int`,
    })
    .from(aiRequestLogs)
    .where(gte(aiRequestLogs.createdAt, since))
    .groupBy(sql`date_trunc('month', ${aiRequestLogs.createdAt})`)
    .orderBy(sql`date_trunc('month', ${aiRequestLogs.createdAt})`);

  type Row = {
    month: string;
    /** Subscriptions and seats. Bills we raised and somebody paid. */
    invoiceCents: number;
    /** Our cut of what a patient paid a therapist, net of any bill it settled. */
    sessionFeeCents: number;
    /** The two above. What the summary card at the top of the page calls income. */
    collected: number;
    /** What the models cost us to earn it. */
    spent: number;
  };

  const byMonth = new Map<string, Row>();
  const at = (month: string): Row => {
    const existing = byMonth.get(month);
    if (existing) return existing;
    const fresh: Row = { month, invoiceCents: 0, sessionFeeCents: 0, collected: 0, spent: 0 };
    byMonth.set(month, fresh);
    return fresh;
  };

  for (const row of revenue) at(row.month).invoiceCents = row.collected;
  for (const row of fees) at(row.month).sessionFeeCents = row.fees;
  for (const row of cost) at(row.month).spent = row.spent;

  for (const row of byMonth.values()) row.collected = row.invoiceCents + row.sessionFeeCents;

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
        WHERE ${sessions.therapistId} = ${qualified(users.id)} AND ${sessions.status} = 'completed'
      )`,
      aiCostCents: sql<number>`(
        SELECT ROUND(COALESCE(SUM(${aiRequestLogs.costMicrocents}), 0) / 1000.0)::int
        FROM ${aiRequestLogs} WHERE ${aiRequestLogs.userId} = ${qualified(users.id)}
      )`,
      aiCalls: sql<number>`(
        SELECT COUNT(*)::int FROM ${aiRequestLogs}
        WHERE ${aiRequestLogs.userId} = ${qualified(users.id)}
      )`,
      revenueCents: sql<number>`(
        SELECT COALESCE(SUM(${invoices.amountCents} - ${invoices.discountCents}), 0)::int
        FROM ${invoices}
        WHERE ${invoices.organizationId} = ${qualified(users.organizationId)}
          AND ${invoices.status} = 'paid'
      )`,
    })
    .from(users)
    .leftJoin(organizations, eq(organizations.id, users.organizationId))
    .leftJoin(subscriptions, eq(subscriptions.organizationId, users.organizationId))
    .where(and(isNull(users.deletedAt), eq(users.role, "therapist")))
    .orderBy(desc(sql`(
      SELECT COALESCE(SUM(${aiRequestLogs.costMicrocents}), 0) FROM ${aiRequestLogs}
      WHERE ${aiRequestLogs.userId} = ${qualified(users.id)}
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
  /**
   * 🔴 20.6 — margin per session, from real usage rather than from the price
   * list.
   *
   * Revenue per session minus what the models actually cost to produce it, in
   * cents, over the last 30 days — and the percentage that is of revenue. The
   * figure that matters is not "what do we charge" but "what is left after
   * transcribing an hour of speech and writing a note about it", and the only
   * honest source for the second half is `ai_request_logs`.
   *
   * `marginBps` is null when nothing was collected: a margin on zero revenue
   * is a division by zero dressed up as a percentage, and 0% would read as
   * "we make nothing" rather than "there is nothing to measure yet" — the
   * same refusal 14.7 makes about a reliability score below five sessions.
   */
  marginPerSessionCents: number;
  marginBps: number | null;
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

  /*
   * 🔴 W2-Q01: qualified(). This select has no join, so a bare `${users.id}`
   * rendered as "id" and bound to the session's own id (`s.therapist_id = s.id`):
   * activated, active in 7 and 30 days, the activation rate and ARPU all read 0.
   */
  const [people] = await db
    .select({
      signups: sql<number>`COUNT(*)::int`,
      activated: sql<number>`COUNT(*) FILTER (WHERE EXISTS (
        SELECT 1 FROM ${sessions} s
        WHERE s.therapist_id = ${qualified(users.id)} AND s.status = 'completed'
      ))::int`,
      active7: sql<number>`COUNT(*) FILTER (WHERE EXISTS (
        SELECT 1 FROM ${sessions} s
        WHERE s.therapist_id = ${qualified(users.id)} AND s.status = 'completed' AND s.ended_at >= ${day7}
      ))::int`,
      active30: sql<number>`COUNT(*) FILTER (WHERE EXISTS (
        SELECT 1 FROM ${sessions} s
        WHERE s.therapist_id = ${qualified(users.id)} AND s.status = 'completed' AND s.ended_at >= ${day30}
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
    .select({
      spent: sql<number>`ROUND(COALESCE(SUM(${aiRequestLogs.costMicrocents}), 0) / 1000.0)::int`,
    })
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
  const mrrCents = await recurringMonthlyCents();

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
    marginPerSessionCents:
      sessions30 > 0 ? Math.round((collected30 - spent30) / sessions30) : 0,
    marginBps: collected30 > 0 ? Math.round(((collected30 - spent30) / collected30) * 10_000) : null,
  };
}

/**
 * Model spend split by what it was spent on.
 *
 * 🔴 C17, ruled in sprint 18: every cost figure in this file now sums
 * `cost_microcents` and divides **once**, at the end. It used to sum
 * `cost_cents`, which `lib/ai/client.ts` writes as `round(microcents / 1000)`
 * — so 466 of production's 596 model calls were stored as **zero** while the
 * handful of expensive ones rounded up, and the sum overstated real spend by
 * 8.59¢ on 209.41¢, about 4%. Small money, systematic error, and it made two
 * admin screens disagree: the usage page already read microcents.
 */
export async function costByKind(days = 30) {
  return db
    .select({
      kind: aiRequestLogs.kind,
      calls: sql<number>`COUNT(*)::int`,
      costCents: sql<number>`ROUND(COALESCE(SUM(${aiRequestLogs.costMicrocents}), 0) / 1000.0)::int`,
      errors: sql<number>`COUNT(*) FILTER (WHERE ${aiRequestLogs.status} = 'error')::int`,
    })
    .from(aiRequestLogs)
    .where(gte(aiRequestLogs.createdAt, new Date(Date.now() - days * 86_400_000)))
    .groupBy(aiRequestLogs.kind)
    .orderBy(desc(sql`COALESCE(SUM(${aiRequestLogs.costMicrocents}), 0)`));
}
