"use client";

import Link from "next/link";
import {
  BarChart3, TrendingUp, Brain, Target, DollarSign, Users, ArrowRight,
  CheckCircle, Activity, PieChart, LineChart, Calendar, Shield,
  Sparkles, Star, BarChart2, ClipboardList, Heart, AlertTriangle,
  Download, RefreshCw, Zap, Globe, ChevronRight, Award
} from "lucide-react";

const ANALYTICS_MODULES = [
  {
    icon: TrendingUp,
    title: "Clinical Outcomes",
    description: "Track treatment effectiveness with population-level outcome analytics. See PHQ-9, GAD-7, and custom assessment score trends across your practice.",
    metrics: ["Symptom improvement rates", "Goal achievement rates", "Average treatment duration", "Outcome by modality"],
    color: "text-emerald-600 bg-emerald-50",
  },
  {
    icon: DollarSign,
    title: "Revenue Intelligence",
    description: "Real-time revenue dashboards with session revenue, insurance claim tracking, collection rates, and monthly/annual forecasting.",
    metrics: ["MRR/ARR tracking", "Collection rate analysis", "Insurance vs. self-pay breakdown", "Revenue per therapist"],
    color: "text-blue-600 bg-blue-50",
  },
  {
    icon: Users,
    title: "Patient Population",
    description: "Demographic analysis, diagnosis distribution, care engagement patterns, and risk stratification across your patient population.",
    metrics: ["Diagnosis distribution", "Demographics dashboard", "Engagement scoring", "Risk stratification"],
    color: "text-violet-600 bg-violet-50",
  },
  {
    icon: Activity,
    title: "Session Metrics",
    description: "Session volume, completion rates, no-show analysis, duration trends, and wait time tracking across all therapists and locations.",
    metrics: ["Session completion rates", "No-show trends", "Wait time analysis", "Peak booking times"],
    color: "text-orange-600 bg-orange-50",
  },
  {
    icon: Brain,
    title: "AI Performance",
    description: "Track AI scribe accuracy, note approval rates, copilot suggestion adoption, risk alert accuracy, and total time saved by AI.",
    metrics: ["Note approval rates", "Copilot suggestion acceptance", "Risk alert accuracy", "Time saved per therapist"],
    color: "text-[#2EC4B6] bg-[#2EC4B6]/10",
  },
  {
    icon: Target,
    title: "Therapist Productivity",
    description: "Per-therapist productivity metrics: sessions completed, documentation time, average note quality, patient load, and retention.",
    metrics: ["Documentation time trends", "Patient retention rates", "Session-to-note ratio", "Caseload management"],
    color: "text-rose-600 bg-rose-50",
  },
];

const REPORTS = [
  { name: "Monthly Practice Summary", description: "Full overview of sessions, revenue, clinical outcomes" },
  { name: "Insurance Billing Report", description: "Claims submitted, paid, denied, outstanding balance" },
  { name: "Clinical Outcomes Report", description: "PHQ-9 / GAD-7 trends, treatment effectiveness" },
  { name: "AI Usage Report", description: "Notes generated, time saved, copilot adoption" },
  { name: "Risk Management Report", description: "Alerts generated, escalations, safety plans" },
  { name: "Patient Demographics", description: "Age, diagnoses, insurance types, referral sources" },
  { name: "Therapist Performance", description: "Session volume, note completion, patient satisfaction" },
  { name: "HIPAA Compliance Audit", description: "Access logs, PHI handling, security events" },
];

const TESTIMONIALS = [
  {
    quote: "The clinical outcomes dashboard completely changed how I approach supervision. I can see exactly which therapists need training support.",
    author: "Dr. Amanda Foster, PhD",
    role: "Clinical Director, Mindful Health Group",
    rating: 5,
  },
  {
    quote: "I finally understand my practice finances. The revenue intelligence dashboard tells me more than my accountant did.",
    author: "James Rivera, LCSW",
    role: "Solo Practitioner",
    rating: 5,
  },
];

const INTEGRATION_SOURCES = [
  "Session data", "Assessment scores", "Insurance claims", "Patient demographics",
  "AI performance metrics", "Billing events", "Risk alerts", "Workflow executions",
];

export default function AnalyticsPage() {
  return (
    <div className="min-h-screen bg-white">
      {/* Hero */}
      <section className="bg-gradient-to-br from-[#0A2342] via-[#0f2d5a] to-[#1F5EFF] text-white py-20 px-4">
        <div className="max-w-5xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 bg-white/10 border border-white/20 rounded-full px-4 py-1.5 text-sm mb-6">
            <BarChart3 className="w-4 h-4 text-[#2EC4B6]" />
            Practice Intelligence Platform
          </div>
          <h1 className="text-4xl md:text-6xl font-bold mb-6">
            Analytics that{" "}
            <span className="text-[#2EC4B6]">drive outcomes</span>
          </h1>
          <p className="text-xl text-white/80 max-w-3xl mx-auto mb-10">
            Clinical outcomes, revenue intelligence, AI performance metrics, patient population analytics, and therapist productivity — unified in one dashboard.
          </p>
          <div className="flex flex-wrap gap-4 justify-center">
            <Link
              href="/signup?role=therapist"
              className="bg-[#2EC4B6] hover:bg-[#26b0a3] text-white px-8 py-3 rounded-xl font-semibold flex items-center gap-2"
            >
              Get Started Free <ArrowRight className="w-4 h-4" />
            </Link>
            <Link
              href="/contact"
              className="bg-white/10 border border-white/30 text-white px-8 py-3 rounded-xl font-semibold hover:bg-white/20"
            >
              Request Demo
            </Link>
          </div>
        </div>
      </section>

      {/* Key Stats */}
      <section className="py-12 px-4 bg-[#0A2342] text-white">
        <div className="max-w-5xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
          {[
            { value: "50+", label: "Pre-built reports" },
            { value: "Real-time", label: "Dashboard updates" },
            { value: "100%", label: "HIPAA-compliant data" },
            { value: "API", label: "Export to any system" },
          ].map((s) => (
            <div key={s.label}>
              <div className="text-3xl font-bold text-[#2EC4B6]">{s.value}</div>
              <div className="text-sm text-white/60 mt-1">{s.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Analytics Modules */}
      <section className="py-16 px-4">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-[#0A2342] mb-4">Six analytics pillars</h2>
            <p className="text-gray-500 max-w-2xl mx-auto">
              Every dimension of practice performance, from clinical outcomes to financial health, all in one place.
            </p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {ANALYTICS_MODULES.map((module) => {
              const Icon = module.icon;
              return (
                <div
                  key={module.title}
                  className="border border-gray-200 rounded-2xl p-6 hover:border-[#2EC4B6] hover:shadow-md transition-all"
                >
                  <div className={`w-10 h-10 rounded-xl ${module.color} flex items-center justify-center mb-4`}>
                    <Icon className="w-5 h-5" />
                  </div>
                  <h3 className="font-bold text-[#0A2342] mb-2">{module.title}</h3>
                  <p className="text-sm text-gray-500 mb-4">{module.description}</p>
                  <ul className="space-y-1.5">
                    {module.metrics.map((m) => (
                      <li key={m} className="flex items-center gap-2 text-xs text-gray-600">
                        <CheckCircle className="w-3 h-3 text-[#2EC4B6] flex-shrink-0" />
                        {m}
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Data Sources */}
      <section className="py-16 px-4 bg-gray-50">
        <div className="max-w-5xl mx-auto">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div>
              <h2 className="text-3xl font-bold text-[#0A2342] mb-6">
                Unified from every data source
              </h2>
              <p className="text-gray-600 mb-8">
                Analytics automatically aggregate data from every part of your practice — sessions, billing, assessments, AI usage, and more. No manual data entry. No spreadsheets.
              </p>
              <div className="grid grid-cols-2 gap-3">
                {INTEGRATION_SOURCES.map((s) => (
                  <div key={s} className="flex items-center gap-2 text-sm text-gray-600">
                    <div className="w-1.5 h-1.5 rounded-full bg-[#2EC4B6]" />
                    {s}
                  </div>
                ))}
              </div>
            </div>
            <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-[#0A2342]">Clinical Outcomes</h3>
                <span className="text-xs bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full">↑ 12% this month</span>
              </div>
              <div className="space-y-3">
                {[
                  { label: "PHQ-9 Improvement Rate", value: 78, color: "bg-emerald-500" },
                  { label: "GAD-7 Improvement Rate", value: 71, color: "bg-blue-500" },
                  { label: "Goal Achievement Rate", value: 64, color: "bg-violet-500" },
                  { label: "Patient Retention (12mo)", value: 83, color: "bg-[#2EC4B6]" },
                ].map((item) => (
                  <div key={item.label}>
                    <div className="flex items-center justify-between text-sm mb-1">
                      <span className="text-gray-600">{item.label}</span>
                      <span className="font-medium text-[#0A2342]">{item.value}%</span>
                    </div>
                    <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className={`h-full ${item.color} rounded-full`}
                        style={{ width: `${item.value}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Reports Library */}
      <section className="py-16 px-4">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-[#0A2342] mb-4">Pre-built report library</h2>
            <p className="text-gray-500">Run any report instantly. Schedule recurring delivery to your inbox.</p>
          </div>
          <div className="grid md:grid-cols-2 gap-4">
            {REPORTS.map((report) => (
              <div
                key={report.name}
                className="flex items-start gap-4 border border-gray-200 rounded-xl p-4 hover:border-[#2EC4B6] hover:shadow-sm transition-all"
              >
                <div className="w-8 h-8 rounded-lg bg-[#0A2342]/5 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <Download className="w-4 h-4 text-[#0A2342]" />
                </div>
                <div>
                  <div className="font-semibold text-[#0A2342] text-sm">{report.name}</div>
                  <div className="text-xs text-gray-500 mt-0.5">{report.description}</div>
                </div>
                <ChevronRight className="w-4 h-4 text-gray-400 ml-auto flex-shrink-0 mt-1" />
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="py-16 px-4 bg-gray-50">
        <div className="max-w-4xl mx-auto grid md:grid-cols-2 gap-6">
          {TESTIMONIALS.map((t) => (
            <div key={t.author} className="bg-white rounded-2xl p-6 border border-gray-200">
              <div className="flex mb-4">
                {[...Array(t.rating)].map((_, i) => (
                  <Star key={i} className="w-4 h-4 text-yellow-400 fill-yellow-400" />
                ))}
              </div>
              <p className="text-gray-700 text-sm mb-4 italic">"{t.quote}"</p>
              <div>
                <div className="font-semibold text-[#0A2342] text-sm">{t.author}</div>
                <div className="text-xs text-gray-400">{t.role}</div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 px-4 bg-gradient-to-br from-[#0A2342] to-[#1F5EFF] text-white">
        <div className="max-w-3xl mx-auto text-center">
          <BarChart3 className="w-10 h-10 text-[#2EC4B6] mx-auto mb-6" />
          <h2 className="text-3xl font-bold mb-4">Your practice data, finally actionable</h2>
          <p className="text-white/70 mb-8 text-lg">
            Stop guessing. Start leading your practice with evidence-based intelligence.
          </p>
          <div className="flex flex-wrap gap-4 justify-center">
            <Link
              href="/signup?role=therapist"
              className="bg-[#2EC4B6] hover:bg-[#26b0a3] text-white px-8 py-3 rounded-xl font-semibold flex items-center gap-2"
            >
              Get Started Free <ArrowRight className="w-4 h-4" />
            </Link>
            <Link href="/pricing" className="bg-white/10 border border-white/30 text-white px-8 py-3 rounded-xl font-semibold hover:bg-white/20">
              View Pricing
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}

// Reviewed: 2026-06-13 — 24Therapy audit
