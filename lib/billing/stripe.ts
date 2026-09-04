import "server-only";

import Stripe from "stripe";
import { and, eq, inArray } from "drizzle-orm";

import { db } from "@/lib/db";
import { invoices, organizations, payableCents, stripeEvents, subscriptions } from "@/lib/db/schema";
import { activatePurchase, createPendingPurchase, quoteCredits } from "./credits";
import { recordCreditPurchaseInvoice, sumPayable } from "./service";
import { env, features } from "@/lib/env";
import { log, ref, safeErrorMessage } from "@/lib/logger";

let stripe: Stripe | null = null;

export function getStripe(): Stripe | null {
  if (!features.billing) return null;
  stripe ??= new Stripe(env.stripeSecretKey, { apiVersion: "2025-02-24.acacia" });
  return stripe;
}

async function ensureCustomer(organizationId: string, email: string): Promise<string | null> {
  const client = getStripe();
  if (!client) return null;

  const [org] = await db
    .select()
    .from(organizations)
    .where(eq(organizations.id, organizationId))
    .limit(1);
  if (!org) return null;
  if (org.stripeCustomerId) return org.stripeCustomerId;

  const customer = await client.customers.create({
    email,
    name: org.name,
    metadata: { organizationId },
  });

  await db
    .update(organizations)
    .set({ stripeCustomerId: customer.id, updatedAt: new Date() })
    .where(eq(organizations.id, organizationId));

  return customer.id;
}

/**
 * Buy sessions in advance.
 *
 * This replaced `createSubscriptionCheckout`, which sold a $99/month
 * `unlimited` plan that no longer exists. The mode changed with it: a one-time
 * `payment` rather than a `subscription`, because a therapist now buys a
 * quantity of sessions outright and there is no renewal to manage, no
 * cancellation to handle and no proration to get wrong.
 *
 * The quantity is a slider above the tier's minimum, so the line item is priced
 * from `quoteCredits` rather than chosen from a list of Stripe products — the
 * rate comes from `platform_settings` and an admin changing it must not require
 * a new product in Stripe.
 *
 * `success_url` carries the checkout session id so the app can confirm on
 * redirect. That is not redundant with the webhook: Stripe cannot reach a
 * preview or local deployment at all, and without the redirect confirmation a
 * paid purchase simply never activated. Both paths are guarded on
 * `status = 'pending'`, so whichever arrives first wins and the second is a
 * no-op.
 */
export async function createCreditCheckout(opts: {
  organizationId: string;
  email: string;
  quantity: number;
}): Promise<{ url?: string; error?: string }> {
  const client = getStripe();
  if (!client) return { error: "Payments are not configured on this deployment." };

  const quote = await quoteCredits(opts.quantity);
  if (quote.quantity <= 0) return { error: "Choose how many sessions to buy." };

  const customerId = await ensureCustomer(opts.organizationId, opts.email);
  if (!customerId) return { error: "Stripe could not identify your account." };

  try {
    const checkout = await client.checkout.sessions.create({
      mode: "payment",
      customer: customerId,
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: "usd",
            unit_amount: quote.totalCents,
            product_data: {
              name: `24Therapy — ${quote.quantity} sessions`,
              description: `${quote.tier.name} rate · $${(quote.tier.rateCents / 100).toFixed(2)} per session · valid until ${quote.expiresAt.toISOString().slice(0, 10)}`,
            },
          },
        },
      ],
      success_url: `${env.appUrl}/billing?checkout={CHECKOUT_SESSION_ID}`,
      cancel_url: `${env.appUrl}/billing?checkout=cancelled`,
      metadata: {
        kind: "credit_purchase",
        organizationId: opts.organizationId,
        quantity: String(quote.quantity),
      },
    });

    if (!checkout.url) return { error: "Stripe did not return a payment link." };

    // Recorded as `pending` before the therapist is sent anywhere: a purchase
    // that completes while we have no row for it is unreconcilable, and the
    // webhook may well arrive before the browser comes back.
    const pending = await createPendingPurchase({
      organizationId: opts.organizationId,
      quantity: quote.quantity,
      stripeCheckoutSessionId: checkout.id,
    });
    if (!pending) return { error: "Could not record the purchase. Nothing has been charged." };

    return { url: checkout.url };
  } catch (error) {
    log.error("credit checkout failed", {
      organization: ref(opts.organizationId),
      reason: safeErrorMessage(error),
    });
    return { error: "Stripe could not start the purchase just now. Try again in a moment." };
  }
}

/**
 * One Stripe checkout for any number of outstanding invoices.
 *
 * The therapist selects the bills they want to settle and gets a single link
 * for the total, rather than paying six sessions one at a time. Each selected
 * invoice records the checkout session id, so the webhook settles the whole
 * batch by looking them up on that column — no list of ids crammed into Stripe
 * metadata, which has a 500-character limit per value.
 */
export async function createInvoiceCheckout(opts: {
  organizationId: string;
  invoiceIds: string[];
  email: string;
}): Promise<{ url?: string; error?: string }> {
  const client = getStripe();
  if (!client) return { error: "Payments are not configured on this deployment." };

  const { totalCents, rows } = await sumPayable(opts.organizationId, opts.invoiceIds);
  if (rows.length === 0) return { error: "Those invoices are no longer outstanding." };
  if (totalCents <= 0) return { error: "There is nothing left to pay on those invoices." };

  const customerId = await ensureCustomer(opts.organizationId, opts.email);
  if (!customerId) return { error: "Could not prepare a customer record." };

  const checkout = await client.checkout.sessions.create({
    mode: "payment",
    customer: customerId,
    line_items: rows.map((row) => ({
      quantity: 1,
      price_data: {
        currency: "usd",
        unit_amount: Math.max(0, row.amountCents - row.discountCents),
        product_data: {
          name: row.description,
          description: row.issuedAt.toLocaleDateString("en-US", { dateStyle: "medium" }),
        },
      },
    })),
    success_url: `${env.appUrl}/billing?checkout={CHECKOUT_SESSION_ID}`,
    cancel_url: `${env.appUrl}/billing?checkout=cancelled`,
    metadata: { organizationId: opts.organizationId, invoiceCount: String(rows.length) },
  });

  if (!checkout.url) return { error: "Stripe did not return a payment link." };

  await db
    .update(invoices)
    .set({ stripeCheckoutSessionId: checkout.id })
    .where(inArray(invoices.id, rows.map((r) => r.id)));

  return { url: checkout.url };
}

/** Applied by both the webhook and the redirect-confirm path. */
async function applyCheckoutOutcome(session: Stripe.Checkout.Session): Promise<void> {
  const organizationId = session.metadata?.organizationId;
  const paymentIntentId =
    typeof session.payment_intent === "string" ? session.payment_intent : null;

  // A patient paying their therapist. Imported lazily because `connect.ts`
  // imports `getStripe` from this module, and a static cycle between the two
  // leaves one of them half-initialised at module scope.
  if (session.metadata?.kind === "session_payment" && session.payment_status === "paid") {
    const { settleSessionPayment } = await import("./connect");
    await settleSessionPayment({ id: session.id, paymentIntentId });
  }

  if (session.metadata?.kind === "credit_purchase" && session.payment_status === "paid") {
    const activated = await activatePurchase({
      stripeCheckoutSessionId: session.id,
      stripePaymentIntentId: paymentIntentId,
    });

    // Only on the transition. `activatePurchase` is guarded on `pending`, so a
    // second arrival — the webhook after the redirect, or the reverse — returns
    // false and does not raise a duplicate invoice.
    if (activated.activated && activated.organizationId) {
      await recordCreditPurchaseInvoice({
        organizationId: activated.organizationId,
        amountCents: session.amount_total ?? 0,
        quantity: activated.quantity,
        stripePaymentIntentId: paymentIntentId,
      });
    }
  }

  // Settle every invoice attached to this checkout, however many there were.
  //
  // This covers two cases with one query: a therapist paying a batch of their
  // own bills, and a patient's session payment whose application fee included
  // the therapist's outstanding invoices. In both, the invoices carry this
  // checkout's id, so "who paid" is already decided by the time we get here.
  if (session.payment_status === "paid") {
    const settled = await db
      .update(invoices)
      .set({ status: "paid", paidAt: new Date(), stripePaymentIntentId: paymentIntentId })
      .where(
        and(
          eq(invoices.stripeCheckoutSessionId, session.id),
          // Guarded on the current state so the webhook and the redirect —
          // which both land here — cannot post the same settlement twice.
          eq(invoices.status, "due"),
        ),
      )
      .returning();

    const { postInvoicePaidByCard } = await import("./ledger");
    for (const invoice of settled) {
      /*
       * A session payment's settlement is already on the books.
       *
       * When a patient's payment carried the clinician's bills inside the
       * application fee, `postSessionPayment` credited the receivable at the
       * moment the charge landed. Posting again here would clear the same debt
       * twice and quietly manufacture cash.
       */
      if (session.metadata?.kind === "session_payment") continue;
      await postInvoicePaidByCard({
        invoiceId: invoice.id,
        organizationId: invoice.organizationId,
        amountCents: payableCents(invoice),
        memo: invoice.description,
      });
    }
  }
}

export async function confirmCheckout(checkoutSessionId: string): Promise<boolean> {
  const client = getStripe();
  if (!client) return false;
  try {
    const session = await client.checkout.sessions.retrieve(checkoutSessionId);
    await applyCheckoutOutcome(session);
    return true;
  } catch (error) {
    log.warn("checkout confirm failed", { reason: safeErrorMessage(error) });
    return false;
  }
}

/**
 * Verify and handle a webhook.
 *
 * The raw body arrives as a string from the route handler. This is worth
 * calling out: the old NestJS app read `req.rawBody` without ever passing
 * `rawBody: true` to `NestFactory.create`, so the value was always undefined
 * and *every* webhook failed signature verification. Payment confirmation had
 * silently never worked in production.
 */
export async function handleWebhook(rawBody: string, signature: string): Promise<void> {
  const client = getStripe();
  if (!client) throw new Error("Stripe is not configured");
  if (!env.stripeWebhookSecret) throw new Error("STRIPE_WEBHOOK_SECRET is not set");

  const event = client.webhooks.constructEvent(rawBody, signature, env.stripeWebhookSecret);

  // Stripe redelivers. Without this, so do the side effects.
  const claimed = await db
    .insert(stripeEvents)
    .values({ id: event.id, type: event.type })
    .onConflictDoNothing({ target: stripeEvents.id })
    .returning({ id: stripeEvents.id });

  if (claimed.length === 0) return;

  switch (event.type) {
    case "checkout.session.completed":
      await applyCheckoutOutcome(event.data.object);
      break;

    /*
     * The subscription and renewal branches that used to live here are gone.
     *
     * There is no recurring plan any more — sessions are bought outright, and a
     * credit purchase arrives as `checkout.session.completed` like any other
     * one-time payment. Stripe will still deliver subscription events for the
     * handful of accounts that had one before the move to PAYG; they fall
     * through to the default and are recorded in `stripe_events` without
     * action, which is the correct outcome: those subscriptions were cancelled
     * in Stripe and there is nothing left for us to mirror.
     */

    /**
     * Connect capabilities. This is the only trustworthy source for
     * "can this therapist take money yet" — returning from the onboarding form
     * proves the form was submitted, not that Stripe accepted the identity
     * documents, and the gap between the two can be days.
     */
    case "account.updated": {
      const { syncAccountFromStripe } = await import("./connect");
      await syncAccountFromStripe(event.data.object);
      break;
    }

    case "invoice.payment_failed": {
      const invoice = event.data.object;
      const customerId = typeof invoice.customer === "string" ? invoice.customer : null;
      if (customerId) {
        const [org] = await db
          .select({ id: organizations.id })
          .from(organizations)
          .where(eq(organizations.stripeCustomerId, customerId))
          .limit(1);
        if (org) {
          await db
            .update(subscriptions)
            .set({ status: "past_due", updatedAt: new Date() })
            .where(eq(subscriptions.organizationId, org.id));
        }
      }
      break;
    }

    default:
      break;
  }
}

/**
 * Cancel whatever recurring billing an account still has in Stripe.
 *
 * Kept, narrowed, and no longer reachable from the product: there is nothing to
 * subscribe to any more, so this exists for the accounts that had a
 * subscription before the move to PAYG and for an admin cleaning one up. It
 * cancels at period end rather than immediately — a therapist who has paid for
 * this month keeps this month.
 *
 * The local row is already `payg`; this only stops Stripe from charging again.
 */
export async function cancelSubscription(organizationId: string): Promise<boolean> {
  const client = getStripe();
  const [sub] = await db
    .select()
    .from(subscriptions)
    .where(eq(subscriptions.organizationId, organizationId))
    .limit(1);

  if (!sub?.stripeSubscriptionId || !client) return true;

  await client.subscriptions.update(sub.stripeSubscriptionId, { cancel_at_period_end: true });
  await db
    .update(subscriptions)
    .set({ cancelAtPeriodEnd: true, updatedAt: new Date() })
    .where(eq(subscriptions.organizationId, organizationId));
  return true;
}
