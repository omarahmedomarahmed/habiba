import "server-only";

import { and, asc, desc, eq, isNull, lte, sql } from "drizzle-orm";

import { controlDb } from "@/lib/db";
import { qualified } from "@/lib/db/qualified";
import {
  invoices,
  renewalObligations,
  type RenewalRail,
  type RenewalState,
} from "@/lib/db/schema";
import { log, ref } from "@/lib/logger";

/**
 * The renewal obligation. PLAN.md 59.13 to 59.17, C294, C310, C341.
 *
 * ## 🔴 WHAT THIS TABLE IS FOR, IN ONE SENTENCE
 *
 * A subscription is a thing WE own, and a gateway is one way to settle it.
 *
 * `subscriptions` is a mirror of a Stripe object and `entitledTier` used to
 * read it, so entitlement was a Stripe status one table removed. A webhook that
 * never arrives leaves the mirror saying whatever it said last, and a period
 * end in the past reads as "not entitled" — so a clinician who paid could lose
 * their plan because our endpoint was down for an hour, mid-session, with
 * nothing on any screen saying why.
 *
 * C294 ruled in sprint 57 that entitlement is the period paid for rather than a
 * gateway status. That ruling was true of a function and false of the data
 * under it. This is the data.
 *
 * ## 🔴 AND IT IS WHY EGYPT NEEDS NO SECOND BILLING MODEL
 *
 * There is no Stripe in Egypt. An Egyptian renewal is an invoice and a payment
 * link through the Egyptian gateway, and if the only shape a subscription had
 * were Stripe's, sprint 64 would have to build a parallel one. C226 refused
 * exactly that once already, for the corporate pot: *a payment method, not a
 * billing system.* An EGP renewal settles the same obligation through a
 * different `settled_via`.
 */

/** How long before a due date we start reminding. Each entry is one message. */
export const DUNNING_DAYS_BEFORE = [7, 3, 1] as const;

/**
 * 🔴 Raise the obligation for a period. Idempotent by construction.
 *
 * `renewal_obligations_period_unique` refuses a second live row for the same
 * organisation and period, so two callers racing — a webhook and a cron, the
 * usual pair — produce one obligation rather than a double charge somebody
 * finds in a reconciliation three weeks later.
 *
 * 🔴 `onConflictDoNothing` rather than an upsert. An obligation that already
 * exists may have been PAID since, and an upsert would quietly reset it to
 * `due` and re-bill somebody who has already paid.
 */
export async function raiseObligation(input: {
  organizationId: string;
  plan: string;
  amountCents: number;
  currency: "usd" | "egp";
  periodStart: Date;
  periodEnd: Date;
  dueAt: Date;
}): Promise<{ id: string | null }> {
  const [created] = await controlDb
    .insert(renewalObligations)
    .values({
      organizationId: input.organizationId,
      plan: input.plan,
      amountCents: Math.max(0, Math.round(input.amountCents)),
      currency: input.currency,
      periodStart: input.periodStart,
      periodEnd: input.periodEnd,
      dueAt: input.dueAt,
      state: "due",
    })
    .onConflictDoNothing()
    .returning({ id: renewalObligations.id });

  return { id: created?.id ?? null };
}

/**
 * 🔴 Settle it, and the settlement names its rail.
 *
 * Guarded on `state = 'due'` in the WHERE clause rather than checked first: a
 * webhook delivered twice, which every gateway does, must not move a paid
 * obligation twice or overwrite the rail that actually settled it.
 */
export async function settleObligation(input: {
  organizationId: string;
  periodStart: Date;
  via: RenewalRail;
  ref: string;
  paidAt?: Date;
}): Promise<{ settled: boolean }> {
  const [row] = await controlDb
    .update(renewalObligations)
    .set({
      state: "paid",
      paidAt: input.paidAt ?? new Date(),
      settledVia: input.via,
      settledRef: input.ref,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(renewalObligations.organizationId, input.organizationId),
        eq(renewalObligations.periodStart, input.periodStart),
        eq(renewalObligations.state, "due"),
      ),
    )
    .returning({ id: renewalObligations.id });

  if (row) log.info("renewal obligation settled", { obligation: ref(row.id), via: input.via });
  return { settled: Boolean(row) };
}

/**
 * 🔴 59.14 — the obligation `entitledTier` reads: the one covering NOW.
 *
 * Ordered by `period_end` descending and limited to one, so an organisation
 * that has paid ahead gets the furthest-reaching row rather than whichever the
 * planner happened to return first. A `void` row is excluded here rather than
 * in the caller, because a caller that forgets grants a plan somebody cancelled.
 *
 * ## 🔴 74.3 — AND A PAID ROW BEATS A DUE ONE, WHATEVER THE DATES SAY
 *
 * ⚠️ Found by running the transfer rail rather than by reading it. `period_end
 * DESC` alone means the FURTHEST-REACHING row wins, and `entitledTier` grants
 * only on `paid` — so a due obligation that overlaps a paid one takes the
 * single slot and hands back "nothing is entitled here".
 *
 * On the Stripe rail that could not happen: obligations are raised and settled
 * in the same breath, so a due row barely exists. The transfer rail raises the
 * bill first and waits for a person, which is the whole design — and that put a
 * live due row beside a paid one for the first time. A therapist who had paid
 * for this month lost their plan the moment next month's bill was raised.
 *
 * So the sort asks "is this paid" before it asks "how far does it reach". The
 * dates still break the tie between two paid rows, which is what they were for.
 */
export async function obligationCovering(
  organizationId: string,
  now: Date,
): Promise<{
  plan: string;
  state: RenewalState;
  periodStart: Date;
  periodEnd: Date;
} | null> {
  const [row] = await controlDb
    .select({
      plan: renewalObligations.plan,
      state: renewalObligations.state,
      periodStart: renewalObligations.periodStart,
      periodEnd: renewalObligations.periodEnd,
    })
    .from(renewalObligations)
    .where(
      and(
        eq(renewalObligations.organizationId, organizationId),
        sql`${renewalObligations.periodStart} <= ${now}`,
        sql`${renewalObligations.periodEnd} > ${now}`,
        sql`${renewalObligations.state} <> 'void'`,
      ),
    )
    .orderBy(
      sql`(${renewalObligations.state} = 'paid') DESC`,
      desc(renewalObligations.periodEnd),
    )
    .limit(1);

  return row ?? null;
}

/**
 * 🔴 59.16 — WHAT IS DUE AND UNPAID, for the dunning sweep.
 *
 * Sprint 57 named the absence of dunning as a gap and shipped without it, so a
 * renewal that failed produced silence followed by a plan ending. A person
 * losing a plan they meant to keep, because a card expired and nobody said so,
 * is the most avoidable churn there is.
 */
export async function obligationsDueWithin(days: number): Promise<
  {
    id: string;
    organizationId: string;
    plan: string;
    amountCents: number;
    currency: string;
    dueAt: Date;
  }[]
> {
  const horizon = new Date(Date.now() + days * 24 * 60 * 60 * 1000);

  return controlDb
    .select({
      id: renewalObligations.id,
      organizationId: renewalObligations.organizationId,
      plan: renewalObligations.plan,
      amountCents: renewalObligations.amountCents,
      currency: renewalObligations.currency,
      dueAt: renewalObligations.dueAt,
    })
    .from(renewalObligations)
    .where(and(eq(renewalObligations.state, "due"), lte(renewalObligations.dueAt, horizon)))
    .orderBy(asc(renewalObligations.dueAt));
}

/**
 * 🔴 A due date that passed unpaid becomes `lapsed`, and that is the moment the
 * plan ends rather than the moment a gateway says so.
 *
 * Run from the billing cron. One statement, guarded on `due`, so running it
 * twice in the same minute lapses nothing twice.
 */
export async function lapseOverdue(now = new Date()): Promise<{ lapsed: number }> {
  const rows = await controlDb
    .update(renewalObligations)
    .set({ state: "lapsed", updatedAt: new Date() })
    .where(and(eq(renewalObligations.state, "due"), lte(renewalObligations.dueAt, now)))
    .returning({ id: renewalObligations.id });

  if (rows.length > 0) log.warn("renewal obligations lapsed", { count: rows.length });
  return { lapsed: rows.length };
}

/**
 * 🔴 59.15 — THE RECONCILER, AND IT LOOKS BOTH WAYS.
 *
 * The shape 46.14 already uses per line kind, applied to renewals. Two
 * questions, and only asking one of them is how a discrepancy survives:
 *
 *   - **An obligation paid with no transaction behind it.** Somebody marked it
 *     settled by hand, or an adapter wrote the state and not the reference.
 *     This is money we believe we have and may not.
 *   - **A paid gateway transaction with no obligation.** A renewal invoice was
 *     paid and nothing recorded what it bought, so the payer is entitled to a
 *     period the product does not know about. This is the direction that
 *     produces a support ticket rather than a variance.
 *
 * 🔴 It returns rows rather than logging them, because a reconciliation nobody
 * reads is C232's lesson from the sponsor pot: a discrepancy belongs on a
 * screen an operator opens, not in a log nobody tails.
 */
export async function reconcileRenewals(): Promise<{
  paidWithNoReference: { id: string; organizationId: string; periodStart: Date }[];
  invoicesWithNoObligation: { id: string; organizationId: string; amountCents: number }[];
}> {
  const paidWithNoReference = await controlDb
    .select({
      id: renewalObligations.id,
      organizationId: renewalObligations.organizationId,
      periodStart: renewalObligations.periodStart,
    })
    .from(renewalObligations)
    .where(and(eq(renewalObligations.state, "paid"), isNull(renewalObligations.settledRef)));

  /*
   * The other direction: a paid subscription invoice with no obligation row
   * naming it. `invoices.kind` already separates a renewal from a session bill,
   * so this asks only about the ones that should have bought a period.
   */
  const invoicesWithNoObligation = await controlDb
    .select({
      id: invoices.id,
      organizationId: invoices.organizationId,
      amountCents: invoices.amountCents,
    })
    .from(invoices)
    .where(
      and(
        eq(invoices.kind, "subscription"),
        eq(invoices.status, "paid"),
        sql`NOT EXISTS (
          SELECT 1 FROM ${renewalObligations} o
           WHERE o.settled_ref = ${qualified(invoices.id)}::text
        )`,
      ),
    )
    .limit(200);

  return { paidWithNoReference, invoicesWithNoObligation };
}
