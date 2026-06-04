import Link from "next/link";
import { Navbar } from "@/components/layout/navbar";
import { Footer } from "@/components/layout/footer";
import {
  Brain, Clock, FileText, Shield, TrendingUp, Users, CheckCircle2,
  ArrowRight, Star, Zap, Calendar, MessageSquare, BarChart3,
  Heart, Award, Globe, Sparkles, ChevronRight, Play
} from "lucide-react";

const BENEFITS = [
  {
    icon: Clock,
    title: "Save 8+ Hours Per Week",
    description: "AI-powered SOAP, DAP, and BIRP notes generated automatically from sessions. Documentation that used to take 30 minutes now takes 2.",
    color: "bg-blue-50 text-blue-600",
    stat: "8hrs/week",
    statLabel: "saved on average"
  },
  {
    icon: Brain,
    title: "AI Clinical Copilot",
    description: "Real-time session assistance — suggested questions, risk detection, treatment recommendations, and clinical insights during every session.",
    color: "bg-indigo-50 text-indigo-600",
    stat: "AI-powered",
    statLabel: "real-time assistance"
  },
  {
    icon: TrendingUp,
    title: "Patient Intelligence Layer",
    description: "Deep patient memory across all sessions. AI builds a knowledge graph of every patient — history, patterns, triggers, goals, progress.",
    color: "bg-emerald-50 text-emerald-600",
    stat: "100%",
    statLabel: "session context retained"
  },
  {
    icon: BarChart3,
    title: "Practice Analytics",
    description: "Revenue tracking, patient outcomes, attendance rates, clinical metrics, and burnout indicators — all in one dashboard.",
    color: "bg-amber-50 text-amber-600",
    stat: "Full",
    statLabel: "practice visibility"
  },
  {
    icon: Users,
    title: "Radar Patient Matching",
    description: "Get matched with new patients who need your specific specialization. Real-time intake system with urgency scoring and match percentage.",
    color: "bg-rose-50 text-rose-600",
    stat: "Instant",
    statLabel: "patient matching"
  },
  {
    icon: Shield,
    title: "HIPAA-Compliant Infrastructure",
    description: "End-to-end encryption, role-based access control, full audit trails, BAA agreements, and compliance monitoring built in.",
    color: "bg-purple-50 text-purple-600",
    stat: "100%",
    statLabel: "HIPAA compliant"
  },
];

const AI_FEATURES = [
  { title: "Real-Time Transcription", desc: "AI transcribes sessions in real-time with speaker detection, topic segmentation, and automatic highlights." },
  { title: "SOAP/DAP/BIRP Note Generation", desc: "Select your preferred format. AI generates complete clinical notes from the transcript in under 30 seconds." },
  { title: "Risk Detection Engine", desc: "Automatic flagging of crisis indicators, self-harm language, and escalation triggers during sessions." },
  { title: "Treatment Plan Builder", desc: "AI-assisted treatment plan creation with evidence-based interventions, goals, and measurable outcomes." },
  { title: "Session Preparation Briefs", desc: "Before each session, AI summarizes patient history, previous session highlights, and suggests focus areas." },
  { title: "Patient Memory Knowledge Graph", desc: "Longitudinal patient intelligence that grows richer with every session — triggers, patterns, relationships, milestones." },
  { title: "Assessment Analytics", desc: "Track PHQ-9, GAD-7, PCL-5, and 20+ validated assessments over time with trend analysis." },
  { title: "Referral & Consultation Reports", desc: "Generate professional referral letters and consultation summaries in one click." },
];

const TESTIMONIALS = [
  {
    name: "Dr. Sarah Johnson",
    title: "Licensed Clinical Psychologist",
    practice: "Private Practice, New York",
    quote: "24Therapy has completely transformed my practice. I used to spend 3 hours after sessions writing notes. Now I'm done in 15 minutes. The AI doesn't just transcribe — it understands clinical language.",
    avatar_initials: "SJ",
    rating: 5,
    time_saved: "3hrs/day"
  },
  {
    name: "Michael Chen, LCSW",
    title: "Licensed Clinical Social Worker",
    practice: "Telehealth Specialist",
    quote: "The patient memory system is unlike anything I've seen. By Session 10, the AI knows my patients better than most EHR systems would after 2 years. It's genuinely a clinical superpower.",
    avatar_initials: "MC",
    rating: 5,
    time_saved: "6hrs/week"
  },
  {
    name: "Dr. Priya Patel",
    title: "Psychiatrist",
    practice: "Group Practice, Boston",
    quote: "Our entire 8-therapist practice switched to 24Therapy. Billing reconciliation, compliance tracking, and therapist analytics have reduced our admin overhead by 40%. The ROI is undeniable.",
    avatar_initials: "PP",
    rating: 5,
    time_saved: "40% admin"
  },
];

const PRICING_TIERS = [
  {
    name: "Starter",
    price: 79,
    period: "/ month",
    description: "Perfect for solo practitioners",
    features: [
      "AI note generation (SOAP/DAP/BIRP)",
      "Up to 40 patients",
      "Session recording & transcription",
      "Basic patient profiles",
      "PHQ-9 & GAD-7 assessments",
      "Email support"
    ],
    cta: "Start Free Trial",
    highlight: false
  },
  {
    name: "Professional",
    price: 149,
    period: "/ month",
    description: "For growing practices",
    features: [
      "Everything in Starter",
      "Unlimited patients",
      "AI Clinical Copilot (live)",
      "Patient Memory Knowledge Graph",
      "Risk Detection Engine",
      "Radar patient matching",
      "Full assessment library (20+ tools)",
      "Treatment plan builder",
      "Practice analytics dashboard",
      "Priority support"
    ],
    cta: "Start Free Trial",
    highlight: true
  },
  {
    name: "Practice",
    price: 399,
    period: "/ month",
    description: "For teams and group practices",
    features: [
      "Everything in Professional",
      "Up to 10 therapists",
      "Practice-wide analytics",
      "Admin & billing management",
      "Team collaboration tools",
      "Custom intake forms",
      "White-label options",
      "Dedicated onboarding",
      "Phone & video support"
    ],
    cta: "Book a Demo",
    highlight: false
  }
];

const ROI_STATS = [
  { value: "8.5h", label: "Hours saved per week", icon: Clock },
  { value: "$3,200", label: "Extra monthly revenue potential", icon: TrendingUp },
  { value: "94%", label: "Note accuracy vs manual", icon: CheckCircle2 },
  { value: "32%", label: "Reduction in burnout scores", icon: Heart },
];

export default function ForTherapistsPage() {
  return (
    <main className="min-h-screen bg-white">
      <Navbar />

      {/* Hero */}
      <section className="pt-28 pb-20 bg-gradient-to-br from-[#0A2342] via-[#0D2D57] to-[#123A63] text-white">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-3xl mx-auto text-center">
            <div className="inline-flex items-center gap-2 bg-white/10 border border-white/20 rounded-full px-4 py-2 mb-8">
              <Sparkles className="w-4 h-4 text-[#24C8DB]" />
              <span className="text-sm font-medium">Built For Modern Therapists</span>
            </div>

            <h1 className="text-5xl sm:text-6xl font-bold leading-tight mb-6">
              The AI Platform That{" "}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#1F5EFF] to-[#24C8DB]">
                Eliminates Documentation Burden
              </span>
            </h1>

            <p className="text-xl text-white/70 mb-10 leading-relaxed">
              Real-time AI note generation, clinical copilot, patient intelligence, 
              and practice management — built specifically for mental health professionals.
            </p>

            <div className="flex flex-wrap gap-4 justify-center mb-12">
              <Link
                href="/signup?role=therapist"
                className="inline-flex items-center gap-2 bg-[#1F5EFF] hover:bg-[#1649D4] text-white font-semibold px-8 py-4 rounded-2xl shadow-lg transition-all"
              >
                Start Free 14-Day Trial
                <ArrowRight className="w-5 h-5" />
              </Link>
              <Link
                href="/demo"
                className="inline-flex items-center gap-2 bg-white/10 hover:bg-white/20 text-white font-semibold px-8 py-4 rounded-2xl border border-white/20 transition-all"
              >
                <Play className="w-5 h-5" />
                Watch Demo
              </Link>
            </div>

            {/* Trust indicators */}
            <div className="flex flex-wrap items-center justify-center gap-8 text-white/60 text-sm">
              <span className="flex items-center gap-1.5"><CheckCircle2 className="w-4 h-4 text-emerald-400" /> No credit card required</span>
              <span className="flex items-center gap-1.5"><Shield className="w-4 h-4 text-emerald-400" /> HIPAA Compliant</span>
              <span className="flex items-center gap-1.5"><Award className="w-4 h-4 text-amber-400" /> 500+ therapists</span>
              <span className="flex items-center gap-1.5"><Globe className="w-4 h-4 text-blue-400" /> Telehealth ready</span>
            </div>
          </div>
        </div>
      </section>

      {/* ROI Stats */}
      <section className="py-12 bg-slate-900">
        <div className="max-w-5xl mx-auto px-4">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
            {ROI_STATS.map(({ value, label, icon: Icon }) => (
              <div key={label} className="text-center">
                <Icon className="w-6 h-6 text-[#24C8DB] mx-auto mb-2" />
                <p className="text-3xl font-bold text-white mb-1">{value}</p>
                <p className="text-sm text-white/50">{label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Benefits */}
      <section className="py-20 bg-white">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-14">
            <h2 className="text-4xl font-bold text-[#0A2342] mb-4">
              Everything You Need to Run a World-Class Practice
            </h2>
            <p className="text-xl text-slate-500 max-w-2xl mx-auto">
              From session AI to patient intelligence to practice analytics — one platform, built for mental health.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {BENEFITS.map((benefit) => (
              <div key={benefit.title} className="bg-white rounded-2xl border border-slate-200 p-6 hover:border-[#1F5EFF]/30 hover:shadow-lg transition-all">
                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center mb-4 ${benefit.color}`}>
                  <benefit.icon className="w-6 h-6" />
                </div>
                <div className="mb-3">
                  <p className="text-2xl font-bold text-[#0A2342]">{benefit.stat}</p>
                  <p className="text-xs text-slate-400">{benefit.statLabel}</p>
                </div>
                <h3 className="text-lg font-bold text-[#0A2342] mb-2">{benefit.title}</h3>
                <p className="text-slate-600 text-sm leading-relaxed">{benefit.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* AI Features Detail */}
      <section className="py-20 bg-slate-50">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
            <div>
              <div className="inline-flex items-center gap-2 bg-indigo-50 text-indigo-700 rounded-full px-4 py-2 text-sm font-medium mb-6">
                <Brain className="w-4 h-4" /> AI System Architecture
              </div>
              <h2 className="text-4xl font-bold text-[#0A2342] mb-6">
                8 Specialized AI Agents Working For You
              </h2>
              <p className="text-slate-600 mb-8 leading-relaxed">
                Unlike generic AI tools, our mental health-specific agents understand clinical context, 
                DSM frameworks, evidence-based treatments, and therapeutic modalities.
              </p>

              <div className="space-y-3">
                {AI_FEATURES.map((feature) => (
                  <div key={feature.title} className="flex gap-3 p-4 bg-white rounded-xl border border-slate-200 hover:border-[#1F5EFF]/30 transition-all">
                    <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5" />
                    <div>
                      <h4 className="font-semibold text-[#0A2342] text-sm">{feature.title}</h4>
                      <p className="text-xs text-slate-500 mt-0.5">{feature.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* AI Demo Panel */}
            <div className="bg-[#0A2342] rounded-3xl p-6 text-white">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 bg-[#1F5EFF] rounded-xl flex items-center justify-center">
                  <Brain className="w-5 h-5" />
                </div>
                <div>
                  <p className="font-semibold">AI Copilot — Live Session</p>
                  <div className="flex items-center gap-1">
                    <span className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse" />
                    <span className="text-xs text-white/50">Session #24 — Sarah C.</span>
                  </div>
                </div>
              </div>

              {/* Suggested questions */}
              <div className="mb-4">
                <p className="text-xs text-white/50 uppercase tracking-wide mb-2">Suggested Next Questions</p>
                {[
                  "Ask about sleep quality this week",
                  "Explore the work deadline trigger further",
                  "Check medication adherence"
                ].map(q => (
                  <div key={q} className="flex items-center gap-2 p-2.5 bg-white/5 rounded-xl mb-2 text-sm">
                    <Sparkles className="w-3.5 h-3.5 text-[#24C8DB] shrink-0" />
                    <span className="text-white/80">{q}</span>
                  </div>
                ))}
              </div>

              {/* Risk panel */}
              <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl mb-4">
                <p className="text-xs text-amber-400 font-medium mb-1">⚠ Risk Indicator</p>
                <p className="text-xs text-white/70">Patient mentioned sleep disruption for 3rd consecutive session. Consider sleep assessment.</p>
              </div>

              {/* Note generation */}
              <div className="bg-white/5 rounded-xl p-4">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs text-white/50 uppercase tracking-wide">Auto-Generated SOAP Note</p>
                  <span className="text-xs text-emerald-400">Ready to review</span>
                </div>
                <p className="text-xs text-white/70 leading-relaxed">
                  <strong className="text-white/90">S:</strong> Patient reports elevated anxiety related to upcoming work performance review. Notes improved sleep this week (7 hrs vs 5 hrs last week)...
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="py-20 bg-white">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-14">
            <h2 className="text-4xl font-bold text-[#0A2342] mb-4">What Therapists Are Saying</h2>
            <p className="text-slate-500">Trusted by licensed professionals across North America</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {TESTIMONIALS.map((t) => (
              <div key={t.name} className="bg-slate-50 rounded-2xl p-6 border border-slate-200">
                <div className="flex gap-0.5 mb-4">
                  {Array.from({ length: t.rating }).map((_, i) => (
                    <Star key={i} className="w-4 h-4 fill-amber-400 text-amber-400" />
                  ))}
                </div>
                <p className="text-slate-700 text-sm leading-relaxed mb-6">"{t.quote}"</p>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-gradient-to-br from-[#0A2342] to-[#2F80ED] rounded-full flex items-center justify-center">
                    <span className="text-xs font-bold text-white">{t.avatar_initials}</span>
                  </div>
                  <div>
                    <p className="font-semibold text-[#0A2342] text-sm">{t.name}</p>
                    <p className="text-xs text-slate-500">{t.title}</p>
                    <p className="text-xs text-slate-400">{t.practice}</p>
                  </div>
                  <div className="ml-auto text-right">
                    <p className="text-sm font-bold text-emerald-600">{t.time_saved}</p>
                    <p className="text-xs text-slate-400">saved</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section className="py-20 bg-slate-50">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-14">
            <h2 className="text-4xl font-bold text-[#0A2342] mb-4">Simple, Transparent Pricing</h2>
            <p className="text-slate-500">Start free for 14 days. No credit card required.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {PRICING_TIERS.map((tier) => (
              <div
                key={tier.name}
                className={`rounded-2xl p-6 border ${tier.highlight
                  ? "bg-[#0A2342] text-white border-[#1F5EFF] shadow-xl shadow-[#0A2342]/20"
                  : "bg-white text-slate-900 border-slate-200"
                }`}
              >
                {tier.highlight && (
                  <span className="inline-block px-3 py-1 bg-[#1F5EFF] text-white text-xs font-semibold rounded-full mb-4">Most Popular</span>
                )}
                <h3 className={`text-xl font-bold mb-1 ${tier.highlight ? "text-white" : "text-[#0A2342]"}`}>{tier.name}</h3>
                <p className={`text-sm mb-4 ${tier.highlight ? "text-white/60" : "text-slate-500"}`}>{tier.description}</p>
                <div className="mb-6">
                  <span className={`text-4xl font-bold ${tier.highlight ? "text-white" : "text-[#0A2342]"}`}>${tier.price}</span>
                  <span className={`text-sm ${tier.highlight ? "text-white/60" : "text-slate-500"}`}>{tier.period}</span>
                </div>

                <ul className="space-y-2.5 mb-6">
                  {tier.features.map((feature) => (
                    <li key={feature} className={`flex items-start gap-2 text-sm ${tier.highlight ? "text-white/80" : "text-slate-600"}`}>
                      <CheckCircle2 className={`w-4 h-4 shrink-0 mt-0.5 ${tier.highlight ? "text-emerald-400" : "text-emerald-500"}`} />
                      {feature}
                    </li>
                  ))}
                </ul>

                <Link
                  href={tier.cta === "Book a Demo" ? "/demo" : "/signup?role=therapist"}
                  className={`w-full py-3 rounded-xl font-semibold text-sm text-center block transition-all ${tier.highlight
                    ? "bg-[#1F5EFF] hover:bg-[#1649D4] text-white"
                    : "bg-slate-100 hover:bg-[#0A2342] hover:text-white text-[#0A2342]"
                  }`}
                >
                  {tier.cta}
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 bg-gradient-to-br from-[#0A2342] to-[#1E4F8C] text-white">
        <div className="max-w-3xl mx-auto text-center px-4">
          <h2 className="text-4xl font-bold mb-6">Ready to Transform Your Practice?</h2>
          <p className="text-xl text-white/70 mb-10">
            Join 500+ therapists who have reclaimed their time, reduced burnout, and elevated their clinical practice with 24Therapy.ai.
          </p>
          <div className="flex flex-wrap gap-4 justify-center">
            <Link href="/signup?role=therapist" className="inline-flex items-center gap-2 bg-[#1F5EFF] text-white font-semibold px-8 py-4 rounded-2xl hover:bg-[#1649D4] transition-all shadow-lg">
              Start Free Trial — No Credit Card
              <ArrowRight className="w-5 h-5" />
            </Link>
            <Link href="/demo" className="inline-flex items-center gap-2 bg-white/10 text-white font-semibold px-8 py-4 rounded-2xl border border-white/20 hover:bg-white/20 transition-all">
              Book a Demo
            </Link>
          </div>
        </div>
      </section>

      <Footer />
    </main>
  );
}
