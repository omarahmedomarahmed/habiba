"use client";

import { useState, useRef, useEffect } from "react";
import {
  Brain, Send, User, Sparkles, FileText, Target, Pill, Calendar,
  Clock, MessageSquare, ChevronRight, Lightbulb, AlertTriangle,
  TrendingUp, BookOpen, ClipboardList, Loader2, Copy, Download,
  RefreshCw, Star, CheckCircle2, Plus, Hash, Activity, Search,
  BarChart2, Edit3, Shield, Zap, Network, ArrowRight, History
} from "lucide-react";
import { cn } from "@/lib/utils";

interface ConversationMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: string;
  type?: "text" | "note" | "plan" | "analysis" | "summary" | "assessment";
  structured_output?: StructuredOutput;
  loading?: boolean;
}

interface StructuredOutput {
  format: "soap" | "dap" | "birp" | "treatment_plan" | "summary" | "assessment" | "referral";
  content: string;
  metadata?: Record<string, string>;
}

type WorkspaceMode =
  | "copilot"
  | "note_generator"
  | "session_prep"
  | "patient_summary"
  | "treatment_planner"
  | "assessment_analyzer"
  | "referral_writer";

const MODE_CONFIG: Record<WorkspaceMode, {
  label: string;
  description: string;
  icon: React.ElementType;
  color: string;
  prompt_placeholder: string;
}> = {
  copilot: {
    label: "AI Copilot",
    description: "Ask anything clinical",
    icon: Brain,
    color: "text-indigo-600 bg-indigo-50",
    prompt_placeholder: "Ask the AI anything — clinical questions, patient analysis, treatment options, research..."
  },
  note_generator: {
    label: "Note Generator",
    description: "Generate SOAP/DAP/BIRP",
    icon: FileText,
    color: "text-blue-600 bg-blue-50",
    prompt_placeholder: "Describe the session or paste transcript, and the AI will generate clinical notes..."
  },
  session_prep: {
    label: "Session Prep",
    description: "Prepare for next session",
    icon: Calendar,
    color: "text-emerald-600 bg-emerald-50",
    prompt_placeholder: "Which patient are you preparing for? I'll pull their history, recent progress, and suggest focus areas..."
  },
  patient_summary: {
    label: "Patient Summary",
    description: "Comprehensive overview",
    icon: User,
    color: "text-amber-600 bg-amber-50",
    prompt_placeholder: "Which patient would you like summarized? I'll generate a clinical summary from their entire history..."
  },
  treatment_planner: {
    label: "Treatment Planner",
    description: "Evidence-based planning",
    icon: Target,
    color: "text-rose-600 bg-rose-50",
    prompt_placeholder: "Describe the patient's presentation, diagnoses, and goals — I'll suggest an evidence-based treatment plan..."
  },
  assessment_analyzer: {
    label: "Assessment Analyzer",
    description: "Interpret scores & trends",
    icon: BarChart2,
    color: "text-purple-600 bg-purple-50",
    prompt_placeholder: "Share assessment results or ask me to analyze a patient's assessment history..."
  },
  referral_writer: {
    label: "Referral Writer",
    description: "Professional letters",
    icon: ArrowRight,
    color: "text-teal-600 bg-teal-50",
    prompt_placeholder: "Who are you referring? To whom? For what purpose? I'll draft a professional referral letter..."
  },
};

const QUICK_PROMPTS: { label: string; mode: WorkspaceMode; prompt: string }[] = [
  { label: "Prepare for Sarah's session", mode: "session_prep", prompt: "Prepare me for my next session with Sarah Chen. Pull her recent progress, previous session focus, and suggest what to explore." },
  { label: "Generate SOAP note", mode: "note_generator", prompt: "Generate a SOAP note for Sarah Chen's session today. She reported reduced anxiety, discussed work stress, and practiced 4-7-8 breathing." },
  { label: "Analyze PHQ-9 trend", mode: "assessment_analyzer", prompt: "Analyze Sarah Chen's PHQ-9 trend over the last 6 months and provide clinical interpretation." },
  { label: "Draft treatment update", mode: "treatment_planner", prompt: "Update Sarah Chen's treatment plan based on progress in Sessions 20-24. She's achieved the CBT homework goal." },
  { label: "Referral to psychiatrist", mode: "referral_writer", prompt: "Draft a referral letter for Sarah Chen to Dr. Jennifer Walsh's colleague for a medication review." },
  { label: "Summarize Marcus Webb", mode: "patient_summary", prompt: "Generate a comprehensive clinical summary for Marcus Webb, highlighting diagnosis, progress, current goals, and key clinical observations." },
];

const MOCK_AI_RESPONSES: Record<string, ConversationMessage> = {
  session_prep_sarah: {
    id: "r1", role: "assistant",
    content: "Here's your Session #25 preparation brief for Sarah Chen:",
    timestamp: new Date().toISOString(),
    type: "summary",
    structured_output: {
      format: "summary",
      content: `**SESSION PREPARATION BRIEF**
**Patient:** Sarah Chen | **Session #25** | **December 22, 2025 — 10:00 AM**

---

**SINCE LAST SESSION (Dec 15)**
• Mood logs show consistent 6-7/10 this week — improvement from 5-6 range
• Completed breathing exercises 4-5x this week (up from 2-3x)
• No crisis indicators or concerning mood dips

**PREVIOUS SESSION THEMES**
• Anxiety coping strategies for work performance review
• Cognitive restructuring: successfully challenged 2 perfectionist thoughts during session
• Introduced year-end stress preparation framework

**HOMEWORK CHECK**
✅ Thought record worksheet (reported 3 entries)
⚠️ Gratitude journaling (2/7 days — explore barriers)
✅ 4-7-8 breathing (4-5x daily)
❓ Social activity (unclear — ask directly)

**SUGGESTED FOCUS AREAS**
1. Review year-end performance review outcome — key anxiety trigger
2. Explore gratitude journaling resistance — possible perfectionism avoidance
3. Assess seasonal mood pattern (Nov-Jan dip expected — proactive coping)
4. Check in on social experiment from Session #22

**CLINICAL NOTES**
• Patient enters holiday season — historically higher anxiety (3rd year pattern)
• PHQ-9 due this session (#25) — last score 13, expected improvement
• Consider discussing self-compassion progress from Session #23 work

**SUGGESTED OPENING QUESTION**
"How did the year-end review go? I know we talked about preparing for it last time."

**RISK LEVEL:** Moderate-Low → No indicators, stable trend, good engagement`,
      metadata: { generated_at: new Date().toISOString(), confidence: "High" }
    }
  },
  note_sarah: {
    id: "r2", role: "assistant",
    content: "SOAP note generated for Session #25:",
    timestamp: new Date().toISOString(),
    type: "note",
    structured_output: {
      format: "soap",
      content: `**SOAP NOTE — Session #25**
**Date:** December 22, 2025 | **Duration:** 50 minutes
**Provider:** Dr. Alex Smith | **Patient:** Sarah Chen

---

**S — SUBJECTIVE**
Patient presents in good spirits, reporting a "better week than usual." Year-end performance review completed — received positive feedback, though patient reports difficulty fully accepting the validation ("I keep waiting for the other shoe to drop"). Mood averaged 6-7/10 this week. Sleep improved to 7.5 hours average. Continues Lexapro 10mg without side effects. Completed breathing exercises 4-5x daily. Reports gratitude journaling as "difficult to do consistently."

**O — OBJECTIVE**
Patient appeared calm and engaged throughout session. Affect congruent with reported mood. Demonstrated spontaneous use of cognitive reframing when discussing workplace feedback. PHQ-9 administered: Score 11 (Moderate) — decrease of 2 points from Session #24 (score 13), continued improvement trend. GAD-7: Score 7 (Mild). Eye contact good, no psychomotor agitation observed.

**A — ASSESSMENT**
Patient continues to make meaningful progress across multiple domains. PHQ-9 decline reflects therapeutic gains in cognitive restructuring and behavioral activation. The difficulty accepting positive feedback is clinically significant — represents core schema activation (performance = worth). Seasonal risk window entering (November-January historical pattern) — monitoring required. Gratitude journaling resistance warrants exploration; may relate to perfectionism avoidance. Overall trajectory positive with maintained engagement and homework compliance.

**P — PLAN**
1. Continue CBT focus on core schema: performance ≠ worthiness
2. Explore gratitude journaling barriers — lower threshold, adjust structure
3. Introduce holiday season coping plan (seasonal pattern proactive management)
4. Homework: (a) Thought records x5 this week, (b) Schedule one social event, (c) Gratitude: 1 item only (reduced threshold)
5. PHQ-9 reassessment at Session #27
6. Next session: December 29, 2025 — continue present focus

**Risk Assessment:** Low. No suicidal ideation, self-harm, or crisis indicators. Patient engaged and future-oriented.`,
      metadata: { note_format: "SOAP", session_number: "25", confidence: "High" }
    }
  }
};

const WORKSPACE_TEMPLATES = [
  { id: "t1", name: "Session SOAP Note", category: "Documentation" },
  { id: "t2", name: "DAP Progress Note", category: "Documentation" },
  { id: "t3", name: "Treatment Plan Update", category: "Clinical" },
  { id: "t4", name: "Patient Clinical Summary", category: "Clinical" },
  { id: "t5", name: "Psychiatry Referral Letter", category: "Referral" },
  { id: "t6", name: "Insurance Prior Auth Note", category: "Administrative" },
];

export default function AIWorkspacePage() {
  const [activeMode, setActiveMode] = useState<WorkspaceMode>("copilot");
  const [messages, setMessages] = useState<ConversationMessage[]>([
    {
      id: "welcome", role: "assistant",
      content: "Welcome to the AI Workspace. I'm your clinical AI assistant with full access to your patients' memory layers, session history, and clinical intelligence.\n\nWhat would you like to work on today?",
      timestamp: new Date().toISOString(),
    }
  ]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [selectedPatient, setSelectedPatient] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendMessage = (text: string) => {
    if (!text.trim() || isLoading) return;

    const userMsg: ConversationMessage = {
      id: `u${Date.now()}`, role: "user", content: text, timestamp: new Date().toISOString()
    };
    const loadingMsg: ConversationMessage = {
      id: `loading${Date.now()}`, role: "assistant", content: "", timestamp: new Date().toISOString(), loading: true
    };

    setMessages(prev => [...prev, userMsg, loadingMsg]);
    setInput("");
    setIsLoading(true);

    setTimeout(() => {
      setIsLoading(false);
      const key = text.toLowerCase().includes("prepare") && text.toLowerCase().includes("sarah") ? "session_prep_sarah" :
                  text.toLowerCase().includes("soap") || text.toLowerCase().includes("note") ? "note_sarah" : null;

      const response = key
        ? { ...MOCK_AI_RESPONSES[key], id: `r${Date.now()}`, timestamp: new Date().toISOString() }
        : {
            id: `r${Date.now()}`, role: "assistant" as const,
            content: `I've analyzed the request based on available patient data and clinical context.\n\nFor a full response, the AI system would process this against:\n• Patient memory knowledge graph\n• Session history and transcripts\n• Assessment data and trends\n• Clinical guidelines and DSM frameworks\n• Evidence-based treatment protocols\n\nIn the live platform, a detailed, clinically-informed response would appear here within 3-5 seconds.`,
            timestamp: new Date().toISOString()
          };

      setMessages(prev => prev.filter(m => !m.loading).concat(response));
    }, 2000);
  };

  const copyToClipboard = (id: string, content: string) => {
    navigator.clipboard.writeText(content);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleQuickPrompt = (qp: typeof QUICK_PROMPTS[0]) => {
    setActiveMode(qp.mode);
    setInput(qp.prompt);
  };

  return (
    <div className="flex h-full gap-0 -mx-6 -mt-6">
      {/* Left Panel — Mode selector + history */}
      <div className="w-72 border-r border-gray-200 bg-white flex flex-col h-screen overflow-y-auto">
        <div className="p-4 border-b border-gray-100">
          <div className="flex items-center gap-2 mb-1">
            <Brain className="h-5 w-5 text-[#0A2342]" />
            <h2 className="font-bold text-[#0A2342]">AI Workspace</h2>
          </div>
          <p className="text-xs text-gray-500">Clinical intelligence at your fingertips</p>
        </div>

        {/* Mode selector */}
        <div className="p-4 border-b border-gray-100">
          <p className="text-xs text-gray-400 uppercase tracking-wide mb-3">Mode</p>
          <div className="space-y-1">
            {(Object.entries(MODE_CONFIG) as [WorkspaceMode, typeof MODE_CONFIG[WorkspaceMode]][]).map(([mode, config]) => {
              const Icon = config.icon;
              return (
                <button
                  key={mode}
                  onClick={() => { setActiveMode(mode); setInput(""); }}
                  className={cn(
                    "w-full flex items-center gap-3 p-2.5 rounded-xl text-sm transition-all text-left",
                    activeMode === mode ? "bg-[#0A2342] text-white" : "text-gray-700 hover:bg-gray-50"
                  )}
                >
                  <div className={cn("w-7 h-7 rounded-lg flex items-center justify-center", activeMode === mode ? "bg-white/10" : config.color)}>
                    <Icon className="h-3.5 w-3.5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-xs">{config.label}</p>
                    <p className={cn("text-xs truncate", activeMode === mode ? "text-white/60" : "text-gray-400")}>{config.description}</p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Quick prompts */}
        <div className="p-4 flex-1">
          <p className="text-xs text-gray-400 uppercase tracking-wide mb-3">Quick Actions</p>
          <div className="space-y-1.5">
            {QUICK_PROMPTS.map(qp => {
              const modeConf = MODE_CONFIG[qp.mode];
              const Icon = modeConf.icon;
              return (
                <button
                  key={qp.label}
                  onClick={() => handleQuickPrompt(qp)}
                  className="w-full flex items-center gap-2 p-2.5 rounded-xl text-xs text-gray-600 hover:bg-gray-50 hover:text-gray-900 transition-all text-left border border-gray-100 hover:border-gray-200"
                >
                  <Icon className={cn("h-3.5 w-3.5 shrink-0", modeConf.color.split(" ")[0])} />
                  <span className="line-clamp-1">{qp.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Main chat area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Mode header */}
        <div className="bg-white border-b border-gray-200 px-6 py-3 flex items-center gap-4">
          {(() => {
            const config = MODE_CONFIG[activeMode];
            const Icon = config.icon;
            return (
              <>
                <div className={cn("w-9 h-9 rounded-xl flex items-center justify-center", config.color)}>
                  <Icon className="h-4.5 w-4.5" style={{ width: 18, height: 18 }} />
                </div>
                <div>
                  <h2 className="font-semibold text-gray-900 text-sm">{config.label}</h2>
                  <p className="text-xs text-gray-400">{config.description}</p>
                </div>
              </>
            );
          })()}

          <div className="ml-auto flex items-center gap-2">
            <div className="flex items-center gap-1.5 text-xs text-emerald-600 bg-emerald-50 px-2.5 py-1.5 rounded-xl border border-emerald-100">
              <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
              Memory Layer Active
            </div>
            <button className="p-2 text-gray-400 hover:text-gray-600 rounded-xl hover:bg-gray-100">
              <RefreshCw className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          {messages.map(msg => (
            <div key={msg.id} className={cn("flex gap-3", msg.role === "user" ? "justify-end" : "justify-start")}>
              {msg.role === "assistant" && (
                <div className="w-8 h-8 bg-gradient-to-br from-[#0A2342] to-[#2F80ED] rounded-xl flex items-center justify-center shrink-0 mt-1">
                  <Brain className="h-4 w-4 text-white" />
                </div>
              )}

              <div className={cn("max-w-[85%]", msg.role === "user" ? "items-end" : "items-start", "flex flex-col gap-2")}>
                {msg.loading ? (
                  <div className="bg-white border border-gray-200 rounded-2xl px-4 py-3 flex items-center gap-2">
                    <Loader2 className="h-4 w-4 text-indigo-500 animate-spin" />
                    <span className="text-sm text-gray-500">AI is analyzing...</span>
                  </div>
                ) : (
                  <>
                    <div className={cn(
                      "rounded-2xl px-4 py-3",
                      msg.role === "user" ? "bg-[#0A2342] text-white" : "bg-white border border-gray-200"
                    )}>
                      <p className={cn("text-sm whitespace-pre-line leading-relaxed", msg.role === "user" ? "text-white" : "text-gray-800")}>
                        {msg.content}
                      </p>
                    </div>

                    {/* Structured output */}
                    {msg.structured_output && (
                      <div className="w-full bg-white border border-gray-200 rounded-2xl overflow-hidden">
                        <div className="flex items-center justify-between px-4 py-3 bg-gray-50 border-b border-gray-100">
                          <div className="flex items-center gap-2">
                            <FileText className="h-4 w-4 text-gray-500" />
                            <span className="text-xs font-semibold text-gray-700 uppercase tracking-wide">
                              {msg.structured_output.format === "soap" ? "SOAP Note" :
                               msg.structured_output.format === "summary" ? "Session Brief" :
                               msg.structured_output.format === "treatment_plan" ? "Treatment Plan" : msg.structured_output.format.replace(/_/g, " ")}
                            </span>
                            <span className="text-xs text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded font-medium">AI Generated</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => copyToClipboard(msg.id, msg.structured_output!.content)}
                              className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 text-xs flex items-center gap-1"
                            >
                              {copiedId === msg.id ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
                            </button>
                            <button className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100">
                              <Download className="h-3.5 w-3.5" />
                            </button>
                            <button className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100">
                              <Edit3 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </div>
                        <div className="p-4 max-h-[500px] overflow-y-auto">
                          <pre className="text-xs text-gray-700 whitespace-pre-wrap font-sans leading-relaxed">
                            {msg.structured_output.content}
                          </pre>
                        </div>
                        <div className="flex items-center gap-3 px-4 py-3 bg-gray-50 border-t border-gray-100">
                          <button className="flex-1 py-2 bg-[#0A2342] text-white rounded-xl text-xs font-medium hover:bg-[#123A63]">
                            Approve & Save to Patient Record
                          </button>
                          <button className="py-2 px-4 border border-gray-200 text-gray-600 rounded-xl text-xs hover:bg-gray-50">
                            Edit First
                          </button>
                        </div>
                      </div>
                    )}
                  </>
                )}

                <p className="text-xs text-gray-400 px-1">
                  {new Date(msg.timestamp).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}
                </p>
              </div>

              {msg.role === "user" && (
                <div className="w-8 h-8 bg-gray-200 rounded-xl flex items-center justify-center shrink-0 mt-1">
                  <User className="h-4 w-4 text-gray-600" />
                </div>
              )}
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="bg-white border-t border-gray-200 p-4">
          <div className="flex items-start gap-3">
            <div className="flex-1 border border-gray-200 rounded-2xl overflow-hidden focus-within:border-[#0A2342] focus-within:ring-2 focus-within:ring-[#0A2342]/10 transition-all">
              <textarea
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(input); } }}
                placeholder={MODE_CONFIG[activeMode].prompt_placeholder}
                className="w-full px-4 pt-3 pb-2 text-sm text-gray-700 placeholder-gray-400 focus:outline-none resize-none bg-transparent"
                rows={2}
              />
              <div className="flex items-center gap-2 px-4 pb-3">
                <span className="text-xs text-gray-400">Patient memory: Active</span>
                <span className="text-xs text-gray-300">·</span>
                <span className="text-xs text-gray-400">Clinical knowledge: Loaded</span>
              </div>
            </div>
            <button
              onClick={() => sendMessage(input)}
              disabled={!input.trim() || isLoading}
              className="p-3 bg-[#0A2342] text-white rounded-2xl disabled:opacity-40 hover:bg-[#123A63] transition-colors"
            >
              {isLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
            </button>
          </div>

          <div className="flex items-center gap-2 mt-2">
            <Shield className="h-3 w-3 text-gray-300" />
            <p className="text-xs text-gray-400">AI responses are for clinical assistance only. Therapist review and approval required before use in patient records.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
