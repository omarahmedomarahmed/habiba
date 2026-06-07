/**
 * PricingSection — Server Component
 *
 * Fetches live pricing from GET /billing/plans via pricing-api.ts.
 * Falls back to canonical seed data if the API is unreachable.
 * The billing toggle (monthly/yearly) is handled client-side by PricingToggleCards.
 */

import Link from "next/link";
import { fetchPublicPlans, type SubscriptionPlan } from "@/lib/pricing-api";
import { PricingToggleCards } from "@/components/sections/pricing-toggle-cards";

export async function PricingSection() {
  const { plans, source } = await fetchPublicPlans();

  // Inject "Starter / Free" plan at position 0 if API doesn't return one.
  // This plan is always free and is not stored in the billing DB.
  const hasFreePlan = plans.some(
    (p) => p.price_monthly_usd === 0 || p.plan_key === "starter" || p.plan_key === "free"
  );

  const starterPlan: SubscriptionPlan = {
    id: "starter",
    plan_key: "starter",
    name: "Starter",
    tagline: "Free forever for individuals",
    description: "Get started free. 10 AI-scripted sessions/month.",
    price_monthly_usd: 0,
    price_annual_usd: 0,
    max_therapists: 1,
    max_patients: 10,
    max_sessions_month: 10,
    ai_notes_included: 10,
    features: {
      radar: false,
      api_access: false,
      white_label: false,
      advanced_analytics: false,
      custom_branding: false,
      hipaa_baa: false,
    },
    stripe_price_id_monthly: null,
    stripe_price_id_annual: null,
    is_active: true,
    is_featured: false,
    badge_text: null,
    cta_text: "Get Started Free",
    trial_days: 0,
    add_ons: [],
    highlight_color: null,
    display_order: 0,
  };

  const allPlans = hasFreePlan ? plans : [starterPlan, ...plans];

  return (
    <section className="py-24 bg-[#F8FAFC]" id="pricing">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center max-w-3xl mx-auto mb-12">
          <h2 className="text-4xl sm:text-5xl font-bold text-[#0A2342] mb-4">
            Simple, Transparent Pricing
          </h2>
          <p className="text-xl text-slate-600 mb-8">
            Start free. Upgrade when you need more. Cancel anytime.
          </p>

          {source === "fallback" && (
            <p className="text-xs text-amber-600 bg-amber-50 border border-amber-100 rounded-lg px-3 py-1.5 inline-block mb-4">
              Showing cached pricing — live pricing unavailable
            </p>
          )}
        </div>

        {/* Plans — client component handles billing toggle */}
        <PricingToggleCards plans={allPlans} />

        {/* Marketplace note */}
        <div className="mt-12 text-center bg-white rounded-2xl p-6 border border-slate-200 shadow-sm max-w-2xl mx-auto">
          <p className="text-slate-700 font-medium">
            💡 Therapists also earn from the marketplace. 24Therapy takes a{" "}
            <strong className="text-[#1F5EFF]">15–20% platform fee</strong> per marketplace session.
            You keep the rest. Radar sessions have a small connection fee.
          </p>
        </div>

        {/* Full pricing page CTA */}
        <div className="mt-8 text-center">
          <Link
            href="/pricing"
            className="text-sm text-[#1F5EFF] hover:underline font-medium"
          >
            View full pricing details, feature comparison &amp; FAQs →
          </Link>
        </div>
      </div>
    </section>
  );
}
