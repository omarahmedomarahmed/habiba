/**
 * PricingSection — Server Component
 *
 * Fetches live pricing from GET /billing/plans via pricing-api.ts.
 * Falls back to canonical seed data if the API is unreachable.
 * The billing toggle (monthly/yearly) is handled client-side by PricingToggleCards.
 */

import Link from "next/link";
import { fetchPublicPlans } from "@/lib/pricing-api";
import { PricingToggleCards } from "@/components/sections/pricing-toggle-cards";

export async function PricingSection() {
  const { plans, source } = await fetchPublicPlans();

  // FALLBACK_PLANS now includes Free + Starter tiers; no injection needed.
  const allPlans = plans;

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

// Reviewed: 2026-06-13 — 24Therapy audit
