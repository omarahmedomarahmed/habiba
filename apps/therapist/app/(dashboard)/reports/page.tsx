"use client";

import { useState, useEffect, useCallback } from "react";
import {
  FileText, Download, Sparkles, CheckCircle2,
  Search, Calendar, BarChart3, Brain, User, TrendingUp,
  Shield, Send, Eye, AlertTriangle, Target,
  BarChart2, Layers, ClipboardList,
  Building2, Star, Loader2, Printer
} from "lucide-react";
import { cn, formatDate } from "@/lib/utils";
import { reportsAPI, APIError } from "@/lib/api";

type ReportType =
  | "progress_summary"
  | "assessment_report"
  | "treatment_plan_review"
  | "discharge_summary"
  | "insurance_justification"
  | "court_legal"
  | "supervision_summary"
  | "population_analytics"
  | "roi_report"
  | "clinical_outcomes";

type ReportStatus = "draft" | "generated" | "signed" | "sent";

interface Report {
  id: string;
  patient_id?: string;
  patient_name?: string;
  type: ReportType;
  status: ReportStatus;
  title: string;
  created_at: string;
  signed_at?: string;
  sent_to?: string;
  period_start?: string;
  period_end?: string;
  ai_generated: boolean;
  pages?: number;
}

const REPORT_TYPE_CONFIG: Record<ReportType, {
  label: string; description: string; icon: React.ElementType; color: string; bg: string;
}> = {
  progress_summary: { label: "Progress Summary", description: "Treatment progress & outcomes", icon: TrendingUp, color: "text-blue-700", bg: "bg-blue-50" },
  assessment_report: { label: "Assessment Report", description: "Standardized measure analysis", icon: BarChart2, color: "text-purple-700", bg: "bg-purple-50" },
  treatment_plan_review: { label: "Treatment Plan Review", description: "Care plan review & update", icon: Target, color: "text-emerald-700", bg: "bg-emerald-50" },
  discharge_summary: { label: "Discharge Summary", description: "End-of-care documentation", icon: FileText, color: "text-slate-700", bg: "bg-slate-50" },
  insurance_justification: { label: "Insurance Justification", description: "Medical necessity & auth", icon: Shield, color: "text-amber-700", bg: "bg-amber-50" },
  court_legal: { label: "Court / Legal Report", description: "Forensic documentation", icon: Building2, color: "text-red-700", bg: "bg-red-50" },
  supervision_summary: { label: "Supervision Summary", description: "Case consultation notes", icon: Brain, color: "text-indigo-700", bg: "bg-indigo-50" },
  population_analytics: { label: "Practice Analytics", description: "Population-level outcomes", icon: BarChart3, color: "text-cyan-700", bg: "bg-cyan-50" },
  roi_report: { label: "ROI Report", description: "Clinical return on investment", icon: Star, color: "text-yellow-700", bg: "bg-yellow-50" },
  clinical_outcomes: { label: "Clinical Outcomes", description: "Evidence-based outcome data", icon: ClipboardList, color: "text-rose-700", bg: "bg-rose-50" },
};

const STATUS_CONFIG: Record<ReportStatus, { label: string; color: string; bg: string }> = {
  draft: { label: "Draft", color: "text-gray-600", bg: "bg-gray-100" },
  generated: { label: "Generated", color: "text-blue-600", bg: "bg-blue-50" },
  signed: { label: "Signed", color: "text-emerald-600", bg: "bg-emerald-50" },
  sent: { label: "Sent", color: "text-purple-600", bg: "bg-purple-50" },
};

const GENERATION_STEPS = [
  "Pulling session notes...",
  "Synthesizing assessment data...",
  "Analyzing treatment progress...",
  "Generating clinical narrative...",
  "Formatting document...",
  "Finalizing report...",
];

function normalizeReport(raw: Record<string, unknown>): Report {
  const patient = (raw.patient as Record<string, unknown>) || {};
  const patientName =
    (raw.patient_name as string) ||
    (patient.first_name ? `${patient.first_name} ${patient.last_name || ""}`.trim() : undefined);

  const validStatuses: ReportStatus[] = ["draft", "generated", "signed", "sent"];
  const status = validStatuses.includes(raw.status as ReportStatus)
    ? (raw.status as ReportStatus) : "draft";

  const validTypes = Object.keys(REPORT_TYPE_CONFIG) as ReportType[];
  const type = validTypes.includes(raw.type as ReportType)
    ? (raw.type as ReportType) : "progress_summary";

  return {
    id: (raw.id as string) || "",
    patient_id: (raw.patient_id as string) || (patient.id as string),
    patient_name: patientName,
    type,
    status,
    title: (raw.title as string) || (raw.name as string) || "Clinical Report",
    created_at: (raw.created_at as string) || "",
    signed_at: (raw.signed_at as string) || undefined,
    sent_to: (raw.sent_to as string) || undefined,
    period_start: (raw.period_start as string) || undefined,
    period_end: (raw.period_end as string) || undefined,
    ai_generated: !!(raw.ai_generated ?? raw.is_ai_generated ?? true),
    pages: (raw.pages as number) || undefined,
  };
}

function SkeletonCard() {
  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-5 animate-pulse">
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-xl bg-gray-100 shrink-0" />
        <div className="flex-1 space-y-2">
          <div className="h-4 w-48 bg-gray-100 rounded" />
          <div className="h-3 w-32 bg-gray-100 rounded" />
        </div>
        <div className="h-6 w-20 bg-gray-100 rounded-xl" />
      </div>
    </div>
  );
}

export default function ReportsPage() {
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [searchQuery, setSearchQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState<ReportType | "all">("all");
  const [selectedReport, setSelectedReport] = useState<Report | null>(null);

  const [showGenerateModal, setShowGenerateModal] = useState(false);
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatingStep, setGeneratingStep] = useState(0);
  const [signingId, setSigningId] = useState<string | null>(null);

  const [reportConfig, setReportConfig] = useState({
    type: "progress_summary" as ReportType,
    period: "6_months",
    format: "pdf" as "pdf" | "docx",
    include_assessments: true,
    include_goals: true,
    include_narrative: true,
    include_risk: true,
    include_medications: false,
    patient: "",
  });

  const fetchReports = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params: Record<string, string | number | undefined> = {
        limit: 50,
        ...(searchQuery ? { search: searchQuery } : {}),
        ...(activeFilter !== "all" ? { type: activeFilter } : {}),
      };
      const result = await reportsAPI.list(params);
      const raw = Array.isArray(result)
        ? result
        : ((result as { data?: unknown[] }).data ?? []);
      setReports((raw as Record<string, unknown>[]).map(normalizeReport));
    } catch (err) {
      if (err instanceof APIError && err.status === 401) return;
      if (err instanceof APIError && (err.status === 404 || err.status === 405)) {
        setReports([]);
      } else {
        setError((err as Error).message || "Failed to load reports");
      }
    } finally {
      setLoading(false);
    }
  }, [searchQuery, activeFilter]);

  useEffect(() => {
    const t = setTimeout(fetchReports, searchQuery ? 400 : 0);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchQuery]);

  useEffect(() => {
    fetchReports();
  }, [fetchReports, activeFilter]);

  const generateReport = async () => {
    setIsGenerating(true);
    setGeneratingStep(0);
    try {
      for (let i = 0; i < GENERATION_STEPS.length - 1; i++) {
        setGeneratingStep(i);
        await new Promise((r) => setTimeout(r, 700));
      }
      const result = await reportsAPI.generate({
        type: reportConfig.type,
        period: reportConfig.period,
        format: reportConfig.format,
        include_assessments: reportConfig.include_assessments,
        include_goals: reportConfig.include_goals,
        include_narrative: reportConfig.include_narrative,
        include_risk: reportConfig.include_risk,
        include_medications: reportConfig.include_medications,
        ...(reportConfig.patient ? { patient: reportConfig.patient } : {}),
      });
      setGeneratingStep(GENERATION_STEPS.length - 1);
      await new Promise((r) => setTimeout(r, 500));
      const newReport = normalizeReport(result as Record<string, unknown>);
      setReports((prev) => [newReport, ...prev]);
      setSelectedReport(newReport);
      setShowGenerateModal(false);
      setShowPreviewModal(true);
    } catch (err) {
      if (err instanceof APIError && err.status === 401) { setShowGenerateModal(false); return; }
      setShowGenerateModal(false);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSign = async (reportId: string) => {
    setSigningId(reportId);
    try {
      await reportsAPI.sign(reportId);
      const patch = { status: "signed" as ReportStatus, signed_at: new Date().toISOString() };
      setReports((prev) => prev.map((r) => r.id === reportId ? { ...r, ...patch } : r));
      setSelectedReport((prev) => prev && prev.id === reportId ? { ...prev, ...patch } : prev);
    } catch { /* silently ignore */ }
    finally { setSigningId(null); }
  };

  const filteredReports = reports.filter((r) => {
    const matchSearch = !searchQuery ||
      r.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (r.patient_name && r.patient_name.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchSearch && (activeFilter === "all" || r.type === activeFilter);
  });

  const stats = {
    total: reports.length,
    generated: reports.filter((r) => r.status !== "draft").length,
    signed: reports.filter((r) => ["signed", "sent"].includes(r.status)).length,
    patients: new Set(reports.filter((r) => r.patient_id).map((r) => r.patient_id)).size,
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Reports</h1>
          <p className="text-sm text-gray-500 mt-1">Generate AI-powered clinical reports from patient data</p>
        </div>
        <button
          onClick={() => setShowGenerateModal(true)}
          className="flex items-center gap-2 px-4 py-2.5 bg-[#0A2342] text-white rounded-xl text-sm font-medium hover:bg-[#123A63] transition-colors"
        >
          <Sparkles className="h-4 w-4" />
          Generate Report
        </button>
      </div>

      {/* Error Banner */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-2xl p-4 flex items-center justify-between">
          <div className="flex items-center gap-2 text-red-700 text-sm">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            {error}
          </div>
          <button onClick={fetchReports} className="text-xs text-red-600 hover:underline font-medium">Retry</button>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: "Total Reports", value: loading ? "—" : stats.total, icon: FileText, color: "text-gray-700" },
          { label: "Generated", value: loading ? "—" : stats.generated, icon: Sparkles, color: "text-blue-700" },
          { label: "Signed", value: loading ? "—" : stats.signed, icon: CheckCircle2, color: "text-emerald-700" },
          { label: "Patients Covered", value: loading ? "—" : stats.patients, icon: User, color: "text-indigo-700" },
        ].map((s) => {
          const Icon = s.icon;
          return (
            <div key={s.label} className="bg-white rounded-2xl border border-gray-200 p-4 flex items-center gap-3">
              <div className="w-10 h-10 bg-gray-100 rounded-xl flex items-center justify-center">
                <Icon className={cn("h-5 w-5", s.color)} />
              </div>
              <div>
                <div className="text-2xl font-bold text-gray-900">{s.value}</div>
                <div className="text-xs text-gray-500">{s.label}</div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-3 gap-6">
        {/* Left sidebar: report type filter + AI info */}
        <div className="space-y-2">
          <div className="bg-white rounded-2xl border border-gray-200 p-4">
            <h3 className="font-semibold text-gray-900 text-sm mb-3">Report Types</h3>
            <div className="space-y-1">
              <button
                onClick={() => setActiveFilter("all")}
                className={cn(
                  "w-full flex items-center gap-2 px-3 py-2 rounded-xl text-sm transition-all",
                  activeFilter === "all" ? "bg-[#0A2342] text-white" : "text-gray-600 hover:bg-gray-50"
                )}
              >
                <Layers className="h-4 w-4" />
                <span>All Reports</span>
                <span className="ml-auto text-xs opacity-70">{reports.length}</span>
              </button>
              {Object.entries(REPORT_TYPE_CONFIG).map(([type, config]) => {
                const count = reports.filter((r) => r.type === type).length;
                const Icon = config.icon;
                return (
                  <button
                    key={type}
                    onClick={() => setActiveFilter(type as ReportType)}
                    className={cn(
                      "w-full flex items-center gap-2 px-3 py-2 rounded-xl text-sm transition-all",
                      activeFilter === type
                        ? `${config.bg} ${config.color} font-medium`
                        : "text-gray-600 hover:bg-gray-50"
                    )}
                  >
                    <Icon className="h-4 w-4" />
                    <span className="truncate">{config.label}</span>
                    {count > 0 && <span className="ml-auto text-xs opacity-60">{count}</span>}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="bg-gradient-to-br from-[#0A2342] to-[#1a3a6b] rounded-2xl p-4 text-white">
            <div className="flex items-center gap-2 mb-3">
              <Sparkles className="h-4 w-4 text-yellow-400" />
              <span className="text-sm font-semibold">AI Report Intelligence</span>
            </div>
            <ul className="space-y-2">
              {["Pulls from all session notes", "Synthesizes assessment trends", "Generates clinical narratives", "Auto-populates legal/insurance formats", "One-click signing + sending"].map((f) => (
                <li key={f} className="flex items-start gap-2 text-xs text-white/80">
                  <CheckCircle2 className="h-3 w-3 text-emerald-400 mt-0.5 shrink-0" />
                  {f}
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Report list */}
        <div className="col-span-2 space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search reports..."
              className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#0A2342]/20"
            />
          </div>

          {loading && Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} />)}

          {!loading && filteredReports.length === 0 && (
            <div className="bg-white rounded-2xl border border-gray-200 p-12 text-center">
              <FileText className="h-12 w-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500 font-medium">No reports found</p>
              <p className="text-gray-400 text-sm mt-1">
                {searchQuery || activeFilter !== "all" ? "Try adjusting your filters" : "Generate your first report to get started"}
              </p>
            </div>
          )}

          {!loading && filteredReports.map((report) => {
            const typeConf = REPORT_TYPE_CONFIG[report.type] ?? REPORT_TYPE_CONFIG.progress_summary;
            const statusConf = STATUS_CONFIG[report.status] ?? STATUS_CONFIG.draft;
            const Icon = typeConf.icon;
            return (
              <div
                key={report.id}
                onClick={() => { setSelectedReport(report); setShowPreviewModal(true); }}
                className="bg-white rounded-2xl border border-gray-200 p-5 hover:shadow-sm transition-all cursor-pointer"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3 flex-1 min-w-0">
                    <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center shrink-0", typeConf.bg)}>
                      <Icon className={cn("h-5 w-5", typeConf.color)} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-semibold text-gray-900 text-sm truncate">{report.title}</span>
                        {report.ai_generated && (
                          <span className="flex items-center gap-1 text-[10px] text-indigo-500 bg-indigo-50 px-1.5 py-0.5 rounded-full shrink-0">
                            <Sparkles className="h-2.5 w-2.5" /> AI
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-3">
                        {report.patient_name && (
                          <span className="text-xs text-gray-500 flex items-center gap-1">
                            <User className="h-3 w-3" /> {report.patient_name}
                          </span>
                        )}
                        <span className="text-xs text-gray-400">{formatDate(report.created_at)}</span>
                        {report.pages && <span className="text-xs text-gray-400">{report.pages} pages</span>}
                      </div>
                      {report.period_start && report.period_end && (
                        <p className="text-xs text-gray-400 mt-1">
                          Period: {formatDate(report.period_start)} — {formatDate(report.period_end)}
                        </p>
                      )}
                      {report.sent_to && (
                        <p className="text-xs text-gray-500 mt-1 flex items-center gap-1">
                          <Send className="h-3 w-3" /> Sent to: {report.sent_to}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-2 shrink-0">
                    <span className={cn("text-xs font-medium px-2.5 py-1 rounded-xl", statusConf.bg, statusConf.color)}>
                      {statusConf.label}
                    </span>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={(e) => { e.stopPropagation(); setSelectedReport(report); setShowPreviewModal(true); }}
                        className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                      >
                        <Eye className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={(e) => e.stopPropagation()}
                        className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                      >
                        <Download className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Generate Modal */}
      {showGenerateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-xl w-full overflow-hidden">
            <div className="bg-gradient-to-r from-[#0A2342] to-[#1a3a6b] p-6 text-white flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <Sparkles className="h-5 w-5 text-yellow-400" />
                  <h2 className="text-lg font-bold">Generate AI Report</h2>
                </div>
                <p className="text-white/70 text-sm">AI will synthesize clinical data into a complete report</p>
              </div>
              <button onClick={() => setShowGenerateModal(false)} className="text-white/70 hover:text-white">✕</button>
            </div>

            {isGenerating ? (
              <div className="p-8 text-center">
                <div className="w-16 h-16 bg-indigo-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Brain className="h-8 w-8 text-indigo-600 animate-pulse" />
                </div>
                <h3 className="font-semibold text-gray-900 mb-4">Generating Report...</h3>
                <div className="space-y-2 mb-6">
                  {GENERATION_STEPS.map((step, i) => (
                    <div key={i} className={cn("flex items-center gap-2 text-sm transition-all",
                      i < generatingStep ? "text-emerald-600" :
                      i === generatingStep ? "text-blue-600 font-medium" : "text-gray-300"
                    )}>
                      {i < generatingStep ? <CheckCircle2 className="h-4 w-4 shrink-0" /> :
                       i === generatingStep ? <Loader2 className="h-4 w-4 shrink-0 animate-spin" /> :
                       <div className="w-4 h-4 rounded-full border border-gray-200 shrink-0" />}
                      {step}
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="p-6 space-y-5">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium text-gray-700 mb-1 block">Report Type</label>
                    <select
                      value={reportConfig.type}
                      onChange={(e) => setReportConfig({ ...reportConfig, type: e.target.value as ReportType })}
                      className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none"
                    >
                      {Object.entries(REPORT_TYPE_CONFIG).map(([type, cfg]) => (
                        <option key={type} value={type}>{cfg.label}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-700 mb-1 block">Patient (optional)</label>
                    <input
                      type="text"
                      placeholder="All patients"
                      value={reportConfig.patient}
                      onChange={(e) => setReportConfig({ ...reportConfig, patient: e.target.value })}
                      className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-sm font-medium text-gray-700 mb-1 block">Reporting Period</label>
                  <div className="grid grid-cols-3 gap-2">
                    {(["3_months", "6_months", "12_months", "ytd", "custom", "all_time"] as const).map((p) => (
                      <button key={p} onClick={() => setReportConfig({ ...reportConfig, period: p })}
                        className={cn("py-2 rounded-xl border text-xs font-medium transition-all",
                          reportConfig.period === p ? "border-[#0A2342] bg-[#0A2342] text-white" : "border-gray-200 text-gray-600 hover:border-gray-300"
                        )}>
                        {p === "3_months" ? "3 Months" : p === "6_months" ? "6 Months" : p === "12_months" ? "12 Months" : p === "ytd" ? "YTD" : p === "custom" ? "Custom" : "All Time"}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="text-sm font-medium text-gray-700 mb-2 block">Include Sections</label>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { key: "include_assessments", label: "Assessment Scores" },
                      { key: "include_goals", label: "Goals & Progress" },
                      { key: "include_narrative", label: "Clinical Narrative" },
                      { key: "include_risk", label: "Risk Assessment" },
                      { key: "include_medications", label: "Medications" },
                    ].map((opt) => (
                      <label key={opt.key} className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={reportConfig[opt.key as keyof typeof reportConfig] as boolean}
                          onChange={(e) => setReportConfig({ ...reportConfig, [opt.key]: e.target.checked })}
                          className="w-4 h-4 text-[#0A2342] rounded"
                        />
                        <span className="text-sm text-gray-700">{opt.label}</span>
                      </label>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="text-sm font-medium text-gray-700 mb-1 block">Output Format</label>
                  <div className="flex gap-2">
                    {(["pdf", "docx"] as const).map((fmt) => (
                      <button key={fmt} onClick={() => setReportConfig({ ...reportConfig, format: fmt })}
                        className={cn("flex-1 py-2 rounded-xl border text-sm font-medium uppercase transition-all",
                          reportConfig.format === fmt ? "border-[#0A2342] bg-[#0A2342] text-white" : "border-gray-200 text-gray-600"
                        )}>
                        {fmt}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex gap-3">
                  <button onClick={() => setShowGenerateModal(false)} className="flex-1 py-2.5 border border-gray-200 text-gray-600 rounded-xl text-sm">Cancel</button>
                  <button onClick={generateReport} className="flex-1 py-2.5 bg-[#0A2342] text-white rounded-xl text-sm font-medium flex items-center justify-center gap-2">
                    <Sparkles className="h-4 w-4" /> Generate Report
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Preview Modal */}
      {showPreviewModal && selectedReport && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-4xl w-full overflow-hidden max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-5 border-b border-gray-200">
              <div>
                <h3 className="font-bold text-gray-900">{selectedReport.title}</h3>
                <div className="flex items-center gap-3 mt-1">
                  {selectedReport.patient_name && (
                    <span className="text-xs text-gray-500 flex items-center gap-1">
                      <User className="h-3 w-3" /> {selectedReport.patient_name}
                    </span>
                  )}
                  <span className="text-xs text-gray-400">Generated {formatDate(selectedReport.created_at)}</span>
                  <span className={cn("text-xs font-medium px-2 py-0.5 rounded-full",
                    STATUS_CONFIG[selectedReport.status]?.bg,
                    STATUS_CONFIG[selectedReport.status]?.color
                  )}>
                    {STATUS_CONFIG[selectedReport.status]?.label}
                  </span>
                </div>
              </div>
              <button onClick={() => setShowPreviewModal(false)} className="text-gray-400 hover:text-gray-600">✕</button>
            </div>

            <div className="p-6">
              <div className="bg-gray-50 rounded-xl border border-gray-200 p-12 text-center mb-6">
                <FileText className="h-12 w-12 text-gray-300 mx-auto mb-3" />
                <p className="font-medium text-gray-700">Report preview available once backend is live.</p>
                <p className="text-gray-400 text-xs mt-1">The AI will generate the full report document from patient data.</p>
              </div>
              <div className="flex gap-3 flex-wrap">
                <button onClick={() => setShowPreviewModal(false)} className="px-4 py-2.5 border border-gray-200 text-gray-600 rounded-xl text-sm">Close</button>
                <button className="flex items-center gap-2 px-4 py-2.5 border border-gray-200 text-gray-600 rounded-xl text-sm hover:bg-gray-50">
                  <Printer className="h-3.5 w-3.5" /> Print
                </button>
                <button className="flex items-center gap-2 px-4 py-2.5 border border-gray-200 text-gray-600 rounded-xl text-sm hover:bg-gray-50">
                  <Download className="h-3.5 w-3.5" /> Download PDF
                </button>
                {selectedReport.status === "generated" && (
                  <button
                    onClick={() => handleSign(selectedReport.id)}
                    disabled={signingId === selectedReport.id}
                    className="flex items-center gap-2 px-4 py-2.5 border border-emerald-200 bg-emerald-50 text-emerald-700 rounded-xl text-sm font-medium hover:bg-emerald-100 disabled:opacity-50"
                  >
                    {signingId === selectedReport.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                    Sign Report
                  </button>
                )}
                <button className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-[#0A2342] text-white rounded-xl text-sm font-medium hover:bg-[#123A63]">
                  <Send className="h-4 w-4" /> Send Report
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Reviewed: 2026-06-13 — 24Therapy audit
