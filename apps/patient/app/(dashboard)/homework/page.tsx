"use client";

import { useState, useEffect } from "react";
import apiFetch from "@/lib/api";
import {
  BookOpen, CheckCircle, Clock, Star, ArrowRight, Plus, Calendar,
  Target, Brain, Heart, Smile, FileText, Play, Pause, RotateCcw,
  ChevronDown, ChevronUp, Award, Zap, Filter, Search
} from "lucide-react";

type HomeworkStatus = "pending" | "in_progress" | "completed" | "overdue";
type HomeworkCategory = "all" | "exercises" | "worksheets" | "reading" | "reflection" | "behavioral";

interface HomeworkItem {
  id: string;
  title: string;
  description: string;
  category: Exclude<HomeworkCategory, "all">;
  assigned_by: string;
  assigned_date: string;
  due_date: string;
  status: HomeworkStatus;
  estimated_mins: number;
  points: number;
  content?: string;
  reflection_prompts?: string[];
  completed_at?: string;
  completion_note?: string;
}


const STATUS_CONFIG: Record<HomeworkStatus, { label: string; color: string; bg: string }> = {
  pending: { label: "Not Started", color: "text-slate-500", bg: "bg-slate-100" },
  in_progress: { label: "In Progress", color: "text-blue-600", bg: "bg-blue-100" },
  completed: { label: "Completed", color: "text-green-600", bg: "bg-green-100" },
  overdue: { label: "Overdue", color: "text-red-600", bg: "bg-red-100" },
};

const CAT_ICONS: Record<string, typeof BookOpen> = {
  exercises: Zap,
  worksheets: FileText,
  reading: BookOpen,
  reflection: Brain,
  behavioral: Target,
};

export default function HomeworkPage() {
  const [activeCategory, setActiveCategory] = useState<HomeworkCategory>("all");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [completionNote, setCompletionNote] = useState("");
  const [liveHomework, setLiveHomework] = useState<HomeworkItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const rows = await apiFetch<HomeworkItem[]>("/workflows/homework/mine");
        if (cancelled) return;
        const now = new Date();
        setLiveHomework((Array.isArray(rows) ? rows : []).map((h) => ({
          ...h,
          status: h.status !== "completed" && h.due_date && new Date(h.due_date) < now
            ? ("overdue" as const)
            : h.status,
        })));
      } catch { /* show empty state */ }
      finally { if (!cancelled) setLoading(false); }
    })();
    return () => { cancelled = true; };
  }, []);

  const handleMarkInProgress = async (hwId: string) => {
    setLiveHomework(prev => prev.map(h => h.id === hwId ? { ...h, status: 'in_progress' as const } : h));
    try {
      await apiFetch(`/workflows/tasks/${hwId}/start`, { method: 'PATCH' });
    } catch { /* optimistic update is fine - the start endpoint may not exist */ }
  };

  const handleMarkComplete = async (hwId: string) => {
    setLiveHomework(prev => prev.map(h => h.id === hwId ? { ...h, status: 'completed' as const, completion_note: completionNote } : h));
    setCompletionNote("");
    setExpandedId(null);
    try {
      await apiFetch(`/workflows/tasks/${hwId}/complete`, { method: 'PATCH', body: JSON.stringify({ note: completionNote }) });
    } catch { /* optimistic update already applied */ }
  };

  const categories: { id: HomeworkCategory; label: string; count?: number }[] = [
    { id: "all", label: "All", count: liveHomework.length },
    { id: "exercises", label: "Exercises" },
    { id: "worksheets", label: "Worksheets" },
    { id: "reading", label: "Reading" },
    { id: "reflection", label: "Reflection" },
    { id: "behavioral", label: "Behavioral" },
  ];

  const filtered = liveHomework.filter(
    (h) => activeCategory === "all" || h.category === activeCategory
  );

  const completedCount = liveHomework.filter((h) => h.status === "completed").length;
  const totalPoints = liveHomework.filter((h) => h.status === "completed").reduce((s, h) => s + h.points, 0);
  const dueSoon = liveHomework.filter(
    (h) => h.status !== "completed" && h.due_date &&
      new Date(h.due_date).getTime() - Date.now() < 3 * 86400000,
  ).length;

  return (
    <div className="p-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900">Homework & Exercises</h1>
        <p className="text-slate-500 mt-1">Between-session assignments from your therapist</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        <div className="bg-gradient-to-br from-[#0A2342] to-[#1a3a6a] text-white rounded-2xl p-5 text-center">
          <div className="text-3xl font-bold text-[#2EC4B6] mb-1">{completedCount}/{liveHomework.length}</div>
          <div className="text-xs text-white/70">Completed</div>
        </div>
        <div className="bg-gradient-to-br from-amber-500 to-orange-600 text-white rounded-2xl p-5 text-center">
          <div className="text-3xl font-bold mb-1">{totalPoints}</div>
          <div className="text-xs text-white/70">Points Earned</div>
        </div>
        <div className="bg-gradient-to-br from-violet-500 to-purple-600 text-white rounded-2xl p-5 text-center">
          <div className="text-3xl font-bold mb-1">{dueSoon}</div>
          <div className="text-xs text-white/70">Due This Week</div>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 mb-6">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <Award className="w-5 h-5 text-amber-500" />
            <span className="font-semibold text-slate-900">Weekly Progress</span>
          </div>
          <span className="text-sm text-slate-500">{completedCount} of {liveHomework.length} assignments</span>
        </div>
        <div className="w-full bg-slate-100 rounded-full h-3">
          <div
            className="bg-gradient-to-r from-[#2EC4B6] to-[#1F5EFF] h-3 rounded-full transition-all"
            style={{ width: `${(completedCount / (liveHomework.length || 1)) * 100}%` }}
          />
        </div>
        <div className="text-xs text-slate-500 mt-2">
          {completedCount === liveHomework.length ? "🎉 All assignments complete!" : `${liveHomework.length - completedCount} remaining — great progress!`}
        </div>
      </div>

      {/* Category Filter */}
      <div className="flex gap-2 flex-wrap mb-6">
        {categories.map((cat) => (
          <button
            key={cat.id}
            onClick={() => setActiveCategory(cat.id)}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition ${
              activeCategory === cat.id
                ? "bg-[#0A2342] text-white"
                : "bg-white border border-slate-200 text-slate-600 hover:border-slate-300"
            }`}
          >
            {cat.label}
            {cat.count !== undefined && (
              <span className="ml-1.5 text-xs opacity-70">({cat.count})</span>
            )}
          </button>
        ))}
      </div>

      {/* Homework List */}
      <div className="space-y-4">
        {loading && (
          <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center text-sm text-slate-400">
            Loading your assignments…
          </div>
        )}
        {!loading && filtered.length === 0 && (
          <div className="bg-white rounded-2xl border border-slate-200 p-10 text-center">
            <BookOpen className="w-10 h-10 text-slate-200 mx-auto mb-3" />
            <p className="text-slate-600 font-medium mb-1">No assignments yet</p>
            <p className="text-sm text-slate-400">When your therapist assigns homework or exercises, they'll show up here.</p>
          </div>
        )}
        {filtered.map((hw) => {
          const Icon = CAT_ICONS[hw.category] || BookOpen;
          const status = STATUS_CONFIG[hw.status];
          const isExpanded = expandedId === hw.id;

          return (
            <div
              key={hw.id}
              className={`bg-white rounded-2xl border transition-all ${
                hw.status === "overdue" ? "border-red-200" :
                hw.status === "completed" ? "border-green-200" :
                "border-slate-200"
              } ${isExpanded ? "shadow-md" : ""}`}
            >
              {/* Header */}
              <div
                className="p-5 cursor-pointer"
                onClick={() => setExpandedId(isExpanded ? null : hw.id)}
              >
                <div className="flex items-start gap-4">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
                    hw.status === "completed" ? "bg-green-100" : "bg-slate-100"
                  }`}>
                    {hw.status === "completed" ? (
                      <CheckCircle className="w-5 h-5 text-green-600" />
                    ) : (
                      <Icon className="w-5 h-5 text-slate-600" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <h3 className={`font-semibold ${hw.status === "completed" ? "line-through text-slate-400" : "text-slate-900"}`}>
                        {hw.title}
                      </h3>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${status.bg} ${status.color}`}>
                        {status.label}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-slate-500">
                      <span className="flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5" />
                        {hw.estimated_mins} min
                      </span>
                      <span className="flex items-center gap-1">
                        <Star className="w-3.5 h-3.5 text-amber-400" />
                        {hw.points} pts
                      </span>
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3.5 h-3.5" />
                        Due {hw.due_date}
                      </span>
                    </div>
                  </div>
                  {isExpanded ? <ChevronUp className="w-5 h-5 text-slate-400 flex-shrink-0" /> : <ChevronDown className="w-5 h-5 text-slate-400 flex-shrink-0" />}
                </div>
              </div>

              {/* Expanded Content */}
              {isExpanded && (
                <div className="px-5 pb-5 border-t border-slate-100">
                  <div className="pt-4">
                    <p className="text-sm text-slate-600 leading-relaxed mb-4">{hw.description}</p>

                    {hw.content && (
                      <div className="bg-blue-50 rounded-xl border border-blue-100 p-4 mb-4">
                        <div className="text-xs font-semibold text-blue-700 mb-2">Instructions</div>
                        <p className="text-sm text-slate-700 leading-relaxed">{hw.content}</p>
                      </div>
                    )}

                    {hw.reflection_prompts && (
                      <div className="bg-violet-50 rounded-xl border border-violet-100 p-4 mb-4">
                        <div className="text-xs font-semibold text-violet-700 mb-3">Reflection Prompts</div>
                        <ol className="space-y-2">
                          {hw.reflection_prompts.map((prompt, i) => (
                            <li key={i} className="text-sm text-slate-700 flex gap-2">
                              <span className="font-medium text-violet-600">{i + 1}.</span>
                              {prompt}
                            </li>
                          ))}
                        </ol>
                      </div>
                    )}

                    {hw.status === "completed" && hw.completion_note && (
                      <div className="bg-green-50 rounded-xl border border-green-100 p-4 mb-4">
                        <div className="text-xs font-semibold text-green-700 mb-2">Your Reflection (submitted {hw.completed_at})</div>
                        <p className="text-sm text-slate-700 leading-relaxed">{hw.completion_note}</p>
                      </div>
                    )}

                    {(hw.status === "pending" || hw.status === "in_progress") && (
                      <div className="space-y-3">
                        <textarea
                          placeholder="Add a reflection note or completion summary (optional)..."
                          value={completionNote}
                          onChange={(e) => setCompletionNote(e.target.value)}
                          className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-[#2EC4B6]"
                          rows={3}
                        />
                        <div className="flex gap-3">
                          <button onClick={() => handleMarkComplete(hw.id)} className="flex-1 bg-[#2EC4B6] text-white py-2.5 rounded-xl font-semibold text-sm hover:bg-[#26b0a2] transition flex items-center justify-center gap-2">
                            <CheckCircle className="w-4 h-4" />
                            Mark Complete (+{hw.points} pts)
                          </button>
                          {hw.status === "pending" && (
                            <button
                              onClick={() => handleMarkInProgress(hw.id)}
                              className="px-4 py-2.5 bg-slate-100 text-slate-700 rounded-xl font-semibold text-sm hover:bg-slate-200 transition flex items-center gap-2"
                            >
                              <Play className="w-4 h-4" />
                              Start
                            </button>
                          )}
                        </div>
                      </div>
                    )}

                    {hw.status === "overdue" && (
                      <div className="bg-red-50 rounded-xl border border-red-100 p-4 mb-4">
                        <div className="text-sm text-red-700">
                          ⚠️ This assignment is past due. You can still complete it — it&apos;s never too late to practice.
                        </div>
                      </div>
                    )}

                    <div className="flex items-center gap-2 mt-3 text-xs text-slate-400">
                      <span>Assigned by {hw.assigned_by}</span>
                      <span>•</span>
                      <span>Assigned {hw.assigned_date}</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Encouragement */}
      <div className="mt-8 bg-gradient-to-r from-[#0A2342] to-[#1F5EFF] rounded-2xl p-6 text-white text-center">
        <Heart className="w-8 h-8 text-[#2EC4B6] mx-auto mb-3" />
        <h3 className="font-bold text-lg mb-2">Between Sessions Matter</h3>
        <p className="text-white/80 text-sm max-w-md mx-auto">
          Research shows that completing between-session exercises is one of the strongest predictors of therapy success. Each assignment is a step toward your goals.
        </p>
      </div>
    </div>
  );
}

// Reviewed: 2026-06-13 — 24Therapy audit
