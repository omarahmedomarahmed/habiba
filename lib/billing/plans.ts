/**
 * What a therapist is billed per session, and how they buy it cheaper.
 *
 * ## What changed, and why the old shape is gone
 *
 * This used to be a `PLANS` record of subscription tiers with a monthly price
 * and a feature list. It is not that any more, and the change is a product one
 * rather than a renaming: a therapist no longer subscribes, they **buy sessions
 * at a rate, and the rate is set by how many they buy at once**. There is no
 * monthly fee, no "included" allowance to reconcile at the end of a period, and
 * no `unlimited` tier — which also removes a class of bug the old shape kept
 * producing, where `perSessionCents: null` meant "free" in one branch and
 * "unset" in another.
 *
 * ## Where the numbers live
 *
 * Not here. Every figure is a row in `platform_settings`, read through
 * `lib/settings`. This module holds the *logic* over those figures and nothing
 * else, so that changing a rate is an admin action and not a deploy. The
 * functions all take the settings they need as an argument rather than fetching
 * them, which keeps them pure, testable without a database, and safe to call
 * from a component that already has the snapshot.
 */
import type { PlatformSettings, PricingTier } from "@/lib/settings/defs";

export type { PricingTier };

/**
 * The rate a therapist gets for buying `quantity` sessions at once.
 *
 * Walks to the best tier they qualify for. Tiers arrive sorted by minimum
 * ascending (`parseTiers` guarantees it), so the last one whose minimum they
 * meet is the cheapest one they have earned.
 *
 * A quantity below every minimum still returns a tier — the zero-minimum one —
 * because "bought nothing" is pay-as-you-go, not "no rate". `settingsProblem`
 * refuses a configuration with no zero-minimum tier for exactly this reason.
 */
export function tierForQuantity(tiers: PricingTier[], quantity: number): PricingTier {
  const qty = Math.max(0, Math.floor(quantity));
  let best = tiers[0]!;
  for (const tier of tiers) {
    if (tier.minimumSessions <= qty) best = tier;
  }
  return best;
}

export function tierByKey(tiers: PricingTier[], key: string | null | undefined): PricingTier {
  // Fail closed to the most expensive tier a therapist could be on rather than
  // the cheapest: an unrecognised key must never silently grant the best rate.
  return tiers.find((t) => t.key === key) ?? tierForQuantity(tiers, 0);
}

/** What buying `quantity` sessions at once costs, and at what rate. */
export function quoteForQuantity(
  tiers: PricingTier[],
  quantity: number,
): { tier: PricingTier; quantity: number; totalCents: number } {
  const qty = Math.max(0, Math.floor(quantity));
  const tier = tierForQuantity(tiers, qty);
  return { tier, quantity: qty, totalCents: tier.rateCents * qty };
}

/**
 * What this session costs the therapist.
 *
 * A therapist with credits pays nothing now — the credit was paid for when it
 * was bought — and one without pays their tier's rate. Credits are consumed
 * before the rate applies, which is what §3 means by "keep every unused credit,
 * they are consumed first".
 */
export function sessionCharge(input: {
  settings: PlatformSettings;
  tierKey: string | null;
  creditsRemaining: number;
}): { source: "credit" | "rate"; amountCents: number; tier: PricingTier } {
  const tier = tierByKey(input.settings.pricing.tiers, input.tierKey);
  if (input.creditsRemaining > 0) return { source: "credit", amountCents: 0, tier };
  return { source: "rate", amountCents: tier.rateCents, tier };
}

export function formatUsd(cents: number): string {
  return (cents / 100).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: cents % 100 === 0 ? 0 : 2,
  });
}
