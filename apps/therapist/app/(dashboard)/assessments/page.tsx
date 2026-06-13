"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  ClipboardList, Plus, Search, TrendingUp, TrendingDown, Minus,
  AlertCircle, CheckCircle2, Clock, Calendar, BarChart3,
  Brain, Send, Loader2
} from "lucide-react";
import { cn, formatDate, getInitials } from "@/lib/utils";
import { assessmentsAPI, APIError } from "@/lib/api";

interface Assessment {
  id: string;
  patient_id: string;
  patient_name: string;
  template_code: string;
  template_name: string;
  status: string;
  total_score: number | null;
  severity_label: string | null;
  administered_at: string | null;
  previous_score: number | null;
  trend: string | null;
  risk_flag: boolean;
}

interface AssessmentTemplate {
  id: string;
  code: string;
  name: string;
  description: string;
  duration: number;
  questions: number;
}

const SEVERITY_COLORS: Record<string, string> = {
  minimal: "text-green-700 bg-green-50 border-green-200",
  mild: "text-yellow-700 bg-yellow-50 border-yellow-200",
  moderate: "text-orange-700 bg-orange-50 border-orange-200",
  moderately_severe: "text-red-700 bg-red-50 border-red-200",
  severe: "text-red-900 bg-red-100 border-red-300",
  active_ideation: "text-red-900 bg-red-100 border-red-300",
  below_threshold: "text-green-700 bg-green-50 border-green-200",
  probable_ptsd: "text-red-700 bg-red-50 border-red-200",
};

const SCORE_RANGES: Record<string, { max: number; label: string }> = {
  PHQ9: { max: 27, label: "/27" },
  GAD7: { max: 21, label: "/21" },
  PCL5: { max: 80, label: "/80" },
  "C-SSRS": { max: 4, label: "/4" },
  DASS21: { max: 126, label: "/126" },
};

function TrendBadge({ trend }: { trend: string | null }) {
  if (!trend) return null;
  if (trend === "improving")
    return (
      <span className="flex items-center gap-1 text-xs text-green-600 font-medium">
        <TrendingDown className="w-3 h-3" /> Improving
      </span>
    );
  if (trend === "worsening")
    return (
      <span className="flex items-center gap-1 text-xs text-red-600 font-medium">
        <TrendingUp className="w-3 h-3" /> Worsening
      </span>
    );
  return (
    <span className="flex items-center gap-1 text-xs text-ink-500 font-medium">
      <Minus className="w-3 h-3" /> Stable
    </span>
  );
}

function normalizeAssessment(raw: Record<string, unknown>): Assessment {
  const patient = (raw.patient as Record<string, unknown>) || {};
  const patientName =
    (raw.patient_name as string) ||
    (patient.first_name
      ? `${patient.first_name} ${patient.last_name || ""}`.trim()
      : "Unknown");

  const templateCode =
    ((raw.template_code as string) || (raw.code as string) || "").toUpperCase();
  const templateName =
    (raw.template_name as string) || (raw.name as string) || templateCode;

  return {
    id: (raw.id as string) || "",
    patient_id: (raw.patient_id as string) || (patient.id as string) || "",
    patient_name: patientName,
    template_code: templateCode,
    template_name: templateName,
    status: (raw.status as string) || "pending",
    total_score: raw.total_score != null ? Number(raw.total_score) : null,
    severity_label: (raw.severity_label as string) || (raw.severity as string) || null,
    administered_at:
      (raw.administered_at as string) ||
      (raw.completed_at as string) ||
      null,
    previous_score:
      raw.previous_score != null ? Number(raw.previous_score) : null,
    trend: (raw.trend as string) || null,
    risk_flag: !!(raw.risk_flag ?? raw.has_risk_flag),
  };
}

function normalizeTemplate(raw: Record<string, unknown>): AssessmentTemplate {
  return {
    id: (raw.id as string) || "",
    code: ((raw.code as string) || (raw.template_code as string) || "").toUpperCase(),
    name: (raw.name as string) || (raw.template_name as string) || "",
    description: (raw.description as string) || "",
    duration: (raw.duration as number) || 5,
    questions: (raw.questions as number) || (raw.question_count as number) || 0,
  };
}

function SkeletonRow() {
  return (
    <tr className="animate-pulse">
      <td className="px-5 py-4"><div className="flex items-center gap-2.5"><div className="w-8 h-8 rounded-lg bg-surface-tertiary" /><div className="h-4 w-28 bg-surface-tertiary rounded" /></div></td>
      <td className="px-5 py-4"><div className="h-4 w-16 bg-surface-tertiary rounded" /></td>
      <td className="px-5 py-4"><div className="h-4 w-20 bg-surface-tertiary rounded" /></td>
      <td className="px-5 py-4"><div className="h-4 w-24 bg-surface-tertiary rounded" /></td>
      <td className="px-5 py-4"><div className="h-4 w-16 bg-surface-tertiary rounded" /></td>
      <td className="px-5 py-4"><div className="h-4 w-20 bg-surface-tertiary rounded" /></td>
      <td className="px-5 py-4"><div className="h-4 w-10 bg-surface-tertiary rounded" /></td>
    </tr>
  );
}

export default function AssessmentsPage() {
  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [templates, setTemplates] = useState<AssessmentTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [templatesLoading, setTemplatesLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sendingId, setSendingId] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const fetchAssessments = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // assessmentsAPI.results() takes a patientId — without one, fetch all
      // Try general list endpoint first; fall back to results with no id
      const result = await (assessmentsAPI as unknown as {
        list?: (p: Record<string, unknown>) => Promise<unknown>;
      }).list?.({ search: search || undefined, status: statusFilter !== "all" ? statusFilter : undefined }) ??
        await assessmentsAPI.results("");
      const raw = Array.isArray(result)
        ? result
        : ((result as { data?: unknown[] }).data ?? []);
      setAssessments((raw as Record<string, unknown>[]).map(normalizeAssessment));
    } catch (err) {
      if (err instanceof APIError && err.status === 401) return;
      // If endpoint doesn't exist yet, just show empty state
      if (err instanceof APIError && (err.status === 404 || err.status === 405)) {
        setAssessments([]);
      } else {
        setError((err as Error).message || "Failed to load assessments");
      }
    } finally {
      setLoading(false);
    }
  }, [search, statusFilter]);

  const fetchTemplates = useCallback(async () => {
    setTemplatesLoading(true);
    try {
      const result = await assessmentsAPI.templates();
      const raw = Array.isArray(result) ? result : [];
      setTemplates((raw as Record<string, unknown>[]).map(normalizeTemplate));
    } catch {
      setTemplates([]);
    } finally {
      setTemplatesLoading(false);
    }
  }, []);

  useEffect(() => {
    const t = setTimeout(fetchAssessments, search ? 400 : 0);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  useEffect(() => {
    fetchAssessments();
  }, [fetchAssessments, statusFilter]);

  useEffect(() => {
    fetchTemplates();
  }, [fetchTemplates]);

  const handleSendReminder = async (a: Assessment) => {
    if (!a.patient_id || a.status !== "pending" || sendingId) return;
    setSendingId(a.id);
    try {
      await assessmentsAPI.sendToPatient(a.patient_id, a.id);
    } catch {
      // silently ignore
    } finally {
      setSendingId(null);
    }
  };

  const filtered = assessments.filter((a) => {
    const matchSearch =
      !search ||
      a.patient_name.toLowerCase().includes(search.toLowerCase()) ||
      a.template_code.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === "all" || a.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const pending = filtered.filter((a) => a.status === "pending").length;
  const flagged = filtered.filter((a) => a.risk_flag).length;
  const worsening = filtered.filter((a) => a.trend === "worsening").length;

  return (
    <div className="flex-1 overflow-y-auto bg-surface-secondary">
      <div className="max-w-6xl mx-auto p-6 space-y-6">

        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-ink-900">Assessments</h1>
            <p className="text-ink-500 text-sm mt-1">Track patient outcomes with standardized measures</p>
          </div>
          <Link href="/assessments/new" className="btn-primary flex items-center gap-2">
            <Plus className="w-4 h-4" />
            New Assessment
          </Link>
        </div>

        {/* Error Banner */}
        {error && (
          <div className="card p-4 border-l-4 border-l-red-500 bg-red-50/30 flex items-center justify-between">
            <div className="flex items-center gap-2 text-red-700 text-sm">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              {error}
            </div>
            <button onClick={fetchAssessments} className="text-xs text-red-600 hover:underline font-medium">
              Retry
            </button>
          </div>
        )}

        {/* Alert Cards */}
        {!loading && (flagged > 0 || worsening > 0) && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {flagged > 0 && (
              <div className="card p-4 border-l-4 border-l-red-500 bg-red-50/30">
                <div className="flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold text-red-800 text-sm">
                      {flagged} assessment{flagged > 1 ? "s" : ""} with risk flags
                    </p>
                    <p className="text-red-600 text-xs mt-0.5">Immediate clinical review required</p>
                  </div>
                </div>
              </div>
            )}
            {worsening > 0 && (
              <div className="card p-4 border-l-4 border-l-amber-500 bg-amber-50/30">
                <div className="flex items-start gap-3">
                  <TrendingUp className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold text-amber-800 text-sm">
                      {worsening} patient{worsening > 1 ? "s" : ""} showing worsening scores
                    </p>
                    <p className="text-amber-600 text-xs mt-0.5">Treatment plan review recommended</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Summary Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: "Total Assessments", value: loading ? "—" : assessments.length, icon: ClipboardList, color: "text-blue-600 bg-blue-50" },
            { label: "Pending", value: loading ? "—" : pending, icon: Clock, color: "text-amber-600 bg-amber-50" },
            { label: "Risk Flagged", value: loading ? "—" : flagged, icon: AlertCircle, color: "text-red-600 bg-red-50" },
            { label: "Worsening Trend", value: loading ? "—" : worsening, icon: TrendingUp, color: "text-orange-600 bg-orange-50" },
          ].map((s) => (
            <div key={s.label} className="card p-4 flex items-center gap-3">
              <div className={cn("w-9 h-9 rounded-lg flex items-center justify-center", s.color)}>
                <s.icon className="w-4 h-4" />
              </div>
              <div>
                <div className="text-xl font-bold text-ink-900">{s.value}</div>
                <div className="text-xs text-ink-500">{s.label}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Filters */}
        <div className="card p-4 flex items-center gap-3">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-400" />
            <input
              type="text"
              placeholder="Search assessments..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="input-field pl-9 w-full"
            />
          </div>
          <div className="flex items-center gap-2">
            {["all", "pending", "completed"].map((s) => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={cn("px-3 py-1.5 rounded-lg text-xs font-medium transition-colors",
                  statusFilter === s ? "bg-primary-600 text-white" : "bg-surface-tertiary text-ink-600 hover:bg-surface-quaternary"
                )}
              >
                {s.charAt(0).toUpperCase() + s.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {/* Assessments Table */}
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-surface-tertiary bg-surface-secondary">
                  <th className="text-left px-5 py-3 text-xs font-semibold text-ink-500 uppercase tracking-wider">Patient</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-ink-500 uppercase tracking-wider">Assessment</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-ink-500 uppercase tracking-wider">Score</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-ink-500 uppercase tracking-wider">Severity</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-ink-500 uppercase tracking-wider">Trend</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-ink-500 uppercase tracking-wider">Date</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-ink-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-tertiary">
                {loading && Array.from({ length: 5 }).map((_, i) => <SkeletonRow key={i} />)}
                {!loading && filtered.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-5 py-12 text-center">
                      <Brain className="w-10 h-10 text-ink-300 mx-auto mb-2" />
                      <p className="text-ink-500 text-sm">No assessments found</p>
                    </td>
                  </tr>
                )}
                {!loading && filtered.map((a) => {
                  const range = SCORE_RANGES[a.template_code] || { max: 27, label: "/27" };
                  return (
                    <tr
                      key={a.id}
                      className={cn("hover:bg-surface-secondary/50 transition-colors", a.risk_flag && "bg-red-50/20")}
                    >
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary-100 to-primary-200 flex items-center justify-center">
                            <span className="text-xs font-bold text-primary-700">{getInitials(a.patient_name)}</span>
                          </div>
                          <span className="font-medium text-sm text-ink-900">{a.patient_name}</span>
                          {a.risk_flag && <AlertCircle className="w-3.5 h-3.5 text-red-500" />}
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        <div>
                          <span className="font-semibold text-sm text-ink-900">{a.template_code}</span>
                          <p className="text-xs text-ink-500">{a.template_name}</p>
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        {a.total_score !== null ? (
                          <div className="flex items-center gap-2">
                            <span className="text-lg font-bold text-ink-900">{a.total_score}</span>
                            <span className="text-xs text-ink-400">{range.label}</span>
                            <div className="w-16 h-1.5 bg-surface-tertiary rounded-full overflow-hidden">
                              <div
                                className={cn("h-full rounded-full", a.risk_flag ? "bg-red-500" : a.trend === "improving" ? "bg-green-500" : "bg-amber-500")}
                                style={{ width: `${(a.total_score / range.max) * 100}%` }}
                              />
                            </div>
                          </div>
                        ) : (
                          <span className="text-ink-400 text-sm">Pending</span>
                        )}
                      </td>
                      <td className="px-5 py-4">
                        {a.severity_label ? (
                          <span className={cn("px-2 py-1 rounded-full text-xs font-medium border",
                            SEVERITY_COLORS[a.severity_label] || "text-ink-600 bg-surface-tertiary border-surface-quaternary"
                          )}>
                            {a.severity_label.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase())}
                          </span>
                        ) : (
                          <span className="text-xs text-amber-600 bg-amber-50 border border-amber-200 px-2 py-1 rounded-full">
                            Pending
                          </span>
                        )}
                      </td>
                      <td className="px-5 py-4">
                        <TrendBadge trend={a.trend} />
                        {a.previous_score !== null && a.total_score !== null && (
                          <span className="text-xs text-ink-400 mt-0.5 block">was {a.previous_score}</span>
                        )}
                      </td>
                      <td className="px-5 py-4 text-sm text-ink-500">
                        {a.administered_at ? formatDate(a.administered_at) : "—"}
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-2">
                          <Link
                            href={`/patients/${a.patient_id}/assessments`}
                            className="p-1.5 hover:bg-surface-tertiary rounded-lg transition-colors"
                            title="View trends"
                          >
                            <BarChart3 className="w-4 h-4 text-ink-400" />
                          </Link>
                          {a.status === "pending" && (
                            <button
                              onClick={() => handleSendReminder(a)}
                              disabled={sendingId === a.id}
                              className="p-1.5 hover:bg-primary-50 rounded-lg transition-colors disabled:opacity-50"
                              title="Send to patient"
                            >
                              {sendingId === a.id
                                ? <Loader2 className="w-4 h-4 text-primary-600 animate-spin" />
                                : <Send className="w-4 h-4 text-primary-600" />}
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Assessment Templates */}
        <div>
          <h2 className="text-lg font-semibold text-ink-900 mb-4">Available Assessments</h2>
          {templatesLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="card p-4 animate-pulse">
                  <div className="h-4 w-16 bg-surface-tertiary rounded mb-2" />
                  <div className="h-3 w-32 bg-surface-tertiary rounded mb-1" />
                  <div className="h-3 w-full bg-surface-tertiary rounded" />
                </div>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {templates.map((t) => (
                <div key={t.id} className="card p-4 hover:shadow-card-hover transition-all">
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="font-semibold text-ink-900">{t.code}</h3>
                      <p className="text-sm text-ink-600">{t.name}</p>
                      <p className="text-xs text-ink-400 mt-1">{t.description}</p>
                      <div className="flex items-center gap-3 mt-2 text-xs text-ink-400">
                        {t.questions > 0 && <span>{t.questions} questions</span>}
                        {t.duration > 0 && <span>~{t.duration} min</span>}
                      </div>
                    </div>
                    <button className="btn-secondary text-xs py-1 px-2.5 flex items-center gap-1">
                      <Plus className="w-3 h-3" />
                      Assign
                    </button>
                  </div>
                </div>
              ))}
              {templates.length === 0 && (
                <div className="card p-6 text-center col-span-3">
                  <p className="text-ink-400 text-sm">No assessment templates available</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Reviewed: 2026-06-13 — 24Therapy audit
