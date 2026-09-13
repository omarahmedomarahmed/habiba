import "server-only";

import Stripe from "stripe";
import { and, eq, inArray } from "drizzle-orm";

import { dbFor} from "@/lib/db";
import { pinnedToDefaultRegion } from "@/lib/db/region";
import { invoices, organizations, payableCents, stripeEvents, subscriptions } from "@/lib/db/schema";
import { activatePurchase, createPendingPurchase, quoteCredits } from "./credits";
import { recordCreditPurchaseInvoice, sumPayable } from "./service";
import { env, features } from "@/lib/env";
import { log, ref, safeErrorMessage } from "@/lib/logger";
import { getSettings } from "@/lib/settings";

/*
 * ⚠️ 30.1 — NOT ROUTED YET, and counted rather than hidden.
 *
 * `pinnedToDefaultRegion` returns the default region and registers this
 * module so `verify:sprint30` can print it. The alternative, `dbFor("us")`
 * with a comment, compiles and is indistinguishable from a decision, which
 * is the "seam by convention" this sprint exists to prevent.
 */
const db = dbFor(pinnedToDefaultRegion("lib/billing/stripe.ts", "not routed yet: this call site has no entity in hand, so 30.x threads one"));


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
  /** 46.4 — an amount of credit to buy, in cents. Never a session count. */
  amountCents: number;
}): Promise<{ url?: string; error?: string }> {
  const client = getStripe();
  if (!client) return { error: "Payments are not configured on this deployment." };

  const quote = await quoteCredits(opts.amountCents);
  if (quote.creditCents <= 0) return { error: "Choose how much credit to add." };

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
              name: `24Therapy credit, $${(quote.creditCents / 100).toFixed(2)}`,
              /*
               * 🔴 46.3 — the word "sessions" is gone from the offer, and this
               * line is where somebody would put it back. What is bought is
               * credit, which is money.
               *
               * 🔴 Sprint 57 — and it no longer says "yours to keep", because
               * that promised a RATE LOCK the thresholds no longer grant. This
               * string is on a Stripe receipt, which is the one piece of copy
               * nobody in this repository would think to reread: it is not a
               * page, it is not in the dictionary, and `verify:claims` cannot
               * see it. Written down here for whoever changes the model next.
               */
              description: `$${(quote.creditCents / 100).toFixed(2)} of credit against your session and AI fees, spent before your card is. Valid until ${quote.expiresAt.toISOString().slice(0, 10)}`,
            },
          },
        },
      ],
      success_url: `${env.appUrl}/billing?checkout={CHECKOUT_SESSION_ID}`,
      cancel_url: `${env.appUrl}/billing?checkout=cancelled`,
      metadata: {
        kind: "credit_purchase",
        organizationId: opts.organizationId,
        creditCents: String(quote.creditCents),
      },
    });

    if (!checkout.url) return { error: "Stripe did not return a payment link." };

    // Recorded as `pending` before the therapist is sent anywhere: a purchase
    // that completes while we have no row for it is unreconcilable, and the
    // webhook may well arrive before the browser comes back.
    const pending = await createPendingPurchase({
      organizationId: opts.organizationId,
      amountCents: quote.creditCents,
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
 * 🔴 Sprint 57 — subscribe to a monthly tier.
 *
 * ## What this restores, and what it does differently
 *
 * There was a `createSubscriptionCheckout` here before sprint 46 removed it,
 * selling a hard-coded $99 `unlimited` plan. This is not that function brought
 * back: **the price is read from `platform_settings` at checkout time**, like
 * every other figure in this product, so an admin changing $99 to $89 changes
 * what the next subscriber is charged with no Stripe product to create and no
 * deploy. `price_data.recurring` lets Stripe price an ad-hoc subscription the
 * same way `createCreditCheckout` prices an ad-hoc payment.
 *
 * ## The tier is validated against settings, never trusted from the form
 *
 * A key that is not a live tier, or is a live tier with no monthly price, is
 * refused here rather than sent to Stripe. Without that check a crafted form
 * post could open a $0 subscription to the `clinic` tier and `entitledTier`
 * would honour it, because entitlement asks what the ROW says and the row would
 * say `clinic`. The money and the entitlement have to be decided by the same
 * lookup or they will eventually disagree.
 *
 * ## No local row is written here
 *
 * Unlike a credit purchase, nothing is recorded as `pending`. A subscription
 * that exists locally before Stripe has charged anything is a free month for
 * anybody who opens checkout and walks away, and `entitledTier` honours a null
 * period end. The row is created when the checkout completes, which both the
 * webhook and the redirect-confirm path reach.
 */
export async function createSubscriptionCheckout(opts: {
  organizationId: string;
  email: string;
  tierKey: string;
}): Promise<{ url?: string; error?: string }> {
  const client = getStripe();
  if (!client) return { error: "Payments are not configured on this deployment." };

  const settings = await getSettings();
  const tier = settings.pricing.tiers.find((t) => t.key === opts.tierKey);
  if (!tier) return { error: "That plan is no longer offered." };
  if (tier.monthlyCents <= 0) {
    return { error: "That plan is pay as you go. There is nothing to subscribe to." };
  }

  const customerId = await ensureCustomer(opts.organizationId, opts.email);
  if (!customerId) return { error: "Stripe could not identify your account." };

  try {
    const checkout = await client.checkout.sessions.create({
      mode: "subscription",
      customer: customerId,
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: "usd",
            unit_amount: tier.monthlyCents,
            recurring: { interval: "month" },
            product_data: {
              name: `24Therapy ${tier.name}`,
              description:
                "Unlimited sessions and unlimited AI. Cancel any time and you keep the month you have paid for.",
            },
          },
        },
      ],
      success_url: `${env.appUrl}/billing?checkout={CHECKOUT_SESSION_ID}`,
      cancel_url: `${env.appUrl}/billing?checkout=cancelled`,
      metadata: {
        kind: "subscription",
        organizationId: opts.organizationId,
        tierKey: tier.key,
      },
      // Stripe copies this onto the subscription itself, which is the only
      // place `customer.subscription.*` events can read it from later.
      subscription_data: {
        metadata: { organizationId: opts.organizationId, tierKey: tier.key },
      },
    });

    if (!checkout.url) return { error: "Stripe did not return a payment link." };
    return { url: checkout.url };
  } catch (error) {
    log.error("subscription checkout failed", {
      organization: ref(opts.organizationId),
      reason: safeErrorMessage(error),
    });
    return { error: "Stripe could not start the subscription just now. Try again in a moment." };
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

  /*
   * 🔴 Sprint 57 — a completed subscription checkout, from either path.
   *
   * `upsert` rather than insert: an organisation has at most one subscription
   * (`subscriptions_org_unique`), and a therapist moving from Practice to
   * Clinic, or resubscribing after a cancellation, completes a second checkout
   * against the same row. An insert would violate the unique index and leave
   * somebody charged with no entitlement.
   *
   * The period end is left null when Stripe has not told us one yet.
   * `entitledTier` honours a null, because the money has changed hands and the
   * `invoice.paid` that carries the date is moments behind.
   */
  if (session.metadata?.kind === "subscription" && session.mode === "subscription") {
    const tierKey = session.metadata?.tierKey;
    const subscriptionId =
      typeof session.subscription === "string" ? session.subscription : null;

    if (organizationId && tierKey) {
      await db
        .insert(subscriptions)
        .values({
          organizationId,
          plan: tierKey as (typeof subscriptions.$inferInsert)["plan"],
          status: "active",
          stripeSubscriptionId: subscriptionId,
          cancelAtPeriodEnd: false,
        })
        .onConflictDoUpdate({
          target: subscriptions.organizationId,
          set: {
            plan: tierKey as (typeof subscriptions.$inferInsert)["plan"],
            status: "active",
            stripeSubscriptionId: subscriptionId,
            cancelAtPeriodEnd: false,
            updatedAt: new Date(),
          },
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

/**
 * 🔴 Sprint 57 — write Stripe's view of a subscription onto our row.
 *
 * One function for three events, because all three answer the same question and
 * answering it three ways is how the local row and Stripe drift apart.
 *
 * ## Finding the organisation without trusting the event
 *
 * `subscription_data.metadata` carries the organisation id from checkout, and
 * the customer id is the fallback for a subscription created in Stripe's
 * dashboard by hand. If neither resolves, nothing is written: a subscription
 * event we cannot attribute is not a reason to guess which therapist it belongs
 * to.
 *
 * ## The status map, and the one that is not a cancellation
 *
 * Stripe has seven statuses and this product has three. `past_due` and
 * `unpaid` both mean "we are still trying", and both keep the therapist on the
 * plan until the period they paid for runs out — that is `entitledTier`'s
 * grace, and it is why `unpaid` is NOT mapped to cancelled here. `incomplete`
 * is a checkout that never completed, which is a cancellation from our side
 * because no money arrived.
 */
function statusFrom(stripeStatus: Stripe.Subscription.Status): "active" | "past_due" | "cancelled" {
  switch (stripeStatus) {
    case "active":
    case "trialing":
      return "active";
    case "past_due":
    case "unpaid":
      return "past_due";
    default:
      // canceled, incomplete, incomplete_expired, paused.
      return "cancelled";
  }
}

function subscriptionIdOf(invoice: Stripe.Invoice): string | null {
  const sub = invoice.subscription;
  if (typeof sub === "string") return sub;
  return sub?.id ?? null;
}

async function mirrorSubscription(sub: Stripe.Subscription): Promise<void> {
  const customerId = typeof sub.customer === "string" ? sub.customer : sub.customer?.id ?? null;
  let organizationId = sub.metadata?.organizationId ?? null;

  if (!organizationId && customerId) {
    const [org] = await db
      .select({ id: organizations.id })
      .from(organizations)
      .where(eq(organizations.stripeCustomerId, customerId))
      .limit(1);
    organizationId = org?.id ?? null;
  }

  if (!organizationId) {
    log.warn("subscription event could not be attributed", { reason: "no organization" });
    return;
  }

  const status = statusFrom(sub.status);
  const tierKey = sub.metadata?.tierKey ?? null;

  /*
   * 🔴 The plan is only written when Stripe carried one, and a cancelled
   * subscription keeps the key it had.
   *
   * Rewriting `plan` to `payg` on cancellation would destroy the record of what
   * somebody was on, and `entitledTier` does not need it: a cancelled status
   * already falls back to the spend ladder. Status is the entitlement; plan is
   * the history.
   */
  await db
    .insert(subscriptions)
    .values({
      organizationId,
      plan: (tierKey ?? "payg") as (typeof subscriptions.$inferInsert)["plan"],
      status,
      stripeSubscriptionId: sub.id,
      currentPeriodEnd: new Date(sub.current_period_end * 1000),
      cancelAtPeriodEnd: sub.cancel_at_period_end,
    })
    .onConflictDoUpdate({
      target: subscriptions.organizationId,
      set: {
        ...(tierKey
          ? { plan: tierKey as (typeof subscriptions.$inferInsert)["plan"] }
          : {}),
        status,
        stripeSubscriptionId: sub.id,
        currentPeriodEnd: new Date(sub.current_period_end * 1000),
        cancelAtPeriodEnd: sub.cancel_at_period_end,
        updatedAt: new Date(),
      },
    });
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
     * 🔴 Sprint 57 — the renewal branches, restored because there is a
     * recurring plan again.
     *
     * `customer.subscription.updated` and `.deleted` are the only honest source
     * for what a subscription IS: a card that stops working, a cancellation
     * made in Stripe's own portal, a plan Stripe ended after exhausting its
     * retries. Without these the local row says `active` for ever and a
     * therapist who stopped paying keeps unlimited AI indefinitely.
     */
    case "customer.subscription.updated":
    case "customer.subscription.deleted": {
      await mirrorSubscription(event.data.object);
      break;
    }

    /*
     * The renewal itself. `invoice.paid` carries the period the money bought,
     * which is exactly what `entitledTier` measures entitlement against, so
     * this is the event that actually extends access.
     */
    case "invoice.paid": {
      const invoice = event.data.object;
      const subscriptionId = subscriptionIdOf(invoice);
      if (subscriptionId && client) {
        const sub = await client.subscriptions.retrieve(subscriptionId);
        await mirrorSubscription(sub);
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

/**
 * Stop a subscription renewing.
 *
 * 🔴 At period end, never immediately, and that is a product decision rather
 * than a Stripe default. A therapist who has paid for this month keeps this
 * month: cancelling on a Tuesday must not take unlimited AI away from the
 * sessions they have already booked for Thursday. `entitledTier` reads the
 * period end for exactly this reason and does not consult `cancelAtPeriodEnd`
 * at all.
 *
 * Reachable from the product again as of sprint 57, and still safe for an
 * account with no Stripe subscription: it returns true having done nothing,
 * because "make sure this is not renewing" is already satisfied.
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

/**
 * 🔴 Sprint 57 — undo a cancellation that has not taken effect yet.
 *
 * Without this, a therapist who cancels and changes their mind on the same day
 * has to wait for the period to end, lose the plan, and buy it again — which
 * also resets their billing date and charges them twice in one month. Stripe
 * makes this a one-field update while the subscription is still running, so the
 * only reason not to offer it is forgetting to.
 *
 * Refused once the subscription has actually ended: `resume` on a cancelled
 * subscription is a new purchase, and it goes through checkout so somebody is
 * looking at a price before they are charged.
 */
export async function resumeSubscription(organizationId: string): Promise<boolean> {
  const client = getStripe();
  const [sub] = await db
    .select()
    .from(subscriptions)
    .where(eq(subscriptions.organizationId, organizationId))
    .limit(1);

  if (!sub?.stripeSubscriptionId || !client) return false;
  if (sub.status === "cancelled") return false;

  await client.subscriptions.update(sub.stripeSubscriptionId, { cancel_at_period_end: false });
  await db
    .update(subscriptions)
    .set({ cancelAtPeriodEnd: false, updatedAt: new Date() })
    .where(eq(subscriptions.organizationId, organizationId));
  return true;
}
