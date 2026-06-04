"use client";

import { useState } from "react";
import {
  AlertTriangle, Activity, TrendingUp, TrendingDown, Shield,
  Brain, Phone, MessageSquare, FileText, Clock, Calendar,
  ChevronRight, User, Zap, Eye, Plus, CheckCircle2, Flag,
  BarChart3, Bell, Sparkles, ArrowRight, ExternalLink,
  Heart, AlertCircle, RefreshCw
} from "lucide-react";
import { cn, getInitials } from "@/lib/utils";

type RiskLevel = "critical" | "high" | "medium" | "low" | "stable";

interface PatientRisk {
  id: string;
  name: string;
  age: number;
  diagnosis: string;
  risk_level: RiskLevel;
  radar_score: number;
  radar_change: number;
  last_contact: string;
  next_session: string;
  flags: string[];
  recent_signals: Array<{
    type: "mood" | "attendance" | "disclosure" | "medication" | "social" | "sleep" | "assessment";
    label: string;
    detail: string;
    severity: "high" | "medium" | "low";
    date: string;
  }>;
  crisis_plan: boolean;
  safety_assessment_due: boolean;
  notes?: string;
}

const MOCK_PATIENTS: PatientRisk[] = [
  {
    id: "p_001",
    name: "Marcus Webb",
    age: 42,
    diagnosis: "PTSD, AUD",
    risk_level: "critical",
    radar_score: 83,
    radar_change: +14,
    last_contact: "14 days ago",
    next_session: "Overdue",
    crisis_plan: true,
    safety_assessment_due: true,
    flags: ["2 missed sessions", "No response to outreach", "AUD escalation disclosed"],
    notes: "Last session disclosed alcohol use increase. Two subsequent sessions missed. Unanswered calls and messages.",
    recent_signals: [
      { type: "attendance", label: "Missed Session", detail: "No-showed Dec 15 and Dec 22 without contact", severity: "high", date: "Dec 22" },
      { type: "disclosure", label: "AUD Escalation", detail: "Disclosed drinking 8+ units daily at Session #16", severity: "high", date: "Dec 10" },
      { type: "mood", label: "Mood Score Drop", detail: "Self-reported 3/10 (vs 6/10 baseline) — last check-in via app", severity: "high", date: "Dec 12" },
      { type: "social", label: "Social Withdrawal", detail: "Cancelled plans with wife and stopped gym attendance", severity: "medium", date: "Dec 8" },
    ],
  },
  {
    id: "p_002",
    name: "Emily Park",
    age: 29,
    diagnosis: "MDD, GAD",
    risk_level: "high",
    radar_score: 71,
    radar_change: +8,
    last_contact: "3 days ago",
    next_session: "Jan 3",
    crisis_plan: false,
    safety_assessment_due: true,
    flags: ["PHQ-9 spike", "Reported SI (passive)"],
    notes: "Disclosed passive SI at last session — no plan or intent. Crisis safety plan not yet developed.",
    recent_signals: [
      { type: "disclosure", label: "Passive SI Disclosed", detail: "\"I sometimes wish I just wouldn't wake up\" — no plan/intent", severity: "high", date: "Dec 21" },
      { type: "assessment", label: "PHQ-9 Increased", detail: "Score jumped from 14 to 19 (Moderately Severe)", severity: "high", date: "Dec 21" },
      { type: "sleep", label: "Sleep Deterioration", detail: "Sleeping 3-4 hrs/night, app data confirms (mood: 2/10 mornings)", severity: "medium", date: "Dec 18-23" },
      { type: "medication", label: "Missed Medication", detail: "Reports forgetting Lexapro 3+ days this week", severity: "medium", date: "Dec 20" },
    ],
  },
  {
    id: "p_003",
    name: "Priya Nair",
    age: 27,
    diagnosis: "Anorexia Nervosa (AN-R)",
    risk_level: "high",
    radar_score: 68,
    radar_change: -5,
    last_contact: "1 day ago",
    next_session: "Jan 5",
    crisis_plan: true,
    safety_assessment_due: false,
    flags: ["Weight decline noted", "Restricting increased"],
    notes: "Medical team monitoring. Weight down 2.1kg in 3 weeks. IOP continues. Coordinating with Dr. Fitch.",
    recent_signals: [
      { type: "mood", label: "Body Image Distress", detail: "Reported significant increase in body dysmorphia thoughts in journal", severity: "medium", date: "Dec 20" },
      { type: "social", label: "IOP Attendance Inconsistent", detail: "Attended 3/5 IOP sessions past week", severity: "medium", date: "Dec 15-22" },
      { type: "disclosure", label: "Restriction Increase", detail: "Reported skipping dinner 4 nights this week", severity: "high", date: "Dec 21" },
    ],
  },
  {
    id: "p_004",
    name: "Sarah Chen",
    age: 34,
    diagnosis: "MDD, GAD",
    risk_level: "medium",
    radar_score: 42,
    radar_change: +3,
    last_contact: "7 days ago",
    next_session: "Dec 29",
    crisis_plan: false,
    safety_assessment_due: false,
    flags: ["Seasonal pattern active", "PHQ-9 increased"],
    notes: "Seasonal pattern emerging (Nov-Jan). PHQ-9 +2 from last month. Monitor but not acute.",
    recent_signals: [
      { type: "mood", label: "Mood Worsening (Seasonal)", detail: "App mood logs show 34% lower scores vs October baseline", severity: "medium", date: "Dec 1-23" },
      { type: "assessment", label: "PHQ-9 +2", detail: "Score increased from 11 to 13 — consistent with seasonal pattern", severity: "medium", date: "Dec 15" },
    ],
  },
  {
    id: "p_005",
    name: "James Rodriguez",
    age: 50,
    diagnosis: "PTSD (Chronic)",
    risk_level: "medium",
    radar_score: 38,
    radar_change: 0,
    last_contact: "2 days ago",
    next_session: "Jan 2",
    crisis_plan: true,
    safety_assessment_due: false,
    flags: ["Hyperarousal increase"],
    notes: "PCL-5 stable. Prazosin managing nightmares. EMDR referral in progress.",
    recent_signals: [
      { type: "sleep", label: "Nightmare Recurrence", detail: "Reported nightmares 3x this week despite Prazosin (prev: 0-1/week)", severity: "medium", date: "Dec 18-22" },
      { type: "mood", label: "Hyperarousal (Elevated)", detail: "Self-reported hypervigilance 7/10 when in public spaces", severity: "medium", date: "Dec 20" },
    ],
  },
];

const RISK_CONFIG: Record<RiskLevel, { label: string; color: string; bg: string; border: string; dot: string; textColor: string }> = {
  critical: { label: "Critical", color: "text-red-700", bg: "bg-red-50", border: "border-red-300", dot: "bg-red-600", textColor: "text-red-800" },
  high: { label: "High Risk", color: "text-orange-700", bg: "bg-orange-50", border: "border-orange-300", dot: "bg-orange-500", textColor: "text-orange-800" },
  medium: { label: "Medium", color: "text-amber-700", bg: "bg-amber-50", border: "border-amber-300", dot: "bg-amber-500", textColor: "text-amber-800" },
  low: { label: "Low", color: "text-blue-700", bg: "bg-blue-50", border: "border-blue-200", dot: "bg-blue-500", textColor: "text-blue-800" },
  stable: { label: "Stable", color: "text-emerald-700", bg: "bg-emerald-50", border: "border-emerald-200", dot: "bg-emerald-500", textColor: "text-emerald-800" },
};

const SIGNAL_CONFIG: Record<string, { icon: React.ElementType; color: string }> = {
  mood: { icon: Heart, color: "text-rose-600" },
  attendance: { icon: Calendar, color: "text-orange-600" },
  disclosure: { icon: MessageSquare, color: "text-red-600" },
  medication: { icon: AlertCircle, color: "text-amber-600" },
  social: { icon: User, color: "text-blue-600" },
  sleep: { icon: Clock, color: "text-indigo-600" },
  assessment: { icon: BarChart3, color: "text-purple-600" },
};

export default function RiskMonitorPage() {
  const [selectedPatient, setSelectedPatient] = useState<PatientRisk | null>(MOCK_PATIENTS[0]);
  const [filterLevel, setFilterLevel] = useState<RiskLevel | "all">("all");

  const filteredPatients = MOCK_PATIENTS.filter(p =>
    filterLevel === "all" || p.risk_level === filterLevel
  );

  const stats = {
    critical: MOCK_PATIENTS.filter(p => p.risk_level === "critical").length,
    high: MOCK_PATIENTS.filter(p => p.risk_level === "high").length,
    medium: MOCK_PATIENTS.filter(p => p.risk_level === "medium").length,
    safety_due: MOCK_PATIENTS.filter(p => p.safety_assessment_due).length,
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Zap className="h-6 w-6 text-amber-500" />
            Risk Monitor
          </h1>
          <p className="text-sm text-gray-500 mt-1">AI-powered early warning system monitoring patient risk signals in real-time</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 text-xs text-emerald-600 bg-emerald-50 border border-emerald-200 px-3 py-1.5 rounded-xl">
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            Live Monitoring Active
          </div>
          <button className="flex items-center gap-2 px-3 py-2 border border-gray-200 rounded-xl text-sm text-gray-600 hover:bg-gray-50">
            <RefreshCw className="h-4 w-4" /> Refresh
          </button>
        </div>
      </div>

      {/* Alert stats */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: "Critical", value: stats.critical, color: "text-red-700", bg: "bg-red-50 border-red-200", description: "Immediate action needed" },
          { label: "High Risk", value: stats.high, color: "text-orange-700", bg: "bg-orange-50 border-orange-200", description: "Close monitoring" },
          { label: "Medium Risk", value: stats.medium, color: "text-amber-700", bg: "bg-amber-50 border-amber-200", description: "Watch closely" },
          { label: "Safety Assessments Due", value: stats.safety_due, color: "text-purple-700", bg: "bg-purple-50 border-purple-200", description: "Overdue assessments" },
        ].map((stat) => (
          <div key={stat.label} className={cn("rounded-2xl border p-4", stat.bg)}>
            <div className={cn("text-3xl font-bold mb-1", stat.color)}>{stat.value}</div>
            <div className="text-sm font-semibold text-gray-900">{stat.label}</div>
            <div className="text-xs text-gray-500 mt-0.5">{stat.description}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-5 gap-6">
        {/* Patient Risk List */}
        <div className="col-span-2 space-y-3">
          {/* Filter */}
          <div className="flex gap-1.5">
            {(["all", "critical", "high", "medium"] as const).map((level) => (
              <button
                key={level}
                onClick={() => setFilterLevel(level)}
                className={cn(
                  "flex-1 py-1.5 rounded-xl text-xs font-medium capitalize transition-all border",
                  filterLevel === level
                    ? level === "all" ? "bg-gray-900 text-white border-gray-900"
                      : level === "critical" ? "bg-red-600 text-white border-red-600"
                      : level === "high" ? "bg-orange-500 text-white border-orange-500"
                      : "bg-amber-500 text-white border-amber-500"
                    : "border-gray-200 text-gray-600 hover:bg-gray-50"
                )}
              >
                {level}
              </button>
            ))}
          </div>

          {filteredPatients.map((patient) => {
            const riskCfg = RISK_CONFIG[patient.risk_level];
            const isSelected = selectedPatient?.id === patient.id;

            return (
              <div
                key={patient.id}
                onClick={() => setSelectedPatient(patient)}
                className={cn(
                  "bg-white rounded-2xl border p-4 cursor-pointer transition-all",
                  isSelected ? "border-[#0A2342] ring-1 ring-[#0A2342]/20 shadow-sm" :
                  `${riskCfg.border} hover:shadow-sm`
                )}
              >
                <div className="flex items-start gap-3">
                  <div className="relative">
                    <div className="w-10 h-10 bg-[#0A2342] rounded-xl flex items-center justify-center text-white text-sm font-bold">
                      {getInitials(patient.name)}
                    </div>
                    <div className={cn("absolute -top-1 -right-1 w-3 h-3 rounded-full border-2 border-white", riskCfg.dot)} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-semibold text-gray-900 text-sm">{patient.name}</span>
                      <span className={cn("text-[10px] font-bold px-1.5 py-0.5 rounded-full", riskCfg.bg, riskCfg.color)}>
                        {riskCfg.label}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 mb-2">{patient.diagnosis}</p>

                    {/* Radar score */}
                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-1.5">
                        <Zap className={cn("h-3.5 w-3.5", patient.radar_score >= 70 ? "text-red-500" : patient.radar_score >= 50 ? "text-amber-500" : "text-blue-500")} />
                        <span className={cn(
                          "text-sm font-bold",
                          patient.radar_score >= 70 ? "text-red-600" : patient.radar_score >= 50 ? "text-amber-600" : "text-blue-600"
                        )}>
                          {patient.radar_score}
                        </span>
                      </div>
                      <span className={cn(
                        "text-xs font-semibold flex items-center gap-0.5",
                        patient.radar_change > 0 ? "text-red-500" : patient.radar_change < 0 ? "text-emerald-500" : "text-gray-400"
                      )}>
                        {patient.radar_change > 0 ? <TrendingUp className="h-3 w-3" /> : patient.radar_change < 0 ? <TrendingDown className="h-3 w-3" /> : null}
                        {patient.radar_change > 0 ? "+" : ""}{patient.radar_change}
                      </span>
                      <span className="text-xs text-gray-400 ml-auto">{patient.last_contact}</span>
                    </div>

                    {/* Flags */}
                    {patient.flags.slice(0, 1).map((flag) => (
                      <div key={flag} className="mt-2 flex items-center gap-1 text-xs text-red-600">
                        <Flag className="h-3 w-3 shrink-0" /> {flag}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Detail Panel */}
        {selectedPatient && (
          <div className="col-span-3 space-y-4">
            {/* Patient header */}
            <div className={cn("rounded-2xl border-2 p-5", RISK_CONFIG[selectedPatient.risk_level].border, RISK_CONFIG[selectedPatient.risk_level].bg)}>
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-start gap-3">
                  <div className="w-12 h-12 bg-[#0A2342] rounded-xl flex items-center justify-center text-white font-bold">
                    {getInitials(selectedPatient.name)}
                  </div>
                  <div>
                    <h2 className="font-bold text-gray-900 text-lg">{selectedPatient.name}</h2>
                    <p className="text-sm text-gray-600">{selectedPatient.diagnosis} · Age {selectedPatient.age}</p>
                    <p className="text-xs text-gray-500 mt-0.5">Next: {selectedPatient.next_session} · Last contact: {selectedPatient.last_contact}</p>
                  </div>
                </div>
                <div className="text-right">
                  <div className={cn("text-4xl font-bold", selectedPatient.radar_score >= 70 ? "text-red-600" : selectedPatient.radar_score >= 50 ? "text-amber-600" : "text-blue-600")}>
                    {selectedPatient.radar_score}
                  </div>
                  <div className="text-xs text-gray-500">Radar Score</div>
                  <div className={cn(
                    "text-xs font-bold mt-0.5",
                    selectedPatient.radar_change > 0 ? "text-red-500" : "text-emerald-500"
                  )}>
                    {selectedPatient.radar_change > 0 ? "↑ Increasing" : "↓ Decreasing"} ({selectedPatient.radar_change > 0 ? "+" : ""}{selectedPatient.radar_change})
                  </div>
                </div>
              </div>

              {selectedPatient.notes && (
                <div className="bg-white/70 rounded-xl p-3 text-xs text-gray-700">
                  {selectedPatient.notes}
                </div>
              )}
            </div>

            {/* Alert flags */}
            {selectedPatient.flags.length > 0 && (
              <div className="bg-white rounded-2xl border border-gray-200 p-4">
                <h3 className="font-semibold text-gray-900 text-sm mb-3 flex items-center gap-2">
                  <Flag className="h-4 w-4 text-red-500" /> Active Alerts
                </h3>
                <div className="space-y-2">
                  {selectedPatient.flags.map((flag) => (
                    <div key={flag} className="flex items-center gap-2 text-sm text-red-700 bg-red-50 rounded-xl px-3 py-2">
                      <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                      {flag}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Risk signals */}
            <div className="bg-white rounded-2xl border border-gray-200 p-5">
              <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <Activity className="h-4 w-4 text-[#0A2342]" />
                Recent Risk Signals
              </h3>
              <div className="space-y-3">
                {selectedPatient.recent_signals.map((signal, i) => {
                  const sigCfg = SIGNAL_CONFIG[signal.type];
                  const SigIcon = sigCfg?.icon || AlertCircle;

                  return (
                    <div key={i} className={cn(
                      "flex items-start gap-3 p-3 rounded-xl border",
                      signal.severity === "high" ? "bg-red-50 border-red-200" :
                      signal.severity === "medium" ? "bg-amber-50 border-amber-100" :
                      "bg-gray-50 border-gray-200"
                    )}>
                      <div className={cn(
                        "w-7 h-7 rounded-lg flex items-center justify-center shrink-0",
                        signal.severity === "high" ? "bg-red-100" :
                        signal.severity === "medium" ? "bg-amber-100" :
                        "bg-gray-100"
                      )}>
                        <SigIcon className={cn("h-3.5 w-3.5", sigCfg?.color || "text-gray-600")} />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center justify-between mb-0.5">
                          <span className="text-xs font-semibold text-gray-900">{signal.label}</span>
                          <span className="text-[10px] text-gray-400">{signal.date}</span>
                        </div>
                        <p className="text-xs text-gray-600">{signal.detail}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Action center */}
            <div className="bg-white rounded-2xl border border-gray-200 p-5">
              <h3 className="font-semibold text-gray-900 mb-4">Clinical Actions</h3>
              <div className="grid grid-cols-2 gap-3">
                <button className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700 font-medium hover:bg-red-100 transition-colors">
                  <Phone className="h-4 w-4" /> Emergency Outreach
                </button>
                <button className="flex items-center gap-2 p-3 bg-blue-50 border border-blue-200 rounded-xl text-sm text-blue-700 font-medium hover:bg-blue-100 transition-colors">
                  <MessageSquare className="h-4 w-4" /> Send Message
                </button>
                <button className="flex items-center gap-2 p-3 border border-gray-200 rounded-xl text-sm text-gray-700 hover:bg-gray-50 transition-colors">
                  <Shield className="h-4 w-4" /> Safety Assessment
                </button>
                <button className="flex items-center gap-2 p-3 border border-gray-200 rounded-xl text-sm text-gray-700 hover:bg-gray-50 transition-colors">
                  <Calendar className="h-4 w-4" /> Schedule Crisis Session
                </button>
                <button className="flex items-center gap-2 p-3 border border-gray-200 rounded-xl text-sm text-gray-700 hover:bg-gray-50 transition-colors">
                  <FileText className="h-4 w-4" /> Document Incident
                </button>
                <button className="flex items-center gap-2 p-3 border border-gray-200 rounded-xl text-sm text-gray-700 hover:bg-gray-50 transition-colors">
                  <Sparkles className="h-4 w-4" /> AI Risk Analysis
                </button>
              </div>

              {/* Safety plan status */}
              <div className={cn(
                "mt-3 p-3 rounded-xl border flex items-center gap-2",
                selectedPatient.crisis_plan ? "bg-emerald-50 border-emerald-200" : "bg-red-50 border-red-200"
              )}>
                {selectedPatient.crisis_plan ? (
                  <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                ) : (
                  <AlertTriangle className="h-4 w-4 text-red-600 shrink-0" />
                )}
                <span className={cn("text-xs font-medium", selectedPatient.crisis_plan ? "text-emerald-700" : "text-red-700")}>
                  {selectedPatient.crisis_plan ? "Safety plan on file" : "No safety plan on file — create one"}
                </span>
                {!selectedPatient.crisis_plan && (
                  <button className="ml-auto text-xs text-red-700 font-semibold hover:underline flex items-center gap-1">
                    Create <ArrowRight className="h-3 w-3" />
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
