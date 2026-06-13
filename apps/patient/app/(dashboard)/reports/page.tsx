"use client";

import { useState, useEffect } from "react";
import {
  FileText, Download, Eye, Calendar, Clock, User, CheckCircle2,
  Lock, Star, TrendingUp, TrendingDown, Minus, ChevronRight,
  Brain, Target, Pill, Heart, Shield, ExternalLink, Filter,
  BookOpen, ArrowLeft, Printer, Share2, Activity
} from "lucide-react";
import { cn } from "@/lib/utils";
import { apiFetch } from "@/lib/api";

interface SessionReport {
  id: string;
  session_number: number;
  date: string;
  duration: number;
  therapist: string;
  status: "available" | "pending" | "not_shared";
  type: "SOAP" | "Progress" | "Summary";
  summary: string;
  key_themes: string[];
  insights: string[];
  goals_progress: GoalProgress[];
  homework: string[];
  next_steps: string[];
  mood_before?: number;
  mood_after?: number;
  rating?: number;
  approved_at: string;
}

interface GoalProgress {
  title: string;
  progress: number;
  change: number;
  status: "on_track" | "needs_attention" | "achieved";
}

const REPORTS_PLACEHOLDER: SessionReport[] = [
  {
    id: "r1",
    session_number: 24,
    date: "2025-12-15",
    duration: 50,
    therapist: "Dr. Alex Smith",
    status: "available",
    type: "Progress",
    approved_at: "2025-12-16",
    summary: "Today's session focused on developing comprehensive anxiety coping strategies in the context of year-end work pressure. Sarah demonstrated excellent self-awareness by identifying specific situational triggers and has begun applying CBT techniques with notable success.",
    key_themes: [
      "Work-related anxiety management",
      "Cognitive restructuring for perfectionism",
      "Sleep hygiene reinforcement",
      "Upcoming year-end stress preparation"
    ],
    insights: [
      "Sarah showed significant improvement in identifying cognitive distortions in real-time. She was able to catch and challenge a perfectionist thought during our session itself — a meaningful skill milestone.",
      "The connection between sleep quality and next-day anxiety is well-established for Sarah. Consistent sleep hygiene remains a high-leverage intervention.",
      "Sarah's use of the breathing exercises has been more consistent. She reported using them 3-4 times this week, which is an improvement."
    ],
    goals_progress: [
      { title: "PHQ-9 below 9", progress: 52, change: 5, status: "on_track" },
      { title: "5 coping strategies", progress: 80, change: 10, status: "on_track" },
      { title: "Sleep 7+ hours consistently", progress: 70, change: 5, status: "on_track" },
    ],
    homework: [
      "Continue thought record worksheet — focus on work-related automatic thoughts",
      "Practice 4-7-8 breathing 2x daily (morning and before bed)",
      "Write 3 gratitude items nightly before sleep",
      "Schedule one social activity before next session"
    ],
    next_steps: [
      "Review thought records at next session",
      "Assess PHQ-9 at Session #25",
      "Discuss year-end review outcomes",
      "Plan holiday season coping strategy"
    ],
    mood_before: 6,
    mood_after: 7,
    rating: 5
  },
  {
    id: "r2",
    session_number: 23,
    date: "2025-12-08",
    duration: 50,
    therapist: "Dr. Alex Smith",
    status: "available",
    type: "Progress",
    approved_at: "2025-12-09",
    summary: "Session focused on exploring childhood patterns contributing to current perfectionism. Sarah made a significant connection between her father's high standards and her current self-critical inner voice. This session marked a meaningful therapeutic breakthrough.",
    key_themes: [
      "Childhood schema exploration",
      "Inner critic work",
      "Perfectionism roots",
      "Self-compassion introduction"
    ],
    insights: [
      "Sarah demonstrated readiness for deeper schema work. Her insight connecting childhood experiences to present behaviors shows growing psychological-mindedness.",
      "The inner critic concept resonated strongly. Sarah identified a specific voice from childhood — an important therapeutic landmark.",
      "Self-compassion exercises were introduced and received positively. Homework assigned to practice 'kind self-talk.'"
    ],
    goals_progress: [
      { title: "PHQ-9 below 9", progress: 47, change: 3, status: "on_track" },
      { title: "5 coping strategies", progress: 70, change: 10, status: "on_track" },
    ],
    homework: [
      "Journaling: identify 3 perfectionist thoughts per day and reframe them",
      "Self-compassion letter: write to yourself as if to a dear friend",
      "Notice when inner critic activates — just observe without judgment"
    ],
    next_steps: [
      "Continue schema work",
      "Review journaling homework",
      "Explore self-compassion practice progress"
    ],
    mood_before: 5,
    mood_after: 7,
    rating: 4
  },
  {
    id: "r3",
    session_number: 22,
    date: "2025-12-01",
    duration: 50,
    therapist: "Dr. Alex Smith",
    status: "available",
    type: "Progress",
    approved_at: "2025-12-02",
    summary: "Medication check-in session with focus on social avoidance patterns. Lexapro continues at 10mg with positive response. Explored behavioral avoidance cycle and introduced behavioral activation principles.",
    key_themes: [
      "Medication adherence and response",
      "Social avoidance patterns",
      "Behavioral activation introduction",
      "Isolation risk monitoring"
    ],
    insights: [
      "Lexapro response continues to be positive. Sleep improvement noted. Sarah reports feeling more emotionally 'level'.",
      "Social avoidance pattern is cyclical — anxiety about socializing leads to avoidance which leads to more anxiety. Behavioral activation was introduced as the intervention.",
      "Sarah agreed to a behavioral experiment: attend one social event before next session."
    ],
    goals_progress: [
      { title: "Re-engage social activities (2x/week)", progress: 40, change: 10, status: "needs_attention" },
    ],
    homework: [
      "Attend one social event — even for 30 minutes",
      "Rate anxiety before, during, and after the event",
      "Notice any difference between predicted vs actual discomfort"
    ],
    next_steps: [
      "Review social experiment outcome",
      "Assess PHQ-9",
      "Continue BA planning"
    ],
    mood_before: 5,
    mood_after: 6,
  },
  {
    id: "r4",
    session_number: 25,
    date: "2025-12-22",
    duration: 50,
    therapist: "Dr. Alex Smith",
    status: "pending",
    type: "Progress",
    approved_at: "",
    summary: "",
    key_themes: [],
    insights: [],
    goals_progress: [],
    homework: [],
    next_steps: []
  }
];

function StarRating({ rating }: { rating: number }) {
  return (
    <div className="flex gap-0.5">
      {[1,2,3,4,5].map(s => (
        <Star key={s} className={cn("h-3 w-3", s <= rating ? "text-amber-400 fill-amber-400" : "text-gray-200")} />
      ))}
    </div>
  );
}

function getMoodLabel(mood: number): string {
  if (mood >= 8) return "Great";
  if (mood >= 6) return "Good";
  if (mood >= 4) return "Okay";
  return "Low";
}

function getProgressColor(progress: number): string {
  if (progress >= 75) return "bg-emerald-500";
  if (progress >= 50) return "bg-blue-500";
  if (progress >= 25) return "bg-amber-400";
  return "bg-rose-400";
}

function getStatusStyles(status: GoalProgress["status"]) {
  switch (status) {
    case "on_track": return "text-emerald-600";
    case "needs_attention": return "text-amber-600";
    case "achieved": return "text-blue-600";
  }
}

export default function ReportsPage() {
  const [selectedReport, setSelectedReport] = useState<SessionReport | null>(null);
  const [filterStatus, setFilterStatus] = useState<"all" | "available" | "pending">("all");
  const [reports, setReports] = useState<SessionReport[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiFetch('/sessions/my-reports').then((data: any) => {
      const items = Array.isArray(data) ? data : data?.data ?? [];
      setReports(items);
    }).catch(() => {
      setReports([]);
    }).finally(() => setLoading(false));
  }, []);

  const available = reports.filter(r => r.status === "available");
  const filtered = reports.filter(r => filterStatus === "all" || r.status === filterStatus);

  if (loading) return <div className="flex items-center justify-center h-64 text-gray-400">Loading reports…</div>;

  if (selectedReport && selectedReport.status === "available") {
    return (
      <div className="max-w-2xl mx-auto space-y-5">
        {/* Back */}
        <button
          onClick={() => setSelectedReport(null)}
          className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-900"
        >
          <ArrowLeft className="h-4 w-4" /> Back to Reports
        </button>

        {/* Report header */}
        <div className="bg-gradient-to-br from-[#0A2342] to-[#1E4F8C] rounded-2xl p-5 text-white">
          <div className="flex items-center justify-between mb-3">
            <div>
              <p className="text-xs text-white/60 uppercase tracking-wide">Session #{selectedReport.session_number} Report</p>
              <h2 className="text-lg font-bold mt-0.5">
                {new Date(selectedReport.date).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
              </h2>
            </div>
            <div className="flex items-center gap-1">
              <Shield className="h-4 w-4 text-emerald-400" />
              <span className="text-xs text-emerald-400">Therapist Approved</span>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="bg-white/10 rounded-xl p-2 text-center">
              <p className="text-xs text-white/60">Duration</p>
              <p className="text-sm font-bold">{selectedReport.duration}m</p>
            </div>
            <div className="bg-white/10 rounded-xl p-2 text-center">
              <p className="text-xs text-white/60">Mood Before</p>
              <p className="text-sm font-bold">{selectedReport.mood_before}/10</p>
            </div>
            <div className="bg-white/10 rounded-xl p-2 text-center">
              <p className="text-xs text-white/60">Mood After</p>
              <p className="text-sm font-bold text-emerald-300">{selectedReport.mood_after}/10</p>
            </div>
          </div>

          {selectedReport.rating && (
            <div className="flex items-center gap-2 mt-3">
              <span className="text-xs text-white/60">Your Rating:</span>
              <StarRating rating={selectedReport.rating} />
            </div>
          )}
        </div>

        {/* Summary */}
        <div className="bg-white rounded-2xl border border-gray-200 p-5">
          <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
            <FileText className="h-4 w-4 text-gray-400" /> Session Summary
          </h3>
          <p className="text-sm text-gray-700 leading-relaxed">{selectedReport.summary}</p>
        </div>

        {/* Key themes */}
        <div className="bg-white rounded-2xl border border-gray-200 p-5">
          <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
            <Brain className="h-4 w-4 text-gray-400" /> Key Themes
          </h3>
          <div className="flex flex-wrap gap-2">
            {selectedReport.key_themes.map(theme => (
              <span key={theme} className="px-3 py-1.5 bg-blue-50 text-blue-700 rounded-full text-sm border border-blue-100">
                {theme}
              </span>
            ))}
          </div>
        </div>

        {/* Insights */}
        {selectedReport.insights.length > 0 && (
          <div className="bg-white rounded-2xl border border-gray-200 p-5">
            <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
              <Activity className="h-4 w-4 text-gray-400" /> Therapist Insights
            </h3>
            <div className="space-y-3">
              {selectedReport.insights.map((insight, i) => (
                <div key={i} className="flex gap-3">
                  <div className="w-5 h-5 bg-indigo-100 rounded-full flex items-center justify-center shrink-0 mt-0.5">
                    <span className="text-[10px] font-bold text-indigo-600">{i + 1}</span>
                  </div>
                  <p className="text-sm text-gray-700">{insight}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Goals progress */}
        {selectedReport.goals_progress.length > 0 && (
          <div className="bg-white rounded-2xl border border-gray-200 p-5">
            <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
              <Target className="h-4 w-4 text-gray-400" /> Goals Progress
            </h3>
            <div className="space-y-3">
              {selectedReport.goals_progress.map(goal => (
                <div key={goal.title}>
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-sm text-gray-700">{goal.title}</p>
                    <div className="flex items-center gap-2">
                      <span className={cn("text-xs font-medium flex items-center gap-0.5", getStatusStyles(goal.status))}>
                        {goal.change > 0 ? <TrendingUp className="h-3 w-3" /> : <Minus className="h-3 w-3" />}
                        +{goal.change}%
                      </span>
                      <span className="text-sm font-bold text-gray-900">{goal.progress}%</span>
                    </div>
                  </div>
                  <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div className={cn("h-full rounded-full transition-all", getProgressColor(goal.progress))} style={{ width: `${goal.progress}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Homework */}
        {selectedReport.homework.length > 0 && (
          <div className="bg-amber-50 rounded-2xl border border-amber-100 p-5">
            <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
              <BookOpen className="h-4 w-4 text-amber-600" /> Between-Session Homework
            </h3>
            <div className="space-y-2">
              {selectedReport.homework.map((item, i) => (
                <div key={i} className="flex items-start gap-2">
                  <CheckCircle2 className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
                  <p className="text-sm text-gray-700">{item}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Next steps */}
        {selectedReport.next_steps.length > 0 && (
          <div className="bg-white rounded-2xl border border-gray-200 p-5">
            <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
              <ChevronRight className="h-4 w-4 text-gray-400" /> Next Session Focus
            </h3>
            <div className="space-y-2">
              {selectedReport.next_steps.map((step, i) => (
                <div key={i} className="flex items-start gap-2">
                  <div className="w-5 h-5 bg-gray-100 rounded-full flex items-center justify-center shrink-0">
                    <span className="text-[10px] text-gray-500">{i + 1}</span>
                  </div>
                  <p className="text-sm text-gray-600">{step}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-3">
          <button className="flex-1 py-2.5 border border-gray-200 text-gray-600 rounded-xl text-sm hover:bg-gray-50 flex items-center justify-center gap-2">
            <Download className="h-4 w-4" /> Download PDF
          </button>
          <button className="flex-1 py-2.5 border border-gray-200 text-gray-600 rounded-xl text-sm hover:bg-gray-50 flex items-center justify-center gap-2">
            <Share2 className="h-4 w-4" /> Share
          </button>
        </div>

        {/* Disclaimer */}
        <div className="bg-gray-50 rounded-2xl p-4 flex gap-3">
          <Shield className="h-4 w-4 text-gray-400 shrink-0 mt-0.5" />
          <p className="text-xs text-gray-500">
            This report was reviewed and approved by Dr. Alex Smith before sharing. It contains clinical observations intended to support your therapeutic journey. Information is confidential and protected.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-5">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Session Reports</h1>
        <p className="text-sm text-gray-500 mt-0.5">Therapist-approved summaries from your sessions</p>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-white rounded-2xl border border-gray-200 p-3 text-center">
          <p className="text-xl font-bold text-gray-900">{available.length}</p>
          <p className="text-xs text-gray-400">Reports Available</p>
        </div>
        <div className="bg-white rounded-2xl border border-gray-200 p-3 text-center">
          <p className="text-xl font-bold text-gray-900">24</p>
          <p className="text-xs text-gray-400">Total Sessions</p>
        </div>
        <div className="bg-white rounded-2xl border border-gray-200 p-3 text-center">
          <p className="text-xl font-bold text-emerald-600">+35%</p>
          <p className="text-xs text-gray-400">Overall Progress</p>
        </div>
      </div>

      {/* Info banner */}
      <div className="bg-blue-50 rounded-2xl border border-blue-100 p-4 flex gap-3">
        <Shield className="h-5 w-5 text-blue-500 shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-medium text-blue-800">Therapist-Approved Content</p>
          <p className="text-xs text-blue-600 mt-0.5">All reports are reviewed and approved by Dr. Alex Smith before being shared with you. Only approved reports are visible here.</p>
        </div>
      </div>

      {/* Filter */}
      <div className="flex gap-1 bg-gray-100 rounded-xl p-1">
        {(["all", "available", "pending"] as const).map(f => (
          <button
            key={f}
            onClick={() => setFilterStatus(f)}
            className={cn(
              "flex-1 py-2 px-3 rounded-lg text-xs font-medium capitalize transition-all",
              filterStatus === f ? "bg-white text-[#0A2342] shadow-sm" : "text-gray-500"
            )}
          >
            {f}
          </button>
        ))}
      </div>

      {/* Reports list */}
      <div className="space-y-3">
        {filtered.map(report => (
          <div
            key={report.id}
            className={cn(
              "bg-white rounded-2xl border p-4 transition-all",
              report.status === "available" ? "border-gray-200 hover:border-[#0A2342]/30 hover:shadow-sm cursor-pointer" : "border-gray-100 opacity-70"
            )}
            onClick={() => report.status === "available" && setSelectedReport(report)}
          >
            <div className="flex items-start justify-between mb-3">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  {report.status === "available" ? (
                    <span className="flex items-center gap-1 text-xs bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-full border border-emerald-200">
                      <CheckCircle2 className="h-3 w-3" /> Available
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-xs bg-amber-50 text-amber-700 px-2 py-0.5 rounded-full border border-amber-200">
                      <Clock className="h-3 w-3" /> Pending Approval
                    </span>
                  )}
                  <span className="text-xs text-gray-400">Session #{report.session_number}</span>
                </div>
                <p className="font-medium text-gray-900 text-sm">
                  {new Date(report.date).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
                </p>
              </div>
              {report.status === "available" && <ChevronRight className="h-4 w-4 text-gray-400 mt-1" />}
            </div>

            {report.status === "available" ? (
              <>
                <p className="text-sm text-gray-600 line-clamp-2 mb-3">{report.summary}</p>
                <div className="flex flex-wrap gap-1.5 mb-3">
                  {report.key_themes.slice(0, 3).map(theme => (
                    <span key={theme} className="px-2 py-0.5 bg-gray-100 text-gray-600 rounded-full text-xs">{theme}</span>
                  ))}
                  {report.key_themes.length > 3 && <span className="text-xs text-gray-400">+{report.key_themes.length - 3}</span>}
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3 text-xs text-gray-400">
                    {report.mood_before && report.mood_after && (
                      <span className="flex items-center gap-1">
                        <Activity className="h-3 w-3" /> Mood: {report.mood_before} → <span className="text-emerald-600 font-medium">{report.mood_after}</span>
                      </span>
                    )}
                    {report.homework.length > 0 && (
                      <span>{report.homework.length} homework items</span>
                    )}
                  </div>
                  {report.rating && <StarRating rating={report.rating} />}
                </div>
              </>
            ) : (
              <div className="flex items-center gap-3 py-2">
                <Clock className="h-4 w-4 text-gray-300" />
                <p className="text-sm text-gray-400">Dr. Smith is reviewing this session. Report will be available soon.</p>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// Reviewed: 2026-06-13 — 24Therapy audit
