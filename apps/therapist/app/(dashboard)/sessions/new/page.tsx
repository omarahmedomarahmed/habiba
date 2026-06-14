"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft, Video, Users, Copy, Check, Mail, X, Send,
  Calendar, Clock, Link2, Loader2, User, Phone, Play
} from "lucide-react";
import { sessionsAPI } from "@/lib/api";
import { cn } from "@/lib/utils";

type SessionMode = "online" | "offline";

export default function NewSessionPage() {
  const router = useRouter();

  // Mode toggle
  const [mode, setMode] = useState<SessionMode>("online");

  // Shared form state
  const [title, setTitle] = useState("Therapy Session");
  const [sessionDate, setSessionDate] = useState("");
  const [sessionTime, setSessionTime] = useState(() => {
    const now = new Date();
    now.setMinutes(now.getMinutes() + 5);
    return now.toTimeString().slice(0, 5);
  });

  // Online mode: invite emails
  const [emailInput, setEmailInput] = useState("");
  const [inviteEmails, setInviteEmails] = useState<string[]>([]);

  // Offline mode: patient details
  const [patientName, setPatientName] = useState("");
  const [patientEmail, setPatientEmail] = useState("");

  // Post-create state
  const [created, setCreated] = useState(false);
  const [sessionId, setSessionId] = useState("");
  const [joinToken, setJoinToken] = useState("");
  const [joinUrl, setJoinUrl] = useState("");
  const [copied, setCopied] = useState(false);

  // Loading states
  const [isCreating, setIsCreating] = useState(false);
  const [isSendingInvites, setIsSendingInvites] = useState(false);
  const [invitesSent, setInvitesSent] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const addEmail = () => {
    const email = emailInput.trim().toLowerCase();
    if (email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && !inviteEmails.includes(email)) {
      setInviteEmails(prev => [...prev, email]);
      setEmailInput("");
    }
  };

  const removeEmail = (email: string) => {
    setInviteEmails(prev => prev.filter(e => e !== email));
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      addEmail();
    }
  };

  const copyLink = async () => {
    await navigator.clipboard.writeText(joinUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleCreateOnline = async () => {
    setIsCreating(true);
    setCreateError(null);
    try {
      const today = new Date().toISOString().split("T")[0];
      const date = sessionDate || today;
      const scheduledAt = new Date(`${date}T${sessionTime}:00`).toISOString();

      const res = await sessionsAPI.create({
        title: title || "Therapy Session",
        scheduled_at: scheduledAt,
        session_type: "individual",
        modality: "video",
        scribe_enabled: true,
      });

      const data = (res as any)?.data ?? res;
      const session = (data?.session ?? data) as any;
      const id = session?.id;
      const token = session?.join_token;

      if (!id) throw new Error("Session creation failed");

      const origin = typeof window !== "undefined" ? window.location.origin : "https://app.24therapy.ai";
      const url = `${origin}/join/${token || id}`;

      setSessionId(id);
      setJoinToken(token || id);
      setJoinUrl(url);
      setCreated(true);
    } catch (err: any) {
      const msg = err?.data?.message || err?.message || "Failed to create session";
      setCreateError(msg.includes("PAYMENT_REQUIRED") ? "Please pay your outstanding bill to create new sessions." : msg);
    } finally {
      setIsCreating(false);
    }
  };

  const handleStartOffline = async () => {
    if (!patientName.trim()) return;
    setIsCreating(true);
    setCreateError(null);
    try {
      const today = new Date().toISOString().split("T")[0];
      const date = sessionDate || today;
      const scheduledAt = new Date(`${date}T${sessionTime}:00`).toISOString();

      const res = await sessionsAPI.create({
        title: title || "In-Person Session",
        scheduled_at: scheduledAt,
        session_type: "individual",
        modality: "in_person",
        scribe_enabled: true,
        patient_name: patientName.trim(),
        patient_email: patientEmail.trim() || undefined,
        auto_start: true,
        auto_generate_note: true,
      });

      const data = (res as any)?.data ?? res;
      const session = (data?.session ?? data) as any;
      const id = session?.id;

      if (!id) throw new Error("Session creation failed");

      // For offline sessions: go straight to room
      router.push(`/sessions/${id}/room`);
    } catch (err: any) {
      const msg = err?.data?.message || err?.message || "Failed to start session";
      setCreateError(msg.includes("PAYMENT_REQUIRED") ? "Please pay your outstanding bill to create new sessions." : msg);
      setIsCreating(false);
    }
  };

  const handleSendInvites = async () => {
    if (inviteEmails.length === 0) return;
    setIsSendingInvites(true);
    try {
      await sessionsAPI.invite(sessionId, inviteEmails);
      setInvitesSent(true);
    } catch {
      // non-critical
    } finally {
      setIsSendingInvites(false);
    }
  };

  // After online session is created → show share screen
  if (created) {
    return (
      <div className="p-6 max-w-xl mx-auto">
        <div className="flex items-center gap-3 mb-6">
          <Link href="/sessions" className="p-2 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition-colors">
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div>
            <h1 className="text-xl font-bold text-slate-900">Session Ready</h1>
            <p className="text-sm text-slate-500">Share the link to invite anyone</p>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 shadow-card p-6 mb-4">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2.5 bg-green-100 rounded-xl">
              <Link2 className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <div className="font-semibold text-slate-900">Session join link</div>
              <div className="text-xs text-slate-500">Anyone with this link can join</div>
            </div>
          </div>

          <div className="flex items-center gap-2 p-3 bg-slate-50 border border-slate-200 rounded-xl mb-4">
            <span className="flex-1 text-sm text-slate-600 truncate font-mono">{joinUrl}</span>
            <button
              onClick={copyLink}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-secondary text-white text-xs font-semibold rounded-lg hover:bg-secondary/90 transition-colors shrink-0"
            >
              {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              {copied ? "Copied!" : "Copy"}
            </button>
          </div>

          <button
            onClick={() => router.push(`/sessions/${sessionId}/room`)}
            className="w-full py-3 bg-secondary text-white rounded-xl text-sm font-semibold hover:bg-secondary/90 transition-colors flex items-center justify-center gap-2"
          >
            <Video className="w-4 h-4" />
            Start Session Now
          </button>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 shadow-card p-6">
          <div className="flex items-center gap-2 mb-3">
            <Mail className="w-4 h-4 text-slate-500" />
            <span className="text-sm font-semibold text-slate-800">Invite by email (optional)</span>
          </div>

          {invitesSent ? (
            <div className="flex items-center gap-2 text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg p-3">
              <Check className="w-4 h-4" />
              Invites sent to {inviteEmails.length} {inviteEmails.length === 1 ? 'person' : 'people'}
            </div>
          ) : (
            <>
              {inviteEmails.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-3">
                  {inviteEmails.map(email => (
                    <span key={email} className="flex items-center gap-1.5 px-2.5 py-1 bg-secondary/10 text-secondary text-xs font-medium rounded-full border border-secondary/20">
                      {email}
                      <button onClick={() => removeEmail(email)} className="hover:text-red-500 transition-colors">
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                </div>
              )}
              <div className="flex gap-2">
                <input
                  value={emailInput}
                  onChange={(e) => setEmailInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  onBlur={addEmail}
                  placeholder="patient@example.com"
                  type="email"
                  className="flex-1 px-3 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-secondary/30"
                />
                <button
                  onClick={addEmail}
                  disabled={!emailInput.trim()}
                  className="px-3 py-2.5 bg-slate-100 text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-200 transition-colors disabled:opacity-40"
                >
                  Add
                </button>
              </div>
              {inviteEmails.length > 0 && (
                <button
                  onClick={handleSendInvites}
                  disabled={isSendingInvites}
                  className="mt-3 w-full flex items-center justify-center gap-2 py-2.5 bg-slate-900 text-white text-sm font-semibold rounded-xl hover:bg-slate-800 transition-colors disabled:opacity-60"
                >
                  {isSendingInvites ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                  Send {inviteEmails.length} Invite{inviteEmails.length !== 1 ? 's' : ''}
                </button>
              )}
            </>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 max-w-xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/sessions" className="p-2 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition-colors">
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <div>
          <h1 className="text-xl font-bold text-slate-900">New Session</h1>
          <p className="text-sm text-slate-500">Choose how you&apos;re meeting</p>
        </div>
      </div>

      {/* Mode Toggle */}
      <div className="grid grid-cols-2 gap-3 mb-5">
        <button
          onClick={() => setMode("online")}
          className={cn(
            "flex flex-col items-center gap-2 p-4 rounded-2xl border-2 transition-all",
            mode === "online"
              ? "border-secondary bg-secondary/5 text-secondary"
              : "border-slate-200 bg-white text-slate-500 hover:border-slate-300"
          )}
        >
          <div className={cn("p-3 rounded-xl", mode === "online" ? "bg-secondary/10" : "bg-slate-100")}>
            <Video className="w-6 h-6" />
          </div>
          <div className="text-center">
            <div className="font-semibold text-sm">Online Session</div>
            <div className="text-xs opacity-70 mt-0.5">Share join link</div>
          </div>
        </button>

        <button
          onClick={() => setMode("offline")}
          className={cn(
            "flex flex-col items-center gap-2 p-4 rounded-2xl border-2 transition-all",
            mode === "offline"
              ? "border-emerald-500 bg-emerald-50 text-emerald-700"
              : "border-slate-200 bg-white text-slate-500 hover:border-slate-300"
          )}
        >
          <div className={cn("p-3 rounded-xl", mode === "offline" ? "bg-emerald-100" : "bg-slate-100")}>
            <Users className="w-6 h-6" />
          </div>
          <div className="text-center">
            <div className="font-semibold text-sm">In-Person</div>
            <div className="text-xs opacity-70 mt-0.5">Start immediately</div>
          </div>
        </button>
      </div>

      <div className="space-y-4">
        {/* Session Title */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-card p-5">
          <label className="block text-sm font-semibold text-slate-800 mb-2">Session Title</label>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={mode === "offline" ? "In-Person Session" : "Therapy Session"}
            className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-secondary/30"
          />
        </div>

        {/* Offline mode: patient details */}
        {mode === "offline" && (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-card p-5">
            <h3 className="text-sm font-semibold text-slate-800 mb-3 flex items-center gap-2">
              <User className="w-4 h-4 text-emerald-600" />
              Patient Details
            </h3>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1.5">Patient name <span className="text-red-500">*</span></label>
                <input
                  value={patientName}
                  onChange={(e) => setPatientName(e.target.value)}
                  placeholder="Full name"
                  className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1.5">
                  Patient email <span className="text-slate-400 font-normal">(optional — for sending report)</span>
                </label>
                <input
                  value={patientEmail}
                  onChange={(e) => setPatientEmail(e.target.value)}
                  placeholder="patient@example.com"
                  type="email"
                  className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
                />
              </div>
            </div>
          </div>
        )}

        {/* Date & Time */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-card p-5">
          <h3 className="text-sm font-semibold text-slate-800 mb-3">When?</h3>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1.5 flex items-center gap-1">
                <Calendar className="w-3 h-3" /> Date
              </label>
              <input
                type="date"
                value={sessionDate}
                onChange={(e) => setSessionDate(e.target.value)}
                min={new Date().toISOString().split("T")[0]}
                className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-secondary/30"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1.5 flex items-center gap-1">
                <Clock className="w-3 h-3" /> Time
              </label>
              <input
                type="time"
                value={sessionTime}
                onChange={(e) => setSessionTime(e.target.value)}
                className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-secondary/30"
              />
            </div>
          </div>
        </div>

        {/* Online mode: invite emails */}
        {mode === "online" && (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-card p-5">
            <label className="block text-sm font-semibold text-slate-800 mb-2">
              Invite patients by email <span className="text-slate-400 font-normal text-xs">(optional — you can also share link after)</span>
            </label>
            {inviteEmails.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-3">
                {inviteEmails.map(email => (
                  <span key={email} className="flex items-center gap-1.5 px-2.5 py-1 bg-secondary/10 text-secondary text-xs font-medium rounded-full border border-secondary/20">
                    {email}
                    <button onClick={() => removeEmail(email)} className="hover:text-red-500 transition-colors">
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}
            <div className="flex gap-2">
              <input
                value={emailInput}
                onChange={(e) => setEmailInput(e.target.value)}
                onKeyDown={handleKeyDown}
                onBlur={addEmail}
                placeholder="patient@example.com, press Enter to add"
                type="email"
                className="flex-1 px-3 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-secondary/30"
              />
              <button
                onClick={addEmail}
                disabled={!emailInput.trim()}
                className="px-3 py-2.5 bg-slate-100 text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-200 transition-colors disabled:opacity-40"
              >
                Add
              </button>
            </div>
          </div>
        )}

        {createError && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">{createError}</div>
        )}

        <div className="flex gap-3">
          <Link
            href="/sessions"
            className="flex-1 py-3 border border-slate-200 rounded-xl text-sm font-semibold text-slate-600 hover:bg-slate-50 text-center transition-colors"
          >
            Cancel
          </Link>

          {mode === "online" ? (
            <button
              onClick={handleCreateOnline}
              disabled={isCreating}
              className="flex-1 py-3 bg-secondary text-white rounded-xl text-sm font-semibold hover:bg-secondary/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {isCreating ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> Creating...</>
              ) : (
                <><Video className="w-4 h-4" /> Create Session</>
              )}
            </button>
          ) : (
            <button
              onClick={handleStartOffline}
              disabled={isCreating || !patientName.trim()}
              className="flex-1 py-3 bg-emerald-600 text-white rounded-xl text-sm font-semibold hover:bg-emerald-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {isCreating ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> Starting...</>
              ) : (
                <><Play className="w-4 h-4" /> Start Session Now</>
              )}
            </button>
          )}
        </div>

        {mode === "offline" && (
          <p className="text-center text-xs text-slate-400">
            AI will record and transcribe the session. Notes generated automatically after you end.
          </p>
        )}
      </div>
    </div>
  );
}
