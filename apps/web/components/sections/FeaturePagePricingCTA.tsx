import Link from "next/link";
import { ArrowRight, CheckCircle2, Zap } from "lucide-react";

interface Props {
  headline?: string;
  subheadline?: string;
}

const PLANS = [
  {
    key: "payg",
    name: "Pay As You Go",
    price: "$6",
    sub: "per session · first free",
    features: ["AI notes + transcription", "HIPAA video sessions", "Crisis safety net"],
    featured: false,
    enterprise: false,
  },
  {
    key: "starter",
    name: "Starter",
    price: "$59",
    sub: "/mo · ~$3/session",
    features: ["20 sessions/month", "Session rollover bank", "Radar matching + BAA"],
    featured: false,
    enterprise: false,
  },
  {
    key: "unlimited",
    name: "Unlimited",
    price: "$99",
    sub: "/mo · unlimited sessions",
    features: ["Unlimited sessions", "Full analytics + emotional AI", "Priority processing"],
    featured: true,
    enterprise: false,
  },
  {
    key: "enterprise",
    name: "Enterprise",
    price: "Custom",
    sub: "volume discount",
    features: ["Multi-therapist discount", "White-label + API access", "EHR connector + SSO"],
    featured: false,
    enterprise: true,
  },
] as const;

export function FeaturePagePricingCTA({ headline, subheadline }: Props) {
  return (
    <section className="py-20 bg-gradient-to-br from-[#071A33] via-[#0A2342] to-[#0D2A4A] relative overflow-hidden">
      {/* Background blobs */}
      <div className="absolute top-0 right-0 w-80 h-80 bg-[#2EC4B6]/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-64 h-64 bg-[#1F5EFF]/10 rounded-full blur-3xl pointer-events-none" />
      <div
        className="absolute inset-0 opacity-[0.03] pointer-events-none"
        style={{
          backgroundImage:
            "radial-gradient(circle at 1px 1px, rgba(255,255,255,0.8) 1px, transparent 0)",
          backgroundSize: "28px 28px",
        }}
      />

      <div className="relative z-10 max-w-6xl mx-auto px-6">
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 bg-white/10 border border-white/20 rounded-full px-4 py-1.5 mb-5">
            <Zap className="w-3.5 h-3.5 text-[#2EC4B6]" />
            <span className="text-xs font-medium text-white/80">Simple pricing, no surprises</span>
          </div>
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-3">
            {headline ?? "Start Free — Scale as You Grow"}
          </h2>
          <p className="text-white/60 text-lg">
            {subheadline ?? "First session on us. No credit card required. Cancel anytime."}
          </p>
        </div>

        {/* Plan cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
          {PLANS.map((plan) => (
            <div
              key={plan.key}
              className={[
                "rounded-2xl p-5 flex flex-col",
                plan.featured
                  ? "bg-[#1F5EFF] border-2 border-[#4D8EFF] shadow-lg shadow-[#1F5EFF]/20"
                  : "bg-white/8 border border-white/15",
              ].join(" ")}
            >
              {plan.featured && (
                <div className="text-xs font-bold text-white/90 bg-white/20 rounded-full px-3 py-1 self-start mb-3">
                  ⭐ Most Popular
                </div>
              )}
              <div className="mb-4">
                <div className="flex items-baseline gap-1 mb-1">
                  <span className="text-2xl font-bold text-white">{plan.price}</span>
                  <span className="text-xs text-white/50">{plan.sub}</span>
                </div>
                <div className="text-sm font-semibold text-white/90">{plan.name}</div>
              </div>
              <ul className="space-y-1.5 mb-5 flex-1">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-xs text-white/70">
                    <CheckCircle2 className="w-3.5 h-3.5 text-[#2EC4B6] shrink-0 mt-0.5" />
                    {f}
                  </li>
                ))}
              </ul>
              <Link
                href={plan.enterprise ? "/contact?type=enterprise" : "/signup?role=therapist"}
                className={[
                  "block text-center py-2.5 rounded-xl text-xs font-semibold transition-all",
                  plan.featured
                    ? "bg-white text-[#1F5EFF] hover:bg-white/90"
                    : "bg-white/15 text-white hover:bg-white/25",
                ].join(" ")}
              >
                {plan.enterprise ? "Contact Sales" : "Get Started Free"}
              </Link>
            </div>
          ))}
        </div>

        {/* Footer strip */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 border-t border-white/10 pt-8">
          <p className="text-white/40 text-sm text-center sm:text-left">
            Crisis safety net included on every plan · HIPAA compliant from day one
          </p>
          <Link
            href="/pricing"
            className="inline-flex items-center gap-2 text-[#2EC4B6] text-sm font-semibold hover:text-[#4FD4C8] transition-colors"
          >
            See full pricing comparison
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </div>
    </section>
  );
}
