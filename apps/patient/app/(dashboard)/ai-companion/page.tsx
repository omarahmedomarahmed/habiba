"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import {
  Send, Brain, Heart, Shield, Volume2, VolumeX,
  Phone, CheckCircle2, RefreshCw, Loader2
} from "lucide-react";
import { cn } from "@/lib/utils";
import { aiAPI, authAPI, APIError } from "@/lib/api";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: string;
  type?: "text" | "crisis" | "exercise";
  suggestions?: string[];
  exercise?: Exercise;
}

interface Exercise {
  title: string;
  duration: string;
  steps: string[];
  type: "breathing" | "grounding" | "cbt" | "mindfulness";
}

const SAFETY_RESOURCES = [
  { name: "Crisis Text Line", detail: "Text HOME to 741741" },
  { name: "988 Suicide & Crisis Lifeline", detail: "Call or text 988" },
  { name: "Emergency Services", detail: "Call 911" },
];

const QUICK_ACTIONS = [
  { id: "breathing", label: "Breathing Exercise", icon: "🌬️", description: "4-7-8 or box breathing" },
  { id: "grounding", label: "5-4-3-2-1 Grounding", icon: "🌱", description: "Anxiety relief technique" },
  { id: "journal", label: "Guided Journaling", icon: "📝", description: "Process your thoughts" },
  { id: "crisis", label: "I need help now", icon: "🆘", description: "Get immediate support" },
];

const CRISIS_KEYWORDS = [
  "suicid", "kill myself", "end my life", "don't want to be here",
  "hurt myself", "self harm", "no reason to live",
];

// ── parse structured AI response ─────────────────────────────────────────────
function parseAIResponse(raw: Record<string, unknown>): {
  content: string;
  suggestions?: string[];
  exercise?: Exercise;
  type?: "text" | "crisis" | "exercise";
} {
  // Handle various backend response shapes
  const text = String(
    raw.message || raw.content || raw.text || raw.response ||
    raw.reply || raw.answer || ""
  );

  const suggestionsRaw = raw.suggestions || raw.quick_replies || raw.options;
  const suggestions = Array.isArray(suggestionsRaw)
    ? (suggestionsRaw as string[]).filter(Boolean)
    : undefined;

  const exerciseRaw = raw.exercise || raw.activity;
  let exercise: Exercise | undefined;
  if (exerciseRaw && typeof exerciseRaw === "object") {
    const e = exerciseRaw as Record<string, unknown>;
    exercise = {
      title: String(e.title || "Breathing Exercise"),
      duration: String(e.duration || "2-3 minutes"),
      steps: Array.isArray(e.steps) ? (e.steps as string[]) : [],
      type: String(e.type || "breathing") as Exercise["type"],
    };
  }

  // Detect crisis in response text
  const typeRaw = String(raw.type || raw.message_type || "text");
  const type: "text" | "crisis" | "exercise" =
    typeRaw === "crisis" ? "crisis"
    : typeRaw === "exercise" || !!exercise ? "exercise"
    : "text";

  return { content: text, suggestions, exercise, type };
}

// ── breathing exercise component ─────────────────────────────────────────────
function BreathingExercise({ exercise, onDone }: { exercise: Exercise; onDone: () => void }) {
  const [isRunning, setIsRunning] = useState(false);
  const [phase, setPhase] = useState<"inhale" | "hold" | "exhale" | "ready">("ready");
  const [count, setCount] = useState(0);
  const [cycle, setCycle] = useState(0);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!isRunning) return;
    const phases: { phase: typeof phase; duration: number }[] = [
      { phase: "inhale", duration: 4 },
      { phase: "hold", duration: 7 },
      { phase: "exhale", duration: 8 },
    ];
    let currentPhase = 0;
    let currentCount = 0;
    const interval = setInterval(() => {
      currentCount++;
      const p = phases[currentPhase];
      setPhase(p.phase);
      setCount(currentCount);
      if (currentCount >= p.duration) {
        currentCount = 0;
        currentPhase = (currentPhase + 1) % 3;
        if (currentPhase === 0) {
          setCycle((c) => {
            if (c >= 3) {
              setIsRunning(false);
              setPhase("ready");
              setDone(true);
              return c;
            }
            return c + 1;
          });
        }
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [isRunning]);

  return (
    <div className="bg-gradient-to-br from-indigo-50 to-blue-50 rounded-2xl p-5 border border-indigo-100">
      <div className="flex items-center gap-2 mb-4">
        <span className="text-xl">🌬️</span>
        <div>
          <h4 className="font-semibold text-gray-900 text-sm">{exercise.title}</h4>
          <p className="text-xs text-gray-500">{exercise.duration}</p>
        </div>
      </div>

      {isRunning ? (
        <div className="text-center py-4">
          <div className={cn(
            "w-24 h-24 rounded-full mx-auto flex items-center justify-center text-white font-bold text-2xl mb-3 transition-all duration-1000",
            phase === "inhale" ? "bg-blue-500 scale-110" :
            phase === "hold" ? "bg-indigo-600 scale-100" : "bg-blue-400 scale-90"
          )}>
            {count}
          </div>
          <p className="font-medium text-gray-900 capitalize">
            {phase === "inhale" ? "Breathe In..." : phase === "hold" ? "Hold..." : "Breathe Out..."}
          </p>
          <p className="text-xs text-gray-500 mt-1">Cycle {cycle + 1} of 4</p>
          <button
            onClick={() => { setIsRunning(false); setPhase("ready"); }}
            className="mt-3 text-xs text-gray-400 hover:text-gray-600"
          >
            Stop
          </button>
        </div>
      ) : done ? (
        <div className="text-center py-3">
          <CheckCircle2 className="h-8 w-8 text-emerald-500 mx-auto mb-2" />
          <p className="font-medium text-gray-900">Exercise Complete!</p>
          <p className="text-sm text-gray-600 mt-1">Take a moment to notice how you feel. Well done. 💙</p>
          <button onClick={onDone} className="mt-3 text-sm text-[#0A2342] font-medium hover:text-[#1E4F8C]">
            Continue →
          </button>
        </div>
      ) : (
        <div>
          {exercise.steps.length > 0 && (
            <div className="space-y-2 mb-4">
              {exercise.steps.slice(0, 3).map((step, i) => (
                <div key={i} className="flex gap-2 text-sm">
                  <span className="w-5 h-5 rounded-full bg-indigo-100 text-indigo-600 text-xs flex items-center justify-center shrink-0 font-medium">
                    {i + 1}
                  </span>
                  <span className="text-gray-600">{step}</span>
                </div>
              ))}
            </div>
          )}
          <button
            onClick={() => { setIsRunning(true); setPhase("inhale"); setDone(false); }}
            className="w-full py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-medium hover:bg-indigo-700 flex items-center justify-center gap-2"
          >
            ▶ Start Exercise
          </button>
        </div>
      )}
    </div>
  );
}

// ── page ─────────────────────────────────────────────────────────────────────
export default function AICompanionPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [patientName, setPatientName] = useState("there");
  const [input, setInput] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [showSafety, setShowSafety] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Load patient name for personalised greeting
  useEffect(() => {
    (async () => {
      try {
        const me = await authAPI.me();
        const name = String(
          me?.first_name || me?.name?.split(" ")[0] || me?.full_name?.split(" ")[0] || "there"
        );
        setPatientName(name);
      } catch {
        // silent — fallback stays "there"
      }
    })();
  }, []);

  // Build welcome message after name loads
  useEffect(() => {
    const welcome: Message = {
      id: "m_welcome",
      role: "assistant",
      content: `Hi ${patientName} 👋 I'm your AI companion — here to support you between sessions.\n\nI'm not a replacement for your therapist or clinical care, but I'm here to listen, help you practice coping skills, and check in on how you're doing.\n\nHow are you feeling today?`,
      timestamp: new Date().toISOString(),
      suggestions: [
        "I'm having a hard time",
        "I'm doing okay",
        "I need to practice a coping skill",
        "I want to prepare for my session",
      ],
    };
    setMessages([welcome]);
  }, [patientName]);

  // ── send message ────────────────────────────────────────────────────────
  const sendMessage = useCallback(async (text: string) => {
    if (!text.trim() || isSending) return;

    const userMsg: Message = {
      id: `u${Date.now()}`,
      role: "user",
      content: text,
      timestamp: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setIsSending(true);

    // Crisis detection — always local, never delegated to backend
    const isCrisis = CRISIS_KEYWORDS.some((kw) => text.toLowerCase().includes(kw));
    if (isCrisis) {
      const crisisMsg: Message = {
        id: `r${Date.now()}`,
        role: "assistant",
        type: "crisis",
        content:
          "I hear you, and I'm glad you told me. What you're feeling sounds incredibly painful. 💙\n\nPlease reach out to crisis support right now — you deserve immediate, professional help.",
        timestamp: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, crisisMsg]);
      setShowSafety(true);
      setIsSending(false);
      return;
    }

    // Build context from last 6 messages
    const history = messages.slice(-6).map((m) => ({
      role: m.role,
      content: m.content,
    }));

    try {
      const json = await aiAPI.chat(text, { history, context: "patient_companion" });

      const parsed = parseAIResponse(json as Record<string, unknown>);

      if (!parsed.content) {
        // Fallback if backend returns empty text
        throw new Error("empty_response");
      }

      const aiMsg: Message = {
        id: `r${Date.now()}`,
        role: "assistant",
        content: parsed.content,
        timestamp: new Date().toISOString(),
        type: parsed.type,
        suggestions: parsed.suggestions,
        exercise: parsed.exercise,
      };
      setMessages((prev) => [...prev, aiMsg]);
    } catch (err) {
      if (err instanceof APIError && err.status === 401) {
        setIsSending(false);
        return;
      }

      // 404/405 — AI endpoint not yet live
      if (err instanceof APIError && (err.status === 404 || err.status === 405)) {
        const fallbackMsg: Message = {
          id: `r${Date.now()}`,
          role: "assistant",
          content:
            "Thank you for sharing that with me. I'm here and I'm listening.\n\nRemember, whatever you're going through, you don't have to face it alone. Your therapist is also here to support you at your next session.\n\nIs there anything specific I can help you with — a coping skill, some grounding, or just someone to talk to?",
          timestamp: new Date().toISOString(),
          suggestions: [
            "Help me calm down",
            "I want to do a breathing exercise",
            "Tell me something helpful",
            "I'm okay, just checking in",
          ],
        };
        setMessages((prev) => [...prev, fallbackMsg]);
        setIsSending(false);
        return;
      }

      // Generic error
      const errMsg: Message = {
        id: `r${Date.now()}`,
        role: "assistant",
        content: "I'm having trouble connecting right now. Please try again in a moment — I'm here for you. 💙",
        timestamp: new Date().toISOString(),
        suggestions: ["Try again"],
      };
      setMessages((prev) => [...prev, errMsg]);
    } finally {
      setIsSending(false);
    }
  }, [isSending, messages]);

  // ── clear conversation ────────────────────────────────────────────────────
  const clearConversation = () => {
    const welcome: Message = {
      id: `m_welcome_${Date.now()}`,
      role: "assistant",
      content: `Hi ${patientName} 👋 I'm your AI companion — here to support you between sessions.\n\nHow are you feeling today?`,
      timestamp: new Date().toISOString(),
      suggestions: [
        "I'm having a hard time",
        "I'm doing okay",
        "I need to practice a coping skill",
        "I want to prepare for my session",
      ],
    };
    setMessages([welcome]);
  };

  const lastMsg = messages[messages.length - 1];
  const suggestions = lastMsg?.role === "assistant" ? lastMsg.suggestions : null;

  return (
    <div className="flex flex-col h-[calc(100vh-120px)] max-w-2xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between pb-4 border-b border-gray-100">
        <div className="flex items-center gap-3">
          <div className="relative">
            <div className="w-10 h-10 bg-gradient-to-br from-[#0A2342] to-[#2F80ED] rounded-xl flex items-center justify-center">
              <Brain className="h-5 w-5 text-white" />
            </div>
            <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-emerald-400 rounded-full border-2 border-white" />
          </div>
          <div>
            <h2 className="font-semibold text-gray-900">AI Companion</h2>
            <p className="text-xs text-gray-400">Support between sessions · Not a replacement for therapy</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={clearConversation}
            title="New conversation"
            className="p-2 rounded-xl hover:bg-gray-100 text-gray-400"
          >
            <RefreshCw className="h-4 w-4" />
          </button>
          <button
            onClick={() => setIsMuted(!isMuted)}
            className="p-2 rounded-xl hover:bg-gray-100 text-gray-400"
          >
            {isMuted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
          </button>
          <button
            onClick={() => setShowSafety(!showSafety)}
            className="p-2 rounded-xl hover:bg-gray-100 text-gray-400"
          >
            <Shield className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Safety Resources Banner */}
      {showSafety && (
        <div className="bg-rose-50 border border-rose-200 rounded-xl p-3 mt-3">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-semibold text-rose-700 flex items-center gap-1">
              <Phone className="h-3 w-3" /> Crisis Resources — Available 24/7
            </p>
            <button onClick={() => setShowSafety(false)} className="text-xs text-rose-400">✕</button>
          </div>
          {SAFETY_RESOURCES.map((r) => (
            <div key={r.name} className="flex justify-between items-center py-1.5 border-b border-rose-100 last:border-0">
              <span className="text-xs font-medium text-rose-700">{r.name}</span>
              <span className="text-xs text-rose-600">{r.detail}</span>
            </div>
          ))}
        </div>
      )}

      {/* Quick Actions (only shown before user sends a message) */}
      {messages.length <= 1 && (
        <div className="mt-4 grid grid-cols-2 gap-2">
          {QUICK_ACTIONS.map((action) => (
            <button
              key={action.id}
              onClick={() => sendMessage(action.label)}
              className="flex items-center gap-2 p-3 bg-white border border-gray-200 rounded-xl hover:border-[#0A2342]/30 hover:bg-gray-50 text-left transition-all"
            >
              <span className="text-xl">{action.icon}</span>
              <div>
                <p className="text-xs font-medium text-gray-800">{action.label}</p>
                <p className="text-xs text-gray-400">{action.description}</p>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto py-4 space-y-4">
        {messages.map((message) => (
          <div key={message.id} className={cn("flex", message.role === "user" ? "justify-end" : "justify-start")}>
            {message.role === "assistant" && (
              <div className="w-7 h-7 bg-gradient-to-br from-[#0A2342] to-[#2F80ED] rounded-lg flex items-center justify-center mr-2 shrink-0 mt-1">
                <Brain className="h-3.5 w-3.5 text-white" />
              </div>
            )}
            <div className={cn("max-w-[85%] space-y-2", message.role === "user" ? "items-end" : "items-start")}>
              {/* Crisis bubble */}
              {message.type === "crisis" ? (
                <div className="bg-rose-50 border border-rose-200 rounded-2xl p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Heart className="h-4 w-4 text-rose-600" />
                    <span className="text-xs font-semibold text-rose-700">Crisis Support</span>
                  </div>
                  <p className="text-sm text-gray-700 whitespace-pre-line">{message.content}</p>
                  <div className="mt-3 space-y-2">
                    {SAFETY_RESOURCES.map((r) => (
                      <div key={r.name} className="flex justify-between items-center p-2 bg-rose-100 rounded-xl">
                        <span className="text-xs font-medium text-rose-800">{r.name}</span>
                        <span className="text-xs font-bold text-rose-700">{r.detail}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className={cn(
                  "rounded-2xl px-4 py-3",
                  message.role === "user"
                    ? "bg-[#0A2342] text-white"
                    : "bg-white border border-gray-200 text-gray-800"
                )}>
                  <p className="text-sm whitespace-pre-line leading-relaxed">{message.content}</p>
                </div>
              )}

              {/* Exercise card */}
              {message.exercise && (
                <BreathingExercise exercise={message.exercise} onDone={() => {}} />
              )}

              {/* Suggestion pills */}
              {message.suggestions && message.suggestions.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-2">
                  {message.suggestions.map((s) => (
                    <button
                      key={s}
                      onClick={() => sendMessage(s)}
                      disabled={isSending}
                      className="px-3 py-1.5 bg-gray-100 hover:bg-[#0A2342] hover:text-white text-gray-700 rounded-full text-xs font-medium transition-all border border-gray-200 hover:border-[#0A2342] disabled:opacity-50"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              )}

              <p className="text-xs text-gray-400 px-1">
                {new Date(message.timestamp).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}
              </p>
            </div>
          </div>
        ))}

        {/* Typing indicator */}
        {isSending && (
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 bg-gradient-to-br from-[#0A2342] to-[#2F80ED] rounded-lg flex items-center justify-center">
              <Brain className="h-3.5 w-3.5 text-white" />
            </div>
            <div className="bg-white border border-gray-200 rounded-2xl px-4 py-3">
              <div className="flex gap-1">
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input area */}
      <div className="pt-4 border-t border-gray-100">
        <div className="bg-white border border-gray-200 rounded-2xl p-3 flex items-end gap-2 focus-within:border-[#0A2342] focus-within:ring-2 focus-within:ring-[#0A2342]/10 transition-all">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                sendMessage(input);
              }
            }}
            placeholder="Share what's on your mind..."
            className="flex-1 text-sm text-gray-700 placeholder-gray-400 resize-none focus:outline-none max-h-24 bg-transparent leading-relaxed"
            rows={1}
          />
          <div className="flex items-center gap-1">
            <button
              onClick={() => sendMessage(input)}
              disabled={!input.trim() || isSending}
              className="p-2 bg-[#0A2342] text-white rounded-xl disabled:opacity-40 hover:bg-[#123A63] transition-colors"
            >
              {isSending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </button>
          </div>
        </div>

        <p className="text-center text-xs text-gray-400 mt-2">
          AI Companion cannot replace professional therapy. If in crisis, call 988 or text HOME to 741741.
        </p>
      </div>
    </div>
  );
}
