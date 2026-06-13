"use client";

import { useState, useEffect, useCallback } from "react";
import {
  AlertTriangle, Activity, TrendingUp, TrendingDown, Shield,
  Brain, Phone, MessageSquare, FileText, Clock, Calendar,
  User, Zap, CheckCircle2, Flag,
  BarChart3, Sparkles, ArrowRight,
  Heart, AlertCircle, RefreshCw, Loader2
} from "lucide-react";
import { cn, getInitials } from "@/lib/utils";
import { patientsAPI, APIError } from "@/lib/api";

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
    type: string;
    label: string;
    detail: string;
    severity: "high" | "medium" | "low";
    date: string;
  }>;
  crisis_plan: boolean;
  safety_assessment_due: boolean;
  notes?: string;
}

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

function normalizePatient(raw: Record<string, unknown>): PatientRisk {
  const riskLevel = (raw.risk_level as RiskLevel) || (raw.risk as RiskLevel) || "low";
  const validLevels: RiskLevel[] = ["critical", "high", "medium", "low", "stable"];
  const normalizedRisk = validLevels.includes(riskLevel) ? riskLevel : "low";

  const firstName = (raw.first_name as string) || "";
  const lastName = (raw.last_name as string) || "";
  const name =
    (raw.name as string) ||
    (firstName ? `${firstName} ${lastName}`.trim() : (raw.patient_name as string) || "Unknown Patient");

  const flags = Array.isArray(raw.flags)
    ? (raw.flags as string[])
    : Array.isArray(raw.risk_flags)
    ? (raw.risk_flags as string[])
    : [];

  type SignalItem = { type: string; label: string; detail: string; severity: "high" | "medium" | "low"; date: string };
  const recentSignals: SignalItem[] = Array.isArray(raw.recent_signals)
    ? (raw.recent_signals as SignalItem[])
    : Array.isArray(raw.signals)
    ? (raw.signals as SignalItem[])
    : [];

  return {
    id: (raw.id as string) || "",
    name,
    age: (raw.age as number) || 0,
    diagnosis:
      (raw.primary_diagnosis as string) ||
      (raw.diagnosis as string) ||
      (raw.diagnoses as string) ||
      "N/A",
    risk_level: normalizedRisk,
    radar_score: (raw.radar_score as number) || (raw.risk_score as number) || 0,
    radar_change: (raw.radar_change as number) || (raw.score_change as number) || 0,
    last_contact:
      (raw.last_contact as string) ||
      (raw.last_session_date
        ? new Date(raw.last_session_date as string).toLocaleDateString()
        : "Unknown"),
    next_session:
      (raw.next_session as string) ||
      (raw.next_session_date
        ? new Date(raw.next_session_date as string).toLocaleDateString()
        : "Not scheduled"),
    flags,
    recent_signals: recentSignals,
    crisis_plan: !!(raw.crisis_plan ?? raw.has_crisis_plan ?? raw.safety_plan),
    safety_assessment_due: !!(raw.safety_assessment_due ?? raw.assessment_overdue),
    notes: (raw.notes as string) || (raw.clinical_notes as string) || "",
  };
}

function SkeletonCard() {
  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-4 animate-pulse">
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-xl bg-gray-200" />
        <div className="flex-1 space-y-2">
          <div className="h-4 w-32 bg-gray-200 rounded" />
          <div className="h-3 w-24 bg-gray-200 rounded" />
          <div className="h-3 w-full bg-gray-200 rounded" />
        </div>
      </div>
    </div>
  );
}

export default function RiskMonitorPage() {
  const [patients, setPatients] = useState<PatientRisk[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedPatient, setSelectedPatient] = useState<PatientRisk | null>(null);
  const [filterLevel, setFilterLevel] = useState<RiskLevel | "all">("all");
  const [refreshing, setRefreshing] = useState(false);

  const fetchPatients = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    setError(null);
    try {
      // Fetch at-risk patients: high + critical risk_levels, limit 50
      const result = await patientsAPI.list({
        risk_level: "critical,high,medium",
        limit: 50,
        sort: "risk_score",
        order: "desc",
      } as Record<string, string | number | undefined>);

      const raw = Array.isArray(result)
        ? result
        : ((result as { data?: unknown[] }).data ?? []);

      const normalized = (raw as Record<string, unknown>[]).map(normalizePatient);
      // Sort by risk priority: critical > high > medium > low
      const order: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3, stable: 4 };
      normalized.sort((a, b) => (order[a.risk_level] ?? 5) - (order[b.risk_level] ?? 5) || b.radar_score - a.radar_score);

      setPatients(normalized);
      if (!selectedPatient && normalized.length > 0) {
        setSelectedPatient(normalized[0]);
      }
    } catch (err) {
      if (err instanceof APIError && err.status === 401) return;
      setError((err as Error).message || "Failed to load risk monitor data");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [selectedPatient]);

  useEffect(() => {
    fetchPatients();
  }, []);  // eslint-disable-line react-hooks/exhaustive-deps

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchPatients(true);
  };

  const filteredPatients = patients.filter(
    (p) => filterLevel === "all" || p.risk_level === filterLevel
  );

  const stats = {
    critical: patients.filter((p) => p.risk_level === "critical").length,
    high: patients.filter((p) => p.risk_level === "high").length,
    medium: patients.filter((p) => p.risk_level === "medium").length,
    safety_due: patients.filter((p) => p.safety_assessment_due).length,
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
          <p className="text-sm text-gray-500 mt-1">
            AI-powered early warning system monitoring patient risk signals in real-time
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 text-xs text-emerald-600 bg-emerald-50 border border-emerald-200 px-3 py-1.5 rounded-xl">
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            Live Monitoring Active
          </div>
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="flex items-center gap-2 px-3 py-2 border border-gray-200 rounded-xl text-sm text-gray-600 hover:bg-gray-50 disabled:opacity-50"
          >
            {refreshing ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
            Refresh
          </button>
        </div>
      </div>

      {/* Error Banner */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-2xl p-4 flex items-center justify-between">
          <div className="flex items-center gap-2 text-red-700 text-sm">
            <AlertCircle className="h-4 w-4 shrink-0" />
            {error}
          </div>
          <button onClick={() => fetchPatients()} className="text-xs text-red-600 hover:underline font-medium">
            Retry
          </button>
        </div>
      )}

      {/* Alert stats */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: "Critical", value: loading ? "—" : stats.critical, color: "text-red-700", bg: "bg-red-50 border-red-200", description: "Immediate action needed" },
          { label: "High Risk", value: loading ? "—" : stats.high, color: "text-orange-700", bg: "bg-orange-50 border-orange-200", description: "Close monitoring" },
          { label: "Medium Risk", value: loading ? "—" : stats.medium, color: "text-amber-700", bg: "bg-amber-50 border-amber-200", description: "Watch closely" },
          { label: "Safety Assessments Due", value: loading ? "—" : stats.safety_due, color: "text-purple-700", bg: "bg-purple-50 border-purple-200", description: "Overdue assessments" },
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
                    ? level === "all"
                      ? "bg-gray-900 text-white border-gray-900"
                      : level === "critical"
                      ? "bg-red-600 text-white border-red-600"
                      : level === "high"
                      ? "bg-orange-500 text-white border-orange-500"
                      : "bg-amber-500 text-white border-amber-500"
                    : "border-gray-200 text-gray-600 hover:bg-gray-50"
                )}
              >
                {level}
              </button>
            ))}
          </div>

          {/* Loading skeletons */}
          {loading && Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} />)}

          {/* Empty state */}
          {!loading && filteredPatients.length === 0 && (
            <div className="bg-white rounded-2xl border border-gray-200 p-8 text-center">
              <Shield className="h-10 w-10 text-gray-300 mx-auto mb-2" />
              <p className="text-gray-500 text-sm font-medium">No patients at elevated risk</p>
              <p className="text-gray-400 text-xs mt-1">
                {filterLevel !== "all" ? "Try selecting a different risk level" : "All patients are at low risk"}
              </p>
            </div>
          )}

          {!loading && filteredPatients.map((patient) => {
            const riskCfg = RISK_CONFIG[patient.risk_level];
            const isSelected = selectedPatient?.id === patient.id;

            return (
              <div
                key={patient.id}
                onClick={() => setSelectedPatient(patient)}
                className={cn(
                  "bg-white rounded-2xl border p-4 cursor-pointer transition-all",
                  isSelected
                    ? "border-[#0A2342] ring-1 ring-[#0A2342]/20 shadow-sm"
                    : `${riskCfg.border} hover:shadow-sm`
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

                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-1.5">
                        <Zap className={cn("h-3.5 w-3.5",
                          patient.radar_score >= 70 ? "text-red-500" :
                          patient.radar_score >= 50 ? "text-amber-500" : "text-blue-500"
                        )} />
                        <span className={cn("text-sm font-bold",
                          patient.radar_score >= 70 ? "text-red-600" :
                          patient.radar_score >= 50 ? "text-amber-600" : "text-blue-600"
                        )}>
                          {patient.radar_score > 0 ? patient.radar_score : "—"}
                        </span>
                      </div>
                      {patient.radar_change !== 0 && (
                        <span className={cn("text-xs font-semibold flex items-center gap-0.5",
                          patient.radar_change > 0 ? "text-red-500" : "text-emerald-500"
                        )}>
                          {patient.radar_change > 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                          {patient.radar_change > 0 ? "+" : ""}{patient.radar_change}
                        </span>
                      )}
                      <span className="text-xs text-gray-400 ml-auto">{patient.last_contact}</span>
                    </div>

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
        {selectedPatient ? (
          <div className="col-span-3 space-y-4">
            {/* Patient header */}
            <div className={cn("rounded-2xl border-2 p-5",
              RISK_CONFIG[selectedPatient.risk_level].border,
              RISK_CONFIG[selectedPatient.risk_level].bg
            )}>
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-start gap-3">
                  <div className="w-12 h-12 bg-[#0A2342] rounded-xl flex items-center justify-center text-white font-bold">
                    {getInitials(selectedPatient.name)}
                  </div>
                  <div>
                    <h2 className="font-bold text-gray-900 text-lg">{selectedPatient.name}</h2>
                    <p className="text-sm text-gray-600">
                      {selectedPatient.diagnosis}
                      {selectedPatient.age > 0 && ` · Age ${selectedPatient.age}`}
                    </p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      Next: {selectedPatient.next_session} · Last contact: {selectedPatient.last_contact}
                    </p>
                  </div>
                </div>
                {selectedPatient.radar_score > 0 && (
                  <div className="text-right">
                    <div className={cn("text-4xl font-bold",
                      selectedPatient.radar_score >= 70 ? "text-red-600" :
                      selectedPatient.radar_score >= 50 ? "text-amber-600" : "text-blue-600"
                    )}>
                      {selectedPatient.radar_score}
                    </div>
                    <div className="text-xs text-gray-500">Radar Score</div>
                    {selectedPatient.radar_change !== 0 && (
                      <div className={cn("text-xs font-bold mt-0.5",
                        selectedPatient.radar_change > 0 ? "text-red-500" : "text-emerald-500"
                      )}>
                        {selectedPatient.radar_change > 0 ? "↑ Increasing" : "↓ Decreasing"}{" "}
                        ({selectedPatient.radar_change > 0 ? "+" : ""}{selectedPatient.radar_change})
                      </div>
                    )}
                  </div>
                )}
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
            {selectedPatient.recent_signals.length > 0 && (
              <div className="bg-white rounded-2xl border border-gray-200 p-5">
                <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                  <Activity className="h-4 w-4 text-[#0A2342]" />
                  Recent Risk Signals
                </h3>
                <div className="space-y-3">
                  {selectedPatient.recent_signals.map((signal, i) => {
                    const sigCfg = SIGNAL_CONFIG[signal.type] || { icon: AlertCircle, color: "text-gray-600" };
                    const SigIcon = sigCfg.icon;
                    return (
                      <div key={i} className={cn(
                        "flex items-start gap-3 p-3 rounded-xl border",
                        signal.severity === "high" ? "bg-red-50 border-red-200" :
                        signal.severity === "medium" ? "bg-amber-50 border-amber-100" :
                        "bg-gray-50 border-gray-200"
                      )}>
                        <div className={cn("w-7 h-7 rounded-lg flex items-center justify-center shrink-0",
                          signal.severity === "high" ? "bg-red-100" :
                          signal.severity === "medium" ? "bg-amber-100" :
                          "bg-gray-100"
                        )}>
                          <SigIcon className={cn("h-3.5 w-3.5", sigCfg.color)} />
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
            )}

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
                <span className={cn("text-xs font-medium",
                  selectedPatient.crisis_plan ? "text-emerald-700" : "text-red-700"
                )}>
                  {selectedPatient.crisis_plan
                    ? "Safety plan on file"
                    : "No safety plan on file — create one"}
                </span>
                {!selectedPatient.crisis_plan && (
                  <button className="ml-auto text-xs text-red-700 font-semibold hover:underline flex items-center gap-1">
                    Create <ArrowRight className="h-3 w-3" />
                  </button>
                )}
              </div>
            </div>
          </div>
        ) : (
          !loading && (
            <div className="col-span-3 flex items-center justify-center bg-white rounded-2xl border border-gray-200 p-12">
              <div className="text-center">
                <Brain className="h-12 w-12 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-500 font-medium">Select a patient to view risk details</p>
              </div>
            </div>
          )
        )}
      </div>
    </div>
  );
}

// Reviewed: 2026-06-13 — 24Therapy audit
