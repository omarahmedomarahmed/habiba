"use client";

import { useState } from "react";
import {
  FileText, Download, Plus, Search, Calendar, BarChart3,
  Brain, User, TrendingUp, TrendingDown, Shield, Activity,
  Sparkles, CheckCircle2, Clock, Filter, ChevronRight,
  Printer, Send, Eye, AlertTriangle, Target, Pill,
  BarChart2, LineChart, PieChart, Layers, ClipboardList,
  Building2, Star, ArrowRight, Loader2, ExternalLink
} from "lucide-react";
import { cn, getInitials, formatDate } from "@/lib/utils";

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

const MOCK_REPORTS: Report[] = [
  {
    id: "r001",
    patient_id: "p1",
    patient_name: "Sarah Chen",
    type: "progress_summary",
    status: "signed",
    title: "6-Month Progress Summary — Sarah Chen",
    created_at: "2025-12-01",
    signed_at: "2025-12-02",
    period_start: "2025-06-01",
    period_end: "2025-12-01",
    ai_generated: true,
    pages: 4,
  },
  {
    id: "r002",
    patient_id: "p2",
    patient_name: "Marcus Webb",
    type: "insurance_justification",
    status: "sent",
    title: "Medical Necessity — Aetna Authorization Request",
    created_at: "2025-11-28",
    signed_at: "2025-11-28",
    sent_to: "Aetna Insurance",
    ai_generated: true,
    pages: 3,
  },
  {
    id: "r003",
    patient_id: "p3",
    patient_name: "Priya Nair",
    type: "treatment_plan_review",
    status: "generated",
    title: "Annual Treatment Plan Review — Q4 2025",
    created_at: "2025-12-05",
    period_start: "2025-01-01",
    period_end: "2025-12-31",
    ai_generated: true,
    pages: 6,
  },
  {
    id: "r004",
    patient_id: "p4",
    patient_name: "James Rodriguez",
    type: "assessment_report",
    status: "draft",
    title: "PCL-5 & GAD-7 Longitudinal Assessment Report",
    created_at: "2025-12-08",
    ai_generated: true,
    pages: 2,
  },
  {
    id: "r005",
    type: "population_analytics",
    status: "generated",
    title: "Practice Clinical Outcomes — Q4 2025",
    created_at: "2025-12-01",
    period_start: "2025-10-01",
    period_end: "2025-12-01",
    ai_generated: true,
    pages: 8,
  },
  {
    id: "r006",
    patient_id: "p3",
    patient_name: "Priya Nair",
    type: "discharge_summary",
    status: "draft",
    title: "Discharge Summary — Eating Disorder IOP",
    created_at: "2025-12-09",
    ai_generated: false,
    pages: 3,
  },
];

const REPORT_TYPE_CONFIG: Record<ReportType, { label: string; description: string; icon: React.ElementType; color: string; bg: string }> = {
  progress_summary: {
    label: "Progress Summary",
    description: "Longitudinal treatment progress and outcomes",
    icon: TrendingUp,
    color: "text-emerald-700",
    bg: "bg-emerald-50",
  },
  assessment_report: {
    label: "Assessment Report",
    description: "Standardized assessment scores and trends",
    icon: BarChart3,
    color: "text-blue-700",
    bg: "bg-blue-50",
  },
  treatment_plan_review: {
    label: "Treatment Plan Review",
    description: "Goal attainment and plan effectiveness",
    icon: Target,
    color: "text-indigo-700",
    bg: "bg-indigo-50",
  },
  discharge_summary: {
    label: "Discharge Summary",
    description: "End-of-treatment summary and recommendations",
    icon: ClipboardList,
    color: "text-gray-700",
    bg: "bg-gray-50",
  },
  insurance_justification: {
    label: "Insurance Justification",
    description: "Medical necessity and authorization support",
    icon: Shield,
    color: "text-amber-700",
    bg: "bg-amber-50",
  },
  court_legal: {
    label: "Court / Legal Report",
    description: "Clinical report for legal proceedings",
    icon: Building2,
    color: "text-red-700",
    bg: "bg-red-50",
  },
  supervision_summary: {
    label: "Supervision Summary",
    description: "Clinical supervision overview",
    icon: User,
    color: "text-purple-700",
    bg: "bg-purple-50",
  },
  population_analytics: {
    label: "Population Analytics",
    description: "Practice-wide outcomes and statistics",
    icon: PieChart,
    color: "text-cyan-700",
    bg: "bg-cyan-50",
  },
  roi_report: {
    label: "ROI / Business Report",
    description: "Practice performance and revenue analytics",
    icon: BarChart2,
    color: "text-green-700",
    bg: "bg-green-50",
  },
  clinical_outcomes: {
    label: "Clinical Outcomes",
    description: "Evidence-based treatment effectiveness data",
    icon: LineChart,
    color: "text-blue-700",
    bg: "bg-blue-50",
  },
};

const STATUS_CONFIG: Record<ReportStatus, { label: string; color: string; bg: string }> = {
  draft: { label: "Draft", color: "text-gray-600", bg: "bg-gray-100" },
  generated: { label: "Generated", color: "text-blue-700", bg: "bg-blue-100" },
  signed: { label: "Signed", color: "text-emerald-700", bg: "bg-emerald-100" },
  sent: { label: "Sent", color: "text-indigo-700", bg: "bg-indigo-100" },
};

// Mock generated report content
const SAMPLE_PROGRESS_REPORT = `PROGRESS SUMMARY REPORT

Patient: Sarah Chen | DOB: March 12, 1990
Therapist: Dr. [Your Name], [Credentials]
Period: June 1, 2025 — December 1, 2025 (6 months)
Sessions Completed: 24 | Frequency: Weekly

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

PRESENTING CONCERNS & DIAGNOSES
• Major Depressive Disorder, Moderate (F32.1)
• Generalized Anxiety Disorder (F41.1)

TREATMENT MODALITY: Cognitive Behavioral Therapy (CBT)
MEDICATIONS: Escitalopram (Lexapro) 10mg QD (Prescriber: Dr. Jennifer Walsh)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

OUTCOME MEASURES

PHQ-9 (Depression):
  Start (Jun 2025): 17 (Moderately Severe)
  Current (Dec 2025): 13 (Moderate)
  Change: -4 points (-23.5%) ↓ Improving

GAD-7 (Anxiety):
  Start (Jun 2025): 14 (Moderate-Severe)
  Current (Dec 2025): 8 (Mild-Moderate)
  Change: -6 points (-42.9%) ↓ Significant Improvement

WHODAS 2.0 (Functional Impairment):
  Start (Jun 2025): 46 (Significant)
  Current (Nov 2025): 32 (Moderate)
  Change: -14 points ↓ Improving

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

TREATMENT GOALS: STATUS SUMMARY

✓ COMPLETED: Develop evidence-based coping toolkit (3+ strategies)
  Patient has mastered breathing techniques, cognitive reframing, and grounding exercises. Successfully applied in real-world situations (work review 11/2025).

◐ IN PROGRESS: Reduce PHQ-9 to < 9 (65% progress)
  Significant trajectory. Currently 13; trajectory consistent with achieving goal by Q2 2026 at current rate.

◐ IN PROGRESS: Improve sleep quality to 7+ hrs/night (40% progress)
  Melatonin added. Sleep diary shows improvement from 5.8 to 6.4 hours average. Additional interventions planned.

○ NOT STARTED: Resume social activities (2x/week)
  Planned for introduction in upcoming sessions following stabilization of primary symptoms.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

CLINICAL PROGRESS NARRATIVE

Ms. Chen has demonstrated meaningful clinical improvement over the 6-month treatment period. The primary areas of growth include:

1. Anxiety Management: Most notable gains. Patient successfully employs learned coping strategies in high-stress contexts (evidenced during work performance review). GAD-7 reduction of 43% represents clinically significant improvement.

2. Cognitive Flexibility: Patient now independently identifies cognitive distortions (perfectionism, all-or-nothing thinking) during sessions without prompting — a key CBT skill acquisition milestone reached at Session #21.

3. Insight: High psychological insight into the relationship between early attachment experiences and current relational/performance patterns. This insight forms a strong therapeutic foundation for continued schema work.

4. Areas Requiring Continued Focus: Core perfectionism schema remains primary treatment target. Sleep difficulties persist. Grief processing (friend loss October 2025) newly added to treatment scope.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

RISK ASSESSMENT: LOW-MODERATE

No current suicidal ideation, intent, or plan. No self-harm. No homicidal ideation. 
Active risk factors: Perfectionism, occupational stress, seasonal affective pattern (Nov-Jan).
Protective factors: Strong therapeutic alliance, engaged in treatment, support from sister (Lisa Chen).

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

RECOMMENDATION & PLAN

Continue weekly CBT. Adjust focus to:
1. Schema-focused work on perfectionism and performance-worth equation
2. Sleep hygiene intensive module
3. Grief processing (recent loss, October 2025)
4. Introduce behavioral activation for social re-engagement
5. Coordinate with Dr. Walsh re: seasonal medication adjustment

Estimated additional treatment: 16-20 sessions (target termination Q3-Q4 2026)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Electronically signed: [Your Name], [Credentials]
License #: [License]
Date: December 2, 2025`;

export default function ReportsPage() {
  const [activeFilter, setActiveFilter] = useState<"all" | ReportType>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [showGenerateModal, setShowGenerateModal] = useState(false);
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [selectedReport, setSelectedReport] = useState<Report | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatingStep, setGeneratingStep] = useState(0);
  const [reportConfig, setReportConfig] = useState({
    type: "progress_summary" as ReportType,
    patient: "p1",
    period: "6_months",
    include_assessments: true,
    include_goals: true,
    include_narrative: true,
    include_risk: true,
    include_medications: true,
    format: "pdf" as "pdf" | "docx",
  });

  const GENERATION_STEPS = [
    "Retrieving patient clinical history...",
    "Analyzing outcome measures and trends...",
    "Synthesizing session notes and progress data...",
    "Generating clinical narrative...",
    "Formatting report document...",
  ];

  const filteredReports = MOCK_REPORTS.filter((r) => {
    const matchesFilter = activeFilter === "all" || r.type === activeFilter;
    const matchesSearch = !searchQuery ||
      r.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.patient_name?.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  const generateReport = async () => {
    setIsGenerating(true);
    for (let i = 0; i < GENERATION_STEPS.length; i++) {
      setGeneratingStep(i);
      await new Promise(r => setTimeout(r, 800));
    }
    setIsGenerating(false);
    setShowGenerateModal(false);
    setShowPreviewModal(true);
    setSelectedReport(MOCK_REPORTS[0]);
  };

  const stats = {
    total: MOCK_REPORTS.length,
    generated: MOCK_REPORTS.filter(r => r.status !== "draft").length,
    signed: MOCK_REPORTS.filter(r => ["signed", "sent"].includes(r.status)).length,
    patients: new Set(MOCK_REPORTS.filter(r => r.patient_id).map(r => r.patient_id)).size,
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

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: "Total Reports", value: stats.total, icon: FileText, color: "text-gray-700" },
          { label: "Generated", value: stats.generated, icon: Sparkles, color: "text-blue-700" },
          { label: "Signed", value: stats.signed, icon: CheckCircle2, color: "text-emerald-700" },
          { label: "Patients Covered", value: stats.patients, icon: User, color: "text-indigo-700" },
        ].map((stat) => {
          const Icon = stat.icon;
          return (
            <div key={stat.label} className="bg-white rounded-2xl border border-gray-200 p-4 flex items-center gap-3">
              <div className="w-10 h-10 bg-gray-100 rounded-xl flex items-center justify-center">
                <Icon className={cn("h-5 w-5", stat.color)} />
              </div>
              <div>
                <div className="text-2xl font-bold text-gray-900">{stat.value}</div>
                <div className="text-xs text-gray-500">{stat.label}</div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-3 gap-6">
        {/* Report type selector */}
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
                <span className="ml-auto text-xs opacity-70">{MOCK_REPORTS.length}</span>
              </button>
              {Object.entries(REPORT_TYPE_CONFIG).map(([type, config]) => {
                const count = MOCK_REPORTS.filter(r => r.type === type).length;
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

          {/* AI capability box */}
          <div className="bg-gradient-to-br from-[#0A2342] to-[#1a3a6b] rounded-2xl p-4 text-white">
            <div className="flex items-center gap-2 mb-3">
              <Sparkles className="h-4 w-4 text-yellow-400" />
              <span className="text-sm font-semibold">AI Report Intelligence</span>
            </div>
            <ul className="space-y-2">
              {[
                "Pulls from all session notes",
                "Synthesizes assessment trends",
                "Generates clinical narratives",
                "Auto-populates legal/insurance formats",
                "One-click signing + sending",
              ].map((f) => (
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
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search reports..."
              className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#0A2342]/20"
            />
          </div>

          {filteredReports.map((report) => {
            const typeConf = REPORT_TYPE_CONFIG[report.type];
            const statusConf = STATUS_CONFIG[report.status];
            const Icon = typeConf.icon;

            return (
              <div
                key={report.id}
                className="bg-white rounded-2xl border border-gray-200 p-5 hover:shadow-sm transition-all cursor-pointer"
                onClick={() => { setSelectedReport(report); setShowPreviewModal(true); }}
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

      {/* Generate Report Modal */}
      {showGenerateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-xl w-full overflow-hidden">
            <div className="bg-gradient-to-r from-[#0A2342] to-[#1a3a6b] p-6 text-white">
              <div className="flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <Sparkles className="h-5 w-5 text-yellow-400" />
                    <h2 className="text-lg font-bold">Generate AI Report</h2>
                  </div>
                  <p className="text-white/70 text-sm">AI will synthesize clinical data into a complete report</p>
                </div>
                <button onClick={() => setShowGenerateModal(false)} className="text-white/70 hover:text-white">✕</button>
              </div>
            </div>

            {isGenerating ? (
              <div className="p-8 text-center">
                <div className="w-16 h-16 bg-indigo-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Brain className="h-8 w-8 text-indigo-600 animate-pulse" />
                </div>
                <h3 className="font-semibold text-gray-900 mb-2">Generating Report...</h3>
                <div className="space-y-2 mb-6">
                  {GENERATION_STEPS.map((step, i) => (
                    <div
                      key={i}
                      className={cn(
                        "flex items-center gap-2 text-sm transition-all",
                        i < generatingStep ? "text-emerald-600" :
                        i === generatingStep ? "text-blue-600 font-medium" : "text-gray-300"
                      )}
                    >
                      {i < generatingStep ? (
                        <CheckCircle2 className="h-4 w-4 shrink-0" />
                      ) : i === generatingStep ? (
                        <Loader2 className="h-4 w-4 shrink-0 animate-spin" />
                      ) : (
                        <div className="w-4 h-4 rounded-full border border-gray-200 shrink-0" />
                      )}
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
                    <label className="text-sm font-medium text-gray-700 mb-1 block">Patient</label>
                    <select className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none">
                      <option>Sarah Chen</option>
                      <option>Marcus Webb</option>
                      <option>Priya Nair</option>
                      <option>James Rodriguez</option>
                      <option>— Practice-wide —</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="text-sm font-medium text-gray-700 mb-1 block">Reporting Period</label>
                  <div className="grid grid-cols-3 gap-2">
                    {["3_months", "6_months", "12_months", "ytd", "custom", "all_time"].map((p) => (
                      <button
                        key={p}
                        onClick={() => setReportConfig({ ...reportConfig, period: p })}
                        className={cn(
                          "py-2 rounded-xl border text-xs font-medium transition-all",
                          reportConfig.period === p ? "border-[#0A2342] bg-[#0A2342] text-white" : "border-gray-200 text-gray-600 hover:border-gray-300"
                        )}
                      >
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
                      <button
                        key={fmt}
                        onClick={() => setReportConfig({ ...reportConfig, format: fmt })}
                        className={cn(
                          "flex-1 py-2 rounded-xl border text-sm font-medium uppercase transition-all",
                          reportConfig.format === fmt ? "border-[#0A2342] bg-[#0A2342] text-white" : "border-gray-200 text-gray-600"
                        )}
                      >
                        {fmt}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex gap-3">
                  <button onClick={() => setShowGenerateModal(false)} className="flex-1 py-2.5 border border-gray-200 text-gray-600 rounded-xl text-sm">Cancel</button>
                  <button
                    onClick={generateReport}
                    className="flex-1 py-2.5 bg-[#0A2342] text-white rounded-xl text-sm font-medium flex items-center justify-center gap-2"
                  >
                    <Sparkles className="h-4 w-4" />
                    Generate Report
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
                  <span className={cn("text-xs font-medium px-2 py-0.5 rounded-full", STATUS_CONFIG[selectedReport.status].bg, STATUS_CONFIG[selectedReport.status].color)}>
                    {STATUS_CONFIG[selectedReport.status].label}
                  </span>
                </div>
              </div>
              <button onClick={() => setShowPreviewModal(false)} className="text-gray-400 hover:text-gray-600">✕</button>
            </div>

            <div className="p-6">
              <div className="bg-gray-50 rounded-xl p-6 border border-gray-200 font-mono text-xs text-gray-700 whitespace-pre-wrap leading-relaxed mb-6 max-h-96 overflow-y-auto">
                {SAMPLE_PROGRESS_REPORT}
              </div>
              <div className="flex gap-3">
                <button onClick={() => setShowPreviewModal(false)} className="px-4 py-2.5 border border-gray-200 text-gray-600 rounded-xl text-sm">Close</button>
                <button className="flex items-center gap-2 px-4 py-2.5 border border-gray-200 text-gray-600 rounded-xl text-sm hover:bg-gray-50">
                  <Printer className="h-3.5 w-3.5" /> Print
                </button>
                <button className="flex items-center gap-2 px-4 py-2.5 border border-gray-200 text-gray-600 rounded-xl text-sm hover:bg-gray-50">
                  <Download className="h-3.5 w-3.5" /> Download PDF
                </button>
                <button className="flex items-center gap-2 px-4 py-2.5 border border-emerald-200 bg-emerald-50 text-emerald-700 rounded-xl text-sm font-medium hover:bg-emerald-100">
                  <CheckCircle2 className="h-4 w-4" /> Sign Report
                </button>
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
