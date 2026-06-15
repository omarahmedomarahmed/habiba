/**
 * pricing-api.ts — Centralized Pricing API Client
 *
 * Single source of truth for all pricing data.
 * All pricing pages must use this client — NO hardcoded prices.
 *
 * Backend endpoint: GET /billing/plans (public, no auth required)
 * Admin endpoint: GET /billing/admin/plans (requires super_admin role)
 */

import { getApiUrl } from '@/lib/env';

const API_BASE = getApiUrl();

// ─── Types ────────────────────────────────────────────────────────────────────

export interface PlanFeatures {
  radar?: boolean;
  api_access?: boolean;
  white_label?: boolean;
  advanced_analytics?: boolean;
  custom_branding?: boolean;
  hipaa_baa?: boolean;
  dedicated_support?: boolean;
  custom_ai?: boolean;
  sso?: boolean;
  ehr_integration?: boolean;
  multi_location?: boolean;
  [key: string]: boolean | undefined;
}

export interface PlanAddOn {
  name: string;
  price: string;
  description: string;
}

export interface SubscriptionPlan {
  id: string;
  plan_key: string;
  name: string;
  tagline: string | null;
  description: string | null;
  price_monthly_usd: number | null;  // null = custom/enterprise
  price_annual_usd: number | null;   // null = custom/enterprise
  max_therapists: number | null;     // null = unlimited
  max_patients: number | null;       // null = unlimited
  max_sessions_month: number | null; // null = unlimited
  ai_notes_included: number | null;  // null = unlimited, -1 = none
  features: PlanFeatures;
  stripe_price_id_monthly: string | null;
  stripe_price_id_annual: string | null;
  is_active: boolean;
  is_featured: boolean;
  badge_text: string | null;
  cta_text: string;
  trial_days: number;
  add_ons: PlanAddOn[];
  highlight_color: string | null;
  display_order: number;
}

export interface PricingApiResponse {
  plans: SubscriptionPlan[];
  error?: string;
  source: "api" | "fallback";
}

// ─── Fallback data (used when API is unavailable) ────────────────────────────
// These are the canonical prices from the database seed (010_billing_schema.sql)
// They are ONLY used as fallback when the API cannot be reached.

const FALLBACK_PLANS: SubscriptionPlan[] = [
  {
    id: "fallback-payg",
    plan_key: "pay_per_session",
    name: "Pay As You Go",
    tagline: "First session free, then $6 per session",
    description: "No monthly commitment. First session on us, then $6 per completed session.",
    price_monthly_usd: 0,
    price_annual_usd: 0,
    max_therapists: 1,
    max_patients: null,
    max_sessions_month: null,
    ai_notes_included: null,
    features: {
      radar: false,
      api_access: false,
      white_label: false,
      advanced_analytics: false,
      custom_branding: false,
      hipaa_baa: false,
      pay_per_session: true,
    },
    stripe_price_id_monthly: null,
    stripe_price_id_annual: null,
    is_active: true,
    is_featured: false,
    badge_text: null,
    cta_text: "Start free",
    trial_days: 0,
    add_ons: [],
    highlight_color: null,
    display_order: 0,
  },
  {
    id: "fallback-starter",
    plan_key: "starter",
    name: "Starter",
    tagline: "20 sessions — 50% off pay-as-you-go",
    description: "20 sessions/month included (≈$3/session). Unused sessions roll over (up to 20 banked).",
    price_monthly_usd: 59,
    price_annual_usd: 590,
    max_therapists: 1,
    max_patients: null,
    max_sessions_month: 20,
    ai_notes_included: 20,
    features: {
      radar: true,
      api_access: false,
      white_label: false,
      advanced_analytics: false,
      custom_branding: false,
      hipaa_baa: true,
      rollover: true,
    },
    stripe_price_id_monthly: null,
    stripe_price_id_annual: null,
    is_active: true,
    is_featured: false,
    badge_text: null,
    cta_text: "Start Starter",
    trial_days: 0,
    add_ons: [],
    highlight_color: null,
    display_order: 1,
  },
  {
    id: "fallback-pro",
    plan_key: "pro",
    name: "Unlimited",
    tagline: "Unlimited sessions — full platform power",
    description: "Unlimited sessions, full AI suite, priority processing.",
    price_monthly_usd: 99,
    price_annual_usd: 990,
    max_therapists: 1,
    max_patients: null,
    max_sessions_month: null,
    ai_notes_included: null,
    features: {
      radar: true,
      api_access: false,
      white_label: false,
      advanced_analytics: true,
      custom_branding: true,
      hipaa_baa: true,
      emotional_history: true,
      priority_ai: true,
    },
    stripe_price_id_monthly: null,
    stripe_price_id_annual: null,
    is_active: true,
    is_featured: true,
    badge_text: "Most Popular",
    cta_text: "Start Unlimited",
    trial_days: 0,
    add_ons: [],
    highlight_color: null,
    display_order: 2,
  },
  {
    id: "fallback-enterprise",
    plan_key: "enterprise",
    name: "Enterprise",
    tagline: "Hospitals, universities, healthcare systems",
    description: "Custom pricing for large organizations",
    price_monthly_usd: null,
    price_annual_usd: null,
    max_therapists: null,
    max_patients: null,
    max_sessions_month: null,
    ai_notes_included: null,
    features: {
      radar: true,
      api_access: true,
      white_label: true,
      advanced_analytics: true,
      custom_branding: true,
      hipaa_baa: true,
      sso: true,
      ehr_integration: true,
      dedicated_support: true,
      custom_ai: true,
      multi_location: true,
    },
    stripe_price_id_monthly: null,
    stripe_price_id_annual: null,
    is_active: true,
    is_featured: false,
    badge_text: null,
    cta_text: "Contact Sales",
    trial_days: 0,
    add_ons: [],
    highlight_color: null,
    display_order: 4,
  },
];

// ─── API Functions ────────────────────────────────────────────────────────────

/**
 * Fetch public pricing plans from backend.
 * Falls back to canonical seed data if API is unreachable.
 * Used by: Marketing website pricing page, signup flow
 */
export async function fetchPublicPlans(): Promise<PricingApiResponse> {
  try {
    const res = await fetch(`${API_BASE}/billing/plans`, {
      next: { revalidate: 300 }, // Cache for 5 minutes (Next.js ISR)
      headers: { "Content-Type": "application/json" },
    });

    if (!res.ok) {
      throw new Error(`API returned ${res.status}`);
    }

    const raw = await res.json();
    const rawPlans: any[] = Array.isArray(raw) ? raw : (raw.data || []);
    // Normalize field names from backend to frontend expectations
    const normalized = rawPlans.map((plan: any) => ({
      ...plan,
      price_monthly_usd: plan.price_monthly_usd ?? plan.monthly_price_usd ?? null,
      price_annual_usd: plan.price_annual_usd ?? plan.annual_price_usd ?? null,
      // Parse JSONB features if they came as strings
      features: typeof plan.features === 'string' ? JSON.parse(plan.features) : (plan.features || {}),
    }));
    return {
      plans: normalized,
      source: "api",
    };
  } catch (error) {
    console.warn("[pricing-api] API unavailable, using fallback data:", error);
    return {
      plans: FALLBACK_PLANS,
      error: "Using cached pricing data. Contact us for the latest pricing.",
      source: "fallback",
    };
  }
}

/**
 * Fetch all plans (including inactive) for admin management.
 * Requires authentication token.
 */
export async function fetchAdminPlans(token: string): Promise<SubscriptionPlan[]> {
  const res = await fetch(`${API_BASE}/billing/admin/plans`, {
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    cache: "no-store",
  });

  if (!res.ok) {
    throw new Error(`Failed to fetch admin plans: ${res.status}`);
  }

  const data = await res.json();
  return Array.isArray(data) ? data : (data.data || []);
}

/**
 * Create a new subscription plan (admin only)
 */
export async function createPlan(
  token: string,
  data: Partial<Omit<SubscriptionPlan, "id">>
): Promise<SubscriptionPlan> {
  const res = await fetch(`${API_BASE}/billing/admin/plans`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(data),
    cache: "no-store",
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || `Failed to create plan: ${res.status}`);
  }

  return res.json();
}

/**
 * Update a subscription plan (admin only)
 */
export async function updatePlan(
  token: string,
  planId: string,
  data: Partial<Omit<SubscriptionPlan, "id" | "plan_key">>
): Promise<SubscriptionPlan> {
  const res = await fetch(`${API_BASE}/billing/admin/plans/${planId}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(data),
    cache: "no-store",
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || `Failed to update plan: ${res.status}`);
  }

  return res.json();
}

/**
 * Toggle a plan active/inactive (admin only)
 */
export async function togglePlanActive(
  token: string,
  planId: string
): Promise<SubscriptionPlan> {
  const res = await fetch(`${API_BASE}/billing/admin/plans/${planId}/toggle`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    cache: "no-store",
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || `Failed to toggle plan: ${res.status}`);
  }

  return res.json();
}

/**
 * Delete a plan (admin only — only if no active subscriptions)
 */
export async function deletePlan(token: string, planId: string): Promise<{ deleted: boolean }> {
  const res = await fetch(`${API_BASE}/billing/admin/plans/${planId}`, {
    method: "DELETE",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    cache: "no-store",
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || `Failed to delete plan: ${res.status}`);
  }

  return res.json();
}

/**
 * Reorder plans (admin only)
 */
export async function reorderPlans(
  token: string,
  planIds: string[]
): Promise<SubscriptionPlan[]> {
  const res = await fetch(`${API_BASE}/billing/admin/plans/reorder`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ plan_ids: planIds }),
    cache: "no-store",
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || `Failed to reorder plans: ${res.status}`);
  }

  return res.json();
}

/**
 * Fetch platform pricing metrics (admin only)
 */
export async function fetchPricingMetrics(token: string) {
  const res = await fetch(`${API_BASE}/billing/admin/plans/metrics`, {
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    cache: "no-store",
  });

  if (!res.ok) {
    throw new Error(`Failed to fetch pricing metrics: ${res.status}`);
  }

  return res.json();
}

// ─── Utility Helpers ─────────────────────────────────────────────────────────

export function formatPrice(
  priceUsd: number | null,
  options: { period?: "monthly" | "annual"; prefix?: string } = {}
): string {
  if (priceUsd === null) return "Custom";
  if (priceUsd === 0) return "Free";

  const { period = "monthly" } = options;
  const formatted = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(priceUsd);

  return period === "monthly" ? `${formatted}/mo` : `${formatted}/yr`;
}

export function getPlanDisplayPrice(
  plan: SubscriptionPlan,
  billing: "monthly" | "annual" = "monthly"
): { amount: number | null; formatted: string; subtext: string } {
  const price =
    billing === "annual" ? plan.price_annual_usd : plan.price_monthly_usd;

  if (price === null) {
    return { amount: null, formatted: "Custom", subtext: "Contact us for pricing" };
  }
  if (price === 0) {
    return { amount: 0, formatted: "Free", subtext: "No credit card required" };
  }

  const monthly =
    billing === "annual" ? Math.round((price / 12) * 100) / 100 : price;

  return {
    amount: price,
    formatted: `$${monthly}`,
    subtext:
      billing === "annual"
        ? `$${price}/year — save ${Math.round((1 - price / (plan.price_monthly_usd! * 12)) * 100)}%`
        : "per month",
  };
}

export function getLimitDisplay(val: number | null, unit = ""): string {
  if (val === null) return "Unlimited";
  if (val === -1) return "None";
  return `${val}${unit ? " " + unit : ""}`;
}

// Reviewed: 2026-06-13 — 24Therapy audit
