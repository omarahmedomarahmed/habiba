"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowRight, Brain, Shield, Users, Search, ChevronDown,
  Zap, Lock, FileText
} from "lucide-react";
import { HeroTherapistPreview } from "@/components/marketing/HeroTherapistPreview";

const SPECIALTIES = [
  "Any specialty",
  "Anxiety",
  "Depression",
  "Trauma / PTSD",
  "OCD",
  "ADHD",
  "Grief & Loss",
  "Relationships",
  "Bipolar Disorder",
  "LGBTQ+",
  "Addiction",
  "Work Stress",
];

export function HeroSection() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [specialty, setSpecialty] = useState("");

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    const params = new URLSearchParams();
    if (query.trim()) params.set("q", query.trim());
    if (specialty && specialty !== "Any specialty") params.set("specialty", specialty);
    router.push(`/find-therapist${params.toString() ? `?${params}` : ""}`);
  }

  return (
    <section className="relative min-h-screen pt-16 overflow-hidden bg-gradient-to-br from-[#071A33] via-[#0A2342] to-[#0D2A4A]">
      {/* Background ambient effects */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-32 -left-32 w-[600px] h-[600px] bg-[#1F5EFF]/10 rounded-full blur-[120px] animate-[pulse_5s_ease-in-out_infinite]" />
        <div className="absolute -bottom-32 -right-32 w-[500px] h-[500px] bg-[#2EC4B6]/10 rounded-full blur-[100px] animate-[pulse_7s_ease-in-out_infinite_1s]" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[400px] bg-[#1F5EFF]/5 rounded-full blur-[80px] animate-[pulse_6s_ease-in-out_infinite_3s]" />
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage: `radial-gradient(circle at 1px 1px, rgba(255,255,255,0.8) 1px, transparent 0)`,
            backgroundSize: "40px 40px",
          }}
        />
      </div>

      <div className="relative max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pt-20 pb-32">

        {/* Badge */}
        <div className="flex justify-center mb-8">
          <div className="inline-flex items-center gap-2.5 bg-white/8 border border-white/15 rounded-full px-4 py-2 backdrop-blur-sm">
            <span className="w-2 h-2 bg-[#2EC4B6] rounded-full animate-pulse" />
            <span className="text-sm font-medium text-white/85">AI-Native Therapy Platform</span>
            <span className="text-white/30">·</span>
            <span className="text-sm text-white/55">HIPAA Compliant</span>
          </div>
        </div>

        {/* Headline */}
        <div className="text-center mb-6">
          <h1 className="text-5xl sm:text-6xl lg:text-[64px] font-bold leading-[1.08] tracking-tight text-white">
            Find a therapist.{" "}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#4D8EFF] via-[#2EC4B6] to-[#4D8EFF] bg-[length:200%_auto] animate-gradient">
              Start today.
            </span>
          </h1>
          <p className="mt-5 text-lg text-white/60 leading-relaxed max-w-2xl mx-auto">
            Browse licensed therapists, book a session with a single link — no account needed.
            AI generates session notes in under 60 seconds so your therapist can focus on you.
          </p>
        </div>

        {/* Primary CTAs */}
        <div className="flex flex-wrap justify-center gap-3 mb-10">
          <Link
            href="/find-therapist"
            className="group inline-flex items-center gap-2.5 bg-[#2EC4B6] hover:bg-[#26b0a2] text-white font-semibold px-7 py-3.5 rounded-2xl shadow-lg shadow-[#2EC4B6]/30 hover:-translate-y-0.5 transition-all duration-200"
          >
            <Users className="w-4 h-4" />
            Find a Therapist
            <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform duration-200" />
          </Link>
          <Link
            href="/signup?role=therapist"
            className="inline-flex items-center gap-2 bg-white/8 hover:bg-white/15 text-white font-semibold px-7 py-3.5 rounded-2xl border border-white/15 backdrop-blur-sm hover:-translate-y-0.5 transition-all duration-200"
          >
            <Brain className="w-4 h-4" />
            Join as a Therapist
          </Link>
        </div>

        {/* Search bar */}
        <form onSubmit={handleSearch} className="max-w-2xl mx-auto mb-4">
          <div className="flex gap-2 bg-white/10 backdrop-blur-md border border-white/20 rounded-2xl p-2 shadow-xl shadow-black/20">
            <div className="flex-1 flex items-center gap-2 px-3">
              <Search className="w-4 h-4 text-white/40 flex-shrink-0" />
              <input
                type="text"
                placeholder="Search by name, specialty, or approach..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="flex-1 bg-transparent text-white text-sm placeholder-white/35 focus:outline-none"
              />
            </div>
            <div className="relative flex items-center">
              <select
                value={specialty}
                onChange={(e) => setSpecialty(e.target.value)}
                className="appearance-none bg-white/10 hover:bg-white/15 border border-white/15 text-white/75 text-sm rounded-xl pl-3 pr-8 py-2 focus:outline-none focus:border-[#2EC4B6]/50 transition-colors cursor-pointer"
              >
                {SPECIALTIES.map((s) => (
                  <option key={s} value={s === "Any specialty" ? "" : s} className="bg-[#0A2342] text-white">
                    {s}
                  </option>
                ))}
              </select>
              <ChevronDown className="w-3.5 h-3.5 text-white/40 absolute right-2.5 pointer-events-none" />
            </div>
            <button
              type="submit"
              className="bg-[#1F5EFF] hover:bg-[#1649D4] text-white font-semibold px-5 py-2.5 rounded-xl text-sm transition-colors flex-shrink-0"
            >
              Search
            </button>
          </div>
        </form>

        <p className="text-center text-xs text-white/30 mb-10">
          Every therapist is licensed, identity-verified, and HIPAA-compliant
        </p>

        {/* Live therapist preview */}
        <HeroTherapistPreview />

        {/* Trust bar */}
        <div className="mt-12 pt-8 border-t border-white/8 flex flex-wrap justify-center items-center gap-8">
          <div className="flex items-center gap-2 text-white/45 text-sm">
            <Shield className="w-4 h-4 text-green-400/80" />
            HIPAA Compliant
          </div>
          <div className="flex items-center gap-2 text-white/45 text-sm">
            <Lock className="w-4 h-4 text-emerald-400/80" />
            AES-256 Encrypted
          </div>
          <div className="flex items-center gap-2 text-white/45 text-sm">
            <Zap className="w-4 h-4 text-[#2EC4B6]/80" />
            Notes in &lt; 60 seconds
          </div>
          <div className="flex items-center gap-2 text-white/45 text-sm">
            <FileText className="w-4 h-4 text-[#4D8EFF]/80" />
            No account needed to join
          </div>
        </div>
      </div>

      {/* Bottom wave */}
      <div className="absolute bottom-0 left-0 right-0 pointer-events-none">
        <svg viewBox="0 0 1440 80" fill="none" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="none" className="w-full">
          <path d="M0 80L60 74.7C120 69.3 240 58.7 360 53.3C480 48 600 48 720 53.3C840 58.7 960 69.3 1080 74.7C1200 80 1320 80 1380 80H1440V80H0Z" fill="#F8FAFC" />
        </svg>
      </div>
    </section>
  );
}
