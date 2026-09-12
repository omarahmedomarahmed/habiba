import "server-only";

import { and, asc, eq, gt, sql } from "drizzle-orm";

import { dbFor} from "@/lib/db";
import { pinnedToDefaultRegion } from "@/lib/db/region";
import { sessionCredits } from "@/lib/db/schema";
import { log, ref, safeErrorMessage } from "@/lib/logger";
import { getSettings, type PricingTier } from "@/lib/settings";

import { quoteForSpend, tierForSpend } from "./plans";

/*
 * ⚠️ 30.1 — NOT ROUTED YET, and counted rather than hidden.
 *
 * `pinnedToDefaultRegion` returns the default region and registers this
 * module so `verify:sprint30` can print it. The alternative, `dbFor("us")`
 * with a comment, compiles and is indistinguishable from a decision, which
 * is the "seam by convention" this sprint exists to prevent.
 */
const db = dbFor(pinnedToDefaultRegion("lib/billing/credits.ts", "not routed yet: this call site has no entity in hand, so 30.x threads one"));


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
  /**
   * 🔴 46.4 — unspent, unexpired credit, IN CENTS.
   *
   * This counted sessions. Credit is money now and spends against any line,
   * platform fee and AI fee alike, so a therapist with $2.50 left can cover
   * two platform fees and part of an AI fee rather than "half a session",
   * which was never a thing anybody could spend.
   */
  remainingCents: number;
  /** The tier the next credit was bought at, or null when there are none. */
  tierKey: string | null;
  /** When the soonest batch runs out. */
  nextExpiryAt: Date | null;
};

/**
 * 🔴 What one credit row is still worth, in cents, whichever era it is from.
 *
 * Nothing was backfilled, on purpose: rewriting a pre-46 row would re-derive
 * somebody's purchase from settings that have since changed, which is the
 * mistake `rate_cents` exists to prevent. So a row is read in the units it was
 * written in, and the two are never mixed.
 *
 *   after 46   `credit_cents - spent_cents`
 *   before 46  `(quantity - consumed) * rate_cents`
 */
export function remainingCentsOf(row: {
  creditCents: number | null;
  spentCents: number;
  quantity: number;
  consumed: number;
  rateCents: number;
}): number {
  if (row.creditCents !== null) return Math.max(0, row.creditCents - row.spentCents);
  return Math.max(0, (row.quantity - row.consumed) * row.rateCents);
}

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
      rateCents: sessionCredits.rateCents,
      creditCents: sessionCredits.creditCents,
      spentCents: sessionCredits.spentCents,
      expiresAt: sessionCredits.expiresAt,
    })
    .from(sessionCredits)
    .where(
      and(
        eq(sessionCredits.organizationId, organizationId),
        eq(sessionCredits.status, "active"),
        gt(sessionCredits.expiresAt, new Date()),
      ),
    )
    .orderBy(asc(sessionCredits.expiresAt));

  /*
   * The "still has something left" test moved out of SQL and into
   * `remainingCentsOf`, because it is now two different tests depending on
   * which era the row is from and a single `WHERE` cannot ask both. The rows
   * per organisation are a handful of purchases, so this is not a scan worth
   * pushing back down.
   */
  const live = rows.filter((row) => remainingCentsOf(row) > 0);
  const remainingCents = live.reduce((sum, row) => sum + remainingCentsOf(row), 0);
  const next = live[0];
  return {
    remainingCents,
    tierKey: next?.tierKey ?? null,
    nextExpiryAt: next?.expiresAt ?? null,
  };
}

/**
 * 🔴 46.4 — spend up to `amountCents` of credit, soonest-expiring first.
 *
 * A single conditional UPDATE per batch. Not a read followed by a write: two
 * sessions completing at the same instant would both see the balance and both
 * spend it, and the therapist would have paid once and been billed nothing
 * twice. The `spent_cents + N <= credit_cents` predicate is what makes the
 * second one fail, and it is enforced by Postgres rather than by the order the
 * two requests happened to arrive in.
 *
 * Soonest-expiring first is deliberate: spending the batch about to lapse
 * wastes the least of what the therapist paid for.
 *
 * 🔴 Partial spending is the point, and is new. A $1 platform fee against a
 * batch with $0.60 left takes the $0.60 and reports it, and the caller bills
 * the remaining $0.40 elsewhere. Under the old model a credit was one session
 * and there was nothing to split; under money there is, and refusing to split
 * would strand every balance that is not an exact multiple of a fee.
 *
 * A legacy row (`credit_cents` NULL) is spent in whole sessions through
 * `consumed`, in the units it was bought in, because re-pricing it would be
 * re-deriving a past purchase from present settings.
 */
export async function spendCredit(
  organizationId: string,
  amountCents: number,
): Promise<{ spentCents: number; tierKey: string | null }> {
  let outstanding = Math.max(0, Math.floor(amountCents));
  if (outstanding === 0) return { spentCents: 0, tierKey: null };

  let spentTotal = 0;
  let tierKey: string | null = null;

  /*
   * Bounded rather than `while (outstanding > 0)`. A row that reports value
   * and refuses to yield it — a shape nobody has written but which a future
   * migration could — would otherwise spin forever on the session-completion
   * path, which is the worst possible place for an unbounded loop.
   */
  for (let attempt = 0; attempt < 20 && outstanding > 0; attempt += 1) {
    const [batch] = await db
      .select({
        id: sessionCredits.id,
        tierKey: sessionCredits.tierKey,
        quantity: sessionCredits.quantity,
        consumed: sessionCredits.consumed,
        rateCents: sessionCredits.rateCents,
        creditCents: sessionCredits.creditCents,
        spentCents: sessionCredits.spentCents,
      })
      .from(sessionCredits)
      .where(
        and(
          eq(sessionCredits.organizationId, organizationId),
          eq(sessionCredits.status, "active"),
          gt(sessionCredits.expiresAt, new Date()),
        ),
      )
      .orderBy(asc(sessionCredits.expiresAt), asc(sessionCredits.createdAt))
      .limit(1);

    if (!batch) break;

    const available = remainingCentsOf(batch);
    if (available <= 0) break;

    if (batch.creditCents !== null) {
      const take = Math.min(available, outstanding);
      const [claimed] = await db
        .update(sessionCredits)
        .set({ spentCents: sql`${sessionCredits.spentCents} + ${take}`, updatedAt: new Date() })
        .where(
          and(
            eq(sessionCredits.id, batch.id),
            // The race guard: only if this much is still there.
            sql`${sessionCredits.spentCents} + ${take} <= ${sessionCredits.creditCents}`,
          ),
        )
        .returning({ tierKey: sessionCredits.tierKey });

      if (!claimed) continue; // Somebody else took it. Look again.
      spentTotal += take;
      outstanding -= take;
      tierKey = tierKey ?? claimed.tierKey;
      continue;
    }

    /*
     * A pre-46 row. One whole session at the rate it was bought at, which may
     * be more than the caller asked for — that is what buying a session in
     * advance meant, and honouring it is more correct than refusing to spend
     * it because the arithmetic no longer matches.
     */
    const [claimed] = await db
      .update(sessionCredits)
      .set({ consumed: sql`${sessionCredits.consumed} + 1`, updatedAt: new Date() })
      .where(
        and(
          eq(sessionCredits.id, batch.id),
          sql`${sessionCredits.consumed} < ${sessionCredits.quantity}`,
        ),
      )
      .returning({ tierKey: sessionCredits.tierKey });

    if (!claimed) continue;
    const take = Math.min(batch.rateCents, outstanding);
    spentTotal += take;
    outstanding -= take;
    tierKey = tierKey ?? claimed.tierKey;
  }

  return { spentCents: spentTotal, tierKey };
}

/**
 * Price a purchase without making one.
 *
 * 🔴 46.4 — the amount is money, and the money bought is the money spent.
 *
 * The slider used to choose a number of sessions and multiply. It chooses an
 * amount now: $30 buys $30 of credit and unlocks whatever rate that threshold
 * reaches. There is no multiplication left to get wrong, and `creditCents ===
 * totalCents` is the offer rather than an oversight.
 */
export async function quoteCredits(amountCents: number): Promise<{
  tier: PricingTier;
  creditCents: number;
  totalCents: number;
  expiresAt: Date;
}> {
  const settings = await getSettings();
  const quote = quoteForSpend(settings.pricing.tiers, amountCents);
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
  amountCents: number;
  stripeCheckoutSessionId: string;
}): Promise<{ id: string; totalCents: number; tier: PricingTier } | null> {
  const quote = await quoteCredits(input.amountCents);
  if (quote.creditCents <= 0) return null;

  const [row] = await db
    .insert(sessionCredits)
    .values({
      organizationId: input.organizationId,
      tierKey: quote.tier.key,
      /*
       * `rateCents` is the AI rate this purchase unlocked, frozen at the
       * moment of the quote. It is no longer what a session costs — the
       * platform fee is the other half — but it is still the thing an admin
       * lowering a rate next March must not be able to change retroactively,
       * which is the whole reason the column is copied in rather than
       * looked up.
       */
      rateCents: quote.tier.aiRateCents,
      creditCents: quote.creditCents,
      /*
       * The session columns are written as zeroes rather than left out. They
       * are NOT NULL and they are how `remainingCentsOf` tells a pre-46 row
       * from a post-46 one: a row with `credit_cents` set is read in money and
       * these are never consulted.
       */
      quantity: 0,
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
 * 🔴 46.4 / C223 — the tier a therapist is on, and why it outlives the credit.
 *
 * This used to read the balance: hold Growth credits, be on Growth; spend the
 * last one, drop to pay as you go. That was right when a tier was a bundle and
 * is wrong now that it is a **rate lock**. The money bought credit; what the
 * threshold bought is the rate, and a rate that evaporated the moment the
 * credit ran out would be a discount on a bundle wearing a rate lock's name.
 *
 * So the tier is derived from **lifetime spend**, which never goes down: a
 * therapist who has ever put $60 through this holds the $1 AI rate afterwards,
 * with an empty balance, forever.
 *
 * Two consequences worth stating rather than discovering:
 *
 *   - Expired credit still counts toward the threshold. They paid it; the rate
 *     is what they bought with it. Expiry takes the unspent money, not the
 *     standing.
 *   - `void` rows do not count. A refunded purchase is money returned, and a
 *     refund that left the rate behind would be a free upgrade.
 *
 * Legacy rows are valued in the units they were bought in by
 * `remainingCentsOf`'s sibling arithmetic below, for the same reason nothing
 * was backfilled.
 */
export async function currentTier(organizationId: string): Promise<PricingTier> {
  const [settings, rows] = await Promise.all([
    getSettings(),
    db
      .select({
        quantity: sessionCredits.quantity,
        rateCents: sessionCredits.rateCents,
        creditCents: sessionCredits.creditCents,
      })
      .from(sessionCredits)
      .where(
        and(
          eq(sessionCredits.organizationId, organizationId),
          // Paid for. `pending` is an abandoned checkout; `void` is refunded.
          eq(sessionCredits.status, "active"),
        ),
      ),
  ]);

  const lifetimeCents = rows.reduce(
    (sum, row) => sum + (row.creditCents ?? row.quantity * row.rateCents),
    0,
  );

  return tierForSpend(settings.pricing.tiers, lifetimeCents);
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
