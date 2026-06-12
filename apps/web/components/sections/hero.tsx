"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  ArrowRight, Brain, Sparkles, Shield, Star, MessageSquare,
  Users, Send, CheckCircle2, Zap, Lock
} from "lucide-react";
import { cn } from "@/lib/utils";

import { getApiUrl } from '@/lib/env';

const API_URL = getApiUrl();
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
  text: "Hi, I'm the 24Therapy AI. I'm here to listen and support you. What's on your mind today?\n\nI'm not a replacement for professional therapy — but I'm a good first step.",
};

export function HeroSection() {
  const [msgs, setMsgs] = useState<Msg[]>([INIT]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [count, setCount] = useState(0);
  const [showLimit, setShowLimit] = useState(false);
  // Ref to the scrollable chat CONTAINER (not the document)
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Scroll ONLY within the chat container — never jumps the page
  const scrollChatToBottom = useCallback(() => {
    const container = chatContainerRef.current;
    if (!container) return;
    // Use scrollTop on the container itself — no page-level scrollIntoView
    container.scrollTop = container.scrollHeight;
  }, []);

  useEffect(() => {
    // Small delay to let the DOM update before scrolling
    const raf = requestAnimationFrame(scrollChatToBottom);
    return () => cancelAnimationFrame(raf);
  }, [msgs, loading, scrollChatToBottom]);

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
              Talk to AI right now — free, private, no account needed.
              Connect with a licensed therapist in minutes when you&apos;re ready.
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

          {/* ── RIGHT: live chat widget ── */}
          <div className="order-1 lg:order-2">
            {/* Glow halo behind card */}
            <div className="absolute inset-0 rounded-3xl bg-gradient-to-br from-[#1F5EFF]/20 to-[#2EC4B6]/10 blur-2xl scale-95 pointer-events-none" aria-hidden />

            <div className="relative bg-white/[0.07] backdrop-blur-2xl rounded-3xl border border-white/15 overflow-hidden shadow-2xl shadow-black/40 ring-1 ring-white/5">

              {/* Card header */}
              <div className="flex items-center gap-3 px-5 py-4 border-b border-white/10 bg-gradient-to-r from-white/[0.05] to-transparent">
                <div className="w-10 h-10 bg-gradient-to-br from-[#1F5EFF] to-[#2EC4B6] rounded-xl flex items-center justify-center flex-shrink-0 shadow-lg shadow-[#1F5EFF]/30">
                  <Brain className="w-5 h-5 text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-white text-sm">24Therapy AI</p>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse" />
                    <span className="text-xs text-white/45">Always available · Private</span>
                  </div>
                </div>
                <div className="text-[10px] text-white/35 bg-white/8 px-2.5 py-1.5 rounded-lg leading-tight text-right hidden sm:block border border-white/10">
                  Not a replacement<br />for professional therapy
                </div>
              </div>

              {/* Messages — scrolls internally, never moves the page */}
              <div
                ref={chatContainerRef}
                className="px-5 pt-4 pb-3 space-y-3.5 h-[280px] overflow-y-auto scroll-smooth"
                style={{ scrollbarWidth: "thin", scrollbarColor: "rgba(255,255,255,0.12) transparent" }}
              >
                {msgs.map((m, i) => (
                  <div key={i} className={cn("flex gap-2.5", m.role === "user" ? "justify-end" : "justify-start")}>
                    {m.role === "ai" && (
                      <div className="w-7 h-7 bg-gradient-to-br from-[#1F5EFF] to-[#2EC4B6] rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5 shadow-md shadow-[#1F5EFF]/20">
                        <Sparkles className="w-3.5 h-3.5 text-white" />
                      </div>
                    )}
                    <div className={cn(
                      "max-w-[82%] px-4 py-2.5 rounded-2xl text-sm leading-relaxed whitespace-pre-line",
                      m.role === "ai"
                        ? "bg-white/10 text-white/90 rounded-tl-sm border border-white/8"
                        : "bg-gradient-to-br from-[#1F5EFF] to-[#1649D4] text-white rounded-tr-sm shadow-md shadow-[#1F5EFF]/20"
                    )}>
                      {m.text}
                    </div>
                  </div>
                ))}

                {loading && (
                  <div className="flex gap-2.5 items-end">
                    <div className="w-7 h-7 bg-gradient-to-br from-[#1F5EFF] to-[#2EC4B6] rounded-lg flex items-center justify-center flex-shrink-0">
                      <Sparkles className="w-3.5 h-3.5 text-white" />
                    </div>
                    <div className="bg-white/10 border border-white/8 rounded-2xl rounded-tl-sm px-4 py-3">
                      <div className="flex gap-1">
                        {[0, 0.15, 0.3].map((d, i) => (
                          <div key={i} className="w-1.5 h-1.5 bg-white/50 rounded-full animate-bounce" style={{ animationDelay: `${d}s` }} />
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {showLimit && (
                  <div className="bg-white/8 border border-white/15 rounded-2xl p-4 text-center">
                    <p className="text-white/75 text-sm font-medium mb-3">
                      You&apos;ve used your {FREE_LIMIT} free messages.
                    </p>
                    <Link
                      href="/signup"
                      className="inline-flex items-center gap-2 bg-[#1F5EFF] hover:bg-[#1649D4] text-white font-semibold text-sm px-5 py-2.5 rounded-xl transition-colors shadow-lg shadow-[#1F5EFF]/30"
                    >
                      <Sparkles className="w-4 h-4" />
                      Create Free Account
                    </Link>
                  </div>
                )}

                {/* Sentinel div — used as scroll target (not scrollIntoView) */}
                <div ref={bottomRef} className="h-1" />
              </div>

              {/* Suggested prompts */}
              {msgs.length <= 1 && !loading && (
                <div className="px-5 pb-3 flex flex-wrap gap-2">
                  {SUGGESTED.map((s) => (
                    <button
                      key={s}
                      onClick={() => send(s)}
                      className="text-xs text-white/60 hover:text-white bg-white/6 hover:bg-white/12 border border-white/12 hover:border-white/20 rounded-xl px-3 py-1.5 transition-all duration-150 text-left"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              )}

              {/* Input row */}
              <div className="px-5 pb-5">
                <div className="flex items-center gap-2 bg-white/8 border border-white/15 rounded-2xl px-4 py-2.5 focus-within:border-white/30 focus-within:bg-white/12 transition-all">
                  <MessageSquare className="w-4 h-4 text-white/35 flex-shrink-0" />
                  <input
                    ref={inputRef}
                    type="text"
                    value={input}
                    onChange={e => setInput(e.target.value)}
                    onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(input); } }}
                    placeholder="Share what's on your mind…"
                    className="flex-1 bg-transparent text-white placeholder-white/30 text-sm focus:outline-none min-w-0"
                    disabled={showLimit || loading}
                  />
                  <button
                    onClick={() => send(input)}
                    disabled={!input.trim() || loading || showLimit}
                    className="w-8 h-8 bg-[#1F5EFF] hover:bg-[#1649D4] disabled:bg-white/8 disabled:cursor-not-allowed rounded-xl flex items-center justify-center transition-colors flex-shrink-0 shadow-md shadow-[#1F5EFF]/20"
                    aria-label="Send message"
                  >
                    <Send className="w-3.5 h-3.5 text-white" />
                  </button>
                </div>
                <p className="text-[10px] text-white/25 mt-2 text-center">
                  {!showLimit && `${FREE_LIMIT - count} free messages remaining · `}
                  <Link href="/privacy" className="hover:text-white/45 transition-colors">Private & encrypted</Link>
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
