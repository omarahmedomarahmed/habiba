"use client";

import { Suspense, useState, useEffect, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Brain, FileText, Search, Calendar, AlertTriangle } from "lucide-react";
import { cn, getInitials, formatDate } from "@/lib/utils";
import { sessionsAPI, notesAPI, aiAPI } from "@/lib/api";

const FORMATS = [
  { id: "SOAP", label: "SOAP", desc: "Subjective · Objective · Assessment · Plan" },
  { id: "DAP", label: "DAP", desc: "Data · Assessment · Plan" },
  { id: "BIRP", label: "BIRP", desc: "Behavior · Intervention · Response · Plan" },
] as const;

function NewNoteInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const preselectedSessionId = searchParams.get("session_id");

  const [sessions, setSessions] = useState<any[]>([]);
  const [selectedSession, setSelectedSession] = useState<any>(null);
  const [search, setSearch] = useState("");
  const [format, setFormat] = useState<"SOAP" | "DAP" | "BIRP">("SOAP");
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState<"ai" | "blank" | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        if (preselectedSessionId) {
          const s = await sessionsAPI.get(preselectedSessionId).catch(() => null);
          if (!cancelled && s) setSelectedSession(s);
        }
        const list: any = await sessionsAPI.list({ status: "completed", limit: 50 }).catch(() => []);
        const rows = Array.isArray(list) ? list : list?.sessions || list?.data || [];
        if (!cancelled) setSessions(rows);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [preselectedSessionId]);

  const filtered = sessions.filter((s: any) =>
    !search || (s.patient_name || "").toLowerCase().includes(search.toLowerCase()),
  );

  const generateWithAI = useCallback(async () => {
    if (!selectedSession) return;
    setWorking("ai");
    setError(null);
    try {
      const result: any = await aiAPI.generateNote(selectedSession.id, format.toLowerCase());
      const note = result?.note || result;
      if (note?.id) {
        router.push(`/notes/${note.id}`);
      } else {
        setError("The note was generated but couldn't be opened — check the Notes list.");
        setWorking(null);
      }
    } catch (err: any) {
      setError(err?.message?.includes("transcript")
        ? "No transcript found for this session — start a blank note instead."
        : "AI generation failed. You can start a blank note and write it manually.");
      setWorking(null);
    }
  }, [selectedSession, format, router]);

  const startBlank = useCallback(async () => {
    if (!selectedSession) return;
    setWorking("blank");
    setError(null);
    try {
      const note: any = await notesAPI.create({ session_id: selectedSession.id, note_format: format.toLowerCase() });
      if (note?.id) {
        router.push(`/notes/${note.id}`);
      } else {
        setError("Couldn't create the note. Please try again.");
        setWorking(null);
      }
    } catch {
      setError("Couldn't create the note. Please try again.");
      setWorking(null);
    }
  }, [selectedSession, format, router]);

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <Link href="/notes" className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 mb-4">
        <ArrowLeft className="w-4 h-4" /> Back to notes
      </Link>

      <h1 className="text-xl font-bold text-slate-900 mb-1">New clinical note</h1>
      <p className="text-sm text-slate-500 mb-6">Pick a completed session, choose a format, then generate with AI or start blank.</p>

      {/* Step 1 — session */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-card p-5 mb-4">
        <h2 className="text-sm font-semibold text-slate-900 mb-3">1 · Session</h2>
        {selectedSession ? (
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-primary text-white flex items-center justify-center text-xs font-bold">
                {getInitials(selectedSession.patient_name || "P")}
              </div>
              <div>
                <p className="text-sm font-medium text-slate-800">{selectedSession.patient_name || "Patient"}</p>
                <p className="text-xs text-slate-400 flex items-center gap-1">
                  <Calendar className="w-3 h-3" />
                  {selectedSession.scheduled_at ? formatDate(selectedSession.scheduled_at) : "—"}
                  {selectedSession.session_number ? ` · Session #${selectedSession.session_number}` : ""}
                </p>
              </div>
            </div>
            <button onClick={() => setSelectedSession(null)} className="text-xs text-slate-400 hover:text-slate-600 underline">
              Change
            </button>
          </div>
        ) : (
          <>
            <div className="relative mb-3">
              <Search className="w-4 h-4 text-slate-300 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by patient name…"
                className="w-full h-9 pl-9 pr-3 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-secondary"
              />
            </div>
            <div className="max-h-56 overflow-y-auto divide-y divide-slate-100 border border-slate-100 rounded-lg">
              {loading ? (
                <div className="p-4 text-sm text-slate-400">Loading completed sessions…</div>
              ) : filtered.length === 0 ? (
                <div className="p-4 text-sm text-slate-400">
                  No completed sessions yet — notes are written for sessions after they end.
                </div>
              ) : filtered.map((s: any) => (
                <button
                  key={s.id}
                  onClick={() => setSelectedSession(s)}
                  className="w-full flex items-center gap-3 p-3 hover:bg-slate-50 transition-colors text-left"
                >
                  <div className="w-8 h-8 rounded-full bg-primary text-white flex items-center justify-center text-xs font-bold shrink-0">
                    {getInitials(s.patient_name || "P")}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-slate-800 truncate">{s.patient_name || "Patient"}</p>
                    <p className="text-xs text-slate-400">
                      {s.scheduled_at ? formatDate(s.scheduled_at) : "—"}
                      {s.session_number ? ` · Session #${s.session_number}` : ""}
                      {s.note_id ? " · has a note" : ""}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Step 2 — format */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-card p-5 mb-4">
        <h2 className="text-sm font-semibold text-slate-900 mb-3">2 · Format</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          {FORMATS.map((f) => (
            <button
              key={f.id}
              onClick={() => setFormat(f.id)}
              className={cn(
                "border rounded-lg p-3 text-left transition-colors",
                format === f.id ? "border-secondary bg-secondary/5" : "border-slate-200 hover:border-slate-300"
              )}
            >
              <p className={cn("text-sm font-bold", format === f.id ? "text-secondary" : "text-slate-700")}>{f.label}</p>
              <p className="text-[11px] text-slate-400 mt-0.5">{f.desc}</p>
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 mb-4">
          <AlertTriangle className="w-4 h-4 text-amber-500 mt-0.5 shrink-0" />
          <p className="text-xs text-amber-700">{error}</p>
        </div>
      )}

      {/* Step 3 — create */}
      <div className="flex gap-3">
        <button
          onClick={generateWithAI}
          disabled={!selectedSession || working !== null}
          className="flex-1 h-11 bg-secondary text-white rounded-xl text-sm font-semibold hover:bg-secondary/90 transition-colors disabled:opacity-40 flex items-center justify-center gap-2"
        >
          <Brain className="w-4 h-4" />
          {working === "ai" ? "Generating from transcript…" : "Generate with AI"}
        </button>
        <button
          onClick={startBlank}
          disabled={!selectedSession || working !== null}
          className="flex-1 h-11 border border-slate-200 text-slate-700 rounded-xl text-sm font-medium hover:bg-slate-50 transition-colors disabled:opacity-40 flex items-center justify-center gap-2"
        >
          <FileText className="w-4 h-4" />
          {working === "blank" ? "Creating…" : "Start blank"}
        </button>
      </div>
    </div>
  );
}

export default function NewNotePage() {
  return (
    <Suspense fallback={<div className="p-6 text-sm text-slate-400">Loading…</div>}>
      <NewNoteInner />
    </Suspense>
  );
}
