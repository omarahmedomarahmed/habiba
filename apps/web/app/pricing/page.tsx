import Link from "next/link";
import { Navbar } from "@/components/layout/navbar";
import { Footer } from "@/components/layout/footer";
import {
  CheckCircle2, X, ArrowRight, Zap, Users, Building2,
  Shield, Brain, Star, HelpCircle, Clock, Globe, Heart
} from "lucide-react";

const PLANS = [
  {
    id: "starter",
    name: "Starter",
    tagline: "Solo practitioner essentials",
    monthly: 79,
    annual: 69,
    color: "border-slate-200",
    textColor: "text-[#0A2342]",
    highlight: false,
    features: {
      core: [
        { label: "AI Note Generation (SOAP/DAP/BIRP)", included: true },
        { label: "Session Transcription", included: true },
        { label: "Up to 40 active patients", included: true },
        { label: "Basic patient profiles", included: true },
        { label: "PHQ-9 & GAD-7 Assessments", included: true },
        { label: "Appointment scheduling", included: true },
        { label: "Basic billing tracking", included: true },
        { label: "Email support", included: true },
      ],
      advanced: [
        { label: "AI Clinical Copilot (live session)", included: false },
        { label: "Patient Memory Knowledge Graph", included: false },
        { label: "Risk Detection Engine", included: false },
        { label: "Radar patient matching", included: false },
        { label: "Full assessment library (20+ tools)", included: false },
        { label: "Treatment plan builder", included: false },
        { label: "Practice analytics", included: false },
        { label: "Multi-therapist workspace", included: false },
      ]
    }
  },
  {
    id: "professional",
    name: "Professional",
    tagline: "Full AI-powered practice management",
    monthly: 149,
    annual: 129,
    color: "border-[#1F5EFF]",
    textColor: "text-white",
    highlight: true,
    badge: "Most Popular",
    features: {
      core: [
        { label: "Everything in Starter", included: true },
        { label: "Unlimited active patients", included: true },
        { label: "AI Clinical Copilot (live session)", included: true },
        { label: "Patient Memory Knowledge Graph", included: true },
        { label: "Risk Detection Engine", included: true },
        { label: "Radar patient matching", included: true },
        { label: "Full assessment library (20+ tools)", included: true },
        { label: "Treatment plan builder", included: true },
      ],
      advanced: [
        { label: "Practice analytics dashboard", included: true },
        { label: "Revenue tracking", included: true },
        { label: "Referral letter generation", included: true },
        { label: "Session prep briefs", included: true },
        { label: "Custom note templates", included: true },
        { label: "Priority support + onboarding", included: true },
        { label: "Multi-therapist workspace", included: false },
        { label: "White-label options", included: false },
      ]
    }
  },
  {
    id: "practice",
    name: "Practice",
    tagline: "Multi-therapist group practices",
    monthly: 399,
    annual: 339,
    color: "border-slate-200",
    textColor: "text-[#0A2342]",
    highlight: false,
    features: {
      core: [
        { label: "Everything in Professional", included: true },
        { label: "Up to 10 therapists", included: true },
        { label: "Practice-wide analytics", included: true },
        { label: "Admin & billing dashboard", included: true },
        { label: "Team collaboration tools", included: true },
        { label: "Custom intake forms", included: true },
        { label: "Multi-therapist scheduling", included: true },
        { label: "Dedicated onboarding manager", included: true },
      ],
      advanced: [
        { label: "White-label branding option", included: true },
        { label: "API access", included: true },
        { label: "EHR integration (beta)", included: true },
        { label: "Phone & video support", included: true },
        { label: "Custom contracts (BAA)", included: true },
        { label: "Compliance reporting", included: true },
        { label: "Enterprise SSO", included: false },
        { label: "Unlimited therapists", included: false },
      ]
    }
  }
];

const ENTERPRISE_FEATURES = [
  "Unlimited therapists and locations",
  "Enterprise SSO (SAML, OAuth)",
  "Dedicated infrastructure (private cloud)",
  "Custom AI model fine-tuning",
  "Advanced compliance & audit tools",
  "SLA guarantees (99.9% uptime)",
  "Dedicated customer success manager",
  "White-label / OEM licensing",
  "Custom integrations (Epic, Athena, etc.)",
  "Volume pricing",
];

const FAQS = [
  {
    q: "Is there a free trial?",
    a: "Yes — all plans include a 14-day free trial. No credit card required to start."
  },
  {
    q: "Can I change plans later?",
    a: "Absolutely. Upgrade or downgrade at any time from your settings. Changes are prorated."
  },
  {
    q: "Is my patient data secure and HIPAA compliant?",
    a: "Yes. We are fully HIPAA compliant with end-to-end encryption, BAA agreements, audit trails, and role-based access control. Your patient data is never used to train AI models."
  },
  {
    q: "Does the AI replace clinical judgment?",
    a: "No — and this is fundamental to how we operate. AI generates notes, suggestions, and insights. The therapist always reviews, edits, and approves everything. The AI assists; the clinician decides."
  },
  {
    q: "What note formats are supported?",
    a: "SOAP, DAP, BIRP, Progress Notes, Psychotherapy Notes, Insurance Notes, Treatment Plans, Referral Letters, Consultation Reports, and custom templates."
  },
  {
    q: "Can I use 24Therapy with my existing EHR?",
    a: "Practice and Enterprise plans include EHR integration support. We are actively building integrations with Epic, SimplePractice, TherapyNotes, and others."
  },
  {
    q: "How does Radar patient matching work?",
    a: "Radar is our real-time patient-to-therapist matching system. When someone needs support, they're matched based on specialization, availability, language, and clinical need. Therapists see a queue and can accept or decline matches."
  },
  {
    q: "What languages are supported?",
    a: "AI transcription and notes support English, Spanish, French, Arabic, and 40+ additional languages. Multi-language support is expanding continuously."
  },
];

const ADD_ONS = [
  { name: "Extra Therapist Seat", price: "$49/mo", description: "Add additional therapists to Practice plan" },
  { name: "AI Scribe Pro", price: "$29/mo", description: "Enhanced AI for specialized documentation formats" },
  { name: "Patient Mobile App", price: "$19/mo per therapist", description: "White-labeled patient app with mood tracking, journal, and AI companion" },
  { name: "Telehealth Rooms", price: "$15/mo per room", description: "HIPAA-compliant video rooms with recording and AI transcription" },
];

export default function PricingPage() {
  return (
    <main className="min-h-screen bg-white">
      <Navbar />

      {/* Hero */}
      <section className="pt-28 pb-16 bg-gradient-to-b from-slate-50 to-white">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <h1 className="text-5xl font-bold text-[#0A2342] mb-5">
            Simple Pricing. Serious Clinical AI.
          </h1>
          <p className="text-xl text-slate-500 mb-8">
            Start free for 14 days. Scale as your practice grows. Cancel anytime.
          </p>

          {/* Annual/Monthly toggle hint */}
          <div className="inline-flex items-center gap-2 bg-emerald-50 text-emerald-700 rounded-full px-4 py-2 text-sm font-medium">
            <Star className="w-4 h-4" /> Save ~15% with annual billing
          </div>
        </div>
      </section>

      {/* Plans */}
      <section className="pb-20">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {PLANS.map((plan) => (
              <div
                key={plan.id}
                className={`rounded-2xl border-2 overflow-hidden ${plan.color} ${plan.highlight ? "bg-[#0A2342] shadow-2xl shadow-[#0A2342]/30 scale-[1.02]" : "bg-white shadow-sm"}`}
              >
                {plan.badge && (
                  <div className="bg-[#1F5EFF] text-white text-center py-2 text-sm font-semibold">
                    ⭐ {plan.badge}
                  </div>
                )}
                <div className="p-6">
                  <h3 className={`text-2xl font-bold mb-1 ${plan.highlight ? "text-white" : "text-[#0A2342]"}`}>{plan.name}</h3>
                  <p className={`text-sm mb-5 ${plan.highlight ? "text-white/60" : "text-slate-500"}`}>{plan.tagline}</p>

                  <div className="mb-6">
                    <div className="flex items-baseline gap-1">
                      <span className={`text-5xl font-bold ${plan.highlight ? "text-white" : "text-[#0A2342]"}`}>${plan.monthly}</span>
                      <span className={`text-sm ${plan.highlight ? "text-white/60" : "text-slate-500"}`}>/month</span>
                    </div>
                    <p className={`text-xs mt-1 ${plan.highlight ? "text-white/50" : "text-slate-400"}`}>
                      ${plan.annual}/month billed annually
                    </p>
                  </div>

                  <Link
                    href="/signup?role=therapist"
                    className={`w-full py-3.5 rounded-xl font-semibold text-sm text-center block mb-6 transition-all ${plan.highlight
                      ? "bg-[#1F5EFF] text-white hover:bg-[#1649D4]"
                      : "bg-[#0A2342] text-white hover:bg-[#123A63]"
                    }`}
                  >
                    Start Free Trial
                  </Link>

                  {/* Features */}
                  <div className="space-y-1">
                    {[...plan.features.core, ...plan.features.advanced].map((f) => (
                      <div key={f.label} className={`flex items-center gap-2 py-1.5 text-xs ${plan.highlight ? "text-white/80" : "text-slate-600"}`}>
                        {f.included ? (
                          <CheckCircle2 className={`w-3.5 h-3.5 shrink-0 ${plan.highlight ? "text-emerald-400" : "text-emerald-500"}`} />
                        ) : (
                          <X className={`w-3.5 h-3.5 shrink-0 ${plan.highlight ? "text-white/20" : "text-slate-300"}`} />
                        )}
                        <span className={!f.included ? (plan.highlight ? "text-white/30" : "text-slate-300") : ""}>{f.label}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Enterprise */}
          <div className="mt-8 bg-gradient-to-r from-slate-900 to-slate-800 rounded-2xl p-8 text-white">
            <div className="flex flex-col lg:flex-row items-start lg:items-center gap-8">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-3">
                  <Building2 className="w-6 h-6 text-[#24C8DB]" />
                  <h3 className="text-2xl font-bold">Enterprise</h3>
                </div>
                <p className="text-white/60 mb-4">Custom pricing for large organizations, health systems, insurance networks, and enterprise deployments.</p>
                <div className="grid grid-cols-2 gap-2">
                  {ENTERPRISE_FEATURES.map(f => (
                    <div key={f} className="flex items-center gap-2 text-xs text-white/70">
                      <CheckCircle2 className="w-3 h-3 text-emerald-400 shrink-0" />
                      {f}
                    </div>
                  ))}
                </div>
              </div>
              <div className="shrink-0">
                <Link href="/contact?type=enterprise" className="inline-flex items-center gap-2 bg-[#1F5EFF] text-white font-semibold px-8 py-4 rounded-2xl hover:bg-[#1649D4] transition-all">
                  Contact Sales <ArrowRight className="w-5 h-5" />
                </Link>
                <p className="text-xs text-white/40 text-center mt-2">Typically 2-day response</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Add-ons */}
      <section className="py-16 bg-slate-50">
        <div className="max-w-4xl mx-auto px-4">
          <h2 className="text-3xl font-bold text-[#0A2342] mb-3 text-center">Optional Add-ons</h2>
          <p className="text-slate-500 text-center mb-10">Enhance any plan with additional capabilities</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {ADD_ONS.map(addon => (
              <div key={addon.name} className="bg-white rounded-2xl border border-slate-200 p-5 flex justify-between items-start">
                <div>
                  <h4 className="font-semibold text-[#0A2342]">{addon.name}</h4>
                  <p className="text-sm text-slate-500 mt-1">{addon.description}</p>
                </div>
                <span className="text-sm font-bold text-[#1F5EFF] shrink-0 ml-4">{addon.price}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="py-20 bg-white">
        <div className="max-w-3xl mx-auto px-4">
          <h2 className="text-3xl font-bold text-[#0A2342] mb-12 text-center">Frequently Asked Questions</h2>
          <div className="space-y-4">
            {FAQS.map((faq) => (
              <div key={faq.q} className="bg-slate-50 rounded-2xl p-6 border border-slate-200">
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
          <h2 className="text-3xl font-bold mb-4">Start Your Free Trial Today</h2>
          <p className="text-white/70 mb-8">14 days free. No credit card. Cancel anytime.</p>
          <div className="flex flex-wrap gap-4 justify-center">
            <Link href="/signup?role=therapist" className="inline-flex items-center gap-2 bg-[#1F5EFF] text-white font-semibold px-8 py-4 rounded-2xl hover:bg-[#1649D4] transition-all">
              Start Free Trial <ArrowRight className="w-5 h-5" />
            </Link>
            <Link href="/demo" className="inline-flex items-center gap-2 bg-white/10 text-white font-semibold px-8 py-4 rounded-2xl border border-white/20 hover:bg-white/20 transition-all">
              Book a Demo
            </Link>
          </div>
          <p className="text-white/40 text-sm mt-6 flex items-center justify-center gap-2">
            <Shield className="w-4 h-4" /> HIPAA Compliant · SOC 2 Type II · End-to-End Encrypted
          </p>
        </div>
      </section>

      <Footer />
    </main>
  );
}
