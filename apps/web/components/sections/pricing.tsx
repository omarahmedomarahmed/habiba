"use client";

import { useState } from "react";
import Link from "next/link";
import { Check, Zap, Building2, Users, User } from "lucide-react";
import { cn } from "@/lib/utils";

const plans = [
  {
    name: "Starter",
    icon: User,
    price: { monthly: 0, yearly: 0 },
    description: "Get started free. 10 AI-scripted sessions/month.",
    highlight: false,
    color: "border-slate-200",
    buttonStyle: "bg-slate-100 text-slate-800 hover:bg-slate-200",
    features: [
      "10 AI-scripted sessions/month",
      "Basic session transcription",
      "SOAP note generation",
      "Patient portal access",
      "Marketplace listing",
      "Email support",
    ],
    notIncluded: ["Live Copilot", "Patient Memory", "Radar Access", "Advanced Analytics"],
  },
  {
    name: "Professional",
    icon: Zap,
    price: { monthly: 99, yearly: 82 },
    description: "Unlimited AI for solo therapists. Everything you need.",
    highlight: true,
    badge: "Most Popular",
    color: "border-[#1F5EFF]",
    buttonStyle: "bg-[#1F5EFF] text-white hover:bg-[#0A2342]",
    features: [
      "Unlimited AI sessions",
      "All note formats (SOAP/DAP/BIRP)",
      "Live Clinical Copilot",
      "Patient Memory & Timeline",
      "Radar access (instant sessions)",
      "Full marketplace profile",
      "Assessment tools (PHQ-9, GAD-7, etc.)",
      "Advanced analytics",
      "Priority support",
    ],
    notIncluded: ["Multi-therapist team", "SSO", "White label"],
  },
  {
    name: "Practice",
    icon: Users,
    price: { monthly: 299, yearly: 249 },
    description: "For group practices with up to 15 therapists.",
    highlight: false,
    color: "border-slate-200",
    buttonStyle: "bg-[#0A2342] text-white hover:bg-[#0D2D57]",
    features: [
      "Everything in Professional",
      "Up to 15 therapists",
      "Shared patient management",
      "Team billing & payouts",
      "Practice analytics dashboard",
      "Admin & assistant accounts",
      "Shared billing management",
      "Custom branding",
      "Dedicated account manager",
    ],
    notIncluded: ["Custom contracts", "SSO", "White label"],
  },
  {
    name: "Enterprise",
    icon: Building2,
    price: null,
    description: "Custom pricing for hospitals and healthcare systems.",
    highlight: false,
    color: "border-slate-200",
    buttonStyle: "bg-slate-900 text-white hover:bg-slate-800",
    features: [
      "Everything in Practice",
      "Unlimited therapists",
      "SSO (SAML/OIDC)",
      "White label platform",
      "Custom domain",
      "FHIR/HL7 integrations",
      "Dedicated API access",
      "Custom analytics",
      "SLA guarantee",
      "Dedicated support team",
    ],
    notIncluded: [],
  },
];

export function PricingSection() {
  const [isYearly, setIsYearly] = useState(false);

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

          {/* Billing toggle */}
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
            const Icon = plan.icon;
            return (
              <div
                key={plan.name}
                className={cn(
                  "relative bg-white rounded-3xl p-6 border-2 shadow-sm hover:shadow-md transition-shadow",
                  plan.highlight ? "border-[#1F5EFF] shadow-lg shadow-[#1F5EFF]/10" : "border-slate-200"
                )}
              >
                {plan.highlight && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <span className="bg-[#1F5EFF] text-white text-xs font-bold px-4 py-1.5 rounded-full shadow-md">
                      {plan.badge}
                    </span>
                  </div>
                )}

                <div className="flex items-center gap-3 mb-4">
                  <div className={cn(
                    "w-10 h-10 rounded-xl flex items-center justify-center",
                    plan.highlight ? "bg-[#EEF2FF] text-[#1F5EFF]" : "bg-slate-100 text-slate-600"
                  )}>
                    <Icon className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-[#0A2342]">{plan.name}</h3>
                  </div>
                </div>

                <div className="mb-4">
                  {plan.price ? (
                    <div className="flex items-end gap-1">
                      <span className="text-4xl font-bold text-[#0A2342]">
                        ${isYearly && plan.price.yearly ? plan.price.yearly : plan.price.monthly}
                      </span>
                      {plan.price.monthly > 0 && (
                        <span className="text-slate-500 mb-1">/mo</span>
                      )}
                      {plan.price.monthly === 0 && (
                        <span className="text-slate-500 mb-1">Forever free</span>
                      )}
                    </div>
                  ) : (
                    <div className="text-2xl font-bold text-[#0A2342]">Custom</div>
                  )}
                  <p className="text-sm text-slate-600 mt-2">{plan.description}</p>
                </div>

                <Link
                  href={plan.price === null ? "/contact?type=enterprise" : "/signup"}
                  className={cn(
                    "w-full block text-center py-3 rounded-xl font-semibold text-sm transition-all mb-6",
                    plan.buttonStyle
                  )}
                >
                  {plan.price === null ? "Contact Sales" : plan.price.monthly === 0 ? "Get Started Free" : "Start Free Trial"}
                </Link>

                <div className="space-y-2.5">
                  {plan.features.map((feature) => (
                    <div key={feature} className="flex items-start gap-2">
                      <Check className="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5" />
                      <span className="text-sm text-slate-700">{feature}</span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        {/* Marketplace note */}
        <div className="mt-12 text-center bg-white rounded-2xl p-6 border border-slate-200 shadow-sm max-w-2xl mx-auto">
          <p className="text-slate-700 font-medium">
            💡 Therapists also earn from the marketplace. 24Therapy takes a{" "}
            <strong className="text-[#1F5EFF]">15-20% platform fee</strong> per marketplace session.
            You keep the rest. Radar sessions have a small connection fee.
          </p>
        </div>
      </div>
    </section>
  );
}
