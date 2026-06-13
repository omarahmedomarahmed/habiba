"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft, Calendar, Clock, Video, Phone, Play, Brain, FileText,
  CheckCircle2, Edit3, CreditCard, AlertTriangle, RefreshCw, User,
} from "lucide-react";
import { cn, getInitials } from "@/lib/utils";
import { sessionsAPI, billingAPI } from "@/lib/api";

const STATUS_COLORS: Record<string, string> = {
  scheduled: "bg-blue-50 text-blue-700 border border-blue-100",
  waiting: "bg-sky-50 text-sky-700 border border-sky-100",
  in_progress: "bg-indigo-50 text-indigo-700 border border-indigo-100",
  completed: "bg-green-50 text-green-700 border border-green-100",
  archived: "bg-slate-50 text-slate-600 border border-slate-200",
  cancelled: "bg-red-50 text-red-700 border border-red-100",
  no_show: "bg-amber-50 text-amber-700 border border-amber-100",
};

function fmtDateTime(iso?: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" }) +
    ", " + d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

export default function SessionDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [session, setSession] = useState<any>(null);
  const [note, setNote] = useState<any>(null);
  const [segmentCount, setSegmentCount] = useState<number | null>(null);
  const [charge, setCharge] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAll = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    const [sessionRes, transcriptRes, noteRes, usageRes] = await Promise.allSettled([
      sessionsAPI.get(id),
      sessionsAPI.transcript(id),
      sessionsAPI.aiNote(id),
      billingAPI.usageMe(),
    ]);
    if (sessionRes.status === "fulfilled" && sessionRes.value) {
      setSession(sessionRes.value);
    } else {
      setError("Session not found.");
      setLoading(false);
      return;
    }
    if (transcriptRes.status === "fulfilled") {
      const t: any = transcriptRes.value;
      const segs = t?.segments || t?.data?.segments || (Array.isArray(t?.data) ? t.data : null);
      setSegmentCount(Array.isArray(segs) ? segs.length : null);
    }
    if (noteRes.status === "fulfilled") {
      const n: any = noteRes.value;
      setNote(n?.note ?? n ?? null);
    }
    if (usageRes.status === "fulfilled") {
      const u: any = usageRes.value;
      const found =
        (u?.charge_history || []).find((c: any) => c.session_id === id) ||
        (u?.pending_bills || []).find((b: any) => b.session_id === id);
      if (found) setCharge(found);
    }
    setLoading(false);
  }, [id]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  if (loading) {
    return (
      <div className="p-6 max-w-4xl mx-auto space-y-4">
        <div className="h-8 w-48 bg-slate-100 rounded animate-pulse" />
        <div className="h-32 bg-slate-100 rounded-xl animate-pulse" />
        <div className="h-48 bg-slate-100 rounded-xl animate-pulse" />
      </div>
    );
  }

  if (error || !session) {
    return (
      <div className="p-6 max-w-4xl mx-auto">
        <Link href="/sessions" className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 mb-6">
          <ArrowLeft className="w-4 h-4" /> Back to sessions
        </Link>
        <div className="bg-white rounded-xl border border-slate-200 p-10 text-center">
          <AlertTriangle className="w-10 h-10 text-amber-400 mx-auto mb-3" />
          <p className="text-slate-700 font-medium mb-1">{error || "Session not found"}</p>
          <p className="text-sm text-slate-500 mb-4">It may have been removed, or the link is invalid.</p>
          <button onClick={fetchAll} className="inline-flex items-center gap-1.5 text-sm text-secondary hover:underline">
            <RefreshCw className="w-3.5 h-3.5" /> Try again
          </button>
        </div>
      </div>
    );
  }

  const patientName = session.patient_name || "Patient";
  const status: string = session.status || "scheduled";
  const noteStatus = note?.status === "approved" ? "finalized" : note?.status;
  const chargeStatus = charge?.status || (charge && charge.stripe_checkout_url !== undefined ? "pending" : null);

  const timeline: Array<{ label: string; at: string | null; done: boolean }> = [
    { label: "Scheduled", at: session.scheduled_at, done: true },
    { label: "Started", at: session.started_at, done: !!session.started_at },
    { label: "Ended", at: session.ended_at, done: !!session.ended_at },
  ];

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <Link href="/sessions" className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 mb-4">
        <ArrowLeft className="w-4 h-4" /> Back to sessions
      </Link>

      {/* Header card */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-card p-5 mb-4">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-primary text-white flex items-center justify-center text-base font-bold">
              {getInitials(patientName)}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-bold text-slate-900">{session.title || `Session with ${patientName}`}</h1>
                <span className={cn(
                  "text-[10px] font-semibold px-2 py-0.5 rounded-full capitalize",
                  STATUS_COLORS[status] || "bg-slate-50 text-slate-600 border border-slate-100"
                )}>
                  {status.replace(/_/g, " ")}
                </span>
              </div>
              <div className="flex items-center gap-3 text-xs text-slate-500 mt-1 flex-wrap">
                <Link href={`/patients/${session.patient_id}`} className="flex items-center gap-1 hover:text-secondary">
                  <User className="w-3 h-3" /> {patientName}
                </Link>
                <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />{fmtDateTime(session.scheduled_at)}</span>
                <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{session.duration_minutes || 50} min</span>
                <span className="flex items-center gap-1">
                  {session.modality === "phone" ? <Phone className="w-3 h-3" /> : <Video className="w-3 h-3" />}
                  {session.modality === "phone" ? "Phone" : "Video"}
                </span>
                {session.session_number && <span>Session #{session.session_number}</span>}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {status === "scheduled" && (
              <>
                <Link href={`/sessions/${id}/prepare`} className="h-9 px-3 border border-slate-200 rounded-lg text-sm text-slate-600 hover:border-secondary hover:text-secondary transition-colors flex items-center">
                  Prepare
                </Link>
                <Link href={`/sessions/${id}/room`} className="h-9 px-4 bg-secondary text-white rounded-lg text-sm font-medium hover:bg-secondary/90 transition-colors flex items-center gap-1.5">
                  <Play className="w-3.5 h-3.5" /> Join room
                </Link>
              </>
            )}
            {(status === "waiting" || status === "in_progress") && (
              <Link href={`/sessions/${id}/room`} className="h-9 px-4 bg-indigo-500 text-white rounded-lg text-sm font-medium hover:bg-indigo-600 transition-colors flex items-center gap-1.5">
                <Play className="w-3.5 h-3.5" /> Rejoin room
              </Link>
            )}
            {status === "completed" && !note && (
              <Link href={`/notes/new?session_id=${id}`} className="h-9 px-4 bg-secondary text-white rounded-lg text-sm font-medium hover:bg-secondary/90 transition-colors flex items-center gap-1.5">
                <Brain className="w-3.5 h-3.5" /> Generate note
              </Link>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Timeline */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-card p-5">
          <h2 className="text-sm font-semibold text-slate-900 mb-3">Timeline</h2>
          <div className="space-y-3">
            {timeline.map((step) => (
              <div key={step.label} className="flex items-center gap-3">
                <div className={cn(
                  "w-2.5 h-2.5 rounded-full shrink-0",
                  step.done ? "bg-green-500" : "bg-slate-200"
                )} />
                <span className="text-sm text-slate-700 w-20">{step.label}</span>
                <span className="text-xs text-slate-400">{fmtDateTime(step.at)}</span>
              </div>
            ))}
            {session.duration_minutes && session.ended_at && (
              <p className="text-xs text-slate-500 pl-6">Total duration: {session.duration_minutes} minutes</p>
            )}
          </div>
        </div>

        {/* Transcript */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-card p-5">
          <h2 className="text-sm font-semibold text-slate-900 mb-3">Transcript</h2>
          {segmentCount !== null && segmentCount > 0 ? (
            <p className="text-sm text-slate-600">
              {segmentCount} segment{segmentCount === 1 ? "" : "s"} captured by the AI scribe.
            </p>
          ) : (
            <p className="text-sm text-slate-400">
              {status === "scheduled" ? "Transcription starts when the session begins." : "No transcript segments were captured for this session."}
            </p>
          )}
        </div>

        {/* Clinical note */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-card p-5">
          <h2 className="text-sm font-semibold text-slate-900 mb-3">Clinical note</h2>
          {note ? (
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm text-slate-700 font-medium flex items-center gap-1.5">
                  <FileText className="w-4 h-4 text-slate-400" />
                  {(note.note_format || "SOAP").toString().toUpperCase()} note
                </p>
                <p className="text-xs text-slate-400 capitalize mt-0.5">{(noteStatus || "draft").replace(/_/g, " ")}</p>
              </div>
              <Link
                href={`/notes/${note.id}`}
                className={cn(
                  "h-8 px-3 rounded-lg text-xs font-medium flex items-center gap-1 transition-colors",
                  noteStatus === "finalized"
                    ? "bg-green-50 text-green-700 border border-green-200 hover:bg-green-100"
                    : "bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100"
                )}
              >
                {noteStatus === "finalized" ? <CheckCircle2 className="w-3 h-3" /> : <Edit3 className="w-3 h-3" />}
                {noteStatus === "finalized" ? "View note" : "Review & finalize"}
              </Link>
            </div>
          ) : (
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm text-slate-400">No note yet for this session.</p>
              {status === "completed" && (
                <Link href={`/notes/new?session_id=${id}`} className="h-8 px-3 bg-secondary/10 text-secondary rounded-lg text-xs font-medium flex items-center gap-1 hover:bg-secondary/20 transition-colors">
                  <Brain className="w-3 h-3" /> AI note
                </Link>
              )}
            </div>
          )}
        </div>

        {/* Billing */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-card p-5">
          <h2 className="text-sm font-semibold text-slate-900 mb-3">Billing</h2>
          {charge ? (
            <div>
              <p className="text-sm text-slate-700 font-medium flex items-center gap-1.5">
                <CreditCard className="w-4 h-4 text-slate-400" />
                {chargeStatus === "waived"
                  ? "First session — on us 🎉"
                  : chargeStatus === "pending"
                    ? `$${Number(charge.amount_due_usd ?? 0).toFixed(2)} due`
                    : charge.description || "Included in your plan"}
              </p>
              {chargeStatus === "pending" && (
                charge.stripe_checkout_url ? (
                  <a href={charge.stripe_checkout_url} target="_blank" rel="noopener noreferrer"
                     className="inline-flex items-center mt-2 h-8 px-3 bg-[#1F5EFF] text-white rounded-lg text-xs font-semibold hover:bg-[#1a4fd6] transition-colors">
                    Pay now
                  </a>
                ) : (
                  <p className="text-xs text-slate-400 mt-2">Payment link available in Settings → Billing.</p>
                )
              )}
            </div>
          ) : (
            <p className="text-sm text-slate-400">
              {status === "completed" ? "Billing details appear in Settings → Billing & Usage." : "Billed when the session completes."}
            </p>
          )}
        </div>
      </div>

      {/* Pre-session notes */}
      {session.pre_session_notes && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-card p-5 mt-4">
          <h2 className="text-sm font-semibold text-slate-900 mb-2">Pre-session notes</h2>
          <p className="text-sm text-slate-600 whitespace-pre-wrap">{session.pre_session_notes}</p>
        </div>
      )}
    </div>
  );
}

// Reviewed: 2026-06-13 — 24Therapy audit
