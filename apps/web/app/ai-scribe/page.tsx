import Link from "next/link";
import { Navbar } from "@/components/layout/navbar";
import { Footer } from "@/components/layout/footer";
import {
  Brain, FileText, Mic, Video, CheckCircle2, ArrowRight, Sparkles,
  Clock, Shield, Zap, BarChart2, Star, AlertCircle, Target,
  Activity, Play, ChevronRight, Award, Globe
} from "lucide-react";

const WORKFLOW_STEPS = [
  {
    step: 1,
    icon: Video,
    title: "Session Begins",
    description: "Therapist starts a session. AI begins listening — no setup, no special equipment needed.",
    color: "bg-blue-50 text-blue-600"
  },
  {
    step: 2,
    icon: Mic,
    title: "Real-Time Transcription",
    description: "AI transcribes the session with speaker detection, emotional context, and topic segmentation in real time.",
    color: "bg-indigo-50 text-indigo-600"
  },
  {
    step: 3,
    icon: Brain,
    title: "Clinical Analysis",
    description: "Specialized mental health AI analyzes clinical themes, risk indicators, treatment opportunities, and patient progress.",
    color: "bg-purple-50 text-purple-600"
  },
  {
    step: 4,
    icon: FileText,
    title: "Note Generation",
    description: "Session ends. AI generates a complete SOAP, DAP, or BIRP note — reviewed and ready for approval in under 30 seconds.",
    color: "bg-emerald-50 text-emerald-600"
  },
  {
    step: 5,
    icon: CheckCircle2,
    title: "Review & Approve",
    description: "Therapist reviews, edits if needed, signs, and publishes. Fully HIPAA-compliant workflow from start to finish.",
    color: "bg-amber-50 text-amber-600"
  },
];

const FEATURES = [
  {
    title: "Mental Health-Specific AI",
    description: "Not a generic AI — trained on DSM frameworks, ICD codes, evidence-based therapies, and clinical documentation standards.",
    icon: Brain,
    badge: "Purpose-Built"
  },
  {
    title: "Multi-Format Notes",
    description: "SOAP, DAP, BIRP, Progress Notes, Insurance Notes, Treatment Plans, Referral Letters — all from one session.",
    icon: FileText,
    badge: "8+ Formats"
  },
  {
    title: "Risk Detection",
    description: "Automatic flagging of crisis indicators, suicidal ideation, self-harm language, and medication concerns during live sessions.",
    icon: AlertCircle,
    badge: "Real-Time"
  },
  {
    title: "Assessment Integration",
    description: "PHQ-9, GAD-7, PCL-5, and 20+ validated scales tracked and analyzed across every session automatically.",
    icon: BarChart2,
    badge: "20+ Tools"
  },
  {
    title: "Patient Memory",
    description: "AI builds a longitudinal knowledge graph of each patient — tracking patterns, triggers, goals, and progress across years of sessions.",
    icon: Activity,
    badge: "Longitudinal"
  },
  {
    title: "Multi-Language",
    description: "Supports transcription and note generation in English, Spanish, French, Arabic, and 40+ languages.",
    icon: Globe,
    badge: "40+ Languages"
  },
];

const SAMPLE_SOAP = `SOAP NOTE — Session #24
Date: December 15, 2025 | Duration: 50 min
Provider: Dr. Alex Smith | Patient: Sarah C.

─────────────────────────────────

S — SUBJECTIVE
Patient presents with reduced anxiety levels compared to last session. Reports 
successful application of 4-7-8 breathing technique 3-4x this week. Sleep has 
improved to approximately 7 hours/night. Continues experiencing some work-related 
anxiety, particularly around upcoming quarterly review. Denies suicidal ideation, 
self-harm, or homicidal ideation.

O — OBJECTIVE
Patient appeared calm, engaged, and appropriately dressed. Affect was congruent 
with mood. PHQ-9 score: 13 (down from 17 three months ago — 24% improvement). 
GAD-7: 8. Demonstrated spontaneous use of cognitive reframing during session 
when discussing work performance concerns. No psychomotor agitation observed.

A — ASSESSMENT
Patient continues to show meaningful clinical improvement across depression and 
anxiety metrics. Behavioral activation techniques are producing measurable results. 
Core schema work (performance = worthiness) progressing. Seasonal risk window 
approaching (Nov-Jan historical pattern) — monitor. PHQ-9 trajectory positive.

P — PLAN
1. Continue CBT focus — cognitive restructuring for perfectionism
2. Homework: Thought records x5, gratitude journal (1 item/day), breathing exercises
3. Schedule social engagement before next session
4. PHQ-9 reassessment at Session #27
5. Next session: December 22, 2025`;

const TESTIMONIALS = [
  { name: "Dr. James Park, PhD", role: "Psychologist, 18 years", quote: "The SOAP notes are indistinguishable from what I write myself. I've stopped spending evenings on documentation.", rating: 5 },
  { name: "Aisha Chen, LCSW", role: "Private Practice", quote: "The risk detection caught a concerning statement I almost missed in a busy session. It may have been lifesaving.", rating: 5 },
  { name: "Dr. Marcos Reyes", role: "Group Practice Director", quote: "Our 8-person practice saved 40+ collective hours per week. That's 40 more hours with patients.", rating: 5 },
];

export default function AIScribePage() {
  return (
    <main className="min-h-screen bg-white">
      <Navbar />

      {/* Hero */}
      <section className="pt-28 pb-20 bg-gradient-to-br from-[#0A2342] to-[#1E4F8C] text-white overflow-hidden">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
            <div>
              <div className="inline-flex items-center gap-2 bg-white/10 border border-white/20 rounded-full px-4 py-2 mb-8">
                <Sparkles className="w-4 h-4 text-[#24C8DB]" />
                <span className="text-sm font-medium">Mental Health AI Scribe</span>
              </div>

              <h1 className="text-5xl font-bold leading-tight mb-6">
                Session Notes Written For You.{" "}
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#1F5EFF] to-[#24C8DB]">
                  Automatically.
                </span>
              </h1>

              <p className="text-xl text-white/70 mb-8 leading-relaxed">
                AI that listens to your therapy sessions and generates clinical-quality SOAP, DAP, and BIRP notes in under 30 seconds. Built specifically for mental health professionals.
              </p>

              <div className="grid grid-cols-3 gap-4 mb-10">
                {[
                  { value: "30s", label: "Note generation" },
                  { value: "94%", label: "Accuracy rate" },
                  { value: "8hrs", label: "Saved per week" },
                ].map(({ value, label }) => (
                  <div key={label} className="text-center bg-white/10 rounded-2xl py-3">
                    <p className="text-2xl font-bold text-white">{value}</p>
                    <p className="text-xs text-white/60">{label}</p>
                  </div>
                ))}
              </div>

              <div className="flex flex-wrap gap-4">
                <Link href="/signup?role=therapist" className="inline-flex items-center gap-2 bg-[#1F5EFF] text-white font-semibold px-8 py-4 rounded-2xl hover:bg-[#1649D4] transition-all shadow-lg">
                  Start Free Trial <ArrowRight className="w-5 h-5" />
                </Link>
                <Link href="/demo" className="inline-flex items-center gap-2 bg-white/10 text-white font-semibold px-8 py-4 rounded-2xl border border-white/20 hover:bg-white/20 transition-all">
                  <Play className="w-5 h-5" /> Watch Demo
                </Link>
              </div>
            </div>

            {/* Sample Note Preview */}
            <div className="bg-white/5 backdrop-blur-xl rounded-3xl border border-white/10 overflow-hidden shadow-2xl">
              <div className="flex items-center justify-between px-5 py-3 bg-white/5 border-b border-white/10">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse" />
                  <span className="text-xs font-medium text-white/70">AI Note — Ready for Review</span>
                </div>
                <div className="flex gap-1.5">
                  <div className="w-3 h-3 rounded-full bg-rose-400" />
                  <div className="w-3 h-3 rounded-full bg-amber-400" />
                  <div className="w-3 h-3 rounded-full bg-emerald-400" />
                </div>
              </div>
              <div className="p-5 max-h-96 overflow-y-auto">
                <pre className="text-[11px] text-white/70 whitespace-pre-wrap font-mono leading-relaxed">
                  {SAMPLE_SOAP}
                </pre>
              </div>
              <div className="px-5 py-3 bg-white/5 border-t border-white/10 flex gap-2">
                <button className="flex-1 py-2 bg-emerald-500 text-white rounded-xl text-xs font-medium">Approve & Sign</button>
                <button className="px-3 py-2 bg-white/10 text-white/60 rounded-xl text-xs">Edit</button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Trust bar */}
      <section className="py-8 bg-slate-900">
        <div className="max-w-5xl mx-auto px-4">
          <div className="flex flex-wrap items-center justify-center gap-8 text-white/50 text-sm">
            {["HIPAA Compliant", "SOC 2 Type II", "End-to-End Encrypted", "BAA Agreements", "No Training on Patient Data", "GDPR Ready"].map(t => (
              <span key={t} className="flex items-center gap-1.5">
                <Shield className="w-4 h-4 text-emerald-400" /> {t}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-20 bg-white">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-14">
            <h2 className="text-4xl font-bold text-[#0A2342] mb-4">How It Works</h2>
            <p className="text-xl text-slate-500">From session to signed note in under 5 minutes</p>
          </div>

          <div className="relative">
            {/* Connection line */}
            <div className="hidden lg:block absolute top-16 left-[calc(10%+32px)] right-[calc(10%+32px)] h-0.5 bg-gradient-to-r from-blue-200 via-purple-200 to-emerald-200" />

            <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
              {WORKFLOW_STEPS.map((step) => (
                <div key={step.step} className="flex flex-col items-center text-center">
                  <div className={`w-16 h-16 rounded-2xl flex items-center justify-center mb-4 relative z-10 shadow-md ${step.color.split(" ").slice(0,1).join(" ")} border-2 border-white`}>
                    <step.icon className={`w-7 h-7 ${step.color.split(" ").slice(1).join(" ")}`} />
                    <div className="absolute -top-2 -right-2 w-6 h-6 bg-[#0A2342] rounded-full flex items-center justify-center">
                      <span className="text-white text-[10px] font-bold">{step.step}</span>
                    </div>
                  </div>
                  <h3 className="font-bold text-[#0A2342] mb-2 text-sm">{step.title}</h3>
                  <p className="text-xs text-slate-500 leading-relaxed">{step.description}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-20 bg-slate-50">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-14">
            <h2 className="text-4xl font-bold text-[#0A2342] mb-4">More Than Just Transcription</h2>
            <p className="text-xl text-slate-500 max-w-2xl mx-auto">
              A purpose-built mental health AI system — not a generic tool retrofitted for therapy.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {FEATURES.map((feature) => (
              <div key={feature.title} className="bg-white rounded-2xl border border-slate-200 p-6 hover:shadow-lg transition-all hover:border-[#1F5EFF]/30">
                <div className="flex items-center justify-between mb-4">
                  <div className="w-12 h-12 bg-indigo-50 rounded-2xl flex items-center justify-center">
                    <feature.icon className="w-6 h-6 text-indigo-600" />
                  </div>
                  <span className="text-xs font-semibold bg-slate-100 text-slate-600 px-2.5 py-1 rounded-full">{feature.badge}</span>
                </div>
                <h3 className="text-lg font-bold text-[#0A2342] mb-2">{feature.title}</h3>
                <p className="text-slate-600 text-sm leading-relaxed">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="py-20 bg-white">
        <div className="max-w-5xl mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-4xl font-bold text-[#0A2342] mb-4">Trusted by Clinical Professionals</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {TESTIMONIALS.map((t) => (
              <div key={t.name} className="bg-slate-50 rounded-2xl p-6 border border-slate-200">
                <div className="flex gap-0.5 mb-4">
                  {Array.from({ length: t.rating }).map((_, i) => (
                    <Star key={i} className="w-4 h-4 fill-amber-400 text-amber-400" />
                  ))}
                </div>
                <p className="text-slate-700 text-sm mb-5 leading-relaxed">"{t.quote}"</p>
                <div>
                  <p className="font-semibold text-[#0A2342] text-sm">{t.name}</p>
                  <p className="text-xs text-slate-500">{t.role}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 bg-gradient-to-br from-[#0A2342] to-[#1E4F8C] text-white">
        <div className="max-w-3xl mx-auto text-center px-4">
          <Award className="w-12 h-12 text-amber-400 mx-auto mb-6" />
          <h2 className="text-4xl font-bold mb-6">Start Saving 8 Hours Per Week</h2>
          <p className="text-xl text-white/70 mb-10">
            Join 500+ therapists who've eliminated documentation burden with 24Therapy AI Scribe.
          </p>
          <Link href="/signup?role=therapist" className="inline-flex items-center gap-2 bg-[#1F5EFF] text-white font-semibold px-10 py-5 rounded-2xl hover:bg-[#1649D4] transition-all text-lg shadow-lg">
            Start 14-Day Free Trial — No Credit Card
            <ArrowRight className="w-6 h-6" />
          </Link>
        </div>
      </section>

      <Footer />
    </main>
  );
}
