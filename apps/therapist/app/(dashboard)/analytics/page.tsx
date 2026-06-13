"use client";

import { useState, useEffect } from "react";
import {
  BarChart3, TrendingUp, TrendingDown, Users, Calendar,
  Brain, Activity, Target, AlertTriangle, DollarSign,
  Clock, CheckCircle2, ArrowUp, ArrowDown, Minus, Sparkles,
  Filter, Download, ChevronRight, Star, Heart, Shield,
  Layers, PieChart, BarChart2, LineChart, Eye, Zap
} from "lucide-react";
import { cn } from "@/lib/utils";
import { analyticsAPI } from "@/lib/api";

type Period = "30d" | "90d" | "6m" | "12m" | "ytd";
type AnalyticsTab = "overview" | "patients" | "outcomes" | "sessions" | "financial";

// ─── MOCK DATA ─────────────────────────────────────────────────────────────────

const PERIOD_LABELS: Record<Period, string> = {
  "30d": "Last 30 days",
  "90d": "Last 90 days",
  "6m": "Last 6 months",
  "12m": "Last 12 months",
  "ytd": "Year to date",
};

interface MetricCard {
  label: string;
  value: string;
  change: number;
  changeLabel: string;
  icon: React.ElementType;
  color: string;
  bg: string;
  trend: "up" | "down" | "flat";
  positive_direction: "up" | "down";
}

const OVERVIEW_METRICS: MetricCard[] = [
  {
    label: "Active Patients",
    value: "32",
    change: 6.7,
    changeLabel: "vs last period",
    icon: Users,
    color: "text-blue-700",
    bg: "bg-blue-50",
    trend: "up",
    positive_direction: "up",
  },
  {
    label: "Sessions This Month",
    value: "124",
    change: 8.8,
    changeLabel: "vs last month",
    icon: Calendar,
    color: "text-indigo-700",
    bg: "bg-indigo-50",
    trend: "up",
    positive_direction: "up",
  },
  {
    label: "Clinical Hours",
    value: "103h",
    change: 4.2,
    changeLabel: "vs last month",
    icon: Clock,
    color: "text-purple-700",
    bg: "bg-purple-50",
    trend: "up",
    positive_direction: "up",
  },
  {
    label: "Documentation Time Saved",
    value: "47h",
    change: 12.3,
    changeLabel: "with AI Scribe",
    icon: Brain,
    color: "text-emerald-700",
    bg: "bg-emerald-50",
    trend: "up",
    positive_direction: "up",
  },
  {
    label: "Avg PHQ-9 (Active)",
    value: "10.4",
    change: -1.8,
    changeLabel: "vs 3 months ago",
    icon: Activity,
    color: "text-amber-700",
    bg: "bg-amber-50",
    trend: "down",
    positive_direction: "down",
  },
  {
    label: "At-Risk Patients",
    value: "3",
    change: -25.0,
    changeLabel: "vs last month",
    icon: AlertTriangle,
    color: "text-red-700",
    bg: "bg-red-50",
    trend: "down",
    positive_direction: "down",
  },
  {
    label: "Treatment Plan Adherence",
    value: "84%",
    change: 3.1,
    changeLabel: "vs last quarter",
    icon: CheckCircle2,
    color: "text-teal-700",
    bg: "bg-teal-50",
    trend: "up",
    positive_direction: "up",
  },
  {
    label: "Monthly Revenue",
    value: "$18,600",
    change: 9.4,
    changeLabel: "vs last month",
    icon: DollarSign,
    color: "text-green-700",
    bg: "bg-green-50",
    trend: "up",
    positive_direction: "up",
  },
];

// PHQ-9 trend data (mock - 12 months)
const PHQ9_TREND = [
  { month: "Jan", avg: 14.2, count: 24 },
  { month: "Feb", avg: 13.8, count: 25 },
  { month: "Mar", avg: 13.1, count: 26 },
  { month: "Apr", avg: 12.9, count: 27 },
  { month: "May", avg: 12.4, count: 28 },
  { month: "Jun", avg: 12.0, count: 29 },
  { month: "Jul", avg: 11.8, count: 30 },
  { month: "Aug", avg: 11.5, count: 30 },
  { month: "Sep", avg: 11.9, count: 31 },
  { month: "Oct", avg: 11.3, count: 32 },
  { month: "Nov", avg: 10.8, count: 32 },
  { month: "Dec", avg: 10.4, count: 32 },
];

// Session distribution
const SESSION_TYPES = [
  { label: "Individual Therapy", count: 98, pct: 79, color: "#0A2342" },
  { label: "Couples Therapy", count: 14, pct: 11, color: "#2EC4B6" },
  { label: "Group Therapy", count: 8, pct: 6, color: "#6366f1" },
  { label: "Intake / Assessment", count: 4, pct: 3, color: "#f59e0b" },
];

// Diagnosis distribution
const DIAGNOSIS_DIST = [
  { label: "Depression (MDD/PDD)", count: 14, pct: 44 },
  { label: "Anxiety Disorders", count: 10, pct: 31 },
  { label: "PTSD / Trauma", count: 5, pct: 16 },
  { label: "Other", count: 3, pct: 9 },
];

// Patient outcome outcomes
const PATIENT_OUTCOMES = [
  {
    id: "p1",
    name: "Sarah Chen",
    sessions: 24,
    phq9_start: 17,
    phq9_current: 13,
    gad7_start: 14,
    gad7_current: 8,
    trend: "improving",
    goals_pct: 65,
    months_in_treatment: 16,
  },
  {
    id: "p2",
    name: "Marcus Webb",
    sessions: 16,
    phq9_start: 15,
    phq9_current: 12,
    gad7_start: 11,
    gad7_current: 9,
    trend: "improving",
    goals_pct: 45,
    months_in_treatment: 10,
  },
  {
    id: "p3",
    name: "Priya Nair",
    sessions: 35,
    phq9_start: 21,
    phq9_current: 10,
    gad7_start: 18,
    gad7_current: 7,
    trend: "significant_improvement",
    goals_pct: 88,
    months_in_treatment: 28,
  },
  {
    id: "p4",
    name: "James Rodriguez",
    sessions: 20,
    phq9_start: 18,
    phq9_current: 15,
    gad7_start: 16,
    gad7_current: 14,
    trend: "mild_improvement",
    goals_pct: 32,
    months_in_treatment: 14,
  },
  {
    id: "p5",
    name: "Emily Park",
    sessions: 8,
    phq9_start: 19,
    phq9_current: 17,
    gad7_start: 14,
    gad7_current: 13,
    trend: "early",
    goals_pct: 15,
    months_in_treatment: 3,
  },
];

// Monthly sessions chart
const MONTHLY_SESSIONS = [
  { month: "Jul", completed: 84, cancelled: 8, no_show: 4 },
  { month: "Aug", completed: 91, cancelled: 7, no_show: 3 },
  { month: "Sep", completed: 95, cancelled: 9, no_show: 5 },
  { month: "Oct", completed: 102, cancelled: 6, no_show: 4 },
  { month: "Nov", completed: 108, cancelled: 10, no_show: 3 },
  { month: "Dec", completed: 124, cancelled: 8, no_show: 4 },
];

const maxSessions = Math.max(...MONTHLY_SESSIONS.map(m => m.completed));

const TREND_CONFIG = {
  significant_improvement: { label: "Significant Improvement", color: "text-emerald-700", bg: "bg-emerald-100", dot: "bg-emerald-500" },
  improving: { label: "Improving", color: "text-green-700", bg: "bg-green-100", dot: "bg-green-500" },
  stable: { label: "Stable", color: "text-blue-700", bg: "bg-blue-100", dot: "bg-blue-500" },
  mild_improvement: { label: "Mild Progress", color: "text-amber-700", bg: "bg-amber-100", dot: "bg-amber-500" },
  early: { label: "Early Stage", color: "text-gray-600", bg: "bg-gray-100", dot: "bg-gray-400" },
  declining: { label: "Needs Attention", color: "text-red-700", bg: "bg-red-100", dot: "bg-red-500" },
};

// AI clinical insights
const AI_INSIGHTS = [
  {
    id: "i1",
    type: "pattern",
    title: "Seasonal PHQ-9 Elevation",
    description: "3 patients showing seasonal mood worsening consistent with prior year pattern (Nov–Jan). Consider proactive outreach and seasonal care adjustments.",
    action: "View Patients",
    severity: "medium",
  },
  {
    id: "i2",
    type: "outcome",
    title: "Above-Average Outcomes for CBT Patients",
    description: "Your CBT patients are achieving 23% faster PHQ-9 reduction compared to your GAD-7 benchmark. Behavioral activation component shows strongest correlation with improvement.",
    action: "View Analysis",
    severity: "positive",
  },
  {
    id: "i3",
    type: "risk",
    title: "1 Patient — No Contact in 14 Days",
    description: "Marcus Webb has not attended his last 2 scheduled sessions. Radar score increased to 71. Proactive outreach recommended.",
    action: "Contact Patient",
    severity: "high",
  },
  {
    id: "i4",
    type: "efficiency",
    title: "Documentation Efficiency: +47 Hours Saved",
    description: "AI Scribe generated 124 notes this month. Average note generation time: 23 seconds. You are in the top 12% of 24Therapy clinicians for note approval speed.",
    action: "View Notes",
    severity: "positive",
  },
];

export default function AnalyticsPage() {
  const [period, setPeriod] = useState<Period>("30d");
  const [activeTab, setActiveTab] = useState<AnalyticsTab>("overview");
  const [liveMetrics, setLiveMetrics] = useState<any>(null);

  useEffect(() => {
    analyticsAPI.dashboard(period).then((data: any) => {
      if (data) setLiveMetrics(data);
    }).catch(() => {});
  }, [period]);

  // Merge live metrics into the overview cards where available
  const mergedMetrics = OVERVIEW_METRICS.map((m: MetricCard) => {
    if (!liveMetrics) return m;
    const key = m.label.toLowerCase().replace(/\s+/g, '_');
    const liveVal = liveMetrics[key] ?? liveMetrics[m.label];
    if (liveVal !== undefined) return { ...m, value: String(liveVal) };
    return m;
  });

  const isPositiveTrend = (metric: MetricCard) => {
    return metric.positive_direction === "up" ? metric.trend === "up" : metric.trend === "down";
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Analytics & Intelligence</h1>
          <p className="text-sm text-gray-500 mt-1">Clinical outcomes, practice performance, and AI-powered insights</p>
        </div>
        <div className="flex items-center gap-3">
          {/* Period selector */}
          <div className="flex gap-1 bg-gray-100 rounded-xl p-1">
            {(Object.entries(PERIOD_LABELS) as [Period, string][]).map(([p, label]) => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={cn(
                  "px-3 py-1.5 rounded-lg text-xs font-medium transition-all",
                  period === p ? "bg-white text-gray-900 shadow-sm" : "text-gray-500"
                )}
              >
                {p}
              </button>
            ))}
          </div>
          <button className="flex items-center gap-2 px-3 py-2 border border-gray-200 rounded-xl text-sm text-gray-600 hover:bg-gray-50">
            <Download className="h-4 w-4" /> Export
          </button>
        </div>
      </div>

      {/* Tab navigation */}
      <div className="flex gap-1 bg-gray-100 rounded-2xl p-1.5">
        {[
          { id: "overview", label: "Overview", icon: BarChart3 },
          { id: "patients", label: "Patients", icon: Users },
          { id: "outcomes", label: "Clinical Outcomes", icon: TrendingUp },
          { id: "sessions", label: "Sessions", icon: Calendar },
          { id: "financial", label: "Financial", icon: DollarSign },
        ].map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setActiveTab(id as AnalyticsTab)}
            className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all",
              activeTab === id ? "bg-white text-gray-900 shadow-sm" : "text-gray-500"
            )}
          >
            <Icon className="h-4 w-4" />
            {label}
          </button>
        ))}
      </div>

      {/* OVERVIEW TAB */}
      {activeTab === "overview" && (
        <div className="space-y-6">
          {/* KPI Grid */}
          <div className="grid grid-cols-4 gap-4">
            {OVERVIEW_METRICS.map((metric) => {
              const Icon = metric.icon;
              const isPositive = isPositiveTrend(metric);
              return (
                <div key={metric.label} className="bg-white rounded-2xl border border-gray-200 p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className={cn("w-9 h-9 rounded-xl flex items-center justify-center", metric.bg)}>
                      <Icon className={cn("h-4.5 w-4.5", metric.color)} style={{ width: 18, height: 18 }} />
                    </div>
                    <div className={cn(
                      "flex items-center gap-1 text-xs font-semibold",
                      isPositive ? "text-emerald-600" : "text-red-500"
                    )}>
                      {metric.trend === "up" ? <ArrowUp className="h-3 w-3" /> :
                       metric.trend === "down" ? <ArrowDown className="h-3 w-3" /> :
                       <Minus className="h-3 w-3" />}
                      {Math.abs(metric.change)}%
                    </div>
                  </div>
                  <div className="text-2xl font-bold text-gray-900 mb-0.5">{metric.value}</div>
                  <div className="text-xs text-gray-500">{metric.label}</div>
                  <div className="text-[10px] text-gray-400 mt-1">{metric.changeLabel}</div>
                </div>
              );
            })}
          </div>

          <div className="grid grid-cols-3 gap-6">
            {/* PHQ-9 Trend Chart */}
            <div className="col-span-2 bg-white rounded-2xl border border-gray-200 p-5">
              <div className="flex items-center justify-between mb-5">
                <div>
                  <h3 className="font-semibold text-gray-900">Average PHQ-9 Trend</h3>
                  <p className="text-xs text-gray-500">Caseload-wide depression severity (12 months)</p>
                </div>
                <div className="flex items-center gap-2 text-xs text-emerald-600 font-semibold bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200">
                  <TrendingDown className="h-3.5 w-3.5" />
                  -3.8 pts YOY
                </div>
              </div>

              {/* Chart */}
              <div className="flex items-end gap-2 h-48 px-2">
                {PHQ9_TREND.map((d, i) => {
                  const maxVal = 20;
                  const height = (d.avg / maxVal) * 100;
                  const isLast = i === PHQ9_TREND.length - 1;
                  return (
                    <div key={d.month} className="flex-1 flex flex-col items-center gap-1">
                      <div className="text-[10px] text-gray-400 font-medium">{d.avg}</div>
                      <div className="w-full relative flex items-end" style={{ height: "160px" }}>
                        <div
                          className={cn(
                            "w-full rounded-t-lg transition-all",
                            isLast ? "bg-[#0A2342]" : "bg-blue-200"
                          )}
                          style={{ height: `${height}%` }}
                        />
                      </div>
                      <div className="text-[9px] text-gray-400">{d.month}</div>
                    </div>
                  );
                })}
              </div>

              {/* Severity bands */}
              <div className="mt-4 flex gap-4 text-xs">
                {[
                  { label: "Minimal (0-4)", color: "bg-emerald-400" },
                  { label: "Mild (5-9)", color: "bg-yellow-400" },
                  { label: "Moderate (10-14)", color: "bg-orange-400" },
                  { label: "Severe (15-27)", color: "bg-red-500" },
                ].map(({ label, color }) => (
                  <div key={label} className="flex items-center gap-1.5">
                    <div className={cn("w-2.5 h-2.5 rounded", color)} />
                    <span className="text-gray-500">{label}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Session Distribution */}
            <div className="bg-white rounded-2xl border border-gray-200 p-5">
              <h3 className="font-semibold text-gray-900 mb-1">Session Types</h3>
              <p className="text-xs text-gray-500 mb-5">This month</p>

              <div className="space-y-3">
                {SESSION_TYPES.map((type) => (
                  <div key={type.label}>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-xs text-gray-700">{type.label}</span>
                      <span className="text-xs font-semibold text-gray-900">{type.count}</span>
                    </div>
                    <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{ width: `${type.pct}%`, backgroundColor: type.color }}
                      />
                    </div>
                    <div className="text-[10px] text-gray-400 mt-0.5">{type.pct}% of total</div>
                  </div>
                ))}
              </div>

              <div className="mt-5 pt-4 border-t border-gray-100">
                <h3 className="font-semibold text-gray-900 mb-3 text-sm">Diagnoses</h3>
                <div className="space-y-2">
                  {DIAGNOSIS_DIST.map((d) => (
                    <div key={d.label} className="flex items-center justify-between text-xs">
                      <span className="text-gray-600">{d.label}</span>
                      <div className="flex items-center gap-2">
                        <div className="w-16 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                          <div className="h-full bg-[#0A2342] rounded-full" style={{ width: `${d.pct}%` }} />
                        </div>
                        <span className="text-gray-500 w-7 text-right">{d.pct}%</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* AI Insights */}
          <div>
            <div className="flex items-center gap-2 mb-4">
              <Sparkles className="h-4 w-4 text-indigo-600" />
              <h3 className="font-semibold text-gray-900">AI-Generated Practice Insights</h3>
              <span className="text-xs bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full font-medium">Live</span>
            </div>
            <div className="grid grid-cols-2 gap-4">
              {AI_INSIGHTS.map((insight) => (
                <div
                  key={insight.id}
                  className={cn(
                    "rounded-2xl border p-4",
                    insight.severity === "high" ? "bg-red-50 border-red-200" :
                    insight.severity === "medium" ? "bg-amber-50 border-amber-200" :
                    insight.severity === "positive" ? "bg-emerald-50 border-emerald-200" :
                    "bg-gray-50 border-gray-200"
                  )}
                >
                  <div className="flex items-start gap-3">
                    <div className={cn(
                      "w-7 h-7 rounded-lg flex items-center justify-center shrink-0",
                      insight.severity === "high" ? "bg-red-100" :
                      insight.severity === "medium" ? "bg-amber-100" :
                      "bg-emerald-100"
                    )}>
                      {insight.severity === "high" ? <AlertTriangle className="h-4 w-4 text-red-600" /> :
                       insight.severity === "medium" ? <Zap className="h-4 w-4 text-amber-600" /> :
                       <TrendingUp className="h-4 w-4 text-emerald-600" />}
                    </div>
                    <div className="flex-1">
                      <p className={cn(
                        "font-semibold text-sm mb-1",
                        insight.severity === "high" ? "text-red-900" :
                        insight.severity === "medium" ? "text-amber-900" :
                        "text-emerald-900"
                      )}>
                        {insight.title}
                      </p>
                      <p className={cn(
                        "text-xs leading-relaxed mb-3",
                        insight.severity === "high" ? "text-red-700" :
                        insight.severity === "medium" ? "text-amber-700" :
                        "text-emerald-700"
                      )}>
                        {insight.description}
                      </p>
                      <button className={cn(
                        "text-xs font-medium flex items-center gap-1",
                        insight.severity === "high" ? "text-red-700 hover:text-red-900" :
                        insight.severity === "medium" ? "text-amber-700 hover:text-amber-900" :
                        "text-emerald-700 hover:text-emerald-900"
                      )}>
                        {insight.action} <ChevronRight className="h-3 w-3" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* CLINICAL OUTCOMES TAB */}
      {activeTab === "outcomes" && (
        <div className="space-y-6">
          {/* Summary stats */}
          <div className="grid grid-cols-4 gap-4">
            {[
              { label: "Patients Showing Improvement", value: "27 / 32", pct: 84, color: "text-emerald-700", bg: "bg-emerald-50" },
              { label: "Avg PHQ-9 Reduction", value: "-3.8", pct: null, color: "text-blue-700", bg: "bg-blue-50", sub: "from baseline" },
              { label: "Treatment Goals Achieved", value: "67%", pct: 67, color: "text-indigo-700", bg: "bg-indigo-50" },
              { label: "Successful Discharges (YTD)", value: "14", pct: null, color: "text-teal-700", bg: "bg-teal-50", sub: "avg 18 sessions" },
            ].map((stat) => (
              <div key={stat.label} className={cn("rounded-2xl border border-gray-200 p-4", stat.bg)}>
                <div className={cn("text-2xl font-bold mb-1", stat.color)}>{stat.value}</div>
                <div className="text-xs text-gray-600">{stat.label}</div>
                {stat.sub && <div className="text-[10px] text-gray-400 mt-0.5">{stat.sub}</div>}
                {stat.pct !== null && (
                  <div className="mt-2 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                    <div className="h-full bg-current rounded-full" style={{ width: `${stat.pct}%`, color: stat.color }} />
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Patient outcome table */}
          <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
              <h3 className="font-semibold text-gray-900">Individual Patient Outcomes</h3>
              <span className="text-xs text-gray-500">{PATIENT_OUTCOMES.length} patients shown</span>
            </div>
            <div className="divide-y divide-gray-100">
              {PATIENT_OUTCOMES.map((patient) => {
                const phq9Change = patient.phq9_current - patient.phq9_start;
                const gad7Change = patient.gad7_current - patient.gad7_start;
                const trend = TREND_CONFIG[patient.trend as keyof typeof TREND_CONFIG] || TREND_CONFIG.stable;

                return (
                  <div key={patient.id} className="px-5 py-4 hover:bg-gray-50 transition-colors">
                    <div className="flex items-center gap-4">
                      <div className="w-9 h-9 bg-[#0A2342] rounded-xl flex items-center justify-center text-white text-xs font-bold shrink-0">
                        {patient.name.split(" ").map(n => n[0]).join("")}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-semibold text-gray-900 text-sm">{patient.name}</span>
                          <span className={cn("text-xs font-medium px-2 py-0.5 rounded-full flex items-center gap-1", trend.bg, trend.color)}>
                            <div className={cn("w-1.5 h-1.5 rounded-full", trend.dot)} />
                            {trend.label}
                          </span>
                        </div>
                        <div className="text-xs text-gray-500">
                          {patient.sessions} sessions · {patient.months_in_treatment} months in treatment
                        </div>
                      </div>

                      {/* PHQ-9 */}
                      <div className="text-center">
                        <div className="text-xs text-gray-400 mb-1">PHQ-9</div>
                        <div className="flex items-baseline gap-1">
                          <span className="text-lg font-bold text-gray-900">{patient.phq9_current}</span>
                          <span className={cn(
                            "text-xs font-semibold",
                            phq9Change < 0 ? "text-emerald-600" : phq9Change > 0 ? "text-red-600" : "text-gray-500"
                          )}>
                            {phq9Change > 0 ? "+" : ""}{phq9Change}
                          </span>
                        </div>
                        <div className="text-[10px] text-gray-400">was {patient.phq9_start}</div>
                      </div>

                      {/* GAD-7 */}
                      <div className="text-center">
                        <div className="text-xs text-gray-400 mb-1">GAD-7</div>
                        <div className="flex items-baseline gap-1">
                          <span className="text-lg font-bold text-gray-900">{patient.gad7_current}</span>
                          <span className={cn(
                            "text-xs font-semibold",
                            gad7Change < 0 ? "text-emerald-600" : gad7Change > 0 ? "text-red-600" : "text-gray-500"
                          )}>
                            {gad7Change > 0 ? "+" : ""}{gad7Change}
                          </span>
                        </div>
                        <div className="text-[10px] text-gray-400">was {patient.gad7_start}</div>
                      </div>

                      {/* Goals */}
                      <div className="w-24">
                        <div className="text-xs text-gray-400 mb-1">Goals Progress</div>
                        <div className="text-lg font-bold text-gray-900">{patient.goals_pct}%</div>
                        <div className="h-1.5 bg-gray-100 rounded-full mt-1 overflow-hidden">
                          <div
                            className="h-full bg-[#0A2342] rounded-full"
                            style={{ width: `${patient.goals_pct}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* SESSIONS TAB */}
      {activeTab === "sessions" && (
        <div className="space-y-6">
          {/* Monthly session bar chart */}
          <div className="bg-white rounded-2xl border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="font-semibold text-gray-900">Sessions by Month</h3>
                <p className="text-xs text-gray-500">Last 6 months</p>
              </div>
              <div className="flex items-center gap-4 text-xs">
                <span className="flex items-center gap-1.5"><span className="w-3 h-3 bg-[#0A2342] rounded" /> Completed</span>
                <span className="flex items-center gap-1.5"><span className="w-3 h-3 bg-amber-400 rounded" /> Cancelled</span>
                <span className="flex items-center gap-1.5"><span className="w-3 h-3 bg-red-300 rounded" /> No-show</span>
              </div>
            </div>

            <div className="flex items-end gap-4 h-48">
              {MONTHLY_SESSIONS.map((m) => (
                <div key={m.month} className="flex-1 flex flex-col items-center gap-1">
                  <div className="text-[10px] text-gray-400">{m.completed}</div>
                  <div className="w-full flex flex-col items-end" style={{ height: "160px" }}>
                    <div className="w-full flex flex-col justify-end h-full gap-0.5">
                      <div
                        className="w-full bg-red-300 rounded-t-sm"
                        style={{ height: `${(m.no_show / maxSessions) * 100}%` }}
                      />
                      <div
                        className="w-full bg-amber-400"
                        style={{ height: `${(m.cancelled / maxSessions) * 100}%` }}
                      />
                      <div
                        className="w-full bg-[#0A2342] rounded-t-lg"
                        style={{ height: `${(m.completed / maxSessions) * 100}%` }}
                      />
                    </div>
                  </div>
                  <div className="text-xs text-gray-600 font-medium">{m.month}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Session quality metrics */}
          <div className="grid grid-cols-3 gap-4">
            {[
              { label: "Avg Session Duration", value: "52 min", sub: "+2 min vs benchmark", icon: Clock, color: "text-blue-700", bg: "bg-blue-50" },
              { label: "Cancellation Rate", value: "6.1%", sub: "Industry avg: 11%", icon: Calendar, color: "text-emerald-700", bg: "bg-emerald-50" },
              { label: "No-Show Rate", value: "3.2%", sub: "Telehealth reduces no-shows", icon: AlertTriangle, color: "text-amber-700", bg: "bg-amber-50" },
            ].map((s) => {
              const Icon = s.icon;
              return (
                <div key={s.label} className={cn("rounded-2xl border border-gray-200 p-5", s.bg)}>
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-8 h-8 bg-white rounded-lg flex items-center justify-center">
                      <Icon className={cn("h-4 w-4", s.color)} />
                    </div>
                    <span className="text-sm text-gray-600">{s.label}</span>
                  </div>
                  <div className={cn("text-2xl font-bold mb-1", s.color)}>{s.value}</div>
                  <div className="text-xs text-gray-500">{s.sub}</div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* FINANCIAL TAB */}
      {activeTab === "financial" && (
        <div className="space-y-6">
          <div className="grid grid-cols-4 gap-4">
            {[
              { label: "This Month", value: "$18,600", change: "+9.4%", positive: true },
              { label: "YTD Revenue", value: "$187,200", change: "+18.2% YoY", positive: true },
              { label: "Avg Revenue/Session", value: "$150", change: "+$5 vs Q3", positive: true },
              { label: "Outstanding Invoices", value: "$2,340", change: "12 invoices", positive: false },
            ].map((stat) => (
              <div key={stat.label} className="bg-white rounded-2xl border border-gray-200 p-4">
                <div className="text-2xl font-bold text-gray-900 mb-1">{stat.value}</div>
                <div className="text-xs text-gray-500 mb-2">{stat.label}</div>
                <div className={cn("text-xs font-semibold", stat.positive ? "text-emerald-600" : "text-amber-600")}>
                  {stat.change}
                </div>
              </div>
            ))}
          </div>

          <div className="bg-white rounded-2xl border border-gray-200 p-5">
            <h3 className="font-semibold text-gray-900 mb-4">Revenue Breakdown</h3>
            <div className="space-y-4">
              {[
                { label: "Out-of-pocket / Self-pay", amount: 9300, pct: 50, color: "#0A2342" },
                { label: "Blue Cross Blue Shield", amount: 5580, pct: 30, color: "#2EC4B6" },
                { label: "Aetna", amount: 2790, pct: 15, color: "#6366f1" },
                { label: "Medicare", amount: 930, pct: 5, color: "#f59e0b" },
              ].map((source) => (
                <div key={source.label}>
                  <div className="flex items-center justify-between mb-1.5 text-sm">
                    <span className="text-gray-700">{source.label}</span>
                    <span className="font-semibold text-gray-900">${source.amount.toLocaleString()} ({source.pct}%)</span>
                  </div>
                  <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full"
                      style={{ width: `${source.pct}%`, backgroundColor: source.color }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* PATIENTS TAB */}
      {activeTab === "patients" && (
        <div className="space-y-6">
          <div className="grid grid-cols-5 gap-4">
            {[
              { label: "Total Active", value: 32, color: "text-gray-900" },
              { label: "New This Month", value: 3, color: "text-blue-700" },
              { label: "Discharged (YTD)", value: 14, color: "text-emerald-700" },
              { label: "On Waitlist", value: 8, color: "text-amber-700" },
              { label: "High Risk", value: 3, color: "text-red-700" },
            ].map((stat) => (
              <div key={stat.label} className="bg-white rounded-2xl border border-gray-200 p-4">
                <div className={cn("text-3xl font-bold mb-1", stat.color)}>{stat.value}</div>
                <div className="text-xs text-gray-500">{stat.label}</div>
              </div>
            ))}
          </div>

          {/* Patient age + gender breakdown */}
          <div className="grid grid-cols-2 gap-6">
            <div className="bg-white rounded-2xl border border-gray-200 p-5">
              <h3 className="font-semibold text-gray-900 mb-4">Age Distribution</h3>
              {[
                { range: "18-24", count: 4, pct: 12 },
                { range: "25-34", count: 11, pct: 34 },
                { range: "35-44", count: 8, pct: 25 },
                { range: "45-54", count: 6, pct: 19 },
                { range: "55+", count: 3, pct: 9 },
              ].map((a) => (
                <div key={a.range} className="flex items-center gap-3 mb-3">
                  <span className="text-xs text-gray-600 w-12">{a.range}</span>
                  <div className="flex-1 h-3 bg-gray-100 rounded-full overflow-hidden">
                    <div className="h-full bg-[#0A2342] rounded-full" style={{ width: `${a.pct * 2}%` }} />
                  </div>
                  <span className="text-xs text-gray-500 w-8">{a.count}</span>
                </div>
              ))}
            </div>

            <div className="bg-white rounded-2xl border border-gray-200 p-5">
              <h3 className="font-semibold text-gray-900 mb-4">Session Frequency</h3>
              {[
                { label: "Weekly", count: 18, pct: 56 },
                { label: "Bi-weekly", count: 10, pct: 31 },
                { label: "Monthly", count: 3, pct: 9 },
                { label: "As needed", count: 1, pct: 3 },
              ].map((s) => (
                <div key={s.label} className="flex items-center gap-3 mb-3">
                  <span className="text-xs text-gray-600 w-20">{s.label}</span>
                  <div className="flex-1 h-3 bg-gray-100 rounded-full overflow-hidden">
                    <div className="h-full bg-[#2EC4B6] rounded-full" style={{ width: `${s.pct}%` }} />
                  </div>
                  <span className="text-xs text-gray-500 w-8">{s.count}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Reviewed: 2026-06-13 — 24Therapy audit
