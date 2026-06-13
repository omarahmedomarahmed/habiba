"use client";

import Link from "next/link";
import { Brain, Mic, Target, Users, BarChart3, Shield, Zap, Heart, FileText, Calendar, Radio, Globe } from "lucide-react";
import { cn } from "@/lib/utils";
import { motion, useInView } from "framer-motion";
import { useRef } from "react";

const MotionLink = motion(Link);

const features = [
  {
    icon: Mic,
    title: "AI Scribe",
    subtitle: "Clinical Documentation Automated",
    description:
      "Real-time transcription with speaker detection. AI generates SOAP, DAP, and BIRP notes automatically. Review, edit, approve in under 60 seconds.",
    highlight: "90% less documentation time",
    color: "from-blue-500 to-blue-600",
    bg: "bg-blue-50 hover:bg-blue-100/70",
    iconBg: "bg-blue-100 text-blue-600",
    border: "border-blue-100 hover:border-blue-200",
    href: "/ai-scribe",
  },
  {
    icon: Brain,
    title: "Clinical Copilot",
    subtitle: "Live AI Assistance During Sessions",
    description:
      "AI suggests questions, flags risk indicators, tracks treatment goals, and surfaces relevant patient history — all in real-time, visible only to you.",
    highlight: "Live session intelligence",
    color: "from-purple-500 to-purple-600",
    bg: "bg-purple-50 hover:bg-purple-100/70",
    iconBg: "bg-purple-100 text-purple-600",
    border: "border-purple-100 hover:border-purple-200",
    href: "/features/ai-copilot",
  },
  {
    icon: Radio,
    title: "Radar Matching",
    subtitle: "Instant Therapist Connection",
    description:
      "Patient needs urgent help. Radar broadcasts to available therapists. First to accept starts the session. Patient connected in under 5 minutes.",
    highlight: "< 5 minute response time",
    color: "from-green-500 to-green-600",
    bg: "bg-green-50 hover:bg-green-100/70",
    iconBg: "bg-green-100 text-green-600",
    border: "border-green-100 hover:border-green-200",
    href: "/features/radar-matching",
  },
  {
    icon: Heart,
    title: "Patient Memory",
    subtitle: "Longitudinal Clinical Intelligence",
    description:
      "AI builds a structured memory of each patient across sessions. Symptoms, goals, relationships, life events — all searchable and contextual.",
    highlight: "Your clinical second brain",
    color: "from-rose-500 to-rose-600",
    bg: "bg-rose-50 hover:bg-rose-100/70",
    iconBg: "bg-rose-100 text-rose-600",
    border: "border-rose-100 hover:border-rose-200",
    href: "/features/memory-layer",
  },
  {
    icon: Target,
    title: "Assessments",
    subtitle: "PHQ-9, GAD-7, PCL-5 & More",
    description:
      "Standardized assessments with automatic scoring and trend visualization. Send to patients between sessions. Track progress over time.",
    highlight: "Evidence-based outcomes",
    color: "from-orange-500 to-orange-600",
    bg: "bg-orange-50 hover:bg-orange-100/70",
    iconBg: "bg-orange-100 text-orange-600",
    border: "border-orange-100 hover:border-orange-200",
    href: "/features/assessments",
  },
  {
    icon: Users,
    title: "Practice Management",
    subtitle: "Multi-Therapist Teams",
    description:
      "Manage multiple therapists, shared patients, team billing, and practice analytics. Everything under one organization with RBAC.",
    highlight: "Built for teams of any size",
    color: "from-teal-500 to-teal-600",
    bg: "bg-teal-50 hover:bg-teal-100/70",
    iconBg: "bg-teal-100 text-teal-600",
    border: "border-teal-100 hover:border-teal-200",
    href: "/features/practice-management",
  },
  {
    icon: Calendar,
    title: "Smart Scheduling",
    subtitle: "Integrated Booking System",
    description:
      "Patients book from your marketplace profile. Calendar sync, automated reminders, waitlist management, and no-show tracking built in.",
    highlight: "Zero scheduling friction",
    color: "from-indigo-500 to-indigo-600",
    bg: "bg-indigo-50 hover:bg-indigo-100/70",
    iconBg: "bg-indigo-100 text-indigo-600",
    border: "border-indigo-100 hover:border-indigo-200",
    href: "/features/smart-scheduling",
  },
  {
    icon: BarChart3,
    title: "Analytics & Outcomes",
    subtitle: "Practice Intelligence",
    description:
      "Track session utilization, patient outcomes, revenue metrics, AI usage costs, and clinical quality indicators. Data-driven practice growth.",
    highlight: "Full practice visibility",
    color: "from-cyan-500 to-cyan-600",
    bg: "bg-cyan-50 hover:bg-cyan-100/70",
    iconBg: "bg-cyan-100 text-cyan-600",
    border: "border-cyan-100 hover:border-cyan-200",
    href: "/features/analytics",
  },
  {
    icon: Globe,
    title: "API & Integrations",
    subtitle: "Build On Top of 24Therapy",
    description:
      "Full REST API, webhooks, and SDKs. Integrate with EHRs, insurance systems, and any workflow. White-label available for enterprises.",
    highlight: "Open platform architecture",
    color: "from-slate-500 to-slate-600",
    bg: "bg-slate-50 hover:bg-slate-100/70",
    iconBg: "bg-slate-100 text-slate-600",
    border: "border-slate-100 hover:border-slate-200",
    href: "/features/integrations",
  },
];

const cardVariants = {
  hidden: { opacity: 0, y: 24, scale: 0.98 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    scale: 1,
    transition: {
      delay: i * 0.07,
      duration: 0.5,
      ease: [0.16, 1, 0.3, 1],
    },
  }),
};

export function FeaturesSection() {
  const headerRef = useRef<HTMLDivElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const headerInView = useInView(headerRef, { once: true, margin: "-80px" });
  const gridInView = useInView(gridRef, { once: true, margin: "-60px" });

  return (
    <section className="py-28 bg-white relative" id="features">
      {/* Subtle background pattern */}
      <div
        className="absolute inset-0 opacity-[0.025] pointer-events-none"
        style={{
          backgroundImage: `radial-gradient(circle at 1px 1px, #0A2342 1px, transparent 0)`,
          backgroundSize: "32px 32px",
        }}
      />

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <motion.div
          ref={headerRef}
          initial={{ opacity: 0, y: 24 }}
          animate={headerInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          className="text-center max-w-3xl mx-auto mb-16"
        >
          <div className="inline-flex items-center gap-2 bg-[#EEF2FF] text-[#1F5EFF] text-sm font-semibold px-4 py-2 rounded-full mb-5 border border-[#1F5EFF]/15">
            <Zap className="w-4 h-4" />
            12 Integrated Systems
          </div>
          <h2 className="text-4xl sm:text-5xl font-bold text-[#0A2342] mb-5 leading-tight">
            Everything a Mental Health Practice Needs.{" "}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#1F5EFF] to-[#2EC4B6]">
              In One Platform.
            </span>
          </h2>
          <p className="text-xl text-slate-500 leading-relaxed">
            No more Zoom + Google Docs + WhatsApp + Excel. 24Therapy replaces every fragmented tool
            with one AI-powered system that gets smarter over time.
          </p>
        </motion.div>

        {/* Features grid */}
        <div ref={gridRef} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {features.map((feature, i) => {
            const Icon = feature.icon;
            return (
              <MotionLink
                href={feature.href}
                key={feature.title}
                custom={i}
                variants={cardVariants}
                initial="hidden"
                animate={gridInView ? "visible" : "hidden"}
                whileHover={{ y: -4, transition: { duration: 0.2 } }}
                className={cn(
                  "group p-7 rounded-2xl border transition-all duration-300 block",
                  feature.bg,
                  feature.border,
                  i === 0 ? "lg:col-span-2" : ""
                )}
              >
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center mb-4 ${feature.iconBg} group-hover:scale-110 transition-transform duration-200`}>
                  <Icon className="w-6 h-6" />
                </div>

                <div className="mb-1.5">
                  <span className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">
                    {feature.subtitle}
                  </span>
                </div>

                <h3 className="text-xl font-bold text-[#0A2342] mb-2.5 group-hover:text-[#1F5EFF] transition-colors">{feature.title}</h3>
                <p className="text-slate-500 text-sm leading-relaxed mb-5">{feature.description}</p>

                <div
                  className={cn(
                    "inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-full bg-gradient-to-r text-white shadow-sm",
                    feature.color
                  )}
                >
                  <Zap className="w-3 h-3" />
                  {feature.highlight}
                </div>
              </MotionLink>
            );
          })}
        </div>

        {/* Bottom compliance strip */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={gridInView ? { opacity: 1 } : {}}
          transition={{ delay: 0.8, duration: 0.5 }}
          className="mt-14 flex flex-wrap items-center justify-center gap-5"
        >
          {["HIPAA Compliant", "SOC 2 Type II", "GDPR Ready", "256-bit AES Encryption", "99.9% Uptime SLA", "ISO 27001"].map((badge) => (
            <div
              key={badge}
              className="flex items-center gap-2 bg-slate-50 border border-slate-200 px-4 py-2 rounded-full text-sm text-slate-500 font-medium hover:bg-white hover:shadow-sm transition-all"
            >
              <Shield className="w-3.5 h-3.5 text-green-500" />
              {badge}
            </div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}

// Reviewed: 2026-06-13 — 24Therapy audit
