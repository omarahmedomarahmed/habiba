"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Search, Plus, Filter, SortAsc, Users, AlertTriangle,
  ChevronRight, Calendar, Clock, Brain, MoreHorizontal,
  Download, FileText, Activity
} from "lucide-react";
import { cn, getInitials, formatDate, getRiskColor, getStatusColor } from "@/lib/utils";

const MOCK_PATIENTS = [
  {
    id: "p1", first_name: "Sarah", last_name: "Chen", email: "sarah.c@email.com",
    age: 34, gender: "Female", diagnosis: "Major Depressive Disorder", risk_level: "medium",
    therapist_name: "Dr. Smith", sessions_count: 24, last_session: "2025-12-15",
    next_session: "2025-12-22", status: "active", phq9_score: 13, gad7_score: 8,
    goals_progress: 65, avatar_initials: "SC", enrolled_since: "2024-08-10",
  },
  {
    id: "p2", first_name: "Michael", last_name: "Torres", email: "m.torres@email.com",
    age: 28, gender: "Male", diagnosis: "Generalized Anxiety Disorder", risk_level: "low",
    therapist_name: "Dr. Smith", sessions_count: 12, last_session: "2025-12-10",
    next_session: "2025-12-17", status: "active", phq9_score: 6, gad7_score: 11,
    goals_progress: 45, avatar_initials: "MT", enrolled_since: "2024-11-01",
  },
  {
    id: "p3", first_name: "James", last_name: "Rodriguez", email: "j.rodriguez@email.com",
    age: 42, gender: "Male", diagnosis: "PTSD, MDD", risk_level: "high",
    therapist_name: "Dr. Smith", sessions_count: 36, last_session: "2025-12-14",
    next_session: "2025-12-21", status: "active", phq9_score: 19, gad7_score: 16,
    goals_progress: 30, avatar_initials: "JR", enrolled_since: "2023-06-15",
  },
  {
    id: "p4", first_name: "Emma", last_name: "Williams", email: "emma.w@email.com",
    age: 31, gender: "Female", diagnosis: "OCD, Anxiety", risk_level: "low",
    therapist_name: "Dr. Smith", sessions_count: 18, last_session: "2025-12-09",
    next_session: "2025-12-23", status: "active", phq9_score: 7, gad7_score: 9,
    goals_progress: 75, avatar_initials: "EW", enrolled_since: "2024-05-20",
  },
  {
    id: "p5", first_name: "Olivia", last_name: "Kim", email: "olivia.k@email.com",
    age: 25, gender: "Female", diagnosis: "Social Anxiety", risk_level: "low",
    therapist_name: "Dr. Smith", sessions_count: 8, last_session: "2025-12-01",
    next_session: "2025-12-29", status: "active", phq9_score: 4, gad7_score: 12,
    goals_progress: 55, avatar_initials: "OK", enrolled_since: "2025-09-05",
  },
  {
    id: "p6", first_name: "David", last_name: "Patel", email: "d.patel@email.com",
    age: 38, gender: "Male", diagnosis: "Bipolar II, Anxiety", risk_level: "medium",
    therapist_name: "Dr. Smith", sessions_count: 52, last_session: "2025-11-28",
    next_session: null, status: "inactive", phq9_score: 10, gad7_score: 7,
    goals_progress: 80, avatar_initials: "DP", enrolled_since: "2022-12-01",
  },
];

type SortKey = "name" | "last_session" | "risk_level" | "sessions_count";
type FilterStatus = "all" | "active" | "inactive";

export default function PatientsPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState<FilterStatus>("all");
  const [filterRisk, setFilterRisk] = useState("all");
  const [sortKey, setSortKey] = useState<SortKey>("name");
  const [showFilters, setShowFilters] = useState(false);
  const [viewMode, setViewMode] = useState<"list" | "grid">("list");

  const filtered = MOCK_PATIENTS.filter((p) => {
    const matchesSearch = searchQuery === "" ||
      `${p.first_name} ${p.last_name}`.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.diagnosis.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = filterStatus === "all" || p.status === filterStatus;
    const matchesRisk = filterRisk === "all" || p.risk_level === filterRisk;
    return matchesSearch && matchesStatus && matchesRisk;
  });

  const sorted = [...filtered].sort((a, b) => {
    if (sortKey === "name") return `${a.last_name} ${a.first_name}`.localeCompare(`${b.last_name} ${b.first_name}`);
    if (sortKey === "last_session") return new Date(b.last_session).getTime() - new Date(a.last_session).getTime();
    if (sortKey === "risk_level") {
      const order = { high: 0, medium: 1, low: 2 };
      return (order[a.risk_level as keyof typeof order] || 3) - (order[b.risk_level as keyof typeof order] || 3);
    }
    if (sortKey === "sessions_count") return b.sessions_count - a.sessions_count;
    return 0;
  });

  const highRiskCount = MOCK_PATIENTS.filter((p) => p.risk_level === "high").length;

  return (
    <div className="p-6 max-w-[1440px] mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Patients</h2>
          <p className="text-sm text-slate-500 mt-0.5">
            {MOCK_PATIENTS.filter(p => p.status === "active").length} active ·{" "}
            {highRiskCount > 0 && (
              <span className="text-red-600 font-medium">{highRiskCount} high risk</span>
            )}
          </p>
        </div>
        <div className="flex gap-2">
          <button className="flex items-center gap-1.5 h-9 px-3 border border-slate-200 rounded-lg text-sm text-slate-600 hover:bg-slate-50">
            <Download className="w-4 h-4" />
            Export
          </button>
          <Link
            href="/patients/new"
            className="flex items-center gap-1.5 h-9 px-4 bg-secondary text-white rounded-lg text-sm font-medium hover:bg-secondary/90 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Add Patient
          </Link>
        </div>
      </div>

      {/* Search & Filters */}
      <div className="flex items-center gap-3 mb-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search patients..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full h-9 pl-9 pr-3 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-secondary/40 focus:border-secondary bg-white"
          />
        </div>

        <div className="flex items-center gap-2">
          {(["all", "active", "inactive"] as FilterStatus[]).map((s) => (
            <button
              key={s}
              onClick={() => setFilterStatus(s)}
              className={cn(
                "h-9 px-3 rounded-lg text-sm font-medium transition-colors border",
                filterStatus === s
                  ? "bg-secondary text-white border-secondary"
                  : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
              )}
            >
              {s.charAt(0).toUpperCase() + s.slice(1)}
            </button>
          ))}
        </div>

        <button
          onClick={() => setShowFilters(!showFilters)}
          className={cn(
            "flex items-center gap-1.5 h-9 px-3 rounded-lg text-sm border transition-colors",
            showFilters ? "bg-secondary/10 text-secondary border-secondary/30" : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
          )}
        >
          <Filter className="w-4 h-4" />
          Filters
        </button>

        <div className="flex items-center gap-1 border border-slate-200 rounded-lg p-0.5 bg-white ml-auto">
          <button
            onClick={() => setSortKey("name")}
            className={cn("h-7 px-2.5 rounded text-xs font-medium transition-colors flex items-center gap-1",
              sortKey === "name" ? "bg-slate-900 text-white" : "text-slate-500 hover:text-slate-800"
            )}
          >
            <SortAsc className="w-3 h-3" />Name
          </button>
          <button
            onClick={() => setSortKey("risk_level")}
            className={cn("h-7 px-2.5 rounded text-xs font-medium transition-colors",
              sortKey === "risk_level" ? "bg-slate-900 text-white" : "text-slate-500 hover:text-slate-800"
            )}
          >Risk</button>
          <button
            onClick={() => setSortKey("last_session")}
            className={cn("h-7 px-2.5 rounded text-xs font-medium transition-colors",
              sortKey === "last_session" ? "bg-slate-900 text-white" : "text-slate-500 hover:text-slate-800"
            )}
          >Last Session</button>
        </div>
      </div>

      {/* Advanced Filters */}
      {showFilters && (
        <div className="bg-white rounded-xl border border-slate-200 p-4 mb-4 flex gap-6 animate-fade-in">
          <div>
            <label className="text-xs font-medium text-slate-500 block mb-2">Risk Level</label>
            <div className="flex gap-2">
              {["all", "high", "medium", "low"].map((r) => (
                <button
                  key={r}
                  onClick={() => setFilterRisk(r)}
                  className={cn(
                    "h-7 px-2.5 rounded text-xs font-medium border transition-colors",
                    filterRisk === r ? "bg-slate-900 text-white border-slate-900" : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
                  )}
                >
                  {r.charAt(0).toUpperCase() + r.slice(1)}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Count */}
      <div className="text-xs text-slate-500 mb-3">
        Showing {sorted.length} of {MOCK_PATIENTS.length} patients
      </div>

      {/* Patient List */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-card overflow-hidden">
        {/* Table Header */}
        <div className="grid grid-cols-[2fr_1fr_1fr_1fr_1fr_auto] gap-4 px-4 py-2.5 bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase tracking-wide">
          <div>Patient</div>
          <div>Diagnosis</div>
          <div>Risk</div>
          <div>Last Session</div>
          <div>Progress</div>
          <div></div>
        </div>

        <div className="divide-y divide-slate-50">
          {sorted.map((patient) => (
            <Link
              key={patient.id}
              href={`/patients/${patient.id}`}
              className="grid grid-cols-[2fr_1fr_1fr_1fr_1fr_auto] gap-4 px-4 py-3 hover:bg-slate-50 transition-colors items-center group"
            >
              {/* Patient Info */}
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-9 h-9 bg-primary rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0">
                  {getInitials(`${patient.first_name} ${patient.last_name}`)}
                </div>
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-slate-800 truncate">
                    {patient.first_name} {patient.last_name}
                  </div>
                  <div className="text-xs text-slate-400 truncate">
                    {patient.age}y · {patient.gender} · {patient.sessions_count} sessions
                  </div>
                </div>
              </div>

              {/* Diagnosis */}
              <div className="text-xs text-slate-600 truncate">{patient.diagnosis}</div>

              {/* Risk */}
              <div>
                <span className={cn(
                  "text-[10px] font-bold px-2 py-0.5 rounded-full border uppercase",
                  getRiskColor(patient.risk_level)
                )}>
                  {patient.risk_level}
                </span>
              </div>

              {/* Last Session */}
              <div>
                <div className="text-xs text-slate-600">{formatDate(patient.last_session, "short")}</div>
                {patient.next_session && (
                  <div className="text-[10px] text-slate-400 flex items-center gap-1 mt-0.5">
                    <Calendar className="w-2.5 h-2.5" />
                    {formatDate(patient.next_session, "short")}
                  </div>
                )}
              </div>

              {/* Progress */}
              <div>
                <div className="flex items-center gap-2">
                  <div className="flex-1 bg-slate-100 rounded-full h-1.5 max-w-[80px]">
                    <div
                      className={cn(
                        "h-1.5 rounded-full",
                        patient.goals_progress >= 70 ? "bg-green-500" :
                        patient.goals_progress >= 40 ? "bg-amber-500" : "bg-red-400"
                      )}
                      style={{ width: `${patient.goals_progress}%` }}
                    />
                  </div>
                  <span className="text-xs text-slate-500 font-medium">{patient.goals_progress}%</span>
                </div>
                <div className="text-[10px] text-slate-400 mt-0.5">PHQ-9: {patient.phq9_score}</div>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  onClick={(e) => { e.preventDefault(); }}
                  className="h-7 w-7 flex items-center justify-center rounded hover:bg-slate-100 transition-colors"
                  title="Quick note"
                >
                  <FileText className="w-3.5 h-3.5 text-slate-400" />
                </button>
                <button
                  onClick={(e) => { e.preventDefault(); }}
                  className="h-7 w-7 flex items-center justify-center rounded hover:bg-slate-100 transition-colors"
                >
                  <MoreHorizontal className="w-3.5 h-3.5 text-slate-400" />
                </button>
                <ChevronRight className="w-3.5 h-3.5 text-slate-300" />
              </div>
            </Link>
          ))}
        </div>

        {sorted.length === 0 && (
          <div className="py-16 text-center">
            <Users className="w-8 h-8 text-slate-300 mx-auto mb-2" />
            <p className="text-sm text-slate-500">No patients found</p>
            <Link href="/patients/new" className="text-xs text-secondary hover:underline mt-1 inline-block">
              Add your first patient
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
