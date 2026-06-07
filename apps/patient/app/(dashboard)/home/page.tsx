"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  Calendar, Clock, Video, Brain, Heart, TrendingUp, BookOpen,
  CheckCircle2, Smile, Zap,
  Target, Pill, ChevronRight,
  Sparkles, Plus, Bell, BookOpenCheck, Users, AlertTriangle
} from "lucide-react";
import { cn } from "@/lib/utils";
import { patientAPI, sessionsAPI, APIError } from "@/lib/api";
import { useAuthStore } from "@/lib/store";

const QUICK_ACTIONS = [
  { label: "Log Mood", href: "/mood", icon: Smile, color: "bg-amber-50 text-amber-600 border-amber-100" },
  { label: "Journal", href: "/journal", icon: BookOpenCheck, color: "bg-indigo-50 text-indigo-600 border-indigo-100" },
  { label: "AI Companion", href: "/ai-companion", icon: Brain, color: "bg-blue-50 text-blue-600 border-blue-100" },
  { label: "Resources", href: "/resources", icon: BookOpen, color: "bg-emerald-50 text-emerald-600 border-emerald-100" },
];

function MoodBar({ value }: { value: number }) {
  const color = value >= 7 ? "bg-emerald-400" : value >= 5 ? "bg-blue-400" : "bg-amber-400";
  return (
    <div className="flex flex-col items-center gap-1">
      <div className="h-12 w-6 bg-gray-100 rounded-full overflow-hidden flex items-end">
        <div className={cn("w-full rounded-full", color)} style={{ height: `${(value / 10) * 100}%` }} />
      </div>
    </div>
  );
}

function SkeletonBlock({ className }: { className?: string }) {
  return <div className={cn("bg-gray-100 rounded-xl animate-pulse", className)} />;
}

export default function PatientHomePage() {
  const user = useAuthStore(s => s.user);
  const [patientData, setPatientData] = useState<any>(null);
  const [upcomingSession, setUpcomingSession] = useState<any>(null);
  const [moodTrend, setMoodTrend] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [medTaken, setMedTaken] = useState<Record<string, boolean>>({});

  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const today = new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });

  const fetchHomeData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [profileResult, sessionsResult, moodResult] = await Promise.allSettled([
        patientAPI.me(),
        sessionsAPI.list({ status: "scheduled", limit: 1, sort: "scheduled_at" }),
        patientAPI.moodTrend(7),
      ]);

      if (profileResult.status === "fulfilled") {
        setPatientData(profileResult.value);
        // Initialize medication taken states
        const meds = (profileResult.value as any).medications ?? [];
        const medState: Record<string, boolean> = {};
        meds.forEach((m: any) => { medState[m.id || m.name] = m.taken_today ?? false; });
        setMedTaken(medState);
      }

      if (sessionsResult.status === "fulfilled") {
        const sessions = sessionsResult.value;
        const data = Array.isArray(sessions) ? sessions : (sessions as any).data ?? [];
        setUpcomingSession(data[0] ?? null);
      }

      if (moodResult.status === "fulfilled") {
        const trend = moodResult.value;
        setMoodTrend(Array.isArray(trend) ? trend : (trend as any).data ?? []);
      }
    } catch (err) {
      if (err instanceof APIError && err.status === 401) return;
      setError("Some data could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchHomeData(); }, [fetchHomeData]);

  const firstName = patientData?.first_name || user?.first_name || user?.email?.split("@")[0] || "there";
  const goals = patientData?.goals ?? [];
  const homework = patientData?.homework ?? patientData?.today_tasks ?? [];
  const medications = patientData?.medications ?? [];
  const insights = patientData?.ai_insights ?? [];

  const completedHomework = homework.filter((h: any) => h.done || h.completed).length;
  const homeworkPct = homework.length > 0 ? Math.round((completedHomework / homework.length) * 100) : 0;

  // Compute upcoming session display info
  const upcomingDate = upcomingSession
    ? new Date(upcomingSession.scheduled_at || upcomingSession.date || "")
    : null;
  const daysUntil = upcomingDate
    ? Math.ceil((upcomingDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
    : null;

  return (
    <div className="max-w-2xl mx-auto space-y-5">
      {/* Greeting */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{greeting}, {firstName} 👋</h1>
          <p className="text-sm text-gray-500 mt-0.5">{today}</p>
        </div>
        <Link href="/notifications" className="p-2 bg-white border border-gray-200 rounded-xl hover:bg-gray-50">
          <Bell className="h-4 w-4 text-gray-400" />
        </Link>
      </div>

      {/* Error Banner */}
      {error && !loading && (
        <div className="flex items-center gap-2 p-3 bg-amber-50 border border-amber-100 rounded-xl text-amber-700 text-xs">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
          <button onClick={fetchHomeData} className="ml-auto underline">Retry</button>
        </div>
      )}

      {/* Next Session */}
      {loading ? (
        <SkeletonBlock className="h-52 bg-gray-200" />
      ) : upcomingSession ? (
        <div className="bg-gradient-to-br from-[#0A2342] to-[#1E4F8C] rounded-2xl p-5 text-white">
          <div className="flex items-center justify-between mb-4">
            <span className="text-xs text-white/60 uppercase tracking-wide font-medium">Next Session</span>
            {daysUntil !== null && (
              <span className="text-xs bg-white/10 px-2.5 py-1 rounded-full font-medium">
                {daysUntil === 0 ? "Today!" : `In ${daysUntil} days`}
              </span>
            )}
          </div>

          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 bg-white/10 rounded-xl flex items-center justify-center">
              <Users className="h-5 w-5 text-white/80" />
            </div>
            <div>
              <p className="font-semibold">
                {upcomingSession.therapist
                  ? `${upcomingSession.therapist.first_name || ""} ${upcomingSession.therapist.last_name || ""}`.trim()
                  : upcomingSession.therapist_name || "Your Therapist"}
              </p>
              {upcomingSession.session_number && (
                <p className="text-xs text-white/60">Session #{upcomingSession.session_number}</p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-4 mb-4 text-sm text-white/70">
            {upcomingDate && (
              <>
                <span className="flex items-center gap-1.5">
                  <Calendar className="h-3.5 w-3.5" />
                  {upcomingDate.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
                </span>
                <span className="flex items-center gap-1.5">
                  <Clock className="h-3.5 w-3.5" />
                  {upcomingDate.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
                </span>
              </>
            )}
            <span className="flex items-center gap-1.5">
              <Video className="h-3.5 w-3.5" />
              {upcomingSession.type === "phone" ? "Phone" : "Video"}
            </span>
          </div>

          {upcomingSession.focus_areas && (
            <div className="bg-white/10 rounded-xl px-3 py-2 mb-4">
              <p className="text-xs text-white/50 mb-0.5">Planned focus</p>
              <p className="text-sm text-white">{upcomingSession.focus_areas}</p>
            </div>
          )}

          <div className="flex gap-2">
            <button
              disabled={daysUntil === null || daysUntil > 0}
              className={cn(
                "flex-1 py-2.5 rounded-xl text-sm font-semibold flex items-center justify-center gap-1.5 transition-all",
                daysUntil === 0
                  ? "bg-white text-[#0A2342] hover:bg-white/90"
                  : "bg-white/20 text-white/50 cursor-not-allowed"
              )}
            >
              <Video className="h-4 w-4" /> Join Session
            </button>
            <Link href="/sessions" className="px-4 py-2.5 bg-white/10 text-white rounded-xl text-sm hover:bg-white/20 flex items-center gap-1.5">
              <Calendar className="h-4 w-4" />
            </Link>
          </div>
        </div>
      ) : (
        <div className="bg-gradient-to-br from-[#0A2342] to-[#1E4F8C] rounded-2xl p-5 text-white text-center">
          <Calendar className="h-10 w-10 text-white/30 mx-auto mb-2" />
          <p className="text-white/70 text-sm">No upcoming sessions scheduled</p>
          <p className="text-white/40 text-xs mt-1">Contact your therapist to schedule a session</p>
        </div>
      )}

      {/* Quick actions */}
      <div className="grid grid-cols-4 gap-2">
        {QUICK_ACTIONS.map(action => (
          <Link
            key={action.label}
            href={action.href}
            className={cn("flex flex-col items-center gap-2 p-3 rounded-2xl border text-center transition-all hover:shadow-sm", action.color)}
          >
            <action.icon className="h-5 w-5" />
            <span className="text-xs font-medium">{action.label}</span>
          </Link>
        ))}
      </div>

      {/* Today's homework */}
      {loading ? (
        <SkeletonBlock className="h-32" />
      ) : homework.length > 0 ? (
        <div className="bg-white rounded-2xl border border-gray-200 p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-gray-900 flex items-center gap-2">
              <BookOpen className="h-4 w-4 text-amber-500" /> Today's Tasks
            </h3>
            <span className="text-xs font-medium text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">
              {completedHomework}/{homework.length} done
            </span>
          </div>
          <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden mb-3">
            <div className="h-full bg-amber-400 rounded-full transition-all" style={{ width: `${homeworkPct}%` }} />
          </div>
          <div className="space-y-2">
            {homework.map((hw: any) => (
              <div key={hw.id} className="flex items-center gap-3">
                <div className={cn(
                  "w-5 h-5 rounded-full flex items-center justify-center shrink-0 border-2",
                  (hw.done || hw.completed) ? "bg-emerald-500 border-emerald-500" : "border-gray-300"
                )}>
                  {(hw.done || hw.completed) && <CheckCircle2 className="h-3.5 w-3.5 text-white" />}
                </div>
                <p className={cn("text-sm", (hw.done || hw.completed) ? "line-through text-gray-400" : "text-gray-700")}>
                  {hw.task || hw.title || hw.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      ) : !loading && (
        <div className="bg-white rounded-2xl border border-gray-200 p-4 text-center">
          <CheckCircle2 className="h-8 w-8 text-emerald-300 mx-auto mb-2" />
          <p className="text-sm text-gray-500">No homework tasks for today</p>
        </div>
      )}

      {/* Mood this week */}
      <div className="bg-white rounded-2xl border border-gray-200 p-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-gray-900 flex items-center gap-2">
            <Smile className="h-4 w-4 text-blue-500" /> This Week's Mood
          </h3>
          <Link href="/mood" className="text-xs text-[#0A2342] flex items-center gap-1">
            Log today <Plus className="h-3 w-3" />
          </Link>
        </div>
        {loading ? (
          <div className="flex items-end justify-between gap-2">
            {[...Array(7)].map((_, i) => (
              <div key={i} className="flex flex-col items-center gap-1 flex-1">
                <div className="h-3 w-4 bg-gray-100 rounded animate-pulse" />
                <div className="h-12 w-6 bg-gray-100 rounded-full animate-pulse" />
                <div className="h-3 w-6 bg-gray-100 rounded animate-pulse" />
              </div>
            ))}
          </div>
        ) : moodTrend.length > 0 ? (
          <>
            <div className="flex items-end justify-between gap-2">
              {moodTrend.slice(-7).map((d: any, i: number) => {
                const dayLabel = d.day || new Date(d.date || d.logged_at || 0).toLocaleDateString("en-US", { weekday: "short" }).slice(0, 3);
                const val = d.value ?? d.mood_score ?? d.score ?? 5;
                return (
                  <div key={i} className="flex flex-col items-center gap-1 flex-1">
                    <span className="text-xs font-medium text-gray-700">{val}</span>
                    <MoodBar value={val} />
                    <span className="text-xs text-gray-400">{dayLabel}</span>
                  </div>
                );
              })}
            </div>
            {moodTrend.length > 0 && (
              <div className="mt-3 pt-3 border-t border-gray-100 flex items-center justify-between">
                <span className="text-xs text-gray-500">
                  Avg: <strong>
                    {(moodTrend.slice(-7).reduce((s: number, d: any) => s + (d.value ?? d.mood_score ?? d.score ?? 5), 0) / Math.min(moodTrend.length, 7)).toFixed(1)}
                  </strong>
                </span>
              </div>
            )}
          </>
        ) : (
          <div className="text-center py-4">
            <p className="text-sm text-gray-400">No mood entries this week</p>
            <Link href="/mood" className="text-xs text-blue-500 hover:underline mt-1 inline-block">Log your mood</Link>
          </div>
        )}
      </div>

      {/* Goals preview */}
      {goals.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-200 p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-gray-900 flex items-center gap-2">
              <Target className="h-4 w-4 text-indigo-500" /> Treatment Goals
            </h3>
            <Link href="/progress" className="text-xs text-[#0A2342] flex items-center gap-1">
              View all <ChevronRight className="h-3 w-3" />
            </Link>
          </div>
          <div className="space-y-3">
            {goals.slice(0, 3).map((goal: any) => {
              const progress = goal.progress ?? goal.completion_percentage ?? 0;
              return (
                <div key={goal.id || goal.title}>
                  <div className="flex items-center justify-between mb-1">
                    <div>
                      <p className="text-xs font-medium text-gray-700">{goal.title || goal.name}</p>
                      {goal.category && <p className="text-xs text-gray-400">{goal.category}</p>}
                    </div>
                    <p className="text-sm font-bold text-gray-900">{progress}%</p>
                  </div>
                  <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className={cn("h-full rounded-full", progress >= 70 ? "bg-emerald-500" : progress >= 40 ? "bg-blue-500" : "bg-amber-400")}
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* AI Insights */}
      {insights.length > 0 && (
        <div className="space-y-2">
          {insights.slice(0, 2).map((insight: any) => (
            <div key={insight.id} className="rounded-2xl border p-4 flex gap-3 bg-amber-50 border-amber-100 text-amber-800">
              <div className="w-8 h-8 bg-white/60 rounded-xl flex items-center justify-center shrink-0">
                <Sparkles className="h-4 w-4" />
              </div>
              <div>
                <p className="text-sm font-semibold">{insight.title}</p>
                <p className="text-xs mt-0.5 opacity-80">{insight.body || insight.short}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Medication reminder */}
      {medications.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-200 p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-gray-900 flex items-center gap-2">
              <Pill className="h-4 w-4 text-teal-500" /> Medication
            </h3>
          </div>
          {medications.map((med: any) => {
            const key = med.id || med.name;
            const taken = medTaken[key] ?? med.taken_today ?? false;
            return (
              <div key={key} className="flex items-center gap-3">
                <button
                  onClick={() => setMedTaken(prev => ({ ...prev, [key]: !prev[key] }))}
                  className={cn(
                    "w-7 h-7 rounded-xl flex items-center justify-center border-2 transition-all shrink-0",
                    taken ? "bg-teal-500 border-teal-500" : "border-gray-300"
                  )}
                >
                  {taken && <CheckCircle2 className="h-4 w-4 text-white" />}
                </button>
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-900">{med.name}</p>
                  <p className="text-xs text-gray-400">{med.schedule || med.dosage || ""}</p>
                </div>
                {taken && <span className="text-xs text-teal-600 font-medium">Taken ✓</span>}
              </div>
            );
          })}
        </div>
      )}

      {/* Crisis support (always visible) */}
      <div className="bg-rose-50 rounded-2xl border border-rose-100 p-4">
        <div className="flex items-center gap-3">
          <Heart className="h-5 w-5 text-rose-500 shrink-0" />
          <div>
            <p className="text-sm font-semibold text-rose-700">Need immediate support?</p>
            <p className="text-xs text-rose-600">If you're in crisis: call/text <strong>988</strong> · Text HOME to <strong>741741</strong></p>
          </div>
        </div>
      </div>
    </div>
  );
}
