import type { PlanKey } from "@/lib/db/schema";

/**
 * The plan matrix. Two plans, and every field here is actually enforced
 * somewhere in the code.
 *
 * The previous matrix had four tiers and fourteen feature flags, nine of which
 * were read by nothing — marketing copy shipped as a type. It also gated
 * `hipaa_baa` behind the paid tiers, which is not a thing you can sell: we are
 * a business associate the moment we process a therapist's patient data, on any
 * plan. A BAA is a contract we owe every customer, not an upsell.
 */
export type Plan = {
  key: PlanKey;
  name: string;
  tagline: string;
  /** Cents per completed session, or null when sessions are included. */
  perSessionCents: number | null;
  monthlyCents: number | null;
  /** First completed session is free, once per organization. */
  firstSessionFree: boolean;
  /** Copilot messages per patient per calendar month, or null for uncapped. */
  copilotMessagesPerPatient: number | null;
  features: string[];
};

/**
 * Copilot allowance on the metered plan.
 *
 * Defined here rather than in the copilot code because it is a *price*, and a
 * price that lives next to the feature that enforces it drifts from the price
 * on the marketing page. `lib/data/copilot.ts` reads this value.
 */
export const PAYG_COPILOT_MESSAGES = 10;

export const PLANS: Record<PlanKey, Plan> = {
  payg: {
    key: "payg",
    name: "Pay as you go",
    tagline: "Only pay for the sessions you actually run.",
    perSessionCents: 600,
    monthlyCents: null,
    firstSessionFree: true,
    copilotMessagesPerPatient: PAYG_COPILOT_MESSAGES,
    features: [
      "Live transcription",
      "SOAP note in under a minute",
      // The copilot allowance is part of what $6 buys, so it belongs in the
      // price, not in a footnote a therapist discovers when they hit the cap.
      `${PAYG_COPILOT_MESSAGES} copilot questions per patient, every month`,
      "Every answer cites the session and timestamp it came from",
      "Patient report by email",
      "Video or in-person sessions",
      "Crisis-language alerts",
      "Get paid by patients — Crisis Radar and paid session links",
      "HIPAA BAA included",
    ],
  },
  unlimited: {
    key: "unlimited",
    name: "Unlimited",
    tagline: "Every session documented, one flat price.",
    perSessionCents: null,
    monthlyCents: 9900,
    firstSessionFree: false,
    copilotMessagesPerPatient: null,
    features: [
      "Everything in Pay as you go",
      "Unlimited sessions",
      "Unlimited copilot questions on every patient",
      "No per-session billing to track",
      "Priority transcription queue",
      "HIPAA BAA included",
    ],
  },
};

export function getPlan(key: string | null | undefined): Plan {
  // Fail closed to the metered plan on an unknown key. An unrecognised plan
  // must never silently grant unlimited usage.
  return PLANS[(key ?? "") as PlanKey] ?? PLANS.payg;
}

export function formatUsd(cents: number): string {
  return (cents / 100).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: cents % 100 === 0 ? 0 : 2,
  });
}
