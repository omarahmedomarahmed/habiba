import "server-only";

import { and, desc, eq, inArray, sql } from "drizzle-orm";

import { db } from "@/lib/db";
import {
  earningsTransfers,
  invoices,
  payableCents,
  sessionPayments,
  sessions,
  users,
} from "@/lib/db/schema";
import { env } from "@/lib/env";
import { log, ref, safeErrorMessage } from "@/lib/logger";
import { getStripe } from "./stripe";

/**
 * Therapist earnings on Stripe Connect Express.
 *
 * The shape of the deal, stated once so it does not have to be re-derived from
 * the code: a patient pays for a session, the money is a *destination charge*
 * into the therapist's own connected account, and 24Therapy takes an
 * application fee. Stripe does the KYC, the payout schedule, the 1099s and the
 * negative-balance liability.
 *
 * ## The exception, and what it costs
 *
 * That only works once Stripe has verified the clinician. Until then the
 * account cannot receive a transfer at all, and the old code drew the obvious
 * conclusion: no verified account, no charging. Which meant a clinician who
 * signed up on Sunday night could not put a price on their time until Stripe
 * got round to them, and the radar showed them as free.
 *
 * So there is a second path. When the connected account cannot take a transfer
 * yet, the platform captures the charge itself and holds the clinician's share
 * until it can be released — `capture: "platform"` on the payment row, a
 * `therapist_payable` balance in `lib/billing/ledger.ts`, and an
 * `earnings_transfers` row when it finally moves.
 *
 * Be clear about what that is: for as long as we hold it, that is somebody
 * else's money sitting in our Stripe balance. It is a real obligation and it
 * carries real exposure — this is the arrangement a regulator would look at
 * first, and "we were only holding it briefly" is a fact about our intentions,
 * not about our licensing. Three things keep it bounded, and all three are
 * load-bearing:
 *
 *   1. It is never the default. A transfer-capable account always gets a
 *      destination charge and the money never touches us.
 *   2. It is released automatically the moment Stripe verifies the account —
 *      on the webhook, on the settings page, and on a nightly sweep, so it does
 *      not depend on any one of them working.
 *   3. Both sides are told. The clinician sees the held balance and what it is
 *      waiting on; the patient's receipt is unaffected.
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

    // The moment verification lands is the moment their held money stops
    // needing to be held. Done here as well as on the webhook because this is
    // the path a clinician actually watches — they are on the settings page,
    // having just finished onboarding, looking for the number to change.
    if (next.payoutsEnabled) {
      await releaseHeldEarnings(userId).catch(() => ({ movedCents: 0 }));
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
  const updated = await db
    .update(users)
    .set({
      chargesEnabled: Boolean(account.charges_enabled),
      payoutsEnabled: Boolean(account.payouts_enabled),
      updatedAt: new Date(),
    })
    .where(eq(users.stripeAccountId, account.id))
    .returning({ id: users.id });

  // Verification finished. Anything we were holding for them goes out now,
  // without a person having to ask for it.
  if (account.payouts_enabled) {
    for (const row of updated) {
      await releaseHeldEarnings(row.id).catch(() => ({ movedCents: 0 }));
    }
  }
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

  /*
   * Which route the money takes.
   *
   * A destination charge needs a connected account that Stripe will actually
   * transfer into. Anything less — no account at all, or an account still in
   * verification — and we capture it ourselves and hold their share. The
   * patient's experience is identical either way, which is the point: a person
   * in distress at one in the morning is not the right party to absorb the
   * consequences of their clinician's onboarding being half finished.
   */
  const capture: "destination" | "platform" =
    row.accountId && row.chargesEnabled ? "destination" : "platform";

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
      payment_intent_data:
        capture === "destination"
          ? {
              application_fee_amount: applicationFee,
              transfer_data: { destination: row.accountId! },
              // The connected account is the merchant of record on the
              // patient's statement. Seeing an unfamiliar platform name on a
              // bank statement for a therapy session is a privacy problem, not
              // a branding one.
              on_behalf_of: row.accountId!,
            }
          : {
              // Held capture: no transfer and no application fee, because
              // there is nowhere to send either yet. The split is recorded on
              // our own books instead and released later.
              description: "Therapy session — held pending clinician payout setup",
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
        capture,
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
        capture,
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
          capture,
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
    .returning();

  for (const row of paid) {
    await db
      .update(sessions)
      .set({ paymentStatus: "paid", updatedAt: new Date() })
      .where(eq(sessions.id, row.sessionId));

    /*
     * The books, before anything else that could fail.
     *
     * This is the only moment the money is known to have moved, and the update
     * above is guarded on `status = 'pending'` — so this loop body runs exactly
     * once per payment even if the webhook and the redirect both arrive. That
     * guard is what makes posting here safe rather than double-counting.
     */
    const { postSessionPayment } = await import("./ledger");
    await postSessionPayment({
      id: row.id,
      organizationId: row.organizationId,
      therapistId: row.therapistId,
      capture: row.capture,
      grossCents: row.grossCents,
      platformFeeCents: row.platformFeeCents,
      settledInvoiceCents: row.settledInvoiceCents,
      therapistNetCents: row.therapistNetCents,
    });

    // How they paid, for the clinician's records and for a dispute. Best
    // effort: a missing card brand must never hold up a session starting.
    await recordPaymentMethod(row.id, checkout.paymentIntentId);

    // A radar booking becomes real at the moment the money clears, not at the
    // moment someone pressed Book. Imported lazily to keep the billing layer
    // from depending on the radar at module scope.
    const { markInSession } = await import("@/lib/data/radar");
    await markInSession(row.sessionId);
  }
}

/**
 * Read the card brand and last four off the charge, and keep only those.
 *
 * A therapist gets asked "which card did I pay with?" and currently has no
 * answer at all. Brand plus last four answers it; anything more — a token, a
 * fingerprint, a payment method id — would be a stored credential, and storing
 * one to answer a question about a receipt is not a trade worth making.
 */
async function recordPaymentMethod(paymentId: string, paymentIntentId: string | null) {
  const client = getStripe();
  if (!client || !paymentIntentId) return;

  try {
    const intent = await client.paymentIntents.retrieve(paymentIntentId, {
      expand: ["latest_charge.payment_method_details"],
    });
    const charge = intent.latest_charge;
    if (!charge || typeof charge === "string") return;

    const card = charge.payment_method_details?.card;
    await db
      .update(sessionPayments)
      .set({
        stripeChargeId: charge.id,
        paymentBrand: card?.brand ?? charge.payment_method_details?.type ?? null,
        paymentLast4: card?.last4 ?? null,
        receiptUrl: charge.receipt_url ?? null,
      })
      .where(eq(sessionPayments.id, paymentId));
  } catch (error) {
    log.warn("payment method read failed", { reason: safeErrorMessage(error) });
  }
}

/**
 * Refund a patient.
 *
 * The gap this closes: a clinician goes on the radar, someone in distress pays
 * six pounds and sixty seconds later nobody has joined the room. Without this
 * the patient has no remedy inside the product and we have no answer for them.
 *
 * `reverse_transfer` claws the money back out of the therapist's balance rather
 * than ours — they did not do the session, so it is not their money — and
 * `refund_application_fee` gives back our cut too, because charging a
 * facilitation fee for a session that did not happen is indefensible.
 */
export async function refundSessionPayment(opts: {
  paymentId: string;
  reason: string;
  adminUserId: string;
}): Promise<{ ok?: boolean; error?: string }> {
  const client = getStripe();
  if (!client) return { error: "Payments are not configured on this deployment." };

  const [payment] = await db
    .select()
    .from(sessionPayments)
    .where(eq(sessionPayments.id, opts.paymentId))
    .limit(1);

  if (!payment) return { error: "Payment not found." };
  if (payment.status !== "paid") return { error: "Only a settled payment can be refunded." };
  if (!payment.stripePaymentIntentId) {
    return { error: "That payment has no Stripe charge to refund." };
  }

  try {
    await client.refunds.create({
      payment_intent: payment.stripePaymentIntentId,
      // Only meaningful on a destination charge. A held payment never left our
      // balance, so there is no transfer to reverse and no application fee to
      // return — sending these on one makes Stripe reject the refund outright.
      ...(payment.capture === "destination"
        ? { reverse_transfer: true, refund_application_fee: true }
        : {}),
      metadata: { reason: opts.reason.slice(0, 200), refundedBy: opts.adminUserId },
    });
  } catch (error) {
    log.error("refund failed", {
      payment: ref(opts.paymentId),
      reason: safeErrorMessage(error),
    });
    return { error: "Stripe declined the refund. Check the payment in the dashboard." };
  }

  await db
    .update(sessionPayments)
    .set({ status: "refunded" })
    .where(eq(sessionPayments.id, opts.paymentId));

  /*
   * And the books, backwards.
   *
   * On a held payment this also takes the clinician's share back out of what
   * we owe them — which can push the balance negative if we already released
   * it, and a negative held balance is exactly the fact somebody needs to see
   * rather than a number silently clamped at zero.
   */
  const { postSessionRefund } = await import("./ledger");
  await postSessionRefund({
    id: payment.id,
    organizationId: payment.organizationId,
    therapistId: payment.therapistId,
    capture: payment.capture,
    grossCents: payment.grossCents,
    platformFeeCents: payment.platformFeeCents,
    settledInvoiceCents: payment.settledInvoiceCents,
    therapistNetCents: payment.therapistNetCents,
  });

  /*
   * Anything settled out of that fee has to go back to being owed. The
   * therapist's 24Therapy bill was paid with money that has now been returned
   * to the patient; leaving it marked paid would quietly write off real revenue.
   */
  if (payment.settledInvoiceCents > 0 && payment.stripeCheckoutSessionId) {
    await db
      .update(invoices)
      .set({ status: "due", paidAt: null, stripeCheckoutSessionId: null })
      .where(
        and(
          eq(invoices.stripeCheckoutSessionId, payment.stripeCheckoutSessionId),
          eq(invoices.status, "paid"),
        ),
      );
  }

  await db
    .update(sessions)
    .set({ paymentStatus: "pending", updatedAt: new Date() })
    .where(eq(sessions.id, payment.sessionId));

  return { ok: true };
}

/* ------------------------------------------------- releasing held earnings -- */

/**
 * Can Stripe actually move money into this account right now?
 *
 * `charges_enabled` is not the same question and using it here is the classic
 * mistake: an account can take charges while its `transfers` capability is
 * still pending, and a transfer to one of those fails at Stripe with money
 * already deducted from our side of the books.
 */
async function transferCapable(accountId: string): Promise<boolean> {
  const client = getStripe();
  if (!client) return false;
  try {
    const account = await client.accounts.retrieve(accountId);
    return account.capabilities?.transfers === "active" && Boolean(account.payouts_enabled);
  } catch (error) {
    log.warn("connect capability read failed", { reason: safeErrorMessage(error) });
    return false;
  }
}

/**
 * Send a clinician everything we are holding for them.
 *
 * Called from three places on purpose — the `account.updated` webhook, the
 * settings page when they come back from onboarding, and a nightly sweep —
 * because the money is theirs and "it will go out when the webhook arrives" is
 * not good enough for a webhook that might not.
 *
 * Idempotent by construction: the amount comes from the ledger balance, and the
 * ledger is credited in the same call that creates the transfer. A second run a
 * second later reads a balance of zero and does nothing.
 *
 * Not a payout. This moves money from our balance into theirs; Stripe's own
 * schedule then pays it to their bank, exactly as it does for a destination
 * charge. We are never the thing standing between a clinician and their bank.
 */
export async function releaseHeldEarnings(
  therapistId: string,
  opts: { adminUserId?: string } = {},
): Promise<{ movedCents: number; error?: string }> {
  const client = getStripe();
  const { heldForTherapist, postEarningsTransfer } = await import("./ledger");

  const held = await heldForTherapist(therapistId);
  if (held <= 0) return { movedCents: 0 };

  const account = await getConnectAccount(therapistId);
  if (!client || !account.accountId) {
    return { movedCents: 0, error: "This clinician has no connected account yet." };
  }
  if (!(await transferCapable(account.accountId))) {
    return { movedCents: 0, error: "Stripe has not finished verifying this account." };
  }

  const [row] = await db
    .select({ organizationId: users.organizationId })
    .from(users)
    .where(eq(users.id, therapistId))
    .limit(1);
  if (!row) return { movedCents: 0, error: "Clinician not found." };

  // The row exists before the transfer does, so a crash between the two leaves
  // a `pending` record to investigate rather than money moved with nothing
  // saying so.
  const [transfer] = await db
    .insert(earningsTransfers)
    .values({
      organizationId: row.organizationId,
      therapistId,
      amountCents: held,
      stripeAccountId: account.accountId,
      releasedBy: opts.adminUserId ?? null,
    })
    .returning({ id: earningsTransfers.id });

  if (!transfer) return { movedCents: 0, error: "Could not record the release." };

  try {
    const created = await client.transfers.create(
      {
        amount: held,
        currency: "usd",
        destination: account.accountId,
        description: "24Therapy — session earnings held during payout setup",
        metadata: { therapistId, transferId: transfer.id },
      },
      // Stripe deduplicates on this, so a retry after a timeout cannot send the
      // money twice.
      { idempotencyKey: `earnings-release-${transfer.id}` },
    );

    await db
      .update(earningsTransfers)
      .set({ status: "paid", stripeTransferId: created.id, paidAt: new Date() })
      .where(eq(earningsTransfers.id, transfer.id));

    await postEarningsTransfer({
      transferId: transfer.id,
      organizationId: row.organizationId,
      therapistId,
      amountCents: held,
    });

    log.info("held earnings released", { user: ref(therapistId), amount: held });
    return { movedCents: held };
  } catch (error) {
    await db
      .update(earningsTransfers)
      .set({ status: "failed", failureReason: safeErrorMessage(error).slice(0, 300) })
      .where(eq(earningsTransfers.id, transfer.id));

    log.error("held earnings release failed", {
      user: ref(therapistId),
      reason: safeErrorMessage(error),
    });
    return { movedCents: 0, error: "Stripe declined the transfer. It will be retried." };
  }
}

/**
 * Everyone we are holding money for who can now be paid.
 *
 * The backstop for the two event-driven paths. Runs nightly inside the existing
 * batch, so it costs no extra database wake, and it is the reason a clinician
 * whose webhook was dropped still gets their money without anybody noticing
 * that it was.
 */
export async function releaseAllHeldEarnings(): Promise<{ released: number; centsMoved: number }> {
  const { heldBalances } = await import("./ledger");
  const owed = await heldBalances();

  let released = 0;
  let centsMoved = 0;
  for (const row of owed) {
    if (!row.therapistId || !row.stripeAccountId || row.heldCents <= 0) continue;
    const result = await releaseHeldEarnings(row.therapistId);
    if (result.movedCents > 0) {
      released += 1;
      centsMoved += result.movedCents;
    }
  }
  return { released, centsMoved };
}

/**
 * Clear a clinician's 24Therapy bills out of what we are holding for them.
 *
 * The "your credit pays your bills" path, and the reason it is worth holding
 * the money in a ledger rather than as a number on the user row: this is one
 * balanced transaction that either applies to both sides or to neither.
 *
 * Oldest bill first, and never more than we hold. A partial settlement is
 * deliberately not attempted — a half-paid invoice is a state the rest of the
 * billing code does not model, and inventing it here to squeeze out four extra
 * cents would be a bad trade.
 */
export async function settleInvoicesFromHeld(
  therapistId: string,
): Promise<{ settledCents: number; count: number }> {
  const { heldForTherapist, postInvoiceSettledFromHeld } = await import("./ledger");

  const [therapist] = await db
    .select({ organizationId: users.organizationId })
    .from(users)
    .where(eq(users.id, therapistId))
    .limit(1);
  if (!therapist) return { settledCents: 0, count: 0 };

  let remaining = await heldForTherapist(therapistId);
  if (remaining <= 0) return { settledCents: 0, count: 0 };

  const outstanding = await db
    .select()
    .from(invoices)
    .where(
      and(eq(invoices.organizationId, therapist.organizationId), eq(invoices.status, "due")),
    )
    .orderBy(invoices.issuedAt);

  let settledCents = 0;
  let count = 0;

  for (const invoice of outstanding) {
    const payable = payableCents(invoice);
    if (payable <= 0 || payable > remaining) continue;

    const cleared = await db
      .update(invoices)
      .set({ status: "paid", paidAt: new Date() })
      .where(and(eq(invoices.id, invoice.id), eq(invoices.status, "due")))
      .returning({ id: invoices.id });

    // Lost the race to another settlement path. Not an error — the bill is
    // paid, which is the outcome we wanted.
    if (cleared.length === 0) continue;

    await postInvoiceSettledFromHeld({
      invoiceId: invoice.id,
      organizationId: therapist.organizationId,
      therapistId,
      amountCents: payable,
      memo: invoice.description,
    });

    remaining -= payable;
    settledCents += payable;
    count += 1;
  }

  return { settledCents, count };
}

/* ------------------------------------------------------------- earnings -- */

export type Earnings = {
  lifetimeGrossCents: number;
  lifetimeNetCents: number;
  platformFeesCents: number;
  settledFromEarningsCents: number;
  thisMonthNetCents: number;
  paidSessionCount: number;
  /** Ours to hold, theirs to have. Zero for a fully onboarded clinician. */
  heldCents: number;
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

  const { heldForTherapist } = await import("./ledger");

  return {
    lifetimeGrossCents: row?.gross ?? 0,
    lifetimeNetCents: row?.net ?? 0,
    platformFeesCents: row?.fees ?? 0,
    settledFromEarningsCents: row?.settled ?? 0,
    thisMonthNetCents: row?.month ?? 0,
    paidSessionCount: row?.count ?? 0,
    heldCents: await heldForTherapist(therapistId),
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
      capture: sessionPayments.capture,
      paymentBrand: sessionPayments.paymentBrand,
      paymentLast4: sessionPayments.paymentLast4,
      receiptUrl: sessionPayments.receiptUrl,
      createdAt: sessionPayments.createdAt,
      paidAt: sessionPayments.paidAt,
    })
    .from(sessionPayments)
    .where(eq(sessionPayments.therapistId, therapistId))
    .orderBy(desc(sessionPayments.createdAt))
    .limit(limit);
}
