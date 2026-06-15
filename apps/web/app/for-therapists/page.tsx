import Link from "next/link";
import {
  Brain, Clock, FileText, Shield, TrendingUp, Users, CheckCircle2,
  ArrowRight, Star, Zap, Calendar, MessageSquare, BarChart3,
  Heart, Award, Globe, Sparkles, ChevronRight, Play
} from "lucide-react";

const BENEFITS = [
  {
    icon: Clock,
    title: "Eliminate Documentation Burden",
    description: "AI-powered SOAP, DAP, and BIRP notes generated automatically from sessions. The draft is ready before you close the session window.",
    color: "bg-blue-50 text-blue-600",
    stat: "< 60s",
    statLabel: "note generation"
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
    name: "Dr. Sara Ahmed",
    title: "Clinical Psychologist",
    practice: "Cairo, Egypt",
    quote: "24Therapy has completely transformed my practice. I used to spend 2+ hours after clinic writing notes. Now AI handles it in 30 seconds. The clinical copilot is like having a brilliant colleague in the room.",
    avatar_initials: "SA",
    rating: 5,
    time_saved: "AI Scribe"
  },
  {
    name: "Dr. Omar Hassan",
    title: "Psychiatrist",
    practice: "Dubai, UAE",
    quote: "The patient memory system is remarkable. It surfaces information from sessions 6 months ago that I would never remember. My patients feel truly heard because I can reference their complete history.",
    avatar_initials: "OH",
    rating: 5,
    time_saved: "Memory Layer"
  },
  {
    name: "Dr. Yasmine Khalil",
    title: "Practice Owner",
    practice: "Riyadh, Saudi Arabia",
    quote: "Managing 8 therapists was chaos before 24Therapy. Now I have complete visibility into all sessions, billing, and outcomes from one dashboard. My admin workload dropped significantly.",
    avatar_initials: "YK",
    rating: 5,
    time_saved: "Analytics"
  },
];

// Pricing is managed centrally via /pricing page and pricing-api.ts.
// Do NOT add hardcoded prices here — they will diverge from the DB.

const ROI_STATS = [
  { value: "< 60s", label: "AI note generation", icon: Clock },
  { value: "GPT-4o", label: "Powered by", icon: Brain },
  { value: "HIPAA", label: "Fully compliant", icon: CheckCircle2 },
  { value: "All plans", label: "Crisis detection included", icon: Heart },
];

export default function ForTherapistsPage() {
  return (
    <main className="min-h-screen bg-white">

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
                Get Started Free
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
              <span className="flex items-center gap-1.5"><Award className="w-4 h-4 text-amber-400" /> First session free</span>
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
                AI Built Specifically for Mental Health
              </h2>
              <p className="text-slate-600 mb-8 leading-relaxed">
                Unlike generic AI tools, 24Therapy understands clinical context, DSM frameworks, evidence-based treatments, and therapeutic modalities — purpose-built for mental health professionals.
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

      {/* Pricing CTA — links to canonical /pricing page */}
      <section className="py-20 bg-slate-50">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-4xl font-bold text-[#0A2342] mb-4">Simple, Transparent Pricing</h2>
          <p className="text-slate-500 mb-8">
            Start free. Plans from $0/month. Upgrade when you need more. Cancel anytime.
          </p>
          <div className="flex flex-wrap gap-4 justify-center mb-8">
            <Link
              href="/signup?role=therapist"
              className="inline-flex items-center gap-2 bg-[#1F5EFF] text-white font-semibold px-8 py-4 rounded-2xl hover:bg-[#1649D4] transition-all shadow-md"
            >
              Get Started Free
              <ArrowRight className="w-5 h-5" />
            </Link>
            <Link
              href="/pricing"
              className="inline-flex items-center gap-2 border border-slate-300 text-slate-700 font-semibold px-8 py-4 rounded-2xl hover:border-[#0A2342] hover:text-[#0A2342] transition-all"
            >
              View Full Pricing
              <ChevronRight className="w-5 h-5" />
            </Link>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-6 text-sm text-slate-500">
            <span className="flex items-center gap-1.5"><CheckCircle2 className="w-4 h-4 text-emerald-500" /> No credit card required</span>
            <span className="flex items-center gap-1.5"><Shield className="w-4 h-4 text-emerald-500" /> HIPAA compliant</span>
            <span className="flex items-center gap-1.5"><CheckCircle2 className="w-4 h-4 text-emerald-500" /> Cancel anytime</span>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 bg-gradient-to-br from-[#0A2342] to-[#1E4F8C] text-white">
        <div className="max-w-3xl mx-auto text-center px-4">
          <h2 className="text-4xl font-bold mb-6">Ready to Transform Your Practice?</h2>
          <p className="text-xl text-white/70 mb-10">
            Spend more time on therapy. Let AI handle the documentation, risk monitoring, and administrative burden so you can focus on patients.
          </p>
          <div className="flex flex-wrap gap-4 justify-center">
            <Link href="/signup?role=therapist" className="inline-flex items-center gap-2 bg-[#1F5EFF] text-white font-semibold px-8 py-4 rounded-2xl hover:bg-[#1649D4] transition-all shadow-lg">
              Get Started Free — First Session Free
              <ArrowRight className="w-5 h-5" />
            </Link>
            <Link href="/demo" className="inline-flex items-center gap-2 bg-white/10 text-white font-semibold px-8 py-4 rounded-2xl border border-white/20 hover:bg-white/20 transition-all">
              Book a Demo
            </Link>
          </div>
        </div>
      </section>

    </main>
  );
}

// Reviewed: 2026-06-13 — 24Therapy audit
