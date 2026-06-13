"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import {
  Brain, Sparkles, Send, ArrowRight, Shield, Users,
  AlertTriangle, X, MessageSquare
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

const WORKFLOW_CHIPS = [
  { label: "I'm feeling anxious", context: "anxiety" },
  { label: "Help me find a therapist", context: "find-therapist" },
  { label: "I'm dealing with depression", context: "depression" },
  { label: "Work stress is overwhelming me", context: "work-stress" },
  { label: "I'm going through a hard time", context: "general" },
];

const CHAT_TEMPLATES = [
  { icon: "😰", label: "Feeling anxious", firstMessage: "I've been feeling really anxious lately and I'm not sure how to manage it. Can you help me understand what's happening?", context: "anxiety" },
  { icon: "😔", label: "Dealing with depression", firstMessage: "I've been struggling with feeling down and unmotivated for a while now. What should I know?", context: "depression" },
  { icon: "😴", label: "Sleep problems", firstMessage: "I can't sleep properly and it's affecting everything in my life. What can I do?", context: "sleep" },
  { icon: "💼", label: "Work stress", firstMessage: "Work stress is completely overwhelming me and I feel like I can't cope anymore.", context: "work-stress" },
  { icon: "💔", label: "Relationship issues", firstMessage: "I'm going through some really difficult relationship issues and I need support.", context: "relationships" },
  { icon: "🙋", label: "Find a therapist", firstMessage: "I think I need to talk to a real therapist. Can you help me figure out how to get started?", context: "find-therapist" },
];

export default function ChatPage() {
  const [messages, setMessages] = useState<Message[]>([INITIAL_MESSAGE]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [showUpgrade, setShowUpgrade] = useState(false);
  const [messageCount, setMessageCount] = useState(0);
  const [showCrisisBar, setShowCrisisBar] = useState(false);
  const [chatContext, setChatContext] = useState("general");
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const FREE_MESSAGE_LIMIT = 10;

  useEffect(() => {
    if (!containerRef.current) return;
    const raf = requestAnimationFrame(() => {
      if (containerRef.current) {
        containerRef.current.scrollTop = containerRef.current.scrollHeight;
      }
    });
    return () => cancelAnimationFrame(raf);
  }, [messages, loading]);

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

  const sendMessage = async (overrideInput?: string) => {
    const trimmed = (overrideInput ?? input).trim();
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
          context: chatContext,
          history: messages.slice(-8).map((m) => ({
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
        json.data?.message ||
        json.message ||
        getFallbackReply(trimmed);
      addMessage("ai", reply);
    } catch {
      addMessage(
        "ai",
        getFallbackReply(trimmed)
      );
    } finally {
      setLoading(false);
      setTimeout(() => inputRef.current?.focus({ preventScroll: true }), 100);
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
    <div className="flex flex-col h-screen bg-[#071A33]">
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
      <header className="bg-[#0A2342] border-b border-white/10 px-4 py-3 flex items-center justify-between shadow-sm">
        <Link href="/" className="flex items-center gap-2">
          <div className="w-8 h-8 bg-gradient-to-br from-[#0A2342] to-[#1F5EFF] rounded-lg flex items-center justify-center border border-white/20">
            <Brain className="w-4 h-4 text-white" />
          </div>
          <span className="font-bold text-white text-sm">
            24Therapy<span className="text-[#1F5EFF]">.ai</span>
          </span>
        </Link>

        <div className="flex items-center gap-2 text-xs text-white/50">
          <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
          AI available 24/7
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs text-white/40 hidden sm:block">
            {FREE_MESSAGE_LIMIT - messageCount > 0
              ? `${FREE_MESSAGE_LIMIT - messageCount} / ${FREE_MESSAGE_LIMIT} free messages`
              : "Free limit reached"}
          </span>
          <Link
            href="/signup"
            className="text-xs font-semibold text-white bg-[#1F5EFF] px-3 py-1.5 rounded-lg hover:bg-[#1649D4] transition-colors"
          >
            Sign Up Free
          </Link>
        </div>
      </header>

      {/* Messages */}
      <div
        ref={containerRef}
        className="flex-1 overflow-y-auto px-4 py-6 space-y-4 max-w-3xl mx-auto w-full"
        style={{ scrollbarWidth: "thin", scrollbarColor: "rgba(255,255,255,0.12) transparent" }}
      >
        {/* Disclaimer */}
        <div className="flex items-start gap-2 bg-amber-900/30 border border-amber-600/40 rounded-2xl p-3 text-xs text-amber-300">
          <Shield className="w-4 h-4 shrink-0 mt-0.5 text-amber-400" />
          <span>
            This AI provides supportive guidance only. For professional mental health care,{" "}
            <Link href="/find-therapist" className="underline font-semibold">find a licensed therapist</Link>.
            Not for emergencies — call <strong>988</strong> if in crisis.
          </span>
        </div>

        {messages.map((msg) => (
          <div key={msg.id}>
            <div
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
                    ? "bg-[#0D2A4A] border border-white/10 text-white rounded-tl-sm shadow-sm"
                    : "bg-[#1F5EFF] text-white rounded-tr-sm shadow-md shadow-[#1F5EFF]/30"
                )}
              >
                {msg.content.split("\n").map((line, i) => (
                  <p key={i} className={i > 0 ? "mt-1" : ""}>
                    {line}
                  </p>
                ))}
                <p className={cn(
                  "text-xs mt-1.5",
                  msg.role === "ai" ? "text-white/35" : "text-white/60"
                )}>
                  {msg.timestamp.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                </p>
              </div>
            </div>

            {/* Template cards — shown below the first AI message only */}
            {msg.id === "init" && messages.length === 1 && (
              <div className="mt-4 ml-11 grid grid-cols-2 sm:grid-cols-3 gap-2">
                {CHAT_TEMPLATES.map((tpl) => (
                  <button
                    key={tpl.label}
                    onClick={() => {
                      setChatContext(tpl.context);
                      sendMessage(tpl.firstMessage);
                    }}
                    className="flex flex-col items-start gap-1 px-3 py-2.5 bg-[#0D2A4A] border border-white/10 rounded-xl hover:border-[#1F5EFF]/60 hover:bg-[#112D4E] transition-all text-left"
                  >
                    <span className="text-base">{tpl.icon}</span>
                    <span className="text-xs text-white/70 font-medium leading-tight">{tpl.label}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        ))}

        {loading && (
          <div className="flex justify-start">
            <div className="w-8 h-8 bg-gradient-to-br from-[#1F5EFF] to-[#24C8DB] rounded-xl flex items-center justify-center mr-3 mt-1 shrink-0">
              <Sparkles className="w-4 h-4 text-white" />
            </div>
            <div className="bg-[#0D2A4A] border border-white/10 rounded-2xl rounded-tl-sm px-4 py-3 shadow-sm">
              <div className="flex gap-1.5">
                {[0, 1, 2].map((i) => (
                  <div
                    key={i}
                    className="w-2 h-2 bg-white/40 rounded-full animate-bounce"
                    style={{ animationDelay: `${i * 0.15}s` }}
                  />
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Upgrade prompt */}
      {showUpgrade && (
        <div className="border-t border-white/10 bg-[#0A2342] px-4 py-5">
          <div className="max-w-3xl mx-auto">
            <div className="bg-gradient-to-r from-[#0A2342] to-[#1E4F8C] rounded-2xl p-5 text-white text-center border border-white/10">
              <Sparkles className="w-8 h-8 mx-auto mb-3 text-[#2EC4B6]" />
              <h3 className="font-bold text-lg mb-1">Continue Your Journey</h3>
              <p className="text-white/70 text-sm mb-4">
                Sign up free to get unlimited AI support and connect with a licensed therapist.
              </p>
              <div className="flex gap-3 justify-center flex-wrap">
                <Link
                  href="/signup"
                  className="inline-flex items-center gap-2 bg-[#1F5EFF] text-white font-semibold px-5 py-2.5 rounded-xl hover:bg-[#1649D4] transition-all text-sm"
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

      {/* Workflow chips (only when few messages) */}
      {messages.length <= 2 && !showUpgrade && (
        <div className="px-4 pb-2 max-w-3xl mx-auto w-full">
          <p className="text-xs text-white/40 mb-2">What brings you here today?</p>
          <div className="flex flex-wrap gap-2">
            {WORKFLOW_CHIPS.map((chip) => (
              <button
                key={chip.label}
                onClick={() => {
                  setInput(chip.label);
                  setChatContext(chip.context);
                  inputRef.current?.focus({ preventScroll: true });
                }}
                className="text-xs px-3 py-1.5 bg-[#0D2A4A] border border-white/15 text-white/60 rounded-full hover:border-[#1F5EFF] hover:text-white transition-colors"
              >
                {chip.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Input */}
      {!showUpgrade && (
        <div className="border-t border-white/10 bg-[#0A2342] px-4 py-4">
          <div className="max-w-3xl mx-auto">
            <p className="text-center text-xs text-white/30 mb-2">
              {FREE_MESSAGE_LIMIT - messageCount > 0
                ? `${FREE_MESSAGE_LIMIT - messageCount} messages remaining`
                : "Limit reached — sign up to continue"}
            </p>
            <div className="flex items-end gap-3 bg-[#0D2A4A] rounded-2xl border border-[#1F5EFF]/30 px-4 py-3 focus-within:border-[#1F5EFF] focus-within:ring-2 focus-within:ring-[#1F5EFF]/10 transition-all">
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
                className="flex-1 bg-transparent text-sm text-white placeholder-white/30 resize-none focus:outline-none min-h-[24px] max-h-[120px] leading-relaxed"
                rows={1}
                disabled={loading}
              />
              <button
                onClick={() => sendMessage()}
                disabled={!input.trim() || loading}
                className={cn(
                  "w-9 h-9 rounded-xl flex items-center justify-center shrink-0 transition-all",
                  input.trim() && !loading
                    ? "bg-[#1F5EFF] text-white hover:bg-[#1649D4] shadow-md shadow-[#1F5EFF]/30"
                    : "bg-white/10 text-white/30 cursor-not-allowed"
                )}
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
            <p className="text-center text-xs text-white/25 mt-2">
              24Therapy AI · Not a substitute for professional care ·{" "}
              <Link href="/privacy" className="underline hover:text-white/50">Privacy</Link>
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
