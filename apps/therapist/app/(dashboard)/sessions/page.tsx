"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  Calendar, Clock, Video, Plus, Search,
  Play, Brain, FileText, CheckCircle2,
  MoreHorizontal, Eye, Edit3, AlertTriangle, RefreshCw
} from "lucide-react";
import { cn, getInitials } from "@/lib/utils";
import { sessionsAPI, APIError } from "@/lib/api";

const STATUS_COLORS: Record<string, string> = {
  scheduled: "bg-blue-50 text-blue-700 border border-blue-100",
  in_progress: "bg-indigo-50 text-indigo-700 border border-indigo-100",
  completed: "bg-green-50 text-green-700 border border-green-100",
  cancelled: "bg-red-50 text-red-700 border border-red-100",
  no_show: "bg-amber-50 text-amber-700 border border-amber-100",
};

function SessionCard({ session }: { session: any }) {
  const scheduledAt = new Date(session.scheduled_at || session.scheduled_date || session.date || 0);
  const isPast = scheduledAt < new Date() || session.status === "completed";
  const isToday = scheduledAt.toDateString() === new Date().toDateString();
  const isUpcoming = !isPast || session.status === "scheduled";
  const patientName = session.patient
    ? `${session.patient.first_name || ""} ${session.patient.last_name || ""}`.trim()
    : session.patient_name || "Unknown Patient";
  const initials = getInitials(patientName);
  const riskLevel = session.patient?.risk_level || session.risk_level;
  const noteStatus = session.note_status || session.ai_note_status;

  return (
    <div className={cn(
      "bg-white rounded-xl border shadow-card p-4 hover:shadow-card-hover transition-all",
      riskLevel === "high" ? "border-red-200" : "border-slate-200"
    )}>
      <div className="flex items-start gap-3">
        {/* Avatar */}
        <div className="w-10 h-10 rounded-full bg-primary text-white flex items-center justify-center text-sm font-bold shrink-0">
          {initials}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <span className="font-semibold text-slate-800 text-sm">{patientName}</span>
            {riskLevel === "high" && (
              <span className="text-[10px] bg-red-100 text-red-600 px-1.5 py-0.5 rounded font-semibold">HIGH RISK</span>
            )}
            {riskLevel === "medium" && (
              <span className="text-[10px] bg-amber-100 text-amber-600 px-1.5 py-0.5 rounded font-semibold">MONITOR</span>
            )}
          </div>

          <div className="flex items-center gap-3 text-xs text-slate-500">
            <span className="flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {isToday ? "Today, " : ""}
              {scheduledAt.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
            </span>
            <span className="flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {session.duration || 50} min
            </span>
            <span className="flex items-center gap-1">
              <Video className="w-3 h-3" />
              {session.type === "phone" ? "Phone" : "Video"}
            </span>
            {session.session_number && <span>Session #{session.session_number}</span>}
          </div>
        </div>

        {/* Status + Actions */}
        <div className="flex flex-col items-end gap-2 shrink-0">
          <span className={cn(
            "text-[10px] font-semibold px-2 py-0.5 rounded-full capitalize",
            STATUS_COLORS[session.status] || "bg-slate-50 text-slate-600 border border-slate-100"
          )}>
            {(session.status || "scheduled").replace(/_/g, " ")}
          </span>

          <div className="flex items-center gap-1.5">
            {isUpcoming && session.status === "scheduled" && (
              <>
                <Link
                  href={`/sessions/${session.id}/prepare`}
                  className="text-xs text-slate-500 hover:text-secondary border border-slate-200 px-2 py-1 rounded hover:border-secondary transition-colors"
                >
                  Prepare
                </Link>
                <Link
                  href={`/sessions/${session.id}/room`}
                  className="flex items-center gap-1 text-xs text-white bg-secondary px-2 py-1 rounded hover:bg-secondary/90 transition-colors"
                >
                  <Play className="w-3 h-3" />
                  Join
                </Link>
              </>
            )}
            {session.status === "in_progress" && (
              <Link
                href={`/sessions/${session.id}/room`}
                className="flex items-center gap-1 text-xs text-white bg-indigo-500 px-2 py-1 rounded hover:bg-indigo-600 transition-colors"
              >
                <Play className="w-3 h-3" />
                Rejoin
              </Link>
            )}
            {isPast && session.status !== "in_progress" && (
              <>
                {session.note_id && noteStatus !== "finalized" && (
                  <Link
                    href={`/notes/${session.note_id}`}
                    className="flex items-center gap-1 text-xs text-amber-700 bg-amber-50 border border-amber-200 px-2 py-1 rounded hover:bg-amber-100 transition-colors"
                  >
                    <Edit3 className="w-3 h-3" />
                    Complete Note
                  </Link>
                )}
                {session.note_id && noteStatus === "finalized" && (
                  <Link
                    href={`/notes/${session.note_id}`}
                    className="flex items-center gap-1 text-xs text-green-700 bg-green-50 border border-green-200 px-2 py-1 rounded hover:bg-green-100 transition-colors"
                  >
                    <CheckCircle2 className="w-3 h-3" />
                    View Note
                  </Link>
                )}
                {!session.note_id && (
                  <Link
                    href={`/notes/new?session_id=${session.id}`}
                    className="flex items-center gap-1 text-xs text-secondary border border-secondary/20 px-2 py-1 rounded hover:bg-secondary/10 transition-colors"
                  >
                    <Brain className="w-3 h-3" />
                    AI Note
                  </Link>
                )}
                <Link
                  href={`/sessions/${session.id}`}
                  className="text-xs text-slate-400 hover:text-slate-600 border border-slate-200 px-2 py-1 rounded hover:border-slate-300 transition-colors"
                >
                  <Eye className="w-3 h-3" />
                </Link>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function SkeletonCard() {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4 animate-pulse">
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-full bg-slate-200 shrink-0" />
        <div className="flex-1 space-y-2">
          <div className="h-4 bg-slate-200 rounded w-40" />
          <div className="h-3 bg-slate-100 rounded w-56" />
        </div>
        <div className="w-20 h-5 bg-slate-200 rounded-full" />
      </div>
    </div>
  );
}

export default function SessionsPage() {
  const [view, setView] = useState<"upcoming" | "past">("upcoming");
  const [search, setSearch] = useState("");
  const [sessions, setSessions] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const LIMIT = 20;

  const fetchSessions = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await sessionsAPI.list({
        page,
        limit: LIMIT,
        status: view === "upcoming" ? "scheduled" : "completed",
        search: search || undefined,
      });
      const data = Array.isArray(result) ? result : (result as any).data ?? [];
      const tot = Array.isArray(result) ? result.length : (result as any).total ?? 0;
      setSessions(data);
      setTotal(tot);
    } catch (err) {
      if (err instanceof APIError && err.status === 401) return;
      setError(err instanceof Error ? err.message : "Failed to load sessions");
      setSessions([]);
    } finally {
      setLoading(false);
    }
  }, [view, page, search]);

  useEffect(() => {
    const t = setTimeout(fetchSessions, search ? 400 : 0);
    return () => clearTimeout(t);
  }, [fetchSessions, search]);

  // Separate sessions for display based on view
  const upcoming = sessions.filter(s => {
    const d = new Date(s.scheduled_at || s.scheduled_date || s.date || 0);
    return d >= new Date() && s.status === "scheduled";
  });
  const past = sessions.filter(s => {
    const d = new Date(s.scheduled_at || s.scheduled_date || s.date || 0);
    return d < new Date() || s.status === "completed";
  });
  const notesPending = sessions.filter(s => s.note_status === "draft" || (s.status === "completed" && !s.note_status)).length;

  const displaySessions = view === "upcoming" ? upcoming : past;
  const filtered = search
    ? displaySessions.filter(s => {
        const name = s.patient
          ? `${s.patient.first_name || ""} ${s.patient.last_name || ""}`.toLowerCase()
          : (s.patient_name || "").toLowerCase();
        return name.includes(search.toLowerCase());
      })
    : displaySessions;

  const totalPages = Math.ceil(total / LIMIT);

  return (
    <div className="p-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Sessions</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            {loading ? "Loading..." : `${total} sessions · ${notesPending} notes pending`}
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={fetchSessions} className="flex items-center gap-1.5 h-9 px-3 border border-slate-200 rounded-lg text-sm text-slate-600 hover:bg-slate-50">
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          </button>
          <Link
            href="/sessions/new"
            className="flex items-center gap-2 h-9 px-4 bg-secondary text-white rounded-lg text-sm font-medium hover:bg-secondary/90 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Schedule Session
          </Link>
        </div>
      </div>

      {/* Error Banner */}
      {error && (
        <div className="flex items-center gap-3 p-3 mb-4 bg-red-50 border border-red-100 rounded-xl text-red-600 text-sm">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
          <button onClick={fetchSessions} className="ml-auto text-red-500 hover:text-red-700 underline text-xs">Retry</button>
        </div>
      )}

      {/* Tabs + Search */}
      <div className="flex items-center gap-3 mb-5">
        <div className="flex gap-1 bg-slate-100 p-1 rounded-xl">
          {[
            { id: "upcoming", label: `Upcoming (${loading ? "…" : upcoming.length})` },
            { id: "past", label: `Past (${loading ? "…" : past.length})` },
          ].map(({ id, label }) => (
            <button
              key={id}
              onClick={() => { setView(id as any); setPage(1); }}
              className={cn(
                "px-4 py-1.5 rounded-lg text-sm font-medium transition-all",
                view === id ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"
              )}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="relative flex-1 max-w-xs ml-auto">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
          <input
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            placeholder="Search patients..."
            className="w-full pl-9 pr-3 py-2 bg-white border border-slate-200 rounded-lg text-sm text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-secondary/30"
          />
        </div>
      </div>

      {/* Sessions List */}
      <div className="space-y-3">
        {loading ? (
          [...Array(4)].map((_, i) => <SkeletonCard key={i} />)
        ) : filtered.length === 0 ? (
          <div className="text-center py-12 text-slate-400">
            <Calendar className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p className="font-medium">No {view} sessions</p>
            <p className="text-sm mt-1">
              {view === "upcoming" ? "Schedule a new session to get started" : "No past sessions found"}
            </p>
          </div>
        ) : (
          filtered.map((session) => (
            <SessionCard key={session.id} session={session} />
          ))
        )}
      </div>

      {/* Pagination */}
      {!loading && totalPages > 1 && (
        <div className="flex items-center justify-between mt-6">
          <span className="text-xs text-slate-500">Page {page} of {totalPages} · {total} total</span>
          <div className="flex gap-2">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
              className="h-8 px-3 border border-slate-200 rounded-lg text-xs text-slate-600 hover:bg-slate-50 disabled:opacity-40"
            >
              Previous
            </button>
            <button
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="h-8 px-3 border border-slate-200 rounded-lg text-xs text-slate-600 hover:bg-slate-50 disabled:opacity-40"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
