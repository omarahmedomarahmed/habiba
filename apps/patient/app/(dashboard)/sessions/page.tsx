"use client";

import { useState } from "react";
import {
  Calendar, Video, Clock, CheckCircle2, XCircle, AlertCircle,
  ChevronRight, Plus, Phone, MapPin, Star, FileText, Brain,
  Play, User
} from "lucide-react";
import { cn, formatDate } from "@/lib/utils";

const MOCK_SESSIONS = [
  {
    id: "s1",
    date: "2025-12-22T10:00:00Z",
    status: "scheduled",
    type: "video",
    duration: 50,
    therapist: "Dr. Smith",
    session_number: 25,
    notes: null,
    homework: "Continue sleep diary",
    can_join: false,
    minutes_until: 7 * 24 * 60,
  },
  {
    id: "s2",
    date: "2025-12-15T10:00:00Z",
    status: "completed",
    type: "video",
    duration: 52,
    therapist: "Dr. Smith",
    session_number: 24,
    notes: "Discussed sleep improvements and CBT homework progress.",
    homework: "Practice thought record daily",
    can_join: false,
    rating: 5,
    minutes_until: null,
  },
  {
    id: "s3",
    date: "2025-12-08T10:00:00Z",
    status: "completed",
    type: "video",
    duration: 50,
    therapist: "Dr. Smith",
    session_number: 23,
    notes: "Worked on challenging negative automatic thoughts.",
    homework: "Complete behavioral activation log",
    can_join: false,
    rating: 4,
    minutes_until: null,
  },
  {
    id: "s4",
    date: "2025-12-01T10:00:00Z",
    status: "completed",
    type: "video",
    duration: 50,
    therapist: "Dr. Smith",
    session_number: 22,
    notes: "Reviewed PHQ-9 results and updated treatment plan goals.",
    homework: "Sleep hygiene checklist",
    can_join: false,
    rating: 5,
    minutes_until: null,
  },
];

const STATUS_CONFIG = {
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

export default function PatientSessionsPage() {
  const [tab, setTab] = useState<"upcoming" | "past">("upcoming");

  const upcoming = MOCK_SESSIONS.filter((s) => s.status === "scheduled");
  const past = MOCK_SESSIONS.filter((s) => s.status === "completed");

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-3xl mx-auto p-4 md:p-6 space-y-5">

        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-slate-900">My Sessions</h1>
          <p className="text-slate-500 text-sm mt-1">Your therapy sessions with Dr. Smith</p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: "Total", value: MOCK_SESSIONS.length, icon: Calendar, color: "text-blue-600 bg-blue-50" },
            { label: "Completed", value: past.length, icon: CheckCircle2, color: "text-green-600 bg-green-50" },
            { label: "Upcoming", value: upcoming.length, icon: Clock, color: "text-purple-600 bg-purple-50" },
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
          {tab === "upcoming" && upcoming.length === 0 && (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-card p-12 text-center">
              <Calendar className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <p className="text-slate-500">No upcoming sessions scheduled</p>
              <p className="text-sm text-slate-400 mt-1">Contact your therapist to schedule your next session</p>
            </div>
          )}

          {(tab === "upcoming" ? upcoming : past).map((session) => {
            const status = STATUS_CONFIG[session.status as keyof typeof STATUS_CONFIG];
            const StatusIcon = status.icon;
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
                    <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5",
                      session.type === "video" ? "bg-blue-50" : "bg-slate-100"
                    )}>
                      {session.type === "video"
                        ? <Video className="w-4 h-4 text-blue-600" />
                        : <Phone className="w-4 h-4 text-slate-600" />}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-slate-900 text-sm">
                          Session #{session.session_number}
                        </span>
                        <span className={cn("flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border", status.color)}>
                          <StatusIcon className="w-3 h-3" />
                          {status.label}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 mt-1 text-xs text-slate-500">
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {formatDate(session.date)}
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {new Date(session.date).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
                        </span>
                        <span>{session.duration} min</span>
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
                      disabled={!session.can_join}
                      className={cn(
                        "flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold transition-all flex-shrink-0",
                        session.can_join
                          ? "bg-blue-600 text-white hover:bg-blue-700 shadow-md"
                          : "bg-slate-100 text-slate-400 cursor-not-allowed"
                      )}
                    >
                      <Play className="w-3.5 h-3.5" />
                      Join
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

                {session.homework && (
                  <div className={cn("mt-2 p-2.5 rounded-lg flex items-start gap-2",
                    session.status === "scheduled" ? "bg-blue-50" : "bg-slate-50"
                  )}>
                    <Brain className="w-3.5 h-3.5 text-purple-500 mt-0.5 flex-shrink-0" />
                    <p className="text-xs text-slate-600">
                      <span className="font-medium">Homework: </span>
                      {session.homework}
                    </p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
