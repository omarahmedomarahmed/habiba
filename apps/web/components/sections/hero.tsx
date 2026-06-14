"use client";

import Link from "next/link";
import {
  ArrowRight, Brain, Sparkles, Shield, Star,
  Users, CheckCircle2, Zap, Lock, FileText, Mic, Activity
} from "lucide-react";
import { cn } from "@/lib/utils";

export function HeroSection() {
  return (
    <section className="relative min-h-screen pt-16 overflow-hidden bg-gradient-to-br from-[#071A33] via-[#0A2342] to-[#0D2A4A]">
      {/* ── Background ambient effects ── */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {/* Radial glow top-left */}
        <div className="absolute -top-32 -left-32 w-[600px] h-[600px] bg-[#1F5EFF]/10 rounded-full blur-[120px]" />
        {/* Radial glow bottom-right */}
        <div className="absolute -bottom-32 -right-32 w-[500px] h-[500px] bg-[#2EC4B6]/10 rounded-full blur-[100px]" />
        {/* Center accent */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[400px] bg-[#1F5EFF]/5 rounded-full blur-[80px]" />
        {/* Dot grid */}
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage: `radial-gradient(circle at 1px 1px, rgba(255,255,255,0.8) 1px, transparent 0)`,
            backgroundSize: "40px 40px",
          }}
        />
      </div>

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-16 pb-32">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 lg:gap-20 items-center">

          {/* ── LEFT: copy ── */}
          <div className="text-white order-2 lg:order-1">
            {/* Eyebrow badge */}
            <div className="inline-flex items-center gap-2.5 bg-white/8 border border-white/15 rounded-full px-4 py-2 mb-8 backdrop-blur-sm">
              <span className="w-2 h-2 bg-[#2EC4B6] rounded-full animate-pulse" />
              <span className="text-sm font-medium text-white/85">AI-Native Mental Health Platform</span>
              <span className="text-white/30">·</span>
              <span className="text-sm text-white/55">HIPAA Compliant</span>
            </div>

            <h1 className="text-5xl sm:text-6xl lg:text-[62px] font-bold leading-[1.08] mb-6 tracking-tight">
              Mental health support{" "}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#4D8EFF] via-[#2EC4B6] to-[#4D8EFF] bg-[length:200%_auto] animate-gradient">
                powered by AI,
              </span>{" "}
              <span className="text-white/85">delivered by humans.</span>
            </h1>

            <p className="text-lg text-white/60 leading-relaxed mb-10 max-w-md">
              AI scribe auto-generates SOAP notes in seconds. Real-time copilot guides every session.
              Calendly-style booking with optional payment. Zero admin work.
            </p>

            {/* Primary CTAs */}
            <div className="flex flex-wrap gap-3 mb-10">
              <Link
                href="/signup"
                className="group inline-flex items-center gap-2.5 bg-[#1F5EFF] hover:bg-[#1649D4] text-white font-semibold px-7 py-3.5 rounded-2xl shadow-lg shadow-[#1F5EFF]/40 hover:shadow-xl hover:shadow-[#1F5EFF]/30 hover:-translate-y-0.5 transition-all duration-200"
              >
                Get Started Free
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform duration-200" />
              </Link>
              <Link
                href="/find-therapist"
                className="inline-flex items-center gap-2 bg-white/8 hover:bg-white/15 text-white font-semibold px-7 py-3.5 rounded-2xl border border-white/15 backdrop-blur-sm hover:-translate-y-0.5 transition-all duration-200"
              >
                <Users className="w-4 h-4" />
                Find a Therapist
              </Link>
              <Link
                href="/for-therapists"
                className="inline-flex items-center gap-2 text-white/60 hover:text-white font-medium px-5 py-3.5 rounded-2xl border border-white/10 hover:border-white/20 hover:bg-white/5 transition-all duration-200"
              >
                <Brain className="w-4 h-4" />
                I&apos;m a Therapist
              </Link>
            </div>

            {/* Trust bar */}
            <div className="flex flex-wrap items-center gap-6">
              <div className="flex -space-x-2">
                {[180, 220, 260, 300, 340].map((hue, i) => (
                  <div
                    key={i}
                    className="w-9 h-9 rounded-full border-2 border-[#0A2342] ring-1 ring-white/10"
                    style={{ background: `linear-gradient(135deg, hsl(${hue}deg 65% 60%), hsl(${hue + 30}deg 65% 40%))` }}
                  />
                ))}
              </div>
              <div>
                <div className="flex items-center gap-1 mb-0.5">
                  {[...Array(5)].map((_, i) => (
                    <Star key={i} className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                  ))}
                  <span className="text-white/90 font-semibold text-sm ml-1">4.9</span>
                </div>
                <p className="text-xs text-white/45">Trusted by 500+ therapists</p>
              </div>
              <div className="hidden sm:flex items-center gap-1.5 text-white/45 text-sm">
                <Shield className="w-4 h-4 text-green-400/80" />
                HIPAA & SOC 2 Compliant
              </div>
            </div>

            {/* Key metrics strip — below CTAs for better spacing */}
            <div className="mt-10 pt-8 border-t border-white/8 grid grid-cols-3 gap-4">
              {[
                { icon: Zap, label: "Avg. note time", value: "< 60 sec", color: "text-[#2EC4B6]" },
                { icon: Users, label: "Therapist match", value: "< 5 min", color: "text-[#4D8EFF]" },
                { icon: Lock, label: "Encryption", value: "AES-256", color: "text-emerald-400" },
              ].map(({ icon: Icon, label, value, color }) => (
                <div key={label} className="flex flex-col gap-1">
                  <Icon className={cn("w-4 h-4 mb-0.5", color)} />
                  <p className="font-bold text-white text-sm">{value}</p>
                  <p className="text-[11px] text-white/40 leading-tight">{label}</p>
                </div>
              ))}
            </div>
          </div>

          {/* ── RIGHT: AI Scribe demo card ── */}
          <div className="order-1 lg:order-2">
            <div className="absolute inset-0 rounded-3xl bg-gradient-to-br from-[#1F5EFF]/20 to-[#2EC4B6]/10 blur-2xl scale-95 pointer-events-none" aria-hidden />

            <div className="relative bg-white/[0.07] backdrop-blur-2xl rounded-3xl border border-white/15 overflow-hidden shadow-2xl shadow-black/40 ring-1 ring-white/5">
              {/* Card header */}
              <div className="flex items-center gap-3 px-5 py-4 border-b border-white/10 bg-gradient-to-r from-white/[0.05] to-transparent">
                <div className="w-10 h-10 bg-gradient-to-br from-[#1F5EFF] to-[#2EC4B6] rounded-xl flex items-center justify-center flex-shrink-0 shadow-lg shadow-[#1F5EFF]/30">
                  <Brain className="w-5 h-5 text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-white text-sm">AI Scribe — Live Session</p>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span className="w-1.5 h-1.5 bg-red-400 rounded-full animate-pulse" />
                    <span className="text-xs text-white/45">Recording · AI generating note</span>
                  </div>
                </div>
              </div>

              {/* Mock AI Scribe output */}
              <div className="px-5 pt-5 pb-3 space-y-4">
                {/* Live transcript snippet */}
                <div className="bg-white/5 border border-white/10 rounded-2xl p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <Mic className="w-3.5 h-3.5 text-red-400" />
                    <span className="text-[11px] text-white/40 font-medium uppercase tracking-wide">Live Transcript</span>
                  </div>
                  <p className="text-white/70 text-sm leading-relaxed">
                    <span className="text-white/40 text-xs">Therapist: </span>
                    How have you been managing the anxiety since our last session?
                  </p>
                  <p className="text-white/70 text-sm leading-relaxed mt-1.5">
                    <span className="text-white/40 text-xs">Patient: </span>
                    Better, actually. The breathing techniques have been helping a lot…
                  </p>
                  <div className="flex gap-1 mt-3">
                    {[0, 0.15, 0.3].map((d, i) => (
                      <div key={i} className="w-1 h-1 bg-white/30 rounded-full animate-bounce" style={{ animationDelay: `${d}s` }} />
                    ))}
                  </div>
                </div>

                {/* SOAP note preview */}
                <div className="bg-white/5 border border-white/10 rounded-2xl p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <FileText className="w-3.5 h-3.5 text-[#2EC4B6]" />
                    <span className="text-[11px] text-white/40 font-medium uppercase tracking-wide">Auto-Generated SOAP Note</span>
                  </div>
                  <div className="space-y-1.5 text-xs text-white/65 leading-relaxed">
                    <p><span className="text-[#2EC4B6] font-semibold">S:</span> Patient reports improvement with breathing techniques. Anxiety levels decreased from 7/10 to 4/10 since last session.</p>
                    <p><span className="text-[#2EC4B6] font-semibold">O:</span> Patient appeared calm, engaged, and motivated. Good eye contact maintained throughout session.</p>
                    <p><span className="text-[#2EC4B6] font-semibold">A:</span> GAD with positive response to CBT + mindfulness interventions. Progressing toward treatment goals.</p>
                    <p><span className="text-[#2EC4B6] font-semibold">P:</span> Continue weekly sessions. Assign progressive muscle relaxation exercises. Review in 2 weeks.</p>
                  </div>
                </div>

                {/* Real-time copilot insight */}
                <div className="bg-gradient-to-r from-[#1F5EFF]/20 to-[#2EC4B6]/10 border border-[#1F5EFF]/30 rounded-2xl p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Activity className="w-3.5 h-3.5 text-[#4D8EFF]" />
                    <span className="text-[11px] text-[#4D8EFF] font-medium uppercase tracking-wide">AI Copilot Insight</span>
                  </div>
                  <p className="text-white/75 text-xs leading-relaxed">Patient showing strong therapeutic alliance. Consider introducing ACT techniques next session to build on mindfulness progress.</p>
                </div>
              </div>

              <div className="px-5 pb-5">
                <p className="text-[10px] text-white/25 text-center">
                  Note generated in &lt; 60 seconds · <Link href="/privacy" className="hover:text-white/45 transition-colors">HIPAA encrypted</Link>
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom wave transition */}
      <div className="absolute bottom-0 left-0 right-0 pointer-events-none">
        <svg viewBox="0 0 1440 80" fill="none" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="none" className="w-full">
          <path d="M0 80L60 74.7C120 69.3 240 58.7 360 53.3C480 48 600 48 720 53.3C840 58.7 960 69.3 1080 74.7C1200 80 1320 80 1380 80H1440V80H0Z" fill="#F8FAFC" />
        </svg>
      </div>
    </section>
  );
}

// Reviewed: 2026-06-13 — 24Therapy audit
