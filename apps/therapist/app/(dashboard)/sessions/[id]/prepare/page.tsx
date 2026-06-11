"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft, Brain, Calendar, Clock, Target, Pill,
  Activity, AlertTriangle, FileText, CheckCircle2,
  Play, ChevronRight, Zap, Star, TrendingUp, TrendingDown
} from "lucide-react";
import { cn } from "@/lib/utils";
import { sessionsAPI, aiAPI, patientsAPI } from "@/lib/api";

const MEMORY_TYPE_COLORS: Record<string, string> = {
  trigger: "bg-red-50 text-red-700 border-red-100",
  strength: "bg-green-50 text-green-700 border-green-100",
  behavior: "bg-blue-50 text-blue-700 border-blue-100",
  goal: "bg-purple-50 text-purple-700 border-purple-100",
};

export default function SessionPreparePage() {
  const { id } = useParams();
  const sessionId = Array.isArray(id) ? id[0] : id as string;
  const [session, setSession] = useState<Record<string, unknown> | null>(null);
  const [copilot, setCopilot] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const [sessionData, copilotData] = await Promise.allSettled([
          sessionsAPI.get(sessionId),
          aiAPI.copilotSuggestions(sessionId),
        ]);
        if (sessionData.status === "fulfilled") setSession(sessionData.value as Record<string, unknown>);
        if (copilotData.status === "fulfilled") setCopilot(copilotData.value as Record<string, unknown>);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [sessionId]);

  if (loading) return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-violet-600" /></div>;

  // Build prep data from real session + AI copilot, with graceful fallbacks
  const patientName = (session?.patient_name as string) || (session?.patient as Record<string,unknown>)?.name as string || "Patient";
  const prep = {
    context_summary: (copilot?.context_summary as string) || (copilot?.summary as string) || "AI session brief not available — click Start Session to begin.",
    last_session_highlights: (copilot?.last_session_highlights as string[]) || [],
    suggested_agenda: (copilot?.suggested_agenda as string[]) || [],
    memory_highlights: (copilot?.memory_highlights as { type: string; text: string; confidence: string }[]) || [],
    risk_factors: (copilot?.risk_factors as string[]) || [],
    focus_areas: (copilot?.focus_areas as string[]) || [],
  };

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link
            href="/sessions"
            className="p-2 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div>
            <h1 className="text-xl font-bold text-slate-900">Session Preparation</h1>
            <p className="text-sm text-slate-500">
              {patientName} · Session #{(session?.session_number as number) || ""} · Today {session?.scheduled_at ? new Date(session.scheduled_at as string).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }) : ""}
            </p>
          </div>
        </div>
        <Link
          href={`/sessions/${id}/room`}
          className="flex items-center gap-2 h-10 px-5 bg-secondary text-white rounded-xl text-sm font-semibold hover:bg-secondary/90 transition-colors"
        >
          <Play className="w-4 h-4" />
          Start Session
        </Link>
      </div>

      {/* Risk Banner */}
      {prep.risk_factors.length > 0 && (
        <div className="flex items-start gap-3 p-4 rounded-xl border bg-amber-50 border-amber-200">
          <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0 text-amber-500" />
          <div>
            <div className="text-sm font-semibold text-amber-700">Risk Factors Noted</div>
            <p className="text-xs mt-0.5 text-amber-600">
              Active risk factors: {prep.risk_factors.join(", ")}. Safety plan on file.
            </p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-3 gap-5">
        {/* Left column — AI prep */}
        <div className="col-span-2 space-y-4">
          {/* AI Context Summary */}
          <div className="bg-gradient-to-br from-primary to-primary/90 rounded-xl text-white p-5">
            <div className="flex items-center gap-2 mb-3">
              <Brain className="w-4 h-4 text-accent" />
              <h2 className="text-sm font-bold">AI Pre-Session Context</h2>
              <span className="text-[10px] bg-white/20 px-1.5 py-0.5 rounded">24 sessions analyzed</span>
            </div>
            <p className="text-sm text-white/80 leading-relaxed">{prep.context_summary}</p>
          </div>

          {/* Last Session Highlights */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-card p-5">
            <h2 className="text-sm font-semibold text-slate-800 mb-3 flex items-center gap-2">
              <Clock className="w-4 h-4 text-slate-400" />
              Last Session Highlights
            </h2>
            <ul className="space-y-2">
              {prep.last_session_highlights.map((h, i) => (
                <li key={i} className="flex items-start gap-2">
                  <div className="w-4 h-4 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 shrink-0 mt-0.5">
                    <span className="text-[10px] font-bold">{i + 1}</span>
                  </div>
                  <span className="text-sm text-slate-700">{h}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Suggested Agenda */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-card p-5">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-slate-800 flex items-center gap-2">
                <Zap className="w-4 h-4 text-accent" />
                AI Suggested Agenda
              </h2>
              <button className="text-xs text-secondary hover:underline">Edit</button>
            </div>
            <ul className="space-y-2.5">
              {prep.suggested_agenda.map((item, i) => (
                <li key={i} className="flex items-start gap-3">
                  <span className="w-5 h-5 bg-secondary/10 text-secondary text-xs font-bold rounded flex items-center justify-center shrink-0 mt-0.5">
                    {i + 1}
                  </span>
                  <span className="text-sm text-slate-700">{item}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Memory Highlights */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-card p-5">
            <h2 className="text-sm font-semibold text-slate-800 mb-3 flex items-center gap-2">
              <Brain className="w-4 h-4 text-accent" />
              Key Memory Nodes
            </h2>
            <div className="space-y-2">
              {prep.memory_highlights.map((mem, i) => (
                <div key={i} className={cn(
                  "flex items-start gap-2 px-3 py-2 rounded-lg border text-sm",
                  MEMORY_TYPE_COLORS[mem.type] || "bg-slate-50 border-slate-100"
                )}>
                  <span className="text-[10px] font-bold uppercase opacity-60 shrink-0 mt-0.5">
                    {mem.type.replace("_", " ")}
                  </span>
                  <span className="leading-relaxed">{mem.text}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right column */}
        <div className="space-y-4">
          {/* Assessments */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-card p-4">
            <h3 className="text-sm font-semibold text-slate-800 mb-3 flex items-center gap-2">
              <Activity className="w-4 h-4 text-secondary" />
              Assessment Scores
            </h3>
            {((copilot?.assessments as { name: string; last_score: number; trend: string }[]) || []).map((a) => (
              <div key={a.name} className="mb-3 last:mb-0">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-medium text-slate-700">{a.name}</span>
                  <div className="flex items-center gap-1">
                    {a.trend === "improving" ? (
                      <TrendingDown className="w-3 h-3 text-green-500" />
                    ) : (
                      <div className="w-3 h-3 text-amber-500">–</div>
                    )}
                    <span className={cn("text-sm font-bold", a.trend === "improving" ? "text-green-600" : "text-amber-600")}>
                      {a.last_score}
                    </span>
                    <span className="text-xs text-slate-400">/ {a.name === "PHQ-9" ? "27" : "21"}</span>
                  </div>
                </div>
                <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className={cn("h-full rounded-full", a.last_score <= 9 ? "bg-green-400" : a.last_score <= 14 ? "bg-amber-400" : "bg-red-400")}
                    style={{ width: `${(a.last_score / (a.name === "PHQ-9" ? 27 : 21)) * 100}%` }}
                  />
                </div>
              </div>
            ))}
            {!copilot?.assessments && <p className="text-xs text-slate-400">No recent assessments on file.</p>}
          </div>

          {/* Medications */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-card p-4">
            <h3 className="text-sm font-semibold text-slate-800 mb-3 flex items-center gap-2">
              <Pill className="w-4 h-4 text-blue-500" />
              Active Medications
            </h3>
            <div className="space-y-2">
              {((copilot?.medications as { name: string; frequency: string }[]) || []).map((med) => (
                <div key={med.name} className="text-xs">
                  <div className="font-medium text-slate-800">{med.name}</div>
                  <div className="text-slate-500">{med.frequency}</div>
                </div>
              ))}
              {!copilot?.medications && <p className="text-xs text-slate-400">No medications on file.</p>}
            </div>
          </div>

          {/* Homework */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-card p-4">
            <h3 className="text-sm font-semibold text-slate-800 mb-3 flex items-center gap-2">
              <Target className="w-4 h-4 text-green-500" />
              Homework Check
            </h3>
            <div className="space-y-2">
              {((copilot?.pending_homework as { task: string; completed: boolean }[]) || []).map((hw, i) => (
                <div key={i} className={cn("flex items-start gap-2 p-2 rounded-lg text-xs", hw.completed ? "bg-green-50" : "bg-amber-50")}>
                  {hw.completed ? (
                    <CheckCircle2 className="w-3.5 h-3.5 text-green-500 shrink-0 mt-0.5" />
                  ) : (
                    <div className="w-3.5 h-3.5 rounded-full border-2 border-amber-400 shrink-0 mt-0.5" />
                  )}
                  <span className={hw.completed ? "text-green-700" : "text-amber-700"}>{hw.task}</span>
                </div>
              ))}
              {!copilot?.pending_homework && <p className="text-xs text-slate-400">No homework assigned.</p>}
            </div>
          </div>

          {/* Focus Areas */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-card p-4">
            <h3 className="text-sm font-semibold text-slate-800 mb-3 flex items-center gap-2">
              <Star className="w-4 h-4 text-amber-500" />
              Suggested Focus
            </h3>
            <div className="flex flex-wrap gap-1.5">
              {prep.focus_areas.map((area) => (
                <span key={area} className="text-xs bg-secondary/10 text-secondary px-2 py-0.5 rounded-full font-medium">
                  {area}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
