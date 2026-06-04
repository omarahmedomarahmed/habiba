"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft, Brain, Calendar, FileText, AlertTriangle, Pill, Target,
  Clock, Activity, MessageSquare, ChevronRight, Plus, MoreHorizontal,
  TrendingDown, TrendingUp, Minus, Video, Download, Edit3, Upload,
  CheckCircle2, Circle, Flag, Bookmark, ExternalLink
} from "lucide-react";
import { cn, formatDate, getRiskColor, getInitials } from "@/lib/utils";

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

// Mock patient data
const MOCK_PATIENT = {
  id: "p1",
  first_name: "Sarah",
  last_name: "Chen",
  email: "sarah.c@email.com",
  phone: "+1 (555) 234-5678",
  dob: "1991-05-14",
  age: 34,
  gender: "Female",
  timezone: "America/New_York",
  status: "active",
  risk_level: "medium",
  primary_diagnosis: "Major Depressive Disorder, Moderate (F32.1)",
  secondary_diagnoses: ["Generalized Anxiety Disorder (F41.1)"],
  enrolled_since: "2024-08-10",
  therapist_name: "Dr. Alex Smith",
  sessions_count: 24,
  last_session: "2025-12-15",
  next_session: "2025-12-22",
  emergency_contact: { name: "Lisa Chen (Sister)", phone: "+1 (555) 876-5432" },
  insurance: "BlueCross BlueShield – Policy #BCB-293847",
  goals_progress: 65,
  phq9_score: 13,
  phq9_change: -4,
  gad7_score: 8,
  gad7_change: -2,
  notes: "Patient has shown consistent improvement in mood management skills. Reports better sleep patterns since starting Lexapro. Ongoing work with cognitive distortions related to perfectionism.",
};

const MOCK_SESSIONS = [
  { id: "s1", date: "2025-12-15", time: "10:00 AM", duration: 50, status: "completed", note_status: "approved", summary: "Discussed work-related anxiety triggers and developed coping strategies. Patient reported improved sleep." },
  { id: "s2", date: "2025-12-08", time: "10:00 AM", duration: 50, status: "completed", note_status: "approved", summary: "Explored childhood patterns contributing to current perfectionism. Homework: thought records." },
  { id: "s3", date: "2025-12-01", time: "10:00 AM", duration: 50, status: "completed", note_status: "draft", summary: "Medication check-in. Lexapro dosage maintained. Discussed social avoidance behaviors." },
  { id: "s4", date: "2025-11-24", time: "10:00 AM", duration: 50, status: "completed", note_status: "approved", summary: "Grief work related to recent loss. Validated emotions, introduced grief stages framework." },
];

const MOCK_ASSESSMENTS = [
  { id: "a1", type: "PHQ-9", name: "Patient Health Questionnaire-9", score: 13, interpretation: "Moderate Depression", date: "2025-12-15", previous_score: 17, change: -4 },
  { id: "a2", type: "GAD-7", name: "Generalized Anxiety Disorder-7", score: 8, interpretation: "Mild Anxiety", date: "2025-12-15", previous_score: 10, change: -2 },
  { id: "a3", type: "PHQ-9", name: "Patient Health Questionnaire-9", score: 17, interpretation: "Moderately Severe", date: "2025-11-01", previous_score: 19, change: -2 },
];

const MOCK_MEDICATIONS = [
  { id: "m1", name: "Lexapro (Escitalopram)", dosage: "10mg", frequency: "Once daily in the morning", status: "active", prescribed_by: "Dr. Jennifer Walsh, MD (Psychiatrist)", start_date: "2024-09-01", reason: "Major Depressive Disorder, Anxiety" },
  { id: "m2", name: "Melatonin", dosage: "5mg", frequency: "30 minutes before bed as needed", status: "active", prescribed_by: "Self-initiated / GP-approved", start_date: "2024-10-15", reason: "Sleep difficulties" },
  { id: "m3", name: "Ativan (Lorazepam)", dosage: "0.5mg", frequency: "As needed for acute anxiety (max 2x/week)", status: "paused", prescribed_by: "Dr. Jennifer Walsh, MD", start_date: "2024-08-20", reason: "Acute anxiety episodes" },
];

const MOCK_GOALS = [
  { id: "g1", title: "Reduce PHQ-9 below 9 (minimal depression)", category: "symptom_reduction", progress: 52, status: "active", target_date: "2026-03-01", sessions_count: 14 },
  { id: "g2", title: "Develop 5 healthy coping strategies for anxiety", category: "skills", progress: 80, status: "active", target_date: "2026-01-15", sessions_count: 8 },
  { id: "g3", title: "Improve sleep quality — 7+ hours/night consistently", category: "behavioral", progress: 70, status: "active", target_date: "2025-12-31", sessions_count: 6 },
  { id: "g4", title: "Re-engage with social activities (2x/week)", category: "behavioral", progress: 40, status: "active", target_date: "2026-02-01", sessions_count: 4 },
  { id: "g5", title: "Complete CBT thought records for 4 weeks", category: "homework", progress: 100, status: "completed", target_date: "2025-11-15", sessions_count: 3 },
];

const MOCK_MEMORIES = [
  { id: "mem1", category: "relationship", content: "Patient's father was emotionally unavailable during childhood. Strong impact on current self-worth and need for external validation.", created_from_session: "Session #8", date: "2024-11-15", importance: "high" },
  { id: "mem2", category: "trigger", content: "Work performance evaluations trigger acute anxiety. Root cause: perfectionist standards + fear of abandonment.", created_from_session: "Session #12", date: "2024-12-08", importance: "high" },
  { id: "mem3", category: "progress", content: "Patient has shown significant improvement in cognitive reframing since Session #15. Now able to identify cognitive distortions independently.", created_from_session: "Session #18", date: "2025-02-10", importance: "medium" },
  { id: "mem4", category: "preference", content: "Responds well to Socratic questioning. Does not respond well to direct advice. Prefers to arrive at insights independently.", created_from_session: "Session #6", date: "2024-10-30", importance: "medium" },
  { id: "mem5", category: "pattern", content: "Seasonal mood worsening consistently observed in November-January. Correlates with less sunlight and reduced social activities.", created_from_session: "Session #22", date: "2025-11-20", importance: "high" },
];

const MOCK_TIMELINE = [
  { id: "t1", date: "2025-12-15", type: "session", title: "Session #24", detail: "Anxiety coping strategies + work stress", icon: Calendar },
  { id: "t2", date: "2025-12-15", type: "assessment", title: "PHQ-9 completed", detail: "Score: 13 (Moderate) — improved from 17", icon: Target },
  { id: "t3", date: "2025-12-08", type: "session", title: "Session #23", detail: "Perfectionism + childhood patterns", icon: Calendar },
  { id: "t4", date: "2025-11-28", type: "milestone", title: "Goal Achieved", detail: "Completed 4-week CBT thought record homework", icon: CheckCircle2 },
  { id: "t5", date: "2025-11-15", type: "medication", title: "Medication Update", detail: "Lexapro increased from 5mg to 10mg", icon: Pill },
  { id: "t6", date: "2025-10-01", type: "life_event", title: "Life Event", detail: "Started new job — high stress transition", icon: Flag },
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

  const patient = MOCK_PATIENT;

  const filteredMemories = MOCK_MEMORIES.filter((m) =>
    memorySearch === "" || m.content.toLowerCase().includes(memorySearch.toLowerCase())
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
                        {patient.secondary_diagnoses.map((d) => (
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
                  {MOCK_SESSIONS.slice(0, 3).map((session) => (
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
                  {MOCK_GOALS.filter(g => g.status === "active").slice(0, 3).map((goal) => (
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
                  {MOCK_MEDICATIONS.filter(m => m.status === "active").map((med) => (
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
              <h3 className="text-sm font-semibold text-slate-800">All Sessions ({MOCK_SESSIONS.length})</h3>
              <Link href={`/sessions/new?patient_id=${id}`} className="flex items-center gap-1.5 h-8 px-3 bg-secondary text-white rounded-lg text-xs font-medium hover:bg-secondary/90">
                <Plus className="w-3.5 h-3.5" /> Schedule
              </Link>
            </div>
            <div className="bg-white rounded-xl border border-slate-200 shadow-card overflow-hidden">
              <div className="divide-y divide-slate-50">
                {MOCK_SESSIONS.map((session, idx) => (
                  <Link
                    key={session.id}
                    href={`/sessions/${session.id}`}
                    className="flex items-center gap-4 px-4 py-3 hover:bg-slate-50 transition-colors group"
                  >
                    <div className="text-sm font-bold text-slate-500 w-6 shrink-0">#{MOCK_SESSIONS.length - idx}</div>
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
              {MOCK_ASSESSMENTS.map((assessment) => (
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
              <h3 className="text-sm font-semibold text-slate-800">Medications ({MOCK_MEDICATIONS.length})</h3>
              <button className="flex items-center gap-1.5 h-8 px-3 bg-secondary text-white rounded-lg text-xs font-medium hover:bg-secondary/90">
                <Plus className="w-3.5 h-3.5" /> Add Medication
              </button>
            </div>
            <div className="space-y-3">
              {MOCK_MEDICATIONS.map((med) => (
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
              {MOCK_GOALS.map((goal) => (
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
                {MOCK_TIMELINE.map((event) => {
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
              {MOCK_SESSIONS.map((session, idx) => (
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
