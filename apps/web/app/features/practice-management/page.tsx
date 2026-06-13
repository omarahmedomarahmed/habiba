import {
  Users, Shield, BarChart3, DollarSign, UserPlus,
  Settings, Clock, Building2, Globe, CheckCircle,
} from "lucide-react";
import { ProductPageLayout } from "@/components/product/ProductPageLayout";

const FEATURE_ITEMS = [
  {
    icon: Users,
    title: "Multi-Therapist Organization",
    description:
      "Add unlimited therapists to your organization. Each therapist gets their own portal, patient list, session history, and AI tools — all under one organization account.",
    highlight: "Unlimited therapists",
  },
  {
    icon: Shield,
    title: "Role-Based Access Control",
    description:
      "Three roles: Owner, Therapist, and Admin. Control who can view patient data, approve notes, access billing, and manage team settings. HIPAA-aligned access controls.",
    highlight: "HIPAA-aligned RBAC",
  },
  {
    icon: Users,
    title: "Shared Patient Management",
    description:
      "Patients can be assigned to multiple therapists for co-treatment, supervision, or handoff. Coverage assignments ensure continuity when a therapist is unavailable.",
    highlight: "Co-treatment & coverage support",
  },
  {
    icon: DollarSign,
    title: "Centralized Billing",
    description:
      "One billing dashboard for the entire practice. Track revenue by therapist, service type, and insurance panel. Export reports for accounting, payroll, and insurance.",
    highlight: "Per-therapist revenue tracking",
  },
  {
    icon: BarChart3,
    title: "Practice Analytics",
    description:
      "Caseload utilization, outcome metrics, documentation compliance, and AI adoption across all therapists. See your practice performance at a glance.",
    highlight: "Practice-wide intelligence",
  },
  {
    icon: UserPlus,
    title: "Therapist Onboarding",
    description:
      "Invite a new therapist by email. They complete profile setup in minutes, and they're live on the marketplace and accepting patients the same day.",
    highlight: "Same-day onboarding",
  },
  {
    icon: Settings,
    title: "Organization Settings",
    description:
      "Custom intake forms, session templates, note approval workflows, and branding settings — configured once and applied across the entire practice.",
    highlight: "Practice-wide configuration",
  },
  {
    icon: Building2,
    title: "Multi-Location Support",
    description:
      "Run multiple clinic locations under one organization. Separate patient rosters, separate billing, unified reporting — designed for group practices and DSOs.",
    highlight: "Unlimited locations",
  },
];

const PLANS = [
  {
    tier: "Solo",
    therapists: "1 therapist",
    desc: "Everything you need to run a solo practice",
    features: ["AI Scribe", "Patient portal", "Scheduling", "Billing"],
  },
  {
    tier: "Group",
    therapists: "2–10 therapists",
    desc: "Collaborative tools for growing practices",
    features: ["All Solo features", "Team dashboard", "Shared patients", "Practice analytics"],
    highlight: true,
  },
  {
    tier: "Enterprise",
    therapists: "11+ therapists",
    desc: "Full infrastructure for large organizations",
    features: ["All Group features", "SSO / SAML", "Custom reporting", "Dedicated support"],
  },
];

const EXTRA = (
  <section className="py-16 bg-slate-50">
    <div className="max-w-4xl mx-auto px-6">
      <h2 className="text-2xl font-bold text-center text-slate-900 mb-8">Built for Every Practice Size</h2>
      <div className="grid md:grid-cols-3 gap-6">
        {PLANS.map((plan) => (
          <div
            key={plan.tier}
            className={`rounded-2xl border p-6 ${
              plan.highlight
                ? "bg-[#0A2342] border-[#1F5EFF]/30 text-white"
                : "bg-white border-slate-200 text-slate-900"
            }`}
          >
            <div className={`text-xs font-bold uppercase tracking-widest mb-1 ${plan.highlight ? "text-[#2EC4B6]" : "text-slate-400"}`}>
              {plan.tier}
            </div>
            <div className={`text-lg font-bold mb-1 ${plan.highlight ? "text-white" : "text-slate-900"}`}>
              {plan.therapists}
            </div>
            <p className={`text-sm mb-4 ${plan.highlight ? "text-white/70" : "text-slate-500"}`}>{plan.desc}</p>
            <ul className="space-y-2">
              {plan.features.map((f) => (
                <li key={f} className={`flex items-center gap-2 text-sm ${plan.highlight ? "text-white/80" : "text-slate-600"}`}>
                  <CheckCircle className={`w-4 h-4 flex-shrink-0 ${plan.highlight ? "text-[#2EC4B6]" : "text-green-500"}`} />
                  {f}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  </section>
);

export default function PracticeManagementPage() {
  return (
    <ProductPageLayout
      badgeIcon={Users}
      badgeLabel="Practice Management"
      badgeTag="Multi-Therapist"
      heroTitle={
        <>
          Everything Your Practice Needs.{" "}
          <span className="text-[#2EC4B6]">One Dashboard.</span>
        </>
      }
      heroSubtitle="Manage your entire therapy practice — from solo to enterprise. Multi-therapist teams, shared patients, centralized billing, and practice analytics all in one place."
      ctaPrimary={{ label: "Book a Demo", href: "/demo" }}
      ctaSecondary={{ label: "View Pricing", href: "/pricing" }}
      stats={[
        { value: "∞", label: "Therapists supported" },
        { value: "RBAC", label: "Access control" },
        { value: "Same day", label: "Therapist onboarding" },
        { value: "Multi-site", label: "Location support" },
      ]}
      featuresTitle="What Practice Management Includes"
      featuresSubtitle="From team onboarding to billing to analytics — everything a growing practice needs to run at scale."
      featureItems={FEATURE_ITEMS}
      featureColumns={4}
      extra={EXTRA}
      ctaIcon={Building2}
      ctaTitle="Scale Your Practice"
      ctaSubtitle="Whether you're adding your first associate or managing 50 therapists — 24Therapy grows with you. Book a demo to see it configured for your practice."
      ctaButtonLabel="Book a Demo"
      ctaButtonHref="/demo"
    />
  );
}

// Reviewed: 2026-06-13 — 24Therapy audit
