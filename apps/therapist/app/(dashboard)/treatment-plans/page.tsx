"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Target, Plus, ChevronRight, Calendar, Clock, CheckCircle2,
  Circle, AlertCircle, User, Brain, BarChart3, BookOpen,
  TrendingUp, Edit3, RefreshCw, Layers, Activity
} from "lucide-react";
import { cn, getInitials, formatDate } from "@/lib/utils";

const MOCK_TREATMENT_PLANS = [
  {
    id: "tp1",
    patient_id: "p1",
    patient_name: "Sarah Chen",
    patient_avatar: "SC",
    status: "active",
    modality: "CBT",
    frequency: "Weekly",
    diagnoses: ["Major Depressive Disorder (F32.1)", "Generalized Anxiety Disorder (F41.1)"],
    start_date: "2024-08-15",
    review_date: "2025-02-15",
    estimated_sessions: 20,
    completed_sessions: 24,
    goals: [
      { id: "g1", description: "Reduce PHQ-9 score to below 5", priority: "high", status: "in_progress", progress: 65, target_date: "2026-02-01" },
      { id: "g2", description: "Develop 3 evidence-based coping strategies", priority: "high", status: "completed", progress: 100, target_date: "2025-12-01" },
      { id: "g3", description: "Improve sleep quality to 7+ hours/night", priority: "medium", status: "in_progress", progress: 40, target_date: "2026-03-01" },
      { id: "g4", description: "Resume social activities (2x/week)", priority: "low", status: "not_started", progress: 0, target_date: "2026-04-01" },
    ],
    interventions: ["Cognitive Restructuring", "Behavioral Activation", "Mindfulness-Based Techniques", "Sleep Hygiene Education"],
    care_protocol: "CBT for Depression (Level I Evidence)",
    last_reviewed: "2025-11-15",
    phq9_at_start: 17,
    phq9_current: 13,
  },
  {
    id: "tp2",
    patient_id: "p3",
    patient_name: "James Rodriguez",
    patient_avatar: "JR",
    status: "active",
    modality: "EMDR + CBT",
    frequency: "2x Weekly",
    diagnoses: ["Post-Traumatic Stress Disorder (F43.10)", "Major Depressive Disorder (F32.2)"],
    start_date: "2023-06-15",
    review_date: "2026-01-15",
    estimated_sessions: 30,
    completed_sessions: 36,
    goals: [
      { id: "g5", description: "Process primary trauma memory using EMDR", priority: "high", status: "in_progress", progress: 50, target_date: "2026-06-01" },
      { id: "g6", description: "Reduce PCL-5 score below 33", priority: "high", status: "in_progress", progress: 35, target_date: "2026-06-01" },
      { id: "g7", description: "Develop robust safety plan", priority: "high", status: "completed", progress: 100, target_date: "2025-12-01" },
    ],
    interventions: ["EMDR Phase 1-3", "CBT for Depression", "Safety Planning", "Grounding Techniques"],
    care_protocol: "EMDR Trauma Processing (Level I Evidence)",
    last_reviewed: "2025-12-01",
    phq9_at_start: 22,
    phq9_current: 19,
  },
  {
    id: "tp3",
    patient_id: "p4",
    patient_name: "Emma Williams",
    patient_avatar: "EW",
    status: "active",
    modality: "ERP",
    frequency: "Weekly",
    diagnoses: ["Obsessive-Compulsive Disorder (F42.2)", "Generalized Anxiety Disorder (F41.1)"],
    start_date: "2024-05-20",
    review_date: "2026-01-20",
    estimated_sessions: 20,
    completed_sessions: 18,
    goals: [
      { id: "g8", description: "Complete ERP hierarchy - 80% of items", priority: "high", status: "in_progress", progress: 70, target_date: "2026-03-01" },
      { id: "g9", description: "Reduce compulsion frequency to <2/day", priority: "high", status: "in_progress", progress: 55, target_date: "2026-02-01" },
    ],
    interventions: ["Exposure and Response Prevention (ERP)", "Cognitive Restructuring", "Mindfulness"],
    care_protocol: "ERP for OCD (Level I Evidence)",
    last_reviewed: "2025-11-20",
    phq9_at_start: 11,
    phq9_current: 7,
  },
];

const CARE_PROTOCOLS = [
  { id: "cbt-d", name: "CBT for Depression", evidence: "Level I", modality: "CBT", sessions: 16, condition: "MDD" },
  { id: "dbt-bpd", name: "DBT Skills Training", evidence: "Level I", modality: "DBT", sessions: 24, condition: "BPD" },
  { id: "emdr-ptsd", name: "EMDR Trauma Processing", evidence: "Level I", modality: "EMDR", sessions: 12, condition: "PTSD" },
  { id: "erp-ocd", name: "ERP for OCD", evidence: "Level I", modality: "ERP", sessions: 20, condition: "OCD" },
  { id: "act-anx", name: "ACT for Anxiety", evidence: "Level II", modality: "ACT", sessions: 12, condition: "Anxiety" },
];

const GOAL_STATUS_CONFIG = {
  completed: { color: "text-green-600", bg: "bg-green-100", icon: CheckCircle2, label: "Completed" },
  in_progress: { color: "text-blue-600", bg: "bg-blue-100", icon: Activity, label: "In Progress" },
  not_started: { color: "text-ink-400", bg: "bg-surface-tertiary", icon: Circle, label: "Not Started" },
  at_risk: { color: "text-red-600", bg: "bg-red-100", icon: AlertCircle, label: "At Risk" },
};

const PRIORITY_COLORS = {
  high: "text-red-600 bg-red-50",
  medium: "text-amber-600 bg-amber-50",
  low: "text-green-600 bg-green-50",
};

function GoalProgressBar({ progress, status }: { progress: number; status: string }) {
  const color = status === "completed" ? "bg-green-500" : status === "at_risk" ? "bg-red-500" : "bg-primary-600";
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-surface-tertiary rounded-full overflow-hidden">
        <div className={cn("h-full rounded-full transition-all", color)} style={{ width: `${progress}%` }} />
      </div>
      <span className="text-xs text-ink-500 w-8 text-right">{progress}%</span>
    </div>
  );
}

export default function TreatmentPlansPage() {
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"plans" | "protocols">("plans");

  const selected = MOCK_TREATMENT_PLANS.find((p) => p.id === selectedPlan);

  return (
    <div className="flex-1 overflow-y-auto bg-surface-secondary">
      <div className="max-w-7xl mx-auto p-6 space-y-6">

        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-ink-900">Treatment Plans</h1>
            <p className="text-ink-500 text-sm mt-1">Evidence-based care planning and goal tracking</p>
          </div>
          <button className="btn-primary flex items-center gap-2">
            <Plus className="w-4 h-4" />
            New Treatment Plan
          </button>
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-1 p-1 bg-surface-tertiary rounded-lg w-fit">
          {[
            { key: "plans", label: "Active Plans", icon: Target },
            { key: "protocols", label: "Care Protocols", icon: BookOpen },
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key as any)}
              className={cn(
                "flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors",
                activeTab === tab.key
                  ? "bg-white text-ink-900 shadow-sm"
                  : "text-ink-500 hover:text-ink-700"
              )}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
            </button>
          ))}
        </div>

        {activeTab === "plans" && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Plans List */}
            <div className="lg:col-span-1 space-y-3">
              {MOCK_TREATMENT_PLANS.map((plan) => {
                const completedGoals = plan.goals.filter((g) => g.status === "completed").length;
                const totalGoals = plan.goals.length;
                const overallProgress = Math.round(plan.goals.reduce((s, g) => s + g.progress, 0) / totalGoals);
                const phq9Improvement = plan.phq9_at_start - plan.phq9_current;

                return (
                  <button
                    key={plan.id}
                    onClick={() => setSelectedPlan(plan.id)}
                    className={cn(
                      "w-full text-left card p-4 hover:shadow-card-hover transition-all",
                      selectedPlan === plan.id && "border-primary-300 bg-primary-50/30"
                    )}
                  >
                    <div className="flex items-start gap-3">
                      <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary-100 to-primary-200 flex items-center justify-center flex-shrink-0">
                        <span className="text-sm font-bold text-primary-700">{plan.patient_avatar}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <span className="font-semibold text-sm text-ink-900">{plan.patient_name}</span>
                          <span className="text-xs text-primary-600 font-medium bg-primary-50 px-2 py-0.5 rounded">
                            {plan.modality}
                          </span>
                        </div>
                        <p className="text-xs text-ink-500 mt-1 truncate">{plan.diagnoses[0]}</p>
                        <div className="mt-2 space-y-1">
                          <div className="flex items-center justify-between text-xs text-ink-500">
                            <span>Goals: {completedGoals}/{totalGoals}</span>
                            <span>{overallProgress}%</span>
                          </div>
                          <div className="h-1 bg-surface-tertiary rounded-full overflow-hidden">
                            <div className="h-full bg-primary-600 rounded-full" style={{ width: `${overallProgress}%` }} />
                          </div>
                        </div>
                        {phq9Improvement > 0 && (
                          <div className="mt-1.5 flex items-center gap-1 text-xs text-green-600">
                            <TrendingUp className="w-3 h-3 rotate-180" />
                            PHQ-9 improved by {phq9Improvement} pts
                          </div>
                        )}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Plan Detail */}
            <div className="lg:col-span-2">
              {selected ? (
                <div className="card p-6 space-y-6">
                  {/* Plan Header */}
                  <div className="flex items-start justify-between">
                    <div>
                      <h2 className="text-xl font-bold text-ink-900">{selected.patient_name}</h2>
                      <p className="text-sm text-ink-500 mt-0.5">{selected.modality} · {selected.frequency}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button className="btn-secondary flex items-center gap-1.5 text-sm">
                        <RefreshCw className="w-3.5 h-3.5" />
                        Review Plan
                      </button>
                      <button className="btn-secondary flex items-center gap-1.5 text-sm">
                        <Edit3 className="w-3.5 h-3.5" />
                        Edit
                      </button>
                    </div>
                  </div>

                  {/* Diagnoses */}
                  <div>
                    <h3 className="text-sm font-semibold text-ink-700 mb-2 uppercase tracking-wider">Diagnoses</h3>
                    <div className="space-y-1">
                      {selected.diagnoses.map((d, i) => (
                        <div key={i} className="flex items-center gap-2 text-sm text-ink-700">
                          <div className="w-1.5 h-1.5 rounded-full bg-primary-600" />
                          {d}
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* PHQ-9 Progress */}
                  <div className="p-4 bg-surface-secondary rounded-xl">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-sm font-semibold text-ink-700">PHQ-9 Progress</span>
                      <span className="text-xs text-green-600 font-medium">
                        {selected.phq9_at_start - selected.phq9_current > 0
                          ? `↓ ${selected.phq9_at_start - selected.phq9_current} points improvement`
                          : `↑ ${selected.phq9_current - selected.phq9_at_start} points increase`}
                      </span>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-center">
                        <div className="text-2xl font-bold text-red-600">{selected.phq9_at_start}</div>
                        <div className="text-xs text-ink-400">At Start</div>
                      </div>
                      <div className="flex-1 h-2 bg-surface-tertiary rounded-full relative">
                        <div
                          className="absolute left-0 h-full bg-red-200 rounded-full"
                          style={{ width: `${(selected.phq9_at_start / 27) * 100}%` }}
                        />
                        <div
                          className="absolute left-0 h-full bg-green-500 rounded-full"
                          style={{ width: `${(selected.phq9_current / 27) * 100}%` }}
                        />
                      </div>
                      <div className="text-center">
                        <div className="text-2xl font-bold text-green-600">{selected.phq9_current}</div>
                        <div className="text-xs text-ink-400">Current</div>
                      </div>
                    </div>
                  </div>

                  {/* Goals */}
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-sm font-semibold text-ink-700 uppercase tracking-wider">Treatment Goals</h3>
                      <button className="text-xs text-primary-600 hover:text-primary-700 font-medium flex items-center gap-1">
                        <Plus className="w-3 h-3" />
                        Add Goal
                      </button>
                    </div>
                    <div className="space-y-3">
                      {selected.goals.map((goal) => {
                        const config = GOAL_STATUS_CONFIG[goal.status as keyof typeof GOAL_STATUS_CONFIG] || GOAL_STATUS_CONFIG.not_started;
                        const GoalIcon = config.icon;
                        return (
                          <div key={goal.id} className="p-3 border border-surface-tertiary rounded-xl hover:border-surface-quaternary transition-colors">
                            <div className="flex items-start gap-2.5">
                              <GoalIcon className={cn("w-4 h-4 mt-0.5 flex-shrink-0", config.color)} />
                              <div className="flex-1">
                                <div className="flex items-center justify-between gap-2">
                                  <p className="text-sm text-ink-800 font-medium">{goal.description}</p>
                                  <div className="flex items-center gap-2 flex-shrink-0">
                                    <span className={cn("text-xs px-1.5 py-0.5 rounded font-medium", PRIORITY_COLORS[goal.priority as keyof typeof PRIORITY_COLORS])}>
                                      {goal.priority}
                                    </span>
                                  </div>
                                </div>
                                <div className="mt-1.5">
                                  <GoalProgressBar progress={goal.progress} status={goal.status} />
                                </div>
                                {goal.target_date && (
                                  <p className="text-xs text-ink-400 mt-1">
                                    Target: {formatDate(goal.target_date)}
                                  </p>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Interventions */}
                  <div>
                    <h3 className="text-sm font-semibold text-ink-700 mb-2 uppercase tracking-wider">Interventions</h3>
                    <div className="flex flex-wrap gap-2">
                      {selected.interventions.map((i) => (
                        <span key={i} className="px-3 py-1 bg-primary-50 text-primary-700 text-sm rounded-full border border-primary-200">
                          {i}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Care Protocol */}
                  <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-start gap-2.5">
                    <BookOpen className="w-4 h-4 text-emerald-600 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="text-sm font-medium text-emerald-800">Evidence-Based Protocol</p>
                      <p className="text-xs text-emerald-600">{selected.care_protocol}</p>
                    </div>
                  </div>

                  {/* Meta */}
                  <div className="flex items-center gap-6 text-xs text-ink-400 pt-2 border-t border-surface-tertiary">
                    <span>Started: {formatDate(selected.start_date)}</span>
                    <span>Review Due: {formatDate(selected.review_date)}</span>
                    <span>Sessions: {selected.completed_sessions}</span>
                    <span>Last Reviewed: {formatDate(selected.last_reviewed)}</span>
                  </div>
                </div>
              ) : (
                <div className="card p-12 text-center">
                  <Target className="w-12 h-12 text-ink-300 mx-auto mb-3" />
                  <p className="text-ink-500">Select a treatment plan to view details</p>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === "protocols" && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {CARE_PROTOCOLS.map((p) => (
              <div key={p.id} className="card p-5 hover:shadow-card-hover transition-all">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h3 className="font-semibold text-ink-900">{p.name}</h3>
                    <p className="text-sm text-ink-500">{p.condition}</p>
                  </div>
                  <span className="text-xs px-2 py-1 bg-green-50 text-green-700 border border-green-200 rounded-full font-medium">
                    {p.evidence}
                  </span>
                </div>
                <div className="flex items-center gap-3 text-xs text-ink-500">
                  <span className="flex items-center gap-1">
                    <Layers className="w-3 h-3" />
                    {p.modality}
                  </span>
                  <span className="flex items-center gap-1">
                    <Calendar className="w-3 h-3" />
                    {p.sessions} sessions
                  </span>
                </div>
                <button className="mt-3 w-full btn-secondary text-sm py-1.5 flex items-center justify-center gap-1.5">
                  <BookOpen className="w-3.5 h-3.5" />
                  Use Protocol
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
