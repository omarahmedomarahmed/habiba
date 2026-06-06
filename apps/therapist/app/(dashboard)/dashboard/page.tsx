"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  Calendar, Users, FileText, TrendingUp, Clock, AlertTriangle,
  Zap, ChevronRight, Brain, Video, Play, Activity, RefreshCw
} from "lucide-react";
import { sessionsAPI, patientsAPI, notificationsAPI } from "@/lib/api";
import { formatDate, formatCurrency, getInitials, cn } from "@/lib/utils";
import { useAuthStore, useUIStore } from "@/lib/store";

function StatCard({
  icon: Icon, label, value, change, changeLabel, color = "blue", href,
}: {
  icon: React.ElementType; label: string; value: string | number;
  change?: number; changeLabel?: string; color?: string; href?: string;
}) {
  const colorMap: Record<string, string> = {
    blue: "bg-blue-50 text-blue-600", green: "bg-green-50 text-green-600",
    purple: "bg-purple-50 text-purple-600", amber: "bg-amber-50 text-amber-600",
    red: "bg-red-50 text-red-600", cyan: "bg-cyan-50 text-cyan-600",
  };
  const card = (
    <div className="card-stat hover:shadow-card-hover transition-all cursor-pointer group">
      <div className="flex items-start justify-between mb-3">
        <div className={cn("w-9 h-9 rounded-lg flex items-center justify-center", colorMap[color])}>
          <Icon style={{ width: 18, height: 18 }} />
        </div>
        <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-slate-500 transition-colors" />
      </div>
      <div className="text-2xl font-bold text-slate-900">{value}</div>
      <div className="text-xs text-slate-500 mt-0.5">{label}</div>
      {change !== undefined && (
        <div className={cn("text-xs font-medium mt-1.5", change >= 0 ? "text-green-600" : "text-red-600")}>
          {change >= 0 ? "+" : ""}{change}% {changeLabel}
        </div>
      )}
    </div>
  );
  if (href) return <Link href={href}>{card}</Link>;
  return card;
}

export default function DashboardPage() {
  const user = useAuthStore((s) => s.user);
  const setNotificationCount = useUIStore((s) => s.setNotificationCount);

  const [stats, setStats] = useState<any>({
    sessions_today: 0, active_patients: 0, pending_notes: 0,
    revenue_this_month: 0, sessions_this_week: 0, radar_requests: 0,
    completion_rate: 0, avg_session_rating: 0,
  });
  const [upcomingSessions, setUpcomingSessions] = useState<any[]>([]);
  const [pendingNotes, setPendingNotes] = useState<any[]>([]);
  const [alerts, setAlerts] = useState<any[]>([]);
  const [radarRequests, setRadarRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const now = new Date();
  const hour = now.getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const today = formatDate(now, "long");

  const fetchDashboardData = useCallback(async () => {
    try {
      setError(null);
      const [dashStats, sessionsList, notifData] = await Promise.allSettled([
        sessionsAPI.dashboardStats(),
        sessionsAPI.list({ status: "scheduled", date: new Date().toISOString().split("T")[0], limit: 5 }),
        notificationsAPI.list({ limit: 10, unread: true }),
      ]);

      if (dashStats.status === "fulfilled" && dashStats.value) {
        const d = dashStats.value as any;
        setStats({
          sessions_today: d.sessions_today || 0,
          active_patients: d.active_patients || 0,
          pending_notes: d.pending_notes || 0,
          revenue_this_month: d.revenue_this_month || 0,
          sessions_this_week: d.sessions_this_week || 0,
          radar_requests: d.radar_requests || 0,
          completion_rate: d.completion_rate || 0,
          avg_session_rating: d.avg_session_rating || 0,
        });
      }

      if (sessionsList.status === "fulfilled" && sessionsList.value) {
        const sessions = (sessionsList.value as any)?.data || sessionsList.value;
        setUpcomingSessions(Array.isArray(sessions) ? sessions.slice(0, 4) : []);
      }

      if (notifData.status === "fulfilled" && notifData.value) {
        const notifs = (notifData.value as any)?.data || [];
        const alertNotifs = notifs.filter((n: any) =>
          ["risk_alert", "assessment_completed", "missed_session"].includes(n.type)
        ).slice(0, 3);
        setAlerts(alertNotifs);
        setNotificationCount((notifData.value as any)?.unread_count || alertNotifs.length);
      }
    } catch (err) {
      setError("Live data unavailable — showing last known state.");
    } finally {
      setLoading(false);
    }
  }, [setNotificationCount]);

  useEffect(() => { fetchDashboardData(); }, [fetchDashboardData]);

  return (
    <div className="p-6 max-w-[1440px] mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-bold text-slate-900">
            {greeting}, Dr. {user?.last_name || "there"} 👋
          </h2>
          <p className="text-sm text-slate-500 mt-0.5">{today}</p>
        </div>
        <div className="flex gap-2">
          {error && <span className="text-xs text-amber-600 bg-amber-50 border border-amber-200 px-3 py-1.5 rounded-lg">{error}</span>}
          <button onClick={fetchDashboardData} className="p-2 text-slate-400 hover:text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors">
            <RefreshCw className="w-4 h-4" />
          </button>
          <Link href="/radar" className="flex items-center gap-2 h-9 px-4 bg-accent/10 text-accent border border-accent/20 rounded-lg text-sm font-medium hover:bg-accent/20 transition-colors">
            <Zap className="w-4 h-4" />
            <span>Radar</span>
            {stats.radar_requests > 0 && (
              <span className="bg-accent text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">{stats.radar_requests}</span>
            )}
          </Link>
          <Link href="/sessions/new" className="flex items-center gap-2 h-9 px-4 bg-secondary text-white rounded-lg text-sm font-medium hover:bg-secondary/90 transition-colors">
            <Calendar className="w-4 h-4" />
            Schedule Session
          </Link>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        {loading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="card-stat animate-pulse">
              <div className="w-9 h-9 bg-slate-200 rounded-lg mb-3" />
              <div className="h-7 bg-slate-200 rounded w-1/2 mb-1" />
              <div className="h-3 bg-slate-100 rounded w-3/4" />
            </div>
          ))
        ) : (
          <>
            <StatCard icon={Calendar} label="Sessions Today" value={stats.sessions_today} color="blue" href="/sessions" />
            <StatCard icon={Users} label="Active Patients" value={stats.active_patients} color="green" href="/patients" />
            <StatCard icon={FileText} label="Pending Notes" value={stats.pending_notes} color="amber" href="/notes" />
            <StatCard icon={TrendingUp} label="Revenue This Month" value={formatCurrency(stats.revenue_this_month)} color="purple" href="/billing" />
          </>
        )}
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Left column (2/3) */}
        <div className="lg:col-span-2 space-y-4">
          {/* Today's Sessions */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-card">
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-secondary" />
                <h3 className="text-sm font-semibold text-slate-800">Today&apos;s Sessions</h3>
                {upcomingSessions.length > 0 && (
                  <span className="bg-secondary/10 text-secondary text-xs font-bold px-2 py-0.5 rounded-full">{upcomingSessions.length}</span>
                )}
              </div>
              <Link href="/sessions" className="text-xs text-secondary hover:underline flex items-center gap-1">
                View all <ChevronRight className="w-3 h-3" />
              </Link>
            </div>
            <div className="divide-y divide-slate-50">
              {loading ? (
                Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="flex items-center gap-3 px-4 py-3">
                    <div className="w-9 h-9 bg-slate-200 rounded-full animate-pulse shrink-0" />
                    <div className="flex-1 space-y-2">
                      <div className="h-4 bg-slate-200 rounded animate-pulse w-1/3" />
                      <div className="h-3 bg-slate-100 rounded animate-pulse w-2/3" />
                    </div>
                  </div>
                ))
              ) : upcomingSessions.length > 0 ? (
                upcomingSessions.map((session: any) => {
                  const patientName = session.patient_name ||
                    (session.patient?.first_name ? `${session.patient.first_name} ${session.patient.last_name}` : "Patient");
                  const sessionTime = session.scheduled_at
                    ? new Date(session.scheduled_at).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })
                    : session.time || "–";
                  return (
                    <div key={session.id} className="flex items-center gap-3 px-4 py-3 hover:bg-slate-50 transition-colors group">
                      <div className="w-9 h-9 bg-primary rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0">
                        {getInitials(patientName)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-slate-800">{patientName}</span>
                          {session.risk_level === "high" && <span className="text-[10px] bg-red-100 text-red-600 px-1.5 py-0.5 rounded font-semibold">HIGH RISK</span>}
                          {session.risk_level === "medium" && <span className="text-[10px] bg-amber-100 text-amber-600 px-1.5 py-0.5 rounded font-semibold">MONITOR</span>}
                        </div>
                        <div className="text-xs text-slate-400 flex items-center gap-2 mt-0.5">
                          <Clock className="w-3 h-3" />
                          <span>{sessionTime}</span>
                          <span>·</span>
                          <span>{session.duration_minutes || 50} min</span>
                          <span>·</span>
                          <span className="flex items-center gap-1"><Video className="w-3 h-3" /> Video</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Link href={`/sessions/${session.id}/prepare`} className="text-xs text-slate-500 hover:text-secondary border border-slate-200 px-2 py-1 rounded hover:border-secondary transition-colors">Prepare</Link>
                        <Link href={`/sessions/${session.id}/room`} className="flex items-center gap-1 text-xs text-white bg-secondary px-2 py-1 rounded hover:bg-secondary/90 transition-colors">
                          <Play className="w-3 h-3" /> Start
                        </Link>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="px-4 py-8 text-center">
                  <Calendar className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                  <p className="text-sm text-slate-400">No sessions scheduled for today</p>
                  <Link href="/sessions/new" className="text-xs text-secondary hover:underline mt-2 block">Schedule a session →</Link>
                </div>
              )}
            </div>
          </div>

          {/* Pending Notes */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-card">
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-amber-500" />
                <h3 className="text-sm font-semibold text-slate-800">Pending Notes</h3>
                {stats.pending_notes > 0 && <span className="bg-amber-100 text-amber-700 text-xs font-bold px-2 py-0.5 rounded-full">{stats.pending_notes}</span>}
              </div>
              <Link href="/notes" className="text-xs text-secondary hover:underline flex items-center gap-1">View all <ChevronRight className="w-3 h-3" /></Link>
            </div>
            {loading ? (
              <div className="p-4 space-y-3">
                {Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-10 bg-slate-100 rounded animate-pulse" />)}
              </div>
            ) : pendingNotes.length > 0 ? (
              <div className="divide-y divide-slate-50">
                {pendingNotes.map((note: any) => (
                  <div key={note.id} className="flex items-center gap-3 px-4 py-3 hover:bg-slate-50 transition-colors group">
                    <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold shrink-0",
                      note.status === "needs_review" ? "bg-amber-100 text-amber-700" : "bg-slate-100 text-slate-600")}>
                      {note.note_type?.toUpperCase().slice(0, 4) || "NOTE"}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-slate-800">
                        {note.patient_name || "Patient"}
                      </div>
                      <div className="text-xs text-slate-400">
                        {note.session_date || (note.created_at ? new Date(note.created_at).toLocaleDateString() : "–")}
                      </div>
                    </div>
                    <span className={cn("text-[10px] font-semibold px-2 py-0.5 rounded-full",
                      note.status === "needs_review" ? "bg-amber-100 text-amber-700" : "bg-blue-50 text-blue-600")}>
                      {note.status === "needs_review" ? "REVIEW" : "DRAFT"}
                    </span>
                    <Link href={`/notes/${note.id}`} className="opacity-0 group-hover:opacity-100 text-xs text-secondary hover:underline transition-opacity">
                      Complete →
                    </Link>
                  </div>
                ))}
              </div>
            ) : (
              <div className="px-4 py-8 text-center">
                <FileText className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                <p className="text-sm text-slate-400">All notes up to date</p>
              </div>
            )}
          </div>

          {/* AI Session Intelligence */}
          <div className="bg-gradient-to-br from-primary to-primary/90 rounded-xl text-white p-5">
            <div className="flex items-center gap-2 mb-3">
              <Brain className="w-5 h-5 text-accent" />
              <h3 className="text-sm font-bold">AI Session Intelligence</h3>
              <span className="text-[10px] bg-white/20 px-1.5 py-0.5 rounded font-medium">Powered by GPT-4o</span>
            </div>
            <div className="grid grid-cols-3 gap-3 mb-4">
              {[
                { label: "Notes Generated", value: stats.ai_notes_today || "–", icon: FileText },
                { label: "Memories Created", value: stats.ai_memories_today || "–", icon: Brain },
                { label: "Risk Flags", value: stats.risk_flags_today || "–", icon: AlertTriangle },
              ].map(({ label, value, icon: Icon }) => (
                <div key={label} className="bg-white/10 rounded-lg p-3 text-center">
                  <Icon className="w-4 h-4 text-accent mx-auto mb-1" />
                  <div className="text-xl font-bold">{value}</div>
                  <div className="text-[10px] text-white/60">{label}</div>
                </div>
              ))}
            </div>
            <Link href="/ai-workspace" className="flex items-center justify-center gap-2 w-full h-8 bg-white/10 hover:bg-white/20 rounded-lg text-sm font-medium transition-colors">
              <Brain className="w-4 h-4" />
              Open AI Workspace
            </Link>
          </div>
        </div>

        {/* Right column (1/3) */}
        <div className="space-y-4">
          {/* Alerts */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-card">
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-red-500" />
                <h3 className="text-sm font-semibold text-slate-800">Alerts</h3>
                {alerts.length > 0 && <span className="bg-red-100 text-red-600 text-xs font-bold px-2 py-0.5 rounded-full">{alerts.length}</span>}
              </div>
            </div>
            {loading ? (
              <div className="p-4 space-y-3">
                {[1, 2, 3].map(i => <div key={i} className="h-10 bg-slate-100 rounded animate-pulse" />)}
              </div>
            ) : alerts.length > 0 ? (
              <div className="divide-y divide-slate-50">
                {alerts.map((alert: any) => (
                  <div key={alert.id} className="px-4 py-3">
                    <div className="flex items-start gap-2">
                      <div className={cn("w-2 h-2 rounded-full mt-1.5 shrink-0",
                        alert.priority === "high" || alert.severity === "high" ? "bg-red-500" :
                        alert.priority === "medium" || alert.severity === "medium" ? "bg-amber-500" : "bg-blue-500")} />
                      <div>
                        <div className="text-xs font-semibold text-slate-800">
                          {alert.patient_name || alert.title || "Alert"}
                        </div>
                        <div className="text-xs text-slate-500 mt-0.5">{alert.message || alert.body}</div>
                        <div className="text-[10px] text-slate-400 mt-1">
                          {alert.created_at ? new Date(alert.created_at).toLocaleString() : "–"}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="px-4 py-8 text-center">
                <AlertTriangle className="w-8 h-8 text-slate-200 mx-auto mb-2" />
                <p className="text-xs text-slate-400">No active alerts</p>
              </div>
            )}
          </div>

          {/* Radar Requests */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-card">
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Zap className="w-4 h-4 text-accent" />
                <h3 className="text-sm font-semibold text-slate-800">Radar Requests</h3>
                <span className="bg-accent/20 text-accent text-xs font-bold px-2 py-0.5 rounded-full">LIVE</span>
              </div>
              <Link href="/radar" className="text-xs text-secondary hover:underline">View all</Link>
            </div>
            <div className="p-3 space-y-2">
              {radarRequests.length > 0 ? (
                radarRequests.map((req: any) => (
                  <div key={req.id} className="border border-slate-100 rounded-lg p-3 hover:border-accent/30 transition-colors">
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 bg-primary/10 rounded-full flex items-center justify-center text-primary text-[10px] font-bold">
                          {req.patient_initials || "P"}
                        </div>
                        <div>
                          <div className="text-xs font-medium text-slate-800">{req.specialization || req.presenting_issue || "Therapy"}</div>
                          <div className="text-[10px] text-slate-400">{req.budget_range || req.budget || "Flexible"}</div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-xs font-bold text-accent">{req.match_score || req.compatibility_score || 0}%</div>
                        <div className="text-[10px] text-slate-400">match</div>
                      </div>
                    </div>
                    <div className="flex gap-2 mt-2">
                      <button className="flex-1 h-7 bg-secondary/10 text-secondary text-xs font-medium rounded hover:bg-secondary/20 transition-colors">Decline</button>
                      <button className="flex-1 h-7 bg-accent text-white text-xs font-medium rounded hover:bg-accent/90 transition-colors">Accept</button>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-4">
                  <Zap className="w-6 h-6 mx-auto mb-1 text-slate-300" />
                  <p className="text-xs text-slate-400">No active radar requests</p>
                </div>
              )}
            </div>
          </div>

          {/* Practice Health */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-card p-4">
            <h3 className="text-sm font-semibold text-slate-800 mb-3 flex items-center gap-2">
              <Activity className="w-4 h-4 text-secondary" />
              Practice Health
            </h3>
            <div className="space-y-3">
              {[
                { label: "Completion Rate", value: stats.completion_rate ? `${stats.completion_rate}%` : "–" },
                { label: "Avg Session Rating", value: stats.avg_session_rating ? `${stats.avg_session_rating} ⭐` : "–" },
                { label: "Sessions This Week", value: stats.sessions_this_week || 0 },
              ].map(({ label, value }) => (
                <div key={label} className="flex items-center justify-between">
                  <span className="text-xs text-slate-500">{label}</span>
                  <span className="text-xs font-semibold text-slate-800">{value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
