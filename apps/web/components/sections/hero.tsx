"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight, Brain, Sparkles, Shield, Clock, Star, Play, MessageSquare, Users, Zap } from "lucide-react";
import { cn } from "@/lib/utils";

const aiResponses = [
  { role: "ai", content: "Hello! I'm the 24Therapy AI. How are you feeling today?" },
  { role: "user", content: "I've been feeling anxious lately, especially about work." },
  { role: "ai", content: "I understand. Work-related anxiety is very common. What specifically has been triggering these feelings?" },
  { role: "user", content: "Deadlines and performance reviews mostly." },
  { role: "ai", content: "That makes a lot of sense. Would you like to connect with a licensed therapist who specializes in work-related anxiety? I can match you with someone available today." },
];

export function HeroSection() {
  const [chatVisible, setChatVisible] = useState(true);
  const [chatIndex, setChatIndex] = useState(aiResponses.length);

  return (
    <section className="relative min-h-screen pt-16 overflow-hidden bg-gradient-to-br from-[#0A2342] via-[#0D2D57] to-[#102040]">
      {/* Background effects */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-[#1F5EFF]/20 rounded-full blur-3xl animate-pulse-slow" />
        <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-[#24C8DB]/15 rounded-full blur-3xl animate-pulse-slow" style={{ animationDelay: '1s' }} />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-gradient-radial from-white/5 to-transparent rounded-full" />
        
        {/* Grid pattern */}
        <div className="absolute inset-0 opacity-5"
          style={{
            backgroundImage: `radial-gradient(circle at 1px 1px, rgba(255,255,255,0.3) 1px, transparent 0)`,
            backgroundSize: '40px 40px',
          }}
        />
      </div>

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-20 pb-24">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
          {/* Left: Content */}
          <div className="text-white">
            {/* Badge */}
            <div className="inline-flex items-center gap-2 bg-white/10 border border-white/20 rounded-full px-4 py-2 mb-8">
              <span className="w-2 h-2 bg-[#24C8DB] rounded-full animate-pulse" />
              <span className="text-sm font-medium text-white/90">
                AI-Native Mental Health Operating System
              </span>
            </div>

            {/* Headline */}
            <h1 className="text-5xl sm:text-6xl lg:text-7xl font-bold leading-[1.05] mb-6">
              Mental Health Support{" "}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#1F5EFF] to-[#24C8DB]">
                Powered by AI.
              </span>{" "}
              <span className="text-white/90">Delivered by Humans.</span>
            </h1>

            <p className="text-xl text-white/70 leading-relaxed mb-10 max-w-xl">
              Chat instantly with AI. Connect with licensed therapists in minutes. 
              Let AI handle documentation while therapists focus on what matters — helping people.
            </p>

            {/* CTAs */}
            <div className="flex flex-wrap gap-4 mb-12">
              <Link
                href="/signup"
                className="group inline-flex items-center gap-2 bg-[#1F5EFF] hover:bg-[#1649D4] text-white font-semibold px-8 py-4 rounded-2xl shadow-lg shadow-[#1F5EFF]/30 hover:shadow-xl hover:shadow-[#1F5EFF]/40 transition-all"
              >
                Start Free Today
                <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </Link>
              <Link
                href="/find-therapist"
                className="inline-flex items-center gap-2 bg-white/10 hover:bg-white/20 text-white font-semibold px-8 py-4 rounded-2xl border border-white/20 backdrop-blur-sm transition-all"
              >
                <Users className="w-5 h-5" />
                Find a Therapist
              </Link>
              <Link
                href="/therapist-join"
                className="inline-flex items-center gap-2 bg-transparent hover:bg-white/5 text-white/80 hover:text-white font-medium px-6 py-4 rounded-2xl border border-white/10 transition-all"
              >
                <Brain className="w-4 h-4" />
                I'm a Therapist
              </Link>
            </div>

            {/* Social proof */}
            <div className="flex flex-wrap items-center gap-8">
              <div className="flex -space-x-2">
                {[...Array(5)].map((_, i) => (
                  <div
                    key={i}
                    className="w-9 h-9 rounded-full bg-gradient-to-br border-2 border-[#0A2342]"
                    style={{
                      background: `linear-gradient(135deg, hsl(${i * 40 + 180}deg 70% 60%), hsl(${i * 40 + 220}deg 70% 40%))`,
                    }}
                  />
                ))}
              </div>
              <div>
                <div className="flex items-center gap-1 mb-1">
                  {[...Array(5)].map((_, i) => (
                    <Star key={i} className="w-4 h-4 fill-[#F59E0B] text-[#F59E0B]" />
                  ))}
                  <span className="text-white/90 font-semibold ml-1">4.9</span>
                </div>
                <p className="text-sm text-white/60">Trusted by 500+ therapists</p>
              </div>
              <div className="flex items-center gap-2 text-white/60 text-sm">
                <Shield className="w-4 h-4 text-green-400" />
                HIPAA Compliant
              </div>
            </div>
          </div>

          {/* Right: AI Chat Demo */}
          <div className="relative">
            <div className="bg-white/10 backdrop-blur-xl rounded-3xl border border-white/20 overflow-hidden shadow-2xl">
              {/* Chat header */}
              <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 bg-white/5">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 bg-gradient-to-br from-[#1F5EFF] to-[#24C8DB] rounded-xl flex items-center justify-center">
                    <Brain className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <p className="font-semibold text-white text-sm">24Therapy AI</p>
                    <div className="flex items-center gap-1">
                      <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
                      <span className="text-xs text-white/60">Online — Always available</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-white/50 bg-white/10 px-2 py-1 rounded-lg">
                    Not a replacement for therapy
                  </span>
                </div>
              </div>

              {/* Chat messages */}
              <div className="p-6 space-y-4 min-h-[320px]">
                {aiResponses.slice(0, chatIndex).map((msg, i) => (
                  <div
                    key={i}
                    className={cn(
                      "flex animate-fade-in",
                      msg.role === "user" ? "justify-end" : "justify-start"
                    )}
                  >
                    {msg.role === "ai" && (
                      <div className="w-8 h-8 bg-gradient-to-br from-[#1F5EFF] to-[#24C8DB] rounded-xl flex items-center justify-center mr-3 mt-1 flex-shrink-0">
                        <Sparkles className="w-4 h-4 text-white" />
                      </div>
                    )}
                    <div
                      className={cn(
                        "max-w-[85%] px-4 py-3 rounded-2xl text-sm",
                        msg.role === "ai"
                          ? "bg-white/15 text-white rounded-tl-sm"
                          : "bg-[#1F5EFF] text-white rounded-tr-sm"
                      )}
                    >
                      {msg.content}
                    </div>
                  </div>
                ))}

                {/* Typing indicator */}
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-gradient-to-br from-[#1F5EFF] to-[#24C8DB] rounded-xl flex items-center justify-center">
                    <Sparkles className="w-4 h-4 text-white" />
                  </div>
                  <div className="bg-white/15 rounded-2xl rounded-tl-sm px-4 py-3">
                    <div className="flex gap-1">
                      {[0, 1, 2].map((i) => (
                        <div
                          key={i}
                          className="w-2 h-2 bg-white/60 rounded-full animate-bounce"
                          style={{ animationDelay: `${i * 0.15}s` }}
                        />
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Input */}
              <div className="px-6 pb-6">
                <div className="flex items-center gap-3 bg-white/10 rounded-2xl border border-white/20 px-4 py-3">
                  <MessageSquare className="w-4 h-4 text-white/50" />
                  <span className="text-white/40 text-sm flex-1">
                    How are you feeling today?
                  </span>
                  <Link
                    href="/chat"
                    className="bg-[#1F5EFF] text-white text-xs font-semibold px-3 py-1.5 rounded-xl hover:bg-[#1649D4] transition-colors"
                  >
                    Start Chat
                  </Link>
                </div>
              </div>
            </div>

            {/* Floating stats */}
            <div className="absolute -left-8 top-1/4 bg-white rounded-2xl shadow-xl p-4 hidden xl:flex items-center gap-3 border border-slate-100">
              <div className="w-10 h-10 bg-green-100 rounded-xl flex items-center justify-center">
                <Clock className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <p className="text-xs text-slate-500">Avg wait time</p>
                <p className="font-bold text-slate-900">{"< 5 min"}</p>
              </div>
            </div>

            <div className="absolute -right-4 bottom-1/4 bg-white rounded-2xl shadow-xl p-4 hidden xl:flex items-center gap-3 border border-slate-100">
              <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center">
                <Zap className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <p className="text-xs text-slate-500">Notes saved</p>
                <p className="font-bold text-slate-900">90% faster</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Wave bottom */}
      <div className="absolute bottom-0 left-0 right-0">
        <svg viewBox="0 0 1440 80" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M0 80L60 74.7C120 69.3 240 58.7 360 53.3C480 48 600 48 720 53.3C840 58.7 960 69.3 1080 74.7C1200 80 1320 80 1380 80H1440V80H0Z" fill="#F8FAFC" />
        </svg>
      </div>
    </section>
  );
}
