"use client";

import Link from "next/link";
import {
  Brain, Bot, Mic, Network, BarChart3, Zap, Shield, Clock,
  ArrowRight, CheckCircle, Star, Sparkles, Target, FileText,
  Eye, Activity, Database, Globe, MessageSquare, TrendingUp
} from "lucide-react";

const WORKSPACE_MODULES = [
  {
    icon: Mic,
    title: "AI Scribe",
    badge: "Core",
    badgeColor: "bg-blue-100 text-blue-700",
    description: "Real-time session transcription and automatic generation of clinical notes in SOAP, DAP, BIRP, or narrative format. One-click review, edit, and sign.",
    href: "/ai-scribe",
  },
  {
    icon: Bot,
    title: "AI Copilot",
    badge: "Live Assist",
    badgeColor: "bg-violet-100 text-violet-700",
    description: "Real-time clinical guidance during sessions. Evidence-based intervention suggestions, risk signals, emotional tracking, and treatment goal alignment.",
    href: "/features/ai-copilot",
  },
  {
    icon: Network,
    title: "Memory Layer",
    badge: "Intelligence",
    badgeColor: "bg-teal-100 text-teal-700",
    description: "Longitudinal patient knowledge graph. 21 memory node types automatically extracted from sessions. Full timeline, relationship mapping, and clinical context assembly.",
    href: "/features/memory-layer",
  },
  {
    icon: Activity,
    title: "Risk Radar",
    badge: "Safety",
    badgeColor: "bg-red-100 text-red-700",
    description: "Continuous patient risk monitoring across your entire caseload. AI-generated risk scores, alert thresholds, safety signal detection, and escalation workflows.",
    href: "/features",
  },
  {
    icon: BarChart3,
    title: "Clinical Analytics",
    badge: "Insights",
    badgeColor: "bg-orange-100 text-orange-700",
    description: "Real-time outcome tracking, PHQ-9/GAD-7 trends, treatment response analysis, and comparative effectiveness reporting across patient populations.",
    href: "/features/analytics",
  },
  {
    icon: FileText,
    title: "Smart Notes & Reports",
    badge: "Documentation",
    badgeColor: "bg-green-100 text-green-700",
    description: "AI-assisted clinical note library, discharge summaries, treatment letters, progress reports, and referral documentation — all generated from session context.",
    href: "/features",
  },
];

const AGENT_MODES = [
  {
    mode: "Scribe Mode",
    description: "AI listens and documents. Minimal interruption. Full note generated post-session.",
    color: "border-blue-200 bg-blue-50",
    indicator: "bg-blue-500",
  },
  {
    mode: "Copilot Mode",
    description: "AI actively suggests. Real-time guidance panel active. Risk monitoring on.",
    color: "border-violet-200 bg-violet-50",
    indicator: "bg-violet-500",
  },
  {
    mode: "Supervisory Mode",
    description: "AI monitors quality. Flags for supervisor review. Training feedback enabled.",
    color: "border-amber-200 bg-amber-50",
    indicator: "bg-amber-500",
  },
  {
    mode: "Research Mode",
    description: "De-identified data collection. Outcome research protocols. IRB-compatible logging.",
    color: "border-green-200 bg-green-50",
    indicator: "bg-green-500",
  },
];

const CUSTOMIZATIONS = [
  "Choose AI verbosity: minimal, moderate, or full suggestions",
  "Set risk threshold: conservative, standard, or aggressive detection",
  "Configure note format per therapist or per patient",
  "Enable/disable specific suggestion categories (interventions, risks, goals)",
  "Set supervisor review requirements for specific note types",
  "Configure session prep depth and memory context window",
  "Enable AI training mode for supervision programs",
  "Set custom terminology and documentation style preferences",
];

export default function AIWorkspacePage() {
  return (
    <div className="min-h-screen bg-white">
      {/* Hero */}
      <section className="bg-gradient-to-br from-[#0A2342] via-[#1a3a6a] to-[#0A2342] text-white py-24 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-[#2EC4B6]/10 rounded-full blur-3xl pointer-events-none" />
        <div className="max-w-5xl mx-auto px-6 text-center relative">
          <div className="inline-flex items-center gap-2 bg-white/10 border border-white/20 rounded-full px-5 py-2 mb-8">
            <Sparkles className="w-4 h-4 text-[#2EC4B6]" />
            <span className="text-sm font-medium">AI Workspace</span>
            <span className="bg-gradient-to-r from-violet-500 to-blue-500 text-white text-xs px-2 py-0.5 rounded-full">Full Suite</span>
          </div>
          <h1 className="text-5xl md:text-6xl font-bold mb-6 leading-tight">
            Every AI Tool You Need<br />
            <span className="text-[#2EC4B6]">In One Workspace</span>
          </h1>
          <p className="text-xl text-white/80 max-w-3xl mx-auto mb-10">
            The AI Workspace is your complete clinical intelligence center — scribe, copilot, memory, risk monitoring, and analytics unified in a single, seamless interface.
          </p>
          <div className="flex flex-wrap justify-center gap-4 mb-14">
            <Link href="/contact?type=demo" className="bg-[#2EC4B6] text-white px-8 py-3 rounded-xl font-semibold hover:bg-[#26b0a2] transition flex items-center gap-2">
              See Full Workspace Demo <ArrowRight className="w-4 h-4" />
            </Link>
            <Link href="/features" className="border border-white/30 text-white px-8 py-3 rounded-xl font-semibold hover:bg-white/10 transition">
              All Features
            </Link>
          </div>

          {/* Workspace Preview */}
          <div className="bg-white/5 backdrop-blur border border-white/20 rounded-2xl p-6 max-w-4xl mx-auto text-left">
            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-2 bg-white/10 rounded-xl p-4 border border-white/10">
                <div className="text-xs text-white/50 mb-2 font-medium">SESSION WORKSPACE</div>
                <div className="text-sm text-white/80 leading-relaxed">
                  Patient: &ldquo;I&apos;ve been feeling really disconnected from everything lately, like nothing matters...&rdquo;
                </div>
                <div className="mt-3 flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-red-400 animate-pulse" />
                  <span className="text-xs text-red-300">Transcribing</span>
                  <div className="flex-1 bg-white/10 h-1 rounded-full overflow-hidden">
                    <div className="bg-[#2EC4B6] h-full w-3/4 rounded-full" />
                  </div>
                </div>
              </div>
              <div className="space-y-3">
                <div className="bg-violet-500/30 rounded-xl p-3 border border-violet-400/30">
                  <div className="text-xs text-violet-300 font-medium mb-1">🤖 Copilot</div>
                  <div className="text-xs text-white/80">Anhedonia pattern. Consider exploring recent activity changes.</div>
                </div>
                <div className="bg-amber-500/20 rounded-xl p-3 border border-amber-400/30">
                  <div className="text-xs text-amber-300 font-medium mb-1">⚡ Risk</div>
                  <div className="text-xs text-white/80">Passive ideation language detected. Assess further.</div>
                </div>
                <div className="bg-teal-500/20 rounded-xl p-3 border border-teal-400/30">
                  <div className="text-xs text-teal-300 font-medium mb-1">🧠 Memory</div>
                  <div className="text-xs text-white/80">Similar presentation: Session 14, Jan 3rd.</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Module Grid */}
      <section className="py-20 bg-white">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-14">
            <h2 className="text-4xl font-bold text-slate-900 mb-4">Six AI Modules, One Workspace</h2>
            <p className="text-slate-600 max-w-xl mx-auto">
              Each module is powerful standalone. Together they create a clinical intelligence system unlike anything else in mental health.
            </p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-7">
            {WORKSPACE_MODULES.map((mod) => {
              const Icon = mod.icon;
              return (
                <Link key={mod.title} href={mod.href} className="group bg-slate-50 rounded-2xl border border-slate-200 p-7 hover:shadow-lg hover:border-[#2EC4B6]/40 transition-all">
                  <div className="flex items-start justify-between mb-5">
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#0A2342] to-[#1F5EFF] flex items-center justify-center">
                      <Icon className="w-6 h-6 text-white" />
                    </div>
                    <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${mod.badgeColor}`}>{mod.badge}</span>
                  </div>
                  <h3 className="text-lg font-bold text-slate-900 mb-3 group-hover:text-[#1F5EFF] transition">{mod.title}</h3>
                  <p className="text-sm text-slate-600 leading-relaxed">{mod.description}</p>
                  <div className="mt-5 flex items-center gap-1 text-sm text-[#1F5EFF] font-medium group-hover:gap-2 transition-all">
                    Learn more <ArrowRight className="w-3.5 h-3.5" />
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      </section>

      {/* Agent Modes */}
      <section className="py-16 bg-slate-50">
        <div className="max-w-5xl mx-auto px-6">
          <h2 className="text-2xl font-bold text-center text-slate-900 mb-10">Four AI Agent Modes</h2>
          <div className="grid md:grid-cols-2 gap-5">
            {AGENT_MODES.map((mode) => (
              <div key={mode.mode} className={`rounded-2xl border p-6 ${mode.color}`}>
                <div className="flex items-center gap-3 mb-2">
                  <div className={`w-3 h-3 rounded-full ${mode.indicator}`} />
                  <h3 className="font-bold text-slate-900">{mode.mode}</h3>
                </div>
                <p className="text-sm text-slate-600 leading-relaxed">{mode.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Customization */}
      <section className="py-16 bg-white">
        <div className="max-w-5xl mx-auto px-6">
          <h2 className="text-2xl font-bold text-center text-slate-900 mb-8">Customizable to Your Practice</h2>
          <div className="grid md:grid-cols-2 gap-3">
            {CUSTOMIZATIONS.map((item) => (
              <div key={item} className="flex items-start gap-3 p-4 bg-slate-50 rounded-xl border border-slate-200">
                <CheckCircle className="w-4 h-4 text-[#2EC4B6] flex-shrink-0 mt-0.5" />
                <span className="text-sm text-slate-700">{item}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 bg-gradient-to-br from-[#0A2342] to-[#1a3a6a] text-white">
        <div className="max-w-3xl mx-auto px-6 text-center">
          <Sparkles className="w-14 h-14 text-[#2EC4B6] mx-auto mb-5" />
          <h2 className="text-3xl font-bold mb-4">Experience the Full AI Workspace</h2>
          <p className="text-white/80 mb-8 max-w-xl mx-auto">
            Join 4,800+ therapists who have transformed their practice with 24Therapy.ai&apos;s AI Workspace. Start with a 14-day free trial — no credit card required.
          </p>
          <div className="flex flex-wrap justify-center gap-4">
            <Link href="/contact?type=demo" className="bg-[#2EC4B6] text-white px-8 py-3 rounded-xl font-semibold hover:bg-[#26b0a2] transition flex items-center gap-2">
              Request Demo <ArrowRight className="w-4 h-4" />
            </Link>
            <Link href="/pricing" className="border border-white/30 text-white px-8 py-3 rounded-xl font-semibold hover:bg-white/10 transition">
              View Pricing
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
