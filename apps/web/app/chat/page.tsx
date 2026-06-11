"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import {
  Brain, Sparkles, Send, ArrowRight, Shield, Users,
  AlertTriangle, X, ChevronDown, MessageSquare
} from "lucide-react";
import { cn } from "@/lib/utils";

import { getApiUrl } from '@/lib/env';

const API_URL = getApiUrl();

interface Message {
  id: string;
  role: "ai" | "user";
  content: string;
  timestamp: Date;
}

const INITIAL_MESSAGE: Message = {
  id: "init",
  role: "ai",
  content:
    "Hi! I'm the 24Therapy AI. I'm here to listen and provide supportive guidance. What's on your mind today?\n\n*Note: I'm an AI assistant, not a replacement for professional therapy. If you're in crisis, please call 988.*",
  timestamp: new Date(),
};

const SUGGESTED_PROMPTS = [
  "I've been feeling anxious lately",
  "I'm struggling with stress at work",
  "I want to find a therapist",
  "I'm having trouble sleeping",
];

export default function ChatPage() {
  const [messages, setMessages] = useState<Message[]>([INITIAL_MESSAGE]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [showUpgrade, setShowUpgrade] = useState(false);
  const [messageCount, setMessageCount] = useState(0);
  const [showCrisisBar, setShowCrisisBar] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const FREE_MESSAGE_LIMIT = 5;

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const addMessage = (role: "ai" | "user", content: string) => {
    setMessages((prev) => [
      ...prev,
      { id: crypto.randomUUID(), role, content, timestamp: new Date() },
    ]);
  };

  const detectCrisis = (text: string) => {
    const crisisKeywords = [
      "suicide", "kill myself", "end my life", "hurt myself", "self-harm",
      "don't want to live", "want to die", "hopeless", "no reason to live"
    ];
    return crisisKeywords.some((kw) => text.toLowerCase().includes(kw));
  };

  const sendMessage = async () => {
    const trimmed = input.trim();
    if (!trimmed || loading) return;

    // Check free message limit
    if (messageCount >= FREE_MESSAGE_LIMIT) {
      setShowUpgrade(true);
      return;
    }

    // Crisis detection
    if (detectCrisis(trimmed)) {
      setShowCrisisBar(true);
    }

    addMessage("user", trimmed);
    setInput("");
    setMessageCount((c) => c + 1);
    setLoading(true);

    try {
      const res = await fetch(`${API_URL}/ai/chat/anonymous`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: trimmed,
          history: messages.slice(-6).map((m) => ({
            role: m.role === "ai" ? "assistant" : "user",
            content: m.content,
          })),
        }),
      });

      if (!res.ok) throw new Error("API error");

      const json = await res.json();
      const reply =
        json.data?.reply ||
        json.reply ||
        getFallbackReply(trimmed);
      addMessage("ai", reply);
    } catch {
      addMessage(
        "ai",
        getFallbackReply(trimmed)
      );
    } finally {
      setLoading(false);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  };

  const getFallbackReply = (userMsg: string): string => {
    const lower = userMsg.toLowerCase();
    if (lower.includes("anxious") || lower.includes("anxiety"))
      return "Anxiety can be really challenging. Many people experience this. Can you tell me more about when these feelings tend to be strongest — is it at certain times of day or in specific situations?";
    if (lower.includes("depress") || lower.includes("sad") || lower.includes("hopeless"))
      return "I hear you, and I'm glad you're talking about this. These feelings matter. Would it help to explore what's been contributing to how you're feeling lately?";
    if (lower.includes("sleep") || lower.includes("insomnia"))
      return "Sleep difficulties often connect to other stressors. How long have you been struggling with sleep, and do you notice any patterns around what makes it harder?";
    if (lower.includes("work") || lower.includes("stress"))
      return "Work-related stress is incredibly common and can affect every area of life. What aspect feels most overwhelming right now?";
    if (lower.includes("therapist") || lower.includes("therapy"))
      return "Finding the right therapist can make a real difference. I can help match you with a licensed professional who specializes in what you're going through. Would you like me to help with that?";
    return "Thank you for sharing that with me. It sounds like you're dealing with a lot. Can you tell me more about what's been on your mind most recently?";
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <div className="flex flex-col h-screen bg-[#F8FAFC]">
      {/* Crisis bar */}
      {showCrisisBar && (
        <div className="bg-red-600 text-white px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>
              <strong>If you&apos;re in crisis, please call or text 988</strong> (Suicide &amp; Crisis Lifeline) immediately.
            </span>
          </div>
          <button onClick={() => setShowCrisisBar(false)} className="shrink-0 ml-4">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Header */}
      <header className="bg-white border-b border-slate-100 px-4 py-3 flex items-center justify-between shadow-sm">
        <Link href="/" className="flex items-center gap-2">
          <div className="w-8 h-8 bg-gradient-to-br from-[#0A2342] to-[#1F5EFF] rounded-lg flex items-center justify-center">
            <Brain className="w-4 h-4 text-white" />
          </div>
          <span className="font-bold text-[#0A2342] text-sm">
            24Therapy<span className="text-[#1F5EFF]">.ai</span>
          </span>
        </Link>

        <div className="flex items-center gap-2 text-xs text-slate-500">
          <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
          AI available 24/7
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-400 hidden sm:block">
            {FREE_MESSAGE_LIMIT - messageCount > 0
              ? `${FREE_MESSAGE_LIMIT - messageCount} free messages left`
              : "Free limit reached"}
          </span>
          <Link
            href="/signup"
            className="text-xs font-semibold text-white bg-[#1F5EFF] px-3 py-1.5 rounded-lg hover:bg-[#0A2342] transition-colors"
          >
            Sign Up Free
          </Link>
        </div>
      </header>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-6 space-y-4 max-w-3xl mx-auto w-full">
        {/* Disclaimer */}
        <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-2xl p-3 text-xs text-amber-800">
          <Shield className="w-4 h-4 shrink-0 mt-0.5 text-amber-600" />
          <span>
            This AI provides supportive guidance only. For professional mental health care,{" "}
            <Link href="/find-therapist" className="underline font-semibold">find a licensed therapist</Link>.
            Not for emergencies — call <strong>988</strong> if in crisis.
          </span>
        </div>

        {messages.map((msg) => (
          <div
            key={msg.id}
            className={cn("flex", msg.role === "user" ? "justify-end" : "justify-start")}
          >
            {msg.role === "ai" && (
              <div className="w-8 h-8 bg-gradient-to-br from-[#1F5EFF] to-[#24C8DB] rounded-xl flex items-center justify-center mr-3 mt-1 shrink-0">
                <Sparkles className="w-4 h-4 text-white" />
              </div>
            )}
            <div
              className={cn(
                "max-w-[80%] sm:max-w-[70%] px-4 py-3 rounded-2xl text-sm leading-relaxed",
                msg.role === "ai"
                  ? "bg-white border border-slate-200 text-slate-800 rounded-tl-sm shadow-sm"
                  : "bg-[#1F5EFF] text-white rounded-tr-sm"
              )}
            >
              {msg.content.split("\n").map((line, i) => (
                <p key={i} className={i > 0 ? "mt-1" : ""}>
                  {line}
                </p>
              ))}
              <p className={cn(
                "text-xs mt-1.5",
                msg.role === "ai" ? "text-slate-400" : "text-white/60"
              )}>
                {msg.timestamp.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
              </p>
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex justify-start">
            <div className="w-8 h-8 bg-gradient-to-br from-[#1F5EFF] to-[#24C8DB] rounded-xl flex items-center justify-center mr-3 mt-1 shrink-0">
              <Sparkles className="w-4 h-4 text-white" />
            </div>
            <div className="bg-white border border-slate-200 rounded-2xl rounded-tl-sm px-4 py-3 shadow-sm">
              <div className="flex gap-1.5">
                {[0, 1, 2].map((i) => (
                  <div
                    key={i}
                    className="w-2 h-2 bg-slate-400 rounded-full animate-bounce"
                    style={{ animationDelay: `${i * 0.15}s` }}
                  />
                ))}
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Upgrade prompt */}
      {showUpgrade && (
        <div className="border-t border-slate-200 bg-white px-4 py-5">
          <div className="max-w-3xl mx-auto">
            <div className="bg-gradient-to-r from-[#0A2342] to-[#1E4F8C] rounded-2xl p-5 text-white text-center">
              <Sparkles className="w-8 h-8 mx-auto mb-3 text-[#2EC4B6]" />
              <h3 className="font-bold text-lg mb-1">Continue Your Journey</h3>
              <p className="text-white/70 text-sm mb-4">
                Sign up free to get unlimited AI support and connect with a licensed therapist.
              </p>
              <div className="flex gap-3 justify-center flex-wrap">
                <Link
                  href="/signup"
                  className="inline-flex items-center gap-2 bg-[#1F5EFF] text-white font-semibold px-5 py-2.5 rounded-xl hover:bg-white hover:text-[#1F5EFF] transition-all text-sm"
                >
                  <Sparkles className="w-4 h-4" />
                  Sign Up Free
                </Link>
                <Link
                  href="/find-therapist"
                  className="inline-flex items-center gap-2 bg-white/10 text-white font-semibold px-5 py-2.5 rounded-xl hover:bg-white/20 transition-all text-sm border border-white/20"
                >
                  <Users className="w-4 h-4" />
                  Find a Therapist
                </Link>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Suggested prompts (only when few messages) */}
      {messages.length <= 2 && !showUpgrade && (
        <div className="px-4 pb-2 max-w-3xl mx-auto w-full">
          <p className="text-xs text-slate-400 mb-2">Suggested topics:</p>
          <div className="flex flex-wrap gap-2">
            {SUGGESTED_PROMPTS.map((prompt) => (
              <button
                key={prompt}
                onClick={() => { setInput(prompt); inputRef.current?.focus(); }}
                className="text-xs px-3 py-1.5 bg-white border border-slate-200 text-slate-600 rounded-full hover:border-[#1F5EFF] hover:text-[#1F5EFF] transition-colors"
              >
                {prompt}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Input */}
      {!showUpgrade && (
        <div className="border-t border-slate-200 bg-white px-4 py-4">
          <div className="max-w-3xl mx-auto">
            <div className="flex items-end gap-3 bg-slate-50 rounded-2xl border border-slate-200 px-4 py-3 focus-within:border-[#1F5EFF] focus-within:ring-2 focus-within:ring-[#1F5EFF]/10 transition-all">
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => {
                  setInput(e.target.value);
                  e.target.style.height = "auto";
                  e.target.style.height = Math.min(e.target.scrollHeight, 120) + "px";
                }}
                onKeyDown={handleKeyDown}
                placeholder="Share what's on your mind… (Enter to send)"
                className="flex-1 bg-transparent text-sm text-slate-800 placeholder-slate-400 resize-none focus:outline-none min-h-[24px] max-h-[120px] leading-relaxed"
                rows={1}
                disabled={loading}
              />
              <button
                onClick={sendMessage}
                disabled={!input.trim() || loading}
                className={cn(
                  "w-9 h-9 rounded-xl flex items-center justify-center shrink-0 transition-all",
                  input.trim() && !loading
                    ? "bg-[#1F5EFF] text-white hover:bg-[#0A2342] shadow-md"
                    : "bg-slate-200 text-slate-400 cursor-not-allowed"
                )}
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
            <p className="text-center text-xs text-slate-400 mt-2">
              24Therapy AI · Not a substitute for professional care ·{" "}
              <Link href="/privacy" className="underline hover:text-slate-600">Privacy</Link>
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
