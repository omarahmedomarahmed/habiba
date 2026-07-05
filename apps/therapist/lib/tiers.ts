/**
 * 24Therapy Therapist Portal — Subscription tier helpers
 *
 * Mirrors docs/PRODUCT_MVP.md → "Plan Feature Matrix" (the backend enforces
 * the same rules server-side; see backend/src/modules/billing/plan-features.ts
 * and GET /billing/my-features).
 *
 * | Feature            | PAYG      | Starter | Unlimited | Practice |
 * |--------------------|-----------|---------|-----------|----------|
 * | Sessions           | $6/sess   | 20/mo   | ∞         | ∞        |
 * | AI Chat messages   | 5/session | ∞       | ∞         | ∞        |
 * | Recordings         | —         | ✓       | ✓         | ✓        |
 * | Radar Matching     | —         | ✓       | ✓         | ✓        |
 * | Analytics          | Basic     | Basic   | Full      | Full     |
 * | Treatment Plans    | ✓         | ✓       | ✓         | ✓        |
 *
 * Everything else (sessions, patients, notes, AI workspace, treatment plans,
 * billing, settings) is available on every tier — AI chat is metered by
 * credits server-side on PAYG rather than locked in the UI.
 */

export type Tier = "payg" | "starter" | "professional" | "enterprise";

const TIER_RANK: Record<Tier, number> = {
  payg: 0,
  starter: 1,
  professional: 2,
  enterprise: 3,
};

export const TIER_LABEL: Record<Tier, string> = {
  payg: "Pay-as-you-go",
  starter: "Starter",
  professional: "Unlimited",
  enterprise: "Practice",
};

/** Map a raw backend plan_key to an access tier. Unknown/empty → payg. */
export function planKeyToTier(planKey?: string | null): Tier {
  switch (planKey) {
    case "starter":
      return "starter";
    case "pro":
      return "professional";
    case "practice":
    case "enterprise":
      return "enterprise";
    // free_trial, pay_per_session, null, anything else
    default:
      return "payg";
  }
}

/** True when `current` is at least `required`. */
export function hasTier(current: Tier, required: Tier): boolean {
  return TIER_RANK[current] >= TIER_RANK[required];
}

/**
 * Minimum tier required for each gated feature, per the MVP matrix.
 * Keys match top-level route segments where a whole page is gated
 * ("radar") and virtual feature keys where only part of a page is
 * gated ("analytics-full", "recordings").
 */
export const FEATURE_MIN_TIER: Record<string, Tier> = {
  radar: "starter",             // Radar Matching — Starter+
  recordings: "starter",        // Session recordings — Starter+
  "analytics-full": "professional", // Outcome metrics & full analytics — Unlimited+
};
