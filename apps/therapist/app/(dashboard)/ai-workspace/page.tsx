"use client";

import { useState, useRef, useEffect } from "react";
import {
  Brain, Send, User, Sparkles, FileText, Target,
  Calendar, MessageSquare, Lightbulb,
  TrendingUp, BarChart2,
  Loader2, Copy, Download,
  RefreshCw, CheckCircle2, Plus,
  Edit3, Shield, ArrowRight
} from "lucide-react";
import { cn } from "@/lib/utils";
import { aiAPI, APIError } from "@/lib/api";

interface ConversationMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: string;
  type?: "text" | "note" | "plan" | "analysis" | "summary" | "assessment";
  structured_output?: StructuredOutput;
  loading?: boolean;
  error?: boolean;
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
    prompt_placeholder: "Ask the AI anything — clinical questions, patient analysis, treatment options, research...",
  },
  note_generator: {
    label: "Note Generator",
    description: "Generate SOAP/DAP/BIRP",
    icon: FileText,
    color: "text-blue-600 bg-blue-50",
    prompt_placeholder: "Describe the session or paste transcript, and the AI will generate clinical notes...",
  },
  session_prep: {
    label: "Session Prep",
    description: "Prepare for next session",
    icon: Calendar,
    color: "text-emerald-600 bg-emerald-50",
    prompt_placeholder: "Which patient are you preparing for? I'll pull their history, recent progress, and suggest focus areas...",
  },
  patient_summary: {
    label: "Patient Summary",
    description: "Comprehensive overview",
    icon: User,
    color: "text-amber-600 bg-amber-50",
    prompt_placeholder: "Which patient would you like summarized? I'll generate a clinical summary from their entire history...",
  },
  treatment_planner: {
    label: "Treatment Planner",
    description: "Evidence-based planning",
    icon: Target,
    color: "text-rose-600 bg-rose-50",
    prompt_placeholder: "Describe the patient's presentation, diagnoses, and goals — I'll suggest an evidence-based treatment plan...",
  },
  assessment_analyzer: {
    label: "Assessment Analyzer",
    description: "Interpret scores & trends",
    icon: BarChart2,
    color: "text-purple-600 bg-purple-50",
    prompt_placeholder: "Share assessment results or ask me to analyze a patient's assessment history...",
  },
  referral_writer: {
    label: "Referral Writer",
    description: "Professional letters",
    icon: ArrowRight,
    color: "text-teal-600 bg-teal-50",
    prompt_placeholder: "Who are you referring? To whom? For what purpose? I'll draft a professional referral letter...",
  },
};

const QUICK_PROMPTS: { label: string; mode: WorkspaceMode; prompt: string }[] = [
  { label: "Prepare for next session", mode: "session_prep", prompt: "Prepare me for my next session with a patient. Pull recent progress, previous session focus, and suggest what to explore." },
  { label: "Generate SOAP note", mode: "note_generator", prompt: "Generate a SOAP note for today's session. Please provide the patient name and key session details." },
  { label: "Analyze PHQ-9 trend", mode: "assessment_analyzer", prompt: "Analyze a patient's PHQ-9 trend over the last 6 months and provide clinical interpretation." },
  { label: "Draft treatment update", mode: "treatment_planner", prompt: "Update a patient's treatment plan based on recent progress. Please describe the patient and recent achievements." },
  { label: "Referral to psychiatrist", mode: "referral_writer", prompt: "Draft a referral letter for a patient to a psychiatrist for medication review." },
  { label: "Patient clinical summary", mode: "patient_summary", prompt: "Generate a comprehensive clinical summary for a patient, highlighting diagnosis, progress, current goals, and key clinical observations." },
];

/** Extract structured output blocks from AI response text */
function parseStructuredOutput(text: string, mode: WorkspaceMode): StructuredOutput | undefined {
  const lower = text.toLowerCase();

  // Detect format
  let format: StructuredOutput["format"] | null = null;
  if (mode === "note_generator") {
    if (lower.includes("subjective") && lower.includes("objective")) format = "soap";
    else if (lower.includes("data") && lower.includes("assessment") && lower.includes("plan")) format = "dap";
    else if (lower.includes("behavior") && lower.includes("intervention") && lower.includes("response")) format = "birp";
    else format = "soap";
  } else if (mode === "treatment_planner") {
    format = "treatment_plan";
  } else if (mode === "patient_summary" || mode === "session_prep") {
    format = "summary";
  } else if (mode === "assessment_analyzer") {
    format = "assessment";
  } else if (mode === "referral_writer") {
    format = "referral";
  }

  if (!format) return undefined;

  // If text is substantial (>200 chars) and has clinical structure, wrap it
  if (text.length > 200) {
    return {
      format,
      content: text,
      metadata: { generated_at: new Date().toISOString(), mode },
    };
  }
  return undefined;
}

export default function AIWorkspacePage() {
  const [activeMode, setActiveMode] = useState<WorkspaceMode>("copilot");
  const [messages, setMessages] = useState<ConversationMessage[]>([
    {
      id: "welcome",
      role: "assistant",
      content:
        "Welcome to the AI Workspace. I'm your clinical AI assistant with full access to your patients' memory layers, session history, and clinical intelligence.\n\nWhat would you like to work on today?",
      timestamp: new Date().toISOString(),
    },
  ]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (messagesContainerRef.current) {
      messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight;
    }
  }, [messages]);

  const sendMessage = async (text: string) => {
    if (!text.trim() || isLoading) return;

    const userMsg: ConversationMessage = {
      id: `u${Date.now()}`,
      role: "user",
      content: text,
      timestamp: new Date().toISOString(),
    };
    const loadingMsgId = `loading${Date.now()}`;
    const loadingMsg: ConversationMessage = {
      id: loadingMsgId,
      role: "assistant",
      content: "",
      timestamp: new Date().toISOString(),
      loading: true,
    };

    setMessages((prev) => [...prev, userMsg, loadingMsg]);
    setInput("");
    setIsLoading(true);

    try {
      const context: Record<string, unknown> = {
        mode: activeMode,
        conversation_history: messages
          .filter((m) => !m.loading && m.id !== "welcome")
          .slice(-6)
          .map((m) => ({ role: m.role, content: m.content })),
      };

      const result = await aiAPI.aiChat(text, context);

      const responseText =
        (result as { message?: string; content?: string; text?: string; response?: string })
          .message ??
        (result as { content?: string }).content ??
        (result as { text?: string }).text ??
        (result as { response?: string }).response ??
        String(result);

      const structured = parseStructuredOutput(responseText, activeMode);

      const assistantMsg: ConversationMessage = {
        id: `r${Date.now()}`,
        role: "assistant",
        content: structured
          ? responseText.split("\n")[0] || "Here is the AI-generated clinical content:"
          : responseText,
        timestamp: new Date().toISOString(),
        type: activeMode === "note_generator" ? "note" : activeMode === "patient_summary" || activeMode === "session_prep" ? "summary" : "text",
        structured_output: structured,
      };

      setMessages((prev) =>
        prev.filter((m) => m.id !== loadingMsgId).concat(assistantMsg)
      );
    } catch (err) {
      if (err instanceof APIError && err.status === 401) {
        setMessages((prev) => prev.filter((m) => m.id !== loadingMsgId));
        return;
      }

      const errorMsg: ConversationMessage = {
        id: `err${Date.now()}`,
        role: "assistant",
        content:
          `AI request failed: ${(err as Error).message}. Please try again.`,
        timestamp: new Date().toISOString(),
        error: true,
      };

      setMessages((prev) =>
        prev.filter((m) => m.id !== loadingMsgId).concat(errorMsg)
      );
    } finally {
      setIsLoading(false);
    }
  };

  const copyToClipboard = (id: string, content: string) => {
    navigator.clipboard.writeText(content);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleQuickPrompt = (qp: (typeof QUICK_PROMPTS)[0]) => {
    setActiveMode(qp.mode);
    setInput(qp.prompt);
  };

  const clearConversation = () => {
    setMessages([
      {
        id: "welcome",
        role: "assistant",
        content:
          "Welcome to the AI Workspace. I'm your clinical AI assistant with full access to your patients' memory layers, session history, and clinical intelligence.\n\nWhat would you like to work on today?",
        timestamp: new Date().toISOString(),
      },
    ]);
  };

  return (
    <div className="flex h-full overflow-hidden">
      {/* Left Panel */}
      <div className="w-72 border-r border-gray-200 bg-white flex flex-col min-h-0 overflow-y-auto">
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
            {(Object.entries(MODE_CONFIG) as [WorkspaceMode, (typeof MODE_CONFIG)[WorkspaceMode]][]).map(([mode, config]) => {
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
                    <p className={cn("text-xs truncate", activeMode === mode ? "text-white/60" : "text-gray-400")}>
                      {config.description}
                    </p>
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
            {QUICK_PROMPTS.map((qp) => {
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
                  <Icon style={{ width: 18, height: 18 }} />
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
            <button
              onClick={clearConversation}
              className="p-2 text-gray-400 hover:text-gray-600 rounded-xl hover:bg-gray-100"
              title="Clear conversation"
            >
              <RefreshCw className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Messages */}
        <div ref={messagesContainerRef} className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          {messages.map((msg) => (
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
                      msg.role === "user"
                        ? "bg-[#0A2342] text-white"
                        : msg.error
                        ? "bg-amber-50 border border-amber-200"
                        : "bg-white border border-gray-200"
                    )}>
                      <p className={cn(
                        "text-sm whitespace-pre-line leading-relaxed",
                        msg.role === "user" ? "text-white" : msg.error ? "text-amber-800" : "text-gray-800"
                      )}>
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
                               msg.structured_output.format === "summary" ? "Clinical Brief" :
                               msg.structured_output.format === "treatment_plan" ? "Treatment Plan" :
                               msg.structured_output.format === "referral" ? "Referral Letter" :
                               msg.structured_output.format === "assessment" ? "Assessment Report" :
                               msg.structured_output.format.replace(/_/g, " ").toUpperCase()}
                            </span>
                            <span className="text-xs text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded font-medium">
                              AI Generated
                            </span>
                          </div>
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => copyToClipboard(msg.id, msg.structured_output!.content)}
                              className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 text-xs flex items-center gap-1"
                            >
                              {copiedId === msg.id
                                ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                                : <Copy className="h-3.5 w-3.5" />}
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
        </div>

        {/* Input */}
        <div className="bg-white border-t border-gray-200 p-4">
          <div className="flex items-start gap-3">
            <div className="flex-1 border border-gray-200 rounded-2xl overflow-hidden focus-within:border-[#0A2342] focus-within:ring-2 focus-within:ring-[#0A2342]/10 transition-all">
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    sendMessage(input);
                  }
                }}
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
            <p className="text-xs text-gray-400">
              AI responses are for clinical assistance only. Therapist review and approval required before use in patient records.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
