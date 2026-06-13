"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Calendar, Video, Clock, CheckCircle2, XCircle, AlertCircle,
  Plus, Phone, Star, FileText, Brain, Play, AlertTriangle, RefreshCw
} from "lucide-react";
import { cn, formatDate } from "@/lib/utils";
import { sessionsAPI, APIError } from "@/lib/api";

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: any }> = {
  scheduled: { label: "Scheduled", color: "text-blue-700 bg-blue-50 border-blue-200", icon: Calendar },
  completed: { label: "Completed", color: "text-green-700 bg-green-50 border-green-200", icon: CheckCircle2 },
  cancelled: { label: "Cancelled", color: "text-slate-500 bg-slate-50 border-slate-200", icon: XCircle },
  no_show: { label: "No Show", color: "text-red-700 bg-red-50 border-red-200", icon: AlertCircle },
};

function StarRating({ rating }: { rating?: number }) {
  if (!rating) return null;
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((star) => (
        <Star
          key={star}
          className={cn("w-3.5 h-3.5", star <= rating ? "text-amber-400 fill-amber-400" : "text-slate-200 fill-slate-200")}
        />
      ))}
    </div>
  );
}

function SkeletonCard() {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-5 animate-pulse">
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-xl bg-slate-200 shrink-0" />
        <div className="flex-1 space-y-2">
          <div className="h-4 bg-slate-200 rounded w-40" />
          <div className="h-3 bg-slate-100 rounded w-56" />
        </div>
        <div className="w-16 h-8 bg-slate-200 rounded-xl" />
      </div>
    </div>
  );
}

export default function PatientSessionsPage() {
  const [tab, setTab] = useState<"upcoming" | "past">("upcoming");
  const [sessions, setSessions] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const LIMIT = 10;

  const fetchSessions = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await sessionsAPI.list({
        page,
        limit: LIMIT,
        status: tab === "upcoming" ? "scheduled" : "completed",
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
  }, [tab, page]);

  useEffect(() => {
    setPage(1);
  }, [tab]);

  useEffect(() => {
    fetchSessions();
  }, [fetchSessions]);

  const upcoming = sessions.filter(s => s.status === "scheduled");
  const past = sessions.filter(s => s.status === "completed" || s.status === "no_show" || s.status === "cancelled");
  const display = tab === "upcoming" ? upcoming : past;

  const totalPages = Math.ceil(total / LIMIT);

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-3xl mx-auto p-4 md:p-6 space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">My Sessions</h1>
            <p className="text-slate-500 text-sm mt-1">
              {loading ? "Loading..." : `${total} sessions total`}
            </p>
          </div>
          <button onClick={fetchSessions} className="p-2 border border-slate-200 rounded-xl hover:bg-slate-50">
            <RefreshCw className={`w-4 h-4 text-slate-400 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>

        {/* Error Banner */}
        {error && (
          <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-100 rounded-xl text-red-600 text-sm">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
            <button onClick={fetchSessions} className="ml-auto underline text-xs">Retry</button>
          </div>
        )}

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: "Total", value: loading ? "—" : total, icon: Calendar, color: "text-blue-600 bg-blue-50" },
            { label: "Completed", value: loading ? "—" : (tab === "past" ? display.length : "—"), icon: CheckCircle2, color: "text-green-600 bg-green-50" },
            { label: "Upcoming", value: loading ? "—" : (tab === "upcoming" ? display.length : "—"), icon: Clock, color: "text-purple-600 bg-purple-50" },
          ].map((s) => (
            <div key={s.label} className="bg-white rounded-xl border border-slate-200 shadow-card p-4">
              <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center mb-2", s.color)}>
                <s.icon className="w-4 h-4" />
              </div>
              <div className="text-xl font-bold text-slate-900">{s.value}</div>
              <div className="text-xs text-slate-500">{s.label}</div>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div className="flex gap-1 p-1 bg-slate-200 rounded-xl w-fit">
          {[
            { key: "upcoming", label: "Upcoming" },
            { key: "past", label: "Past Sessions" },
          ].map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key as any)}
              className={cn(
                "px-4 py-2 rounded-lg text-sm font-medium transition-colors",
                tab === t.key ? "bg-white text-slate-900 shadow-sm" : "text-slate-600 hover:text-slate-900"
              )}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Session List */}
        <div className="space-y-3">
          {loading ? (
            [...Array(3)].map((_, i) => <SkeletonCard key={i} />)
          ) : display.length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-card p-12 text-center">
              <Calendar className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <p className="text-slate-500">
                {tab === "upcoming" ? "No upcoming sessions scheduled" : "No past sessions found"}
              </p>
              {tab === "upcoming" && (
                <p className="text-sm text-slate-400 mt-1">Contact your therapist to schedule your next session</p>
              )}
            </div>
          ) : (
            display.map((session) => {
              const statusConfig = STATUS_CONFIG[session.status] || STATUS_CONFIG.scheduled;
              const StatusIcon = statusConfig.icon;
              const sessionDate = new Date(session.scheduled_at || session.date || "");
              const minutesUntil = (sessionDate.getTime() - Date.now()) / (1000 * 60);
              const canJoin = minutesUntil <= 15 && minutesUntil > -60;
              const therapistName = session.therapist
                ? `${session.therapist.first_name || ""} ${session.therapist.last_name || ""}`.trim()
                : session.therapist_name || "Your Therapist";

              return (
                <div
                  key={session.id}
                  className={cn(
                    "bg-white rounded-2xl border border-slate-200 shadow-card p-5",
                    session.status === "scheduled" && "border-blue-200 bg-blue-50/20"
                  )}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3">
                      <div className={cn(
                        "w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5",
                        session.type === "phone" ? "bg-slate-100" : "bg-blue-50"
                      )}>
                        {session.type === "phone"
                          ? <Phone className="w-4 h-4 text-slate-600" />
                          : <Video className="w-4 h-4 text-blue-600" />}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-slate-900 text-sm">
                            {session.session_number ? `Session #${session.session_number}` : "Session"}
                          </span>
                          <span className={cn("flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border", statusConfig.color)}>
                            <StatusIcon className="w-3 h-3" />
                            {statusConfig.label}
                          </span>
                        </div>
                        <div className="text-xs text-slate-500 mt-0.5">{therapistName}</div>
                        <div className="flex items-center gap-3 mt-1 text-xs text-slate-500">
                          <span className="flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            {isNaN(sessionDate.getTime()) ? "—" : sessionDate.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                          </span>
                          {!isNaN(sessionDate.getTime()) && (
                            <span className="flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              {sessionDate.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
                            </span>
                          )}
                          <span>{session.duration || 50} min</span>
                        </div>
                        {session.rating && (
                          <div className="mt-1.5">
                            <StarRating rating={session.rating} />
                          </div>
                        )}
                      </div>
                    </div>

                    {session.status === "scheduled" && (
                      <button
                        disabled={!canJoin}
                        className={cn(
                          "flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold transition-all flex-shrink-0",
                          canJoin
                            ? "bg-blue-600 text-white hover:bg-blue-700 shadow-md"
                            : "bg-slate-100 text-slate-400 cursor-not-allowed"
                        )}
                      >
                        <Play className="w-3.5 h-3.5" />
                        {canJoin ? "Join" : "Join (opens 15min before)"}
                      </button>
                    )}
                  </div>

                  {session.notes && (
                    <div className="mt-3 pt-3 border-t border-slate-100">
                      <div className="flex items-start gap-2">
                        <FileText className="w-3.5 h-3.5 text-slate-400 mt-0.5 flex-shrink-0" />
                        <p className="text-xs text-slate-600">{session.notes}</p>
                      </div>
                    </div>
                  )}

                  {(session.homework || session.homework_assigned) && (
                    <div className={cn(
                      "mt-2 p-2.5 rounded-lg flex items-start gap-2",
                      session.status === "scheduled" ? "bg-blue-50" : "bg-slate-50"
                    )}>
                      <Brain className="w-3.5 h-3.5 text-purple-500 mt-0.5 flex-shrink-0" />
                      <p className="text-xs text-slate-600">
                        <span className="font-medium">Homework: </span>
                        {session.homework || session.homework_assigned}
                      </p>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Pagination */}
        {!loading && totalPages > 1 && (
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-500">Page {page} of {totalPages}</span>
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
    </div>
  );
}

// Reviewed: 2026-06-13 — 24Therapy audit
