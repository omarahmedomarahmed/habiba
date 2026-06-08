"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import {
  ArrowRight, Brain, Sparkles, Shield, Star, MessageSquare,
  Users, Send, ChevronRight, CheckCircle2
} from "lucide-react";
import { cn } from "@/lib/utils";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000/api/v1";
const FREE_LIMIT = 5;

const SUGGESTED = [
  "I've been feeling anxious lately",
  "I'm struggling with work stress",
  "I want to find a therapist",
  "How can AI help with therapy?",
];

const FALLBACK_RESPONSES: Record<string, string> = {
  default: "I hear you. That sounds really difficult. Would you like to talk more about what you're experiencing, or would you prefer I help connect you with a licensed therapist who specializes in this area?",
  anxious: "Anxiety can feel overwhelming, but you're not alone. Many people experience work or social anxiety. A few things that often help: deep breathing (4-7-8 technique), grounding exercises, and talking to a professional. Would you like me to match you with a therapist who specializes in anxiety today?",
  stress: "Work stress is one of the most common things people reach out about. It's worth taking seriously — chronic stress affects sleep, relationships, and physical health. I can help you find a therapist who specializes in burnout and workplace stress. Want me to show you available therapists right now?",
  therapist: "Great question! I can match you with a licensed therapist based on your needs, availability, and preferences. The process takes about 2 minutes. Would you like to start? I'll ask a few brief questions to find your best match.",
};

function getFallback(input: string): string {
  const lower = input.toLowerCase();
  if (lower.includes("anxi") || lower.includes("worry") || lower.includes("panic")) return FALLBACK_RESPONSES.anxious;
  if (lower.includes("stress") || lower.includes("work") || lower.includes("burnout")) return FALLBACK_RESPONSES.stress;
  if (lower.includes("therapist") || lower.includes("find") || lower.includes("match")) return FALLBACK_RESPONSES.therapist;
  return FALLBACK_RESPONSES.default;
}

interface Msg { role: "ai" | "user"; text: string }

const INIT: Msg = {
  role: "ai",
  text: "Hi, I'm the 24Therapy AI. I'm here to listen and support you. What's on your mind today?\n\n*I'm not a replacement for professional therapy — but I'm a good first step.*",
};

export function HeroSection() {
  const [msgs, setMsgs] = useState<Msg[]>([INIT]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [count, setCount] = useState(0);
  const [showLimit, setShowLimit] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [msgs, loading]);

  const send = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || loading) return;
    if (count >= FREE_LIMIT) { setShowLimit(true); return; }

    setInput("");
    setMsgs(prev => [...prev, { role: "user", text: trimmed }]);
    setLoading(true);
    const newCount = count + 1;
    setCount(newCount);

    try {
      const res = await fetch(`${API_URL}/ai/chat/anonymous`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: trimmed, anonymous: true }),
      });
      if (!res.ok) throw new Error("api_error");
      const json = await res.json();
      const reply = json.data?.message || json.message || getFallback(trimmed);
      setMsgs(prev => [...prev, { role: "ai", text: reply }]);
    } catch {
      setMsgs(prev => [...prev, { role: "ai", text: getFallback(trimmed) }]);
    } finally {
      setLoading(false);
      if (newCount >= FREE_LIMIT) setShowLimit(true);
    }
  };

  return (
    <section className="relative min-h-screen pt-16 overflow-hidden bg-gradient-to-br from-[#0A2342] via-[#0D2D57] to-[#102040]">
      {/* Background effects */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-[#1F5EFF]/20 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-[#2EC4B6]/15 rounded-full blur-3xl animate-pulse" style={{ animationDelay: "1.5s" }} />
        <div
          className="absolute inset-0 opacity-[0.04]"
          style={{
            backgroundImage: `radial-gradient(circle at 1px 1px, rgba(255,255,255,0.5) 1px, transparent 0)`,
            backgroundSize: "48px 48px",
          }}
        />
      </div>

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-16 pb-28">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-14 items-center">

          {/* ── Left: copy ── */}
          <div className="text-white">
            <div className="inline-flex items-center gap-2 bg-white/10 border border-white/20 rounded-full px-4 py-2 mb-8">
              <span className="w-2 h-2 bg-[#2EC4B6] rounded-full animate-pulse" />
              <span className="text-sm font-medium text-white/90">AI-Native Mental Health Platform</span>
            </div>

            <h1 className="text-5xl sm:text-6xl lg:text-[64px] font-bold leading-[1.07] mb-6 tracking-tight">
              Mental health support{" "}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#1F5EFF] to-[#2EC4B6]">
                powered by AI,
              </span>{" "}
              <span className="text-white/90">delivered by humans.</span>
            </h1>

            <p className="text-lg text-white/65 leading-relaxed mb-10 max-w-lg">
              Talk to AI right now — free, private, no account needed.
              Connect with a licensed therapist in minutes when you're ready.
            </p>

            {/* Primary CTAs */}
            <div className="flex flex-wrap gap-3 mb-10">
              <Link
                href="/signup"
                className="group inline-flex items-center gap-2 bg-[#1F5EFF] hover:bg-[#1649D4] text-white font-semibold px-7 py-3.5 rounded-2xl shadow-lg shadow-[#1F5EFF]/30 hover:shadow-xl transition-all"
              >
                Start Free Trial
                <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
              </Link>
              <Link
                href="/find-therapist"
                className="inline-flex items-center gap-2 bg-white/10 hover:bg-white/20 text-white font-semibold px-7 py-3.5 rounded-2xl border border-white/20 backdrop-blur-sm transition-all"
              >
                <Users className="w-4 h-4" />
                Find a Therapist
              </Link>
              <Link
                href="/therapist-join"
                className="inline-flex items-center gap-2 text-white/70 hover:text-white font-medium px-5 py-3.5 rounded-2xl border border-white/10 hover:border-white/20 transition-all"
              >
                <Brain className="w-4 h-4" />
                I&apos;m a Therapist
              </Link>
            </div>

            {/* Trust signals */}
            <div className="flex flex-wrap items-center gap-6">
              <div className="flex -space-x-2">
                {[180, 220, 260, 300, 340].map((hue, i) => (
                  <div
                    key={i}
                    className="w-9 h-9 rounded-full border-2 border-[#0A2342]"
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
                <p className="text-xs text-white/55">Trusted by 500+ therapists</p>
              </div>
              <div className="flex items-center gap-1.5 text-white/55 text-sm">
                <Shield className="w-4 h-4 text-green-400" />
                HIPAA Compliant
              </div>
            </div>
          </div>

          {/* ── Right: live chat widget ── */}
          <div className="relative">
            <div className="bg-white/[0.08] backdrop-blur-xl rounded-3xl border border-white/20 overflow-hidden shadow-2xl">

              {/* Header */}
              <div className="flex items-center gap-3 px-5 py-4 border-b border-white/10 bg-white/[0.05]">
                <div className="w-9 h-9 bg-gradient-to-br from-[#1F5EFF] to-[#2EC4B6] rounded-xl flex items-center justify-center flex-shrink-0">
                  <Brain className="w-5 h-5 text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-white text-sm">24Therapy AI</p>
                  <div className="flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse" />
                    <span className="text-xs text-white/50">Always available · Private</span>
                  </div>
                </div>
                <span className="text-[10px] text-white/40 bg-white/10 px-2 py-1 rounded-lg leading-tight text-right hidden sm:block">
                  Not a replacement<br />for professional therapy
                </span>
              </div>

              {/* Messages */}
              <div className="p-5 space-y-3 h-[300px] overflow-y-auto scrollbar-thin">
                {msgs.map((m, i) => (
                  <div key={i} className={cn("flex gap-2.5", m.role === "user" ? "justify-end" : "justify-start")}>
                    {m.role === "ai" && (
                      <div className="w-7 h-7 bg-gradient-to-br from-[#1F5EFF] to-[#2EC4B6] rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5">
                        <Sparkles className="w-3.5 h-3.5 text-white" />
                      </div>
                    )}
                    <div className={cn(
                      "max-w-[82%] px-4 py-2.5 rounded-2xl text-sm leading-relaxed whitespace-pre-line",
                      m.role === "ai"
                        ? "bg-white/12 text-white/90 rounded-tl-sm"
                        : "bg-[#1F5EFF] text-white rounded-tr-sm"
                    )}>
                      {m.text.replace(/\*([^*]+)\*/g, "$1")}
                    </div>
                  </div>
                ))}

                {loading && (
                  <div className="flex gap-2.5 items-end">
                    <div className="w-7 h-7 bg-gradient-to-br from-[#1F5EFF] to-[#2EC4B6] rounded-lg flex items-center justify-center flex-shrink-0">
                      <Sparkles className="w-3.5 h-3.5 text-white" />
                    </div>
                    <div className="bg-white/12 rounded-2xl rounded-tl-sm px-4 py-3">
                      <div className="flex gap-1">
                        {[0, 0.15, 0.3].map((d, i) => (
                          <div key={i} className="w-1.5 h-1.5 bg-white/50 rounded-full animate-bounce" style={{ animationDelay: `${d}s` }} />
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {showLimit && (
                  <div className="bg-white/10 border border-white/20 rounded-2xl p-4 text-center">
                    <p className="text-white/80 text-sm font-medium mb-3">
                      You&apos;ve used your {FREE_LIMIT} free messages.
                    </p>
                    <Link
                      href="/signup"
                      className="inline-flex items-center gap-2 bg-[#1F5EFF] hover:bg-[#1649D4] text-white font-semibold text-sm px-5 py-2.5 rounded-xl transition-colors"
                    >
                      <Sparkles className="w-4 h-4" />
                      Create Free Account
                    </Link>
                  </div>
                )}

                <div ref={bottomRef} />
              </div>

              {/* Suggested prompts */}
              {msgs.length <= 1 && !loading && (
                <div className="px-5 pb-3 flex flex-wrap gap-2">
                  {SUGGESTED.map((s) => (
                    <button
                      key={s}
                      onClick={() => send(s)}
                      className="text-xs text-white/65 hover:text-white bg-white/8 hover:bg-white/15 border border-white/15 rounded-xl px-3 py-1.5 transition-colors text-left"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              )}

              {/* Input */}
              <div className="px-5 pb-5">
                <div className="flex items-center gap-2 bg-white/10 border border-white/20 rounded-2xl px-4 py-2.5">
                  <MessageSquare className="w-4 h-4 text-white/40 flex-shrink-0" />
                  <input
                    ref={inputRef}
                    type="text"
                    value={input}
                    onChange={e => setInput(e.target.value)}
                    onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(input); }}}
                    placeholder="Share what's on your mind…"
                    className="flex-1 bg-transparent text-white placeholder-white/35 text-sm focus:outline-none min-w-0"
                    disabled={showLimit || loading}
                  />
                  <button
                    onClick={() => send(input)}
                    disabled={!input.trim() || loading || showLimit}
                    className="w-8 h-8 bg-[#1F5EFF] hover:bg-[#1649D4] disabled:bg-white/10 rounded-xl flex items-center justify-center transition-colors flex-shrink-0"
                    aria-label="Send message"
                  >
                    <Send className="w-3.5 h-3.5 text-white" />
                  </button>
                </div>
                <p className="text-[10px] text-white/30 mt-2 text-center">
                  {showLimit ? "" : `${FREE_LIMIT - count} free messages remaining · `}
                  <Link href="/privacy" className="hover:text-white/50 transition-colors">Private & encrypted</Link>
                </p>
              </div>
            </div>

            {/* Floating proof chips */}
            <div className="absolute -left-6 top-1/3 bg-white rounded-2xl shadow-xl p-3.5 hidden xl:flex items-center gap-3 border border-slate-100">
              <div className="w-9 h-9 bg-blue-50 rounded-xl flex items-center justify-center">
                <CheckCircle2 className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <p className="text-[10px] text-slate-500 leading-none mb-0.5">Avg. note time</p>
                <p className="font-bold text-slate-900 text-sm">{"< 60 sec"}</p>
              </div>
            </div>

            <div className="absolute -right-4 bottom-1/3 bg-white rounded-2xl shadow-xl p-3.5 hidden xl:flex items-center gap-3 border border-slate-100">
              <div className="w-9 h-9 bg-green-50 rounded-xl flex items-center justify-center">
                <Users className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <p className="text-[10px] text-slate-500 leading-none mb-0.5">Therapist match</p>
                <p className="font-bold text-slate-900 text-sm">{"< 5 min"}</p>
              </div>
            </div>
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
