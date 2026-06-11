"use client";

import { useState, useEffect } from "react";
import {
  Calendar, Clock, Video, Phone, MapPin, ChevronLeft, ChevronRight,
  Plus, CheckCircle2, AlertCircle, X, Edit3, MessageSquare,
  User, Star, Filter, Download, ExternalLink, Bell, RefreshCw,
  ArrowRight, FileText, Shield, Zap, Info
} from "lucide-react";
import { cn } from "@/lib/utils";
import { sessionsAPI } from "@/lib/api";

interface Session {
  id: string;
  date: string;
  time: string;
  duration: number;
  type: "video" | "phone" | "in_person";
  status: "upcoming" | "completed" | "cancelled" | "no_show" | "scheduled" | "in_progress";
  therapist_name: string;
  therapist_title: string;
  therapist_avatar?: string;
  notes_available: boolean;
  session_number: number;
  focus?: string;
  homework?: string;
  rating?: number;
  can_cancel: boolean;
  reminder_set: boolean;
}

const SESSIONS: Session[] = [
  {
    id: "s1",
    date: "2025-12-22",
    time: "10:00 AM",
    duration: 50,
    type: "video",
    status: "upcoming",
    therapist_name: "Dr. Alex Smith",
    therapist_title: "Licensed Clinical Psychologist",
    notes_available: false,
    session_number: 25,
    focus: "CBT techniques for perfectionism & year-end review",
    can_cancel: true,
    reminder_set: true,
  },
  {
    id: "s2",
    date: "2025-12-29",
    time: "10:00 AM",
    duration: 50,
    type: "video",
    status: "upcoming",
    therapist_name: "Dr. Alex Smith",
    therapist_title: "Licensed Clinical Psychologist",
    notes_available: false,
    session_number: 26,
    can_cancel: true,
    reminder_set: false,
  },
  {
    id: "s3",
    date: "2025-12-15",
    time: "10:00 AM",
    duration: 50,
    type: "video",
    status: "completed",
    therapist_name: "Dr. Alex Smith",
    therapist_title: "Licensed Clinical Psychologist",
    notes_available: true,
    session_number: 24,
    focus: "Anxiety coping strategies + work stress management",
    homework: "Practice breathing exercises 2x daily; Thought record worksheet",
    rating: 5,
    can_cancel: false,
    reminder_set: false,
  },
  {
    id: "s4",
    date: "2025-12-08",
    time: "10:00 AM",
    duration: 50,
    type: "video",
    status: "completed",
    therapist_name: "Dr. Alex Smith",
    therapist_title: "Licensed Clinical Psychologist",
    notes_available: true,
    session_number: 23,
    focus: "Perfectionism exploration + childhood patterns",
    homework: "Journaling: identify 3 perfectionist thoughts per day",
    rating: 4,
    can_cancel: false,
    reminder_set: false,
  },
  {
    id: "s5",
    date: "2025-12-01",
    time: "10:00 AM",
    duration: 50,
    type: "video",
    status: "completed",
    therapist_name: "Dr. Alex Smith",
    therapist_title: "Licensed Clinical Psychologist",
    notes_available: true,
    session_number: 22,
    focus: "Medication check-in + social avoidance behaviors",
    can_cancel: false,
    reminder_set: false,
  },
  {
    id: "s6",
    date: "2025-11-24",
    time: "10:00 AM",
    duration: 50,
    type: "video",
    status: "completed",
    therapist_name: "Dr. Alex Smith",
    therapist_title: "Licensed Clinical Psychologist",
    notes_available: true,
    session_number: 21,
    focus: "Grief processing + emotional regulation",
    rating: 5,
    can_cancel: false,
    reminder_set: false,
  },
];

const THERAPY_STATS = {
  total_sessions: 24,
  sessions_this_month: 4,
  attendance_rate: 96,
  months_in_therapy: 4,
  next_session_days: 6,
};

function getTypeIcon(type: Session["type"]) {
  switch (type) {
    case "video": return <Video className="h-3.5 w-3.5" />;
    case "phone": return <Phone className="h-3.5 w-3.5" />;
    case "in_person": return <MapPin className="h-3.5 w-3.5" />;
  }
}

function getTypeLabel(type: Session["type"]) {
  switch (type) {
    case "video": return "Video Session";
    case "phone": return "Phone Session";
    case "in_person": return "In-Person";
  }
}

function getStatusStyles(status: Session["status"]) {
  switch (status) {
    case "upcoming": return "bg-blue-50 text-blue-700 border border-blue-200";
    case "completed": return "bg-emerald-50 text-emerald-700 border border-emerald-200";
    case "cancelled": return "bg-gray-100 text-gray-600";
    case "no_show": return "bg-rose-50 text-rose-700";
  }
}

function StarRating({ rating }: { rating: number }) {
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map(s => (
        <Star key={s} className={cn("h-3 w-3", s <= rating ? "text-amber-400 fill-amber-400" : "text-gray-200")} />
      ))}
    </div>
  );
}

export default function AppointmentsPage() {
  const [activeTab, setActiveTab] = useState<"upcoming" | "history">("upcoming");
  const [selectedSession, setSelectedSession] = useState<Session | null>(null);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [showRescheduleModal, setShowRescheduleModal] = useState(false);
  const [sessions, setSessions] = useState<Session[]>(SESSIONS);

  useEffect(() => {
    sessionsAPI.list({ limit: 50 } as any).then((data: any) => {
      const items = Array.isArray(data) ? data : data?.data ?? [];
      if (items.length > 0) {
        setSessions(items.map((s: any) => ({
          id: s.id,
          date: s.scheduled_at ? s.scheduled_at.split('T')[0] : '',
          time: s.scheduled_at ? new Date(s.scheduled_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '',
          duration: s.duration_minutes || 50,
          type: s.format || 'video',
          status: s.status || 'upcoming',
          therapist_name: s.therapist_name || 'Your Therapist',
          therapist_title: '',
          notes_available: !!s.has_ai_note,
          session_number: s.session_number || 1,
          can_cancel: s.status === 'scheduled',
          reminder_set: false,
        })));
      }
    }).catch(() => {});
  }, []);

  const upcoming = sessions.filter(s => s.status === "upcoming" || s.status === "scheduled");
  const completed = sessions.filter(s => s.status === "completed");
  const nextSession = upcoming[0];

  return (
    <div className="max-w-2xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Appointments</h1>
          <p className="text-sm text-gray-500 mt-0.5">Session history and upcoming bookings</p>
        </div>
        <button className="flex items-center gap-2 px-3 py-2 border border-gray-200 text-gray-700 rounded-xl text-sm hover:bg-gray-50">
          <Plus className="h-4 w-4" /> Request Session
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-2">
        {[
          { label: "Total", value: THERAPY_STATS.total_sessions, sub: "sessions" },
          { label: "Attendance", value: `${THERAPY_STATS.attendance_rate}%`, sub: "rate" },
          { label: "This Month", value: THERAPY_STATS.sessions_this_month, sub: "sessions" },
          { label: "Next Session", value: `${THERAPY_STATS.next_session_days}`, sub: "days" },
        ].map(({ label, value, sub }) => (
          <div key={label} className="bg-white rounded-2xl border border-gray-200 p-3 text-center">
            <p className="text-lg font-bold text-gray-900">{value}</p>
            <p className="text-xs text-gray-400">{sub}</p>
            <p className="text-xs text-gray-500 font-medium">{label}</p>
          </div>
        ))}
      </div>

      {/* Next session card */}
      {nextSession && (
        <div className="bg-gradient-to-br from-[#0A2342] to-[#1E4F8C] rounded-2xl p-5 text-white">
          <div className="flex items-center justify-between mb-4">
            <span className="text-xs font-medium text-white/60 uppercase tracking-wide">Next Session</span>
            <span className="text-xs bg-white/10 text-white px-2 py-1 rounded-full">Session #{nextSession.session_number}</span>
          </div>

          <div className="flex items-center gap-4 mb-4">
            <div className="w-12 h-12 bg-white/10 rounded-xl flex items-center justify-center">
              <User className="h-6 w-6 text-white/80" />
            </div>
            <div>
              <h3 className="font-semibold text-white">{nextSession.therapist_name}</h3>
              <p className="text-xs text-white/60">{nextSession.therapist_title}</p>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3 mb-4">
            <div className="bg-white/10 rounded-xl p-2 text-center">
              <Calendar className="h-3.5 w-3.5 text-white/60 mx-auto mb-1" />
              <p className="text-xs text-white/80 font-medium">
                {new Date(nextSession.date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
              </p>
            </div>
            <div className="bg-white/10 rounded-xl p-2 text-center">
              <Clock className="h-3.5 w-3.5 text-white/60 mx-auto mb-1" />
              <p className="text-xs text-white/80 font-medium">{nextSession.time}</p>
            </div>
            <div className="bg-white/10 rounded-xl p-2 text-center">
              <Video className="h-3.5 w-3.5 text-white/60 mx-auto mb-1" />
              <p className="text-xs text-white/80 font-medium">Video</p>
            </div>
          </div>

          {nextSession.focus && (
            <div className="bg-white/10 rounded-xl p-3 mb-4">
              <p className="text-xs text-white/60 mb-1">Planned Focus</p>
              <p className="text-sm text-white">{nextSession.focus}</p>
            </div>
          )}

          <div className="flex gap-2">
            <button className="flex-1 py-2.5 bg-white text-[#0A2342] rounded-xl text-sm font-semibold hover:bg-white/90 flex items-center justify-center gap-2">
              <Video className="h-4 w-4" /> Join Session
            </button>
            <button
              onClick={() => setShowRescheduleModal(true)}
              className="p-2.5 bg-white/10 text-white rounded-xl hover:bg-white/20"
            >
              <Edit3 className="h-4 w-4" />
            </button>
            {nextSession.reminder_set ? (
              <button className="p-2.5 bg-emerald-500/20 text-emerald-300 rounded-xl">
                <Bell className="h-4 w-4" />
              </button>
            ) : (
              <button className="p-2.5 bg-white/10 text-white/60 rounded-xl hover:bg-white/20">
                <Bell className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>
      )}

      {/* Homework from last session */}
      {completed[0]?.homework && (
        <div className="bg-amber-50 rounded-2xl border border-amber-100 p-4">
          <div className="flex items-center gap-2 mb-2">
            <FileText className="h-4 w-4 text-amber-600" />
            <span className="text-sm font-semibold text-amber-800">Homework from Session #{completed[0].session_number}</span>
          </div>
          <p className="text-sm text-amber-700">{completed[0].homework}</p>
          <button className="mt-2 text-xs text-amber-600 font-medium hover:text-amber-800 flex items-center gap-1">
            <CheckCircle2 className="h-3 w-3" /> Mark as completed
          </button>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 rounded-xl p-1">
        {(["upcoming", "history"] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={cn(
              "flex-1 py-2 px-4 rounded-lg text-sm font-medium capitalize transition-all",
              activeTab === tab ? "bg-white text-[#0A2342] shadow-sm" : "text-gray-500"
            )}
          >
            {tab === "upcoming" ? `Upcoming (${upcoming.length})` : `History (${completed.length})`}
          </button>
        ))}
      </div>

      {/* Session List */}
      <div className="space-y-3">
        {(activeTab === "upcoming" ? upcoming : completed).map(session => (
          <div
            key={session.id}
            className="bg-white rounded-2xl border border-gray-200 p-4 hover:border-gray-300 transition-all"
          >
            <div className="flex items-start justify-between mb-3">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className={cn("text-xs font-medium px-2 py-0.5 rounded-full capitalize", getStatusStyles(session.status))}>
                    {session.status}
                  </span>
                  <span className="text-xs text-gray-400">Session #{session.session_number}</span>
                </div>
                <p className="font-medium text-gray-900 text-sm">
                  {new Date(session.date).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
                </p>
              </div>
              {session.rating && <StarRating rating={session.rating} />}
            </div>

            <div className="flex items-center gap-4 text-sm text-gray-500 mb-3">
              <span className="flex items-center gap-1">
                <Clock className="h-3.5 w-3.5" /> {session.time} · {session.duration} min
              </span>
              <span className="flex items-center gap-1">
                {getTypeIcon(session.type)} {getTypeLabel(session.type)}
              </span>
            </div>

            {session.focus && (
              <div className="bg-gray-50 rounded-xl p-2.5 mb-3">
                <p className="text-xs text-gray-500 mb-0.5">Session Focus</p>
                <p className="text-sm text-gray-700">{session.focus}</p>
              </div>
            )}

            <div className="flex items-center gap-2">
              {session.status === "upcoming" ? (
                <>
                  <button className="flex-1 py-2 bg-[#0A2342] text-white rounded-xl text-xs font-medium hover:bg-[#123A63] flex items-center justify-center gap-1">
                    <Video className="h-3.5 w-3.5" /> Join
                  </button>
                  <button
                    onClick={() => setShowRescheduleModal(true)}
                    className="flex-1 py-2 border border-gray-200 text-gray-600 rounded-xl text-xs hover:bg-gray-50"
                  >
                    Reschedule
                  </button>
                  {session.can_cancel && (
                    <button
                      onClick={() => setShowCancelModal(true)}
                      className="p-2 border border-gray-200 text-gray-400 rounded-xl hover:text-rose-500 hover:border-rose-200"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </>
              ) : (
                <>
                  {session.notes_available && (
                    <button className="flex-1 py-2 border border-gray-200 text-gray-600 rounded-xl text-xs hover:bg-gray-50 flex items-center justify-center gap-1">
                      <FileText className="h-3.5 w-3.5" /> View Notes
                    </button>
                  )}
                  <button className="flex-1 py-2 border border-gray-200 text-gray-600 rounded-xl text-xs hover:bg-gray-50 flex items-center justify-center gap-1">
                    <MessageSquare className="h-3.5 w-3.5" /> Message
                  </button>
                </>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Cancel Modal */}
      {showCancelModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-rose-100 rounded-xl flex items-center justify-center">
                <AlertCircle className="h-5 w-5 text-rose-600" />
              </div>
              <h3 className="font-semibold text-gray-900">Cancel Session?</h3>
            </div>
            <p className="text-sm text-gray-600 mb-4">
              Cancelling less than 24 hours before your session may result in a cancellation fee. Please reschedule instead if possible.
            </p>
            <div className="flex gap-3">
              <button onClick={() => setShowCancelModal(false)} className="flex-1 py-2.5 border border-gray-200 text-gray-600 rounded-xl text-sm">Keep Session</button>
              <button onClick={() => setShowCancelModal(false)} className="flex-1 py-2.5 bg-rose-500 text-white rounded-xl text-sm font-medium hover:bg-rose-600">Cancel Session</button>
            </div>
          </div>
        </div>
      )}

      {/* Reschedule Modal */}
      {showRescheduleModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-gray-900">Reschedule Session</h3>
              <button onClick={() => setShowRescheduleModal(false)}><X className="h-5 w-5 text-gray-400" /></button>
            </div>
            <p className="text-sm text-gray-600 mb-4">Request a reschedule from Dr. Smith. She'll confirm within 24 hours.</p>
            <div className="space-y-3 mb-4">
              <p className="text-sm font-medium text-gray-700">Preferred times:</p>
              {["Mon Dec 23 · 9:00 AM", "Mon Dec 23 · 11:00 AM", "Tue Dec 24 · 10:00 AM"].map(t => (
                <button key={t} className="w-full py-2.5 border border-gray-200 text-sm text-gray-700 rounded-xl hover:border-[#0A2342] hover:text-[#0A2342] text-left px-4">
                  {t}
                </button>
              ))}
            </div>
            <div className="flex gap-3">
              <button onClick={() => setShowRescheduleModal(false)} className="flex-1 py-2.5 border border-gray-200 text-gray-600 rounded-xl text-sm">Cancel</button>
              <button onClick={() => setShowRescheduleModal(false)} className="flex-1 py-2.5 bg-[#0A2342] text-white rounded-xl text-sm font-medium">Send Request</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
