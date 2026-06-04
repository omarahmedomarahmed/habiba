"use client";

import { useState } from "react";
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

const ASSESSMENT_HISTORY: AssessmentDataPoint[] = [
  { date: "Aug 2024", phq9: 19, gad7: 15, session: 1 },
  { date: "Sep 2024", phq9: 17, gad7: 13, session: 5 },
  { date: "Oct 2024", phq9: 16, gad7: 12, session: 9 },
  { date: "Nov 2024", phq9: 17, gad7: 14, session: 13 },
  { date: "Dec 2024", phq9: 15, gad7: 11, session: 17 },
  { date: "Jan 2025", phq9: 14, gad7: 10, session: 19 },
  { date: "Feb 2025", phq9: 13, gad7: 9, session: 21 },
  { date: "Mar 2025", phq9: 12, gad7: 9, session: 22 },
  { date: "Apr 2025", phq9: 11, gad7: 8, session: 23 },
  { date: "Dec 2025", phq9: 13, gad7: 8, session: 24 },
];

const THERAPY_GOALS: TherapyGoal[] = [
  {
    id: "g1",
    title: "Reduce PHQ-9 below 9 (minimal depression)",
    category: "symptom",
    progress: 52,
    target_date: "2026-03-01",
    started_date: "2024-08-15",
    status: "active",
    sessions_count: 24,
    last_updated: "2025-12-15",
    milestones: ["PHQ-9 below 17 ✓", "PHQ-9 below 14 ✓", "PHQ-9 below 11", "PHQ-9 below 9"],
    notes: "Strong improvement trajectory. Seasonal dip in Nov expected but managing well."
  },
  {
    id: "g2",
    title: "Develop 5 evidence-based coping strategies",
    category: "skill",
    progress: 100,
    target_date: "2025-11-15",
    started_date: "2024-09-01",
    status: "completed",
    sessions_count: 12,
    last_updated: "2025-11-15",
    milestones: ["4-7-8 Breathing ✓", "5-4-3-2-1 Grounding ✓", "Thought Records ✓", "Behavioral Activation ✓", "Self-Compassion ✓"]
  },
  {
    id: "g3",
    title: "Improve sleep quality — 7+ hours/night consistently",
    category: "behavioral",
    progress: 70,
    target_date: "2026-01-31",
    started_date: "2024-10-01",
    status: "active",
    sessions_count: 10,
    last_updated: "2025-12-10",
    milestones: ["Sleep log started ✓", "Consistent bedtime ✓", "7+ hours 3x/week ✓", "7+ hours 5x/week"]
  },
  {
    id: "g4",
    title: "Re-engage with social activities (2x/week)",
    category: "social",
    progress: 40,
    target_date: "2026-02-28",
    started_date: "2025-01-01",
    status: "active",
    sessions_count: 6,
    last_updated: "2025-12-08",
    milestones: ["Identify 3 social activities ✓", "Attempt one social event ✓", "Consistent 1x/week", "Consistent 2x/week"]
  },
  {
    id: "g5",
    title: "Complete CBT thought record homework (4 weeks)",
    category: "milestone",
    progress: 100,
    target_date: "2025-11-15",
    started_date: "2025-10-15",
    status: "completed",
    sessions_count: 4,
    last_updated: "2025-11-15",
    milestones: ["Week 1 ✓", "Week 2 ✓", "Week 3 ✓", "Week 4 ✓"]
  },
];

const ACHIEVEMENTS: Achievement[] = [
  { id: "a1", title: "First Step", description: "Completed your first therapy session", earned_date: "2024-08-15", icon: "🌱", category: "milestone" },
  { id: "a2", title: "Consistent Carer", description: "Attended 10 sessions in a row", earned_date: "2024-11-20", icon: "🌟", category: "attendance" },
  { id: "a3", title: "Goal Crusher", description: "Completed your first treatment goal", earned_date: "2025-11-15", icon: "🏆", category: "goals" },
  { id: "a4", title: "Skill Builder", description: "Learned and practiced 5 coping strategies", earned_date: "2025-11-15", icon: "🛠️", category: "skills" },
  { id: "a5", title: "Journal Keeper", description: "Maintained a 7-day journal streak", earned_date: "2025-12-16", icon: "📝", category: "habits" },
  { id: "a6", title: "Self-Awareness", description: "Tracked mood for 30 consecutive days", earned_date: "2025-12-01", icon: "🔮", category: "habits" },
];

const WEEKLY_SUMMARY = {
  mood_avg: 6.4,
  mood_change: +0.8,
  anxiety_avg: 4.2,
  anxiety_change: -0.5,
  sleep_avg: 7.1,
  sleep_change: +0.3,
  exercise_days: 3,
  journal_days: 5,
  homework_completed: 3,
  homework_total: 4,
};

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

  const currentPHQ9 = ASSESSMENT_HISTORY[ASSESSMENT_HISTORY.length - 1].phq9;
  const startPHQ9 = ASSESSMENT_HISTORY[0].phq9;
  const phq9Change = currentPHQ9 - startPHQ9;
  const phq9PctImprovement = Math.round(((startPHQ9 - currentPHQ9) / startPHQ9) * 100);

  const currentGAD7 = ASSESSMENT_HISTORY[ASSESSMENT_HISTORY.length - 1].gad7;
  const startGAD7 = ASSESSMENT_HISTORY[0].gad7;
  const gad7Change = currentGAD7 - startGAD7;
  const gad7PctImprovement = Math.round(((startGAD7 - currentGAD7) / startGAD7) * 100);

  const completedGoals = THERAPY_GOALS.filter(g => g.status === "completed").length;
  const activeGoals = THERAPY_GOALS.filter(g => g.status === "active").length;

  return (
    <div className="max-w-2xl mx-auto space-y-5">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">My Progress</h1>
        <p className="text-sm text-gray-500 mt-0.5">4 months of therapy · 24 sessions · Managed by Dr. Alex Smith</p>
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
            <p className="text-2xl font-bold text-amber-300">{completedGoals}/{THERAPY_GOALS.length}</p>
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
              {[
                { label: "Mood Avg", value: WEEKLY_SUMMARY.mood_avg, change: WEEKLY_SUMMARY.mood_change, icon: Smile, unit: "/10" },
                { label: "Anxiety Avg", value: WEEKLY_SUMMARY.anxiety_avg, change: WEEKLY_SUMMARY.anxiety_change, icon: Activity, unit: "/10", invertGood: true },
                { label: "Sleep Avg", value: WEEKLY_SUMMARY.sleep_avg, change: WEEKLY_SUMMARY.sleep_change, icon: Moon, unit: "h" },
                { label: "Journal Days", value: WEEKLY_SUMMARY.journal_days, change: 0, icon: BookOpen, unit: "/7" },
              ].map(({ label, value, change, icon: Icon, unit, invertGood }) => (
                <div key={label} className="bg-gray-50 rounded-xl p-3">
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-xs text-gray-500">{label}</p>
                    <Icon className="h-3.5 w-3.5 text-gray-400" />
                  </div>
                  <div className="flex items-baseline gap-1">
                    <p className="text-xl font-bold text-gray-900">{value}</p>
                    <p className="text-xs text-gray-400">{unit}</p>
                  </div>
                  {change !== 0 && (
                    <p className={cn("text-xs font-medium mt-0.5", (!invertGood && change > 0) || (invertGood && change < 0) ? "text-emerald-600" : "text-rose-500")}>
                      {change > 0 ? "+" : ""}{change} vs last week
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Homework */}
          <div className="bg-amber-50 rounded-2xl border border-amber-100 p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-gray-900 text-sm flex items-center gap-2">
                <BookOpen className="h-4 w-4 text-amber-600" /> This Week's Homework
              </h3>
              <span className="text-xs text-amber-600 font-medium">{WEEKLY_SUMMARY.homework_completed}/{WEEKLY_SUMMARY.homework_total} done</span>
            </div>
            <ProgressBar value={Math.round((WEEKLY_SUMMARY.homework_completed / WEEKLY_SUMMARY.homework_total) * 100)} color="bg-amber-500" />
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
              {THERAPY_GOALS.filter(g => g.status === "active").slice(0, 3).map(goal => (
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
            <div className="flex gap-3">
              {ACHIEVEMENTS.slice(-3).map(a => (
                <div key={a.id} className="flex-1 text-center bg-gray-50 rounded-xl p-3">
                  <span className="text-2xl">{a.icon}</span>
                  <p className="text-xs font-medium text-gray-700 mt-1">{a.title}</p>
                </div>
              ))}
            </div>
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
              <p className="text-2xl font-bold text-gray-700">{THERAPY_GOALS.length}</p>
              <p className="text-xs text-gray-500">Total Goals</p>
            </div>
          </div>

          {THERAPY_GOALS.map(goal => (
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
                <TrendingDown className="h-3 w-3 inline" /> Down {Math.abs(phq9Change)} from start ({phq9PctImprovement}% better)
              </p>
              <p className="text-xs text-gray-400 mt-1">
                Interpretation: {currentPHQ9 < 5 ? "None" : currentPHQ9 < 10 ? "Mild" : currentPHQ9 < 15 ? "Moderate" : "Moderately Severe"}
              </p>
            </div>
            <div className="bg-white rounded-2xl border border-gray-200 p-4">
              <p className="text-xs text-gray-500 mb-1">GAD-7 (Anxiety)</p>
              <p className="text-3xl font-bold text-gray-900">{currentGAD7}</p>
              <p className="text-xs font-medium text-emerald-600 mt-0.5">
                <TrendingDown className="h-3 w-3 inline" /> Down {Math.abs(gad7Change)} from start ({gad7PctImprovement}% better)
              </p>
              <p className="text-xs text-gray-400 mt-1">
                Interpretation: {currentGAD7 < 5 ? "Minimal" : currentGAD7 < 10 ? "Mild" : currentGAD7 < 15 ? "Moderate" : "Severe"}
              </p>
            </div>
          </div>

          {/* PHQ-9 chart */}
          <div className="bg-white rounded-2xl border border-gray-200 p-4">
            <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <BarChart2 className="h-4 w-4 text-gray-400" /> PHQ-9 Over Time (Lower is Better)
            </h3>
            <MiniChart data={ASSESSMENT_HISTORY} field="phq9" color="bg-rose-400" />
            <div className="flex items-end gap-1 mt-1">
              {ASSESSMENT_HISTORY.slice(-8).map((d, i) => (
                <div key={i} className="flex-1 text-center">
                  <p className="text-[9px] text-gray-400">{d.date.substring(0, 3)}</p>
                </div>
              ))}
            </div>
            <div className="mt-3 p-3 bg-emerald-50 rounded-xl">
              <p className="text-xs text-emerald-700">📈 {phq9PctImprovement}% improvement since starting therapy. Goal: score below 9.</p>
            </div>
          </div>

          {/* GAD-7 chart */}
          <div className="bg-white rounded-2xl border border-gray-200 p-4">
            <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <Activity className="h-4 w-4 text-gray-400" /> GAD-7 Over Time (Lower is Better)
            </h3>
            <MiniChart data={ASSESSMENT_HISTORY} field="gad7" color="bg-amber-400" />
            <div className="flex items-end gap-1 mt-1">
              {ASSESSMENT_HISTORY.slice(-8).map((d, i) => (
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
              {ASSESSMENT_HISTORY.slice().reverse().map((d, i) => (
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

          <div className="bg-blue-50 rounded-2xl p-4 flex gap-3">
            <Shield className="h-4 w-4 text-blue-500 shrink-0 mt-0.5" />
            <p className="text-xs text-blue-700">Assessment scores are provided by your therapist Dr. Alex Smith. These reflect clinical measurement — your personal experience of progress may vary.</p>
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
              You've earned {ACHIEVEMENTS.length} achievements over 4 months of therapy. Every step forward is real progress.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {ACHIEVEMENTS.map(achievement => (
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
