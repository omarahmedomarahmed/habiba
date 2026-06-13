"use client";

import Link from "next/link";
import {
  BookOpen, Zap, Shield, Brain, Video, BarChart3, GitBranch,
  CreditCard, Users, Globe, Code, FileText, Search, ArrowRight,
  ChevronRight, Sparkles, Terminal, Webhook, Database
} from "lucide-react";
import { useState } from "react";

const DOC_SECTIONS = [
  {
    category: "Getting Started",
    icon: Zap,
    color: "bg-[#2EC4B6]/10 text-[#2EC4B6]",
    articles: [
      { title: "Quickstart Guide", description: "Set up your account and generate your first AI note in 20 minutes", href: "/docs/quickstart", time: "20 min" },
      { title: "Platform Overview", description: "Understand the 24Therapy architecture and key concepts", href: "/docs/overview", time: "10 min" },
      { title: "Therapist Onboarding", description: "Complete credential verification and set up your practice", href: "/docs/onboarding", time: "15 min" },
      { title: "HIPAA Setup Checklist", description: "Ensure your account is fully HIPAA-compliant before seeing patients", href: "/docs/hipaa-checklist", time: "5 min" },
    ],
  },
  {
    category: "AI Features",
    icon: Brain,
    color: "bg-violet-100 text-violet-600",
    articles: [
      { title: "AI Scribe Setup", description: "Configure note formats, templates, and review workflows", href: "/docs/ai-scribe", time: "8 min" },
      { title: "Clinical Copilot", description: "Using real-time AI guidance during sessions", href: "/docs/copilot", time: "6 min" },
      { title: "Patient Memory Layer", description: "Understanding knowledge graphs and longitudinal intelligence", href: "/docs/memory-layer", time: "12 min" },
      { title: "Risk Detection", description: "Configure alert thresholds and escalation workflows", href: "/docs/risk-detection", time: "8 min" },
    ],
  },
  {
    category: "Telehealth",
    icon: Video,
    color: "bg-blue-100 text-blue-600",
    articles: [
      { title: "Session Room Guide", description: "Using the video session room and its AI features", href: "/docs/session-room", time: "10 min" },
      { title: "Recording & Transcripts", description: "Consent workflows and encrypted recording storage", href: "/docs/recording", time: "7 min" },
      { title: "Waiting Room Setup", description: "Brand your waiting room and configure patient flow", href: "/docs/waiting-room", time: "5 min" },
      { title: "Group Sessions", description: "Running group therapy sessions with up to 20 participants", href: "/docs/group-sessions", time: "8 min" },
    ],
  },
  {
    category: "Clinical Workflows",
    icon: GitBranch,
    color: "bg-emerald-100 text-emerald-600",
    articles: [
      { title: "Workflow Automation", description: "Building trigger-condition-action workflows", href: "/docs/workflows", time: "15 min" },
      { title: "Assessment Library", description: "Using PHQ-9, GAD-7, PCL-5 and custom assessments", href: "/docs/assessments", time: "10 min" },
      { title: "Treatment Plans", description: "Creating AI-assisted treatment plans with goals and objectives", href: "/docs/treatment-plans", time: "10 min" },
      { title: "Patient Intake", description: "Customizing and managing the intake form workflow", href: "/docs/intake", time: "8 min" },
    ],
  },
  {
    category: "Billing",
    icon: CreditCard,
    color: "bg-orange-100 text-orange-600",
    articles: [
      { title: "Insurance Billing", description: "Submitting claims, managing ERAs, and tracking denials", href: "/docs/insurance-billing", time: "20 min" },
      { title: "Patient Payments", description: "Collecting copays and self-pay via Stripe", href: "/docs/payments", time: "8 min" },
      { title: "Invoicing", description: "Creating and sending patient invoices", href: "/docs/invoicing", time: "5 min" },
      { title: "Subscription Management", description: "Managing your 24Therapy subscription and billing", href: "/docs/subscription", time: "5 min" },
    ],
  },
  {
    category: "API & Integrations",
    icon: Code,
    color: "bg-slate-100 text-slate-600",
    articles: [
      { title: "REST API Reference", description: "Complete API documentation with request/response examples", href: "/docs/api", time: "Ref" },
      { title: "Webhooks", description: "Real-time event streaming to your infrastructure", href: "/docs/webhooks", time: "15 min" },
      { title: "EHR Integrations", description: "Connecting Epic, Cerner, SimplePractice, and TherapyNotes", href: "/docs/ehr", time: "30 min" },
      { title: "White-Label Deployment", description: "Enterprise custom domain and branding setup", href: "/docs/white-label", time: "45 min" },
    ],
  },
  {
    category: "Compliance",
    icon: Shield,
    color: "bg-rose-100 text-rose-600",
    articles: [
      { title: "HIPAA Overview", description: "How 24Therapy achieves and maintains HIPAA compliance", href: "/docs/hipaa", time: "10 min" },
      { title: "BAA Information", description: "Business Associate Agreement details and signing process", href: "/docs/baa", time: "5 min" },
      { title: "Audit Logs", description: "Accessing and interpreting HIPAA audit trails", href: "/docs/audit-logs", time: "8 min" },
      { title: "Data Export & Deletion", description: "HIPAA patient right-of-access and deletion procedures", href: "/docs/data-rights", time: "8 min" },
    ],
  },
];

const POPULAR = [
  "Quickstart Guide",
  "AI Scribe Setup",
  "HIPAA Setup Checklist",
  "REST API Reference",
  "Insurance Billing",
  "Workflow Automation",
];

export default function DocsPage() {
  const [query, setQuery] = useState("");

  const filtered = query
    ? DOC_SECTIONS.map((section) => ({
        ...section,
        articles: section.articles.filter(
          (a) =>
            a.title.toLowerCase().includes(query.toLowerCase()) ||
            a.description.toLowerCase().includes(query.toLowerCase())
        ),
      })).filter((s) => s.articles.length > 0)
    : DOC_SECTIONS;

  return (
    <div className="min-h-screen bg-white">
      {/* Hero */}
      <section className="bg-gradient-to-br from-[#0A2342] to-[#1F5EFF] text-white py-16 px-4">
        <div className="max-w-4xl mx-auto text-center">
          <BookOpen className="w-10 h-10 text-[#2EC4B6] mx-auto mb-4" />
          <h1 className="text-4xl font-bold mb-4">Documentation</h1>
          <p className="text-white/70 mb-8">
            Everything you need to set up, configure, and get the most from 24Therapy.ai
          </p>
          <div className="relative max-w-xl mx-auto">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search docs..."
              className="w-full bg-white text-gray-800 pl-12 pr-4 py-3 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#2EC4B6]"
            />
          </div>
        </div>
      </section>

      {/* Popular */}
      {!query && (
        <section className="py-10 px-4 bg-gray-50 border-b border-gray-200">
          <div className="max-w-5xl mx-auto">
            <p className="text-sm font-medium text-gray-500 mb-3">Popular articles</p>
            <div className="flex flex-wrap gap-2">
              {POPULAR.map((p) => (
                <span
                  key={p}
                  className="bg-white border border-gray-200 text-gray-700 text-sm px-4 py-1.5 rounded-full hover:border-[#2EC4B6] hover:text-[#2EC4B6] cursor-pointer transition-colors"
                >
                  {p}
                </span>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Doc Sections */}
      <section className="py-12 px-4">
        <div className="max-w-5xl mx-auto">
          {filtered.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-gray-500">No articles found for "{query}"</p>
              <button onClick={() => setQuery("")} className="text-[#2EC4B6] text-sm mt-2 hover:underline">
                Clear search
              </button>
            </div>
          ) : (
            <div className="grid md:grid-cols-2 gap-8">
              {filtered.map((section) => {
                const Icon = section.icon;
                return (
                  <div key={section.category}>
                    <div className="flex items-center gap-3 mb-4">
                      <div className={`w-8 h-8 rounded-lg ${section.color} flex items-center justify-center`}>
                        <Icon className="w-4 h-4" />
                      </div>
                      <h2 className="font-bold text-[#0A2342]">{section.category}</h2>
                    </div>
                    <div className="space-y-2">
                      {section.articles.map((article) => (
                        <Link
                          key={article.title}
                          href={article.href}
                          className="flex items-start gap-3 p-3 rounded-xl hover:bg-gray-50 border border-transparent hover:border-gray-200 transition-all group"
                        >
                          <div className="flex-1">
                            <div className="font-medium text-[#0A2342] text-sm group-hover:text-[#2EC4B6] transition-colors">
                              {article.title}
                            </div>
                            <div className="text-xs text-gray-500 mt-0.5">{article.description}</div>
                          </div>
                          <div className="flex items-center gap-1 text-xs text-gray-400 flex-shrink-0">
                            <span>{article.time}</span>
                            <ChevronRight className="w-3 h-3" />
                          </div>
                        </Link>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </section>

      {/* Support CTA */}
      <section className="py-12 px-4 bg-gray-50 border-t border-gray-200">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="font-bold text-[#0A2342] text-xl mb-3">Can't find what you need?</h2>
          <p className="text-gray-500 text-sm mb-6">
            Our support team typically responds in under 4 hours for Professional plans.
          </p>
          <div className="flex flex-wrap gap-4 justify-center">
            <Link
              href="/contact"
              className="bg-[#0A2342] text-white px-6 py-2.5 rounded-xl text-sm font-semibold flex items-center gap-2 hover:bg-[#0d2d56]"
            >
              Contact Support <ArrowRight className="w-4 h-4" />
            </Link>
            <a
              href="mailto:support@24therapy.ai"
              className="border border-gray-300 text-gray-700 px-6 py-2.5 rounded-xl text-sm font-semibold hover:border-[#2EC4B6] hover:text-[#2EC4B6] transition-colors"
            >
              support@24therapy.ai
            </a>
          </div>
        </div>
      </section>
    </div>
  );
}

// Reviewed: 2026-06-13 — 24Therapy audit
