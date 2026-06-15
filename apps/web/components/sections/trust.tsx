"use client";

import { Users, Clock, Star, Globe, ShieldCheck, Brain } from "lucide-react";
import { motion, useInView } from "framer-motion";
import { useRef } from "react";

const stats = [
  { icon: ShieldCheck, value: "HIPAA", label: "Fully Compliant", color: "bg-teal-50 text-teal-600 border-teal-100" },
  { icon: Brain, value: "GPT-4o", label: "AI Engine", color: "bg-purple-50 text-purple-600 border-purple-100" },
  { icon: Clock, value: "< 60s", label: "Note Generation", color: "bg-blue-50 text-blue-600 border-blue-100" },
  { icon: Globe, value: "40+", label: "Languages Supported", color: "bg-orange-50 text-orange-600 border-orange-100" },
  { icon: Star, value: "100%", label: "Sessions Monitored", color: "bg-amber-50 text-amber-600 border-amber-100" },
  { icon: Users, value: "BAA", label: "Included on All Plans", color: "bg-green-50 text-green-600 border-green-100" },
];

const cardVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.08, duration: 0.5, ease: [0.16, 1, 0.3, 1] },
  }),
};

export function TrustSection() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-60px" });

  return (
    <section className="py-20 bg-gradient-to-b from-[#F8FAFC] to-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.p
          initial={{ opacity: 0, y: 12 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.5 }}
          className="text-center text-sm font-bold uppercase tracking-widest text-[#1F5EFF] mb-10"
        >
          Trusted by mental health professionals worldwide
        </motion.p>

        <div ref={ref} className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          {stats.map((stat, i) => {
            const Icon = stat.icon;
            return (
              <motion.div
                key={stat.label}
                custom={i}
                variants={cardVariants}
                initial="hidden"
                animate={inView ? "visible" : "hidden"}
                whileHover={{ y: -3, transition: { duration: 0.15 } }}
                className={`flex flex-col items-center text-center p-5 bg-white rounded-2xl shadow-sm border transition-shadow hover:shadow-md cursor-default ${stat.color.split(" ").slice(2).join(" ")}`}
              >
                <div className={`w-11 h-11 rounded-xl flex items-center justify-center mb-3 border ${stat.color}`}>
                  <Icon className="w-5 h-5" />
                </div>
                <div className="text-2xl font-bold text-[#0A2342] mb-1 tabular-nums">{stat.value}</div>
                <div className="text-[11px] text-slate-400 leading-tight font-medium">{stat.label}</div>
              </motion.div>
            );
          })}
        </div>

        {/* Compliance badges */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ delay: 0.5, duration: 0.5 }}
          className="mt-10 flex flex-wrap items-center justify-center gap-3"
        >
          {["HIPAA Compliant", "AES-256 Encrypted", "GDPR Ready", "BAA Included", "End-to-End Encrypted", "99.9% Uptime SLA"].map((badge) => (
            <div
              key={badge}
              className="flex items-center gap-2 bg-white px-4 py-2 rounded-full border border-slate-200 text-xs text-slate-500 font-semibold shadow-sm hover:shadow-md hover:border-green-200 hover:text-green-700 transition-all"
            >
              <ShieldCheck className="w-3.5 h-3.5 text-green-500" />
              {badge}
            </div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}

// Reviewed: 2026-06-13 — 24Therapy audit
