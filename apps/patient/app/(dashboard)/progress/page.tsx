"use client";

import { useState } from "react";
import {
  TrendingDown, TrendingUp, Minus, Activity, Brain, Heart,
  Calendar, Target, CheckCircle2, Circle, ChevronRight,
  BarChart3, Sparkles, Clock, Award, Edit3, Plus
} from "lucide-react";
import { cn, formatDate } from "@/lib/utils";

const MOCK_PHQ9_HISTORY = [
  { date: "2024-08-15", score: 17, label: "Moderately Severe" },
  { date: "2024-10-01", score: 15, label: "Moderate" },
  { date: "2024-12-01", score: 14, label: "Moderate" },
  { date: "2025-02-01", score: 12, label: "Moderate" },
  { date: "2025-04-01", score: 11, label: "Moderate" },
  { date: "2025-06-01", score: 10, label: "Moderate" },
  { date: "2025-08-01", score: 9, label: "Mild" },
  { date: "2025-10-01", score: 8, label: "Mild" },
  { date: "2025-12-15", score: 13, label: "Moderate" },
];

const MOCK_GOALS = [
  { id: "g1", title: "Reduce PHQ-9 score to below 5", progress: 65, status: "in_progress", category: "clinical", target_date: "2026-02-01" },
  { id: "g2", title: "Practice coping strategies daily", progress: 100, status: "completed", category: "skills", completed_at: "2025-12-01" },
  { id: "g3", title: "Improve sleep to 7+ hours", progress: 40, status: "in_progress", category: "lifestyle", target_date: "2026-03-01" },
  { id: "g4", title: "Return to social activities", progress: 15, status: "in_progress", category: "social", target_date: "2026-04-01" },
  { id: "g5", title: "Reduce anxiety during work meetings", progress: 55, status: "in_progress", category: "work", target_date: "2026-02-15" },
];

const MOCK_JOURNAL = [
  { id: "j1", date: "2025-12-15", mood: 4, text: "Had a good session today. Practiced my breathing and felt calmer afterwards.", tags: ["good-session", "breathing"] },
  { id: "j2", date: "2025-12-14", mood: 3, text: "Work was stressful but I used the thought record technique. It helped somewhat.", tags: ["work", "thought-record"] },
  { id: "j3", date: "2025-12-13", mood: 2, text: "Difficult day. Struggled with negative thoughts in the morning.", tags: ["difficult"] },
  { id: "j4", date: "2025-12-12", mood: 4, text: "Felt genuinely happy today. Went for a walk and called a friend.", tags: ["positive", "social"] },
];

const MOOD_EMOJIS: Record<number, string> = { 1: "😔", 2: "😟", 3: "😐", 4: "😊", 5: "😄" };
const MOOD_LABELS: Record<number, string> = { 1: "Very Low", 2: "Low", 3: "Okay", 4: "Good", 5: "Great" };
const MOOD_COLORS: Record<number, string> = {
  1: "text-red-600 bg-red-50", 2: "text-orange-600 bg-orange-50",
  3: "text-yellow-600 bg-yellow-50", 4: "text-green-600 bg-green-50", 5: "text-emerald-600 bg-emerald-50",
};

export default function PatientProgressPage() {
  const [tab, setTab] = useState<"overview" | "goals" | "journal">("overview");

  const startScore = MOCK_PHQ9_HISTORY[0].score;
  const currentScore = MOCK_PHQ9_HISTORY[MOCK_PHQ9_HISTORY.length - 1].score;
  const improvement = startScore - currentScore;
  const maxScore = Math.max(...MOCK_PHQ9_HISTORY.map((h) => h.score));

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-3xl mx-auto p-4 md:p-6 space-y-5">

        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-slate-900">My Progress</h1>
          <p className="text-slate-500 text-sm mt-1">Track your mental health journey over time</p>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 p-1 bg-slate-200 rounded-xl w-fit">
          {[
            { key: "overview", label: "Overview" },
            { key: "goals", label: "Goals" },
            { key: "journal", label: "Journal" },
          ].map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key as any)}
              className={cn(
                "px-4 py-2 rounded-lg text-sm font-medium transition-colors",
                tab === t.key ? "bg-white text-slate-900 shadow-sm" : "text-slate-600 hover:text-slate-900"
              )}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* ─── Overview Tab ─── */}
        {tab === "overview" && (
          <div className="space-y-5">
            {/* Headline improvement */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-card p-5">
              <div className="flex items-center gap-2 mb-4">
                <Sparkles className="w-4 h-4 text-purple-500" />
                <h2 className="font-semibold text-slate-800">Your Progress Since Starting</h2>
              </div>
              <div className="flex items-center gap-6">
                <div className="text-center">
                  <div className="text-3xl font-bold text-red-500">{startScore}</div>
                  <div className="text-xs text-slate-400 mt-0.5">Aug 2024</div>
                  <div className="text-xs text-slate-500">Start</div>
                </div>
                <div className="flex-1 flex items-center justify-center">
                  <div className="flex flex-col items-center">
                    <TrendingDown className="w-8 h-8 text-green-500" />
                    <span className="text-sm font-bold text-green-600 mt-1">-{improvement} points</span>
                    <span className="text-xs text-slate-400">{Math.round(improvement / startScore * 100)}% improvement</span>
                  </div>
                </div>
                <div className="text-center">
                  <div className="text-3xl font-bold text-orange-500">{currentScore}</div>
                  <div className="text-xs text-slate-400 mt-0.5">Dec 2025</div>
                  <div className="text-xs text-slate-500">Current</div>
                </div>
              </div>
            </div>

            {/* PHQ-9 Chart */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-card p-5">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-semibold text-slate-800">PHQ-9 Over Time</h2>
                <span className="text-xs text-slate-500">Depression screening</span>
              </div>

              {/* Simple bar chart */}
              <div className="flex items-end gap-2 h-28">
                {MOCK_PHQ9_HISTORY.map((entry, i) => {
                  const height = (entry.score / 27) * 100;
                  const isLast = i === MOCK_PHQ9_HISTORY.length - 1;
                  const color = entry.score >= 15 ? "bg-red-400" : entry.score >= 10 ? "bg-orange-400" : entry.score >= 5 ? "bg-yellow-400" : "bg-green-400";
                  return (
                    <div key={i} className="flex-1 flex flex-col items-center gap-1">
                      <span className="text-xs font-bold text-slate-700">{entry.score}</span>
                      <div
                        className={cn("w-full rounded-t-md transition-all", color, isLast && "ring-2 ring-blue-400")}
                        style={{ height: `${height * 0.85}%` }}
                      />
                    </div>
                  );
                })}
              </div>
              <div className="flex items-center justify-between mt-2">
                <span className="text-[10px] text-slate-400">Aug '24</span>
                <span className="text-[10px] text-slate-400">Dec '25</span>
              </div>

              {/* Severity Legend */}
              <div className="flex items-center gap-3 mt-3 flex-wrap">
                {[
                  { color: "bg-green-400", label: "Minimal (0-4)" },
                  { color: "bg-yellow-400", label: "Mild (5-9)" },
                  { color: "bg-orange-400", label: "Moderate (10-14)" },
                  { color: "bg-red-400", label: "Severe (15+)" },
                ].map((s) => (
                  <div key={s.label} className="flex items-center gap-1.5">
                    <div className={cn("w-2.5 h-2.5 rounded-sm", s.color)} />
                    <span className="text-[10px] text-slate-500">{s.label}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* AI Insight */}
            <div className="bg-gradient-to-br from-purple-50 to-blue-50 rounded-2xl border border-purple-200 p-4">
              <div className="flex items-start gap-3">
                <Brain className="w-5 h-5 text-purple-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-semibold text-slate-800">AI Insight</p>
                  <p className="text-sm text-slate-600 mt-1">
                    Your depression scores showed consistent improvement from August 2024 to October 2025.
                    The recent slight increase in December may be related to seasonal factors or increased life stressors.
                    Consider discussing this trend in your next session.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ─── Goals Tab ─── */}
        {tab === "goals" && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-slate-800">Treatment Goals</h2>
              <span className="text-xs text-slate-500">
                {MOCK_GOALS.filter((g) => g.status === "completed").length}/{MOCK_GOALS.length} completed
              </span>
            </div>

            {MOCK_GOALS.map((goal) => {
              const isCompleted = goal.status === "completed";
              return (
                <div
                  key={goal.id}
                  className={cn(
                    "bg-white rounded-xl border border-slate-200 shadow-card p-4",
                    isCompleted && "bg-green-50 border-green-200"
                  )}
                >
                  <div className="flex items-start gap-3">
                    {isCompleted
                      ? <CheckCircle2 className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                      : <Circle className="w-5 h-5 text-slate-300 flex-shrink-0 mt-0.5" />}
                    <div className="flex-1">
                      <p className={cn("text-sm font-medium", isCompleted ? "text-green-800 line-through" : "text-slate-800")}>
                        {goal.title}
                      </p>
                      <div className="flex items-center gap-3 mt-1 text-xs text-slate-500">
                        <span className={cn("px-1.5 py-0.5 rounded",
                          goal.category === "clinical" ? "bg-purple-50 text-purple-600" :
                          goal.category === "skills" ? "bg-blue-50 text-blue-600" :
                          goal.category === "lifestyle" ? "bg-green-50 text-green-600" :
                          goal.category === "social" ? "bg-pink-50 text-pink-600" :
                          "bg-slate-100 text-slate-600"
                        )}>
                          {goal.category}
                        </span>
                        {goal.target_date && (
                          <span className="flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            Target: {formatDate(goal.target_date)}
                          </span>
                        )}
                        {isCompleted && goal.completed_at && (
                          <span className="flex items-center gap-1 text-green-600">
                            <CheckCircle2 className="w-3 h-3" />
                            Done: {formatDate(goal.completed_at)}
                          </span>
                        )}
                      </div>
                      {!isCompleted && (
                        <div className="mt-2 flex items-center gap-2">
                          <div className="flex-1 h-2 bg-slate-200 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-blue-500 rounded-full transition-all"
                              style={{ width: `${goal.progress}%` }}
                            />
                          </div>
                          <span className="text-xs font-semibold text-blue-600 w-8">{goal.progress}%</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* ─── Journal Tab ─── */}
        {tab === "journal" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-slate-800">Mood Journal</h2>
              <button className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white rounded-xl text-xs font-semibold hover:bg-blue-700 transition-colors">
                <Plus className="w-3.5 h-3.5" />
                Add Entry
              </button>
            </div>

            {MOCK_JOURNAL.map((entry) => (
              <div key={entry.id} className="bg-white rounded-xl border border-slate-200 shadow-card p-4">
                <div className="flex items-start gap-3">
                  <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center text-xl flex-shrink-0", MOOD_COLORS[entry.mood])}>
                    {MOOD_EMOJIS[entry.mood]}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="text-sm font-semibold text-slate-800">{MOOD_LABELS[entry.mood]}</span>
                        <span className="text-xs text-slate-400 ml-2">{formatDate(entry.date)}</span>
                      </div>
                      <button>
                        <Edit3 className="w-3.5 h-3.5 text-slate-300 hover:text-slate-500" />
                      </button>
                    </div>
                    <p className="text-sm text-slate-600 mt-1.5">{entry.text}</p>
                    <div className="flex items-center gap-1.5 mt-2">
                      {entry.tags.map((tag) => (
                        <span key={tag} className="text-xs px-2 py-0.5 bg-slate-100 text-slate-500 rounded-full">
                          #{tag}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
