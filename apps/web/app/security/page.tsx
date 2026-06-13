import Link from "next/link";
import {
  Shield, Lock, FileText, CheckCircle2, AlertTriangle, Eye,
  Database, Server, Globe, Users, ArrowRight, Award, Star,
  Clock, Key, Zap, Activity, Building2
} from "lucide-react";

const COMPLIANCE_BADGES = [
  { name: "HIPAA Compliant", icon: Shield, description: "Full HIPAA compliance with BAA" },
  { name: "SOC 2 Type II", icon: Award, description: "Annual third-party security audit" },
  { name: "GDPR Compliant", icon: Globe, description: "EU data protection regulation" },
  { name: "256-bit Encryption", icon: Lock, description: "End-to-end encryption everywhere" },
];

const SECURITY_FEATURES = [
  {
    icon: Lock,
    title: "End-to-End Encryption",
    description: "All data — session transcripts, clinical notes, patient records, messages — is encrypted at rest (AES-256) and in transit (TLS 1.3). Keys are managed per-tenant.",
  },
  {
    icon: Users,
    title: "Zero-Trust Architecture",
    description: "Every API request is authenticated, authorized, and logged. No implicit trust. Role-based access control enforced at every layer.",
  },
  {
    icon: Database,
    title: "Data Isolation",
    description: "Complete logical data isolation between tenants. Your patient data is never accessible to other practices. AI features operate within your own encrypted context.",
  },
  {
    icon: Eye,
    title: "Comprehensive Audit Logging",
    description: "Every access, modification, and export is logged with timestamp, user identity, and IP. Audit logs are immutable and retained per compliance requirements.",
  },
  {
    icon: Server,
    title: "Infrastructure Security",
    description: "Hosted on AWS (US-East, US-West, EU-West). VPC isolation, WAF protection, DDoS mitigation, automated vulnerability scanning.",
  },
  {
    icon: Activity,
    title: "Continuous Monitoring",
    description: "24/7 security operations monitoring. Automated anomaly detection. Incident response time < 15 minutes for critical issues.",
  },
];

const AI_PRIVACY_PRINCIPLES = [
  "Patient data is never used to train shared AI models",
  "AI operates within your encrypted, isolated context only",
  "All AI memory retrieval is permission-controlled",
  "Therapist-specific data never crosses organizational boundaries",
  "AI features respect tenant isolation and access controls",
  "Patients can request AI data deletion at any time",
];

const BAA_TERMS = [
  "Executed for all paid accounts automatically",
  "Covers all PHI processing activities",
  "24-hour breach notification",
  "Data return or destruction on termination",
  "Permitted uses and disclosures defined",
];

export default function SecurityPage() {
  return (
    <div className="min-h-screen bg-white">
      {/* Hero */}
      <section className="bg-gradient-to-br from-[#0A2342] to-[#1a3a6b] text-white py-24">
        <div className="max-w-7xl mx-auto px-6 text-center">
          <div className="flex items-center justify-center gap-2 mb-6">
            <Shield className="h-6 w-6 text-[#2EC4B6]" />
            <span className="text-[#2EC4B6] text-sm font-semibold uppercase tracking-wide">Security & Compliance</span>
          </div>
          <h1 className="text-5xl font-bold mb-6">
            Enterprise-Grade Security
            <br />
            <span className="text-[#2EC4B6]">Built for Mental Healthcare</span>
          </h1>
          <p className="text-xl text-white/70 max-w-2xl mx-auto mb-10">
            HIPAA compliance, military-grade encryption, and zero-trust architecture — so you can focus on patients, not security.
          </p>
          <div className="grid sm:grid-cols-4 gap-4 max-w-3xl mx-auto">
            {COMPLIANCE_BADGES.map((badge) => {
              const Icon = badge.icon;
              return (
                <div key={badge.name} className="bg-white/10 rounded-2xl p-4 border border-white/20 text-center">
                  <div className="w-10 h-10 bg-[#2EC4B6]/20 rounded-xl flex items-center justify-center mx-auto mb-2">
                    <Icon className="h-5 w-5 text-[#2EC4B6]" />
                  </div>
                  <div className="font-bold text-sm mb-0.5">{badge.name}</div>
                  <div className="text-xs text-white/60">{badge.description}</div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Security Features */}
      <section className="py-20 bg-gray-50">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-gray-900 mb-4">Security at Every Layer</h2>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            {SECURITY_FEATURES.map((feature) => {
              const Icon = feature.icon;
              return (
                <div key={feature.title} className="bg-white rounded-3xl p-6 border border-gray-200 hover:shadow-md transition-all">
                  <div className="w-11 h-11 bg-[#0A2342]/10 rounded-2xl flex items-center justify-center mb-4">
                    <Icon className="h-5 w-5 text-[#0A2342]" />
                  </div>
                  <h3 className="font-bold text-gray-900 mb-3">{feature.title}</h3>
                  <p className="text-gray-600 text-sm leading-relaxed">{feature.description}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* AI Privacy */}
      <section className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid md:grid-cols-2 gap-16 items-center">
            <div>
              <div className="flex items-center gap-2 mb-4">
                <Zap className="h-5 w-5 text-[#2EC4B6]" />
                <span className="text-[#2EC4B6] text-sm font-semibold uppercase tracking-wide">AI Privacy Principles</span>
              </div>
              <h2 className="text-4xl font-bold text-gray-900 mb-6">Your Patients' Data Is Never Shared with AI Models</h2>
              <p className="text-gray-600 leading-relaxed mb-8">
                Unlike consumer AI tools, 24Therapy's AI operates entirely within your own encrypted, isolated context. Patient data is never used to train shared models. Every AI inference is scoped to your practice only.
              </p>
              <ul className="space-y-3">
                {AI_PRIVACY_PRINCIPLES.map((principle) => (
                  <li key={principle} className="flex items-start gap-3">
                    <CheckCircle2 className="h-4 w-4 text-[#2EC4B6] mt-0.5 shrink-0" />
                    <span className="text-gray-700 text-sm">{principle}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="bg-gradient-to-br from-[#0A2342] to-[#1a3a6b] rounded-3xl p-8 text-white">
              <div className="flex items-center gap-2 mb-6">
                <FileText className="h-5 w-5 text-[#2EC4B6]" />
                <span className="font-semibold">HIPAA BAA — Included Free</span>
              </div>
              <p className="text-white/70 text-sm mb-6">A signed Business Associate Agreement is provided automatically with all paid plans. No legal negotiation required.</p>
              <ul className="space-y-3 mb-8">
                {BAA_TERMS.map((term) => (
                  <li key={term} className="flex items-start gap-2">
                    <CheckCircle2 className="h-4 w-4 text-[#2EC4B6] mt-0.5 shrink-0" />
                    <span className="text-sm text-white/80">{term}</span>
                  </li>
                ))}
              </ul>
              <Link
                href="/for-therapists"
                className="block w-full py-3 bg-[#2EC4B6] text-white font-semibold rounded-2xl text-center hover:bg-[#25a99d] transition-colors"
              >
                Get Your BAA →
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Certifications */}
      <section className="py-20 bg-gray-50">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-12">
            <h2 className="text-4xl font-bold text-gray-900 mb-4">Certifications & Audits</h2>
          </div>
          <div className="grid md:grid-cols-4 gap-6">
            {[
              { icon: Award, title: "SOC 2 Type II", desc: "Annual third-party audit of security controls, availability, and confidentiality.", status: "Certified" },
              { icon: Shield, title: "HIPAA", desc: "Full compliance with all HIPAA Privacy, Security, and Breach Notification Rules.", status: "Compliant" },
              { icon: Globe, title: "GDPR", desc: "EU General Data Protection Regulation compliance for European practices.", status: "Compliant" },
              { icon: Lock, title: "Penetration Testing", desc: "Annual third-party penetration testing by certified security professionals.", status: "Tested Annually" },
            ].map((cert) => {
              const Icon = cert.icon;
              return (
                <div key={cert.title} className="bg-white rounded-3xl p-6 border border-gray-200 text-center">
                  <div className="w-12 h-12 bg-emerald-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                    <Icon className="h-6 w-6 text-emerald-600" />
                  </div>
                  <h3 className="font-bold text-gray-900 mb-2">{cert.title}</h3>
                  <p className="text-gray-600 text-xs mb-3 leading-relaxed">{cert.desc}</p>
                  <span className="bg-emerald-100 text-emerald-700 text-xs font-bold px-3 py-1 rounded-full">
                    {cert.status}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 bg-gradient-to-br from-[#0A2342] to-[#1a3a6b] text-white text-center">
        <div className="max-w-2xl mx-auto px-6">
          <Shield className="h-12 w-12 text-[#2EC4B6] mx-auto mb-6" />
          <h2 className="text-3xl font-bold mb-4">Security Questions? Talk to Our Team.</h2>
          <p className="text-white/70 mb-8">Our security team can answer your compliance questions, provide documentation, and walk you through our technical controls.</p>
          <div className="flex gap-3 justify-center">
            <Link href="mailto:security@24therapy.ai" className="flex items-center gap-2 px-6 py-3 bg-[#2EC4B6] text-white font-semibold rounded-2xl hover:bg-[#25a99d] transition-colors">
              Contact Security Team
            </Link>
            <Link href="/for-therapists" className="flex items-center gap-2 px-6 py-3 border border-white/30 text-white rounded-2xl hover:bg-white/10 transition-colors">
              Get Started Free
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}

// Reviewed: 2026-06-13 — 24Therapy audit
