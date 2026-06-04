"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ClipboardList, Plus, Search, TrendingUp, TrendingDown, Minus,
  AlertCircle, CheckCircle2, Clock, User, Calendar, BarChart3,
  ChevronRight, Activity, Brain, Send, Eye, Filter
} from "lucide-react";
import { cn, formatDate, getInitials } from "@/lib/utils";

const MOCK_ASSESSMENTS = [
  {
    id: "a1", patient_id: "p1", patient_name: "Sarah Chen",
    template_code: "PHQ9", template_name: "PHQ-9",
    status: "completed", total_score: 13, severity_label: "moderate",
    administered_at: "2025-12-15T10:00:00Z",
    previous_score: 17, trend: "improving",
    risk_flag: false,
  },
  {
    id: "a2", patient_id: "p1", patient_name: "Sarah Chen",
    template_code: "GAD7", template_name: "GAD-7",
    status: "completed", total_score: 8, severity_label: "mild",
    administered_at: "2025-12-15T10:05:00Z",
    previous_score: 10, trend: "improving",
    risk_flag: false,
  },
  {
    id: "a3", patient_id: "p3", patient_name: "James Rodriguez",
    template_code: "PHQ9", template_name: "PHQ-9",
    status: "completed", total_score: 19, severity_label: "moderately_severe",
    administered_at: "2025-12-14T14:00:00Z",
    previous_score: 15, trend: "worsening",
    risk_flag: true,
  },
  {
    id: "a4", patient_id: "p3", patient_name: "James Rodriguez",
    template_code: "C-SSRS", template_name: "C-SSRS",
    status: "completed", total_score: 2, severity_label: "active_ideation",
    administered_at: "2025-12-14T14:10:00Z",
    previous_score: 0, trend: "worsening",
    risk_flag: true,
  },
  {
    id: "a5", patient_id: "p2", patient_name: "Michael Torres",
    template_code: "GAD7", template_name: "GAD-7",
    status: "completed", total_score: 11, severity_label: "moderate",
    administered_at: "2025-12-10T11:00:00Z",
    previous_score: 9, trend: "worsening",
    risk_flag: false,
  },
  {
    id: "a6", patient_id: "p5", patient_name: "Olivia Kim",
    template_code: "PHQ9", template_name: "PHQ-9",
    status: "pending", total_score: null, severity_label: null,
    administered_at: null,
    previous_score: 4, trend: null,
    risk_flag: false,
  },
];

const TEMPLATES = [
  { id: "phq9", code: "PHQ9", name: "PHQ-9", description: "Depression screening", duration: 5, questions: 9 },
  { id: "gad7", code: "GAD7", name: "GAD-7", description: "Anxiety screening", duration: 3, questions: 7 },
  { id: "pcl5", code: "PCL5", name: "PCL-5", description: "PTSD checklist", duration: 10, questions: 20 },
  { id: "cssrs", code: "C-SSRS", name: "C-SSRS", description: "Suicide severity", duration: 15, questions: 6 },
  { id: "dass21", code: "DASS21", name: "DASS-21", description: "Depression, anxiety, stress", duration: 10, questions: 21 },
];

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
  if (trend === "improving") return (
    <span className="flex items-center gap-1 text-xs text-green-600 font-medium">
      <TrendingDown className="w-3 h-3" /> Improving
    </span>
  );
  if (trend === "worsening") return (
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

export default function AssessmentsPage() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [showNew, setShowNew] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState("");
  const [selectedPatient, setSelectedPatient] = useState("");

  const filtered = MOCK_ASSESSMENTS.filter((a) => {
    const matchSearch = !search || a.patient_name.toLowerCase().includes(search.toLowerCase()) || a.template_code.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === "all" || a.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const pending = MOCK_ASSESSMENTS.filter((a) => a.status === "pending").length;
  const flagged = MOCK_ASSESSMENTS.filter((a) => a.risk_flag).length;
  const worsening = MOCK_ASSESSMENTS.filter((a) => a.trend === "worsening").length;

  return (
    <div className="flex-1 overflow-y-auto bg-surface-secondary">
      <div className="max-w-6xl mx-auto p-6 space-y-6">

        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-ink-900">Assessments</h1>
            <p className="text-ink-500 text-sm mt-1">Track patient outcomes with standardized measures</p>
          </div>
          <button
            onClick={() => setShowNew(true)}
            className="btn-primary flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            New Assessment
          </button>
        </div>

        {/* Alert Cards */}
        {(flagged > 0 || worsening > 0) && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {flagged > 0 && (
              <div className="card p-4 border-l-4 border-l-red-500 bg-red-50/30">
                <div className="flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold text-red-800 text-sm">{flagged} assessment{flagged > 1 ? "s" : ""} with risk flags</p>
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
                    <p className="font-semibold text-amber-800 text-sm">{worsening} patient{worsening > 1 ? "s" : ""} showing worsening scores</p>
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
            { label: "Total Assessments", value: MOCK_ASSESSMENTS.length, icon: ClipboardList, color: "text-blue-600 bg-blue-50" },
            { label: "Pending", value: pending, icon: Clock, color: "text-amber-600 bg-amber-50" },
            { label: "Risk Flagged", value: flagged, icon: AlertCircle, color: "text-red-600 bg-red-50" },
            { label: "Worsening Trend", value: worsening, icon: TrendingUp, color: "text-orange-600 bg-orange-50" },
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
                {filtered.map((a) => {
                  const range = SCORE_RANGES[a.template_code] || { max: 27, label: "/27" };
                  return (
                    <tr key={a.id} className={cn("hover:bg-surface-secondary/50 transition-colors", a.risk_flag && "bg-red-50/20")}>
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
                          <span className={cn("px-2 py-1 rounded-full text-xs font-medium border", SEVERITY_COLORS[a.severity_label] || "text-ink-600 bg-surface-tertiary border-surface-quaternary")}>
                            {a.severity_label.replace(/_/g, " ").replace(/\b\w/g, l => l.toUpperCase())}
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
                          <span className="text-xs text-ink-400 mt-0.5 block">
                            was {a.previous_score}
                          </span>
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
                            <button className="p-1.5 hover:bg-primary-50 rounded-lg transition-colors" title="Send to patient">
                              <Send className="w-4 h-4 text-primary-600" />
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
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {TEMPLATES.map((t) => (
              <div key={t.id} className="card p-4 hover:shadow-card-hover transition-all">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-semibold text-ink-900">{t.code}</h3>
                    <p className="text-sm text-ink-600">{t.name}</p>
                    <p className="text-xs text-ink-400 mt-1">{t.description}</p>
                    <div className="flex items-center gap-3 mt-2 text-xs text-ink-400">
                      <span>{t.questions} questions</span>
                      <span>~{t.duration} min</span>
                    </div>
                  </div>
                  <button className="btn-secondary text-xs py-1 px-2.5 flex items-center gap-1">
                    <Plus className="w-3 h-3" />
                    Assign
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
