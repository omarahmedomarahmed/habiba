import "server-only";

import { and, desc, eq, inArray, sql } from "drizzle-orm";

import { db } from "@/lib/db";
import { invoices, payableCents, sessionPayments, sessions, users } from "@/lib/db/schema";
import { env } from "@/lib/env";
import { log, ref, safeErrorMessage } from "@/lib/logger";
import { getStripe } from "./stripe";

/**
 * Therapist earnings on Stripe Connect Express.
 *
 * The shape of the deal, stated once so it does not have to be re-derived from
 * the code: a patient pays for a session, the money is a *destination charge*
 * into the therapist's own connected account, and 24Therapy takes an
 * application fee. We never hold their balance and we never move it — Stripe
 * does the KYC, the payout schedule, the 1099s and the negative-balance
 * liability. The alternative (credit a number in our database, pay it out by
 * bank transfer later) is money transmission, and it is a licensing problem
 * long before it is an engineering one.
 */

/** Our cut of a patient payment, in basis points. 10%. */
export const PLATFORM_FEE_BPS = 1000;

/** Below this, Stripe's own processing fee eats the whole charge. */
export const MIN_SESSION_PRICE_CENTS = 500;
export const MAX_SESSION_PRICE_CENTS = 100_000;

/**
 * The platform cut. Rounded down so the therapist is never short a cent, and
 * exported because the number is shown to the therapist before they set a price
 * — a fee they discover on the statement is a fee they resent.
 */
export function platformFee(grossCents: number): number {
  return Math.floor((Math.max(0, grossCents) * PLATFORM_FEE_BPS) / 10_000);
}

/** What reaches the therapist, before any invoice settlement. */
export function therapistNet(grossCents: number): number {
  return Math.max(0, grossCents - platformFee(grossCents));
}

export function priceProblem(cents: number): string | null {
  if (!Number.isFinite(cents) || !Number.isInteger(cents)) return "Enter a whole dollar amount.";
  if (cents === 0) return null; // Free sessions are allowed and are the default.
  if (cents < MIN_SESSION_PRICE_CENTS) {
    return `The lowest chargeable price is $${MIN_SESSION_PRICE_CENTS / 100}.`;
  }
  if (cents > MAX_SESSION_PRICE_CENTS) return "That price is higher than we can process.";
  return null;
}

export type ConnectAccount = {
  accountId: string | null;
  chargesEnabled: boolean;
  payoutsEnabled: boolean;
  sessionRateCents: number;
  autoSettleFromEarnings: boolean;
};

export async function getConnectAccount(userId: string): Promise<ConnectAccount> {
  const [row] = await db
    .select({
      accountId: users.stripeAccountId,
      chargesEnabled: users.chargesEnabled,
      payoutsEnabled: users.payoutsEnabled,
      sessionRateCents: users.sessionRateCents,
      autoSettleFromEarnings: users.autoSettleFromEarnings,
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  return (
    row ?? {
      accountId: null,
      chargesEnabled: false,
      payoutsEnabled: false,
      sessionRateCents: 0,
      autoSettleFromEarnings: true,
    }
  );
}

/**
 * Create the connected account if it does not exist, then return a fresh
 * onboarding link.
 *
 * Account links expire in minutes and are single-use by design, so this is
 * called every time the therapist presses the button rather than a URL we
 * store. `return_url` deliberately does not trust the redirect: coming back
 * proves the therapist finished the *form*, not that Stripe approved them, so
 * the return path re-reads the account rather than flipping a flag.
 */
export async function startOnboarding(opts: {
  userId: string;
  email: string;
  organizationId: string;
}): Promise<{ url?: string; error?: string }> {
  const client = getStripe();
  if (!client) return { error: "Payments are not configured on this deployment." };

  const existing = await getConnectAccount(opts.userId);
  let accountId = existing.accountId;

  try {
    if (!accountId) {
      const account = await client.accounts.create({
        type: "express",
        email: opts.email,
        business_type: "individual",
        capabilities: {
          transfers: { requested: true },
          card_payments: { requested: true },
        },
        metadata: { userId: opts.userId, organizationId: opts.organizationId },
        settings: {
          payouts: { schedule: { interval: "daily", delay_days: "minimum" } },
        },
      });
      accountId = account.id;

      await db
        .update(users)
        .set({ stripeAccountId: accountId, updatedAt: new Date() })
        .where(eq(users.id, opts.userId));
    }

    const link = await client.accountLinks.create({
      account: accountId,
      type: "account_onboarding",
      refresh_url: `${env.appUrl}/settings?payouts=refresh`,
      return_url: `${env.appUrl}/settings?payouts=return`,
    });

    return { url: link.url };
  } catch (error) {
    log.error("connect onboarding failed", {
      user: ref(opts.userId),
      reason: safeErrorMessage(error),
    });
    return { error: "Stripe could not start onboarding just now. Try again in a moment." };
  }
}

/**
 * Re-read the connected account and mirror its capabilities locally.
 *
 * The webhook (`account.updated`) is the primary path; this exists because a
 * therapist who has just finished onboarding is looking at the page *now*, and
 * webhooks do not reach preview deployments at all.
 */
export async function refreshAccountStatus(userId: string): Promise<ConnectAccount> {
  const client = getStripe();
  const current = await getConnectAccount(userId);
  if (!client || !current.accountId) return current;

  try {
    const account = await client.accounts.retrieve(current.accountId);
    const next = {
      chargesEnabled: Boolean(account.charges_enabled),
      payoutsEnabled: Boolean(account.payouts_enabled),
    };

    if (
      next.chargesEnabled !== current.chargesEnabled ||
      next.payoutsEnabled !== current.payoutsEnabled
    ) {
      await db
        .update(users)
        .set({ ...next, updatedAt: new Date() })
        .where(eq(users.id, userId));
    }

    return { ...current, ...next };
  } catch (error) {
    log.warn("connect account refresh failed", { reason: safeErrorMessage(error) });
    return current;
  }
}

/** Mirror capability changes pushed by Stripe. Called from the webhook. */
export async function syncAccountFromStripe(account: {
  id: string;
  charges_enabled?: boolean;
  payouts_enabled?: boolean;
}): Promise<void> {
  await db
    .update(users)
    .set({
      chargesEnabled: Boolean(account.charges_enabled),
      payoutsEnabled: Boolean(account.payouts_enabled),
      updatedAt: new Date(),
    })
    .where(eq(users.stripeAccountId, account.id));
}

/** A one-time link into the therapist's own Express dashboard. */
export async function dashboardLink(userId: string): Promise<{ url?: string; error?: string }> {
  const client = getStripe();
  const account = await getConnectAccount(userId);
  if (!client || !account.accountId) return { error: "Set up payouts first." };

  try {
    const link = await client.accounts.createLoginLink(account.accountId);
    return { url: link.url };
  } catch (error) {
    log.warn("connect dashboard link failed", { reason: safeErrorMessage(error) });
    return { error: "Stripe could not open your dashboard just now." };
  }
}

export type Balance = { availableCents: number; pendingCents: number; currency: string };

/**
 * The therapist's Stripe balance — the real one, read live.
 *
 * Not a number we maintain. A cached balance that drifts from Stripe's is worse
 * than no balance at all, because it is the figure someone plans their rent
 * around.
 */
export async function accountBalance(userId: string): Promise<Balance | null> {
  const client = getStripe();
  const account = await getConnectAccount(userId);
  if (!client || !account.accountId || !account.payoutsEnabled) return null;

  try {
    const balance = await client.balance.retrieve({}, { stripeAccount: account.accountId });
    const sum = (rows: { amount: number; currency: string }[]) =>
      rows.filter((r) => r.currency === "usd").reduce((total, r) => total + r.amount, 0);

    return {
      availableCents: sum(balance.available),
      pendingCents: sum(balance.pending),
      currency: "usd",
    };
  } catch (error) {
    log.warn("connect balance read failed", { reason: safeErrorMessage(error) });
    return null;
  }
}

/**
 * Pay out the available balance now.
 *
 * Accounts are on a daily automatic schedule, so this is a "don't wait" button
 * rather than the only way money moves. If a therapist never presses it they
 * still get paid.
 */
export async function requestPayout(userId: string): Promise<{ ok?: boolean; error?: string }> {
  const client = getStripe();
  const account = await getConnectAccount(userId);
  if (!client || !account.accountId) return { error: "Set up payouts first." };
  if (!account.payoutsEnabled) return { error: "Stripe has not finished verifying your account." };

  const balance = await accountBalance(userId);
  if (!balance || balance.availableCents <= 0) {
    return { error: "There is nothing available to pay out yet." };
  }

  try {
    await client.payouts.create(
      { amount: balance.availableCents, currency: "usd" },
      { stripeAccount: account.accountId },
    );
    return { ok: true };
  } catch (error) {
    log.warn("connect payout failed", { reason: safeErrorMessage(error) });
    return { error: "Stripe declined the payout. Check your bank details in the dashboard." };
  }
}

/* --------------------------------------------------- paying for a session -- */

export type SessionCheckout = {
  url?: string;
  error?: string;
};

/**
 * Patient pays, then joins.
 *
 * Two things are load-bearing here:
 *
 *  1. The amount comes from `sessions.price_cents`, never from the request.
 *     The previous product's patient-payment endpoint read `price_cents` out of
 *     the POST body, so the price was whatever the browser said it was.
 *  2. If the therapist owes 24Therapy money and has left auto-settle on, those
 *     invoices ride along inside the application fee. That is what makes "pay
 *     your bill out of your earnings" work without us ever holding the funds:
 *     it is our fee on a charge we facilitated, not a transfer out of their
 *     balance. The settlement is capped at the therapist's net so a session can
 *     never come out to zero for them.
 */
export async function createSessionPaymentCheckout(opts: {
  sessionId: string;
  token: string;
  payerName: string;
  payerEmail?: string | null;
}): Promise<SessionCheckout> {
  const client = getStripe();
  if (!client) return { error: "Payments are not configured on this deployment." };

  const [row] = await db
    .select({
      session: sessions,
      therapistId: users.id,
      accountId: users.stripeAccountId,
      chargesEnabled: users.chargesEnabled,
      autoSettle: users.autoSettleFromEarnings,
      therapistFirstName: users.firstName,
      therapistLastName: users.lastName,
    })
    .from(sessions)
    .innerJoin(users, eq(users.id, sessions.therapistId))
    .where(eq(sessions.id, opts.sessionId))
    .limit(1);

  if (!row) return { error: "That session no longer exists." };
  if (row.session.paymentStatus === "paid") return { error: "This session is already paid for." };
  if (row.session.priceCents <= 0) return { error: "This session does not need a payment." };
  if (!row.accountId || !row.chargesEnabled) {
    return { error: "Your therapist has not finished setting up payments yet." };
  }

  const gross = row.session.priceCents;
  const cut = platformFee(gross);
  const net = gross - cut;

  // Settle the therapist's own outstanding 24Therapy bills out of this charge,
  // oldest first, never more than the net.
  let settlement = 0;
  const settledIds: string[] = [];
  if (row.autoSettle) {
    const outstanding = await db
      .select()
      .from(invoices)
      .where(
        and(
          eq(invoices.organizationId, row.session.organizationId),
          eq(invoices.status, "due"),
        ),
      )
      .orderBy(invoices.issuedAt);

    for (const invoice of outstanding) {
      const payable = payableCents(invoice);
      if (payable <= 0) continue;
      if (settlement + payable > net) break;
      settlement += payable;
      settledIds.push(invoice.id);
    }
  }

  const applicationFee = cut + settlement;

  try {
    const checkout = await client.checkout.sessions.create({
      mode: "payment",
      customer_email: opts.payerEmail?.trim() || undefined,
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: "usd",
            unit_amount: gross,
            product_data: {
              name: "Therapy session",
              description: `With ${[row.therapistFirstName, row.therapistLastName]
                .filter(Boolean)
                .join(" ")}`.trim(),
            },
          },
        },
      ],
      payment_intent_data: {
        application_fee_amount: applicationFee,
        transfer_data: { destination: row.accountId },
        // The connected account is the merchant of record on the patient's
        // statement. Seeing an unfamiliar platform name on a bank statement for
        // a therapy session is a privacy problem, not a branding one.
        on_behalf_of: row.accountId,
      },
      // The checkout id rides back on the redirect so the join page can confirm
      // without waiting for a webhook — Stripe cannot reach a preview
      // deployment at all, and a patient staring at "payment pending" while
      // their session starts is the worst possible moment to find that out.
      success_url: `${env.appUrl}/join/${opts.token}?checkout={CHECKOUT_SESSION_ID}`,
      cancel_url: `${env.appUrl}/join/${opts.token}?checkout=cancelled`,
      metadata: {
        kind: "session_payment",
        sessionId: opts.sessionId,
        organizationId: row.session.organizationId,
      },
    });

    if (!checkout.url) return { error: "Stripe did not return a payment link." };

    // Recorded before the patient is sent anywhere. A payment that completes
    // while we have no row for it is unreconcilable, and the webhook may well
    // arrive before the browser comes back.
    await db
      .insert(sessionPayments)
      .values({
        organizationId: row.session.organizationId,
        therapistId: row.therapistId,
        sessionId: opts.sessionId,
        payerName: opts.payerName.slice(0, 80),
        payerEmail: opts.payerEmail?.trim().toLowerCase() || null,
        grossCents: gross,
        platformFeeCents: applicationFee,
        settledInvoiceCents: settlement,
        therapistNetCents: gross - applicationFee,
        status: "pending",
        stripeCheckoutSessionId: checkout.id,
      })
      .onConflictDoUpdate({
        target: sessionPayments.sessionId,
        // An abandoned checkout must be replaceable, but a paid one must not.
        setWhere: eq(sessionPayments.status, "pending"),
        set: {
          payerName: opts.payerName.slice(0, 80),
          payerEmail: opts.payerEmail?.trim().toLowerCase() || null,
          grossCents: gross,
          platformFeeCents: applicationFee,
          settledInvoiceCents: settlement,
          therapistNetCents: gross - applicationFee,
          stripeCheckoutSessionId: checkout.id,
          createdAt: new Date(),
        },
      });

    await db
      .update(sessions)
      .set({ paymentStatus: "pending", updatedAt: new Date() })
      .where(eq(sessions.id, opts.sessionId));

    // Tag the invoices so the existing settle-on-paid path clears them when the
    // charge lands, exactly as it does for a therapist-initiated batch.
    if (settledIds.length > 0) {
      await db
        .update(invoices)
        .set({ stripeCheckoutSessionId: checkout.id })
        .where(inArray(invoices.id, settledIds));
    }

    return { url: checkout.url };
  } catch (error) {
    log.error("session payment checkout failed", {
      session: ref(opts.sessionId),
      reason: safeErrorMessage(error),
    });
    return { error: "Could not start the payment. Please try again." };
  }
}

/**
 * Mark a session payment settled. Called from both the webhook and the
 * redirect-confirm path, and safe to run twice.
 */
export async function settleSessionPayment(checkout: {
  id: string;
  paymentIntentId: string | null;
}): Promise<void> {
  const paid = await db
    .update(sessionPayments)
    .set({
      status: "paid",
      paidAt: new Date(),
      stripePaymentIntentId: checkout.paymentIntentId,
    })
    .where(
      and(
        eq(sessionPayments.stripeCheckoutSessionId, checkout.id),
        eq(sessionPayments.status, "pending"),
      ),
    )
    .returning({ sessionId: sessionPayments.sessionId });

  for (const row of paid) {
    await db
      .update(sessions)
      .set({ paymentStatus: "paid", updatedAt: new Date() })
      .where(eq(sessions.id, row.sessionId));
  }
}

/* ------------------------------------------------------------- earnings -- */

export type Earnings = {
  lifetimeGrossCents: number;
  lifetimeNetCents: number;
  platformFeesCents: number;
  settledFromEarningsCents: number;
  thisMonthNetCents: number;
  paidSessionCount: number;
};

export async function earningsSummary(therapistId: string): Promise<Earnings> {
  const startOfMonth = new Date();
  startOfMonth.setUTCDate(1);
  startOfMonth.setUTCHours(0, 0, 0, 0);

  const [row] = await db
    .select({
      gross: sql<number>`COALESCE(SUM(${sessionPayments.grossCents}), 0)::int`,
      net: sql<number>`COALESCE(SUM(${sessionPayments.therapistNetCents}), 0)::int`,
      fees: sql<number>`COALESCE(SUM(${sessionPayments.platformFeeCents} - ${sessionPayments.settledInvoiceCents}), 0)::int`,
      settled: sql<number>`COALESCE(SUM(${sessionPayments.settledInvoiceCents}), 0)::int`,
      month: sql<number>`COALESCE(SUM(CASE WHEN ${sessionPayments.paidAt} >= ${startOfMonth.toISOString()} THEN ${sessionPayments.therapistNetCents} ELSE 0 END), 0)::int`,
      count: sql<number>`COUNT(*)::int`,
    })
    .from(sessionPayments)
    .where(and(eq(sessionPayments.therapistId, therapistId), eq(sessionPayments.status, "paid")));

  return {
    lifetimeGrossCents: row?.gross ?? 0,
    lifetimeNetCents: row?.net ?? 0,
    platformFeesCents: row?.fees ?? 0,
    settledFromEarningsCents: row?.settled ?? 0,
    thisMonthNetCents: row?.month ?? 0,
    paidSessionCount: row?.count ?? 0,
  };
}

export async function recentPayments(therapistId: string, limit = 20) {
  return db
    .select({
      id: sessionPayments.id,
      sessionId: sessionPayments.sessionId,
      payerName: sessionPayments.payerName,
      grossCents: sessionPayments.grossCents,
      therapistNetCents: sessionPayments.therapistNetCents,
      settledInvoiceCents: sessionPayments.settledInvoiceCents,
      status: sessionPayments.status,
      createdAt: sessionPayments.createdAt,
      paidAt: sessionPayments.paidAt,
    })
    .from(sessionPayments)
    .where(eq(sessionPayments.therapistId, therapistId))
    .orderBy(desc(sessionPayments.createdAt))
    .limit(limit);
}
