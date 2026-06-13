"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  Search, Plus, Filter, SortAsc, Users, AlertTriangle,
  ChevronRight, Calendar, MoreHorizontal,
  Download, FileText, RefreshCw
} from "lucide-react";
import { cn, getInitials, formatDate, getRiskColor } from "@/lib/utils";
import { patientsAPI, APIError } from "@/lib/api";

type SortKey = "name" | "last_session" | "risk_level" | "sessions_count";
type FilterStatus = "all" | "active" | "inactive";

function SkeletonRow() {
  return (
    <div className="grid grid-cols-[2fr_1fr_1fr_1fr_1fr_auto] gap-4 px-4 py-3 border-b border-slate-50 animate-pulse">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-full bg-slate-200" />
        <div className="space-y-1.5 flex-1">
          <div className="h-3.5 bg-slate-200 rounded w-32" />
          <div className="h-3 bg-slate-100 rounded w-20" />
        </div>
      </div>
      <div className="h-3 bg-slate-200 rounded w-24 self-center" />
      <div className="h-5 bg-slate-200 rounded w-14 self-center" />
      <div className="h-3 bg-slate-200 rounded w-20 self-center" />
      <div className="h-2 bg-slate-200 rounded-full w-20 self-center" />
      <div className="w-4 h-4 bg-slate-200 rounded self-center" />
    </div>
  );
}

export default function PatientsPage() {
  const [patients, setPatients] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState<FilterStatus>("all");
  const [filterRisk, setFilterRisk] = useState("all");
  const [sortKey, setSortKey] = useState<SortKey>("name");
  const [showFilters, setShowFilters] = useState(false);
  const [page, setPage] = useState(1);
  const LIMIT = 25;

  const fetchPatients = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await patientsAPI.list({
        page,
        limit: LIMIT,
        search: searchQuery || undefined,
        status: filterStatus !== "all" ? filterStatus : undefined,
        risk_level: filterRisk !== "all" ? filterRisk : undefined,
        sort: sortKey,
      });
      const data = Array.isArray(result) ? result : (result as any).data ?? [];
      const tot = Array.isArray(result) ? result.length : (result as any).total ?? 0;
      setPatients(data);
      setTotal(tot);
    } catch (err) {
      if (err instanceof APIError && err.status === 401) return;
      setError(err instanceof Error ? err.message : "Failed to load patients");
      setPatients([]);
    } finally {
      setLoading(false);
    }
  }, [page, searchQuery, filterStatus, filterRisk, sortKey]);

  useEffect(() => {
    const t = setTimeout(fetchPatients, searchQuery ? 400 : 0);
    return () => clearTimeout(t);
  }, [fetchPatients, searchQuery]);

  const sorted = [...patients].sort((a, b) => {
    if (sortKey === "name")
      return `${a.last_name || ""} ${a.first_name || ""}`.localeCompare(
        `${b.last_name || ""} ${b.first_name || ""}`
      );
    if (sortKey === "last_session")
      return (
        new Date(b.last_session_date || b.last_session || 0).getTime() -
        new Date(a.last_session_date || a.last_session || 0).getTime()
      );
    if (sortKey === "risk_level") {
      const order: Record<string, number> = { high: 0, medium: 1, low: 2 };
      return (order[a.risk_level] ?? 3) - (order[b.risk_level] ?? 3);
    }
    if (sortKey === "sessions_count")
      return (b.sessions_count ?? 0) - (a.sessions_count ?? 0);
    return 0;
  });

  const highRiskCount = patients.filter((p) => p.risk_level === "high").length;
  const activeCount = patients.filter((p) => p.status === "active").length;
  const totalPages = Math.ceil(total / LIMIT);

  return (
    <div className="p-6 max-w-[1440px] mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Patients</h2>
          <p className="text-sm text-slate-500 mt-0.5">
            {loading ? "Loading..." : (
              <>
                {activeCount} active ·{" "}
                {highRiskCount > 0 && (
                  <span className="text-red-600 font-medium">{highRiskCount} high risk</span>
                )}
                {highRiskCount === 0 && "no high risk"}
              </>
            )}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={fetchPatients}
            className="flex items-center gap-1.5 h-9 px-3 border border-slate-200 rounded-lg text-sm text-slate-600 hover:bg-slate-50"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          </button>
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

      {/* Error Banner */}
      {error && (
        <div className="flex items-center gap-3 p-3 mb-4 bg-red-50 border border-red-100 rounded-xl text-red-600 text-sm">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
          <button onClick={fetchPatients} className="ml-auto text-red-500 hover:text-red-700 underline text-xs">Retry</button>
        </div>
      )}

      {/* Search & Filters */}
      <div className="flex items-center gap-3 mb-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search patients..."
            value={searchQuery}
            onChange={(e) => { setSearchQuery(e.target.value); setPage(1); }}
            className="w-full h-9 pl-9 pr-3 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-secondary/40 focus:border-secondary bg-white"
          />
        </div>

        <div className="flex items-center gap-2">
          {(["all", "active", "inactive"] as FilterStatus[]).map((s) => (
            <button
              key={s}
              onClick={() => { setFilterStatus(s); setPage(1); }}
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
          {([
            { key: "name", label: "Name", icon: SortAsc },
            { key: "risk_level", label: "Risk" },
            { key: "last_session", label: "Last Session" },
          ] as Array<{ key: SortKey; label: string; icon?: any }>).map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => { setSortKey(key); setPage(1); }}
              className={cn(
                "h-7 px-2.5 rounded text-xs font-medium transition-colors flex items-center gap-1",
                sortKey === key ? "bg-slate-900 text-white" : "text-slate-500 hover:text-slate-800"
              )}
            >
              {Icon && <Icon className="w-3 h-3" />}
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Advanced Filters */}
      {showFilters && (
        <div className="bg-white rounded-xl border border-slate-200 p-4 mb-4 flex gap-6">
          <div>
            <label className="text-xs font-medium text-slate-500 block mb-2">Risk Level</label>
            <div className="flex gap-2">
              {["all", "high", "medium", "low"].map((r) => (
                <button
                  key={r}
                  onClick={() => { setFilterRisk(r); setPage(1); }}
                  className={cn(
                    "h-7 px-2.5 rounded text-xs font-medium border transition-colors",
                    filterRisk === r
                      ? "bg-slate-900 text-white border-slate-900"
                      : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
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
        {loading ? "Loading patients..." : `Showing ${sorted.length} of ${total} patients`}
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
          <div />
        </div>

        <div className="divide-y divide-slate-50">
          {loading ? (
            [...Array(6)].map((_, i) => <SkeletonRow key={i} />)
          ) : sorted.length === 0 ? (
            <div className="py-16 text-center">
              <Users className="w-8 h-8 text-slate-300 mx-auto mb-2" />
              <p className="text-sm text-slate-500">
                {searchQuery || filterStatus !== "all" || filterRisk !== "all"
                  ? "No patients match your filters."
                  : "No patients yet."}
              </p>
              <Link href="/patients/new" className="text-xs text-secondary hover:underline mt-1 inline-block">
                Add your first patient
              </Link>
            </div>
          ) : (
            sorted.map((patient) => {
              const fullName = `${patient.first_name || ""} ${patient.last_name || ""}`.trim() || patient.email || "Unknown";
              const lastSession = patient.last_session_date || patient.last_session;
              const nextSession = patient.next_session_date || patient.next_session;
              const progress = patient.goals_progress ?? patient.treatment_progress ?? null;
              const phq9 = patient.phq9_score ?? patient.last_phq9 ?? null;

              return (
                <Link
                  key={patient.id}
                  href={`/patients/${patient.id}`}
                  className="grid grid-cols-[2fr_1fr_1fr_1fr_1fr_auto] gap-4 px-4 py-3 hover:bg-slate-50 transition-colors items-center group"
                >
                  {/* Patient Info */}
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-9 h-9 bg-primary rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0">
                      {getInitials(fullName)}
                    </div>
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-slate-800 truncate">{fullName}</div>
                      <div className="text-xs text-slate-400 truncate">
                        {patient.age ? `${patient.age}y · ` : ""}
                        {patient.gender ? `${patient.gender} · ` : ""}
                        {patient.sessions_count ?? 0} sessions
                      </div>
                    </div>
                  </div>

                  {/* Diagnosis */}
                  <div className="text-xs text-slate-600 truncate">
                    {patient.primary_diagnosis || patient.diagnosis || "—"}
                  </div>

                  {/* Risk */}
                  <div>
                    {patient.risk_level ? (
                      <span className={cn(
                        "text-[10px] font-bold px-2 py-0.5 rounded-full border uppercase",
                        getRiskColor(patient.risk_level)
                      )}>
                        {patient.risk_level}
                      </span>
                    ) : (
                      <span className="text-xs text-slate-300">—</span>
                    )}
                  </div>

                  {/* Last Session */}
                  <div>
                    <div className="text-xs text-slate-600">
                      {lastSession ? formatDate(lastSession, "short") : "Never"}
                    </div>
                    {nextSession && (
                      <div className="text-[10px] text-slate-400 flex items-center gap-1 mt-0.5">
                        <Calendar className="w-2.5 h-2.5" />
                        {formatDate(nextSession, "short")}
                      </div>
                    )}
                  </div>

                  {/* Progress */}
                  <div>
                    {progress !== null ? (
                      <>
                        <div className="flex items-center gap-2">
                          <div className="flex-1 bg-slate-100 rounded-full h-1.5 max-w-[80px]">
                            <div
                              className={cn(
                                "h-1.5 rounded-full",
                                progress >= 70 ? "bg-green-500" :
                                progress >= 40 ? "bg-amber-500" : "bg-red-400"
                              )}
                              style={{ width: `${progress}%` }}
                            />
                          </div>
                          <span className="text-xs text-slate-500 font-medium">{progress}%</span>
                        </div>
                        {phq9 !== null && (
                          <div className="text-[10px] text-slate-400 mt-0.5">PHQ-9: {phq9}</div>
                        )}
                      </>
                    ) : (
                      <span className="text-xs text-slate-300">—</span>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={(e) => e.preventDefault()}
                      className="h-7 w-7 flex items-center justify-center rounded hover:bg-slate-100 transition-colors"
                      title="Quick note"
                    >
                      <FileText className="w-3.5 h-3.5 text-slate-400" />
                    </button>
                    <button
                      onClick={(e) => e.preventDefault()}
                      className="h-7 w-7 flex items-center justify-center rounded hover:bg-slate-100 transition-colors"
                    >
                      <MoreHorizontal className="w-3.5 h-3.5 text-slate-400" />
                    </button>
                    <ChevronRight className="w-3.5 h-3.5 text-slate-300" />
                  </div>
                </Link>
              );
            })
          )}
        </div>
      </div>

      {/* Pagination */}
      {!loading && totalPages > 1 && (
        <div className="flex items-center justify-between mt-4">
          <span className="text-xs text-slate-500">Page {page} of {totalPages} · {total} total</span>
          <div className="flex gap-2">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
              className="h-8 px-3 border border-slate-200 rounded-lg text-xs text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Previous
            </button>
            <button
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="h-8 px-3 border border-slate-200 rounded-lg text-xs text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// Reviewed: 2026-06-13 — 24Therapy audit
