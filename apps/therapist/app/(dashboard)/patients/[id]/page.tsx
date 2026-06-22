"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft, Brain, Calendar, FileText, Pill, Target,
  Clock, Activity, MessageSquare, ChevronRight, Plus,
  Video, CheckCircle2, Circle,
} from "lucide-react";
import { cn, formatDate, getRiskColor, getInitials } from "@/lib/utils";
import { patientsAPI, sessionsAPI } from "@/lib/api";

type Tab = "overview" | "sessions" | "notes" | "assessments" | "medications" | "goals" | "timeline" | "memory";

const TABS: { id: Tab; label: string; icon: React.ElementType }[] = [
  { id: "overview", label: "Overview", icon: Activity },
  { id: "sessions", label: "Sessions", icon: Calendar },
  { id: "notes", label: "Notes", icon: FileText },
  { id: "assessments", label: "Assessments", icon: Target },
  { id: "medications", label: "Medications", icon: Pill },
  { id: "goals", label: "Goals", icon: Target },
  { id: "timeline", label: "Timeline", icon: Clock },
  { id: "memory", label: "AI Memory", icon: Brain },
];

const memoryCategories: Record<string, string> = {
  relationship: "bg-pink-50 text-pink-700 border-pink-100",
  trigger: "bg-red-50 text-red-700 border-red-100",
  progress: "bg-green-50 text-green-700 border-green-100",
  preference: "bg-blue-50 text-blue-700 border-blue-100",
  pattern: "bg-purple-50 text-purple-700 border-purple-100",
};

// Best-effort name from a session/note row regardless of backend shape.
function sessionDate(s: any): string {
  return s.scheduled_at || s.date || s.created_at || null;
}

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
  const [timeline, setTimeline] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Tolerant of the API's response shapes: bare array, { data: [...] }, or a
  // single named-key wrapper like { assessments: [...] } / { memories: [...] }.
  const unwrap = (r: PromiseSettledResult<any>): any[] => {
    if (r.status !== "fulfilled") return [];
    const d = r.value;
    if (Array.isArray(d)) return d;
    if (Array.isArray(d?.data)) return d.data;
    if (d && typeof d === "object") {
      const arr = Object.values(d).find((v) => Array.isArray(v));
      if (Array.isArray(arr)) return arr;
    }
    return [];
  };

  const fetchPatient = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const [patientData, sessionsData, assessmentsData, goalsData, medsData, memoriesData, timelineData] =
        await Promise.allSettled([
          patientsAPI.get(id),
          sessionsAPI.list({ patient_id: id, limit: 50 }),
          patientsAPI.assessments(id),
          patientsAPI.goals(id),
          patientsAPI.medications(id),
          patientsAPI.memories(id),
          patientsAPI.timeline(id),
        ]);

      if (patientData.status === "fulfilled" && patientData.value) {
        const p: any = patientData.value;
        setPatient(p?.patient ?? p?.data ?? p);
      } else {
        setError("Patient not found");
      }

      setPatientSessions(unwrap(sessionsData));
      setPatientAssessments(unwrap(assessmentsData));
      setPatientGoals(unwrap(goalsData));
      setPatientMedications(unwrap(medsData));
      setPatientMemories(unwrap(memoriesData));
      setTimeline(unwrap(timelineData));
    } catch (err: any) {
      setError(err?.message || "Failed to load patient");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { fetchPatient(); }, [fetchPatient]);

  const filteredMemories = patientMemories.filter((m) =>
    memorySearch === "" || String(m.content || m.title || "").toLowerCase().includes(memorySearch.toLowerCase())
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
        <p className="text-red-600 font-medium">{error || "Patient not found"}</p>
        <Link href="/patients" className="text-primary text-sm mt-2 inline-block">← Back to patients</Link>
      </div>
    </div>
  );

  const fullName = `${patient.first_name ?? ""} ${patient.last_name ?? ""}`.trim() || patient.preferred_name || "Patient";
  const age = patient.date_of_birth
    ? Math.max(0, Math.floor((Date.now() - new Date(patient.date_of_birth).getTime()) / 31557600000))
    : null;
  const sessionsCount = patient.total_sessions ?? patientSessions.length;
  const subtitleParts = [age != null ? `${age}y` : null, patient.gender, `${sessionsCount} sessions`].filter(Boolean);
  const emergencyName = patient.emergency_contact?.name;

  return (
    <div className="flex flex-col h-full">
      {/* Patient Header */}
      <div className="bg-white border-b border-slate-200 px-6 py-4">
        <div className="flex items-start gap-4">
          <Link href="/patients" className="mt-1 text-slate-400 hover:text-slate-600 transition-colors">
            <ArrowLeft className="w-4 h-4" />
          </Link>

          <div className="w-12 h-12 bg-primary rounded-full flex items-center justify-center text-white font-bold shrink-0">
            {getInitials(fullName)}
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-lg font-bold text-slate-900">{fullName}</h1>
              {patient.risk_level && (
                <span className={cn("text-xs font-bold px-2 py-0.5 rounded-full border uppercase", getRiskColor(patient.risk_level))}>
                  {patient.risk_level} risk
                </span>
              )}
              {patient.status && (
                <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full border border-green-200 font-medium">
                  {patient.status}
                </span>
              )}
            </div>
            {subtitleParts.length > 0 && (
              <div className="text-sm text-slate-500 mt-0.5">{subtitleParts.join(" · ")}</div>
            )}
          </div>

          <div className="flex gap-2 ml-auto">
            <Link
              href="/messages"
              className="flex items-center gap-1.5 h-8 px-3 border border-slate-200 rounded-lg text-sm text-slate-600 hover:bg-slate-50"
            >
              <MessageSquare className="w-3.5 h-3.5" />
              Message
            </Link>
            <Link
              href={`/sessions/new?patient_id=${patient.id}`}
              className="flex items-center gap-1.5 h-8 px-3 bg-secondary text-white rounded-lg text-sm font-medium hover:bg-secondary/90"
            >
              <Plus className="w-3.5 h-3.5" />
              Schedule Session
            </Link>
          </div>
        </div>

        {/* Quick contact strip */}
        <div className="flex items-center gap-6 mt-4 ml-16 text-sm flex-wrap">
          {patient.last_session_at && (
            <div className="text-xs text-slate-500">
              <span className="font-semibold text-slate-800">Last session:</span> {formatDate(patient.last_session_at, "short")}
            </div>
          )}
          {patient.created_at && (
            <div className="text-xs text-slate-500">
              <span className="font-semibold text-slate-800">Enrolled:</span> {formatDate(patient.created_at, "short")}
            </div>
          )}
          {patient.email && (
            <div className="text-xs text-slate-500">
              <span className="font-semibold text-slate-800">Email:</span> {patient.email}
            </div>
          )}
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
              {/* Clinical notes */}
              <div className="bg-white rounded-xl border border-slate-200 shadow-card p-5">
                <h3 className="text-sm font-semibold text-slate-800 mb-4">Clinical Overview</h3>
                <div className="space-y-3">
                  {patient.primary_diagnosis && (
                    <div>
                      <div className="text-xs text-slate-400 font-medium mb-1">Primary Diagnosis</div>
                      <div className="text-sm font-semibold text-slate-800">{patient.primary_diagnosis}</div>
                    </div>
                  )}
                  {Array.isArray(patient.tags) && patient.tags.length > 0 && (
                    <div>
                      <div className="text-xs text-slate-400 font-medium mb-1">Tags</div>
                      <div className="flex flex-wrap gap-1">
                        {patient.tags.map((d: string) => (
                          <span key={d} className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded">{d}</span>
                        ))}
                      </div>
                    </div>
                  )}
                  <div className="pt-2 border-t border-slate-100">
                    <div className="text-xs text-slate-400 font-medium mb-1">Therapist Notes</div>
                    <p className="text-sm text-slate-700 leading-relaxed">{patient.notes || "No notes recorded yet."}</p>
                  </div>
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
                {patientSessions.length === 0 ? (
                  <p className="text-sm text-slate-400 py-4 text-center">No sessions yet.</p>
                ) : (
                  <div className="space-y-2">
                    {patientSessions.slice(0, 4).map((session) => (
                      <Link key={session.id} href={`/sessions/${session.id}`} className="flex items-start gap-3 p-3 rounded-lg hover:bg-slate-50 transition-colors">
                        <div className="w-2 h-2 rounded-full bg-green-500 mt-1.5 shrink-0" />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-0.5">
                            <span className="text-xs font-semibold text-slate-700">{sessionDate(session) ? formatDate(sessionDate(session), "short") : "—"}</span>
                            <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 capitalize">
                              {session.status}
                            </span>
                          </div>
                          <p className="text-xs text-slate-500 truncate">{session.title || session.modality || "Session"}</p>
                        </div>
                      </Link>
                    ))}
                  </div>
                )}
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
                    { label: "Date of Birth", value: patient.date_of_birth ? formatDate(patient.date_of_birth, "short") : null },
                    { label: "Pronouns", value: patient.pronouns },
                    { label: "Emergency Contact", value: emergencyName },
                  ].filter((r) => r.value).map(({ label, value }) => (
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
                {patientGoals.length === 0 ? (
                  <p className="text-xs text-slate-400 py-2">No goals set.</p>
                ) : (
                  <div className="space-y-2">
                    {patientGoals.slice(0, 4).map((goal) => (
                      <div key={goal.id} className="flex items-center gap-2">
                        {Number(goal.progress) >= 100
                          ? <CheckCircle2 className="w-3.5 h-3.5 text-green-500 shrink-0" />
                          : <Circle className="w-3.5 h-3.5 text-slate-300 shrink-0" />}
                        <div className="flex-1 min-w-0">
                          <div className="text-xs text-slate-700 truncate">{goal.title || goal.description}</div>
                          <div className="w-full bg-slate-100 rounded-full h-1 mt-1">
                            <div className="bg-secondary h-1 rounded-full" style={{ width: `${Number(goal.progress) || 0}%` }} />
                          </div>
                        </div>
                        <span className="text-[10px] text-slate-400 shrink-0">{Number(goal.progress) || 0}%</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Active Medications */}
              <div className="bg-white rounded-xl border border-slate-200 shadow-card p-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold text-slate-800">Medications</h3>
                  <button onClick={() => setActiveTab("medications")} className="text-xs text-secondary hover:underline">View all</button>
                </div>
                {patientMedications.length === 0 ? (
                  <p className="text-xs text-slate-400 py-2">No medications recorded.</p>
                ) : (
                  <div className="space-y-2">
                    {patientMedications.slice(0, 5).map((med) => (
                      <div key={med.id} className="flex items-center gap-2 p-2 rounded-lg bg-slate-50">
                        <Pill className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                        <div className="min-w-0">
                          <div className="text-xs font-medium text-slate-800 truncate">{med.name || med.medication_name}</div>
                          <div className="text-[10px] text-slate-400">{[med.dosage, med.frequency].filter(Boolean).join(" · ")}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
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
            {patientSessions.length === 0 ? (
              <div className="bg-white rounded-xl border border-slate-200 p-12 text-center text-sm text-slate-400">No sessions yet.</div>
            ) : (
              <div className="bg-white rounded-xl border border-slate-200 shadow-card overflow-hidden">
                <div className="divide-y divide-slate-50">
                  {patientSessions.map((session: any, idx: number) => (
                    <Link key={session.id} href={`/sessions/${session.id}`} className="flex items-center gap-4 px-4 py-3 hover:bg-slate-50 transition-colors group">
                      <div className="text-sm font-bold text-slate-500 w-6 shrink-0">#{patientSessions.length - idx}</div>
                      <div className="w-8 h-8 bg-slate-100 rounded-lg flex items-center justify-center shrink-0">
                        <Video className="w-4 h-4 text-slate-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-slate-800">{sessionDate(session) ? formatDate(sessionDate(session), "long") : "—"}</div>
                        <div className="text-xs text-slate-500 mt-0.5 truncate capitalize">{session.title || session.modality || session.session_type || "Session"}</div>
                      </div>
                      {session.duration_minutes ? <div className="text-xs text-slate-400">{session.duration_minutes} min</div> : null}
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full border bg-slate-50 text-slate-600 border-slate-200 capitalize">
                        {session.status}
                      </span>
                      <ChevronRight className="w-3.5 h-3.5 text-slate-300 group-hover:text-slate-500" />
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* NOTES TAB */}
        {activeTab === "notes" && (
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-slate-800">Session Notes</h3>
            {patientSessions.filter((s) => s.note_id || s.has_ai_note).length === 0 ? (
              <div className="bg-white rounded-xl border border-slate-200 p-12 text-center text-sm text-slate-400">
                No notes yet. Notes are generated after a session ends.
              </div>
            ) : (
              <div className="bg-white rounded-xl border border-slate-200 shadow-card divide-y divide-slate-50">
                {patientSessions.filter((s) => s.note_id || s.has_ai_note).map((session: any) => (
                  <div key={session.id} className="p-4">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-slate-700">{sessionDate(session) ? formatDate(sessionDate(session), "short") : "—"}</span>
                        {session.note_status && (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full uppercase bg-slate-100 text-slate-600">
                            {session.note_status}
                          </span>
                        )}
                      </div>
                      <Link href={`/notes/${session.note_id || session.id}`} className="text-xs text-secondary hover:underline">View Note</Link>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ASSESSMENTS TAB */}
        {activeTab === "assessments" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-800">Assessment History</h3>
              <Link href={`/assessments/new?patient_id=${id}`} className="flex items-center gap-1.5 h-8 px-3 bg-secondary text-white rounded-lg text-xs font-medium hover:bg-secondary/90">
                <Plus className="w-3.5 h-3.5" /> Send Assessment
              </Link>
            </div>
            {patientAssessments.length === 0 ? (
              <div className="bg-white rounded-xl border border-slate-200 p-12 text-center text-sm text-slate-400">No assessments completed yet.</div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {patientAssessments.map((a: any) => (
                  <div key={a.id} className="bg-white rounded-xl border border-slate-200 shadow-card p-4">
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <div className="text-xs font-bold text-slate-500 uppercase">{a.assessment_type || a.type || "Assessment"}</div>
                        <div className="text-sm font-semibold text-slate-800">{a.interpretation || a.severity || ""}</div>
                      </div>
                      {a.score != null && <div className="text-2xl font-bold text-slate-900">{a.score}</div>}
                    </div>
                    <div className="text-xs text-slate-400">{a.completed_at || a.created_at ? formatDate(a.completed_at || a.created_at, "short") : ""}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* MEDICATIONS TAB */}
        {activeTab === "medications" && (
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-slate-800">Medications ({patientMedications.length})</h3>
            {patientMedications.length === 0 ? (
              <div className="bg-white rounded-xl border border-slate-200 p-12 text-center text-sm text-slate-400">No medications recorded.</div>
            ) : (
              <div className="space-y-3">
                {patientMedications.map((med: any) => (
                  <div key={med.id} className="bg-white rounded-xl border border-slate-200 shadow-card p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-3">
                        <div className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0 bg-blue-100">
                          <Pill className="w-5 h-5 text-blue-600" />
                        </div>
                        <div>
                          <div className="text-sm font-semibold text-slate-800">{med.name || med.medication_name}</div>
                          <div className="text-xs text-slate-500 mt-0.5">{[med.dosage, med.frequency].filter(Boolean).join(" · ")}</div>
                          {med.prescribed_by && <div className="text-[10px] text-slate-400 mt-1">Prescribed by: {med.prescribed_by}</div>}
                        </div>
                      </div>
                      {med.status && (
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-green-100 text-green-700 uppercase">{med.status}</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* GOALS TAB */}
        {activeTab === "goals" && (
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-slate-800">Treatment Goals</h3>
            {patientGoals.length === 0 ? (
              <div className="bg-white rounded-xl border border-slate-200 p-12 text-center text-sm text-slate-400">
                No goals yet. Goals are added from the patient&apos;s treatment plan.
              </div>
            ) : (
              <div className="space-y-3">
                {patientGoals.map((goal: any) => {
                  const progress = Number(goal.progress) || 0;
                  const done = progress >= 100 || goal.status === "completed";
                  return (
                    <div key={goal.id} className={cn("bg-white rounded-xl border shadow-card p-4", done ? "border-green-200" : "border-slate-200")}>
                      <div className="flex items-start gap-3">
                        {done ? <CheckCircle2 className="w-5 h-5 text-green-500 shrink-0 mt-0.5" /> : <Circle className="w-5 h-5 text-slate-300 shrink-0 mt-0.5" />}
                        <div className="flex-1">
                          <div className="text-sm font-medium text-slate-800">{goal.title || goal.description}</div>
                          <div className="flex items-center gap-4 mt-2">
                            <div className="flex-1 bg-slate-100 rounded-full h-2 max-w-xs">
                              <div className={cn("h-2 rounded-full", done ? "bg-green-500" : "bg-secondary")} style={{ width: `${progress}%` }} />
                            </div>
                            <span className="text-xs font-semibold text-slate-600">{progress}%</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* TIMELINE TAB */}
        {activeTab === "timeline" && (
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-slate-800">Patient Timeline</h3>
            {timeline.length === 0 ? (
              <div className="bg-white rounded-xl border border-slate-200 p-12 text-center text-sm text-slate-400">No timeline events yet.</div>
            ) : (
              <div className="relative">
                <div className="absolute left-4 top-0 bottom-0 w-px bg-slate-200" />
                <div className="space-y-4">
                  {timeline.map((event: any) => (
                    <div key={event.id} className="flex items-start gap-4">
                      <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 relative z-10 bg-blue-100 text-blue-600">
                        <Activity className="w-4 h-4" />
                      </div>
                      <div className="flex-1 bg-white rounded-xl border border-slate-200 p-3 shadow-card">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-semibold text-slate-800">{event.title || event.event_type}</span>
                          <span className="text-xs text-slate-400">{event.created_at ? formatDate(event.created_at, "short") : ""}</span>
                        </div>
                        {event.description && <p className="text-xs text-slate-500 mt-1">{event.description}</p>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* AI MEMORY TAB */}
        {activeTab === "memory" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <div>
                <h3 className="text-sm font-semibold text-slate-800">AI Patient Memory</h3>
                <p className="text-xs text-slate-500 mt-0.5">Longitudinal intelligence extracted from sessions. Therapist-controlled and permission-gated.</p>
              </div>
              {patientMemories.length > 0 && (
                <div className="relative">
                  <Brain className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Search memories..."
                    value={memorySearch}
                    onChange={(e) => setMemorySearch(e.target.value)}
                    className="h-8 pl-8 pr-3 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-secondary/40 w-64"
                  />
                </div>
              )}
            </div>

            {filteredMemories.length === 0 ? (
              <div className="bg-white rounded-xl border border-slate-200 p-12 text-center text-sm text-slate-400">
                No AI memories yet. Memories are extracted automatically as sessions are completed.
              </div>
            ) : (
              <div className="space-y-3">
                {filteredMemories.map((memory: any) => (
                  <div key={memory.id} className="bg-white rounded-xl border border-slate-200 shadow-card p-4">
                    <div className="flex items-center gap-2 mb-2">
                      {memory.category && (
                        <span className={cn("text-[10px] font-bold px-2 py-0.5 rounded-full border capitalize", memoryCategories[memory.category] || "bg-slate-50 text-slate-600 border-slate-100")}>
                          {memory.category}
                        </span>
                      )}
                      {(memory.importance === "high" || Number(memory.importance) >= 8) && (
                        <span className="text-[10px] font-bold text-amber-600">High importance</span>
                      )}
                    </div>
                    <p className="text-sm text-slate-800 leading-relaxed">{memory.content || memory.title}</p>
                    {(memory.created_at || memory.date) && (
                      <div className="mt-2 text-[10px] text-slate-400">{formatDate(memory.created_at || memory.date, "short")}</div>
                    )}
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

// Reviewed: 2026-06-22 — rewired to real patient API data; removed mock-shape crashes
