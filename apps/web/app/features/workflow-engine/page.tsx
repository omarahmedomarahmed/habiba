"use client";

import Link from "next/link";
import {
  GitBranch, Zap, Clock, Bell, Shield, Users, ArrowRight, CheckCircle,
  FileText, Heart, Activity, Target, RefreshCw, Database, Globe,
  BarChart3, AlertTriangle, MessageSquare, Calendar, Star, Sparkles
} from "lucide-react";

const WORKFLOW_TEMPLATES = [
  {
    category: "Clinical",
    color: "bg-blue-50 border-blue-200",
    badge: "bg-blue-100 text-blue-700",
    icon: Heart,
    templates: [
      { name: "Risk Escalation Protocol", desc: "PHQ-9 ≥ 15 → Alert therapist + supervisor + create safety plan task", trigger: "Assessment score" },
      { name: "Treatment Plan Review", desc: "90 days elapsed → Notify therapist + schedule review + generate progress summary", trigger: "Time-based" },
      { name: "Session Follow-up", desc: "24h after session → Send patient check-in + pre-fill next session prep", trigger: "Session event" },
      { name: "Missed Session Re-engagement", desc: "3 consecutive missed sessions → Outreach sequence + adjust risk level", trigger: "Attendance pattern" },
    ],
  },
  {
    category: "Practice Operations",
    color: "bg-teal-50 border-teal-200",
    badge: "bg-teal-100 text-teal-700",
    icon: Target,
    templates: [
      { name: "New Patient Onboarding", desc: "Patient signup → Send intake forms + schedule intake → Assign to matched therapist", trigger: "Patient created" },
      { name: "Intake Completion", desc: "Intake form completed → Auto-build memory profile + schedule first session", trigger: "Form submission" },
      { name: "Insurance Verification", desc: "New patient → Auto-verify insurance + estimate patient responsibility", trigger: "Patient created" },
      { name: "Waitlist Management", desc: "Therapist availability opens → Auto-match + notify top waitlist patient", trigger: "Slot opened" },
    ],
  },
  {
    category: "Billing & Revenue",
    color: "bg-violet-50 border-violet-200",
    badge: "bg-violet-100 text-violet-700",
    icon: BarChart3,
    templates: [
      { name: "Claim Submission", desc: "Session completed + note approved → Auto-generate and submit insurance claim", trigger: "Note approved" },
      { name: "Payment Reminder", desc: "Invoice 7/14/30 days overdue → Email + SMS reminder sequence to patient", trigger: "Invoice aging" },
      { name: "Subscription Renewal", desc: "Subscription expires in 7 days → Renewal reminder + usage report", trigger: "Time-based" },
      { name: "Authorization Expiry", desc: "Auth expires in 30 days → Notify therapist + initiate re-auth request", trigger: "Auth expiry" },
    ],
  },
  {
    category: "Compliance & Risk",
    color: "bg-amber-50 border-amber-200",
    badge: "bg-amber-100 text-amber-700",
    icon: Shield,
    templates: [
      { name: "Mandatory Reporting Trigger", desc: "Safety concern flagged → Create mandatory reporting task + notify supervisor", trigger: "Risk flag" },
      { name: "Note Delinquency", desc: "Note unsigned 24h after session → Remind therapist + escalate to supervisor after 72h", trigger: "Time-based" },
      { name: "HIPAA Audit Alert", desc: "Unusual access pattern detected → Alert compliance officer + generate audit report", trigger: "System event" },
      { name: "License Expiry Warning", desc: "License expires in 60 days → Notify therapist + add to admin dashboard", trigger: "License expiry" },
    ],
  },
];

const WORKFLOW_COMPONENTS = [
  { icon: Zap, title: "Triggers", desc: "What starts the workflow. Events, schedules, conditions, webhooks, or manual activation." },
  { icon: GitBranch, title: "Conditions", desc: "If/then logic that routes workflows based on patient data, scores, time elapsed, or custom rules." },
  { icon: Bell, title: "Actions", desc: "What happens: send message, create task, update record, call API, generate document, alert user." },
  { icon: Clock, title: "Delays & Scheduling", desc: "Time-based waits, specific time windows, business hours respect, and timezone-aware scheduling." },
  { icon: RefreshCw, title: "Loops & Retries", desc: "Conditional re-check loops, retry logic for failed actions, and escalation paths if conditions persist." },
  { icon: BarChart3, title: "Monitoring & History", desc: "Every workflow run is logged with status, timing, actions taken, and outcome. Full audit trail." },
];

const ACTION_TYPES = [
  "Send email (Resend / SendGrid)",
  "Send SMS (Twilio)",
  "Send push notification",
  "Create in-app task",
  "Update patient record",
  "Generate document (note, report, letter)",
  "Trigger API webhook",
  "Add to waitlist / remove from waitlist",
  "Schedule session",
  "Create billing event",
  "Alert therapist / supervisor / admin",
  "Change risk level",
  "Submit insurance claim",
  "Update assessment schedule",
  "Log to audit trail",
  "Create safety plan",
];

export default function WorkflowEnginePage() {
  return (
    <div className="min-h-screen bg-white">
      {/* Hero */}
      <section className="bg-gradient-to-br from-[#0A2342] to-[#1a3a6a] text-white py-24">
        <div className="max-w-5xl mx-auto px-6 text-center">
          <div className="inline-flex items-center gap-2 bg-white/10 border border-white/20 rounded-full px-5 py-2 mb-8">
            <GitBranch className="w-4 h-4 text-[#2EC4B6]" />
            <span className="text-sm font-medium">Workflow Engine</span>
            <span className="bg-[#2EC4B6] text-white text-xs px-2 py-0.5 rounded-full">Automation</span>
          </div>
          <h1 className="text-5xl md:text-6xl font-bold mb-6 leading-tight">
            Clinical Automation<br />
            <span className="text-[#2EC4B6]">That Actually Works</span>
          </h1>
          <p className="text-xl text-white/80 max-w-3xl mx-auto mb-10">
            The 24Therapy.ai Workflow Engine automates the repetitive, high-stakes workflows in mental health practice — from risk escalation to billing — so your team can focus on care.
          </p>
          <div className="flex flex-wrap justify-center gap-4">
            <Link href="/contact?type=demo" className="bg-[#2EC4B6] text-white px-8 py-3 rounded-xl font-semibold hover:bg-[#26b0a2] transition flex items-center gap-2">
              See Workflow Demo <ArrowRight className="w-4 h-4" />
            </Link>
            <Link href="/features" className="border border-white/30 text-white px-8 py-3 rounded-xl font-semibold hover:bg-white/10 transition">
              All Features
            </Link>
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="bg-slate-50 border-b border-slate-200 py-10">
        <div className="max-w-5xl mx-auto px-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
            {[
              { v: "40+", l: "Pre-built Templates" },
              { v: "16", l: "Action Types" },
              { v: "< 30 min", l: "Avg. Setup Time" },
              { v: "92%", l: "Automation Rate" },
            ].map((s) => (
              <div key={s.l}>
                <div className="text-2xl font-bold text-slate-900">{s.v}</div>
                <div className="text-sm text-slate-500">{s.l}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Workflow Components */}
      <section className="py-20 bg-white">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-slate-900 mb-4">Workflow Building Blocks</h2>
            <p className="text-slate-600 max-w-xl mx-auto">
              Powerful components that combine into sophisticated clinical automation — no coding required.
            </p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {WORKFLOW_COMPONENTS.map((comp) => {
              const Icon = comp.icon;
              return (
                <div key={comp.title} className="p-6 bg-slate-50 rounded-2xl border border-slate-200 hover:border-[#2EC4B6]/30 transition-all">
                  <div className="w-11 h-11 rounded-xl bg-[#0A2342] flex items-center justify-center mb-4">
                    <Icon className="w-5 h-5 text-[#2EC4B6]" />
                  </div>
                  <h3 className="font-bold text-slate-900 mb-2">{comp.title}</h3>
                  <p className="text-sm text-slate-600 leading-relaxed">{comp.desc}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Templates */}
      <section className="py-20 bg-slate-50">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-slate-900 mb-4">Pre-Built Workflow Templates</h2>
            <p className="text-slate-600 max-w-xl mx-auto">
              Start immediately with 40+ expert-designed templates. Customize or build your own from scratch.
            </p>
          </div>
          <div className="space-y-8">
            {WORKFLOW_TEMPLATES.map((category) => {
              const Icon = category.icon;
              return (
                <div key={category.category} className={`rounded-2xl border p-6 ${category.color}`}>
                  <div className="flex items-center gap-3 mb-5">
                    <Icon className="w-5 h-5 text-slate-700" />
                    <h3 className="font-bold text-slate-900 text-lg">{category.category}</h3>
                    <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${category.badge}`}>
                      {category.templates.length} templates
                    </span>
                  </div>
                  <div className="grid md:grid-cols-2 gap-4">
                    {category.templates.map((tmpl) => (
                      <div key={tmpl.name} className="bg-white rounded-xl border border-white/60 p-4 shadow-sm">
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <h4 className="font-semibold text-slate-900 text-sm">{tmpl.name}</h4>
                          <span className="text-xs bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full whitespace-nowrap flex-shrink-0">
                            {tmpl.trigger}
                          </span>
                        </div>
                        <p className="text-xs text-slate-600 leading-relaxed">{tmpl.desc}</p>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Action Types */}
      <section className="py-20 bg-white">
        <div className="max-w-5xl mx-auto px-6">
          <h2 className="text-3xl font-bold text-center text-slate-900 mb-10">16 Action Types Built In</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {ACTION_TYPES.map((action) => (
              <div key={action} className="flex items-center gap-2 p-3 bg-slate-50 rounded-xl border border-slate-200 text-sm text-slate-700">
                <CheckCircle className="w-4 h-4 text-[#2EC4B6] flex-shrink-0" />
                {action}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 bg-gradient-to-br from-[#0A2342] to-[#1a3a6a] text-white">
        <div className="max-w-3xl mx-auto px-6 text-center">
          <GitBranch className="w-14 h-14 text-[#2EC4B6] mx-auto mb-5" />
          <h2 className="text-3xl font-bold mb-4">Automate Your Practice Operations</h2>
          <p className="text-white/80 mb-8">
            Join practices saving 8+ hours per week on manual workflows. Set up your first automation in under 30 minutes with our pre-built templates.
          </p>
          <Link href="/contact?type=demo" className="bg-[#2EC4B6] text-white px-8 py-3 rounded-xl font-semibold hover:bg-[#26b0a2] transition inline-flex items-center gap-2">
            Start Automating <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </section>
    </div>
  );
}
