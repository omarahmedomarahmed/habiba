"use client";

import Link from "next/link";
import { ArrowRight, Brain, Users, Shield, MessageSquare, Sparkles, CheckCircle2 } from "lucide-react";
import { motion, useInView } from "framer-motion";
import { useRef } from "react";

const perks = [
  "First session free",
  "No credit card required",
  "HIPAA compliant from day one",
  "Cancel anytime",
];

export function CTASection() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-80px" });

  return (
    <section className="py-28 bg-gradient-to-br from-[#071A33] via-[#0A2342] to-[#0D2A4A] relative overflow-hidden">
      {/* Ambient glows */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-1/4 w-[500px] h-[500px] bg-[#1F5EFF]/15 rounded-full blur-[100px]" />
        <div className="absolute bottom-0 right-1/4 w-[400px] h-[400px] bg-[#2EC4B6]/12 rounded-full blur-[80px]" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[300px] bg-white/[0.02] rounded-full blur-[60px]" />
        {/* Grid overlay */}
        <div
          className="absolute inset-0 opacity-[0.025]"
          style={{
            backgroundImage: `radial-gradient(circle at 1px 1px, rgba(255,255,255,0.8) 1px, transparent 0)`,
            backgroundSize: "40px 40px",
          }}
        />
      </div>

      <div ref={ref} className="relative max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        {/* Icon */}
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={inView ? { opacity: 1, scale: 1 } : {}}
          transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
          className="w-20 h-20 bg-gradient-to-br from-[#1F5EFF] to-[#2EC4B6] rounded-3xl flex items-center justify-center mx-auto mb-8 shadow-2xl shadow-[#1F5EFF]/30"
        >
          <Brain className="w-10 h-10 text-white" />
        </motion.div>

        <motion.h2
          initial={{ opacity: 0, y: 20 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ delay: 0.1, duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          className="text-4xl sm:text-5xl lg:text-6xl font-bold text-white mb-6 leading-tight"
        >
          The future of mental healthcare{" "}
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#4D8EFF] to-[#2EC4B6]">
            starts here.
          </span>
        </motion.h2>

        <motion.p
          initial={{ opacity: 0, y: 16 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ delay: 0.2, duration: 0.6 }}
          className="text-xl text-white/55 mb-10 max-w-2xl mx-auto leading-relaxed"
        >
          Join therapists saving 8+ hours a week on documentation — and patients
          getting matched with the right therapist in under 5 minutes.
        </motion.p>

        {/* Perks row */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={inView ? { opacity: 1 } : {}}
          transition={{ delay: 0.3, duration: 0.5 }}
          className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 mb-10"
        >
          {perks.map((perk) => (
            <div key={perk} className="flex items-center gap-1.5 text-sm text-white/50">
              <CheckCircle2 className="w-3.5 h-3.5 text-green-400/80 flex-shrink-0" />
              {perk}
            </div>
          ))}
        </motion.div>

        {/* CTAs */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ delay: 0.35, duration: 0.5 }}
          className="flex flex-wrap gap-3 justify-center mb-12"
        >
          <Link
            href="/signup"
            className="group inline-flex items-center gap-2.5 bg-[#1F5EFF] hover:bg-[#1649D4] text-white font-bold px-8 py-4 rounded-2xl shadow-xl shadow-[#1F5EFF]/35 hover:shadow-2xl hover:shadow-[#1F5EFF]/25 hover:-translate-y-0.5 transition-all duration-200"
          >
            <Sparkles className="w-5 h-5" />
            Start Free — No Credit Card
            <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform duration-200" />
          </Link>
          <Link
            href="/chat"
            className="inline-flex items-center gap-2 bg-white/8 hover:bg-white/15 text-white font-semibold px-8 py-4 rounded-2xl border border-white/15 hover:border-white/25 hover:-translate-y-0.5 transition-all duration-200 backdrop-blur-sm"
          >
            <MessageSquare className="w-5 h-5" />
            Try AI Free
          </Link>
          <Link
            href="/find-therapist"
            className="inline-flex items-center gap-2 text-white/55 hover:text-white font-semibold px-6 py-4 rounded-2xl border border-white/10 hover:border-white/20 hover:bg-white/5 transition-all duration-200"
          >
            <Users className="w-5 h-5" />
            Find a Therapist
          </Link>
        </motion.div>

        {/* Trust signals */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={inView ? { opacity: 1 } : {}}
          transition={{ delay: 0.5, duration: 0.5 }}
          className="flex flex-wrap items-center justify-center gap-6"
        >
          {[
            { icon: Shield, label: "HIPAA & GDPR", color: "text-green-400" },
            { label: "99.9% Uptime SLA", dot: "bg-green-400" },
            { label: "256-bit Encryption", dot: "bg-blue-400" },
            { label: "SOC 2 Type II", dot: "bg-purple-400" },
          ].map((item, i) => (
            <div key={i} className="flex items-center gap-2 text-white/40 text-sm">
              {item.icon ? (
                <item.icon className={`w-4 h-4 ${item.color}`} />
              ) : (
                <div className={`w-2 h-2 rounded-full ${item.dot}`} />
              )}
              <span>{item.label}</span>
            </div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}

// Reviewed: 2026-06-13 — 24Therapy audit
