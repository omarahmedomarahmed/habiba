"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Briefcase, MapPin, Clock, ArrowRight, Heart, Brain, Shield, Zap,
  Users, Globe, TrendingUp, Star, CheckCircle, Laptop, Building2,
  DollarSign, Award, Coffee, ChevronRight
} from "lucide-react";

type Department = "all" | "engineering" | "clinical" | "product" | "sales" | "operations";

const OPEN_ROLES = [
  {
    title: "Senior Full-Stack Engineer",
    department: "engineering" as Department,
    location: "Remote (US)",
    type: "Full-time",
    level: "Senior",
    description: "Build the core platform features powering thousands of therapy sessions. Deep Next.js, NestJS, and PostgreSQL experience required.",
    tags: ["Next.js", "NestJS", "TypeScript", "PostgreSQL"],
  },
  {
    title: "AI/ML Engineer — Clinical Intelligence",
    department: "engineering" as Department,
    location: "Remote (US/EU)",
    type: "Full-time",
    level: "Senior",
    description: "Build and improve AI systems that generate clinical notes, detect risk, and build patient memory graphs. LLM fine-tuning and RAG experience essential.",
    tags: ["OpenAI", "LangChain", "Python", "RAG"],
  },
  {
    title: "Senior Product Designer",
    department: "product" as Department,
    location: "Remote",
    type: "Full-time",
    level: "Senior",
    description: "Design clinical workflows and patient experiences that are both delightful and HIPAA-compliant. Healthcare UX experience preferred.",
    tags: ["Figma", "Healthcare UX", "Design Systems"],
  },
  {
    title: "Clinical Product Manager",
    department: "product" as Department,
    location: "Remote (US)",
    type: "Full-time",
    level: "Mid",
    description: "Bridge the gap between licensed therapists and engineering. Translate clinical workflows into product requirements. Clinical background required.",
    tags: ["Clinical Background", "Product", "EHR"],
  },
  {
    title: "Enterprise Account Executive",
    department: "sales" as Department,
    location: "Remote (US)",
    type: "Full-time",
    level: "Mid/Senior",
    description: "Sell 24Therapy to group practices, clinics, and health systems. Build relationships with clinical directors and C-suite at healthcare organizations.",
    tags: ["HealthTech Sales", "Enterprise", "CRM"],
  },
  {
    title: "Customer Success Manager — Clinical",
    department: "operations" as Department,
    location: "Remote (US)",
    type: "Full-time",
    level: "Mid",
    description: "Onboard and support therapists to get maximum value from the platform. Reduce churn, drive expansion revenue, and build long-term relationships.",
    tags: ["Customer Success", "Healthcare", "SaaS"],
  },
  {
    title: "Licensed Mental Health Consultant",
    department: "clinical" as Department,
    location: "Remote",
    type: "Part-time / Contract",
    level: "Expert",
    description: "Provide clinical guidance to our product and AI teams. Review AI-generated notes, advise on clinical workflows, and ensure our platform meets clinical standards.",
    tags: ["LCSW", "LPC", "LMFT", "Clinical Consulting"],
  },
  {
    title: "DevOps / Platform Engineer",
    department: "engineering" as Department,
    location: "Remote",
    type: "Full-time",
    level: "Mid/Senior",
    description: "Own infrastructure, CI/CD, observability, and HIPAA compliance tooling. AWS, Terraform, and security-first mindset required.",
    tags: ["AWS", "Terraform", "HIPAA", "DevOps"],
  },
];

const BENEFITS = [
  { icon: DollarSign, title: "Competitive Compensation", description: "Top-of-market salary + equity. We pay well because we value great people." },
  { icon: Laptop, title: "Remote-First", description: "Work from anywhere in the world. We're async-first and trust you to get things done." },
  { icon: Heart, title: "Mental Health Benefits", description: "Unlimited therapy sessions via 24Therapy. We practice what we preach." },
  { icon: Globe, title: "Flexible PTO", description: "Unlimited PTO with a required 2-week minimum. We mean it." },
  { icon: Award, title: "Learning Budget", description: "$2,000/year for conferences, courses, and books." },
  { icon: Users, title: "Mission-Driven Team", description: "Work on something that genuinely improves mental health access and therapist wellbeing." },
  { icon: TrendingUp, title: "Real Equity", description: "Meaningful equity stake in a high-growth healthcare AI company." },
  { icon: Coffee, title: "Equipment Stipend", description: "$1,500 home office and equipment budget for new hires." },
];

const VALUES = [
  {
    title: "Therapists first",
    description: "Every decision we make asks: does this make therapists better at their jobs? If not, we don't build it.",
  },
  {
    title: "AI as assistant, not replacement",
    description: "We believe AI should augment clinical care — never replace it. This guides every model decision we make.",
  },
  {
    title: "Privacy by design",
    description: "HIPAA compliance and patient privacy are not features. They're the foundation everything else is built on.",
  },
  {
    title: "Ship and learn",
    description: "We move fast and put things in therapists' hands. Their feedback is our roadmap.",
  },
];

export default function CareersPage() {
  const [activeDept, setActiveDept] = useState<Department>("all");

  const filteredRoles = activeDept === "all"
    ? OPEN_ROLES
    : OPEN_ROLES.filter((r) => r.department === activeDept);

  const depts: { id: Department; label: string; count: number }[] = [
    { id: "all", label: "All Roles", count: OPEN_ROLES.length },
    { id: "engineering", label: "Engineering", count: OPEN_ROLES.filter(r => r.department === "engineering").length },
    { id: "clinical", label: "Clinical", count: OPEN_ROLES.filter(r => r.department === "clinical").length },
    { id: "product", label: "Product", count: OPEN_ROLES.filter(r => r.department === "product").length },
    { id: "sales", label: "Sales", count: OPEN_ROLES.filter(r => r.department === "sales").length },
    { id: "operations", label: "Operations", count: OPEN_ROLES.filter(r => r.department === "operations").length },
  ];

  return (
    <div className="min-h-screen bg-white">
      {/* Hero */}
      <section className="bg-gradient-to-br from-[#0A2342] to-[#1F5EFF] text-white py-20 px-4">
        <div className="max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 bg-white/10 border border-white/20 rounded-full px-4 py-1.5 text-sm mb-6">
            <Heart className="w-4 h-4 text-[#2EC4B6]" />
            Join the mission
          </div>
          <h1 className="text-4xl md:text-6xl font-bold mb-6">
            Build technology that{" "}
            <span className="text-[#2EC4B6]">heals</span>
          </h1>
          <p className="text-white/80 text-xl max-w-2xl mx-auto mb-10">
            We're building the operating system for mental health. Join a small, talented team on a mission to make therapy more effective, accessible, and sustainable.
          </p>
          <div className="flex items-center justify-center gap-8 text-sm text-white/60">
            <span>🌍 Remote-first</span>
            <span>📈 Series A funded</span>
            <span>🏥 Real clinical impact</span>
            <span>💰 Competitive equity</span>
          </div>
        </div>
      </section>

      {/* Values */}
      <section className="py-16 px-4">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-[#0A2342] mb-4">What we believe</h2>
          </div>
          <div className="grid md:grid-cols-2 gap-6">
            {VALUES.map((v) => (
              <div key={v.title} className="border border-gray-200 rounded-2xl p-6 hover:border-[#2EC4B6] transition-all">
                <h3 className="font-bold text-[#0A2342] mb-2">{v.title}</h3>
                <p className="text-gray-500 text-sm">{v.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Benefits */}
      <section className="py-16 px-4 bg-gray-50">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-[#0A2342] mb-4">Benefits & perks</h2>
          </div>
          <div className="grid md:grid-cols-4 gap-6">
            {BENEFITS.map((b) => {
              const Icon = b.icon;
              return (
                <div key={b.title} className="bg-white rounded-xl p-5 border border-gray-200">
                  <div className="w-10 h-10 rounded-xl bg-[#2EC4B6]/10 flex items-center justify-center mb-3">
                    <Icon className="w-5 h-5 text-[#2EC4B6]" />
                  </div>
                  <h3 className="font-semibold text-[#0A2342] text-sm mb-1">{b.title}</h3>
                  <p className="text-xs text-gray-500">{b.description}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Open Roles */}
      <section className="py-16 px-4">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-[#0A2342] mb-4">Open positions</h2>
            <p className="text-gray-500">We're a small team, so every hire matters. We hire for impact.</p>
          </div>

          {/* Department Filter */}
          <div className="flex flex-wrap gap-2 justify-center mb-8">
            {depts.map((dept) => (
              <button
                key={dept.id}
                onClick={() => setActiveDept(dept.id)}
                className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
                  activeDept === dept.id
                    ? "bg-[#0A2342] text-white"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}
              >
                {dept.label} ({dept.count})
              </button>
            ))}
          </div>

          <div className="space-y-4">
            {filteredRoles.map((role) => (
              <div
                key={role.title}
                className="border border-gray-200 rounded-2xl p-6 hover:border-[#2EC4B6] hover:shadow-sm transition-all"
              >
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="font-bold text-[#0A2342]">{role.title}</h3>
                      <span className="text-xs bg-[#2EC4B6]/10 text-[#2EC4B6] px-2 py-0.5 rounded-full font-medium">
                        {role.type}
                      </span>
                    </div>
                    <div className="flex items-center gap-4 text-sm text-gray-500 mb-3">
                      <span className="flex items-center gap-1">
                        <MapPin className="w-3.5 h-3.5" /> {role.location}
                      </span>
                      <span className="flex items-center gap-1">
                        <Briefcase className="w-3.5 h-3.5" /> {role.level}
                      </span>
                    </div>
                    <p className="text-sm text-gray-600 mb-3">{role.description}</p>
                    <div className="flex flex-wrap gap-2">
                      {role.tags.map((tag) => (
                        <span key={tag} className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded-lg">
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                  <Link
                    href={`mailto:careers@24therapy.ai?subject=Application: ${role.title}`}
                    className="bg-[#0A2342] hover:bg-[#0d2d56] text-white px-5 py-2.5 rounded-xl text-sm font-semibold flex items-center gap-2 flex-shrink-0"
                  >
                    Apply <ArrowRight className="w-4 h-4" />
                  </Link>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-8 text-center">
            <p className="text-gray-500 text-sm">
              Don't see the right role?{" "}
              <a href="mailto:careers@24therapy.ai" className="text-[#2EC4B6] font-medium hover:underline">
                Send us your resume
              </a>{" "}
              — we hire great people before we have the role.
            </p>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-16 px-4 bg-gradient-to-br from-[#0A2342] to-[#1F5EFF] text-white">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-3xl font-bold mb-4">Build what matters</h2>
          <p className="text-white/70 mb-8">
            Mental health is in a global crisis. Technology can help. Come build it with us.
          </p>
          <a
            href="mailto:careers@24therapy.ai"
            className="bg-[#2EC4B6] hover:bg-[#26b0a3] text-white px-8 py-3 rounded-xl font-semibold inline-flex items-center gap-2"
          >
            careers@24therapy.ai <ArrowRight className="w-4 h-4" />
          </a>
        </div>
      </section>
    </div>
  );
}

// Reviewed: 2026-06-13 — 24Therapy audit
