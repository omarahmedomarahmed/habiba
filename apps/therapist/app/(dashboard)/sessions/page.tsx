"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Calendar, Clock, Video, Phone, User, Plus, Search, Filter,
  ChevronRight, Play, Brain, FileText, CheckCircle2, AlertCircle,
  MoreHorizontal, ChevronLeft, Eye, Edit3
} from "lucide-react";
import { cn, formatDate, getInitials } from "@/lib/utils";

const MOCK_SESSIONS = [
  {
    id: "s1", patient_name: "Sarah Chen", patient_id: "p1", patient_initials: "SC",
    scheduled_at: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
    duration: 50, type: "video", status: "scheduled", session_number: 25,
    risk_level: "medium", note_status: null,
  },
  {
    id: "s2", patient_name: "Michael Torres", patient_id: "p2", patient_initials: "MT",
    scheduled_at: new Date(Date.now() + 5 * 60 * 60 * 1000).toISOString(),
    duration: 50, type: "video", status: "scheduled", session_number: 13,
    risk_level: "low", note_status: null,
  },
  {
    id: "s3", patient_name: "Emma Williams", patient_id: "p4", patient_initials: "EW",
    scheduled_at: new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString(),
    duration: 80, type: "video", status: "scheduled", session_number: 19,
    risk_level: "low", note_status: null,
  },
  {
    id: "s4", patient_name: "James Rodriguez", patient_id: "p3", patient_initials: "JR",
    scheduled_at: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
    duration: 52, type: "video", status: "completed", session_number: 37,
    risk_level: "high", note_status: "draft",
  },
  {
    id: "s5", patient_name: "Olivia Kim", patient_id: "p5", patient_initials: "OK",
    scheduled_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
    duration: 48, type: "video", status: "completed", session_number: 9,
    risk_level: "low", note_status: "finalized",
  },
  {
    id: "s6", patient_name: "David Patel", patient_id: "p6", patient_initials: "DP",
    scheduled_at: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
    duration: 55, type: "video", status: "completed", session_number: 6,
    risk_level: "low", note_status: "finalized",
  },
  {
    id: "s7", patient_name: "Emma Williams", patient_id: "p4", patient_initials: "EW",
    scheduled_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    duration: 80, type: "video", status: "scheduled", session_number: 20,
    risk_level: "low", note_status: null,
  },
];

const STATUS_COLORS: Record<string, string> = {
  scheduled: "bg-blue-50 text-blue-700 border border-blue-100",
  completed: "bg-green-50 text-green-700 border border-green-100",
  cancelled: "bg-red-50 text-red-700 border border-red-100",
  no_show: "bg-amber-50 text-amber-700 border border-amber-100",
};

function SessionCard({ session }: { session: typeof MOCK_SESSIONS[0] }) {
  const isPast = new Date(session.scheduled_at) < new Date();
  const isToday = new Date(session.scheduled_at).toDateString() === new Date().toDateString();
  const isUpcoming = !isPast;

  return (
    <div className={cn(
      "bg-white rounded-xl border shadow-card p-4 hover:shadow-card-hover transition-all",
      session.risk_level === "high" ? "border-red-200" : "border-slate-200"
    )}>
      <div className="flex items-start gap-3">
        {/* Avatar */}
        <div className="w-10 h-10 rounded-full bg-primary text-white flex items-center justify-center text-sm font-bold shrink-0">
          {session.patient_initials}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <span className="font-semibold text-slate-800 text-sm">{session.patient_name}</span>
            {session.risk_level === "high" && (
              <span className="text-[10px] bg-red-100 text-red-600 px-1.5 py-0.5 rounded font-semibold">HIGH RISK</span>
            )}
            {session.risk_level === "medium" && (
              <span className="text-[10px] bg-amber-100 text-amber-600 px-1.5 py-0.5 rounded font-semibold">MONITOR</span>
            )}
          </div>

          <div className="flex items-center gap-3 text-xs text-slate-500">
            <span className="flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {isToday ? "Today, " : ""}{new Date(session.scheduled_at).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
            </span>
            <span className="flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {session.duration} min
            </span>
            <span className="flex items-center gap-1">
              <Video className="w-3 h-3" />
              Video
            </span>
            <span>Session #{session.session_number}</span>
          </div>
        </div>

        {/* Status + Actions */}
        <div className="flex flex-col items-end gap-2 shrink-0">
          <span className={cn("text-[10px] font-semibold px-2 py-0.5 rounded-full capitalize", STATUS_COLORS[session.status])}>
            {session.status}
          </span>

          <div className="flex items-center gap-1.5">
            {isUpcoming && (
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
            {isPast && (
              <>
                {session.note_status === "draft" && (
                  <Link
                    href={`/notes/${session.id}`}
                    className="flex items-center gap-1 text-xs text-amber-700 bg-amber-50 border border-amber-200 px-2 py-1 rounded hover:bg-amber-100 transition-colors"
                  >
                    <Edit3 className="w-3 h-3" />
                    Complete Note
                  </Link>
                )}
                {session.note_status === "finalized" && (
                  <Link
                    href={`/notes/${session.id}`}
                    className="flex items-center gap-1 text-xs text-green-700 bg-green-50 border border-green-200 px-2 py-1 rounded hover:bg-green-100 transition-colors"
                  >
                    <CheckCircle2 className="w-3 h-3" />
                    View Note
                  </Link>
                )}
                {!session.note_status && (
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

export default function SessionsPage() {
  const [view, setView] = useState<"upcoming" | "past" | "calendar">("upcoming");
  const [search, setSearch] = useState("");

  const upcoming = MOCK_SESSIONS.filter(
    (s) => new Date(s.scheduled_at) >= new Date() && s.status === "scheduled"
  );
  const past = MOCK_SESSIONS.filter(
    (s) => new Date(s.scheduled_at) < new Date() || s.status === "completed"
  );

  const filtered = view === "upcoming" ? upcoming : past;
  const displaySessions = filtered.filter(
    (s) => !search || s.patient_name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="p-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Sessions</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            {upcoming.length} upcoming · {past.filter(s => s.note_status === "draft").length} notes pending
          </p>
        </div>
        <Link
          href="/sessions/new"
          className="flex items-center gap-2 h-9 px-4 bg-secondary text-white rounded-lg text-sm font-medium hover:bg-secondary/90 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Schedule Session
        </Link>
      </div>

      {/* Tabs + Search */}
      <div className="flex items-center gap-3 mb-5">
        <div className="flex gap-1 bg-slate-100 p-1 rounded-xl">
          {[
            { id: "upcoming", label: `Upcoming (${upcoming.length})` },
            { id: "past", label: "Past Sessions" },
          ].map(({ id, label }) => (
            <button
              key={id}
              onClick={() => setView(id as any)}
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
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search patients..."
            className="w-full pl-9 pr-3 py-2 bg-white border border-slate-200 rounded-lg text-sm text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-secondary/30"
          />
        </div>
      </div>

      {/* Sessions List */}
      <div className="space-y-3">
        {displaySessions.length === 0 ? (
          <div className="text-center py-12 text-slate-400">
            <Calendar className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p className="font-medium">No {view} sessions</p>
            <p className="text-sm mt-1">
              {view === "upcoming" ? "Schedule a new session to get started" : "No past sessions found"}
            </p>
          </div>
        ) : (
          displaySessions.map((session) => (
            <SessionCard key={session.id} session={session} />
          ))
        )}
      </div>
    </div>
  );
}
