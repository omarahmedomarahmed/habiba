"use client";

import Link from "next/link";
import {
  Shield, Lock, FileText, CheckCircle, AlertTriangle, Eye,
  Database, Server, Globe, Users, ArrowRight, Award, Star,
  Clock, Key, Zap, Activity, Building2, BookOpen, RefreshCw,
  Heart, Bell, Search, ChevronRight
} from "lucide-react";

const HIPAA_PILLARS = [
  {
    icon: Shield,
    title: "Business Associate Agreement (BAA)",
    description: "We execute a signed BAA with every healthcare customer before any PHI touches our systems. Our BAA is HIPAA-compliant, covers all subprocessors, and is available on all paid plans.",
    points: ["Signed BAA upon account creation", "Covers all subprocessors (OpenAI, AWS, Stripe)", "Updated for HITECH Act requirements", "Available on Starter, Professional, and Enterprise"],
  },
  {
    icon: Lock,
    title: "PHI Encryption",
    description: "Protected Health Information is encrypted at every layer. At-rest encryption uses AES-256-GCM. In-transit uses TLS 1.3. Encryption keys are rotated quarterly and stored separately from data.",
    points: ["AES-256-GCM at rest", "TLS 1.3 in transit", "Quarterly key rotation", "Per-tenant key isolation"],
  },
  {
    icon: Eye,
    title: "Minimum Necessary Access",
    description: "Access to PHI is restricted to the minimum necessary for care delivery. Role-based access control (RBAC) ensures staff see only the patient data required for their function.",
    points: ["Role-based access control (RBAC)", "Least-privilege principle", "Consent-based record access", "Emergency override with audit logging"],
  },
  {
    icon: Activity,
    title: "Comprehensive Audit Logging",
    description: "Every access, modification, export, and deletion of PHI is logged with user identity, timestamp, IP address, and action. Audit logs are immutable, tamper-evident, and retained for 6+ years.",
    points: ["Immutable, tamper-evident logs", "6-year minimum retention", "Real-time anomaly detection", "Exportable for compliance audits"],
  },
  {
    icon: Bell,
    title: "Breach Notification",
    description: "In the unlikely event of a security incident, we notify affected customers within 24 hours and provide full support for HIPAA's 60-day breach notification timeline to patients and HHS.",
    points: ["24-hour customer notification SLA", "Full incident documentation", "HHS notification support", "Patient notification templates"],
  },
  {
    icon: Users,
    title: "Workforce Training",
    description: "All 24Therapy employees with PHI access complete annual HIPAA training, background checks, and security awareness programs. Access is immediately revoked upon role change or termination.",
    points: ["Annual HIPAA training required", "Background checks for all staff", "Access provisioning controls", "Immediate termination deprovisioning"],
  },
];

const SAFEGUARDS = [
  {
    category: "Administrative Safeguards",
    color: "bg-blue-50 border-blue-200",
    headerColor: "bg-blue-600",
    items: [
      "Security Officer designation",
      "Risk analysis and management",
      "Sanction policy for violations",
      "Workforce clearance procedure",
      "Access authorization process",
      "Security reminders & training",
      "Password management policy",
      "Log-in monitoring procedures",
    ],
  },
  {
    category: "Physical Safeguards",
    color: "bg-teal-50 border-teal-200",
    headerColor: "bg-teal-600",
    items: [
      "Data center physical security",
      "Workstation use restrictions",
      "Workstation security controls",
      "Device and media controls",
      "Hardware inventory tracking",
      "Media disposal procedures",
      "Facility access controls",
      "CCTV and access logging",
    ],
  },
  {
    category: "Technical Safeguards",
    color: "bg-violet-50 border-violet-200",
    headerColor: "bg-violet-600",
    items: [
      "Unique user identification (UUID)",
      "Automatic logoff after inactivity",
      "Encryption and decryption (PHI)",
      "Audit controls and reporting",
      "Integrity controls for data",
      "Transmission security (TLS 1.3)",
      "Multi-factor authentication",
      "Intrusion detection systems",
    ],
  },
];

const AI_HIPAA_PRINCIPLES = [
  {
    icon: Database,
    title: "No Training on Your PHI",
    body: "Patient data is never used to train shared AI models. Your clinical notes, transcripts, and patient records stay within your encrypted, isolated environment.",
  },
  {
    icon: Key,
    title: "PHI Minimization in Prompts",
    body: "AI features use de-identification and tokenization to minimize PHI exposure in AI processing. Where PHI is required, it is processed under BAA-covered infrastructure.",
  },
  {
    icon: RefreshCw,
    title: "Data Residency",
    body: "AI processing occurs in the same AWS region as your data. US customers: US-East-1. EU customers: EU-West-1. No cross-border PHI transfer without explicit consent.",
  },
  {
    icon: BookOpen,
    title: "AI Audit Trail",
    body: "Every AI-generated output (notes, summaries, suggestions) is logged with the model version, input context hash, and output. Therapist review is required before any AI output becomes part of the patient record.",
  },
];

const CERTIFICATIONS = [
  { name: "HIPAA Compliant", desc: "Annual third-party HIPAA assessment", icon: Shield, color: "text-blue-600" },
  { name: "SOC 2 Type II", desc: "Independent security audit", icon: Award, color: "text-violet-600" },
  { name: "GDPR Compliant", desc: "EU data protection", icon: Globe, color: "text-teal-600" },
  { name: "CCPA Compliant", desc: "California privacy law", icon: Star, color: "text-orange-600" },
  { name: "HITECH Act", desc: "Electronic health record security", icon: FileText, color: "text-green-600" },
  { name: "42 CFR Part 2", desc: "Substance use disorder records", icon: Heart, color: "text-red-600" },
];

export default function HIPAAPage() {
  return (
    <div className="min-h-screen bg-white">
      {/* Hero */}
      <section className="bg-gradient-to-br from-[#0A2342] via-[#0d2d55] to-[#0A2342] text-white py-24">
        <div className="max-w-6xl mx-auto px-6 text-center">
          <div className="inline-flex items-center gap-2 bg-white/10 backdrop-blur border border-white/20 rounded-full px-5 py-2 mb-8">
            <Shield className="w-4 h-4 text-[#2EC4B6]" />
            <span className="text-sm font-medium">HIPAA Compliance Center</span>
          </div>
          <h1 className="text-5xl md:text-6xl font-bold mb-6 leading-tight">
            Built for HIPAA from<br />
            <span className="text-[#2EC4B6]">Day One</span>
          </h1>
          <p className="text-xl text-white/80 max-w-3xl mx-auto mb-10">
            24Therapy.ai is architected for healthcare. Every feature, every API call, every storage decision is made with HIPAA compliance as a non-negotiable requirement — not an afterthought.
          </p>
          <div className="flex flex-wrap justify-center gap-4">
            <Link href="/contact?type=demo" className="bg-[#2EC4B6] text-white px-8 py-3 rounded-xl font-semibold hover:bg-[#26b0a2] transition flex items-center gap-2">
              Request BAA <ArrowRight className="w-4 h-4" />
            </Link>
            <Link href="/security" className="border border-white/30 text-white px-8 py-3 rounded-xl font-semibold hover:bg-white/10 transition">
              Security Overview
            </Link>
          </div>
        </div>
      </section>

      {/* Certifications strip */}
      <section className="bg-slate-50 border-b border-slate-200 py-10">
        <div className="max-w-6xl mx-auto px-6">
          <p className="text-center text-sm font-semibold text-slate-500 mb-8 uppercase tracking-wider">Compliance & Certifications</p>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            {CERTIFICATIONS.map((cert) => {
              const Icon = cert.icon;
              return (
                <div key={cert.name} className="flex flex-col items-center text-center p-4 bg-white rounded-xl border border-slate-200 shadow-sm">
                  <Icon className={`w-8 h-8 ${cert.color} mb-2`} />
                  <div className="font-semibold text-slate-800 text-sm">{cert.name}</div>
                  <div className="text-xs text-slate-500 mt-1">{cert.desc}</div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* 6 HIPAA Pillars */}
      <section className="py-24 bg-white">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-slate-900 mb-4">Our HIPAA Compliance Program</h2>
            <p className="text-lg text-slate-600 max-w-2xl mx-auto">
              A comprehensive approach to protecting PHI across all six required areas of the HIPAA Security Rule.
            </p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {HIPAA_PILLARS.map((pillar) => {
              const Icon = pillar.icon;
              return (
                <div key={pillar.title} className="bg-slate-50 rounded-2xl p-7 border border-slate-200 hover:border-[#2EC4B6]/40 transition-all">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#0A2342] to-[#1F5EFF] flex items-center justify-center mb-5">
                    <Icon className="w-6 h-6 text-white" />
                  </div>
                  <h3 className="text-lg font-bold text-slate-900 mb-3">{pillar.title}</h3>
                  <p className="text-slate-600 text-sm mb-4 leading-relaxed">{pillar.description}</p>
                  <ul className="space-y-2">
                    {pillar.points.map((pt) => (
                      <li key={pt} className="flex items-start gap-2 text-sm text-slate-700">
                        <CheckCircle className="w-4 h-4 text-[#2EC4B6] flex-shrink-0 mt-0.5" />
                        {pt}
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* 3 Safeguard Categories */}
      <section className="py-20 bg-slate-50">
        <div className="max-w-6xl mx-auto px-6">
          <h2 className="text-3xl font-bold text-center text-slate-900 mb-12">HIPAA Security Rule Safeguards</h2>
          <div className="grid md:grid-cols-3 gap-8">
            {SAFEGUARDS.map((safeguard) => (
              <div key={safeguard.category} className={`rounded-2xl border overflow-hidden ${safeguard.color}`}>
                <div className={`${safeguard.headerColor} text-white px-6 py-4 font-bold text-lg`}>
                  {safeguard.category}
                </div>
                <div className="p-6">
                  <ul className="space-y-3">
                    {safeguard.items.map((item) => (
                      <li key={item} className="flex items-start gap-2 text-sm text-slate-700">
                        <CheckCircle className="w-4 h-4 text-green-600 flex-shrink-0 mt-0.5" />
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* AI & HIPAA */}
      <section className="py-20 bg-white">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-12">
            <div className="inline-flex items-center gap-2 bg-violet-50 text-violet-700 px-4 py-2 rounded-full text-sm font-medium mb-4">
              <Zap className="w-4 h-4" />
              AI-Specific HIPAA Controls
            </div>
            <h2 className="text-3xl font-bold text-slate-900 mb-4">HIPAA-Compliant AI</h2>
            <p className="text-slate-600 max-w-xl mx-auto">
              AI in mental health care requires extra scrutiny. Here&apos;s how we ensure every AI feature meets HIPAA requirements.
            </p>
          </div>
          <div className="grid md:grid-cols-2 gap-8">
            {AI_HIPAA_PRINCIPLES.map((principle) => {
              const Icon = principle.icon;
              return (
                <div key={principle.title} className="flex gap-5 p-6 bg-violet-50 rounded-2xl border border-violet-100">
                  <div className="w-10 h-10 rounded-lg bg-violet-600 flex items-center justify-center flex-shrink-0">
                    <Icon className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-900 mb-2">{principle.title}</h3>
                    <p className="text-sm text-slate-600 leading-relaxed">{principle.body}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* BAA Section */}
      <section className="py-20 bg-gradient-to-br from-[#0A2342] to-[#1a3a6a] text-white">
        <div className="max-w-4xl mx-auto px-6 text-center">
          <Shield className="w-16 h-16 text-[#2EC4B6] mx-auto mb-6" />
          <h2 className="text-3xl font-bold mb-5">Ready to Sign Your BAA?</h2>
          <p className="text-lg text-white/80 mb-8 max-w-2xl mx-auto">
            A Business Associate Agreement is required before processing any PHI with 24Therapy.ai. We execute BAAs with all paid plan customers — typically within 1 business day.
          </p>
          <div className="bg-white/10 backdrop-blur border border-white/20 rounded-2xl p-8 mb-8 text-left">
            <h3 className="font-bold text-lg mb-4">BAA Process:</h3>
            <ol className="space-y-3">
              {[
                "Sign up for any paid plan (Starter, Professional, or Enterprise)",
                "Request BAA execution via your account settings or email legal@24therapy.ai",
                "We review and countersign within 1 business day",
                "BAA is stored in your compliance dashboard",
                "Begin processing PHI under full HIPAA protection",
              ].map((step, i) => (
                <li key={i} className="flex items-start gap-3 text-white/90 text-sm">
                  <span className="w-6 h-6 rounded-full bg-[#2EC4B6] text-white text-xs flex items-center justify-center flex-shrink-0 font-bold mt-0.5">{i + 1}</span>
                  {step}
                </li>
              ))}
            </ol>
          </div>
          <div className="flex flex-wrap gap-4 justify-center">
            <Link href="/contact?type=baa" className="bg-[#2EC4B6] text-white px-8 py-3 rounded-xl font-semibold hover:bg-[#26b0a2] transition flex items-center gap-2">
              Request BAA <ArrowRight className="w-4 h-4" />
            </Link>
            <a href="mailto:legal@24therapy.ai" className="border border-white/30 text-white px-8 py-3 rounded-xl font-semibold hover:bg-white/10 transition">
              Email legal@24therapy.ai
            </a>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="py-20 bg-slate-50">
        <div className="max-w-3xl mx-auto px-6">
          <h2 className="text-3xl font-bold text-center text-slate-900 mb-12">HIPAA FAQ</h2>
          <div className="space-y-4">
            {[
              { q: "Is 24Therapy.ai a covered entity or business associate?", a: "24Therapy.ai operates as a Business Associate under HIPAA. We process PHI on behalf of covered entities (therapists and healthcare organizations). We execute BAAs with all covered entities before processing PHI." },
              { q: "Are subprocessors like OpenAI covered under your BAA?", a: "Yes. We maintain BAAs with all subprocessors that may handle PHI, including OpenAI. AI features are routed through BAA-covered API endpoints with data minimization and no persistent storage of PHI." },
              { q: "Where is PHI stored?", a: "PHI is stored in AWS US-East-1 and US-West-2 (US customers) or AWS EU-West-1 (EU customers). All data is encrypted at rest with AES-256-GCM. We do not store PHI outside of BAA-covered AWS environments." },
              { q: "How long are audit logs retained?", a: "Audit logs are retained for a minimum of 6 years per HIPAA requirements. Logs are immutable, tamper-evident, and exportable for compliance audits. Enterprise customers can configure longer retention periods." },
              { q: "What happens if there's a security breach?", a: "We notify affected customers within 24 hours of confirming a breach. We provide full documentation, root cause analysis, and support for HIPAA's 60-day breach notification timeline to patients and HHS Office for Civil Rights." },
              { q: "Can therapists in group practices share patient data?", a: "Only with appropriate authorization. Patient records are permission-controlled at the practice level. Therapists can only access records of patients assigned to them unless elevated permissions are granted by the Practice Owner." },
            ].map((item) => (
              <div key={item.q} className="bg-white rounded-xl border border-slate-200 p-6">
                <div className="flex items-start gap-3">
                  <Search className="w-5 h-5 text-[#2EC4B6] flex-shrink-0 mt-0.5" />
                  <div>
                    <div className="font-semibold text-slate-900 mb-2">{item.q}</div>
                    <div className="text-sm text-slate-600 leading-relaxed">{item.a}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}

// Reviewed: 2026-06-13 — 24Therapy audit
