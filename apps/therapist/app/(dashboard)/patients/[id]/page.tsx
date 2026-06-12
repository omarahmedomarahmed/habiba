"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft, Brain, Calendar, FileText, AlertTriangle, Pill, Target,
  Clock, Activity, MessageSquare, ChevronRight, Plus, MoreHorizontal,
  TrendingDown, TrendingUp, Minus, Video, Download, Edit3, Upload,
  CheckCircle2, Circle, Flag, Bookmark, ExternalLink
} from "lucide-react";
import { cn, formatDate, getRiskColor, getInitials } from "@/lib/utils";
import { patientsAPI, sessionsAPI } from "@/lib/api";

type Tab = "overview" | "sessions" | "notes" | "assessments" | "medications" | "goals" | "timeline" | "files" | "memory" | "reports";

const TABS: { id: Tab; label: string; icon: React.ElementType }[] = [
  { id: "overview", label: "Overview", icon: Activity },
  { id: "sessions", label: "Sessions", icon: Calendar },
  { id: "notes", label: "Notes", icon: FileText },
  { id: "assessments", label: "Assessments", icon: Target },
  { id: "medications", label: "Medications", icon: Pill },
  { id: "goals", label: "Goals", icon: Target },
  { id: "timeline", label: "Timeline", icon: Clock },
  { id: "files", label: "Files", icon: Upload },
  { id: "memory", label: "AI Memory", icon: Brain },
  { id: "reports", label: "Reports", icon: Download },
];


const memoryCategories: Record<string, string> = {
  relationship: "bg-pink-50 text-pink-700 border-pink-100",
  trigger: "bg-red-50 text-red-700 border-red-100",
  progress: "bg-green-50 text-green-700 border-green-100",
  preference: "bg-blue-50 text-blue-700 border-blue-100",
  pattern: "bg-purple-50 text-purple-700 border-purple-100",
};

export default function PatientProfilePage() {
  const { id } = useParams<{ id: string }>();
  const [activeTab, setActiveTab] = useState<Tab>("overview");
  const [memorySearch, setMemorySearch] = useState("");
  const [patient, setPatient] = useState<any>(null);
  const [patientSessions, setPatientSessions] = useState<any[]>([]);
  const [patientAssessments, setPatientAssessments] = useState<any[]>([]);
  const [patientGoals, setPatientGoals] = useState<any[]>([]);
  const [patientMedications, setPatientMedications] = useState<any[]>([]);
  const [patientMemories, setPatientMemories] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchPatient = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const [patientData, sessionsData, assessmentsData, goalsData, medsData, memoriesData] = await Promise.allSettled([
        patientsAPI.get(id),
        sessionsAPI.list({ patient_id: id, limit: 20 }),
        patientsAPI.assessments(id),
        patientsAPI.goals(id),
        patientsAPI.medications(id),
        patientsAPI.memories(id),
      ]);

      if (patientData.status === 'fulfilled') setPatient(patientData.value);
      else setError('Patient not found');

      if (sessionsData.status === 'fulfilled') {
        const d = sessionsData.value as any;
        setPatientSessions(Array.isArray(d) ? d : d?.data ?? []);
      }
      if (assessmentsData.status === 'fulfilled') {
        const d = assessmentsData.value as any;
        setPatientAssessments(Array.isArray(d) ? d : d?.data ?? []);
      }
      if (goalsData.status === 'fulfilled') {
        const d = goalsData.value as any;
        setPatientGoals(Array.isArray(d) ? d : d?.data ?? []);
      }
      if (medsData.status === 'fulfilled') {
        const d = medsData.value as any;
        setPatientMedications(Array.isArray(d) ? d : d?.data ?? []);
      }
      if (memoriesData.status === 'fulfilled') {
        const d = memoriesData.value as any;
        setPatientMemories(Array.isArray(d) ? d : d?.data ?? []);
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to load patient');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { fetchPatient(); }, [fetchPatient]);

  const filteredMemories = patientMemories.filter((m) =>
    memorySearch === "" || (m.content || m.title || "").toLowerCase().includes(memorySearch.toLowerCase())
  );

  if (loading) return (
    <div className="flex items-center justify-center h-full">
      <div className="text-center">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-3" />
        <p className="text-slate-500 text-sm">Loading patient...</p>
      </div>
    </div>
  );

  if (error || !patient) return (
    <div className="flex items-center justify-center h-full">
      <div className="text-center">
        <p className="text-red-600 font-medium">{error || 'Patient not found'}</p>
        <Link href="/patients" className="text-primary text-sm mt-2 inline-block">← Back to patients</Link>
      </div>
    </div>
  );

  return (
    <div className="flex flex-col h-full">
      {/* Patient Header */}
      <div className="bg-white border-b border-slate-200 px-6 py-4">
        <div className="flex items-start gap-4">
          <Link href="/patients" className="mt-1 text-slate-400 hover:text-slate-600 transition-colors">
            <ArrowLeft className="w-4 h-4" />
          </Link>

          <div className="w-12 h-12 bg-primary rounded-full flex items-center justify-center text-white font-bold shrink-0">
            {getInitials(`${patient.first_name} ${patient.last_name}`)}
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-lg font-bold text-slate-900">
                {patient.first_name} {patient.last_name}
              </h1>
              <span className={cn("text-xs font-bold px-2 py-0.5 rounded-full border uppercase", getRiskColor(patient.risk_level))}>
                {patient.risk_level} risk
              </span>
              <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full border border-green-200 font-medium">
                {patient.status}
              </span>
            </div>
            <div className="text-sm text-slate-500 mt-0.5">
              {patient.age}y · {patient.gender} · {patient.primary_diagnosis.split(" (")[0]} · {patient.sessions_count} sessions
            </div>
          </div>

          <div className="flex gap-2 ml-auto">
            <button className="flex items-center gap-1.5 h-8 px-3 border border-slate-200 rounded-lg text-sm text-slate-600 hover:bg-slate-50">
              <MessageSquare className="w-3.5 h-3.5" />
              Message
            </button>
            <Link
              href={`/sessions/new?patient_id=${patient.id}`}
              className="flex items-center gap-1.5 h-8 px-3 bg-secondary text-white rounded-lg text-sm font-medium hover:bg-secondary/90"
            >
              <Plus className="w-3.5 h-3.5" />
              Schedule Session
            </Link>
            <button className="h-8 w-8 flex items-center justify-center border border-slate-200 rounded-lg text-slate-400 hover:bg-slate-50">
              <MoreHorizontal className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Quick Stats */}
        <div className="flex items-center gap-6 mt-4 ml-16 text-sm">
          <div className="flex items-center gap-1.5">
            <div className={cn("text-lg font-bold", patient.phq9_change < 0 ? "text-green-600" : "text-red-600")}>
              {patient.phq9_score}
            </div>
            <div>
              <div className="text-[10px] text-slate-400 font-medium">PHQ-9</div>
              <div className={cn("text-[10px] font-semibold flex items-center gap-0.5", patient.phq9_change < 0 ? "text-green-600" : "text-red-600")}>
                {patient.phq9_change < 0 ? <TrendingDown className="w-3 h-3" /> : <TrendingUp className="w-3 h-3" />}
                {Math.abs(patient.phq9_change)} pts
              </div>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="text-lg font-bold text-green-600">{patient.gad7_score}</div>
            <div>
              <div className="text-[10px] text-slate-400 font-medium">GAD-7</div>
              <div className="text-[10px] font-semibold text-green-600 flex items-center gap-0.5">
                <TrendingDown className="w-3 h-3" />{Math.abs(patient.gad7_change)} pts
              </div>
            </div>
          </div>
          <div className="h-8 w-px bg-slate-200" />
          <div className="text-xs text-slate-500">
            <span className="font-semibold text-slate-800">Last session:</span> {formatDate(patient.last_session, "short")}
          </div>
          <div className="text-xs text-slate-500">
            <span className="font-semibold text-slate-800">Next:</span>{" "}
            {patient.next_session ? formatDate(patient.next_session, "short") : "Not scheduled"}
          </div>
          <div className="text-xs text-slate-500">
            <span className="font-semibold text-slate-800">Enrolled:</span> {formatDate(patient.enrolled_since, "short")}
          </div>
          <div className="ml-auto">
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-500">Goals Progress</span>
              <div className="w-20 bg-slate-100 rounded-full h-1.5">
                <div className="bg-green-500 h-1.5 rounded-full" style={{ width: `${patient.goals_progress}%` }} />
              </div>
              <span className="text-xs font-semibold text-slate-800">{patient.goals_progress}%</span>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white border-b border-slate-200 px-6">
        <div className="flex gap-1 overflow-x-auto -mb-px">
          {TABS.map(({ id: tabId, label, icon: Icon }) => (
            <button
              key={tabId}
              onClick={() => setActiveTab(tabId)}
              className={cn(
                "flex items-center gap-1.5 px-3 py-3 text-xs font-medium border-b-2 transition-colors whitespace-nowrap shrink-0",
                activeTab === tabId
                  ? "border-secondary text-secondary"
                  : "border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300"
              )}
            >
              <Icon className="w-3.5 h-3.5" />
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-auto p-6">
        {/* OVERVIEW TAB */}
        {activeTab === "overview" && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-4">
              {/* Primary Info */}
              <div className="bg-white rounded-xl border border-slate-200 shadow-card p-5">
                <h3 className="text-sm font-semibold text-slate-800 mb-4">Clinical Overview</h3>
                <div className="space-y-3">
                  <div>
                    <div className="text-xs text-slate-400 font-medium mb-1">Primary Diagnosis</div>
                    <div className="text-sm font-semibold text-slate-800">{patient.primary_diagnosis}</div>
                  </div>
                  {patient.secondary_diagnoses.length > 0 && (
                    <div>
                      <div className="text-xs text-slate-400 font-medium mb-1">Secondary</div>
                      <div className="flex flex-wrap gap-1">
                        {(patient.secondary_diagnoses || []).map((d: string) => (
                          <span key={d} className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded">{d}</span>
                        ))}
                      </div>
                    </div>
                  )}
                  <div className="pt-2 border-t border-slate-100">
                    <div className="text-xs text-slate-400 font-medium mb-1">Therapist Notes</div>
                    <p className="text-sm text-slate-700 leading-relaxed">{patient.notes}</p>
                  </div>
                </div>
              </div>

              {/* Assessment Scores */}
              <div className="bg-white rounded-xl border border-slate-200 shadow-card p-5">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-semibold text-slate-800">Latest Assessment Scores</h3>
                  <button
                    onClick={() => setActiveTab("assessments")}
                    className="text-xs text-secondary hover:underline flex items-center gap-1"
                  >
                    Send Assessment <ChevronRight className="w-3 h-3" />
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  {[
                    { name: "PHQ-9", score: patient.phq9_score, max: 27, label: "Moderate Depression", change: patient.phq9_change, color: "bg-amber-500" },
                    { name: "GAD-7", score: patient.gad7_score, max: 21, label: "Mild Anxiety", change: patient.gad7_change, color: "bg-blue-500" },
                  ].map(({ name, score, max, label, change, color }) => (
                    <div key={name} className="border border-slate-100 rounded-lg p-3">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-bold text-slate-600">{name}</span>
                        <span className={cn(
                          "text-[10px] font-semibold flex items-center gap-0.5",
                          change < 0 ? "text-green-600" : change > 0 ? "text-red-600" : "text-slate-500"
                        )}>
                          {change < 0 ? <TrendingDown className="w-3 h-3" /> : change > 0 ? <TrendingUp className="w-3 h-3" /> : <Minus className="w-3 h-3" />}
                          {Math.abs(change)} pts
                        </span>
                      </div>
                      <div className="text-2xl font-bold text-slate-900">{score}<span className="text-sm text-slate-400">/{max}</span></div>
                      <div className="text-xs text-slate-500 mb-2">{label}</div>
                      <div className="w-full bg-slate-100 rounded-full h-1.5">
                        <div className={cn("h-1.5 rounded-full", color)} style={{ width: `${(score / max) * 100}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Recent Sessions */}
              <div className="bg-white rounded-xl border border-slate-200 shadow-card p-5">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-semibold text-slate-800">Recent Sessions</h3>
                  <button onClick={() => setActiveTab("sessions")} className="text-xs text-secondary hover:underline">
                    View all
                  </button>
                </div>
                <div className="space-y-2">
                  {patientSessions.slice(0, 3).map((session) => (
                    <div key={session.id} className="flex items-start gap-3 p-3 rounded-lg hover:bg-slate-50 transition-colors">
                      <div className="w-2 h-2 rounded-full bg-green-500 mt-1.5 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className="text-xs font-semibold text-slate-700">{formatDate(session.date, "short")}</span>
                          <span className={cn(
                            "text-[10px] font-medium px-1.5 py-0.5 rounded",
                            session.note_status === "approved" ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700"
                          )}>
                            {session.note_status}
                          </span>
                        </div>
                        <p className="text-xs text-slate-500 truncate">{session.summary}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Right Column */}
            <div className="space-y-4">
              {/* Contact & Demographics */}
              <div className="bg-white rounded-xl border border-slate-200 shadow-card p-4">
                <h3 className="text-sm font-semibold text-slate-800 mb-3">Patient Details</h3>
                <div className="space-y-2.5">
                  {[
                    { label: "Email", value: patient.email },
                    { label: "Phone", value: patient.phone },
                    { label: "Date of Birth", value: formatDate(patient.dob, "short") },
                    { label: "Timezone", value: patient.timezone },
                    { label: "Insurance", value: patient.insurance },
                    { label: "Emergency Contact", value: patient.emergency_contact.name },
                  ].map(({ label, value }) => (
                    <div key={label}>
                      <div className="text-[10px] text-slate-400 font-medium uppercase tracking-wide">{label}</div>
                      <div className="text-xs text-slate-700 mt-0.5">{value}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Goals Summary */}
              <div className="bg-white rounded-xl border border-slate-200 shadow-card p-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold text-slate-800">Treatment Goals</h3>
                  <button onClick={() => setActiveTab("goals")} className="text-xs text-secondary hover:underline">View all</button>
                </div>
                <div className="space-y-2">
                  {patientGoals.filter((g: any) => g.status === "active").slice(0, 3).map((goal) => (
                    <div key={goal.id} className="flex items-center gap-2">
                      {goal.progress === 100
                        ? <CheckCircle2 className="w-3.5 h-3.5 text-green-500 shrink-0" />
                        : <Circle className="w-3.5 h-3.5 text-slate-300 shrink-0" />
                      }
                      <div className="flex-1 min-w-0">
                        <div className="text-xs text-slate-700 truncate">{goal.title}</div>
                        <div className="w-full bg-slate-100 rounded-full h-1 mt-1">
                          <div
                            className="bg-secondary h-1 rounded-full"
                            style={{ width: `${goal.progress}%` }}
                          />
                        </div>
                      </div>
                      <span className="text-[10px] text-slate-400 shrink-0">{goal.progress}%</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Active Medications */}
              <div className="bg-white rounded-xl border border-slate-200 shadow-card p-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold text-slate-800">Medications</h3>
                  <button onClick={() => setActiveTab("medications")} className="text-xs text-secondary hover:underline">View all</button>
                </div>
                <div className="space-y-2">
                  {patientMedications.filter((m: any) => m.status === "active").map((med) => (
                    <div key={med.id} className="flex items-center gap-2 p-2 rounded-lg bg-slate-50">
                      <Pill className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                      <div className="min-w-0">
                        <div className="text-xs font-medium text-slate-800 truncate">{med.name}</div>
                        <div className="text-[10px] text-slate-400">{med.dosage} · {med.frequency}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* SESSIONS TAB */}
        {activeTab === "sessions" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-800">All Sessions ({patientSessions.length})</h3>
              <Link href={`/sessions/new?patient_id=${id}`} className="flex items-center gap-1.5 h-8 px-3 bg-secondary text-white rounded-lg text-xs font-medium hover:bg-secondary/90">
                <Plus className="w-3.5 h-3.5" /> Schedule
              </Link>
            </div>
            <div className="bg-white rounded-xl border border-slate-200 shadow-card overflow-hidden">
              <div className="divide-y divide-slate-50">
                {patientSessions.map((session: any, idx: number) => (
                  <Link
                    key={session.id}
                    href={`/sessions/${session.id}`}
                    className="flex items-center gap-4 px-4 py-3 hover:bg-slate-50 transition-colors group"
                  >
                    <div className="text-sm font-bold text-slate-500 w-6 shrink-0">#{patientSessions.length - idx}</div>
                    <div className="w-8 h-8 bg-slate-100 rounded-lg flex items-center justify-center shrink-0">
                      <Video className="w-4 h-4 text-slate-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-slate-800">{formatDate(session.date, "long")}</div>
                      <div className="text-xs text-slate-500 mt-0.5 truncate">{session.summary}</div>
                    </div>
                    <div className="text-xs text-slate-400">{session.duration} min</div>
                    <span className={cn(
                      "text-[10px] font-semibold px-2 py-0.5 rounded-full border",
                      session.note_status === "approved" ? "bg-green-50 text-green-700 border-green-200" : "bg-amber-50 text-amber-700 border-amber-200"
                    )}>
                      {session.note_status}
                    </span>
                    <ChevronRight className="w-3.5 h-3.5 text-slate-300 group-hover:text-slate-500" />
                  </Link>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ASSESSMENTS TAB */}
        {activeTab === "assessments" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-800">Assessment History</h3>
              <button className="flex items-center gap-1.5 h-8 px-3 bg-secondary text-white rounded-lg text-xs font-medium hover:bg-secondary/90">
                <Plus className="w-3.5 h-3.5" /> Send Assessment
              </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {patientAssessments.map((assessment: any) => (
                <div key={assessment.id} className="bg-white rounded-xl border border-slate-200 shadow-card p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <div className="text-xs font-bold text-slate-500 uppercase">{assessment.type}</div>
                      <div className="text-sm font-semibold text-slate-800">{assessment.interpretation}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-2xl font-bold text-slate-900">{assessment.score}</div>
                      <div className={cn(
                        "text-[10px] font-semibold flex items-center justify-end gap-0.5",
                        assessment.change < 0 ? "text-green-600" : "text-red-600"
                      )}>
                        {assessment.change < 0 ? <TrendingDown className="w-3 h-3" /> : <TrendingUp className="w-3 h-3" />}
                        {Math.abs(assessment.change)} pts
                      </div>
                    </div>
                  </div>
                  <div className="text-xs text-slate-400">{formatDate(assessment.date, "short")}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* MEDICATIONS TAB */}
        {activeTab === "medications" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-800">Medications ({patientMedications.length})</h3>
              <button className="flex items-center gap-1.5 h-8 px-3 bg-secondary text-white rounded-lg text-xs font-medium hover:bg-secondary/90">
                <Plus className="w-3.5 h-3.5" /> Add Medication
              </button>
            </div>
            <div className="space-y-3">
              {patientMedications.map((med: any) => (
                <div key={med.id} className="bg-white rounded-xl border border-slate-200 shadow-card p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3">
                      <div className={cn(
                        "w-10 h-10 rounded-lg flex items-center justify-center shrink-0",
                        med.status === "active" ? "bg-blue-100" : "bg-slate-100"
                      )}>
                        <Pill className={cn("w-5 h-5", med.status === "active" ? "text-blue-600" : "text-slate-400")} />
                      </div>
                      <div>
                        <div className="text-sm font-semibold text-slate-800">{med.name}</div>
                        <div className="text-xs text-slate-500 mt-0.5">{med.dosage} · {med.frequency}</div>
                        <div className="text-[10px] text-slate-400 mt-1">Prescribed by: {med.prescribed_by}</div>
                        <div className="text-[10px] text-slate-400">For: {med.reason}</div>
                      </div>
                    </div>
                    <span className={cn(
                      "text-[10px] font-semibold px-2 py-0.5 rounded-full",
                      med.status === "active" ? "bg-green-100 text-green-700" :
                      med.status === "paused" ? "bg-amber-100 text-amber-700" : "bg-slate-100 text-slate-500"
                    )}>
                      {med.status.toUpperCase()}
                    </span>
                  </div>
                  <div className="mt-3 pt-3 border-t border-slate-100 flex items-center gap-4 text-xs text-slate-400">
                    <span>Started: {formatDate(med.start_date, "short")}</span>
                    <button className="flex items-center gap-1 text-secondary hover:underline ml-auto">
                      <Edit3 className="w-3 h-3" /> Edit
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* GOALS TAB */}
        {activeTab === "goals" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-800">Treatment Goals</h3>
              <button className="flex items-center gap-1.5 h-8 px-3 bg-secondary text-white rounded-lg text-xs font-medium hover:bg-secondary/90">
                <Plus className="w-3.5 h-3.5" /> Add Goal
              </button>
            </div>
            <div className="space-y-3">
              {patientGoals.map((goal: any) => (
                <div key={goal.id} className={cn("bg-white rounded-xl border shadow-card p-4", goal.status === "completed" ? "border-green-200 opacity-75" : "border-slate-200")}>
                  <div className="flex items-start gap-3">
                    {goal.status === "completed"
                      ? <CheckCircle2 className="w-5 h-5 text-green-500 shrink-0 mt-0.5" />
                      : <Circle className="w-5 h-5 text-slate-300 shrink-0 mt-0.5" />
                    }
                    <div className="flex-1">
                      <div className="text-sm font-medium text-slate-800">{goal.title}</div>
                      <div className="flex items-center gap-4 mt-2">
                        <div className="flex-1 bg-slate-100 rounded-full h-2 max-w-xs">
                          <div
                            className={cn("h-2 rounded-full", goal.status === "completed" ? "bg-green-500" : "bg-secondary")}
                            style={{ width: `${goal.progress}%` }}
                          />
                        </div>
                        <span className="text-xs font-semibold text-slate-600">{goal.progress}%</span>
                      </div>
                      <div className="flex items-center gap-3 mt-1 text-[10px] text-slate-400">
                        <span>Target: {formatDate(goal.target_date, "short")}</span>
                        <span>{goal.sessions_count} sessions</span>
                        <span className="capitalize">{goal.category.replace("_", " ")}</span>
                      </div>
                    </div>
                    <button className="text-xs text-secondary hover:underline">Update</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TIMELINE TAB */}
        {activeTab === "timeline" && (
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-slate-800">Patient Timeline</h3>
            <div className="relative">
              <div className="absolute left-4 top-0 bottom-0 w-px bg-slate-200" />
              <div className="space-y-4">
                {patientSessions.map((event: any) => {
                  const Icon = event.icon;
                  const colorMap: Record<string, string> = {
                    session: "bg-blue-100 text-blue-600",
                    assessment: "bg-purple-100 text-purple-600",
                    milestone: "bg-green-100 text-green-600",
                    medication: "bg-amber-100 text-amber-600",
                    life_event: "bg-pink-100 text-pink-600",
                  };
                  return (
                    <div key={event.id} className="flex items-start gap-4 ml-0 pl-0">
                      <div className={cn("w-8 h-8 rounded-full flex items-center justify-center shrink-0 relative z-10", colorMap[event.type] || "bg-slate-100 text-slate-500")}>
                        <Icon className="w-4 h-4" />
                      </div>
                      <div className="flex-1 bg-white rounded-xl border border-slate-200 p-3 shadow-card">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-semibold text-slate-800">{event.title}</span>
                          <span className="text-xs text-slate-400">{formatDate(event.date, "short")}</span>
                        </div>
                        <p className="text-xs text-slate-500 mt-1">{event.detail}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* AI MEMORY TAB */}
        {activeTab === "memory" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold text-slate-800">AI Patient Memory</h3>
                <p className="text-xs text-slate-500 mt-0.5">Longitudinal intelligence extracted from all sessions. Therapist-controlled and permission-gated.</p>
              </div>
              <div className="flex gap-2">
                <div className="relative">
                  <Brain className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Semantic search memories..."
                    value={memorySearch}
                    onChange={(e) => setMemorySearch(e.target.value)}
                    className="h-8 pl-8 pr-3 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-secondary/40 w-64"
                  />
                </div>
              </div>
            </div>

            <div className="bg-gradient-to-r from-primary/5 to-secondary/5 rounded-xl border border-secondary/20 p-4 text-sm text-slate-700">
              <div className="flex items-start gap-2">
                <Brain className="w-4 h-4 text-secondary mt-0.5 shrink-0" />
                <div>
                  <strong>AI Summary:</strong> Sarah shows consistent improvement in anxiety management over 24 sessions. Key pattern: performance-based self-worth tied to childhood emotional unavailability. Strong responder to Socratic questioning. Seasonal mood dips in winter — monitor December-February. Lexapro has been effective at 10mg.
                </div>
              </div>
            </div>

            <div className="space-y-3">
              {filteredMemories.map((memory) => (
                <div key={memory.id} className="bg-white rounded-xl border border-slate-200 shadow-card p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <span className={cn("text-[10px] font-bold px-2 py-0.5 rounded-full border capitalize", memoryCategories[memory.category])}>
                          {memory.category}
                        </span>
                        {memory.importance === "high" && (
                          <span className="text-[10px] font-bold text-amber-600 flex items-center gap-0.5">
                            <Bookmark className="w-3 h-3" /> High Importance
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-slate-800 leading-relaxed">{memory.content}</p>
                      <div className="flex items-center gap-3 mt-2 text-[10px] text-slate-400">
                        <span>From: {memory.created_from_session}</span>
                        <span>·</span>
                        <span>{formatDate(memory.date, "short")}</span>
                      </div>
                    </div>
                    <button className="text-slate-300 hover:text-slate-500">
                      <MoreHorizontal className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* FILES TAB */}
        {activeTab === "files" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-800">Patient Files</h3>
              <button className="flex items-center gap-1.5 h-8 px-3 bg-secondary text-white rounded-lg text-xs font-medium hover:bg-secondary/90">
                <Upload className="w-3.5 h-3.5" /> Upload File
              </button>
            </div>
            <div className="bg-white rounded-xl border border-slate-200 border-dashed p-12 text-center">
              <Upload className="w-8 h-8 text-slate-300 mx-auto mb-2" />
              <p className="text-sm text-slate-500">Drop files here or click to upload</p>
              <p className="text-xs text-slate-400 mt-1">PDFs, images, and documents supported</p>
            </div>
          </div>
        )}

        {/* REPORTS TAB */}
        {activeTab === "reports" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-800">Clinical Reports</h3>
              <button className="flex items-center gap-1.5 h-8 px-3 bg-secondary text-white rounded-lg text-xs font-medium hover:bg-secondary/90">
                <Plus className="w-3.5 h-3.5" /> Generate Report
              </button>
            </div>
            <div className="grid grid-cols-3 gap-4">
              {[
                { title: "Progress Report", desc: "Comprehensive clinical summary with assessment trends", icon: TrendingUp },
                { title: "Treatment Plan", desc: "Structured treatment goals and interventions", icon: Target },
                { title: "Insurance Summary", desc: "Documentation for insurance billing and authorization", icon: FileText },
                { title: "Referral Letter", desc: "Formal referral to specialist or co-provider", icon: ExternalLink },
                { title: "Discharge Summary", desc: "End-of-treatment clinical summary", icon: CheckCircle2 },
                { title: "Custom Report", desc: "Build a custom report from available data", icon: Edit3 },
              ].map(({ title, desc, icon: Icon }) => (
                <button key={title} className="bg-white rounded-xl border border-slate-200 p-4 text-left hover:border-secondary/40 hover:shadow-card-hover transition-all group">
                  <Icon className="w-6 h-6 text-secondary mb-2 group-hover:scale-110 transition-transform" />
                  <div className="text-sm font-semibold text-slate-800">{title}</div>
                  <div className="text-xs text-slate-500 mt-1">{desc}</div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* NOTES TAB */}
        {activeTab === "notes" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-800">Session Notes</h3>
              <div className="flex gap-2">
                <button className="flex items-center gap-1.5 h-8 px-3 border border-slate-200 rounded-lg text-xs text-slate-600 hover:bg-slate-50">
                  <Filter className="w-3.5 h-3.5" /> Filter
                </button>
              </div>
            </div>
            <div className="bg-white rounded-xl border border-slate-200 shadow-card divide-y divide-slate-50">
              {patientSessions.map((session: any, idx: number) => (
                <div key={session.id} className="p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-slate-700">{formatDate(session.date, "short")}</span>
                      <span className={cn(
                        "text-[10px] font-bold px-2 py-0.5 rounded-full uppercase",
                        session.note_status === "approved" ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700"
                      )}>
                        {session.note_status}
                      </span>
                      <span className="text-[10px] bg-slate-100 text-slate-500 px-2 py-0.5 rounded font-medium">SOAP</span>
                    </div>
                    <Link href={`/notes/${session.id}`} className="text-xs text-secondary hover:underline">View Note</Link>
                  </div>
                  <p className="text-xs text-slate-600 leading-relaxed">{session.summary}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// Missing import that TypeScript would need
function Filter({ className }: { className?: string }) {
  return (
    <svg className={className} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"></polygon>
    </svg>
  );
}
