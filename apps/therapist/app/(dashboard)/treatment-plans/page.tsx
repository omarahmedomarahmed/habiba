"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Target, Plus, Calendar, CheckCircle2,
  Circle, AlertCircle, Brain, BookOpen,
  TrendingUp, Edit3, RefreshCw, Layers, Activity, Loader2
} from "lucide-react";
import { cn, getInitials, formatDate } from "@/lib/utils";
import { treatmentPlansAPI, APIError } from "@/lib/api";

interface TreatmentGoal {
  id: string;
  description: string;
  priority: "high" | "medium" | "low";
  status: "completed" | "in_progress" | "not_started" | "at_risk";
  progress: number;
  target_date: string;
}

interface TreatmentPlan {
  id: string;
  patient_id: string;
  patient_name: string;
  patient_avatar: string;
  status: string;
  modality: string;
  frequency: string;
  diagnoses: string[];
  start_date: string;
  review_date: string;
  estimated_sessions: number;
  completed_sessions: number;
  goals: TreatmentGoal[];
  interventions: string[];
  care_protocol: string;
  last_reviewed: string;
  phq9_at_start: number | null;
  phq9_current: number | null;
}

interface Protocol {
  id: string;
  name: string;
  evidence: string;
  modality: string;
  sessions: number;
  condition: string;
}

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
  const color =
    status === "completed" ? "bg-green-500" :
    status === "at_risk" ? "bg-red-500" :
    "bg-primary-600";
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-surface-tertiary rounded-full overflow-hidden">
        <div className={cn("h-full rounded-full transition-all", color)} style={{ width: `${progress}%` }} />
      </div>
      <span className="text-xs text-ink-500 w-8 text-right">{progress}%</span>
    </div>
  );
}

function normalizeGoal(raw: Record<string, unknown>): TreatmentGoal {
  const validStatuses = ["completed", "in_progress", "not_started", "at_risk"];
  const status = validStatuses.includes(raw.status as string)
    ? (raw.status as TreatmentGoal["status"])
    : "not_started";

  return {
    id: (raw.id as string) || "",
    description: (raw.description as string) || (raw.goal as string) || "Goal",
    priority: (["high", "medium", "low"].includes(raw.priority as string)
      ? raw.priority
      : "medium") as TreatmentGoal["priority"],
    status,
    progress: Math.min(100, Math.max(0, (raw.progress as number) || 0)),
    target_date: (raw.target_date as string) || (raw.due_date as string) || "",
  };
}

function normalizePlan(raw: Record<string, unknown>): TreatmentPlan {
  const patient = (raw.patient as Record<string, unknown>) || {};
  const firstName = (patient.first_name as string) || "";
  const lastName = (patient.last_name as string) || "";
  const patientName =
    (raw.patient_name as string) ||
    (firstName ? `${firstName} ${lastName}`.trim() : "Unknown");

  const goals = Array.isArray(raw.goals)
    ? (raw.goals as Record<string, unknown>[]).map(normalizeGoal)
    : [];

  const interventions = Array.isArray(raw.interventions)
    ? (raw.interventions as string[])
    : typeof raw.interventions === "string"
    ? (raw.interventions as string).split(",").map((s) => s.trim())
    : [];

  const diagnoses = Array.isArray(raw.diagnoses)
    ? (raw.diagnoses as string[])
    : typeof raw.diagnosis === "string"
    ? [(raw.diagnosis as string)]
    : [];

  return {
    id: (raw.id as string) || "",
    patient_id: (raw.patient_id as string) || (patient.id as string) || "",
    patient_name: patientName,
    patient_avatar: getInitials(patientName),
    status: (raw.status as string) || "active",
    modality:
      (raw.modality as string) ||
      (raw.treatment_modality as string) ||
      (raw.approach as string) ||
      "CBT",
    frequency:
      (raw.frequency as string) ||
      (raw.session_frequency as string) ||
      "Weekly",
    diagnoses,
    start_date: (raw.start_date as string) || (raw.created_at as string) || "",
    review_date: (raw.review_date as string) || (raw.next_review as string) || "",
    estimated_sessions: (raw.estimated_sessions as number) || 0,
    completed_sessions: (raw.completed_sessions as number) || (raw.sessions_completed as number) || 0,
    goals,
    interventions,
    care_protocol: (raw.care_protocol as string) || (raw.protocol as string) || "",
    last_reviewed: (raw.last_reviewed as string) || (raw.updated_at as string) || "",
    phq9_at_start: raw.phq9_at_start != null ? Number(raw.phq9_at_start) : null,
    phq9_current: raw.phq9_current != null ? Number(raw.phq9_current) : null,
  };
}

function normalizeProtocol(raw: Record<string, unknown>): Protocol {
  return {
    id: (raw.id as string) || "",
    name: (raw.name as string) || "",
    evidence: (raw.evidence as string) || (raw.evidence_level as string) || "Level II",
    modality: (raw.modality as string) || "",
    sessions: (raw.sessions as number) || (raw.recommended_sessions as number) || 12,
    condition: (raw.condition as string) || (raw.target_condition as string) || "",
  };
}

function PlanDetailSkeleton() {
  return (
    <div className="card p-6 space-y-6 animate-pulse">
      <div className="h-6 w-48 bg-surface-tertiary rounded" />
      <div className="h-4 w-32 bg-surface-tertiary rounded" />
      <div className="space-y-2">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-10 bg-surface-tertiary rounded-xl" />
        ))}
      </div>
    </div>
  );
}

export default function TreatmentPlansPage() {
  const [plans, setPlans] = useState<TreatmentPlan[]>([]);
  const [protocols, setProtocols] = useState<Protocol[]>([]);
  const [loading, setLoading] = useState(true);
  const [protocolsLoading, setProtocolsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"plans" | "protocols">("plans");
  const [reviewing, setReviewing] = useState<string | null>(null);

  const fetchPlans = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await treatmentPlansAPI.list({ status: "active", limit: 50 });
      const raw = Array.isArray(result)
        ? result
        : ((result as { data?: unknown[] }).data ?? []);
      const normalized = (raw as Record<string, unknown>[]).map(normalizePlan);
      setPlans(normalized);
      if (normalized.length > 0 && !selectedPlanId) {
        setSelectedPlanId(normalized[0].id);
      }
    } catch (err) {
      if (err instanceof APIError && err.status === 401) return;
      if (err instanceof APIError && (err.status === 404 || err.status === 405)) {
        setPlans([]);
      } else {
        setError((err as Error).message || "Failed to load treatment plans");
      }
    } finally {
      setLoading(false);
    }
  }, [selectedPlanId]);

  const fetchProtocols = useCallback(async () => {
    setProtocolsLoading(true);
    try {
      const result = await treatmentPlansAPI.protocols();
      const raw = Array.isArray(result) ? result : [];
      setProtocols((raw as Record<string, unknown>[]).map(normalizeProtocol));
    } catch {
      setProtocols([]);
    } finally {
      setProtocolsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPlans();
  }, []);  // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (activeTab === "protocols" && protocols.length === 0) {
      fetchProtocols();
    }
  }, [activeTab, protocols.length, fetchProtocols]);

  const handleReview = async (planId: string) => {
    setReviewing(planId);
    try {
      await treatmentPlansAPI.update(planId, { last_reviewed: new Date().toISOString() });
      setPlans((prev) =>
        prev.map((p) =>
          p.id === planId ? { ...p, last_reviewed: new Date().toISOString() } : p
        )
      );
    } catch {
      // silently ignore
    } finally {
      setReviewing(null);
    }
  };

  const selected = plans.find((p) => p.id === selectedPlanId);

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

        {/* Error Banner */}
        {error && (
          <div className="card p-4 border-l-4 border-l-red-500 bg-red-50/30 flex items-center justify-between">
            <div className="flex items-center gap-2 text-red-700 text-sm">
              <AlertCircle className="w-4 h-4 shrink-0" />
              {error}
            </div>
            <button onClick={fetchPlans} className="text-xs text-red-600 hover:underline font-medium">
              Retry
            </button>
          </div>
        )}

        {/* Tabs */}
        <div className="flex items-center gap-1 p-1 bg-surface-tertiary rounded-lg w-fit">
          {[
            { key: "plans", label: "Active Plans", icon: Target },
            { key: "protocols", label: "Care Protocols", icon: BookOpen },
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key as "plans" | "protocols")}
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
              {loading && Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="card p-4 animate-pulse">
                  <div className="flex items-start gap-3">
                    <div className="w-9 h-9 rounded-xl bg-surface-tertiary" />
                    <div className="flex-1 space-y-2">
                      <div className="h-4 w-32 bg-surface-tertiary rounded" />
                      <div className="h-3 w-48 bg-surface-tertiary rounded" />
                      <div className="h-1.5 w-full bg-surface-tertiary rounded-full" />
                    </div>
                  </div>
                </div>
              ))}

              {!loading && plans.length === 0 && (
                <div className="card p-8 text-center">
                  <Target className="w-10 h-10 text-ink-300 mx-auto mb-2" />
                  <p className="text-ink-500 text-sm">No active treatment plans</p>
                </div>
              )}

              {!loading && plans.map((plan) => {
                const completedGoals = plan.goals.filter((g) => g.status === "completed").length;
                const totalGoals = plan.goals.length;
                const overallProgress = totalGoals > 0
                  ? Math.round(plan.goals.reduce((s, g) => s + g.progress, 0) / totalGoals)
                  : 0;
                const phq9Improvement =
                  plan.phq9_at_start != null && plan.phq9_current != null
                    ? plan.phq9_at_start - plan.phq9_current
                    : 0;

                return (
                  <button
                    key={plan.id}
                    onClick={() => setSelectedPlanId(plan.id)}
                    className={cn(
                      "w-full text-left card p-4 hover:shadow-card-hover transition-all",
                      selectedPlanId === plan.id && "border-primary-300 bg-primary-50/30"
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
                        {plan.diagnoses.length > 0 && (
                          <p className="text-xs text-ink-500 mt-1 truncate">{plan.diagnoses[0]}</p>
                        )}
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
              {loading && <PlanDetailSkeleton />}

              {!loading && selected && (
                <div className="card p-6 space-y-6">
                  {/* Plan Header */}
                  <div className="flex items-start justify-between">
                    <div>
                      <h2 className="text-xl font-bold text-ink-900">{selected.patient_name}</h2>
                      <p className="text-sm text-ink-500 mt-0.5">
                        {selected.modality} · {selected.frequency}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleReview(selected.id)}
                        disabled={reviewing === selected.id}
                        className="btn-secondary flex items-center gap-1.5 text-sm disabled:opacity-50"
                      >
                        {reviewing === selected.id
                          ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          : <RefreshCw className="w-3.5 h-3.5" />}
                        Review Plan
                      </button>
                      <button className="btn-secondary flex items-center gap-1.5 text-sm">
                        <Edit3 className="w-3.5 h-3.5" />
                        Edit
                      </button>
                    </div>
                  </div>

                  {/* Diagnoses */}
                  {selected.diagnoses.length > 0 && (
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
                  )}

                  {/* PHQ-9 Progress */}
                  {selected.phq9_at_start != null && selected.phq9_current != null && (
                    <div className="p-4 bg-surface-secondary rounded-xl">
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-sm font-semibold text-ink-700">PHQ-9 Progress</span>
                        <span className="text-xs text-green-600 font-medium">
                          {selected.phq9_at_start - selected.phq9_current > 0
                            ? `↓ ${selected.phq9_at_start - selected.phq9_current} points improvement`
                            : selected.phq9_at_start - selected.phq9_current < 0
                            ? `↑ ${selected.phq9_current - selected.phq9_at_start} points increase`
                            : "No change"}
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
                  )}

                  {/* Goals */}
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-sm font-semibold text-ink-700 uppercase tracking-wider">Treatment Goals</h3>
                      <button className="text-xs text-primary-600 hover:text-primary-700 font-medium flex items-center gap-1">
                        <Plus className="w-3 h-3" />
                        Add Goal
                      </button>
                    </div>

                    {selected.goals.length === 0 ? (
                      <div className="card p-6 text-center">
                        <p className="text-ink-400 text-sm">No goals defined yet</p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {selected.goals.map((goal) => {
                          const config = GOAL_STATUS_CONFIG[goal.status] ?? GOAL_STATUS_CONFIG.not_started;
                          const GoalIcon = config.icon;
                          return (
                            <div key={goal.id} className="p-3 border border-surface-tertiary rounded-xl hover:border-surface-quaternary transition-colors">
                              <div className="flex items-start gap-2.5">
                                <GoalIcon className={cn("w-4 h-4 mt-0.5 flex-shrink-0", config.color)} />
                                <div className="flex-1">
                                  <div className="flex items-center justify-between gap-2">
                                    <p className="text-sm text-ink-800 font-medium">{goal.description}</p>
                                    <div className="flex items-center gap-2 flex-shrink-0">
                                      <span className={cn("text-xs px-1.5 py-0.5 rounded font-medium",
                                        PRIORITY_COLORS[goal.priority] ?? "text-ink-600 bg-surface-tertiary"
                                      )}>
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
                    )}
                  </div>

                  {/* Interventions */}
                  {selected.interventions.length > 0 && (
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
                  )}

                  {/* Care Protocol */}
                  {selected.care_protocol && (
                    <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-start gap-2.5">
                      <BookOpen className="w-4 h-4 text-emerald-600 mt-0.5 flex-shrink-0" />
                      <div>
                        <p className="text-sm font-medium text-emerald-800">Evidence-Based Protocol</p>
                        <p className="text-xs text-emerald-600">{selected.care_protocol}</p>
                      </div>
                    </div>
                  )}

                  {/* Meta */}
                  <div className="flex items-center gap-6 text-xs text-ink-400 pt-2 border-t border-surface-tertiary flex-wrap">
                    {selected.start_date && <span>Started: {formatDate(selected.start_date)}</span>}
                    {selected.review_date && <span>Review Due: {formatDate(selected.review_date)}</span>}
                    {selected.completed_sessions > 0 && <span>Sessions: {selected.completed_sessions}</span>}
                    {selected.last_reviewed && <span>Last Reviewed: {formatDate(selected.last_reviewed)}</span>}
                  </div>
                </div>
              )}

              {!loading && !selected && plans.length === 0 && (
                <div className="card p-12 text-center">
                  <Target className="w-12 h-12 text-ink-300 mx-auto mb-3" />
                  <p className="text-ink-500">No treatment plans yet.</p>
                  <p className="text-ink-400 text-sm mt-1">Create a new plan to get started.</p>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === "protocols" && (
          <div>
            {protocolsLoading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="card p-5 animate-pulse space-y-2">
                    <div className="h-5 w-32 bg-surface-tertiary rounded" />
                    <div className="h-3 w-20 bg-surface-tertiary rounded" />
                    <div className="h-3 w-full bg-surface-tertiary rounded" />
                  </div>
                ))}
              </div>
            ) : protocols.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {protocols.map((p) => (
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
            ) : (
              // Fallback static protocols when API returns nothing
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {[
                  { id: "cbt-d", name: "CBT for Depression", evidence: "Level I", modality: "CBT", sessions: 16, condition: "MDD" },
                  { id: "dbt-bpd", name: "DBT Skills Training", evidence: "Level I", modality: "DBT", sessions: 24, condition: "BPD" },
                  { id: "emdr-ptsd", name: "EMDR Trauma Processing", evidence: "Level I", modality: "EMDR", sessions: 12, condition: "PTSD" },
                  { id: "erp-ocd", name: "ERP for OCD", evidence: "Level I", modality: "ERP", sessions: 20, condition: "OCD" },
                  { id: "act-anx", name: "ACT for Anxiety", evidence: "Level II", modality: "ACT", sessions: 12, condition: "Anxiety" },
                ].map((p) => (
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
        )}
      </div>
    </div>
  );
}
