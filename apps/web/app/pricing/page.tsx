import Link from "next/link";
import {
  CheckCircle2, X, ArrowRight, Zap, Users, Building2,
  Shield, Brain, Star, HelpCircle, Clock, Globe, Heart,
  AlertCircle
} from "lucide-react";
import {
  fetchPublicPlans,
  getPlanDisplayPrice,
  getLimitDisplay,
  type SubscriptionPlan,
} from "@/lib/pricing-api";

// ─── Plan key normalizer ──────────────────────────────────────────────────────
function getPlanKey(plan: SubscriptionPlan): string {
  const name = (plan.name || plan.plan_key || '').toLowerCase();
  if (name.includes('payg') || name.includes('pay_as_you_go') || name.includes('pay as') || name.includes('pay per') || plan.plan_key === 'pay_per_session') return 'payg';
  if (name.includes('starter')) return 'starter';
  if (name.includes('unlimited') || plan.plan_key === 'pro') return 'unlimited';
  if (name.includes('practice') || name.includes('enterprise')) return 'practice';
  return 'starter';
}

// ─── Per-plan hero metrics ────────────────────────────────────────────────────
const PLAN_HERO_METRICS: Record<string, { headline: string; sub: string }> = {
  payg:      { headline: "$6/session", sub: "first one free" },
  starter:   { headline: "$59/mo", sub: "20 sessions (~$3 each)" },
  unlimited: { headline: "$99/mo", sub: "unlimited sessions" },
  practice:  { headline: "$189/2 seats", sub: "from $94.50/seat" },
};

// ─── Included / excluded feature lists ───────────────────────────────────────
const PLAN_FEATURES_MAP: Record<string, { included: string[]; excluded: string[] }> = {
  payg: {
    included: [
      "First session free",
      "AI session notes & scribe",
      "Live transcription",
      "Crisis safety net (always-on)",
      "HIPAA-compliant video",
      "5 AI assistant messages/session",
      "Patient portal access",
    ],
    excluded: [
      "Radar patient matching",
      "Session rollover",
      "Unlimited AI assistant",
      "Analytics dashboard",
      "Priority AI processing",
    ],
  },
  starter: {
    included: [
      "Everything in Pay-as-you-go",
      "20 sessions included (~$3/session)",
      "Session rollover bank",
      "Unlimited AI assistant",
      "Radar patient matching",
      "Business Associate Agreement (BAA)",
    ],
    excluded: [
      "Analytics dashboard",
      "Emotional history tracking",
      "Priority AI processing",
      "Custom branding",
    ],
  },
  unlimited: {
    included: [
      "Everything in Starter",
      "Unlimited sessions",
      "Analytics dashboard",
      "Emotional history tracking",
      "Priority AI processing",
      "Custom branding",
    ],
    excluded: [
      "Team management",
      "SSO / SAML login",
      "API access",
    ],
  },
  practice: {
    included: [
      "Everything in Unlimited",
      "Team management",
      "Consolidated billing",
      "Multi-location support",
      "Onboarding support",
    ],
    excluded: [
      "SSO / SAML login",
      "Custom AI model",
    ],
  },
};

const CRISIS_NOTE = "Crisis safety net included on ALL plans — 988 always available";

// ─── FAQ (static — managed in code, not in DB) ────────────────────────────────
const FAQS = [
  {
    q: "Is my patient data secure and HIPAA compliant?",
    a: "Yes. We are fully HIPAA compliant with end-to-end encryption, BAA agreements, audit trails, and role-based access control. Your patient data is never used to train AI models.",
  },
  {
    q: "Does the AI replace clinical judgment?",
    a: "No — and this is fundamental to how we operate. AI generates notes, suggestions, and insights. The therapist always reviews, edits, and approves everything. The AI assists; the clinician decides.",
  },
  {
    q: "What note formats are supported?",
    a: "SOAP, DAP, BIRP, Progress Notes, Psychotherapy Notes, Insurance Notes, Treatment Plans, Referral Letters, Consultation Reports, and custom templates.",
  },
  {
    q: "Can I use 24Therapy with my existing EHR?",
    a: "Practice and Enterprise plans include EHR integration support. We are actively building integrations with Epic, SimplePractice, TherapyNotes, and others.",
  },
  {
    q: "How does Radar patient matching work?",
    a: "Radar is our real-time patient-to-therapist matching system. When someone needs support, they're matched based on specialization, availability, language, and clinical need.",
  },
  {
    q: "What languages are supported?",
    a: "AI transcription and notes support English, Spanish, French, Arabic, and 40+ additional languages.",
  },
];

// ─── Feature label mapping ─────────────────────────────────────────────────────
const FEATURE_LABELS: Record<string, string> = {
  radar: "Radar patient matching",
  api_access: "API access",
  white_label: "White-label branding",
  advanced_analytics: "Advanced analytics dashboard",
  custom_branding: "Custom branding",
  hipaa_baa: "HIPAA Business Associate Agreement",
  sso: "SSO / SAML",
  ehr_integration: "EHR integration",
  dedicated_support: "Dedicated support manager",
  custom_ai: "Custom AI models",
  multi_location: "Multi-location management",
  video_rooms: "HIPAA video rooms",
  mobile_app: "Patient mobile app",
};

// ─── Core features shown for all plans ────────────────────────────────────────
const CORE_FEATURES = [
  "AI Note Generation (SOAP/DAP/BIRP)",
  "Session Transcription",
  "Patient profiles & clinical history",
  "PHQ-9 & GAD-7 Assessments",
  "Appointment scheduling",
  "Basic billing tracking",
  "Email support",
];

// ─── Enterprise section features (static) ────────────────────────────────────
const ENTERPRISE_FEATURES = [
  "Unlimited therapists",
  "Unlimited patients",
  "White-label branding",
  "Custom AI model configuration",
  "Dedicated account manager",
  "SSO / SAML",
  "Custom SLA & contracts",
  "API & EHR integration",
  "On-premise deployment option",
  "Full audit trail & compliance",
];

// ─── Plan Card ────────────────────────────────────────────────────────────────
function PlanCard({ plan, showSavingsStrip }: { plan: SubscriptionPlan; showSavingsStrip?: boolean }) {
  const isHighlighted = plan.is_featured;
  const price = getPlanDisplayPrice(plan, "monthly");
  const planKey = getPlanKey(plan);
  const heroMetric = PLAN_HERO_METRICS[planKey];
  const planFeatures = PLAN_FEATURES_MAP[planKey];
  // price_monthly_usd is the canonical field; fall back to any backend alias
  const displayPrice = plan.price_monthly_usd ?? (plan as any).monthly_price_usd ?? (plan as any).price;

  return (
    <div
      className={[
        "rounded-2xl border-2 overflow-hidden flex flex-col",
        isHighlighted
          ? "border-[#1F5EFF] bg-[#0A2342] shadow-2xl shadow-[#0A2342]/30 scale-[1.02]"
          : "border-slate-200 bg-white shadow-sm",
      ].join(" ")}
    >
      {plan.badge_text && (
        <div className="bg-[#1F5EFF] text-white text-center py-2 text-sm font-semibold">
          ⭐ {plan.badge_text}
        </div>
      )}
      <div className="p-6 flex flex-col flex-1">
        <h3
          className={[
            "text-2xl font-bold mb-1",
            isHighlighted ? "text-white" : "text-[#0A2342]",
          ].join(" ")}
        >
          {plan.name}
        </h3>
        {plan.tagline && (
          <p
            className={[
              "text-sm mb-4",
              isHighlighted ? "text-white/60" : "text-slate-500",
            ].join(" ")}
          >
            {plan.tagline}
          </p>
        )}

        {/* Hero metric — value display */}
        {heroMetric && (
          <div className={[
            "rounded-xl px-4 py-3 mb-5",
            isHighlighted ? "bg-[#1F5EFF]/20 border border-[#1F5EFF]/30" : "bg-slate-50 border border-slate-200",
          ].join(" ")}>
            <span className={["text-xl font-bold", isHighlighted ? "text-white" : "text-[#0A2342]"].join(" ")}>
              {heroMetric.headline}
            </span>
            <span className={["text-xs ml-2", isHighlighted ? "text-white/60" : "text-slate-500"].join(" ")}>
              — {heroMetric.sub}
            </span>
          </div>
        )}

        {/* Pricing */}
        <div className="mb-5">
          {price.amount === null ? (
            <div>
              <span className={["text-4xl font-bold", isHighlighted ? "text-white" : "text-[#0A2342]"].join(" ")}>
                Custom
              </span>
              <p className={["text-xs mt-1", isHighlighted ? "text-white/50" : "text-slate-400"].join(" ")}>
                Contact us for pricing
              </p>
            </div>
          ) : (
            <div>
              <div className="flex items-baseline gap-1">
                <span className={["text-5xl font-bold", isHighlighted ? "text-white" : "text-[#0A2342]"].join(" ")}>
                  ${displayPrice ?? price.amount}
                </span>
                <span className={["text-sm", isHighlighted ? "text-white/60" : "text-slate-500"].join(" ")}>
                  /month
                </span>
              </div>
              {plan.price_annual_usd && (
                <p className={["text-xs mt-1", isHighlighted ? "text-white/50" : "text-slate-400"].join(" ")}>
                  ${Math.round(plan.price_annual_usd / 12)}/month billed annually
                </p>
              )}
            </div>
          )}
        </div>

        {/* CTA */}
        <Link
          href={price.amount === null ? "/contact?type=enterprise" : "/signup?role=therapist"}
          className={[
            "w-full py-3.5 rounded-xl font-semibold text-sm text-center block mb-5 transition-all",
            isHighlighted
              ? "bg-[#1F5EFF] text-white hover:bg-[#1649D4]"
              : "bg-[#0A2342] text-white hover:bg-[#123A63]",
          ].join(" ")}
        >
          {plan.cta_text || "Get Started Free"}
        </Link>

        {plan.plan_key === "pay_per_session" && (
          <p className={["text-xs text-center mb-4 -mt-3", isHighlighted ? "text-white/40" : "text-slate-400"].join(" ")}>
            First session free · No credit card required
          </p>
        )}

        {/* Savings strip — shown below Starter only */}
        {showSavingsStrip && (
          <div className="mb-4 rounded-lg bg-emerald-50 border border-emerald-200 px-3 py-2 text-xs text-emerald-800">
            💰 20 × $6 = $120 as PAYG → Starter $59 — <strong>save $61/mo</strong>
          </div>
        )}

        {/* Included / excluded feature lists */}
        {planFeatures ? (
          <div className={["mt-auto pt-4 border-t space-y-1", isHighlighted ? "border-white/10" : "border-slate-100"].join(" ")}>
            {planFeatures.included.map((f) => (
              <div key={f} className={["flex items-start gap-2 py-0.5 text-xs", isHighlighted ? "text-white/80" : "text-slate-600"].join(" ")}>
                <CheckCircle2 className={["w-3.5 h-3.5 shrink-0 mt-0.5", isHighlighted ? "text-emerald-400" : "text-emerald-500"].join(" ")} />
                <span>{f}</span>
              </div>
            ))}
            {planFeatures.excluded.map((f) => (
              <div key={f} className={["flex items-start gap-2 py-0.5 text-xs", isHighlighted ? "text-white/40" : "text-slate-400"].join(" ")}>
                <X className="w-3.5 h-3.5 shrink-0 mt-0.5 text-slate-300" />
                <span>{f}</span>
              </div>
            ))}
          </div>
        ) : (
          <>
            {/* Fallback: core features */}
            <div className="space-y-1 mb-4">
              {CORE_FEATURES.map((f) => (
                <div
                  key={f}
                  className={[
                    "flex items-center gap-2 py-1.5 text-xs",
                    isHighlighted ? "text-white/80" : "text-slate-600",
                  ].join(" ")}
                >
                  <CheckCircle2
                    className={["w-3.5 h-3.5 shrink-0", isHighlighted ? "text-emerald-400" : "text-emerald-500"].join(" ")}
                  />
                  <span>{f}</span>
                </div>
              ))}
            </div>
            <div className={["flex items-center gap-2 py-1.5 text-xs mb-1", isHighlighted ? "text-white/80" : "text-slate-600"].join(" ")}>
              <CheckCircle2 className={["w-3.5 h-3.5 shrink-0", isHighlighted ? "text-emerald-400" : "text-emerald-500"].join(" ")} />
              <span>Up to {getLimitDisplay(plan.max_patients)} active patients</span>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ─── Page (Server Component — fetches real pricing data) ─────────────────────
export default async function PricingPage() {
  const { plans, error, source } = await fetchPublicPlans();

  // Filter out enterprise from main cards (shown separately)
  const mainPlans = plans.filter((p) => p.plan_key !== "enterprise" && p.is_active);
  const enterprisePlan = plans.find((p) => p.plan_key === "enterprise");

  // Collect all add-ons across plans (deduplicated by name)
  const allAddOns = plans
    .flatMap((p) => p.add_ons || [])
    .reduce(
      (acc, addon) => {
        if (!acc.find((a) => a.name === addon.name)) acc.push(addon);
        return acc;
      },
      [] as Array<{ name: string; price: string; description: string }>
    );

  return (
    <main className="min-h-screen bg-white">

      {/* Fallback notice */}
      {source === "fallback" && (
        <div className="bg-amber-50 border-b border-amber-200 px-4 py-2 flex items-center justify-center gap-2 text-sm text-amber-700">
          <AlertCircle className="w-4 h-4" />
          {error || "Pricing data may not be fully up to date. Contact us for the latest pricing."}
        </div>
      )}

      {/* Hero — dark navy baseline */}
      <section className="relative overflow-hidden pt-28 pb-16 bg-gradient-to-br from-[#071A33] via-[#0A2342] to-[#0D2A4A] text-white">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-[#1F5EFF]/15 rounded-full blur-3xl" />
          <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-[#2EC4B6]/10 rounded-full blur-3xl" />
          <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: "radial-gradient(circle at 1px 1px, rgba(255,255,255,0.8) 1px, transparent 0)", backgroundSize: "32px 32px" }} />
        </div>
        <div className="relative z-10 max-w-4xl mx-auto px-4 text-center">
          <div className="inline-flex items-center gap-2 bg-white/8 border border-white/15 rounded-full px-4 py-2 text-sm text-white/80 mb-6">
            <Star className="w-4 h-4" />
            First session free · No credit card required
          </div>
          <h1 className="text-5xl md:text-6xl font-bold text-white mb-5">
            Simple Pricing.{" "}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#4D8EFF] via-[#2EC4B6] to-[#4D8EFF]">
              Serious Clinical AI.
            </span>
          </h1>
          <p className="text-xl text-white/70 mb-8">
            Pay as you go or subscribe. First session on us. Annual billing saves 2 months.
          </p>
        </div>
        {/* Wave transition */}
        <div className="absolute bottom-0 left-0 w-full overflow-hidden leading-none">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1440 60" preserveAspectRatio="none" className="w-full h-12">
            <path d="M0,30 C360,60 720,0 1080,30 C1260,45 1380,20 1440,30 L1440,60 L0,60 Z" fill="white" />
          </svg>
        </div>
      </section>

      {/* Plans */}
      <section className="pb-20">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          {mainPlans.length === 0 ? (
            <div className="text-center py-16 text-slate-500">
              <p className="text-xl mb-4">Pricing information coming soon.</p>
              <Link
                href="/contact"
                className="inline-flex items-center gap-2 bg-[#1F5EFF] text-white font-semibold px-6 py-3 rounded-2xl hover:bg-[#1649D4] transition-all"
              >
                Contact Us <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          ) : (
            <>
              <div className={`grid grid-cols-1 gap-6 ${
                mainPlans.length <= 2
                  ? "md:grid-cols-2"
                  : mainPlans.length === 4
                  ? "md:grid-cols-2 lg:grid-cols-4"
                  : mainPlans.length >= 5
                  ? "md:grid-cols-2 xl:grid-cols-3"
                  : "md:grid-cols-3"
              }`}>
                {mainPlans.map((plan) => (
                  <PlanCard
                    key={plan.id}
                    plan={plan}
                    showSavingsStrip={getPlanKey(plan) === 'starter'}
                  />
                ))}
              </div>

              {/* Crisis safety note */}
              <div className="mt-8 flex items-center justify-center gap-2 bg-emerald-50 border border-emerald-200 rounded-2xl px-6 py-4 text-emerald-800 text-sm font-medium">
                <Shield className="w-4 h-4 text-emerald-600 shrink-0" />
                {CRISIS_NOTE}
              </div>
            </>
          )}

          {/* Enterprise */}
          <div className="mt-8 bg-gradient-to-r from-slate-900 to-slate-800 rounded-2xl p-8 text-white">
            <div className="flex flex-col lg:flex-row items-start lg:items-center gap-8">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-3">
                  <Building2 className="w-6 h-6 text-[#24C8DB]" />
                  <h3 className="text-2xl font-bold">
                    {enterprisePlan?.name || "Enterprise"}
                  </h3>
                </div>
                <p className="text-white/60 mb-4">
                  {enterprisePlan?.tagline ||
                    "Custom pricing for large organizations, health systems, insurance networks, and enterprise deployments."}
                </p>
                <div className="grid grid-cols-2 gap-2">
                  {ENTERPRISE_FEATURES.map((f) => (
                    <div key={f} className="flex items-center gap-2 text-xs text-white/70">
                      <CheckCircle2 className="w-3 h-3 text-emerald-400 shrink-0" />
                      {f}
                    </div>
                  ))}
                </div>
              </div>
              <div className="shrink-0">
                <Link
                  href="/contact?type=enterprise"
                  className="inline-flex items-center gap-2 bg-[#1F5EFF] text-white font-semibold px-8 py-4 rounded-2xl hover:bg-[#1649D4] transition-all"
                >
                  {enterprisePlan?.cta_text || "Contact Sales"}{" "}
                  <ArrowRight className="w-5 h-5" />
                </Link>
                <p className="text-xs text-white/40 text-center mt-2">Typically 2-day response</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Add-ons */}
      {allAddOns.length > 0 && (
        <section className="py-16 bg-slate-50">
          <div className="max-w-4xl mx-auto px-4">
            <h2 className="text-3xl font-bold text-[#0A2342] mb-3 text-center">Optional Add-ons</h2>
            <p className="text-slate-500 text-center mb-10">
              Enhance any plan with additional capabilities
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {allAddOns.map((addon) => (
                <div
                  key={addon.name}
                  className="bg-white rounded-2xl border border-slate-200 p-5 flex justify-between items-start"
                >
                  <div>
                    <h4 className="font-semibold text-[#0A2342]">{addon.name}</h4>
                    <p className="text-sm text-slate-500 mt-1">{addon.description}</p>
                  </div>
                  <span className="text-sm font-bold text-[#1F5EFF] shrink-0 ml-4">
                    {addon.price}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* FAQ */}
      <section className="py-20 bg-white">
        <div className="max-w-3xl mx-auto px-4">
          <h2 className="text-3xl font-bold text-[#0A2342] mb-12 text-center">
            Frequently Asked Questions
          </h2>
          <div className="space-y-4">
            {FAQS.map((faq) => (
              <div
                key={faq.q}
                className="bg-slate-50 rounded-2xl p-6 border border-slate-200"
              >
                <div className="flex items-start gap-3">
                  <HelpCircle className="w-5 h-5 text-[#1F5EFF] shrink-0 mt-0.5" />
                  <div>
                    <h4 className="font-semibold text-[#0A2342] mb-2">{faq.q}</h4>
                    <p className="text-slate-600 text-sm leading-relaxed">{faq.a}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Bottom CTA */}
      <section className="py-16 bg-gradient-to-br from-[#0A2342] to-[#1E4F8C] text-white">
        <div className="max-w-3xl mx-auto text-center px-4">
          <h2 className="text-3xl font-bold mb-4">Start Today — First Session Free</h2>
          <p className="text-white/70 mb-8">
            No credit card required. Pay as you go or subscribe. Cancel anytime.
          </p>
          <div className="flex flex-wrap gap-4 justify-center">
            <Link
              href="/signup?role=therapist"
              className="inline-flex items-center gap-2 bg-[#1F5EFF] text-white font-semibold px-8 py-4 rounded-2xl hover:bg-[#1649D4] transition-all"
            >
              Get Started Free <ArrowRight className="w-5 h-5" />
            </Link>
            <Link
              href="/demo"
              className="inline-flex items-center gap-2 bg-white/10 text-white font-semibold px-8 py-4 rounded-2xl border border-white/20 hover:bg-white/20 transition-all"
            >
              Book a Demo
            </Link>
          </div>
          <p className="text-white/40 text-sm mt-6 flex items-center justify-center gap-2">
            <Shield className="w-4 h-4" /> HIPAA Compliant · SOC 2 Type II · End-to-End Encrypted
          </p>
        </div>
      </section>

    </main>
  );
}
