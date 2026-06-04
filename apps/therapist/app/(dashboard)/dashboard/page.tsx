"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  Calendar, Users, FileText, TrendingUp, Clock, AlertTriangle,
  Zap, ChevronRight, CheckCircle2, Circle, Brain, MoreHorizontal,
  Video, Play, Star, Activity
} from "lucide-react";
import { sessionsAPI, patientsAPI, notificationsAPI } from "@/lib/api";
import { formatDate, formatCurrency, getInitials, cn } from "@/lib/utils";
import { useAuthStore, useUIStore } from "@/lib/store";

// Mock data for development
const MOCK_STATS = {
  sessions_today: 4,
  sessions_this_week: 18,
  active_patients: 42,
  pending_notes: 3,
  radar_requests: 2,
  revenue_this_month: 8420,
  completion_rate: 94,
  avg_session_rating: 4.8,
};

const MOCK_UPCOMING = [
  { id: "s1", patient_name: "Sarah Chen", time: "10:00 AM", duration: 50, type: "video", status: "scheduled", risk_level: "low" },
  { id: "s2", patient_name: "Michael Torres", time: "11:00 AM", duration: 50, type: "video", status: "scheduled", risk_level: "medium" },
  { id: "s3", patient_name: "Emma Williams", time: "2:00 PM", duration: 80, type: "video", status: "scheduled", risk_level: "low" },
  { id: "s4", patient_name: "James Rodriguez", time: "3:30 PM", duration: 50, type: "video", status: "scheduled", risk_level: "high" },
];

const MOCK_ALERTS = [
  { id: "a1", patient: "James Rodriguez", type: "risk", message: "Risk indicator detected in last session", time: "2h ago", level: "high" },
  { id: "a2", patient: "Sarah Chen", type: "assessment", message: "PHQ-9 score increased from 8 to 13", time: "1d ago", level: "medium" },
  { id: "a3", patient: "Alex Johnson", type: "note", message: "Session note pending review from yesterday", time: "18h ago", level: "low" },
];

const MOCK_PENDING_NOTES = [
  { id: "n1", patient: "Michael Torres", session_date: "Yesterday, 3:00 PM", note_type: "SOAP", status: "draft" },
  { id: "n2", patient: "Emma Williams", session_date: "2 days ago", note_type: "DAP", status: "draft" },
  { id: "n3", patient: "Sarah Chen", session_date: "Monday", note_type: "SOAP", status: "needs_review" },
];

const MOCK_RADAR = [
  { id: "r1", patient_initials: "A.K.", specialization: "Anxiety & Depression", urgency: "now", match_score: 94, budget: "$80-100/hr" },
  { id: "r2", patient_initials: "M.L.", specialization: "Trauma / PTSD", urgency: "today", match_score: 88, budget: "$100-120/hr" },
];

function StatCard({
  icon: Icon,
  label,
  value,
  change,
  changeLabel,
  color = "blue",
  href,
}: {
  icon: React.ElementType;
  label: string;
  value: string | number;
  change?: number;
  changeLabel?: string;
  color?: string;
  href?: string;
}) {
  const colorMap: Record<string, string> = {
    blue: "bg-blue-50 text-blue-600",
    green: "bg-green-50 text-green-600",
    purple: "bg-purple-50 text-purple-600",
    amber: "bg-amber-50 text-amber-600",
    red: "bg-red-50 text-red-600",
    cyan: "bg-cyan-50 text-cyan-600",
  };

  const card = (
    <div className="card-stat hover:shadow-card-hover transition-all cursor-pointer group">
      <div className="flex items-start justify-between mb-3">
        <div className={cn("w-9 h-9 rounded-lg flex items-center justify-center", colorMap[color])}>
          <Icon className="w-4.5 h-4.5" style={{ width: 18, height: 18 }} />
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
  const [stats] = useState(MOCK_STATS);
  const [isLoading] = useState(false);
  const now = new Date();
  const hour = now.getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const today = formatDate(now, "long");

  useEffect(() => {
    setNotificationCount(3);
  }, [setNotificationCount]);

  return (
    <div className="p-6 max-w-[1440px] mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-bold text-slate-900">
            {greeting}, Dr. {user?.last_name || "Smith"} 👋
          </h2>
          <p className="text-sm text-slate-500 mt-0.5">{today}</p>
        </div>
        <div className="flex gap-2">
          <Link
            href="/radar"
            className="flex items-center gap-2 h-9 px-4 bg-accent/10 text-accent border border-accent/20 rounded-lg text-sm font-medium hover:bg-accent/20 transition-colors"
          >
            <Zap className="w-4 h-4" />
            <span>Radar</span>
            {stats.radar_requests > 0 && (
              <span className="bg-accent text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                {stats.radar_requests}
              </span>
            )}
          </Link>
          <Link
            href="/sessions/new"
            className="flex items-center gap-2 h-9 px-4 bg-secondary text-white rounded-lg text-sm font-medium hover:bg-secondary/90 transition-colors"
          >
            <Calendar className="w-4 h-4" />
            Schedule Session
          </Link>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <StatCard icon={Calendar} label="Sessions Today" value={stats.sessions_today} color="blue" href="/sessions" />
        <StatCard icon={Users} label="Active Patients" value={stats.active_patients} change={5} changeLabel="this month" color="green" href="/patients" />
        <StatCard icon={FileText} label="Pending Notes" value={stats.pending_notes} color="amber" href="/notes" />
        <StatCard icon={TrendingUp} label="Revenue This Month" value={formatCurrency(stats.revenue_this_month)} change={12} changeLabel="vs last month" color="purple" href="/billing" />
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
                <span className="bg-secondary/10 text-secondary text-xs font-bold px-2 py-0.5 rounded-full">
                  {MOCK_UPCOMING.length}
                </span>
              </div>
              <Link href="/sessions" className="text-xs text-secondary hover:underline flex items-center gap-1">
                View all <ChevronRight className="w-3 h-3" />
              </Link>
            </div>

            <div className="divide-y divide-slate-50">
              {MOCK_UPCOMING.map((session) => (
                <div key={session.id} className="flex items-center gap-3 px-4 py-3 hover:bg-slate-50 transition-colors group">
                  <div className="w-9 h-9 bg-primary rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0">
                    {getInitials(session.patient_name)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-slate-800">{session.patient_name}</span>
                      {session.risk_level === "high" && (
                        <span className="text-[10px] bg-red-100 text-red-600 px-1.5 py-0.5 rounded font-semibold">HIGH RISK</span>
                      )}
                      {session.risk_level === "medium" && (
                        <span className="text-[10px] bg-amber-100 text-amber-600 px-1.5 py-0.5 rounded font-semibold">MONITOR</span>
                      )}
                    </div>
                    <div className="text-xs text-slate-400 flex items-center gap-2 mt-0.5">
                      <Clock className="w-3 h-3" />
                      <span>{session.time}</span>
                      <span>·</span>
                      <span>{session.duration} min</span>
                      <span>·</span>
                      <span className="flex items-center gap-1"><Video className="w-3 h-3" /> Video</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
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
                      <Play className="w-3 h-3" /> Start
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Pending Notes */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-card">
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-amber-500" />
                <h3 className="text-sm font-semibold text-slate-800">Pending Notes</h3>
                {stats.pending_notes > 0 && (
                  <span className="bg-amber-100 text-amber-700 text-xs font-bold px-2 py-0.5 rounded-full">
                    {stats.pending_notes}
                  </span>
                )}
              </div>
              <Link href="/notes" className="text-xs text-secondary hover:underline flex items-center gap-1">
                View all <ChevronRight className="w-3 h-3" />
              </Link>
            </div>

            <div className="divide-y divide-slate-50">
              {MOCK_PENDING_NOTES.map((note) => (
                <div key={note.id} className="flex items-center gap-3 px-4 py-3 hover:bg-slate-50 transition-colors group">
                  <div className={cn(
                    "w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold shrink-0",
                    note.status === "needs_review" ? "bg-amber-100 text-amber-700" : "bg-slate-100 text-slate-600"
                  )}>
                    {note.note_type}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-slate-800">{note.patient}</div>
                    <div className="text-xs text-slate-400">{note.session_date}</div>
                  </div>
                  <span className={cn(
                    "text-[10px] font-semibold px-2 py-0.5 rounded-full",
                    note.status === "needs_review" ? "bg-amber-100 text-amber-700" : "bg-blue-50 text-blue-600"
                  )}>
                    {note.status === "needs_review" ? "REVIEW" : "DRAFT"}
                  </span>
                  <Link
                    href={`/notes/${note.id}`}
                    className="opacity-0 group-hover:opacity-100 text-xs text-secondary hover:underline transition-opacity"
                  >
                    Complete →
                  </Link>
                </div>
              ))}
            </div>
          </div>

          {/* AI Session Intelligence */}
          <div className="bg-gradient-to-br from-primary to-primary/90 rounded-xl text-white p-5">
            <div className="flex items-center gap-2 mb-3">
              <Brain className="w-5 h-5 text-accent" />
              <h3 className="text-sm font-bold">AI Session Intelligence</h3>
              <span className="text-[10px] bg-white/20 px-1.5 py-0.5 rounded font-medium">Today</span>
            </div>
            <div className="grid grid-cols-3 gap-3 mb-4">
              {[
                { label: "Notes Generated", value: "3", icon: FileText },
                { label: "Memories Created", value: "12", icon: Brain },
                { label: "Risk Flags", value: "1", icon: AlertTriangle },
              ].map(({ label, value, icon: Icon }) => (
                <div key={label} className="bg-white/10 rounded-lg p-3 text-center">
                  <Icon className="w-4 h-4 text-accent mx-auto mb-1" />
                  <div className="text-xl font-bold">{value}</div>
                  <div className="text-[10px] text-white/60">{label}</div>
                </div>
              ))}
            </div>
            <Link
              href="/ai-workspace"
              className="flex items-center justify-center gap-2 w-full h-8 bg-white/10 hover:bg-white/20 rounded-lg text-sm font-medium transition-colors"
            >
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
                <span className="bg-red-100 text-red-600 text-xs font-bold px-2 py-0.5 rounded-full">
                  {MOCK_ALERTS.length}
                </span>
              </div>
            </div>
            <div className="divide-y divide-slate-50">
              {MOCK_ALERTS.map((alert) => (
                <div key={alert.id} className="px-4 py-3">
                  <div className="flex items-start gap-2">
                    <div className={cn(
                      "w-2 h-2 rounded-full mt-1.5 shrink-0",
                      alert.level === "high" ? "bg-red-500" : alert.level === "medium" ? "bg-amber-500" : "bg-blue-500"
                    )} />
                    <div>
                      <div className="text-xs font-semibold text-slate-800">{alert.patient}</div>
                      <div className="text-xs text-slate-500 mt-0.5">{alert.message}</div>
                      <div className="text-[10px] text-slate-400 mt-1">{alert.time}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Radar Requests */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-card">
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Zap className="w-4 h-4 text-accent" />
                <h3 className="text-sm font-semibold text-slate-800">Radar Requests</h3>
                <span className="bg-accent/20 text-accent text-xs font-bold px-2 py-0.5 rounded-full live-dot">
                  LIVE
                </span>
              </div>
              <Link href="/radar" className="text-xs text-secondary hover:underline">View all</Link>
            </div>

            <div className="p-3 space-y-2">
              {MOCK_RADAR.map((req) => (
                <div key={req.id} className="border border-slate-100 rounded-lg p-3 hover:border-accent/30 transition-colors">
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 bg-primary/10 rounded-full flex items-center justify-center text-primary text-[10px] font-bold">
                        {req.patient_initials}
                      </div>
                      <div>
                        <div className="text-xs font-medium text-slate-800">{req.specialization}</div>
                        <div className="text-[10px] text-slate-400">{req.budget}</div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-xs font-bold text-accent">{req.match_score}%</div>
                      <div className="text-[10px] text-slate-400">match</div>
                    </div>
                  </div>
                  <div className="flex gap-2 mt-2">
                    <button className="flex-1 h-7 bg-secondary/10 text-secondary text-xs font-medium rounded hover:bg-secondary/20 transition-colors">
                      Decline
                    </button>
                    <button className="flex-1 h-7 bg-accent text-white text-xs font-medium rounded hover:bg-accent/90 transition-colors">
                      Accept
                    </button>
                  </div>
                </div>
              ))}
              {MOCK_RADAR.length === 0 && (
                <div className="text-center py-4 text-xs text-slate-400">
                  <Zap className="w-6 h-6 mx-auto mb-1 opacity-30" />
                  No active radar requests
                </div>
              )}
            </div>
          </div>

          {/* Quick Stats */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-card p-4">
            <h3 className="text-sm font-semibold text-slate-800 mb-3 flex items-center gap-2">
              <Activity className="w-4 h-4 text-secondary" />
              Practice Health
            </h3>
            <div className="space-y-3">
              {[
                { label: "Completion Rate", value: `${stats.completion_rate}%`, good: true },
                { label: "Avg Session Rating", value: `${stats.avg_session_rating} ⭐`, good: true },
                { label: "Sessions This Week", value: stats.sessions_this_week, good: true },
                { label: "Avg AI Note Time", value: "28 sec", good: true },
              ].map(({ label, value, good }) => (
                <div key={label} className="flex items-center justify-between">
                  <span className="text-xs text-slate-500">{label}</span>
                  <span className={cn("text-xs font-semibold", good ? "text-green-600" : "text-red-600")}>
                    {value}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
