import "server-only";

import Stripe from "stripe";
import { eq } from "drizzle-orm";

import { db } from "@/lib/db";
import { organizations, sessionCharges, stripeEvents, subscriptions } from "@/lib/db/schema";
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

export async function createChargeCheckout(opts: {
  organizationId: string;
  chargeId: string;
  email: string;
}): Promise<string | null> {
  const client = getStripe();
  if (!client) return null;

  const [charge] = await db
    .select()
    .from(sessionCharges)
    .where(eq(sessionCharges.id, opts.chargeId))
    .limit(1);

  // The amount is read from our database, never accepted from the client. The
  // old patient-payment endpoint took `price_cents` from the request body.
  if (!charge || charge.organizationId !== opts.organizationId) return null;
  if (charge.status !== "pending" || charge.amountCents <= 0) return null;

  const customerId = await ensureCustomer(opts.organizationId, opts.email);
  if (!customerId) return null;

  const checkout = await client.checkout.sessions.create({
    mode: "payment",
    customer: customerId,
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: "usd",
          unit_amount: charge.amountCents,
          product_data: { name: "24Therapy session", description: charge.description },
        },
      },
    ],
    success_url: `${env.appUrl}/billing?checkout={CHECKOUT_SESSION_ID}`,
    cancel_url: `${env.appUrl}/billing?checkout=cancelled`,
    metadata: { organizationId: opts.organizationId, chargeId: opts.chargeId },
  });

  if (checkout.url) {
    await db
      .update(sessionCharges)
      .set({ stripeCheckoutUrl: checkout.url })
      .where(eq(sessionCharges.id, opts.chargeId));
  }

  return checkout.url;
}

/** Applied by both the webhook and the redirect-confirm path. */
async function applyCheckoutOutcome(session: Stripe.Checkout.Session): Promise<void> {
  const organizationId = session.metadata?.organizationId;
  if (!organizationId) return;

  if (session.mode === "subscription" && session.status === "complete") {
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
  }

  const chargeId = session.metadata?.chargeId;
  if (chargeId && session.payment_status === "paid") {
    await db
      .update(sessionCharges)
      .set({
        status: "paid",
        paidAt: new Date(),
        stripePaymentIntentId:
          typeof session.payment_intent === "string" ? session.payment_intent : null,
      })
      .where(eq(sessionCharges.id, chargeId));
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
