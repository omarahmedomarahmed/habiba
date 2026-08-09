import "server-only";

import Stripe from "stripe";
import { eq, inArray } from "drizzle-orm";

import { db } from "@/lib/db";
import { invoices, organizations, stripeEvents, subscriptions } from "@/lib/db/schema";
import { recordSubscriptionInvoice, sumPayable } from "./service";
import { env, features } from "@/lib/env";
import { log, safeErrorMessage } from "@/lib/logger";
import { PLANS } from "./plans";

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
 * Subscription checkout.
 *
 * `success_url` carries the checkout session id so the app can confirm the
 * outcome on redirect. That confirm path is not redundant with the webhook: in
 * preview and local environments Stripe cannot reach the webhook endpoint at
 * all, and without the redirect confirmation a paid subscription simply never
 * activated. Keeping both is the fix that made billing testable.
 */
export async function createSubscriptionCheckout(opts: {
  organizationId: string;
  email: string;
}): Promise<string | null> {
  const client = getStripe();
  if (!client) return null;

  const customerId = await ensureCustomer(opts.organizationId, opts.email);
  if (!customerId) return null;

  const plan = PLANS.unlimited;

  const checkout = await client.checkout.sessions.create({
    mode: "subscription",
    customer: customerId,
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: "usd",
          unit_amount: plan.monthlyCents!,
          recurring: { interval: "month" },
          product_data: { name: `24Therapy ${plan.name}`, description: plan.tagline },
        },
      },
    ],
    success_url: `${env.appUrl}/billing?checkout={CHECKOUT_SESSION_ID}`,
    cancel_url: `${env.appUrl}/billing?checkout=cancelled`,
    metadata: { organizationId: opts.organizationId, plan: plan.key },
    subscription_data: { metadata: { organizationId: opts.organizationId } },
  });

  return checkout.url;
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

  if (organizationId && session.mode === "subscription" && session.status === "complete") {
    await db
      .update(subscriptions)
      .set({
        plan: "unlimited",
        status: "active",
        stripeSubscriptionId:
          typeof session.subscription === "string" ? session.subscription : null,
        cancelAtPeriodEnd: false,
        updatedAt: new Date(),
      })
      .where(eq(subscriptions.organizationId, organizationId));

    // Record the payment as an invoice. Without this the therapist pays and the
    // product shows them nothing at all.
    await recordSubscriptionInvoice({
      organizationId,
      amountCents: session.amount_total ?? PLANS.unlimited.monthlyCents ?? 0,
      periodStart: new Date(),
      periodEnd: null,
      stripePaymentIntentId: paymentIntentId,
    });
  }

  // Settle every invoice attached to this checkout, however many there were.
  //
  // This covers two cases with one query: a therapist paying a batch of their
  // own bills, and a patient's session payment whose application fee included
  // the therapist's outstanding invoices. In both, the invoices carry this
  // checkout's id, so "who paid" is already decided by the time we get here.
  if (session.payment_status === "paid") {
    await db
      .update(invoices)
      .set({ status: "paid", paidAt: new Date(), stripePaymentIntentId: paymentIntentId })
      .where(eq(invoices.stripeCheckoutSessionId, session.id));
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

    case "customer.subscription.updated": {
      const sub = event.data.object;
      const organizationId = sub.metadata?.organizationId;
      if (organizationId) {
        await db
          .update(subscriptions)
          .set({
            status: sub.status === "active" || sub.status === "trialing" ? "active" : "past_due",
            cancelAtPeriodEnd: sub.cancel_at_period_end,
            currentPeriodEnd: sub.current_period_end
              ? new Date(sub.current_period_end * 1000)
              : null,
            updatedAt: new Date(),
          })
          .where(eq(subscriptions.organizationId, organizationId));
      }
      break;
    }

    case "customer.subscription.deleted": {
      const sub = event.data.object;
      const organizationId = sub.metadata?.organizationId;
      if (organizationId) {
        await db
          .update(subscriptions)
          .set({ plan: "payg", status: "cancelled", stripeSubscriptionId: null, updatedAt: new Date() })
          .where(eq(subscriptions.organizationId, organizationId));
      }
      break;
    }

    case "invoice.payment_succeeded": {
      const stripeInvoice = event.data.object;
      const customerId =
        typeof stripeInvoice.customer === "string" ? stripeInvoice.customer : null;
      // Only renewals: the first payment already produced an invoice via the
      // checkout, and billing_reason distinguishes them.
      if (customerId && stripeInvoice.billing_reason === "subscription_cycle") {
        const [org] = await db
          .select({ id: organizations.id })
          .from(organizations)
          .where(eq(organizations.stripeCustomerId, customerId))
          .limit(1);
        if (org) {
          await recordSubscriptionInvoice({
            organizationId: org.id,
            amountCents: stripeInvoice.amount_paid ?? 0,
            periodStart: stripeInvoice.period_start
              ? new Date(stripeInvoice.period_start * 1000)
              : null,
            periodEnd: stripeInvoice.period_end
              ? new Date(stripeInvoice.period_end * 1000)
              : null,
            description: "Unlimited — monthly renewal",
          });
        }
      }
      break;
    }

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

export async function cancelSubscription(organizationId: string): Promise<boolean> {
  const client = getStripe();
  const [sub] = await db
    .select()
    .from(subscriptions)
    .where(eq(subscriptions.organizationId, organizationId))
    .limit(1);

  if (!sub?.stripeSubscriptionId || !client) {
    await db
      .update(subscriptions)
      .set({ plan: "payg", status: "cancelled", updatedAt: new Date() })
      .where(eq(subscriptions.organizationId, organizationId));
    return true;
  }

  await client.subscriptions.update(sub.stripeSubscriptionId, { cancel_at_period_end: true });
  await db
    .update(subscriptions)
    .set({ cancelAtPeriodEnd: true, updatedAt: new Date() })
    .where(eq(subscriptions.organizationId, organizationId));
  return true;
}
