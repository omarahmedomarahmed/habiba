/**
 * 24Therapy — Plan Feature Matrix (single source of truth)
 *
 * Mirrors docs/PRODUCT_MVP.md → "Plan Feature Matrix" exactly:
 *
 * | Feature            | PAYG        | Starter ($59) | Unlimited ($99) | Practice ($249) |
 * |--------------------|-------------|---------------|-----------------|-----------------|
 * | Sessions           | $6/session  | 20/mo         | Unlimited       | Unlimited       |
 * | AI Transcription   | ✓           | ✓             | ✓               | ✓               |
 * | SOAP Notes         | ✓           | ✓             | ✓               | ✓               |
 * | AI Copilot         | ✓           | ✓             | ✓               | ✓               |
 * | AI Chat messages   | 5/session   | Unlimited     | Unlimited       | Unlimited       |
 * | Recordings         | —           | ✓             | ✓               | ✓               |
 * | Radar Matching     | —           | ✓             | ✓               | ✓               |
 * | HIPAA BAA          | —           | ✓             | ✓               | ✓               |
 * | Analytics          | Basic       | Basic         | Full            | Full            |
 * | Treatment Plans    | ✓           | ✓             | ✓               | ✓               |
 * | Multi-location     | —           | —             | —               | ✓               |
 * | White-label        | —           | —             | —               | ✓               |
 * | EHR Integration    | —           | —             | —               | ✓               |
 * | Dedicated support  | —           | —             | —               | ✓               |
 *
 * Plan keys map to DB rows in subscription_plans:
 *   pay_per_session (PAYG) · starter · pro (Unlimited) · practice · enterprise
 * `free_trial` is a legacy key treated as PAYG.
 */

export type SessionsModel =
  | { model: 'payg'; price_per_session_usd: number }
  | { model: 'quota'; included_per_month: number }
  | { model: 'unlimited' };

export interface PlanFeatures {
  plan_key: string;
  display_name: string;
  sessions: SessionsModel;
  ai_transcription: true;
  soap_notes: true;
  ai_copilot: true;
  /** 'per_session_credits' = 5 messages granted per completed session (PAYG) */
  ai_chat: 'per_session_credits' | 'unlimited';
  recordings: boolean;
  radar: boolean;
  hipaa_baa: boolean;
  analytics: 'basic' | 'full';
  treatment_plans: true;
  multi_location: boolean;
  white_label: boolean;
  ehr_integration: boolean;
  dedicated_support: boolean;
}

const PAYG_FEATURES: PlanFeatures = {
  plan_key: 'pay_per_session',
  display_name: 'Pay As You Go',
  sessions: { model: 'payg', price_per_session_usd: 6 },
  ai_transcription: true,
  soap_notes: true,
  ai_copilot: true,
  ai_chat: 'per_session_credits',
  recordings: false,
  radar: false,
  hipaa_baa: false,
  analytics: 'basic',
  treatment_plans: true,
  multi_location: false,
  white_label: false,
  ehr_integration: false,
  dedicated_support: false,
};

export const PLAN_FEATURES: Record<string, PlanFeatures> = {
  pay_per_session: PAYG_FEATURES,
  free_trial: { ...PAYG_FEATURES, plan_key: 'free_trial' },
  starter: {
    plan_key: 'starter',
    display_name: 'Starter',
    sessions: { model: 'quota', included_per_month: 20 },
    ai_transcription: true,
    soap_notes: true,
    ai_copilot: true,
    ai_chat: 'unlimited',
    recordings: true,
    radar: true,
    hipaa_baa: true,
    analytics: 'basic',
    treatment_plans: true,
    multi_location: false,
    white_label: false,
    ehr_integration: false,
    dedicated_support: false,
  },
  pro: {
    plan_key: 'pro',
    display_name: 'Unlimited',
    sessions: { model: 'unlimited' },
    ai_transcription: true,
    soap_notes: true,
    ai_copilot: true,
    ai_chat: 'unlimited',
    recordings: true,
    radar: true,
    hipaa_baa: true,
    analytics: 'full',
    treatment_plans: true,
    multi_location: false,
    white_label: false,
    ehr_integration: false,
    dedicated_support: false,
  },
  practice: {
    plan_key: 'practice',
    display_name: 'Practice',
    sessions: { model: 'unlimited' },
    ai_transcription: true,
    soap_notes: true,
    ai_copilot: true,
    ai_chat: 'unlimited',
    recordings: true,
    radar: true,
    hipaa_baa: true,
    analytics: 'full',
    treatment_plans: true,
    multi_location: true,
    white_label: true,
    ehr_integration: true,
    dedicated_support: true,
  },
};

// Legacy/enterprise orgs get everything Practice has.
PLAN_FEATURES.enterprise = { ...PLAN_FEATURES.practice, plan_key: 'enterprise', display_name: 'Enterprise' };

/** Resolve features for a raw plan key. Unknown/missing keys fall back to PAYG. */
export function getPlanFeatures(planKey?: string | null): PlanFeatures {
  return PLAN_FEATURES[planKey || 'pay_per_session'] || PAYG_FEATURES;
}
