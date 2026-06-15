"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Brain, FileText, Shield, Zap, Network, BarChart3, Video, GitBranch,
  Users, Target, ClipboardList, MessageSquare, Bell, CreditCard, Search,
  Star, ArrowRight, CheckCircle, Play, Sparkles, Lock, Globe, Clock,
  Activity, TrendingUp, AlertTriangle, BookOpen, Heart, ChevronRight,
  Mic, Bot, Database, RefreshCw, Calendar, Award, Building2
} from "lucide-react";

const FEATURE_CATEGORIES = [
  {
    id: "ai",
    label: "AI Intelligence",
    icon: Brain,
    color: "from-violet-500 to-purple-600",
    features: [
      {
        icon: Mic,
        title: "AI Scribe",
        badge: "Core",
        description: "Auto-generate SOAP, DAP, BIRP, and Progress notes directly from session audio. Review in 60 seconds.",
        href: "/ai-scribe",
        highlights: ["SOAP / DAP / BIRP / Narrative formats", "60-second generation", "Therapist review & approval flow", "Versioned edit history"],
        stat: "3 hrs saved / therapist / week",
      },
      {
        icon: Bot,
        title: "Clinical Copilot",
        badge: "AI",
        description: "Real-time session guidance. The AI surfaces relevant clinical insights, intervention suggestions, and questions to explore as you work.",
        href: "/features/ai-copilot",
        highlights: ["Live session guidance", "Intervention technique suggestions", "Evidence-based recommendations", "Risk flag surfacing"],
        stat: "GPT-4o powered, < 2s suggestion latency",
      },
      {
        icon: Network,
        title: "Patient Memory Layer",
        badge: "Unique",
        description: "A longitudinal patient intelligence system that remembers every session, builds knowledge graphs, and provides AI context across all care.",
        href: "/ai-scribe#memory",
        highlights: ["21 memory node types", "Knowledge graph visualization", "Longitudinal patient narrative", "AI context assembly"],
        stat: "Years of patient history, instant recall",
      },
      {
        icon: AlertTriangle,
        title: "Crisis Detection",
        badge: "Safety",
        description: "Real-time AI monitoring detects risk language, self-harm indicators, and crisis signals during sessions — with instant therapist alerts and C-SSRS protocol guidance.",
        href: "/features/crisis-detection",
        highlights: ["C-SSRS aligned severity scoring", "< 2 second detection latency", "Immediate in-session alert", "988 Lifeline surfaced on every flag"],
        stat: "Included on every plan, every session",
      },
    ],
  },
  {
    id: "clinical",
    label: "Clinical Workflow",
    icon: ClipboardList,
    color: "from-teal-500 to-cyan-600",
    features: [
      {
        icon: Video,
        title: "Telehealth Platform",
        badge: "HIPAA",
        description: "HIPAA-secure video sessions with integrated AI scribe, waiting room, session controls, and encrypted recording.",
        href: "/features/teletherapy",
        highlights: ["End-to-end encrypted video", "AI scribe integration", "Branded waiting room", "Session recording & transcripts"],
        stat: "99.9% uptime SLA",
      },
      {
        icon: Target,
        title: "Treatment Plans",
        badge: "Clinical",
        description: "Evidence-based treatment planning with goal tracking, objective measurement, AI-assisted plan generation, and supervisor review.",
        href: "/for-therapists",
        highlights: ["Diagnoses-linked goals", "Measurable objectives", "AI plan generation", "Supervisor sign-off workflow"],
        stat: "DSM-5 and ICD-11 aligned",
      },
      {
        icon: ClipboardList,
        title: "Assessments",
        badge: "Validated",
        description: "Validated clinical assessments (PHQ-9, GAD-7, PCL-5, AUDIT, MDQ) with automated scoring, trend tracking, and AI interpretation.",
        href: "/for-therapists",
        highlights: ["PHQ-9, GAD-7, PCL-5 + more", "Auto-scoring with severity bands", "Score trend charts", "Patient self-administration"],
        stat: "15+ validated instruments",
      },
      {
        icon: GitBranch,
        title: "Workflow Engine",
        badge: "Automation",
        description: "Clinical and operational automation. Create trigger-condition-action workflows for reminders, escalations, billing, and compliance.",
        href: "/for-therapists",
        highlights: ["20+ trigger types", "Automated reminders", "Risk escalation workflows", "Billing automation"],
        stat: "Hours of admin work eliminated",
      },
    ],
  },
  {
    id: "practice",
    label: "Practice Management",
    icon: Building2,
    color: "from-blue-500 to-indigo-600",
    features: [
      {
        icon: Calendar,
        title: "Scheduling & Calendar",
        badge: "Smart",
        description: "Intelligent scheduling with availability management, patient self-booking, automated reminders, and no-show tracking.",
        href: "/for-therapists",
        highlights: ["Patient self-scheduling", "Automated reminders", "No-show tracking", "Recurring appointment setup"],
        stat: "Automated reminders reduce no-shows",
      },
      {
        icon: CreditCard,
        title: "Billing & Insurance",
        badge: "Revenue",
        description: "Complete billing management with insurance claims, ERA processing, patient invoicing, Stripe payments, and revenue reporting.",
        href: "/for-therapists",
        highlights: ["Insurance claim submission", "ERA/EOB processing", "Stripe patient payments", "Revenue dashboards"],
        stat: "Stripe + insurance billing in one place",
      },
      {
        icon: BarChart3,
        title: "Practice Analytics",
        badge: "Intelligence",
        description: "Deep practice intelligence: clinical outcomes, session metrics, revenue forecasting, AI usage analytics, and patient population insights.",
        href: "/features/analytics",
        highlights: ["Clinical outcome tracking", "Revenue forecasting", "Patient population dashboards", "AI ROI metrics"],
        stat: "Real-time practice intelligence",
      },
      {
        icon: Users,
        title: "Team Management",
        badge: "Multi-Provider",
        description: "Multi-therapist practice management with role-based access, supervisor workflows, caseload management, and team reporting.",
        href: "/for-therapists#practice",
        highlights: ["Role-based permissions", "Supervisor review queues", "Caseload assignment", "Team performance reports"],
        stat: "Unlimited therapists",
      },
    ],
  },
  {
    id: "enterprise",
    label: "Enterprise & Compliance",
    icon: Shield,
    color: "from-slate-500 to-gray-700",
    features: [
      {
        icon: Lock,
        title: "HIPAA Compliance",
        badge: "Required",
        description: "End-to-end HIPAA compliance: BAA included, PHI encryption, audit trails, access controls, minimum necessary standard.",
        href: "/security",
        highlights: ["BAA included in all plans", "AES-256 encryption at rest", "TLS 1.3 in transit", "Full audit trails"],
        stat: "BAA included on all plans",
      },
      {
        icon: Globe,
        title: "White-Label",
        badge: "Enterprise",
        description: "Deploy under your own brand. Custom domain, logo, colors, email sender, and fully hidden platform branding.",
        href: "/enterprise",
        highlights: ["Custom domain", "Brand CSS injection", "White-labeled emails", "Patient portal branding"],
        stat: "Available on Enterprise plan",
      },
      {
        icon: Database,
        title: "EHR Integrations",
        badge: "Interop",
        description: "FHIR R4 compatible integrations with Epic, Cerner, AthenaHealth, SimplePractice, and more via HL7 / FHIR.",
        href: "/enterprise",
        highlights: ["FHIR R4 compliant", "Epic & Cerner connectors", "SimplePractice import", "Bidirectional sync"],
        stat: "Integrations on Enterprise",
      },
      {
        icon: RefreshCw,
        title: "API & Webhooks",
        badge: "Developers",
        description: "Full REST API with webhook event streaming for custom integrations, automation platforms, and enterprise data pipelines.",
        href: "/enterprise",
        highlights: ["RESTful JSON API", "Real-time webhooks", "Rate-limited API keys", "OpenAPI / Swagger docs"],
        stat: "API access on Professional+",
      },
    ],
  },
];

const STATS = [
  { value: "< 60s", label: "Note generation" },
  { value: "GPT-4o", label: "AI engine" },
  { value: "C-SSRS", label: "Crisis protocol" },
  { value: "HIPAA", label: "Compliant" },
  { value: "40+", label: "Languages supported" },
  { value: "All plans", label: "Crisis detection included" },
];

export default function FeaturesPage() {
  const [activeCategory, setActiveCategory] = useState("ai");

  const active = FEATURE_CATEGORIES.find((c) => c.id === activeCategory)!;

  return (
    <div className="min-h-screen bg-white">
      {/* Hero */}
      <section className="bg-gradient-to-br from-[#0A2342] via-[#0d2d56] to-[#1F5EFF] text-white py-20 px-4">
        <div className="max-w-5xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 bg-white/10 border border-white/20 rounded-full px-4 py-1.5 text-sm mb-6">
            <Sparkles className="w-4 h-4 text-[#2EC4B6]" />
            The complete Mental Health Operating System
          </div>
          <h1 className="text-4xl md:text-6xl font-bold mb-6">
            Every tool therapists need.{" "}
            <span className="text-[#2EC4B6]">All AI-powered.</span>
          </h1>
          <p className="text-xl text-white/80 max-w-3xl mx-auto mb-10">
            24Therapy isn't just a note-taker. It's a complete clinical intelligence system — AI scribe, copilot, memory layer, risk monitoring, billing, scheduling, and more.
          </p>
          <div className="flex flex-wrap gap-4 justify-center">
            <Link
              href="/signup?role=therapist"
              className="bg-[#2EC4B6] hover:bg-[#26b0a3] text-white px-8 py-3 rounded-xl font-semibold flex items-center gap-2"
            >
              Get Started Free <ArrowRight className="w-4 h-4" />
            </Link>
            <Link
              href="/ai-scribe"
              className="bg-white/10 hover:bg-white/20 border border-white/30 text-white px-8 py-3 rounded-xl font-semibold flex items-center gap-2"
            >
              <Play className="w-4 h-4" /> Watch Demo
            </Link>
          </div>
        </div>
      </section>

      {/* Stats Strip */}
      <section className="bg-[#0A2342] text-white py-8 px-4">
        <div className="max-w-5xl mx-auto grid grid-cols-2 md:grid-cols-6 gap-6 text-center">
          {STATS.map((s) => (
            <div key={s.label}>
              <div className="text-2xl font-bold text-[#2EC4B6]">{s.value}</div>
              <div className="text-xs text-white/60 mt-1">{s.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Category Tabs */}
      <section className="py-16 px-4">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-[#0A2342] mb-4">Platform Capabilities</h2>
            <p className="text-gray-500 max-w-2xl mx-auto">
              Four pillars of a complete mental health practice. Each deeply integrated with AI.
            </p>
          </div>

          {/* Category Pills */}
          <div className="flex flex-wrap gap-3 justify-center mb-12">
            {FEATURE_CATEGORIES.map((cat) => {
              const Icon = cat.icon;
              const isActive = activeCategory === cat.id;
              return (
                <button
                  key={cat.id}
                  onClick={() => setActiveCategory(cat.id)}
                  className={`flex items-center gap-2 px-5 py-2.5 rounded-full font-medium text-sm transition-all ${
                    isActive
                      ? "bg-[#0A2342] text-white shadow-lg"
                      : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {cat.label}
                </button>
              );
            })}
          </div>

          {/* Feature Cards */}
          <div className="grid md:grid-cols-2 gap-6">
            {active.features.map((feature) => {
              const Icon = feature.icon;
              return (
                <div
                  key={feature.title}
                  className="group border border-gray-200 rounded-2xl p-6 hover:border-[#2EC4B6] hover:shadow-lg transition-all bg-white"
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#0A2342]/10 to-[#2EC4B6]/10 flex items-center justify-center">
                        <Icon className="w-5 h-5 text-[#0A2342]" />
                      </div>
                      <div>
                        <div className="font-semibold text-[#0A2342]">{feature.title}</div>
                        <span className="text-xs bg-[#2EC4B6]/10 text-[#2EC4B6] px-2 py-0.5 rounded-full font-medium">
                          {feature.badge}
                        </span>
                      </div>
                    </div>
                    <Link
                      href={feature.href}
                      className="text-gray-400 hover:text-[#2EC4B6] group-hover:text-[#2EC4B6] transition-colors"
                    >
                      <ArrowRight className="w-4 h-4" />
                    </Link>
                  </div>
                  <p className="text-gray-600 text-sm mb-4">{feature.description}</p>
                  <ul className="space-y-1 mb-4">
                    {feature.highlights.map((h) => (
                      <li key={h} className="flex items-center gap-2 text-sm text-gray-500">
                        <CheckCircle className="w-3.5 h-3.5 text-[#2EC4B6] flex-shrink-0" />
                        {h}
                      </li>
                    ))}
                  </ul>
                  <div className="bg-[#0A2342]/5 rounded-lg px-3 py-2 flex items-center gap-2">
                    <Star className="w-3.5 h-3.5 text-[#1F5EFF]" />
                    <span className="text-xs font-medium text-[#0A2342]">{feature.stat}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Full Feature List */}
      <section className="py-16 px-4 bg-gray-50">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-[#0A2342] mb-4">Everything Included</h2>
            <p className="text-gray-500">Every feature available across our plans</p>
          </div>
          <div className="grid md:grid-cols-3 gap-8">
            {[
              {
                title: "AI Layer",
                items: [
                  "AI Scribe (SOAP/DAP/BIRP/Narrative)",
                  "Clinical Copilot",
                  "Session Preparation Briefs",
                  "Patient Memory Layer",
                  "Knowledge Graph Visualization",
                  "Risk Detection & Alerts",
                  "Safety Plan Generation",
                  "Longitudinal Patient Intelligence",
                  "AI Context Assembly",
                  "Assessment Interpretation",
                  "Referral Letter Generation",
                ],
              },
              {
                title: "Clinical Tools",
                items: [
                  "PHQ-9, GAD-7, PCL-5, AUDIT, MDQ",
                  "Custom Assessment Builder",
                  "Treatment Plan Templates",
                  "Goal & Objective Tracking",
                  "Patient Intake Forms",
                  "Referral Management",
                  "Secure Messaging",
                  "Crisis Resource Center",
                  "Homework Assignment",
                  "Progress Tracking",
                  "Session Notes & Reports",
                ],
              },
              {
                title: "Operations",
                items: [
                  "Calendar & Scheduling",
                  "Patient Self-Booking",
                  "Insurance Billing",
                  "Stripe Payment Collection",
                  "Claims Management",
                  "Practice Analytics",
                  "Team Management",
                  "Workflow Automation",
                  "EHR Integrations",
                  "HIPAA Audit Trails",
                  "White-Label Deployment",
                ],
              },
            ].map((col) => (
              <div key={col.title}>
                <h3 className="font-bold text-[#0A2342] mb-4 flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-[#2EC4B6]" />
                  {col.title}
                </h3>
                <ul className="space-y-2">
                  {col.items.map((item) => (
                    <li key={item} className="flex items-center gap-2 text-sm text-gray-600">
                      <div className="w-1.5 h-1.5 rounded-full bg-[#2EC4B6]" />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 px-4 bg-gradient-to-br from-[#0A2342] to-[#1F5EFF] text-white">
        <div className="max-w-3xl mx-auto text-center">
          <Heart className="w-10 h-10 text-[#2EC4B6] mx-auto mb-6" />
          <h2 className="text-3xl font-bold mb-4">Built for therapists. Designed for outcomes.</h2>
          <p className="text-white/70 mb-8 text-lg">
            Spend more time with patients, less on paperwork. AI generates your notes, monitors safety, and surfaces clinical context — so you can focus on therapy.
          </p>
          <div className="flex flex-wrap gap-4 justify-center">
            <Link
              href="/signup?role=therapist"
              className="bg-[#2EC4B6] hover:bg-[#26b0a3] text-white px-8 py-3 rounded-xl font-semibold flex items-center gap-2"
            >
              Get Started Free <ArrowRight className="w-4 h-4" />
            </Link>
            <Link
              href="/pricing"
              className="bg-white/10 border border-white/30 text-white px-8 py-3 rounded-xl font-semibold hover:bg-white/20"
            >
              View Pricing
            </Link>
          </div>
          <p className="text-white/40 text-sm mt-6">First session free · No credit card · HIPAA compliant from day 1</p>
        </div>
      </section>
    </div>
  );
}

// Reviewed: 2026-06-13 — 24Therapy audit
