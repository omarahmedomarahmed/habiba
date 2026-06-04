import Link from "next/link";
import {
  Building2, Shield, Users, Zap, Globe, Lock, BarChart3,
  CheckCircle2, ArrowRight, Brain, Network, ChevronRight,
  Star, Award, Settings, Database, Code, Layers, Sparkles,
  Phone, Mail, Calendar, FileText, CreditCard, Activity
} from "lucide-react";

const ENTERPRISE_FEATURES = [
  {
    icon: Users,
    title: "Multi-Therapist Practice Management",
    description: "Full practice administration — manage multiple clinicians, supervise documentation, control permissions, and get practice-level analytics.",
    details: ["Role-based access control", "Supervisor review workflows", "Practice-wide analytics", "Staff scheduling tools"],
  },
  {
    icon: Globe,
    title: "White-Label Deployment",
    description: "Deploy 24Therapy under your brand. Custom domain, your logo, your colors. Patients see your practice brand, not ours.",
    details: ["Custom domain (clinic.yourpractice.com)", "Brand kit upload", "Custom onboarding flows", "Patient-facing whitelabel portal"],
  },
  {
    icon: Code,
    title: "API & Integration Suite",
    description: "Connect 24Therapy to your existing systems. EHR integration, CRM sync, billing platforms, and custom webhook support.",
    details: ["FHIR-compliant API", "HL7 support", "SimplePractice, TherapyNotes integration", "Salesforce, HubSpot CRM sync"],
  },
  {
    icon: Database,
    title: "HIPAA Business Associate Agreement",
    description: "Signed BAA included with all plans. Full HIPAA compliance documentation, audit logs, and compliance reporting.",
    details: ["BAA included", "SOC 2 Type II certified", "GDPR compliant (EU practices)", "Full audit trail"],
  },
  {
    icon: Brain,
    title: "AI Intelligence at Scale",
    description: "Deploy AI across your entire practice. Population-level clinical intelligence, practice-wide risk monitoring, and outcome analytics.",
    details: ["Practice-wide risk radar", "Population analytics", "Cohort outcome tracking", "AI model customization (enterprise)"],
  },
  {
    icon: Settings,
    title: "Dedicated Customer Success",
    description: "Enterprise clients get a dedicated CSM, priority support, custom onboarding, and quarterly business reviews.",
    details: ["Dedicated CSM", "< 2hr support SLA", "Custom onboarding", "Quarterly business reviews"],
  },
];

const PRACTICE_SIZES = [
  { label: "Solo Practice", therapists: "1", price: "$99/month", features: ["AI Scribe & Copilot", "Patient Memory Layer", "Crisis Radar", "50 active patients"] },
  { label: "Small Group", therapists: "2-10", price: "$79/therapist/month", features: ["Everything in Solo", "Practice dashboard", "Supervisor tools", "Team messaging"], popular: true },
  { label: "Large Group / Clinic", therapists: "11-50", price: "$65/therapist/month", features: ["Everything in Small Group", "White-label option", "Priority support", "Custom analytics"] },
  { label: "Health System / Enterprise", therapists: "50+", price: "Custom pricing", features: ["Full white-label", "EHR integration", "Dedicated CSM", "Custom AI models"] },
];

const TESTIMONIALS = [
  {
    quote: "We onboarded our 24-therapist team in two weeks. Documentation time across the practice dropped by 40% in the first month. The AI doesn't just save time — it makes our clinical work better.",
    name: "Dr. Robert Chen",
    role: "Clinical Director, Pacific Mind Clinic",
    practice_size: "24 therapists",
    initials: "RC",
  },
  {
    quote: "The white-label deployment was seamless. Our patients experience our brand entirely. And the enterprise analytics have given us visibility into clinical outcomes we never had before.",
    name: "Dr. Jennifer Walsh",
    role: "Founder & CEO, Serenity Mental Health Group",
    practice_size: "8 therapists",
    initials: "JW",
  },
  {
    quote: "As a group practice, the supervisor review workflows were critical for us. The AI clinical oversight tools have transformed our clinical governance.",
    name: "Dr. Maya Singh",
    role: "CEO, Mindful Path UK",
    practice_size: "12 therapists",
    initials: "MS",
  },
];

const INTEGRATIONS = [
  "SimplePractice", "TherapyNotes", "Epic", "Cerner", "Athenahealth",
  "Salesforce", "HubSpot", "Slack", "Microsoft Teams", "Google Workspace",
  "Stripe", "Square", "Clearinghouse EDI", "Waystar",
];

export default function EnterprisePage() {
  return (
    <div className="min-h-screen bg-white">
      {/* Hero */}
      <section className="bg-gradient-to-br from-[#0A2342] via-[#0d2d54] to-[#1a3a6b] text-white py-24">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div>
              <div className="flex items-center gap-2 mb-6">
                <Building2 className="h-5 w-5 text-[#2EC4B6]" />
                <span className="text-[#2EC4B6] text-sm font-semibold uppercase tracking-wide">Enterprise & Group Practices</span>
              </div>
              <h1 className="text-5xl font-bold mb-6 leading-tight">
                Mental Health AI for Your
                <span className="text-[#2EC4B6]"> Entire Practice</span>
              </h1>
              <p className="text-xl text-white/70 leading-relaxed mb-8">
                Scale clinical intelligence, documentation automation, and patient outcomes across your team. From solo practice to health systems.
              </p>
              <div className="flex flex-col sm:flex-row gap-3">
                <Link
                  href="#pricing"
                  className="flex items-center justify-center gap-2 px-8 py-3.5 bg-[#2EC4B6] text-white font-semibold rounded-2xl hover:bg-[#25a99d] transition-colors"
                >
                  View Plans <ArrowRight className="h-4 w-4" />
                </Link>
                <Link
                  href="#demo"
                  className="flex items-center justify-center gap-2 px-8 py-3.5 border border-white/30 text-white font-semibold rounded-2xl hover:bg-white/10 transition-colors"
                >
                  <Calendar className="h-4 w-4" /> Book Enterprise Demo
                </Link>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              {[
                { value: "500+", label: "Practices Deployed" },
                { value: "12,000+", label: "Therapists Active" },
                { value: "87%", label: "Avg Documentation Reduction" },
                { value: "40%", label: "Improved Clinical Capacity" },
              ].map((stat) => (
                <div key={stat.label} className="bg-white/10 rounded-2xl p-5 text-center border border-white/20">
                  <div className="text-3xl font-bold text-[#2EC4B6] mb-1">{stat.value}</div>
                  <div className="text-sm text-white/70">{stat.label}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Enterprise Features */}
      <section className="py-20 bg-gray-50">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-gray-900 mb-4">Built for Practice Scale</h2>
            <p className="text-xl text-gray-600 max-w-2xl mx-auto">Every feature purpose-built for group practices, multi-location clinics, and health systems.</p>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            {ENTERPRISE_FEATURES.map((feature) => {
              const Icon = feature.icon;
              return (
                <div key={feature.title} className="bg-white rounded-3xl p-6 border border-gray-200 hover:shadow-lg transition-all">
                  <div className="w-12 h-12 bg-[#0A2342]/10 rounded-2xl flex items-center justify-center mb-5">
                    <Icon className="h-6 w-6 text-[#0A2342]" />
                  </div>
                  <h3 className="font-bold text-xl text-gray-900 mb-3">{feature.title}</h3>
                  <p className="text-gray-600 mb-5 leading-relaxed">{feature.description}</p>
                  <ul className="space-y-2">
                    {feature.details.map((detail) => (
                      <li key={detail} className="flex items-center gap-2 text-sm text-gray-700">
                        <CheckCircle2 className="h-3.5 w-3.5 text-[#2EC4B6] shrink-0" />
                        {detail}
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Pricing tiers */}
      <section id="pricing" className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-gray-900 mb-4">Practice-Sized Plans</h2>
            <p className="text-xl text-gray-600">Flexible pricing that scales with your practice.</p>
          </div>
          <div className="grid md:grid-cols-4 gap-6">
            {PRACTICE_SIZES.map((tier) => (
              <div
                key={tier.label}
                className={`rounded-3xl p-6 border relative ${
                  tier.popular
                    ? "border-[#0A2342] bg-[#0A2342] text-white"
                    : "border-gray-200 bg-white"
                }`}
              >
                {tier.popular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-[#2EC4B6] text-white text-xs font-bold px-3 py-1 rounded-full">
                    Most Popular
                  </div>
                )}
                <div className={`text-xs font-bold uppercase tracking-wide mb-2 ${tier.popular ? "text-[#2EC4B6]" : "text-gray-400"}`}>
                  {tier.therapists} therapist{tier.therapists !== "1" ? "s" : ""}
                </div>
                <h3 className={`text-xl font-bold mb-2 ${tier.popular ? "text-white" : "text-gray-900"}`}>{tier.label}</h3>
                <div className={`text-2xl font-bold mb-6 ${tier.popular ? "text-[#2EC4B6]" : "text-[#0A2342]"}`}>
                  {tier.price}
                </div>
                <ul className="space-y-2.5 mb-6">
                  {tier.features.map((f) => (
                    <li key={f} className="flex items-start gap-2">
                      <CheckCircle2 className={`h-4 w-4 shrink-0 mt-0.5 ${tier.popular ? "text-[#2EC4B6]" : "text-emerald-600"}`} />
                      <span className={`text-sm ${tier.popular ? "text-white/80" : "text-gray-700"}`}>{f}</span>
                    </li>
                  ))}
                </ul>
                <Link
                  href={tier.therapists === "50+" ? "#demo" : "/for-therapists"}
                  className={`block w-full py-3 rounded-2xl text-center font-semibold text-sm transition-colors ${
                    tier.popular
                      ? "bg-[#2EC4B6] text-white hover:bg-[#25a99d]"
                      : "bg-[#0A2342] text-white hover:bg-[#123A63]"
                  }`}
                >
                  {tier.therapists === "50+" ? "Contact Sales" : "Start Free Trial"}
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="py-20 bg-gray-50">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-gray-900 mb-4">Trusted by Leading Practices</h2>
          </div>
          <div className="grid md:grid-cols-3 gap-8">
            {TESTIMONIALS.map((t) => (
              <div key={t.name} className="bg-white rounded-3xl p-8 border border-gray-200 hover:shadow-md transition-all">
                <div className="flex gap-1 mb-5">
                  {[...Array(5)].map((_, i) => (
                    <Star key={i} className="h-4 w-4 text-amber-400 fill-amber-400" />
                  ))}
                </div>
                <p className="text-gray-700 leading-relaxed mb-6 text-base italic">"{t.quote}"</p>
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 bg-[#0A2342] rounded-xl flex items-center justify-center text-white font-bold">
                    {t.initials}
                  </div>
                  <div>
                    <div className="font-semibold text-gray-900 text-sm">{t.name}</div>
                    <div className="text-xs text-gray-500">{t.role}</div>
                    <div className="text-xs text-[#2EC4B6] font-medium">{t.practice_size}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Integrations */}
      <section className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-12">
            <h2 className="text-4xl font-bold text-gray-900 mb-4">Integrates With Your Stack</h2>
            <p className="text-xl text-gray-600">Connect seamlessly with your existing EHR, CRM, and practice management tools.</p>
          </div>
          <div className="flex flex-wrap gap-3 justify-center max-w-3xl mx-auto mb-10">
            {INTEGRATIONS.map((integration) => (
              <div key={integration} className="bg-gray-100 text-gray-700 px-4 py-2 rounded-xl text-sm font-medium hover:bg-[#0A2342]/10 hover:text-[#0A2342] transition-colors cursor-pointer">
                {integration}
              </div>
            ))}
          </div>
          <p className="text-center text-sm text-gray-500">
            + Custom integrations via REST API and webhooks · FHIR R4 compliant
          </p>
        </div>
      </section>

      {/* CTA */}
      <section id="demo" className="py-20 bg-gradient-to-br from-[#0A2342] to-[#1a3a6b] text-white">
        <div className="max-w-4xl mx-auto px-6 text-center">
          <div className="w-16 h-16 bg-[#2EC4B6]/20 rounded-3xl flex items-center justify-center mx-auto mb-6">
            <Building2 className="h-8 w-8 text-[#2EC4B6]" />
          </div>
          <h2 className="text-4xl font-bold mb-4">Ready to Scale Your Practice?</h2>
          <p className="text-xl text-white/70 mb-10 max-w-2xl mx-auto leading-relaxed">
            Talk to our enterprise team. We'll design a deployment plan that fits your practice size, clinical workflows, and integration requirements.
          </p>
          <div className="grid sm:grid-cols-3 gap-4 max-w-lg mx-auto mb-8">
            {[
              { icon: Calendar, label: "30-min discovery call" },
              { icon: Settings, label: "Custom deployment plan" },
              { icon: Users, label: "Onboard your full team" },
            ].map(({ icon: Icon, label }) => (
              <div key={label} className="flex flex-col items-center gap-2 text-white/70 text-sm">
                <div className="w-10 h-10 bg-white/10 rounded-xl flex items-center justify-center">
                  <Icon className="h-5 w-5 text-white" />
                </div>
                {label}
              </div>
            ))}
          </div>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link
              href="mailto:enterprise@24therapy.ai"
              className="flex items-center justify-center gap-2 px-8 py-4 bg-[#2EC4B6] text-white font-bold rounded-2xl hover:bg-[#25a99d] transition-colors text-lg"
            >
              <Mail className="h-5 w-5" /> Contact Enterprise Sales
            </Link>
            <Link
              href="tel:+18005551234"
              className="flex items-center justify-center gap-2 px-8 py-4 border border-white/30 text-white font-semibold rounded-2xl hover:bg-white/10 transition-colors"
            >
              <Phone className="h-5 w-5" /> +1 (800) 555-1234
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
