"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Users, Building2, Heart, Globe, Zap, Brain, Shield, TrendingUp,
  CheckCircle, ArrowRight, Star, Quote, Clock, BarChart3, Target,
  FileText, Video, MessageSquare, Bell, Award, Sparkles, Activity
} from "lucide-react";

type UseCase = "solo" | "group" | "clinic" | "enterprise" | "teletherapy" | "supervision";

const USE_CASES = [
  { id: "solo" as UseCase, icon: Heart, label: "Solo Practitioners", color: "from-pink-500 to-rose-600", count: "3,200+ therapists" },
  { id: "group" as UseCase, icon: Users, label: "Group Practices", color: "from-blue-500 to-indigo-600", count: "410+ practices" },
  { id: "clinic" as UseCase, icon: Building2, label: "Clinics & CMHCs", color: "from-violet-500 to-purple-600", count: "85+ clinics" },
  { id: "enterprise" as UseCase, icon: Globe, label: "Health Systems", color: "from-emerald-500 to-teal-600", count: "12+ health systems" },
  { id: "teletherapy" as UseCase, icon: Video, label: "Teletherapy Platforms", color: "from-orange-500 to-amber-600", count: "29+ platforms" },
  { id: "supervision" as UseCase, icon: Award, label: "Training & Supervision", color: "from-cyan-500 to-sky-600", count: "14+ programs" },
];

const CASE_DETAILS: Record<UseCase, {
  title: string;
  subtitle: string;
  description: string;
  pain_points: string[];
  solutions: { icon: typeof Brain; title: string; body: string }[];
  results: { label: string; value: string; change: string }[];
  testimonial: { quote: string; name: string; role: string; org: string };
}> = {
  solo: {
    title: "Solo Practitioners",
    subtitle: "Eliminate admin burden. See more patients. Stay sane.",
    description: "Solo therapists wear every hat — clinician, biller, scheduler, note-taker, and practice manager. 24Therapy.ai collapses all of that into a single AI-powered system so you can focus on what matters: patient care.",
    pain_points: [
      "2-3 hours per day on clinical documentation",
      "No staff to cover admin and scheduling",
      "Billing and insurance claim complexity",
      "Difficulty maintaining consistent note quality",
      "Limited insight into patient progress trends",
    ],
    solutions: [
      { icon: Brain, title: "AI Scribe", body: "Generate SOAP, DAP, BIRP notes from session audio in under 60 seconds. Review, approve, and move on." },
      { icon: Target, title: "Smart Scheduling", body: "Online booking with automated reminders, intake forms, and waitlist management — no staff required." },
      { icon: TrendingUp, title: "Progress Tracking", body: "Automatic PHQ-9, GAD-7, and custom assessment tracking with visual progress charts." },
      { icon: BarChart3, title: "Revenue Insights", body: "Real-time billing dashboard, insurance claim tracking, and revenue forecasting built in." },
    ],
    results: [
      { label: "Documentation Time Saved", value: "3.2 hrs/week", change: "per therapist" },
      { label: "No-Show Reduction", value: "67%", change: "with AI reminders" },
      { label: "Revenue Increase", value: "+22%", change: "avg. first 6 months" },
    ],
    testimonial: {
      quote: "I went from spending Sunday evenings catching up on notes to finishing them before I close my laptop after each session. It&apos;s genuinely life-changing for a solo practice.",
      name: "Dr. Rebecca Huang",
      role: "Licensed Psychologist",
      org: "Solo Practice, Seattle, WA",
    },
  },
  group: {
    title: "Group Practices",
    subtitle: "Streamline multi-therapist operations without the overhead.",
    description: "Growing a group practice means managing multiple therapists, varied caseloads, billing complexity, and clinical oversight — all while maintaining quality of care. 24Therapy.ai centralizes your practice operations in one system.",
    pain_points: [
      "Inconsistent documentation quality across therapists",
      "Complex billing reconciliation for multiple providers",
      "Difficulty monitoring caseload and therapist capacity",
      "Clinical supervision and case consultation challenges",
      "Patient retention and outcome tracking at scale",
    ],
    solutions: [
      { icon: Users, title: "Team Management", body: "Unified therapist roster with capacity tracking, specialization filtering, and performance dashboards." },
      { icon: Shield, title: "Clinical Supervision", body: "Supervisor review workflows for notes, risk alerts, and treatment plans. Real-time co-sign capabilities." },
      { icon: BarChart3, title: "Practice Analytics", body: "MRR, therapist productivity, clinical outcomes, and retention metrics for your entire practice." },
      { icon: Brain, title: "Shared AI Models", body: "Practice-specific memory models that respect patient privacy while improving care consistency." },
    ],
    results: [
      { label: "Admin Time Reduction", value: "58%", change: "per therapist/month" },
      { label: "Billing Accuracy", value: "99.2%", change: "claim acceptance rate" },
      { label: "Patient Retention", value: "+31%", change: "vs. industry average" },
    ],
    testimonial: {
      quote: "We went from 8 therapists using 4 different EHRs to a unified system. Our compliance team finally stopped worrying, and our therapists actually like using it.",
      name: "Marcus Chen, LCSW",
      role: "Practice Director",
      org: "Serenity Group Practice, Chicago, IL",
    },
  },
  clinic: {
    title: "Clinics & Community Mental Health Centers",
    subtitle: "High-volume care with enterprise-grade compliance.",
    description: "CMHCs and outpatient clinics face unique pressures: high patient volumes, complex diagnoses, multiple payers, and strict regulatory requirements. 24Therapy.ai scales to meet the demands of high-volume clinical environments.",
    pain_points: [
      "High patient volume with limited staff resources",
      "Complex multi-payer billing environments",
      "Regulatory reporting requirements (URS, SAMHSA, etc.)",
      "Crisis and risk management at scale",
      "Medication coordination and prescriber collaboration",
    ],
    solutions: [
      { icon: Activity, title: "Risk Monitoring at Scale", body: "Automated PHQ-9/C-SSRS tracking with risk escalation workflows across your entire patient population." },
      { icon: FileText, title: "Regulatory Reporting", body: "Automated URS, SAMHSA, and state-specific reporting templates. Export-ready compliance data." },
      { icon: Zap, title: "Workflow Automation", body: "Automated care coordination, follow-up triggers, and treatment plan review reminders." },
      { icon: MessageSquare, title: "Care Coordination", body: "Secure messaging for prescribers, case managers, and care teams across disciplines." },
    ],
    results: [
      { label: "Therapist Capacity Increase", value: "+40%", change: "patients per therapist" },
      { label: "Crisis Response Time", value: "< 4 min", change: "avg. alert-to-action" },
      { label: "Documentation Compliance", value: "98.7%", change: "vs. 71% industry avg" },
    ],
    testimonial: {
      quote: "We serve over 800 active clients with 22 clinicians. The risk monitoring system alone has prevented three crises in the last quarter. The ROI is beyond anything we expected.",
      name: "Dr. Anita Patel",
      role: "Clinical Director",
      org: "Bay Area Community Mental Health",
    },
  },
  enterprise: {
    title: "Health Systems & Enterprise",
    subtitle: "Platform-grade mental health infrastructure for large organizations.",
    description: "Health systems, IDNs, and large employers need a mental health infrastructure that integrates with existing systems, scales to thousands of users, and meets enterprise security and compliance requirements.",
    pain_points: [
      "EHR integration complexity (Epic, Cerner, Athena)",
      "Multi-site, multi-region compliance requirements",
      "Population-level mental health analytics",
      "White-label and co-branding requirements",
      "Enterprise SSO and identity management",
    ],
    solutions: [
      { icon: Globe, title: "EHR Integration", body: "Native integrations with Epic, Cerner, Athena, SimplePractice. HL7 FHIR R4 API for custom integrations." },
      { icon: Shield, title: "Enterprise Security", body: "SSO (SAML 2.0, OIDC), custom BAA terms, dedicated infrastructure, SOC 2 Type II reports on demand." },
      { icon: BarChart3, title: "Population Analytics", body: "Org-wide mental health dashboards, population risk scoring, outcome aggregation, and benchmarking." },
      { icon: Building2, title: "White-Label Ready", body: "Complete white-label branding, custom domain, custom email templates, and API-first architecture." },
    ],
    results: [
      { label: "Integration Timeline", value: "< 30 days", change: "Epic/Cerner go-live" },
      { label: "ROI", value: "340%", change: "avg. 12-month ROI" },
      { label: "Staff Adoption Rate", value: "94%", change: "within 90 days" },
    ],
    testimonial: {
      quote: "We evaluated 7 mental health platforms before selecting 24Therapy.ai. The FHIR integration with Epic was live in 18 days. Our clinicians were fully onboarded in 3 weeks.",
      name: "Jennifer Walsh",
      role: "Chief Information Officer",
      org: "RegionHealth System, Texas",
    },
  },
  teletherapy: {
    title: "Teletherapy Platforms",
    subtitle: "AI infrastructure for digital mental health companies.",
    description: "Telehealth-first mental health platforms need AI capabilities without building them from scratch. 24Therapy.ai&apos;s API-first architecture lets you embed AI documentation, matching, and intelligence into your existing product.",
    pain_points: [
      "Building AI documentation from scratch is expensive and slow",
      "Matching algorithms require vast clinical data to work",
      "HIPAA-compliant AI infrastructure is complex to build",
      "Session quality and outcome tracking at scale",
      "Therapist retention and burnout prevention",
    ],
    solutions: [
      { icon: Brain, title: "AI API Layer", body: "Embed AI scribe, note generation, and session insights via REST API into your existing teletherapy product." },
      { icon: Target, title: "Matching API", body: "License our Radar matching engine for patient-to-therapist AI matching with outcome optimization." },
      { icon: Zap, title: "Webhook Events", body: "Real-time webhooks for session events, note generation, risk alerts, and clinical milestones." },
      { icon: TrendingUp, title: "Outcome Analytics API", body: "Embedded outcome tracking, PHQ-9/GAD-7 administration, and progress reporting for your patients." },
    ],
    results: [
      { label: "Development Time Saved", value: "12+ months", change: "vs. building in-house" },
      { label: "Therapist Retention", value: "+28%", change: "with AI assistance" },
      { label: "Session Documentation", value: "95%", change: "completion rate" },
    ],
    testimonial: {
      quote: "We white-labeled the AI scribe and matching engine in 6 weeks. Our users now get note generation that used to take 45 minutes done in 2 minutes. It changed our product entirely.",
      name: "Alex Kowalski",
      role: "Head of Product",
      org: "MindBridge Health (Series B)",
    },
  },
  supervision: {
    title: "Training Programs & Supervision",
    subtitle: "AI-assisted supervision for the next generation of therapists.",
    description: "Graduate training programs, internship sites, and clinical supervision practices need tools that support learning alongside care delivery. 24Therapy.ai&apos;s supervision features turn every session into a learning opportunity.",
    pain_points: [
      "Supervisor time overwhelmed by review of notes and recordings",
      "Inconsistent supervision documentation requirements",
      "Trainee note quality and consistency monitoring",
      "Identifying patterns in trainee clinical performance",
      "Licensing hours tracking and documentation",
    ],
    solutions: [
      { icon: Award, title: "Supervision Dashboard", body: "Review trainee notes, approve documentation, and co-sign records with full audit trail from a dedicated supervisor view." },
      { icon: Brain, title: "AI Coaching", body: "AI copilot in training mode gives real-time suggestions without directing care. Helps trainees develop clinical judgment." },
      { icon: FileText, title: "Hours Tracking", body: "Automated tracking of supervision hours, session counts, and licensure documentation for LCSW, LPC, MFT requirements." },
      { icon: BarChart3, title: "Competency Analytics", body: "Track trainee documentation quality, intervention diversity, and clinical outcomes over the supervision period." },
    ],
    results: [
      { label: "Supervisor Review Time", value: "-62%", change: "per trainee/week" },
      { label: "Note Quality Scores", value: "+41%", change: "trainee improvement" },
      { label: "Licensing Documentation", value: "100%", change: "audit-ready compliance" },
    ],
    testimonial: {
      quote: "Our supervisors were spending 8 hours a week reviewing trainee notes. Now it's under 3 hours, and the notes are better. The AI coaching is like having a senior clinician in every session.",
      name: "Prof. Maria Santos, PhD",
      role: "Training Director",
      org: "Pacific Graduate School of Psychology",
    },
  },
};

export default function UseCasesPage() {
  const [active, setActive] = useState<UseCase>("solo");
  const detail = CASE_DETAILS[active];

  return (
    <div className="min-h-screen bg-white">
      {/* Hero */}
      <section className="bg-gradient-to-br from-[#0A2342] to-[#1a3a6a] text-white py-20">
        <div className="max-w-5xl mx-auto px-6 text-center">
          <div className="inline-flex items-center gap-2 bg-white/10 border border-white/20 rounded-full px-5 py-2 mb-6">
            <Target className="w-4 h-4 text-[#2EC4B6]" />
            <span className="text-sm font-medium">Use Cases</span>
          </div>
          <h1 className="text-5xl font-bold mb-5">
            Built for Every Type of<br />
            <span className="text-[#2EC4B6]">Mental Health Practice</span>
          </h1>
          <p className="text-lg text-white/80 max-w-2xl mx-auto">
            From solo practitioners to health systems — 24Therapy.ai adapts to your practice model, workflow, and scale.
          </p>
        </div>
      </section>

      {/* Use Case Selector */}
      <section className="bg-slate-50 border-b border-slate-200 py-6 sticky top-0 z-20">
        <div className="max-w-6xl mx-auto px-6">
          <div className="flex flex-wrap gap-3 justify-center">
            {USE_CASES.map((uc) => {
              const Icon = uc.icon;
              return (
                <button
                  key={uc.id}
                  onClick={() => setActive(uc.id)}
                  className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-sm transition-all ${
                    active === uc.id
                      ? `bg-gradient-to-r ${uc.color} text-white shadow-lg`
                      : "bg-white border border-slate-200 text-slate-600 hover:border-slate-300"
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {uc.label}
                </button>
              );
            })}
          </div>
        </div>
      </section>

      {/* Detail Section */}
      <section className="py-20">
        <div className="max-w-6xl mx-auto px-6">
          <div className="grid lg:grid-cols-2 gap-16 items-start">
            <div>
              <h2 className="text-4xl font-bold text-slate-900 mb-3">{detail.title}</h2>
              <p className="text-xl text-[#1F5EFF] font-medium mb-5">{detail.subtitle}</p>
              <p className="text-slate-600 leading-relaxed mb-8">{detail.description}</p>

              <h3 className="font-bold text-slate-900 mb-4">Common Pain Points We Solve:</h3>
              <ul className="space-y-3 mb-8">
                {detail.pain_points.map((pt) => (
                  <li key={pt} className="flex items-start gap-3 text-slate-700 text-sm">
                    <div className="w-5 h-5 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <div className="w-2 h-2 rounded-full bg-red-500" />
                    </div>
                    {pt}
                  </li>
                ))}
              </ul>

              {/* Testimonial */}
              <div className="bg-slate-50 rounded-2xl border border-slate-200 p-6">
                <Quote className="w-8 h-8 text-[#2EC4B6] mb-3" />
                <p className="text-slate-700 italic mb-4 leading-relaxed">&ldquo;{detail.testimonial.quote}&rdquo;</p>
                <div>
                  <div className="font-semibold text-slate-900">{detail.testimonial.name}</div>
                  <div className="text-sm text-slate-500">{detail.testimonial.role} — {detail.testimonial.org}</div>
                </div>
              </div>
            </div>

            <div>
              {/* Results */}
              <div className="grid grid-cols-3 gap-4 mb-8">
                {detail.results.map((r) => (
                  <div key={r.label} className="bg-gradient-to-br from-[#0A2342] to-[#1a3a6a] rounded-2xl p-5 text-center text-white">
                    <div className="text-2xl font-bold text-[#2EC4B6] mb-1">{r.value}</div>
                    <div className="text-xs text-white/70">{r.change}</div>
                    <div className="text-xs text-white/50 mt-1">{r.label}</div>
                  </div>
                ))}
              </div>

              {/* Solutions */}
              <h3 className="font-bold text-slate-900 mb-5 text-lg">How 24Therapy.ai Helps:</h3>
              <div className="space-y-4">
                {detail.solutions.map((sol) => {
                  const Icon = sol.icon;
                  return (
                    <div key={sol.title} className="flex gap-4 p-5 bg-blue-50 rounded-xl border border-blue-100">
                      <div className="w-10 h-10 rounded-lg bg-[#1F5EFF] flex items-center justify-center flex-shrink-0">
                        <Icon className="w-5 h-5 text-white" />
                      </div>
                      <div>
                        <div className="font-semibold text-slate-900 mb-1">{sol.title}</div>
                        <div className="text-sm text-slate-600 leading-relaxed">{sol.body}</div>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="mt-8 flex gap-4">
                <Link href="/contact?type=demo" className="flex-1 bg-[#0A2342] text-white py-3 rounded-xl font-semibold text-center hover:bg-[#1a3a6a] transition flex items-center justify-center gap-2">
                  Request Demo <ArrowRight className="w-4 h-4" />
                </Link>
                <Link href="/pricing" className="flex-1 border border-slate-300 text-slate-700 py-3 rounded-xl font-semibold text-center hover:bg-slate-50 transition">
                  View Pricing
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Stats Bar */}
      <section className="bg-[#0A2342] py-12">
        <div className="max-w-5xl mx-auto px-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
            {[
              { v: "4,800+", l: "Active Therapists" },
              { v: "142K+", l: "Sessions Documented" },
              { v: "98.7%", l: "HIPAA Compliance Rate" },
              { v: "4.9/5", l: "Therapist Satisfaction" },
            ].map((stat) => (
              <div key={stat.l}>
                <div className="text-3xl font-bold text-[#2EC4B6] mb-1">{stat.v}</div>
                <div className="text-white/70 text-sm">{stat.l}</div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
