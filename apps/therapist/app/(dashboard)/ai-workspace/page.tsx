"use client";

import { useState, useRef, useEffect } from "react";
import {
  Brain, Send, Plus, History, Search, Paperclip, Zap,
  Users, Calendar, FileText, TrendingDown, Sparkles,
  RefreshCw, Copy, ThumbsUp, ThumbsDown, ChevronRight
} from "lucide-react";
import { cn, formatDate } from "@/lib/utils";
import { aiAPI } from "@/lib/api";

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
  loading?: boolean;
}

const SUGGESTED_PROMPTS = [
  { icon: Users, text: "Summarize Sarah Chen's treatment history", category: "Patient" },
  { icon: TrendingDown, text: "Which patients have worsening PHQ-9 trends?", category: "Clinical" },
  { icon: Calendar, text: "Prepare my session agenda for today", category: "Scheduling" },
  { icon: FileText, text: "Generate a progress report for Michael Torres", category: "Documentation" },
  { icon: Brain, text: "What recurring themes appear in James Rodriguez's sessions?", category: "Insights" },
  { icon: Zap, text: "Which patients are overdue for PHQ-9 assessments?", category: "Clinical" },
];

const EXAMPLE_RESPONSES: Record<string, string> = {
  "Summarize Sarah Chen's treatment history": `**Sarah Chen — Clinical Summary**

Sarah (34F) has been in therapy for **16 months** (since August 2024) for **Major Depressive Disorder (Moderate)** and comorbid **Generalized Anxiety Disorder**.

**Progress Overview:**
- PHQ-9 reduced from **19 → 13** (32% improvement)
- GAD-7 reduced from **14 → 8** (43% improvement)
- **24 sessions completed**, high attendance rate (92%)

**Key Clinical Themes:**
1. Performance-based self-worth tied to childhood attachment patterns (emotionally unavailable father)
2. Perfectionism as core cognitive distortion — resists positive feedback
3. Work-related anxiety as primary presenting concern (seasonal pattern noted)

**Treatment Approach:**
Primarily CBT with Socratic questioning. Strong responder to collaborative insight-building rather than direct advice.

**Current Medications:**
- Lexapro 10mg daily (since Sept 2024, Dr. Walsh)
- Melatonin 5mg PRN for sleep

**Next Session:** December 22 · Focus: perfectionism schema work, Double Standard Technique

*Accessed from AI Memory Layer — 5 memory nodes retrieved*`,
};

export default function AIWorkspacePage() {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "welcome",
      role: "assistant",
      content: `**Welcome to your AI Workspace, Dr. Smith.**

I have access to your patient data, session histories, assessment results, and clinical notes. Everything I know is scoped exclusively to your practice.

**I can help you:**
- Summarize any patient's history and progress
- Identify clinical patterns across your patient roster
- Generate session agendas and pre-session briefs
- Answer questions about specific sessions or notes
- Analyze assessment score trends
- Draft referral letters or progress reports
- Search through all your session transcripts and notes

What would you like to explore?`,
      timestamp: new Date(),
    },
  ]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendMessage = async (content?: string) => {
    const messageContent = content || input.trim();
    if (!messageContent || isLoading) return;

    setInput("");

    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      role: "user",
      content: messageContent,
      timestamp: new Date(),
    };

    const loadingMsg: ChatMessage = {
      id: (Date.now() + 1).toString(),
      role: "assistant",
      content: "",
      timestamp: new Date(),
      loading: true,
    };

    setMessages((m) => [...m, userMsg, loadingMsg]);
    setIsLoading(true);

    await new Promise((r) => setTimeout(r, 1500));

    const responseContent =
      EXAMPLE_RESPONSES[messageContent] ||
      `I've analyzed your request: **"${messageContent}"**\n\nBased on your practice data, here's what I found...\n\n*This is a demo response. In production, this would query your actual patient data, session histories, and clinical notes.*`;

    setMessages((m) =>
      m.map((msg) =>
        msg.loading
          ? { ...msg, content: responseContent, loading: false }
          : msg
      )
    );
    setIsLoading(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <div className="flex h-full">
      {/* Sidebar */}
      <div className="w-64 shrink-0 border-r border-slate-200 bg-white flex flex-col">
        <div className="p-3 border-b border-slate-100">
          <button className="w-full flex items-center gap-2 h-9 px-3 bg-secondary text-white rounded-lg text-sm font-medium hover:bg-secondary/90 transition-colors">
            <Plus className="w-4 h-4" />
            New Conversation
          </button>
        </div>

        <div className="p-3">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
            <input
              placeholder="Search conversations..."
              className="w-full h-8 pl-8 pr-3 bg-slate-100 rounded-lg text-xs focus:outline-none focus:bg-white focus:ring-1 focus:ring-secondary/40"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-3">
          <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-2">Recent</div>
          <div className="space-y-0.5">
            {[
              "Sarah Chen summary",
              "PHQ-9 trending patients",
              "Session prep - today",
              "James Rodriguez risk factors",
              "Q4 billing summary",
            ].map((conv) => (
              <button
                key={conv}
                className="w-full text-left px-2 py-2 rounded-lg text-xs text-slate-600 hover:bg-slate-100 transition-colors truncate"
              >
                {conv}
              </button>
            ))}
          </div>
        </div>

        <div className="p-3 border-t border-slate-100">
          <div className="text-[10px] text-slate-400 text-center">
            AI Workspace · Private to your practice
          </div>
        </div>
      </div>

      {/* Chat Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Chat Header */}
        <div className="px-6 py-3 border-b border-slate-200 bg-white flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Brain className="w-5 h-5 text-secondary" />
            <span className="font-semibold text-slate-800">AI Workspace</span>
            <span className="text-xs bg-green-100 text-green-600 px-2 py-0.5 rounded-full font-medium">Online</span>
          </div>
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <span>Context: 42 patients · 24 months · 1,240 sessions</span>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={cn(
                "flex gap-3",
                msg.role === "user" ? "justify-end" : "justify-start"
              )}
            >
              {msg.role === "assistant" && (
                <div className="w-8 h-8 bg-primary rounded-full flex items-center justify-center shrink-0 mt-0.5">
                  <Brain className="w-4 h-4 text-white" />
                </div>
              )}

              <div
                className={cn(
                  "max-w-[80%] rounded-2xl px-4 py-3",
                  msg.role === "user"
                    ? "bg-secondary text-white"
                    : "bg-white border border-slate-200 text-slate-800 shadow-card"
                )}
              >
                {msg.loading ? (
                  <div className="flex items-center gap-1 py-1">
                    {[0, 0.2, 0.4].map((delay) => (
                      <div
                        key={delay}
                        className="w-1.5 h-1.5 bg-slate-300 rounded-full animate-bounce"
                        style={{ animationDelay: `${delay}s` }}
                      />
                    ))}
                  </div>
                ) : (
                  <div className="text-sm leading-relaxed whitespace-pre-line">
                    {msg.content.split("**").map((part, i) =>
                      i % 2 === 0 ? part : <strong key={i}>{part}</strong>
                    )}
                  </div>
                )}

                {msg.role === "assistant" && !msg.loading && (
                  <div className="flex items-center gap-2 mt-2 pt-2 border-t border-slate-100">
                    <button className="text-slate-300 hover:text-slate-500 transition-colors">
                      <Copy className="w-3.5 h-3.5" />
                    </button>
                    <button className="text-slate-300 hover:text-green-500 transition-colors">
                      <ThumbsUp className="w-3.5 h-3.5" />
                    </button>
                    <button className="text-slate-300 hover:text-red-500 transition-colors">
                      <ThumbsDown className="w-3.5 h-3.5" />
                    </button>
                    <span className="text-[10px] text-slate-300 ml-auto">
                      {formatDate(msg.timestamp, "time")}
                    </span>
                  </div>
                )}
              </div>

              {msg.role === "user" && (
                <div className="w-8 h-8 bg-slate-200 rounded-full flex items-center justify-center shrink-0 mt-0.5 text-xs font-bold text-slate-600">
                  DR
                </div>
              )}
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>

        {/* Suggested Prompts (show when empty) */}
        {messages.length <= 1 && (
          <div className="px-6 py-3 grid grid-cols-2 lg:grid-cols-3 gap-2">
            {SUGGESTED_PROMPTS.map(({ icon: Icon, text, category }) => (
              <button
                key={text}
                onClick={() => sendMessage(text)}
                className="flex items-start gap-2 p-3 rounded-xl border border-slate-200 hover:border-secondary/40 hover:bg-secondary/5 text-left transition-all group"
              >
                <Icon className="w-4 h-4 text-secondary shrink-0 mt-0.5 group-hover:scale-110 transition-transform" />
                <div>
                  <div className="text-[10px] text-slate-400 font-semibold uppercase">{category}</div>
                  <div className="text-xs text-slate-700 mt-0.5 leading-relaxed">{text}</div>
                </div>
              </button>
            ))}
          </div>
        )}

        {/* Input */}
        <div className="px-6 py-4 border-t border-slate-200 bg-white">
          <div className="flex items-end gap-2 bg-white border border-slate-200 rounded-2xl p-3 shadow-sm focus-within:border-secondary/50 focus-within:shadow-md transition-all">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask about your patients, sessions, notes, or clinical data..."
              className="flex-1 resize-none text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none max-h-32 leading-relaxed"
              rows={1}
            />
            <div className="flex items-center gap-1 shrink-0">
              <button className="h-7 w-7 flex items-center justify-center text-slate-400 hover:text-slate-600 transition-colors rounded-lg hover:bg-slate-100">
                <Paperclip className="w-4 h-4" />
              </button>
              <button
                onClick={() => sendMessage()}
                disabled={!input.trim() || isLoading}
                className="h-8 w-8 flex items-center justify-center bg-secondary text-white rounded-lg hover:bg-secondary/90 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
          </div>
          <p className="text-[10px] text-slate-400 mt-2 text-center">
            AI has access only to your practice data. Never access data outside your organization.
          </p>
        </div>
      </div>
    </div>
  );
}
