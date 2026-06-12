"use client";

import { MessageSquare, Search, Video, FileText, ArrowRight } from "lucide-react";
import { motion, useInView } from "framer-motion";
import { useRef } from "react";

const stepsPatient = [
  { step: 1, icon: MessageSquare, title: "Chat with AI", desc: "Start with our AI — no signup needed. It helps assess your needs and urgency.", color: "bg-blue-100 text-blue-600" },
  { step: 2, icon: Search, title: "Get Matched", desc: "AI recommends the right therapist based on your needs, language, and budget.", color: "bg-purple-100 text-purple-600" },
  { step: 3, icon: Video, title: "Start Your Session", desc: "Book and meet your therapist via secure video, audio, or chat.", color: "bg-green-100 text-green-600" },
  { step: 4, icon: FileText, title: "Track Progress", desc: "View session summaries, progress reports, and mood trends in your portal.", color: "bg-orange-100 text-orange-600" },
];

const stepsTherapist = [
  { step: 1, icon: Search, title: "Create Your Profile", desc: "Set up your licensed profile, specializations, and availability in minutes.", color: "bg-blue-100/20 text-white border-white/10" },
  { step: 2, icon: Video, title: "Run Sessions", desc: "Conduct video sessions with built-in AI transcription running automatically.", color: "bg-purple-100/20 text-white border-white/10" },
  { step: 3, icon: FileText, title: "AI Writes Your Notes", desc: "Review AI-generated SOAP notes. Edit if needed. Approve. Done in 60 seconds.", color: "bg-green-100/20 text-white border-white/10" },
  { step: 4, icon: MessageSquare, title: "Build Your Intelligence", desc: "Patient memories accumulate. Each session makes your AI smarter.", color: "bg-orange-100/20 text-white border-white/10" },
];

const stepItemVariants = {
  hidden: { opacity: 0, x: -16 },
  visible: (i: number) => ({
    opacity: 1,
    x: 0,
    transition: { delay: i * 0.1, duration: 0.45, ease: [0.16, 1, 0.3, 1] },
  }),
};

function StepList({ steps, dark = false }: { steps: typeof stepsPatient; dark?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-40px" });

  return (
    <div ref={ref} className="space-y-6">
      {steps.map((step, i) => {
        const Icon = step.icon;
        return (
          <motion.div
            key={step.step}
            custom={i}
            variants={stepItemVariants}
            initial="hidden"
            animate={inView ? "visible" : "hidden"}
            className="flex gap-4"
          >
            <div className="flex flex-col items-center">
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${step.color}`}>
                <Icon className="w-5 h-5" />
              </div>
              {i < steps.length - 1 && (
                <div className={`w-0.5 h-6 mt-2 ${dark ? "bg-white/15" : "bg-slate-200"}`} />
              )}
            </div>
            <div className="pt-1.5">
              <h4 className={`font-semibold mb-1 ${dark ? "text-white" : "text-[#0A2342]"}`}>{step.title}</h4>
              <p className={`text-sm leading-relaxed ${dark ? "text-white/55" : "text-slate-500"}`}>{step.desc}</p>
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}

export function HowItWorksSection() {
  const headerRef = useRef<HTMLDivElement>(null);
  const headerInView = useInView(headerRef, { once: true, margin: "-80px" });

  return (
    <section className="py-28 bg-gradient-to-b from-[#F8FAFC] to-white" id="how-it-works">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <motion.div
          ref={headerRef}
          initial={{ opacity: 0, y: 24 }}
          animate={headerInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          className="text-center mb-16"
        >
          <div className="inline-flex items-center gap-2 bg-slate-100 text-slate-600 text-sm font-semibold px-4 py-2 rounded-full mb-5">
            How It Works
          </div>
          <h2 className="text-4xl sm:text-5xl font-bold text-[#0A2342] mb-4 leading-tight">
            Simple for everyone.{" "}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#1F5EFF] to-[#2EC4B6]">
              Powerful for all.
            </span>
          </h2>
          <p className="text-xl text-slate-500 max-w-2xl mx-auto leading-relaxed">
            Whether you&apos;re a patient seeking help or a therapist growing your practice —
            24Therapy makes it seamless.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* For Patients */}
          <motion.div
            initial={{ opacity: 0, x: -24 }}
            animate={headerInView ? { opacity: 1, x: 0 } : {}}
            transition={{ delay: 0.2, duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
            className="bg-white rounded-3xl p-8 shadow-sm border border-slate-100 hover:shadow-lg transition-shadow"
          >
            <div className="flex items-center gap-3 mb-8">
              <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center">
                <MessageSquare className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <div className="text-[10px] text-slate-400 uppercase tracking-widest font-bold">For Patients</div>
                <h3 className="text-xl font-bold text-[#0A2342]">Get Help Today</h3>
              </div>
            </div>
            <StepList steps={stepsPatient} />
            <a
              href="/signup?role=patient"
              className="mt-8 w-full flex items-center justify-center gap-2 bg-[#1F5EFF] hover:bg-[#1649D4] text-white font-semibold py-3.5 rounded-xl transition-colors shadow-lg shadow-[#1F5EFF]/20 group"
            >
              Get Support Today
              <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
            </a>
          </motion.div>

          {/* For Therapists */}
          <motion.div
            initial={{ opacity: 0, x: 24 }}
            animate={headerInView ? { opacity: 1, x: 0 } : {}}
            transition={{ delay: 0.3, duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
            className="bg-gradient-to-br from-[#0A2342] to-[#0D2A4A] rounded-3xl p-8 shadow-xl border border-white/10 hover:shadow-2xl transition-shadow"
          >
            <div className="flex items-center gap-3 mb-8">
              <div className="w-10 h-10 bg-white/10 rounded-xl flex items-center justify-center border border-white/10">
                <FileText className="w-5 h-5 text-white" />
              </div>
              <div>
                <div className="text-[10px] text-white/40 uppercase tracking-widest font-bold">For Therapists</div>
                <h3 className="text-xl font-bold text-white">Reclaim Your Time</h3>
              </div>
            </div>
            <StepList steps={stepsTherapist} dark />
            <a
              href="/for-therapists"
              className="mt-8 w-full flex items-center justify-center gap-2 bg-[#1F5EFF] hover:bg-[#1649D4] text-white font-semibold py-3.5 rounded-xl transition-colors shadow-lg shadow-[#1F5EFF]/30 group"
            >
              Join as a Therapist — It&apos;s Free
              <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
            </a>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
