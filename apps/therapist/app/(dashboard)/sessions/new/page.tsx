"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft, Calendar, Clock, Video, User, Search,
  CheckCircle2, ChevronDown, AlertCircle, Brain, Phone, Loader2
} from "lucide-react";
import { cn, formatDate } from "@/lib/utils";
import { patientsAPI, sessionsAPI } from "@/lib/api";

const SESSION_TYPES = [
  { id: "individual", label: "Individual Therapy" },
  { id: "couples", label: "Couples Therapy" },
  { id: "group", label: "Group Session" },
  { id: "family", label: "Family Session" },
  { id: "intake", label: "Initial Assessment" },
];

const DURATIONS = [25, 50, 53, 80, 90];

export default function NewSessionPage() {
  const router = useRouter();
  const [patientSearch, setPatientSearch] = useState("");
  const [selectedPatient, setSelectedPatient] = useState<string | null>(null);
  const [sessionType, setSessionType] = useState("individual");
  const [sessionDate, setSessionDate] = useState("");
  const [sessionTime, setSessionTime] = useState("10:00");
  const [duration, setDuration] = useState(50);
  const [format, setFormat] = useState<"video" | "phone" | "in_person">("video");
  const [enableRecording, setEnableRecording] = useState(true);
  const [enableAI, setEnableAI] = useState(true);
  const [notes, setNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [patients, setPatients] = useState<any[]>([]);
  const [patientsLoading, setPatientsLoading] = useState(true);

  useEffect(() => {
    const fetchPatients = async () => {
      try {
        const data = await patientsAPI.list({ status: 'active', limit: 100 });
        const items = Array.isArray(data) ? data : (data as any)?.data ?? [];
        setPatients(items.map((p: any) => ({
          id: p.id,
          name: `${p.first_name} ${p.last_name || ''}`.trim(),
          diagnosis: p.primary_diagnosis || '',
          sessions: p.sessions_count || 0,
          risk: p.risk_level || 'low',
        })));
      } catch {
        // non-critical — keep empty list
      } finally {
        setPatientsLoading(false);
      }
    };
    fetchPatients();
  }, []);

  const filteredPatients = patients.filter(p =>
    p.name.toLowerCase().includes(patientSearch.toLowerCase())
  );

  const selectedPatientData = patients.find(p => p.id === selectedPatient);

  const [pendingBill, setPendingBill] = useState<{ amount_due: number; checkout_url: string | null } | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPatient || !sessionDate) return;
    setIsSubmitting(true);
    setSubmitError(null);
    setPendingBill(null);
    try {
      const scheduledAt = new Date(`${sessionDate}T${sessionTime}:00`).toISOString();
      const session = await sessionsAPI.create({
        patient_id: selectedPatient,
        session_type: sessionType,
        scheduled_at: scheduledAt,
        duration_minutes: duration,
        format,
        notes: notes || undefined,
        enable_recording: enableRecording,
        ai_enabled: enableAI,
      });
      const newId = (session as any).id;
      if (newId) router.push(`/sessions/${newId}/prepare`);
      else router.push('/sessions');
    } catch (err: any) {
      const msg: string = err?.data?.message || err?.message || '';
      const errData = err?.data || {};
      if (msg.includes('PAYMENT_REQUIRED') || (err?.status === 402 && errData.error === 'payment_required' && errData.amount_due)) {
        setPendingBill({ amount_due: errData.amount_due, checkout_url: errData.checkout_url });
        setSubmitError('You have an unpaid session bill. Pay to schedule new sessions.');
      } else if (msg.includes('UPGRADE_REQUIRED') || msg.includes('SESSION_LIMIT_REACHED') || err?.status === 402) {
        setSubmitError('You have reached your session limit. Please upgrade your plan.');
      } else {
        setSubmitError(msg || 'Failed to create session. Please try again.');
      }
      setIsSubmitting(false);
    }
  };

  return (
    <div className="p-6 max-w-2xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <Link href="/sessions" className="p-2 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition-colors">
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <div>
          <h1 className="text-xl font-bold text-slate-900">Schedule Session</h1>
          <p className="text-sm text-slate-500">Book a new therapy session</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Patient Selection */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-card p-5">
          <label className="block text-sm font-semibold text-slate-800 mb-3">
            Patient <span className="text-red-500">*</span>
          </label>

          {selectedPatientData ? (
            <div className="flex items-center gap-3 p-3 bg-secondary/5 border border-secondary/20 rounded-lg">
              <div className="w-10 h-10 rounded-full bg-primary text-white flex items-center justify-center text-sm font-bold">
                {selectedPatientData.name.charAt(0)}
              </div>
              <div className="flex-1">
                <div className="font-medium text-slate-800">{selectedPatientData.name}</div>
                <div className="text-xs text-slate-500">{selectedPatientData.diagnosis} · {selectedPatientData.sessions} sessions</div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedPatient(null)}
                className="text-xs text-slate-400 hover:text-slate-600"
              >
                Change
              </button>
            </div>
          ) : (
            <div>
              <div className="relative mb-2">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  value={patientSearch}
                  onChange={(e) => setPatientSearch(e.target.value)}
                  placeholder="Search patients..."
                  className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-secondary/30"
                />
              </div>
              <div className="space-y-1 max-h-48 overflow-y-auto">
                {patientsLoading ? (
                  <div className="flex items-center justify-center py-4">
                    <Loader2 className="w-5 h-5 animate-spin text-slate-400" />
                  </div>
                ) : filteredPatients.length === 0 ? (
                  <p className="text-sm text-slate-400 text-center py-4">
                    {patientSearch ? 'No patients match your search' : 'No active patients found'}
                  </p>
                ) : null}
                {filteredPatients.map(patient => (
                  <button
                    key={patient.id}
                    type="button"
                    onClick={() => setSelectedPatient(patient.id)}
                    className="w-full flex items-center gap-3 p-2.5 rounded-lg hover:bg-slate-50 text-left transition-colors"
                  >
                    <div className="w-8 h-8 rounded-full bg-primary text-white flex items-center justify-center text-xs font-bold">
                      {patient.name.charAt(0)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-slate-800">{patient.name}</div>
                      <div className="text-xs text-slate-500">{patient.diagnosis}</div>
                    </div>
                    {patient.risk === "high" && (
                      <span className="text-[10px] bg-red-100 text-red-600 px-1.5 py-0.5 rounded font-semibold shrink-0">HIGH RISK</span>
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Session Details */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-card p-5">
          <h3 className="text-sm font-semibold text-slate-800 mb-4">Session Details</h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1.5">Date <span className="text-red-500">*</span></label>
              <input
                type="date"
                value={sessionDate}
                onChange={(e) => setSessionDate(e.target.value)}
                required
                min={new Date().toISOString().split("T")[0]}
                className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-secondary/30"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1.5">Time <span className="text-red-500">*</span></label>
              <input
                type="time"
                value={sessionTime}
                onChange={(e) => setSessionTime(e.target.value)}
                required
                className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-secondary/30"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1.5">Session Type</label>
              <select
                value={sessionType}
                onChange={(e) => setSessionType(e.target.value)}
                className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-secondary/30"
              >
                {SESSION_TYPES.map(t => (
                  <option key={t.id} value={t.id}>{t.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1.5">Duration (minutes)</label>
              <select
                value={duration}
                onChange={(e) => setDuration(Number(e.target.value))}
                className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-secondary/30"
              >
                {DURATIONS.map(d => (
                  <option key={d} value={d}>{d} minutes</option>
                ))}
              </select>
            </div>
          </div>

          {/* Format */}
          <div className="mt-4">
            <label className="block text-xs font-medium text-slate-600 mb-2">Session Format</label>
            <div className="flex gap-2">
              {[
                { id: "video", label: "Video", icon: Video },
                { id: "phone", label: "Phone", icon: Phone },
                { id: "in_person", label: "In Person", icon: User },
              ].map(({ id, label, icon: Icon }) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setFormat(id as any)}
                  className={cn(
                    "flex items-center gap-2 px-4 py-2 rounded-lg border text-sm font-medium transition-all",
                    format === id
                      ? "bg-secondary text-white border-secondary"
                      : "border-slate-200 text-slate-600 hover:border-secondary/30"
                  )}
                >
                  <Icon className="w-3.5 h-3.5" />
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* AI Settings */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-card p-5">
          <h3 className="text-sm font-semibold text-slate-800 mb-4 flex items-center gap-2">
            <Brain className="w-4 h-4 text-accent" />
            AI & Recording Settings
          </h3>
          <div className="space-y-3">
            {[
              {
                label: "AI Session Copilot", desc: "Real-time suggestions and clinical support during session",
                value: enableAI, setter: setEnableAI,
              },
              {
                label: "Session Recording", desc: "Record audio/video for transcription and note generation",
                value: enableRecording, setter: setEnableRecording,
              },
            ].map(({ label, desc, value, setter }) => (
              <div key={label} className="flex items-center justify-between py-2 border-b border-slate-100 last:border-0">
                <div>
                  <div className="text-sm font-medium text-slate-800">{label}</div>
                  <div className="text-xs text-slate-500 mt-0.5">{desc}</div>
                </div>
                <button
                  type="button"
                  onClick={() => setter(!value)}
                  className={cn(
                    "relative w-10 h-5.5 rounded-full transition-colors",
                    value ? "bg-secondary" : "bg-slate-200"
                  )}
                  style={{ height: '22px', width: '40px' }}
                >
                  <span
                    className={cn(
                      "absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform",
                      value ? "translate-x-5" : "translate-x-0.5"
                    )}
                  />
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Notes */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-card p-5">
          <label className="block text-sm font-semibold text-slate-800 mb-3">Session Notes (Optional)</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Add any pre-session notes, agenda items, or preparation notes..."
            rows={3}
            className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-secondary/30 resize-none"
          />
        </div>

        {submitError && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
            <p className="font-semibold mb-1">{submitError}</p>
            {pendingBill && (
              <div className="mt-2 flex flex-col gap-2">
                {pendingBill.checkout_url ? (
                  <a
                    href={pendingBill.checkout_url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-2 bg-red-600 text-white font-semibold px-4 py-2 rounded-lg text-sm hover:bg-red-700 transition-colors w-fit"
                  >
                    Pay ${Number(pendingBill.amount_due).toFixed(2)} to unlock sessions
                  </a>
                ) : (
                  <Link href="/settings?tab=billing" className="underline text-red-600">View bill in settings →</Link>
                )}
                <Link href="/settings?tab=usage" className="text-xs text-[#1F5EFF] hover:underline">
                  Save 50% — Starter $59/mo (20 sessions included)
                </Link>
              </div>
            )}
            {!pendingBill && submitError.includes('limit') && (
              <Link href="/settings?tab=usage" className="ml-1 underline font-semibold">Upgrade plan →</Link>
            )}
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center gap-3">
          <Link
            href="/sessions"
            className="flex-1 py-3 border border-slate-200 rounded-xl text-sm font-semibold text-slate-600 hover:bg-slate-50 text-center transition-colors"
          >
            Cancel
          </Link>
          <button
            type="submit"
            disabled={!selectedPatient || !sessionDate || isSubmitting}
            className="flex-1 py-3 bg-secondary text-white rounded-xl text-sm font-semibold hover:bg-secondary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting ? "Scheduling..." : "Schedule Session"}
          </button>
        </div>
      </form>
    </div>
  );
}

// Reviewed: 2026-06-13 — 24Therapy audit
