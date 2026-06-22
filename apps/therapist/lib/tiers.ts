/**
 * 24Therapy Therapist Portal — Subscription tier helpers
 *
 * The backend stores the active plan on `therapists.current_plan_key`
 * (returned by GET /therapists/me). We collapse the raw plan keys into four
 * access tiers and gate premium features against them.
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
 * Minimum tier required for each gated feature.
 * Anything not listed here (sessions, patients, notes, calendar, messages,
 * billing, notifications, settings) is available on every tier — billing in
 * particular must always be reachable so users can upgrade.
 */
export const FEATURE_MIN_TIER: Record<string, Tier> = {
  booking: "starter",
  analytics: "professional",
  "ai-workspace": "professional",
  radar: "professional",
  crm: "enterprise",
  memory: "enterprise",
  "treatment-plans": "enterprise",
};
