/**
 * pricing-api.ts — Centralized Pricing API Client
 *
 * Single source of truth for all pricing data.
 * All pricing pages must use this client — NO hardcoded prices.
 *
 * Backend endpoint: GET /billing/plans (public, no auth required)
 * Admin endpoint: GET /billing/admin/plans (requires super_admin role)
 */

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

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
    id: "fallback-professional",
    plan_key: "professional",
    name: "Professional",
    tagline: "Full AI-powered practice management",
    description: "Unlimited AI for solo therapists",
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
    },
    stripe_price_id_monthly: null,
    stripe_price_id_annual: null,
    is_active: true,
    is_featured: true,
    badge_text: "Most Popular",
    cta_text: "Start Free Trial",
    trial_days: 14,
    add_ons: [],
    highlight_color: null,
    display_order: 1,
  },
  {
    id: "fallback-practice",
    plan_key: "practice",
    name: "Practice",
    tagline: "Multi-therapist group practices",
    description: "Multi-therapist team plans",
    price_monthly_usd: 299,
    price_annual_usd: 2990,
    max_therapists: 10,
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
      multi_location: true,
    },
    stripe_price_id_monthly: null,
    stripe_price_id_annual: null,
    is_active: true,
    is_featured: false,
    badge_text: null,
    cta_text: "Start Free Trial",
    trial_days: 14,
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
    display_order: 3,
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

    const plans = await res.json();
    return {
      plans: Array.isArray(plans) ? plans : (plans.data || []),
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
