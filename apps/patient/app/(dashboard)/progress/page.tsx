"use client";

import { useState, useEffect } from "react";
import { assessmentsAPI, patientAPI } from "@/lib/api";
import {
  TrendingUp, TrendingDown, Minus, Target, Calendar, Activity,
  Brain, Heart, Star, CheckCircle2, Circle, Clock, BarChart2,
  Award, ArrowUp, ArrowDown, Sparkles, AlertCircle, Smile,
  Moon, Zap, BookOpen, Users, ChevronRight, Info, Shield
} from "lucide-react";
import { cn } from "@/lib/utils";

// Progress data types
interface AssessmentDataPoint {
  date: string;
  phq9: number;
  gad7: number;
  session: number;
}

interface TherapyGoal {
  id: string;
  title: string;
  category: "symptom" | "behavioral" | "skill" | "social" | "milestone";
  progress: number;
  target_date: string;
  started_date: string;
  status: "active" | "completed" | "paused";
  sessions_count: number;
  last_updated: string;
  milestones: string[];
  notes?: string;
}

interface Achievement {
  id: string;
  title: string;
  description: string;
  earned_date: string;
  icon: string;
  category: string;
}

const EMPTY_ASSESSMENT_HISTORY: AssessmentDataPoint[] = [];

const EMPTY_THERAPY_GOALS: TherapyGoal[] = [];

function ProgressBar({ value, color = "bg-blue-500", showLabel = true }: { value: number; color?: string; showLabel?: boolean }) {
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
        <div className={cn("h-full rounded-full transition-all", color)} style={{ width: `${value}%` }} />
      </div>
      {showLabel && <span className="text-xs font-medium text-gray-600 w-8">{value}%</span>}
    </div>
  );
}

function MiniChart({ data, field, color }: { data: AssessmentDataPoint[]; field: "phq9" | "gad7"; color: string }) {
  const values = data.map(d => d[field]);
  const max = Math.max(...values);
  const min = Math.min(...values);
  const range = max - min || 1;

  return (
    <div className="flex items-end gap-1 h-12">
      {data.slice(-8).map((d, i) => {
        const value = d[field];
        const height = ((max - value) / range) * 100;
        const barHeight = Math.max(10, 100 - height);
        return (
          <div key={i} className="flex-1 flex flex-col items-center gap-0.5">
            <div className={cn("w-full rounded-sm", color)} style={{ height: `${barHeight * 0.4}px` }} />
          </div>
        );
      })}
    </div>
  );
}

function getCategoryColor(cat: TherapyGoal["category"]): string {
  const colors: Record<TherapyGoal["category"], string> = {
    symptom: "text-rose-600 bg-rose-50",
    behavioral: "text-blue-600 bg-blue-50",
    skill: "text-indigo-600 bg-indigo-50",
    social: "text-amber-600 bg-amber-50",
    milestone: "text-emerald-600 bg-emerald-50",
  };
  return colors[cat] || "text-gray-600 bg-gray-100";
}

function getProgressColor(p: number): string {
  if (p === 100) return "bg-emerald-500";
  if (p >= 70) return "bg-blue-500";
  if (p >= 40) return "bg-amber-400";
  return "bg-rose-400";
}

export default function ProgressPage() {
  const [activeTab, setActiveTab] = useState<"overview" | "goals" | "assessments" | "achievements">("overview");
  const [liveAssessments, setLiveAssessments] = useState<AssessmentDataPoint[]>(EMPTY_ASSESSMENT_HISTORY);
  const [liveGoals, setLiveGoals] = useState<TherapyGoal[]>(EMPTY_THERAPY_GOALS);
  const [loading, setLoading] = useState(true);
  const [therapistName, setTherapistName] = useState("Your Therapist");
  const [recentMoods, setRecentMoods] = useState<{ mood: number }[]>([]);
  const [achievements, setAchievements] = useState<Achievement[]>([]);

  useEffect(() => {
    async function load() {
      try {
        const [assessRes, patientRes, moodRes] = await Promise.allSettled([
          assessmentsAPI.list({ status: 'completed', limit: 12 }),
          patientAPI.me(),
          patientAPI.moodTrend(7),
        ]);
        if (assessRes.status === 'fulfilled') {
          const data = (assessRes.value as { data: Record<string, unknown>[] }).data || [];
          if (data.length > 0) {
            const mapped = data.map((a, idx) => ({
              date: (a.administered_at as string || a.completed_at as string || a.created_at as string || '').slice(0, 7),
              phq9: (a.phq9_score as number) || ((a.template_code as string || '').toLowerCase().includes('phq') ? (a.total_score as number) || 0 : 0),
              gad7: (a.gad7_score as number) || ((a.template_code as string || '').toLowerCase().includes('gad') ? (a.total_score as number) || 0 : 0),
              session: idx + 1,
            }));
            setLiveAssessments(mapped);
            // Derive achievements from real data
            const earned: Achievement[] = [];
            if (data.length >= 1) earned.push({ id: "a1", title: "First Assessment", description: "Completed your first clinical assessment", earned_date: (data[0].administered_at as string || data[0].created_at as string || ''), icon: "🌱", category: "milestone" });
            if (data.length >= 5) earned.push({ id: "a2", title: "Consistent Tracker", description: "Completed 5 or more assessments", earned_date: (data[4].administered_at as string || data[4].created_at as string || ''), icon: "🌟", category: "attendance" });
            setAchievements(earned);
          }
        }
        if (patientRes.status === 'fulfilled') {
          const p = patientRes.value as Record<string, unknown>;
          const goals = (p.goals as Record<string, unknown>[]) || [];
          if (goals.length > 0) setLiveGoals(goals as unknown as TherapyGoal[]);
          const tName = (p.primary_therapist_display_name as string) || (p.primary_therapist_name as string) || "Your Therapist";
          setTherapistName(tName);
          if (goals.length > 0) {
            const completedGoalsList = goals.filter((g: any) => g.status === 'completed');
            if (completedGoalsList.length > 0) {
              setAchievements(prev => [...prev, { id: "a3", title: "Goal Crusher", description: "Completed your first treatment goal", earned_date: '', icon: "🏆", category: "goals" }]);
            }
          }
        }
        if (moodRes.status === 'fulfilled') {
          const items = Array.isArray(moodRes.value) ? moodRes.value : (moodRes.value as any)?.data ?? [];
          setRecentMoods(items.slice(0, 7));
        }
      } catch { /* noop */ }
      finally { setLoading(false); }
    }
    load();
  }, []);

  const currentPHQ9 = liveAssessments.length > 0 ? liveAssessments[liveAssessments.length - 1]?.phq9 : null;
  const startPHQ9 = liveAssessments.length > 0 ? liveAssessments[0]?.phq9 : null;
  const phq9Change = (currentPHQ9 !== null && startPHQ9 !== null) ? currentPHQ9 - startPHQ9 : null;
  const phq9PctImprovement = (startPHQ9 && startPHQ9 > 0 && phq9Change !== null) ? Math.round(((startPHQ9 - currentPHQ9!) / startPHQ9) * 100) : null;

  const currentGAD7 = liveAssessments.length > 0 ? liveAssessments[liveAssessments.length - 1]?.gad7 : null;
  const startGAD7 = liveAssessments.length > 0 ? liveAssessments[0]?.gad7 : null;
  const gad7Change = (currentGAD7 !== null && startGAD7 !== null) ? currentGAD7 - startGAD7 : null;
  const gad7PctImprovement = (startGAD7 && startGAD7 > 0 && gad7Change !== null) ? Math.round(((startGAD7 - currentGAD7!) / startGAD7) * 100) : null;

  const completedGoals = liveGoals.filter(g => g.status === "completed").length;
  const activeGoals = liveGoals.filter(g => g.status === "active").length;

  const weeklyMoodAvg = recentMoods.length
    ? (recentMoods.reduce((s, e) => s + (e.mood || 0), 0) / recentMoods.length).toFixed(1)
    : null;

  return (
    <div className="max-w-2xl mx-auto space-y-5">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">My Progress</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          {liveGoals.length > 0 ? `${liveGoals.length} goals tracked` : "Your therapy journey"}
          {therapistName !== "Your Therapist" ? ` · Managed by ${therapistName}` : ""}
        </p>
      </div>

      {/* Overall progress banner */}
      <div className="bg-gradient-to-br from-[#0A2342] to-[#1E4F8C] rounded-2xl p-5 text-white">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 bg-white/10 rounded-xl flex items-center justify-center">
            <TrendingUp className="h-5 w-5 text-emerald-400" />
          </div>
          <div>
            <h3 className="font-semibold">Overall Progress</h3>
            <p className="text-xs text-white/60">Since starting therapy in August 2024</p>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div className="bg-white/10 rounded-xl p-3 text-center">
            <p className="text-xs text-white/60">Depression</p>
            <p className="text-2xl font-bold text-emerald-300">-{phq9PctImprovement}%</p>
            <p className="text-xs text-white/60">PHQ-9 improvement</p>
          </div>
          <div className="bg-white/10 rounded-xl p-3 text-center">
            <p className="text-xs text-white/60">Anxiety</p>
            <p className="text-2xl font-bold text-emerald-300">-{gad7PctImprovement}%</p>
            <p className="text-xs text-white/60">GAD-7 improvement</p>
          </div>
          <div className="bg-white/10 rounded-xl p-3 text-center">
            <p className="text-xs text-white/60">Goals</p>
            <p className="text-2xl font-bold text-amber-300">{completedGoals}/{liveGoals.length}</p>
            <p className="text-xs text-white/60">completed</p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 rounded-xl p-1">
        {(["overview", "goals", "assessments", "achievements"] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={cn(
              "flex-1 py-2 px-2 rounded-lg text-xs font-medium capitalize transition-all",
              activeTab === tab ? "bg-white text-[#0A2342] shadow-sm" : "text-gray-500"
            )}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* OVERVIEW TAB */}
      {activeTab === "overview" && (
        <div className="space-y-4">
          {/* This week summary */}
          <div className="bg-white rounded-2xl border border-gray-200 p-4">
            <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
              <Calendar className="h-4 w-4 text-gray-400" /> This Week
            </h3>
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-gray-50 rounded-xl p-3">
                <div className="flex items-center justify-between mb-1">
                  <p className="text-xs text-gray-500">Mood Avg</p>
                  <Smile className="h-3.5 w-3.5 text-gray-400" />
                </div>
                <div className="flex items-baseline gap-1">
                  <p className="text-xl font-bold text-gray-900">{weeklyMoodAvg ?? "—"}</p>
                  <p className="text-xs text-gray-400">/10</p>
                </div>
              </div>
              <div className="bg-gray-50 rounded-xl p-3">
                <div className="flex items-center justify-between mb-1">
                  <p className="text-xs text-gray-500">Goals Active</p>
                  <Target className="h-3.5 w-3.5 text-gray-400" />
                </div>
                <div className="flex items-baseline gap-1">
                  <p className="text-xl font-bold text-gray-900">{activeGoals}</p>
                  <p className="text-xs text-gray-400">/ {liveGoals.length}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Active goals preview */}
          <div className="bg-white rounded-2xl border border-gray-200 p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-gray-900 text-sm">Active Goals</h3>
              <button onClick={() => setActiveTab("goals")} className="text-xs text-[#0A2342] hover:text-[#1E4F8C] flex items-center gap-1">
                View all <ChevronRight className="h-3 w-3" />
              </button>
            </div>
            <div className="space-y-3">
              {liveGoals.filter(g => g.status === "active").slice(0, 3).map(goal => (
                <div key={goal.id}>
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-xs text-gray-700 font-medium line-clamp-1">{goal.title}</p>
                    <span className="text-xs font-bold text-gray-700">{goal.progress}%</span>
                  </div>
                  <ProgressBar value={goal.progress} color={getProgressColor(goal.progress)} showLabel={false} />
                </div>
              ))}
            </div>
          </div>

          {/* Recent achievements */}
          <div className="bg-white rounded-2xl border border-gray-200 p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-gray-900 text-sm">Recent Achievements</h3>
              <button onClick={() => setActiveTab("achievements")} className="text-xs text-[#0A2342] hover:text-[#1E4F8C] flex items-center gap-1">
                View all <ChevronRight className="h-3 w-3" />
              </button>
            </div>
            {achievements.length > 0 ? (
              <div className="flex gap-3">
                {achievements.slice(-3).map(a => (
                  <div key={a.id} className="flex-1 text-center bg-gray-50 rounded-xl p-3">
                    <span className="text-2xl">{a.icon}</span>
                    <p className="text-xs font-medium text-gray-700 mt-1">{a.title}</p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-gray-400 text-center py-2">Complete assessments and goals to earn achievements</p>
            )}
          </div>
        </div>
      )}

      {/* GOALS TAB */}
      {activeTab === "goals" && (
        <div className="space-y-3">
          {/* Summary */}
          <div className="flex gap-3">
            <div className="flex-1 bg-emerald-50 rounded-2xl border border-emerald-100 p-3 text-center">
              <p className="text-2xl font-bold text-emerald-700">{completedGoals}</p>
              <p className="text-xs text-emerald-600">Completed</p>
            </div>
            <div className="flex-1 bg-blue-50 rounded-2xl border border-blue-100 p-3 text-center">
              <p className="text-2xl font-bold text-blue-700">{activeGoals}</p>
              <p className="text-xs text-blue-600">Active</p>
            </div>
            <div className="flex-1 bg-gray-50 rounded-2xl border border-gray-200 p-3 text-center">
              <p className="text-2xl font-bold text-gray-700">{liveGoals.length}</p>
              <p className="text-xs text-gray-500">Total Goals</p>
            </div>
          </div>

          {liveGoals.map(goal => (
            <div key={goal.id} className="bg-white rounded-2xl border border-gray-200 p-4">
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1 pr-3">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={cn("text-xs font-medium px-2 py-0.5 rounded-full capitalize", getCategoryColor(goal.category))}>
                      {goal.category}
                    </span>
                    {goal.status === "completed" && (
                      <span className="flex items-center gap-1 text-xs text-emerald-600 font-medium">
                        <CheckCircle2 className="h-3 w-3" /> Achieved!
                      </span>
                    )}
                  </div>
                  <h3 className="font-medium text-gray-900 text-sm">{goal.title}</h3>
                </div>
                <div className="text-right">
                  <p className="text-lg font-bold text-gray-900">{goal.progress}%</p>
                  <p className="text-xs text-gray-400">{goal.sessions_count} sessions</p>
                </div>
              </div>

              <ProgressBar value={goal.progress} color={getProgressColor(goal.progress)} showLabel={false} />

              <div className="mt-3 flex flex-wrap gap-1">
                {goal.milestones.map((m, i) => (
                  <span
                    key={i}
                    className={cn("text-xs px-2 py-0.5 rounded-full", m.endsWith("✓") ? "bg-emerald-100 text-emerald-700" : "bg-gray-100 text-gray-500")}
                  >
                    {m}
                  </span>
                ))}
              </div>

              {goal.notes && (
                <p className="mt-2 text-xs text-gray-500 italic border-t border-gray-100 pt-2">{goal.notes}</p>
              )}

              <div className="flex items-center gap-3 mt-3 pt-2 border-t border-gray-100 text-xs text-gray-400">
                <span>Target: {new Date(goal.target_date).toLocaleDateString("en-US", { month: "short", year: "numeric" })}</span>
                <span>Started: {new Date(goal.started_date).toLocaleDateString("en-US", { month: "short", year: "numeric" })}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ASSESSMENTS TAB */}
      {activeTab === "assessments" && (
        <div className="space-y-4">
          {/* Current scores */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-white rounded-2xl border border-gray-200 p-4">
              <p className="text-xs text-gray-500 mb-1">PHQ-9 (Depression)</p>
              <p className="text-3xl font-bold text-gray-900">{currentPHQ9}</p>
              <p className="text-xs font-medium text-emerald-600 mt-0.5">
                <TrendingDown className="h-3 w-3 inline" /> Down {phq9Change !== null ? Math.abs(phq9Change) : "—"} from start ({phq9PctImprovement ?? "—"}% better)
              </p>
              <p className="text-xs text-gray-400 mt-1">
                Interpretation: {currentPHQ9 !== null ? (currentPHQ9 < 5 ? "None" : currentPHQ9 < 10 ? "Mild" : currentPHQ9 < 15 ? "Moderate" : "Moderately Severe") : "—"}
              </p>
            </div>
            <div className="bg-white rounded-2xl border border-gray-200 p-4">
              <p className="text-xs text-gray-500 mb-1">GAD-7 (Anxiety)</p>
              <p className="text-3xl font-bold text-gray-900">{currentGAD7}</p>
              <p className="text-xs font-medium text-emerald-600 mt-0.5">
                <TrendingDown className="h-3 w-3 inline" /> Down {gad7Change !== null ? Math.abs(gad7Change) : "—"} from start ({gad7PctImprovement ?? "—"}% better)
              </p>
              <p className="text-xs text-gray-400 mt-1">
                Interpretation: {currentGAD7 !== null ? (currentGAD7 < 5 ? "Minimal" : currentGAD7 < 10 ? "Mild" : currentGAD7 < 15 ? "Moderate" : "Severe") : "—"}
              </p>
            </div>
          </div>

          {/* PHQ-9 chart */}
          {liveAssessments.length > 0 ? (
            <>
              <div className="bg-white rounded-2xl border border-gray-200 p-4">
                <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                  <BarChart2 className="h-4 w-4 text-gray-400" /> PHQ-9 Over Time (Lower is Better)
                </h3>
                <MiniChart data={liveAssessments} field="phq9" color="bg-rose-400" />
                <div className="flex items-end gap-1 mt-1">
                  {liveAssessments.slice(-8).map((d, i) => (
                    <div key={i} className="flex-1 text-center">
                      <p className="text-[9px] text-gray-400">{d.date.substring(0, 3)}</p>
                    </div>
                  ))}
                </div>
                {phq9PctImprovement !== null && (
                  <div className="mt-3 p-3 bg-emerald-50 rounded-xl">
                    <p className="text-xs text-emerald-700">📈 {phq9PctImprovement}% improvement since starting therapy. Goal: score below 9.</p>
                  </div>
                )}
              </div>

              {/* GAD-7 chart */}
              <div className="bg-white rounded-2xl border border-gray-200 p-4">
                <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                  <Activity className="h-4 w-4 text-gray-400" /> GAD-7 Over Time (Lower is Better)
                </h3>
                <MiniChart data={liveAssessments} field="gad7" color="bg-amber-400" />
                <div className="flex items-end gap-1 mt-1">
                  {liveAssessments.slice(-8).map((d, i) => (
                    <div key={i} className="flex-1 text-center">
                      <p className="text-[9px] text-gray-400">{d.date.substring(0, 3)}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* History table */}
              <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
                <div className="px-4 py-3 border-b border-gray-100">
                  <h3 className="font-semibold text-gray-900 text-sm">Assessment History</h3>
                </div>
                <div className="divide-y divide-gray-100">
                  {liveAssessments.slice().reverse().map((d, i) => (
                    <div key={i} className="flex items-center justify-between px-4 py-3">
                      <span className="text-sm text-gray-600">{d.date}</span>
                      <span className="text-xs text-gray-400">Session #{d.session}</span>
                      <div className="flex items-center gap-4">
                        <div className="text-center">
                          <span className="text-xs text-gray-400">PHQ-9</span>
                          <p className="font-bold text-sm text-gray-900">{d.phq9}</p>
                        </div>
                        <div className="text-center">
                          <span className="text-xs text-gray-400">GAD-7</span>
                          <p className="font-bold text-sm text-gray-900">{d.gad7}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          ) : (
            <div className="bg-white rounded-2xl border border-gray-200 p-8 text-center">
              <BarChart2 className="h-10 w-10 text-gray-200 mx-auto mb-3" />
              <p className="text-sm text-gray-500">No assessments completed yet.</p>
              <p className="text-xs text-gray-400 mt-1">Your therapist will assign assessments to track your progress.</p>
            </div>
          )}

          <div className="bg-blue-50 rounded-2xl p-4 flex gap-3">
            <Shield className="h-4 w-4 text-blue-500 shrink-0 mt-0.5" />
            <p className="text-xs text-blue-700">Assessment scores are provided by {therapistName}. These reflect clinical measurement — your personal experience of progress may vary.</p>
          </div>
        </div>
      )}

      {/* ACHIEVEMENTS TAB */}
      {activeTab === "achievements" && (
        <div className="space-y-4">
          <div className="bg-gradient-to-r from-amber-50 to-orange-50 rounded-2xl border border-amber-100 p-4">
            <div className="flex items-center gap-3 mb-2">
              <Award className="h-5 w-5 text-amber-600" />
              <h3 className="font-semibold text-gray-900">Your Journey</h3>
            </div>
            <p className="text-sm text-gray-600">
              You've earned {achievements.length} achievements so far. Every step forward is real progress.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {achievements.map(achievement => (
              <div key={achievement.id} className="bg-white rounded-2xl border border-gray-200 p-4 text-center">
                <span className="text-3xl mb-2 block">{achievement.icon}</span>
                <h4 className="font-semibold text-gray-900 text-sm mb-1">{achievement.title}</h4>
                <p className="text-xs text-gray-500 mb-2">{achievement.description}</p>
                <p className="text-xs text-gray-400">
                  {new Date(achievement.earned_date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                </p>
              </div>
            ))}
          </div>

          {/* Upcoming */}
          <div className="bg-white rounded-2xl border border-gray-200 p-4">
            <h3 className="font-semibold text-gray-900 text-sm mb-3">Next Achievements</h3>
            {[
              { icon: "🎯", title: "Deep Work", desc: "Complete 30 total sessions" },
              { icon: "🌊", title: "Calm Mind", desc: "Achieve GAD-7 below 5" },
              { icon: "☀️", title: "New Dawn", desc: "Achieve PHQ-9 below 9" },
            ].map(({ icon, title, desc }) => (
              <div key={title} className="flex items-center gap-3 py-2 border-b border-gray-50 last:border-0 opacity-50">
                <span className="text-2xl grayscale">{icon}</span>
                <div>
                  <p className="text-sm font-medium text-gray-700">{title}</p>
                  <p className="text-xs text-gray-400">{desc}</p>
                </div>
                <span className="ml-auto text-xs text-gray-300">🔒</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// Reviewed: 2026-06-13 — 24Therapy audit
