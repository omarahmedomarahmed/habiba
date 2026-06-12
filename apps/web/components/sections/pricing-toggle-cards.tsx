"use client";

import { useState } from "react";
import Link from "next/link";
import { Check, User, Zap, Users, Building2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { SubscriptionPlan } from "@/lib/pricing-api";

const PLAN_ICONS: Record<string, React.ElementType> = {
  starter: User,
  free: User,
  professional: Zap,
  practice: Users,
  enterprise: Building2,
};

function getPlanIcon(planKey: string): React.ElementType {
  return PLAN_ICONS[planKey] ?? Zap;
}

function getPlanCtaHref(plan: SubscriptionPlan): string {
  if (plan.plan_key === "enterprise") return "/contact?type=enterprise";
  if (plan.price_monthly_usd === 0) return "/signup";
  return "/signup";
}

interface PricingToggleCardsProps {
  plans: SubscriptionPlan[];
}

export function PricingToggleCards({ plans }: PricingToggleCardsProps) {
  const [isYearly, setIsYearly] = useState(false);

  return (
    <>
      {/* Billing toggle */}
      <div className="flex justify-center mb-10">
        <div className="inline-flex items-center gap-4 bg-white rounded-2xl p-1.5 border border-slate-200 shadow-sm">
          <button
            className={cn(
              "px-5 py-2 rounded-xl text-sm font-semibold transition-all",
              !isYearly ? "bg-[#0A2342] text-white shadow-sm" : "text-slate-600 hover:text-slate-900"
            )}
            onClick={() => setIsYearly(false)}
          >
            Monthly
          </button>
          <button
            className={cn(
              "px-5 py-2 rounded-xl text-sm font-semibold transition-all",
              isYearly ? "bg-[#0A2342] text-white shadow-sm" : "text-slate-600 hover:text-slate-900"
            )}
            onClick={() => setIsYearly(true)}
          >
            Yearly
            <span className="ml-2 bg-green-100 text-green-700 text-xs px-2 py-0.5 rounded-full">
              Save 17%
            </span>
          </button>
        </div>
      </div>

      {/* Plans grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {plans.map((plan) => {
          const Icon = getPlanIcon(plan.plan_key);
          const isEnterprise = plan.plan_key === "enterprise" || plan.price_monthly_usd === null;
          const isFree = plan.price_monthly_usd === 0;
          const isFeatured = plan.is_featured;

          // Derive display price
          const monthlyPrice = isYearly
            ? (plan.price_annual_usd !== null ? Math.round(plan.price_annual_usd / 12) : null)
            : plan.price_monthly_usd;

          return (
            <div
              key={plan.id}
              className={cn(
                "relative bg-white rounded-3xl p-6 border-2 shadow-sm hover:shadow-md transition-shadow",
                isFeatured
                  ? "border-[#1F5EFF] shadow-lg shadow-[#1F5EFF]/10"
                  : "border-slate-200"
              )}
            >
              {/* Badge */}
              {(isFeatured && plan.badge_text) && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <span className="bg-[#1F5EFF] text-white text-xs font-bold px-4 py-1.5 rounded-full shadow-md">
                    {plan.badge_text}
                  </span>
                </div>
              )}

              {/* Plan header */}
              <div className="flex items-center gap-3 mb-4">
                <div className={cn(
                  "w-10 h-10 rounded-xl flex items-center justify-center",
                  isFeatured ? "bg-[#EEF2FF] text-[#1F5EFF]" : "bg-slate-100 text-slate-600"
                )}>
                  <Icon className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-[#0A2342]">{plan.name}</h3>
                  {plan.tagline && (
                    <p className="text-xs text-slate-500">{plan.tagline}</p>
                  )}
                </div>
              </div>

              {/* Price */}
              <div className="mb-4">
                {isEnterprise ? (
                  <div className="text-2xl font-bold text-[#0A2342]">Custom</div>
                ) : (
                  <div className="flex items-end gap-1">
                    <span className="text-4xl font-bold text-[#0A2342]">
                      ${monthlyPrice}
                    </span>
                    {!isFree && (
                      <span className="text-slate-500 mb-1">/mo</span>
                    )}
                    {isFree && (
                      <span className="text-slate-500 mb-1 text-sm">forever free</span>
                    )}
                  </div>
                )}
                {isYearly && !isEnterprise && !isFree && plan.price_annual_usd !== null && (
                  <p className="text-xs text-green-600 mt-0.5">
                    ${plan.price_annual_usd}/year — billed annually
                  </p>
                )}
                {plan.description && (
                  <p className="text-sm text-slate-600 mt-2">{plan.description}</p>
                )}
              </div>

              {/* CTA Button */}
              <Link
                href={getPlanCtaHref(plan)}
                className={cn(
                  "w-full block text-center py-3 rounded-xl font-semibold text-sm transition-all mb-6",
                  isFeatured
                    ? "bg-[#1F5EFF] text-white hover:bg-[#0A2342]"
                    : isEnterprise
                    ? "bg-slate-900 text-white hover:bg-slate-800"
                    : isFree
                    ? "bg-slate-100 text-slate-800 hover:bg-slate-200"
                    : "bg-[#0A2342] text-white hover:bg-[#0D2D57]"
                )}
              >
                {plan.cta_text || (isEnterprise ? "Contact Sales" : isFree ? "Get Started Free" : "Start Free Trial")}
              </Link>

              {/* Features — show plan-specific features from API */}
              <div className="space-y-2.5">
                {/* Max sessions / AI notes */}
                {plan.max_sessions_month !== undefined && plan.max_sessions_month !== null && (
                  <div className="flex items-start gap-2">
                    <Check className="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5" />
                    <span className="text-sm text-slate-700">
                      {plan.max_sessions_month} AI-scripted sessions/month
                    </span>
                  </div>
                )}
                {(plan.max_sessions_month === null && !isEnterprise) && (
                  <div className="flex items-start gap-2">
                    <Check className="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5" />
                    <span className="text-sm text-slate-700">Unlimited AI sessions</span>
                  </div>
                )}
                {/* Dynamic feature flags */}
                {plan.features?.radar && (
                  <div className="flex items-start gap-2">
                    <Check className="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5" />
                    <span className="text-sm text-slate-700">Radar patient matching</span>
                  </div>
                )}
                {plan.features?.advanced_analytics && (
                  <div className="flex items-start gap-2">
                    <Check className="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5" />
                    <span className="text-sm text-slate-700">Advanced analytics</span>
                  </div>
                )}
                {plan.features?.hipaa_baa && (
                  <div className="flex items-start gap-2">
                    <Check className="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5" />
                    <span className="text-sm text-slate-700">HIPAA BAA included</span>
                  </div>
                )}
                {plan.features?.white_label && (
                  <div className="flex items-start gap-2">
                    <Check className="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5" />
                    <span className="text-sm text-slate-700">White-label branding</span>
                  </div>
                )}
                {plan.features?.sso && (
                  <div className="flex items-start gap-2">
                    <Check className="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5" />
                    <span className="text-sm text-slate-700">SSO / SAML</span>
                  </div>
                )}
                {plan.features?.api_access && (
                  <div className="flex items-start gap-2">
                    <Check className="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5" />
                    <span className="text-sm text-slate-700">API access</span>
                  </div>
                )}
                {plan.features?.ehr_integration && (
                  <div className="flex items-start gap-2">
                    <Check className="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5" />
                    <span className="text-sm text-slate-700">EHR integration</span>
                  </div>
                )}
                {/* Max therapists */}
                {plan.max_therapists !== null && plan.max_therapists > 1 && (
                  <div className="flex items-start gap-2">
                    <Check className="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5" />
                    <span className="text-sm text-slate-700">
                      Up to {plan.max_therapists} therapists
                    </span>
                  </div>
                )}
                {plan.max_therapists === null && (
                  <div className="flex items-start gap-2">
                    <Check className="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5" />
                    <span className="text-sm text-slate-700">Unlimited therapists</span>
                  </div>
                )}
                {/* PAYG first-session-free callout */}
                {plan.plan_key === "pay_per_session" && (
                  <div className="flex items-start gap-2">
                    <Check className="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5" />
                    <span className="text-sm text-slate-700">First session free</span>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}
