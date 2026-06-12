"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import { Brain, Send, RefreshCw, Sparkles, Clock, Calendar, Zap, ArrowRight } from "lucide-react";
import { aiAPI, billingAPI } from "@/lib/api";
import { cn } from "@/lib/utils";

type Range = "today" | "this_week" | "last_week";
type Message = { role: "user" | "assistant"; content: string };

const STARTER_PROMPTS = [
  "Summarize today's sessions",
  "Which patients showed elevated risk this week?",
  "What homework did I assign last week?",
  "Who needs follow-up notes from today?",
];

const RANGE_LABELS: Record<Range, string> = {
  today: "Today",
  this_week: "This week",
  last_week: "Last week",
};

export default function AssistantPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [range, setRange] = useState<Range>("today");
  const [loading, setLoading] = useState(false);
  const [credits, setCredits] = useState<number | "unlimited" | null>(null);
  const [exhausted, setExhausted] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const scrollToBottom = useCallback(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  useEffect(() => {
    aiAPI.assistantCredits().then((r: any) => {
      setCredits(r?.balance ?? 0);
    }).catch(() => {});
  }, []);

  const send = useCallback(async (text?: string) => {
    const msg = (text || input).trim();
    if (!msg || loading || exhausted) return;

    setInput("");
    const userMsg: Message = { role: "user", content: msg };
    const nextMessages = [...messages, userMsg];
    setMessages(nextMessages);
    setLoading(true);

    try {
      const res = await aiAPI.assistantChat({
        message: msg,
        range,
        history: messages.slice(-8),
      }) as any;

      if (res?.error === "credits_exhausted") {
        setExhausted(true);
        setCredits(0);
        setMessages([...nextMessages, {
          role: "assistant",
          content: res.upsell || "You've used all your AI assistant credits. Every completed session adds 5 more messages.",
        }]);
        return;
      }

      setMessages([...nextMessages, {
        role: "assistant",
        content: res?.reply || res?.data?.reply || "I couldn't generate a response. Please try again.",
      }]);

      if (res?.credits_remaining !== undefined) {
        setCredits(res.credits_remaining);
      }
    } catch {
      setMessages([...nextMessages, {
        role: "assistant",
        content: "Something went wrong. Please try again.",
      }]);
    } finally {
      setLoading(false);
      inputRef.current?.focus();
    }
  }, [input, loading, exhausted, messages, range]);

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  };

  return (
    <div className="h-full flex flex-col p-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6 flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-br from-[#1F5EFF] to-[#2EC4B6] rounded-xl flex items-center justify-center">
            <Brain className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900">AI Assistant</h1>
            <p className="text-sm text-slate-500">Ask about your sessions, patients, and practice</p>
          </div>
        </div>

        {/* Credits pill */}
        {credits === "unlimited" ? (
          <span className="flex items-center gap-1.5 bg-[#2EC4B6]/10 text-[#2EC4B6] px-3 py-1.5 rounded-full text-sm font-medium">
            <Sparkles className="w-3.5 h-3.5" />
            Unlimited
          </span>
        ) : credits !== null ? (
          <div className="text-right">
            <span className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium",
              credits === 0 ? "bg-red-50 text-red-600" : "bg-blue-50 text-blue-600"
            )}>
              <Zap className="w-3.5 h-3.5" />
              {credits} messages left
            </span>
            <p className="text-xs text-slate-400 mt-1">Every session adds 5</p>
          </div>
        ) : null}
      </div>

      {/* Range selector */}
      <div className="flex gap-2 mb-4 flex-shrink-0">
        {(Object.keys(RANGE_LABELS) as Range[]).map((r) => (
          <button
            key={r}
            onClick={() => setRange(r)}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors",
              range === r
                ? "bg-[#0A2342] text-white"
                : "bg-white border border-slate-200 text-slate-600 hover:border-slate-300"
            )}
          >
            {r === "today" ? <Clock className="w-3.5 h-3.5" /> : <Calendar className="w-3.5 h-3.5" />}
            {RANGE_LABELS[r]}
          </button>
        ))}
      </div>

      {/* Chat area */}
      <div
        ref={containerRef}
        className="flex-1 overflow-y-auto space-y-4 min-h-0 pr-1"
        style={{ scrollBehavior: "smooth" }}
      >
        {messages.length === 0 && (
          <div className="py-8">
            <p className="text-slate-500 text-sm text-center mb-6">
              Ask me anything about your {RANGE_LABELS[range].toLowerCase()} sessions and patients.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {STARTER_PROMPTS.map((prompt) => (
                <button
                  key={prompt}
                  onClick={() => send(prompt)}
                  disabled={loading || exhausted}
                  className="text-left p-3 bg-white border border-slate-200 rounded-xl text-sm text-slate-700 hover:border-[#1F5EFF] hover:text-[#1F5EFF] transition-colors disabled:opacity-50"
                >
                  {prompt}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg, i) => (
          <div
            key={i}
            className={cn(
              "flex",
              msg.role === "user" ? "justify-end" : "justify-start"
            )}
          >
            {msg.role === "assistant" && (
              <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-[#1F5EFF] to-[#2EC4B6] flex items-center justify-center flex-shrink-0 mt-0.5 mr-2">
                <Brain className="w-3.5 h-3.5 text-white" />
              </div>
            )}
            <div
              className={cn(
                "max-w-[80%] px-4 py-2.5 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap",
                msg.role === "user"
                  ? "bg-[#0A2342] text-white rounded-tr-md"
                  : "bg-white border border-slate-200 text-slate-800 rounded-tl-md"
              )}
            >
              {msg.content}
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex justify-start">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-[#1F5EFF] to-[#2EC4B6] flex items-center justify-center flex-shrink-0 mt-0.5 mr-2">
              <Brain className="w-3.5 h-3.5 text-white" />
            </div>
            <div className="bg-white border border-slate-200 px-4 py-3 rounded-2xl rounded-tl-md">
              <div className="flex gap-1">
                {[0, 1, 2].map((i) => (
                  <div
                    key={i}
                    className="w-2 h-2 rounded-full bg-slate-300 animate-bounce"
                    style={{ animationDelay: `${i * 0.15}s` }}
                  />
                ))}
              </div>
            </div>
          </div>
        )}

        {exhausted && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-center">
            <p className="text-sm text-amber-800 font-medium mb-2">You&apos;ve used all your assistant credits</p>
            <p className="text-xs text-amber-600 mb-3">Complete more sessions to earn 5 credits each, or upgrade for unlimited access.</p>
            <Link
              href="/settings?tab=billing"
              className="inline-flex items-center gap-1.5 bg-[#1F5EFF] text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-[#1F5EFF]/90"
            >
              Upgrade for unlimited <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        )}
      </div>

      {/* Input */}
      {!exhausted && (
        <div className="mt-4 flex-shrink-0">
          <div className="flex gap-2 bg-white border border-slate-200 rounded-2xl p-2 focus-within:border-[#1F5EFF] transition-colors">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKey}
              placeholder={`Ask about your ${RANGE_LABELS[range].toLowerCase()} sessions…`}
              rows={1}
              className="flex-1 resize-none bg-transparent text-sm text-slate-800 placeholder-slate-400 outline-none px-2 py-1 min-h-[36px] max-h-32"
              style={{ lineHeight: "1.5" }}
            />
            <button
              onClick={() => send()}
              disabled={!input.trim() || loading}
              className="w-9 h-9 rounded-xl bg-[#1F5EFF] text-white flex items-center justify-center flex-shrink-0 disabled:opacity-40 hover:bg-[#1F5EFF]/90 transition-colors self-end"
            >
              {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            </button>
          </div>
          <p className="text-xs text-slate-400 mt-1.5 text-center">
            Only discusses your own sessions. Not a substitute for clinical supervision.
          </p>
        </div>
      )}
    </div>
  );
}
