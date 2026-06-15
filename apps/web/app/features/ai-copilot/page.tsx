import Link from "next/link";
import {
  Bot, Brain, Zap, Shield, Clock, MessageSquare, ArrowRight,
  CheckCircle, Star, Activity, Target, FileText, Eye, Sparkles,
  Heart, TrendingUp, AlertTriangle, BookOpen, RefreshCw
} from "lucide-react";
import { FeaturePagePricingCTA } from "@/components/sections/FeaturePagePricingCTA";

const COPILOT_FEATURES = [
  {
    icon: MessageSquare,
    title: "Real-Time Intervention Suggestions",
    description: "During the session, the Copilot analyzes speech patterns, emotional tone, and clinical content to suggest evidence-based interventions — CBT techniques, DBT skills, ACT exercises — at the right moment.",
    highlight: "Suggestions appear in < 2 seconds",
  },
  {
    icon: Activity,
    title: "Emotional State Monitoring",
    description: "Continuous analysis of patient affect, emotional escalation, and de-escalation. Visual indicators alert the therapist to shifts in emotional intensity that may warrant attention.",
    highlight: "Tracks 8 emotional dimensions in real-time",
  },
  {
    icon: AlertTriangle,
    title: "Risk & Safety Signals",
    description: "Detects language patterns associated with suicidal ideation, self-harm, or acute distress. Immediate alert with suggested response and safety protocol guidance.",
    highlight: "C-SSRS-aligned detection framework",
  },
  {
    icon: Brain,
    title: "Memory-Contextualized Guidance",
    description: "Every copilot suggestion is informed by the patient's full memory graph — past traumas, coping strategies, what has worked before. Never generic, always patient-specific.",
    highlight: "Uses 180-day memory context window",
  },
  {
    icon: Target,
    title: "Treatment Goal Tracking",
    description: "The Copilot tracks when session content relates to active treatment goals and logs progress automatically. See in real-time how today's session maps to the treatment plan.",
    highlight: "Auto-links to treatment goals",
  },
  {
    icon: BookOpen,
    title: "Clinical Knowledge Integration",
    description: "Access DSM-5 criteria, evidence-based treatment protocols (CPT, EMDR, DBT), medication interactions, and clinical guidelines — all within the session without leaving the interface.",
    highlight: "DSM-5 + 200+ clinical protocols",
  },
  {
    icon: FileText,
    title: "Session Structure Guidance",
    description: "Suggests agenda items, session timing, and transition prompts based on session goals, patient energy, and historical session patterns.",
    highlight: "Adapts to your therapy style",
  },
  {
    icon: Eye,
    title: "Post-Session Review",
    description: "After each session, the Copilot generates a clinical debrief: key themes, patient affect arc, goals addressed, recommended next steps, and note pre-fill.",
    highlight: "Full debrief in under 60 seconds",
  },
];

const MODALITIES = [
  { name: "CBT", desc: "Cognitive restructuring, thought records, behavioral activation" },
  { name: "DBT", desc: "Distress tolerance, mindfulness, emotional regulation skills" },
  { name: "ACT", desc: "Values clarification, defusion, acceptance strategies" },
  { name: "EMDR", desc: "Processing protocols, bilateral stimulation guidance" },
  { name: "Trauma-Focused", desc: "CPT, PE, somatic approaches for trauma processing" },
  { name: "Motivational", desc: "MI techniques, change talk identification, ambivalence work" },
  { name: "Family Systems", desc: "Structural, strategic, and narrative family approaches" },
  { name: "Psychodynamic", desc: "Transference patterns, defense mechanism awareness" },
];

const PRIVACY_PRINCIPLES = [
  "Copilot suggestions are not stored as PHI unless the therapist chooses to include them in notes",
  "Audio is processed in real-time and not retained after session (configurable)",
  "Therapist remains fully in control — Copilot suggests, never directs",
  "HIPAA BAA covers all Copilot processing",
  "Copilot can be fully disabled per-session or per-patient",
];

export default function AICopilotPage() {
  return (
    <div className="min-h-screen bg-white">
      {/* Hero */}
      <section className="bg-gradient-to-br from-[#0A2342] to-[#1a3a6a] text-white py-24 relative overflow-hidden">
        <div className="absolute top-10 right-10 w-80 h-80 bg-[#2EC4B6]/10 rounded-full blur-3xl pointer-events-none" />
        <div className="max-w-5xl mx-auto px-6 text-center relative">
          <div className="inline-flex items-center gap-2 bg-white/10 border border-white/20 rounded-full px-5 py-2 mb-8">
            <Bot className="w-4 h-4 text-[#2EC4B6]" />
            <span className="text-sm font-medium">AI Copilot</span>
            <span className="bg-violet-500 text-white text-xs px-2 py-0.5 rounded-full">Live Assistance</span>
          </div>
          <h1 className="text-5xl md:text-6xl font-bold mb-6 leading-tight">
            Your AI Co-Clinician<br />
            <span className="text-[#2EC4B6]">In Every Session</span>
          </h1>
          <p className="text-xl text-white/80 max-w-3xl mx-auto mb-10">
            The 24Therapy.ai Copilot sits alongside you in every session — listening, analyzing, and providing real-time clinical guidance so you can be fully present with your patient.
          </p>
          <div className="flex flex-wrap justify-center gap-4 mb-12">
            <Link href="/contact?type=demo" className="bg-[#2EC4B6] text-white px-8 py-3 rounded-xl font-semibold hover:bg-[#26b0a2] transition flex items-center gap-2">
              See Copilot Demo <ArrowRight className="w-4 h-4" />
            </Link>
            <Link href="/ai-scribe" className="border border-white/30 text-white px-8 py-3 rounded-xl font-semibold hover:bg-white/10 transition">
              AI Scribe Overview
            </Link>
          </div>

          {/* Mock Copilot UI Preview */}
          <div className="bg-white/10 backdrop-blur border border-white/20 rounded-2xl p-6 max-w-2xl mx-auto text-left">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
              <span className="text-xs text-white/70 font-medium">AI Copilot • Live Session</span>
            </div>
            <div className="space-y-3">
              <div className="bg-white/10 rounded-xl p-3 border border-white/10">
                <div className="text-xs text-[#2EC4B6] font-medium mb-1">💡 Suggestion — CBT</div>
                <div className="text-sm text-white/90">Patient mentioned &quot;I always fail at everything.&quot; Consider thought record: identify cognitive distortion (all-or-nothing thinking) and explore evidence for/against.</div>
              </div>
              <div className="bg-amber-500/20 rounded-xl p-3 border border-amber-400/30">
                <div className="text-xs text-amber-300 font-medium mb-1">⚠️ Affect Shift Detected</div>
                <div className="text-sm text-white/90">Emotional tone dropped sharply in the last 2 minutes. Patient may be approaching emotional limit for today&apos;s topic.</div>
              </div>
              <div className="bg-white/10 rounded-xl p-3 border border-white/10">
                <div className="text-xs text-[#2EC4B6] font-medium mb-1">🎯 Goal Progress</div>
                <div className="text-sm text-white/90">This discussion directly relates to Goal #2: &quot;Reducing perfectionism and self-criticism.&quot; Consider logging progress.</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="bg-slate-50 border-b border-slate-200 py-10">
        <div className="max-w-5xl mx-auto px-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
            {[
              { v: "< 2s", l: "Suggestion Latency" },
              { v: "8", l: "Therapy Modalities" },
              { v: "GPT-4o", l: "Powered by" },
              { v: "200+", l: "Clinical Protocols" },
            ].map((s) => (
              <div key={s.l}>
                <div className="text-2xl font-bold text-slate-900">{s.v}</div>
                <div className="text-sm text-slate-500">{s.l}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-20 bg-white">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-14">
            <h2 className="text-4xl font-bold text-slate-900 mb-4">What the Copilot Does</h2>
            <p className="text-slate-600 max-w-xl mx-auto">
              Eight intelligent capabilities that work together to support every aspect of the session.
            </p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {COPILOT_FEATURES.map((feature) => {
              const Icon = feature.icon;
              return (
                <div key={feature.title} className="bg-slate-50 rounded-2xl border border-slate-200 p-5 hover:shadow-md hover:border-[#2EC4B6]/40 transition-all">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#0A2342] to-[#1F5EFF] flex items-center justify-center mb-4">
                    <Icon className="w-5 h-5 text-white" />
                  </div>
                  <h3 className="font-bold text-slate-900 text-sm mb-2">{feature.title}</h3>
                  <p className="text-slate-600 text-xs leading-relaxed mb-3">{feature.description}</p>
                  <div className="text-xs font-medium text-[#2EC4B6]">✓ {feature.highlight}</div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Modalities */}
      <section className="py-16 bg-slate-50">
        <div className="max-w-5xl mx-auto px-6">
          <h2 className="text-2xl font-bold text-center text-slate-900 mb-8">Supports All Major Therapy Modalities</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {MODALITIES.map((mod) => (
              <div key={mod.name} className="bg-white rounded-xl border border-slate-200 p-4 text-center">
                <div className="font-bold text-slate-900 mb-1">{mod.name}</div>
                <div className="text-xs text-slate-500 leading-relaxed">{mod.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Ethics & Control */}
      <section className="py-16 bg-white">
        <div className="max-w-4xl mx-auto px-6">
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-8">
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-xl bg-amber-500 flex items-center justify-center flex-shrink-0">
                <Shield className="w-5 h-5 text-white" />
              </div>
              <div>
                <h3 className="font-bold text-slate-900 text-lg mb-3">Therapist Remains in Full Control</h3>
                <p className="text-slate-700 text-sm leading-relaxed mb-4">
                  The AI Copilot is an assistant, not a clinician. It suggests — you decide. Clinical judgment, therapeutic relationship, and treatment decisions always remain with the licensed therapist. The AI never provides diagnoses, prescribes treatment, or acts without therapist review and approval.
                </p>
                <ul className="space-y-2">
                  {PRIVACY_PRINCIPLES.map((p) => (
                    <li key={p} className="flex items-start gap-2 text-sm text-slate-700">
                      <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5" />
                      {p}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </div>
      </section>

      <FeaturePagePricingCTA
        headline="AI Copilot Is Included on Every Plan"
        subheadline="Real-time clinical guidance in every session — from pay-as-you-go to enterprise."
      />
    </div>
  );
}

// Reviewed: 2026-06-13 — 24Therapy audit
