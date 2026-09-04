import "server-only";

import { and, asc, eq, gt, sql } from "drizzle-orm";

import { db } from "@/lib/db";
import { sessionCredits } from "@/lib/db/schema";
import { log, ref, safeErrorMessage } from "@/lib/logger";
import { getSettings, type PricingTier } from "@/lib/settings";

import { quoteForQuantity, tierForQuantity } from "./plans";

/**
 * Sessions bought in advance, spent one at a time.
 *
 * The replacement for the monthly subscription. A therapist buys a quantity at
 * the rate that quantity earns, the credits sit on their organisation with an
 * expiry, and a completed session spends one before it bills anything.
 *
 * §3's two rules about credits both live here:
 *   - **They are consumed first.** Buying at a worse rate later, or dropping to
 *     PAYG, never strands what was already paid for.
 *   - **They expire twelve months after purchase** — `pricing.creditExpiryMonths`,
 *     admin-editable like everything else.
 */

export type CreditBalance = {
  /** Unspent, unexpired credits. */
  remaining: number;
  /** The tier the next credit was bought at, or null when there are none. */
  tierKey: string | null;
  /** When the soonest batch runs out. */
  nextExpiryAt: Date | null;
};

/**
 * What is actually spendable right now.
 *
 * Expiry is a `WHERE expires_at > now()` rather than a nightly job that flips a
 * status: a credit expires at an instant, and a sweep that runs at 03:00 would
 * let somebody spend an expired credit for up to a day. Nothing has to run for
 * this to be correct.
 */
export async function getCreditBalance(organizationId: string): Promise<CreditBalance> {
  const rows = await db
    .select({
      id: sessionCredits.id,
      tierKey: sessionCredits.tierKey,
      quantity: sessionCredits.quantity,
      consumed: sessionCredits.consumed,
      expiresAt: sessionCredits.expiresAt,
    })
    .from(sessionCredits)
    .where(
      and(
        eq(sessionCredits.organizationId, organizationId),
        eq(sessionCredits.status, "active"),
        gt(sessionCredits.expiresAt, new Date()),
        gt(sessionCredits.quantity, sessionCredits.consumed),
      ),
    )
    .orderBy(asc(sessionCredits.expiresAt));

  const remaining = rows.reduce((sum, r) => sum + (r.quantity - r.consumed), 0);
  const next = rows[0];
  return {
    remaining,
    tierKey: next?.tierKey ?? null,
    nextExpiryAt: next?.expiresAt ?? null,
  };
}

/**
 * Spend one credit, or report that there was none.
 *
 * A single conditional UPDATE against the soonest-expiring batch. Not a read
 * followed by a write: two sessions completing at the same instant would both
 * see "1 remaining" and both spend it, and the therapist would have paid for
 * one session and received two. The `consumed < quantity` predicate is what
 * makes the second one fail, and it is enforced by Postgres rather than by the
 * order the two requests happened to arrive in.
 *
 * Soonest-expiring first is deliberate: spending the batch that is about to
 * lapse wastes the least of what the therapist paid for.
 */
export async function consumeCredit(
  organizationId: string,
): Promise<{ spent: boolean; tierKey: string | null; rateCents: number | null }> {
  const [row] = await db
    .update(sessionCredits)
    .set({ consumed: sql`${sessionCredits.consumed} + 1`, updatedAt: new Date() })
    .where(
      eq(
        sessionCredits.id,
        sql`(
          SELECT id FROM ${sessionCredits}
          WHERE organization_id = ${organizationId}
            AND status = 'active'
            AND expires_at > now()
            AND consumed < quantity
          ORDER BY expires_at ASC, created_at ASC
          LIMIT 1
        )`,
      ),
    )
    .returning({ tierKey: sessionCredits.tierKey, rateCents: sessionCredits.rateCents });

  if (!row) return { spent: false, tierKey: null, rateCents: null };
  return { spent: true, tierKey: row.tierKey, rateCents: row.rateCents };
}

/**
 * Price a purchase without making one.
 *
 * The quantity is a slider, not a fixed pack: above a tier's minimum a
 * therapist buys as many as they like at that rate, so the quote is computed
 * from the quantity rather than chosen from a list of products.
 */
export async function quoteCredits(quantity: number): Promise<{
  tier: PricingTier;
  quantity: number;
  totalCents: number;
  expiresAt: Date;
}> {
  const settings = await getSettings();
  const quote = quoteForQuantity(settings.pricing.tiers, quantity);
  return { ...quote, expiresAt: expiryFrom(new Date(), settings.pricing.creditExpiryMonths) };
}

/**
 * Record a purchase that has not been paid for yet.
 *
 * `pending` until Stripe confirms, so an abandoned checkout leaves a row that
 * `getCreditBalance` will never count. The rate is frozen onto the row here,
 * at the moment of the quote — see the `rate_cents` comment in the schema.
 */
export async function createPendingPurchase(input: {
  organizationId: string;
  quantity: number;
  stripeCheckoutSessionId: string;
}): Promise<{ id: string; totalCents: number; tier: PricingTier } | null> {
  const quote = await quoteCredits(input.quantity);
  if (quote.quantity <= 0) return null;

  const [row] = await db
    .insert(sessionCredits)
    .values({
      organizationId: input.organizationId,
      tierKey: quote.tier.key,
      rateCents: quote.tier.rateCents,
      quantity: quote.quantity,
      expiresAt: quote.expiresAt,
      status: "pending",
      stripeCheckoutSessionId: input.stripeCheckoutSessionId,
    })
    .returning({ id: sessionCredits.id });

  if (!row) return null;
  return { id: row.id, totalCents: quote.totalCents, tier: quote.tier };
}

/**
 * Stripe says it is paid.
 *
 * Guarded on `status = 'pending'` so the webhook and the redirect confirmation
 * — which both land here — cannot activate the same batch twice, and so a
 * refunded batch that was voided cannot be resurrected by a late webhook. The
 * expiry clock starts now rather than at checkout creation: a therapist who
 * left the tab open overnight has not lost a day.
 */
export async function activatePurchase(input: {
  stripeCheckoutSessionId: string;
  stripePaymentIntentId?: string | null;
}): Promise<{ activated: boolean; organizationId: string | null; quantity: number }> {
  try {
    const settings = await getSettings();
    const [row] = await db
      .update(sessionCredits)
      .set({
        status: "active",
        stripePaymentIntentId: input.stripePaymentIntentId ?? null,
        expiresAt: expiryFrom(new Date(), settings.pricing.creditExpiryMonths),
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(sessionCredits.stripeCheckoutSessionId, input.stripeCheckoutSessionId),
          eq(sessionCredits.status, "pending"),
        ),
      )
      .returning({
        organizationId: sessionCredits.organizationId,
        quantity: sessionCredits.quantity,
      });

    if (!row) return { activated: false, organizationId: null, quantity: 0 };
    return { activated: true, organizationId: row.organizationId, quantity: row.quantity };
  } catch (error) {
    log.error("credit activation failed", {
      reason: safeErrorMessage(error),
      checkout: ref(input.stripeCheckoutSessionId),
    });
    return { activated: false, organizationId: null, quantity: 0 };
  }
}

/**
 * The tier a therapist is currently on.
 *
 * Derived from what they hold rather than stored as their identity: a therapist
 * with Growth credits is on Growth until those credits run out, and then they
 * are on PAYG, with no state change and nothing to keep in sync.
 * `subscriptions.plan` is kept updated alongside for display and for the admin
 * list, but this is the answer that decides what a session costs.
 */
export async function currentTier(organizationId: string): Promise<PricingTier> {
  const [settings, balance] = await Promise.all([
    getSettings(),
    getCreditBalance(organizationId),
  ]);
  if (balance.tierKey) {
    const held = settings.pricing.tiers.find((t) => t.key === balance.tierKey);
    if (held) return held;
  }
  return tierForQuantity(settings.pricing.tiers, 0);
}

/** Purchase date plus N months, clamped so 31 January + 1 month is not 3 March. */
function expiryFrom(from: Date, months: number): Date {
  const d = new Date(from);
  const day = d.getDate();
  d.setDate(1);
  d.setMonth(d.getMonth() + months);
  const lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  d.setDate(Math.min(day, lastDay));
  return d;
}

export { expiryFrom as creditExpiryFrom };
