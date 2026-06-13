"use client";

import Link from "next/link";
import {
  Brain, Database, Network, Clock, TrendingUp, Shield, Zap,
  CheckCircle, ArrowRight, Star, Activity, FileText, Heart,
  Target, BarChart3, RefreshCw, Layers, Eye, Sparkles, Globe
} from "lucide-react";

const MEMORY_NODE_TYPES = [
  { name: "Symptom", color: "bg-red-100 text-red-700 border-red-200", icon: Activity },
  { name: "Diagnosis", color: "bg-purple-100 text-purple-700 border-purple-200", icon: FileText },
  { name: "Medication", color: "bg-blue-100 text-blue-700 border-blue-200", icon: Heart },
  { name: "Treatment Goal", color: "bg-green-100 text-green-700 border-green-200", icon: Target },
  { name: "Life Event", color: "bg-orange-100 text-orange-700 border-orange-200", icon: Clock },
  { name: "Relationship", color: "bg-pink-100 text-pink-700 border-pink-200", icon: Network },
  { name: "Coping Strategy", color: "bg-teal-100 text-teal-700 border-teal-200", icon: Zap },
  { name: "Risk Factor", color: "bg-amber-100 text-amber-700 border-amber-200", icon: Shield },
  { name: "Progress Marker", color: "bg-emerald-100 text-emerald-700 border-emerald-200", icon: TrendingUp },
  { name: "Trauma Element", color: "bg-rose-100 text-rose-700 border-rose-200", icon: Layers },
  { name: "Session Insight", color: "bg-indigo-100 text-indigo-700 border-indigo-200", icon: Sparkles },
  { name: "Assessment Score", color: "bg-cyan-100 text-cyan-700 border-cyan-200", icon: BarChart3 },
];

const CAPABILITIES = [
  {
    icon: Brain,
    title: "Automatic Memory Extraction",
    description: "During every session, the AI automatically extracts clinically significant information — new symptoms, life events, relationship changes, medication updates — and adds them to the patient's memory graph without therapist effort.",
    stats: "Avg. 12 memory nodes extracted per session",
  },
  {
    icon: Network,
    title: "Knowledge Graph Construction",
    description: "Memory nodes are connected in a semantic knowledge graph that reflects real clinical relationships. A new anxiety trigger is automatically linked to existing trauma elements, coping strategies, and session history.",
    stats: "3.4M+ memory connections mapped across platform",
  },
  {
    icon: Clock,
    title: "Longitudinal Timeline",
    description: "Every memory node is timestamped and traceable to the session where it was identified. Navigate a patient's clinical journey from intake to today — across months or years of treatment.",
    stats: "Full timeline from day 1 of treatment",
  },
  {
    icon: Eye,
    title: "Session Preparation",
    description: "Before each session, 24Therapy.ai surfaces the most relevant memory context: what changed since last session, active risk factors, current goals, and suggested topics based on patient trajectory.",
    stats: "87% of therapists say prep time cut in half",
  },
  {
    icon: Sparkles,
    title: "AI Context Assembly",
    description: "When the AI Copilot provides suggestions or the Scribe generates notes, it assembles a rich context window from the memory graph — ensuring every AI output is personalized to this specific patient's history.",
    stats: "Context window includes 180+ days of patient history",
  },
  {
    icon: TrendingUp,
    title: "Patient Narrative Generation",
    description: "Generate a clinically-aware patient narrative at any time — a coherent summary of the patient's journey, current status, treatment progress, and recommendations for future care.",
    stats: "Available in 30 seconds, review-ready quality",
  },
];

const CLINICAL_VALUE = [
  { title: "No More Re-Explaining", body: "Patients don't have to repeat their history every session. The therapist already knows — through AI memory — what matters most." },
  { title: "Consistent Care Across Providers", body: "If a patient changes therapists within your practice, the new therapist has instant access to the full clinical memory — no information loss." },
  { title: "Early Warning Signals", body: "The memory layer tracks subtle pattern changes over time, surfacing early warning signals before they become crises." },
  { title: "Treatment Outcome Correlation", body: "See which interventions worked for this specific patient — not population averages. Personalized outcome intelligence." },
];

const PRIVACY_CONTROLS = [
  "Memory nodes are stored encrypted at rest (AES-256-GCM)",
  "Per-patient, per-therapist access controls enforced at the graph level",
  "Memory extraction can be disabled per patient or per session",
  "Patients can request memory review, correction, or deletion (HIPAA right of access)",
  "No memory data crosses tenant boundaries under any circumstances",
  "Memory data is never used to train shared AI models",
];

export default function MemoryLayerPage() {
  return (
    <div className="min-h-screen bg-white">
      {/* Hero */}
      <section className="bg-gradient-to-br from-[#0A2342] via-[#0d2d55] to-[#1a3a6a] text-white py-24 overflow-hidden relative">
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          {/* Decorative network dots */}
          {[...Array(6)].map((_, i) => (
            <div key={i} className="absolute w-2 h-2 rounded-full bg-[#2EC4B6]/30" style={{ left: `${15 + i * 15}%`, top: `${20 + (i % 3) * 25}%` }} />
          ))}
        </div>
        <div className="max-w-5xl mx-auto px-6 text-center relative">
          <div className="inline-flex items-center gap-2 bg-white/10 border border-white/20 rounded-full px-5 py-2 mb-8">
            <Brain className="w-4 h-4 text-[#2EC4B6]" />
            <span className="text-sm font-medium">Memory Layer</span>
            <span className="bg-[#2EC4B6] text-white text-xs px-2 py-0.5 rounded-full">Core AI</span>
          </div>
          <h1 className="text-5xl md:text-6xl font-bold mb-6 leading-tight">
            The AI That Remembers<br />
            <span className="text-[#2EC4B6]">Every Patient, Always</span>
          </h1>
          <p className="text-xl text-white/80 max-w-3xl mx-auto mb-10">
            24Therapy.ai&apos;s Memory Layer builds a living, longitudinal knowledge graph for every patient — automatically capturing clinical intelligence from every session and making it instantly accessible.
          </p>
          <div className="flex flex-wrap justify-center gap-4">
            <Link href="/contact?type=demo" className="bg-[#2EC4B6] text-white px-8 py-3 rounded-xl font-semibold hover:bg-[#26b0a2] transition flex items-center gap-2">
              See Memory Layer Demo <ArrowRight className="w-4 h-4" />
            </Link>
            <Link href="/ai-scribe" className="border border-white/30 text-white px-8 py-3 rounded-xl font-semibold hover:bg-white/10 transition">
              AI Feature Overview
            </Link>
          </div>
        </div>
      </section>

      {/* Memory Node Types */}
      <section className="py-16 bg-slate-50 border-b border-slate-200">
        <div className="max-w-6xl mx-auto px-6">
          <h2 className="text-center text-lg font-semibold text-slate-600 mb-8">21 Memory Node Types — Covering All Clinical Domains</h2>
          <div className="flex flex-wrap gap-3 justify-center">
            {MEMORY_NODE_TYPES.map((node) => {
              const Icon = node.icon;
              return (
                <div key={node.name} className={`flex items-center gap-2 px-4 py-2 rounded-full border text-sm font-medium ${node.color}`}>
                  <Icon className="w-3.5 h-3.5" />
                  {node.name}
                </div>
              );
            })}
            <div className="flex items-center gap-2 px-4 py-2 rounded-full border bg-slate-100 text-slate-600 border-slate-200 text-sm font-medium">
              +9 more...
            </div>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-24">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-slate-900 mb-4">How the Memory Layer Works</h2>
            <p className="text-lg text-slate-600 max-w-2xl mx-auto">
              A continuous intelligence system that grows with every session, automatically, without therapist effort.
            </p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {CAPABILITIES.map((cap) => {
              const Icon = cap.icon;
              return (
                <div key={cap.title} className="bg-white border border-slate-200 rounded-2xl p-7 hover:shadow-lg hover:border-[#2EC4B6]/30 transition-all">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#0A2342] to-[#1F5EFF] flex items-center justify-center mb-5">
                    <Icon className="w-6 h-6 text-white" />
                  </div>
                  <h3 className="text-lg font-bold text-slate-900 mb-3">{cap.title}</h3>
                  <p className="text-slate-600 text-sm leading-relaxed mb-4">{cap.description}</p>
                  <div className="text-xs font-medium text-[#2EC4B6] bg-teal-50 rounded-lg px-3 py-2">
                    📊 {cap.stats}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* 3-Step Flow */}
      <section className="py-16 bg-gradient-to-br from-slate-900 to-[#0A2342] text-white">
        <div className="max-w-5xl mx-auto px-6">
          <h2 className="text-3xl font-bold text-center mb-12">How Memory Improves Every Session</h2>
          <div className="grid md:grid-cols-3 gap-6">
            {[
              { step: "1", title: "Before Session", desc: "AI surfaces: last session summary, active risk factors, goals progress, and suggested focus areas.", icon: RefreshCw, color: "bg-blue-600" },
              { step: "2", title: "During Session", desc: "Real-time memory extraction. New information auto-tagged as memory nodes. AI copilot uses context for suggestions.", icon: Brain, color: "bg-teal-600" },
              { step: "3", title: "After Session", desc: "Memory graph updated with new nodes and connections. Note generated using full memory context for accuracy.", icon: Database, color: "bg-violet-600" },
            ].map((item) => {
              const Icon = item.icon;
              return (
                <div key={item.step} className="bg-white/10 backdrop-blur border border-white/20 rounded-2xl p-7 text-center">
                  <div className={`w-12 h-12 ${item.color} rounded-2xl flex items-center justify-center mx-auto mb-4`}>
                    <Icon className="w-6 h-6 text-white" />
                  </div>
                  <div className="text-xs text-white/50 mb-1 font-medium uppercase tracking-wider">Step {item.step}</div>
                  <h3 className="font-bold text-lg mb-3">{item.title}</h3>
                  <p className="text-white/70 text-sm leading-relaxed">{item.desc}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Clinical Value */}
      <section className="py-20 bg-white">
        <div className="max-w-5xl mx-auto px-6">
          <h2 className="text-3xl font-bold text-center text-slate-900 mb-12">Why Memory Layer Changes Clinical Practice</h2>
          <div className="grid md:grid-cols-2 gap-6">
            {CLINICAL_VALUE.map((item) => (
              <div key={item.title} className="flex gap-4 p-6 bg-blue-50 rounded-2xl border border-blue-100">
                <CheckCircle className="w-6 h-6 text-[#2EC4B6] flex-shrink-0 mt-0.5" />
                <div>
                  <h3 className="font-bold text-slate-900 mb-2">{item.title}</h3>
                  <p className="text-sm text-slate-600 leading-relaxed">{item.body}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Privacy Controls */}
      <section className="py-16 bg-slate-50">
        <div className="max-w-4xl mx-auto px-6">
          <div className="flex items-center gap-3 mb-8">
            <div className="w-10 h-10 rounded-xl bg-[#0A2342] flex items-center justify-center">
              <Shield className="w-5 h-5 text-[#2EC4B6]" />
            </div>
            <h2 className="text-2xl font-bold text-slate-900">Memory Layer Privacy Controls</h2>
          </div>
          <div className="grid md:grid-cols-2 gap-4">
            {PRIVACY_CONTROLS.map((control) => (
              <div key={control} className="flex items-start gap-3 p-4 bg-white rounded-xl border border-slate-200">
                <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5" />
                <span className="text-sm text-slate-700">{control}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 bg-gradient-to-br from-[#0A2342] to-[#1a3a6a] text-white">
        <div className="max-w-3xl mx-auto px-6 text-center">
          <Brain className="w-14 h-14 text-[#2EC4B6] mx-auto mb-5" />
          <h2 className="text-3xl font-bold mb-4">See the Memory Layer in Action</h2>
          <p className="text-white/80 mb-8">
            Watch how the Memory Layer transforms a routine session into a clinically intelligent encounter — and how it builds knowledge over months of treatment.
          </p>
          <Link href="/contact?type=demo" className="bg-[#2EC4B6] text-white px-8 py-3 rounded-xl font-semibold hover:bg-[#26b0a2] transition inline-flex items-center gap-2">
            Request Live Demo <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </section>
    </div>
  );
}

// Reviewed: 2026-06-13 — 24Therapy audit
