"use client";

import { useParams } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft, Brain, Calendar, Clock, Target, Pill,
  Activity, AlertTriangle, FileText, CheckCircle2,
  Play, ChevronRight, Zap, Star, TrendingUp, TrendingDown
} from "lucide-react";
import { cn } from "@/lib/utils";

const MOCK_SESSION_PREP = {
  id: "s1",
  patient: {
    id: "p1", name: "Sarah Chen", age: 34,
    diagnosis: "Major Depressive Disorder, Moderate (F32.1)",
    sessions_count: 24, risk_level: "medium",
  },
  scheduled_at: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
  duration: 50,
  session_number: 25,
  ai_prep: {
    context_summary: "Sarah presents with MDD and comorbid GAD. PHQ-9 has improved from 19 to 13 over 16 months. Core themes include performance anxiety, perfectionism rooted in childhood attachment patterns, and work-related stress triggers.",
    last_session_highlights: [
      "Explored connection between perfectionism and father's emotional unavailability",
      "Practiced Double Standard Technique with positive initial response",
      "Patient completed breathing exercise homework successfully during work review",
    ],
    suggested_agenda: [
      "Check-in on homework: Thought Record Worksheet completion",
      "Continue Double Standard Technique work on perfectionism schema",
      "Review PHQ-9 scores — potential progress milestone",
      "Explore any new work-related stressors this week",
    ],
    memory_highlights: [
      { type: "trigger", text: "Work deadlines cause anxiety spike — strongest seasonal pattern in December", confidence: "high" },
      { type: "strength", text: "Strong response to Socratic questioning — insight-oriented approach works well", confidence: "confirmed" },
      { type: "behavior", text: "Sleep has been improving with evening breathing exercises (started Oct)", confidence: "medium" },
      { type: "goal", text: "Goal: Return to gym 3x/week — minimal progress; avoidance pattern", confidence: "high" },
    ],
    risk_factors: ["Performance anxiety (elevated seasonally)", "Self-criticism loop following success"],
    focus_areas: ["Perfectionism schema deconstruction", "Cognitive reframing", "Behavioral activation"],
  },
  medications: [
    { name: "Lexapro 10mg", frequency: "Daily morning", started: "Sept 2024", prescriber: "Dr. Walsh" },
    { name: "Melatonin 5mg", frequency: "As needed for sleep", started: "Sept 2024" },
  ],
  assessments: [
    { name: "PHQ-9", last_score: 13, previous_score: 14, trend: "improving", date: "Dec 15" },
    { name: "GAD-7", last_score: 8, previous_score: 8, trend: "stable", date: "Dec 15" },
  ],
  pending_homework: [
    { task: "Thought Record Worksheet — 3 completions minimum", assigned: "Dec 15", completed: false },
    { task: "Continue evening breathing exercise (4-7-8 technique)", assigned: "Dec 15", completed: true },
  ],
};

const MEMORY_TYPE_COLORS: Record<string, string> = {
  trigger: "bg-red-50 text-red-700 border-red-100",
  strength: "bg-green-50 text-green-700 border-green-100",
  behavior: "bg-blue-50 text-blue-700 border-blue-100",
  goal: "bg-purple-50 text-purple-700 border-purple-100",
};

export default function SessionPreparePage() {
  const { id } = useParams();
  const session = MOCK_SESSION_PREP;
  const prep = session.ai_prep;

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
              {session.patient.name} · Session #{session.session_number} · Today {new Date(session.scheduled_at).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
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
      {session.patient.risk_level !== "low" && (
        <div className={cn(
          "flex items-start gap-3 p-4 rounded-xl border",
          session.patient.risk_level === "high"
            ? "bg-red-50 border-red-200"
            : "bg-amber-50 border-amber-200"
        )}>
          <AlertTriangle className={cn(
            "w-4 h-4 mt-0.5 shrink-0",
            session.patient.risk_level === "high" ? "text-red-500" : "text-amber-500"
          )} />
          <div>
            <div className={cn(
              "text-sm font-semibold",
              session.patient.risk_level === "high" ? "text-red-700" : "text-amber-700"
            )}>
              Risk Level: {session.patient.risk_level.toUpperCase()}
            </div>
            <p className={cn(
              "text-xs mt-0.5",
              session.patient.risk_level === "high" ? "text-red-600" : "text-amber-600"
            )}>
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
            {session.assessments.map((a) => (
              <div key={a.name} className="mb-3 last:mb-0">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-medium text-slate-700">{a.name}</span>
                  <div className="flex items-center gap-1">
                    {a.trend === "improving" ? (
                      <TrendingDown className="w-3 h-3 text-green-500" />
                    ) : (
                      <div className="w-3 h-3 text-amber-500">–</div>
                    )}
                    <span className={cn(
                      "text-sm font-bold",
                      a.trend === "improving" ? "text-green-600" : "text-amber-600"
                    )}>
                      {a.last_score}
                    </span>
                    <span className="text-xs text-slate-400">/ {a.name === "PHQ-9" ? "27" : "21"}</span>
                  </div>
                </div>
                <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className={cn(
                      "h-full rounded-full",
                      a.last_score <= 9 ? "bg-green-400" :
                      a.last_score <= 14 ? "bg-amber-400" : "bg-red-400"
                    )}
                    style={{ width: `${(a.last_score / (a.name === "PHQ-9" ? 27 : 21)) * 100}%` }}
                  />
                </div>
              </div>
            ))}
          </div>

          {/* Medications */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-card p-4">
            <h3 className="text-sm font-semibold text-slate-800 mb-3 flex items-center gap-2">
              <Pill className="w-4 h-4 text-blue-500" />
              Active Medications
            </h3>
            <div className="space-y-2">
              {session.medications.map((med) => (
                <div key={med.name} className="text-xs">
                  <div className="font-medium text-slate-800">{med.name}</div>
                  <div className="text-slate-500">{med.frequency}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Homework */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-card p-4">
            <h3 className="text-sm font-semibold text-slate-800 mb-3 flex items-center gap-2">
              <Target className="w-4 h-4 text-green-500" />
              Homework Check
            </h3>
            <div className="space-y-2">
              {session.pending_homework.map((hw, i) => (
                <div key={i} className={cn(
                  "flex items-start gap-2 p-2 rounded-lg text-xs",
                  hw.completed ? "bg-green-50" : "bg-amber-50"
                )}>
                  {hw.completed ? (
                    <CheckCircle2 className="w-3.5 h-3.5 text-green-500 shrink-0 mt-0.5" />
                  ) : (
                    <div className="w-3.5 h-3.5 rounded-full border-2 border-amber-400 shrink-0 mt-0.5" />
                  )}
                  <span className={hw.completed ? "text-green-700" : "text-amber-700"}>
                    {hw.task}
                  </span>
                </div>
              ))}
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
