"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { getSocket, disconnectSocket } from "@/lib/socket";
import { useAuthStore } from "@/lib/store";
import {
  Mic, MicOff, Video as VideoIcon, VideoOff, PhoneOff, Settings2,
  Brain, FileText, Flag, Bookmark, Plus, ChevronRight, ChevronDown,
  AlertTriangle, MessageSquare, Clock, Users, Maximize2, Minimize2,
  Zap, Target, Pill, Activity, TrendingDown, Send, X, CheckCircle2,
  MoreHorizontal, Volume2, Share2, Edit3, Eye
} from "lucide-react";
import { cn, formatSessionTime, getInitials } from "@/lib/utils";
import { useSessionRoomStore } from "@/lib/store";
import { sessionsAPI, aiAPI, patientsAPI, billingAPI } from "@/lib/api";
import { getApiUrl } from "@/lib/env";

type BillingOutcome =
  | { state: "loading" }
  | { state: "unavailable" }
  | {
      state: "ready";
      status: string; // waived | pending | included | paid
      amount_due: number;
      description: string;
      checkout_url: string | null;
      charge_id: string;
      quota_remaining: number | null;
    };

const TAGS = ["symptom", "mood", "medication", "relationship", "goal", "trigger", "risk", "trauma", "sleep", "work", "family", "progress"];

const tagColors: Record<string, string> = {
  anxiety: "tag-symptom",
  work: "bg-blue-50 text-blue-700 border border-blue-100",
  progress: "tag-goal",
  coping: "tag-goal",
  cognitive_distortion: "tag-risk",
  perfectionism: "tag-risk",
  symptom: "tag-symptom",
  mood: "tag-mood",
  medication: "tag-medication",
  family: "tag-family",
  trigger: "tag-risk",
};

const copilotTypeColors: Record<string, string> = {
  question: "bg-blue-50 text-blue-700 border border-blue-100",
  observation: "bg-green-50 text-green-700 border border-green-100",
  risk: "bg-red-50 text-red-700 border border-red-100",
  technique: "bg-purple-50 text-purple-700 border border-purple-100",
  memory: "bg-amber-50 text-amber-700 border border-amber-100",
};

interface CrisisAlert {
  session_id: string;
  patient_id: string;
  risk_level: string;
  risk_type: string;
  indicators: string[];
  confidence: number;
  recommended_action: string;
  timestamp: string;
  conversation_id?: string;
}

export default function SessionRoomPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const roomStore = useSessionRoomStore();
  const { accessToken } = useAuthStore();

  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [sessionDuration, setSessionDuration] = useState(0);
  const [isLive, setIsLive] = useState(false);
  const [activeRightTab, setActiveRightTab] = useState<"copilot" | "notes" | "risk">("copilot");
  const [activeLeftTab, setActiveLeftTab] = useState<"context" | "transcript">("transcript");
  const [note, setNote] = useState("");
  const [sessionPhase, setSessionPhase] = useState<"waiting" | "live" | "ended">("waiting");
  const [dismissedSuggestions, setDismissedSuggestions] = useState<string[]>([]);
  const [showEndModal, setShowEndModal] = useState(false);
  const [isEnding, setIsEnding] = useState(false);
  const [endError, setEndError] = useState<string | null>(null);
  const [startError, setStartError] = useState<string | null>(null);
  const [billingOutcome, setBillingOutcome] = useState<BillingOutcome | null>(null);
  const [noteType, setNoteType] = useState<"SOAP" | "DAP" | "BIRP">("SOAP");
  const [isGeneratingNote, setIsGeneratingNote] = useState(false);
  const [generatedNote, setGeneratedNote] = useState("");
  const [generatedNoteId, setGeneratedNoteId] = useState<string | null>(null);
  const [noteApproved, setNoteApproved] = useState(false);
  const [riskResult, setRiskResult] = useState<Record<string, unknown> | null>(null);
  const [isCheckingRisk, setIsCheckingRisk] = useState(false);
  const [crisisAlert, setCrisisAlert] = useState<CrisisAlert | null>(null);
  const [emotionalContext, setEmotionalContext] = useState<{
    emotion: string; intensity: string; minimizing_language: boolean;
    trajectory: string; clinical_note: string; intervention_suggestion: string;
  } | null>(null);
  const transcriptRef = useRef<HTMLDivElement>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const [liveSession, setLiveSession] = useState<Record<string, unknown> | null>(null);
  const [patientCtx, setPatientCtx] = useState<{
    name: string; diagnoses: string[]; medications: any[]; goals: any[];
    risk_factors: string[]; last_session_summary: string; last_phq9: number | null; last_gad7: number | null;
  } | null>(null);

  useEffect(() => {
    if (!id) return;
    sessionsAPI.get(id).then((s: any) => {
      setLiveSession(s);
      // Resume the correct phase from persisted status (e.g. rejoining a live
      // session after a refresh, or opening an already-completed session).
      if (s?.status === 'in_progress') {
        setSessionPhase('live');
        setIsLive(true);
      } else if (s?.status === 'completed' || s?.status === 'archived') {
        setSessionPhase('ended');
      }
      if (s?.patient_id) {
        Promise.all([
          patientsAPI.get(s.patient_id as string).catch(() => null),
          patientsAPI.goals(s.patient_id as string).catch(() => ({ data: [] })),
          patientsAPI.medications(s.patient_id as string).catch(() => ({ data: [] })),
          patientsAPI.assessments(s.patient_id as string).catch(() => ({ data: [] })),
        ]).then(([patient, goalsRes, medsRes, assessRes]: any[]) => {
          const assessments: any[] = assessRes?.data || [];
          const phq = assessments.find((a: any) => a.assessment_type === 'phq9');
          const gad = assessments.find((a: any) => a.assessment_type === 'gad7');
          setPatientCtx({
            name: patient ? `${patient.first_name} ${patient.last_name}` : (s.patient_name as string) || 'Patient',
            diagnoses: (patient?.diagnoses as string[]) || [],
            medications: (medsRes?.data as any[]) || [],
            goals: (goalsRes?.data as any[]) || [],
            risk_factors: (patient?.risk_factors as string[]) || [],
            last_session_summary: (patient?.last_session_summary as string) || '',
            last_phq9: phq?.score ?? null,
            last_gad7: gad?.score ?? null,
          });
        });
      }
    }).catch(() => { /* session not found */ });
  }, [id]);

  const patientName = patientCtx?.name ?? (liveSession?.patient_name as string) ?? 'Patient';
  const session = liveSession ? {
    id: liveSession.id as string,
    video_room_url: (liveSession.video_room_url as string) || undefined,
    patient: { id: (liveSession.patient_id as string) ?? '', name: patientName },
    scheduled_time: liveSession.scheduled_at
      ? new Date(liveSession.scheduled_at as string).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      : '',
    duration: (liveSession.duration_minutes as number) || 50,
  } : null;

  // WebSocket: listen for crisis_alert events during live session
  useEffect(() => {
    if (!accessToken || sessionPhase !== 'live') return;
    const socket = getSocket(accessToken);

    const handleCrisisAlert = (alert: CrisisAlert) => {
      if (alert.session_id === id) {
        setCrisisAlert(alert);
      }
    };

    const handleEmotional = (data: typeof emotionalContext) => setEmotionalContext(data);

    socket.on('crisis_alert', handleCrisisAlert);
    socket.on('emotional_context', handleEmotional);
    return () => {
      socket.off('crisis_alert', handleCrisisAlert);
      socket.off('emotional_context', handleEmotional);
    };
  }, [accessToken, sessionPhase, id]);

  // Disconnect socket when session ends or component unmounts
  useEffect(() => {
    return () => {
      if (sessionPhase === 'ended') disconnectSocket();
    };
  }, [sessionPhase]);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isLive) {
      interval = setInterval(() => setSessionDuration((d) => d + 1), 1000);
    }
    return () => clearInterval(interval);
  }, [isLive]);

  useEffect(() => {
    if (transcriptRef.current) {
      transcriptRef.current.scrollTop = transcriptRef.current.scrollHeight;
    }
  }, []);

  const startSession = async () => {
    if (!id) return;
    setStartError(null);
    // Persist the status transition FIRST — the billing engine, transcripts and
    // monthly counts all key off real session status in the database.
    try {
      await sessionsAPI.updateStatus(id, "in_progress");
    } catch (err: any) {
      const msg = String(err?.message || "");
      // Already in progress (e.g. rejoining the room) — proceed.
      if (!msg.includes("'in_progress' to 'in_progress'")) {
        setStartError(msg.includes("Cannot transition")
          ? `This session can't be started (${msg.replace(/.*Cannot transition/i, "cannot transition")}). It may already be completed or cancelled.`
          : "Could not start the session. Check your connection and try again.");
        return;
      }
    }
    setSessionPhase("live");
    setIsLive(true);
    // Start browser audio capture for live transcription
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
      recorder.ondataavailable = async (e) => {
        if (e.data.size < 500 || isMuted || !accessToken) return;
        try {
          const form = new FormData();
          form.append('audio', e.data, 'chunk.webm');
          await fetch(
            `${getApiUrl()}/ai/sessions/${id}/transcribe`,
            { method: 'POST', headers: { Authorization: `Bearer ${accessToken}` }, body: form }
          );
        } catch { /* transcription failure is non-fatal */ }
      };
      recorder.start(5000); // 5-second chunks
      recorderRef.current = recorder;
    } catch { /* mic permission denied — continue without audio */ }
  };

  // Opens the end-session confirmation modal (nothing is persisted yet).
  const endSession = () => {
    setEndError(null);
    setShowEndModal(true);
  };

  const stopRecorder = () => {
    if (recorderRef.current && recorderRef.current.state !== 'inactive') {
      recorderRef.current.stop();
      recorderRef.current.stream?.getTracks().forEach(t => t.stop());
    }
  };

  // The billing hook on the backend is fire-and-forget, so the charge row can
  // land a moment after the status PATCH returns — poll usage briefly.
  const pollBillingOutcome = async (sessionId: string) => {
    setBillingOutcome({ state: "loading" });
    for (let attempt = 0; attempt < 4; attempt++) {
      try {
        const usage = await billingAPI.usageMe();
        const fromHistory = (usage.charge_history || []).find((c: any) => c.session_id === sessionId);
        const fromPending = (usage.pending_bills || []).find((b: any) => b.session_id === sessionId);
        const charge: any = fromHistory || fromPending;
        if (charge) {
          setBillingOutcome({
            state: "ready",
            status: charge.status || (fromPending ? "pending" : "paid"),
            amount_due: Number(charge.amount_due_usd ?? 0),
            description: charge.description || "",
            checkout_url: charge.stripe_checkout_url ?? null,
            charge_id: charge.id,
            quota_remaining: usage.quota ? usage.quota.remaining : null,
          });
          return;
        }
      } catch { /* keep polling */ }
      await new Promise((r) => setTimeout(r, 1500));
    }
    setBillingOutcome({ state: "unavailable" });
  };

  const confirmEndSession = async () => {
    if (!id) return;
    setIsEnding(true);
    setEndError(null);
    try {
      await sessionsAPI.updateStatus(id, "completed");
    } catch (err: any) {
      const msg = String(err?.message || "");
      if (!msg.includes("to 'completed'") || msg.includes("Cannot transition")) {
        setEndError("Could not end the session. Check your connection and try again.");
        setIsEnding(false);
        return;
      }
    }
    stopRecorder();
    setIsLive(false);
    setSessionPhase("ended");
    setIsEnding(false);
    pollBillingOutcome(id);
  };

  const generateNote = async () => {
    if (!id) return;
    setIsGeneratingNote(true);
    try {
      const result: any = await aiAPI.generateNote(id, noteType.toLowerCase());
      const note = result?.note || result;
      setGeneratedNote(note?.raw_content || note?.content || note?.note_content || JSON.stringify(result, null, 2));
      if (note?.id) setGeneratedNoteId(note.id as string);
      setNoteApproved(note?.status === 'approved');
    } catch {
      setGeneratedNote('Note generation failed. Please try again.');
    } finally {
      setIsGeneratingNote(false);
    }
  };

  const approveGeneratedNote = async () => {
    if (!generatedNoteId) return;
    try {
      await aiAPI.approveNote(generatedNoteId, {});
      setNoteApproved(true);
    } catch { /* surfaced via unchanged button state */ }
  };

  const runRiskCheck = async () => {
    if (!id) return;
    setIsCheckingRisk(true);
    try {
      const result: any = await aiAPI.riskCheck(id);
      setRiskResult(result?.risk || result || {});
    } catch {
      setRiskResult({ error: true });
    } finally {
      setIsCheckingRisk(false);
    }
  };

  if (!session) {
    return (
      <div className="flex flex-col h-full bg-slate-900 items-center justify-center">
        <div className="w-8 h-8 border-2 border-secondary border-t-transparent rounded-full animate-spin mb-4" />
        <p className="text-slate-400 text-sm">Loading session…</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-slate-900">
      {/* Crisis Alert Modal — full-screen, cannot be dismissed without action */}
      {crisisAlert && (
        <div className="fixed inset-0 z-[9999] bg-red-950/95 flex items-center justify-center p-6">
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full p-8">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center">
                <AlertTriangle className="w-7 h-7 text-red-600" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-red-700">Crisis Alert Detected</h2>
                <span className={cn(
                  "inline-block px-2 py-0.5 rounded text-xs font-bold uppercase tracking-wide mt-1",
                  crisisAlert.risk_level === 'critical' ? 'bg-red-600 text-white' : 'bg-orange-500 text-white'
                )}>
                  {crisisAlert.risk_level} risk
                </span>
              </div>
            </div>

            <p className="text-slate-600 text-sm mb-4">
              AI has detected language indicating potential risk in this session.
              {crisisAlert.indicators?.length > 0 && (
                <span> Indicators: <span className="font-medium text-red-700">"{crisisAlert.indicators.join('", "')}"</span></span>
              )}
            </p>

            {crisisAlert.recommended_action && (
              <p className="text-slate-500 text-sm mb-6 italic">{crisisAlert.recommended_action}</p>
            )}

            <div className="flex flex-col gap-3">
              <a
                href="tel:988"
                className="flex items-center justify-center gap-2 px-5 py-3 bg-red-600 hover:bg-red-700 text-white rounded-xl font-bold text-base transition-colors"
                onClick={() => setCrisisAlert(null)}
              >
                Call 988 — Suicide & Crisis Lifeline
              </a>
              {crisisAlert.conversation_id && (
                <a
                  href={`/messages?conversation=${crisisAlert.conversation_id}&priority=crisis`}
                  className="flex items-center justify-center gap-2 px-5 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold text-base transition-colors"
                  onClick={() => setCrisisAlert(null)}
                >
                  <MessageSquare className="w-5 h-5" />
                  Open Crisis Chat with Patient
                </a>
              )}
              <button
                onClick={() => {
                  setActiveRightTab('risk');
                  setCrisisAlert(null);
                }}
                className="px-5 py-3 border-2 border-red-600 text-red-700 rounded-xl font-semibold hover:bg-red-50 transition-colors"
              >
                Open Crisis Protocol & Document Response
              </button>
            </div>

            <p className="text-xs text-slate-400 mt-4 text-center">
              This alert has been logged and sent to your organization admin.
            </p>
          </div>
        </div>
      )}
      {/* End Session Modal — confirm, then billing summary */}
      {showEndModal && (
        <div className="fixed inset-0 z-[9000] bg-black/60 backdrop-blur-sm flex items-center justify-center p-6">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6">
            {sessionPhase !== "ended" ? (
              <>
                <h2 className="text-lg font-bold text-slate-900 mb-1">End this session?</h2>
                <p className="text-sm text-slate-500 mb-4">
                  The session with {session?.patient.name} will be marked complete
                  ({formatSessionTime(sessionDuration)}). Transcription stops and your note can be generated.
                </p>
                {endError && (
                  <div className="mb-4 bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-red-700 text-xs">{endError}</div>
                )}
                <div className="flex gap-3">
                  <button
                    onClick={() => setShowEndModal(false)}
                    disabled={isEnding}
                    className="flex-1 h-10 border border-slate-200 text-slate-600 rounded-xl text-sm font-medium hover:bg-slate-50 transition-colors disabled:opacity-50"
                  >
                    Keep going
                  </button>
                  <button
                    onClick={confirmEndSession}
                    disabled={isEnding}
                    className="flex-1 h-10 bg-red-500 text-white rounded-xl text-sm font-semibold hover:bg-red-600 transition-colors disabled:opacity-50"
                  >
                    {isEnding ? "Ending…" : "End session"}
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className="flex items-center gap-3 mb-4">
                  <CheckCircle2 className="w-8 h-8 text-green-500 shrink-0" />
                  <div>
                    <h2 className="text-lg font-bold text-slate-900">Session complete</h2>
                    <p className="text-xs text-slate-500">Duration: {formatSessionTime(sessionDuration)}</p>
                  </div>
                </div>

                {/* Billing outcome */}
                <div className="rounded-xl border border-slate-200 p-4 mb-4">
                  {(!billingOutcome || billingOutcome.state === "loading") && (
                    <div className="flex items-center gap-2 text-sm text-slate-500">
                      <div className="w-4 h-4 border-2 border-slate-300 border-t-transparent rounded-full animate-spin" />
                      Preparing your billing summary…
                    </div>
                  )}
                  {billingOutcome?.state === "unavailable" && (
                    <p className="text-sm text-slate-500">
                      Your billing summary will appear shortly in <Link href="/settings" className="text-secondary underline">Settings → Billing &amp; Usage</Link>.
                    </p>
                  )}
                  {billingOutcome?.state === "ready" && billingOutcome.status === "waived" && (
                    <div>
                      <p className="text-sm font-semibold text-green-700 mb-1">🎉 This session was free — on us.</p>
                      <p className="text-xs text-slate-500">Your first session is always free. Future sessions are $6 each, or save 50% with Starter ($59/mo for 20 sessions).</p>
                    </div>
                  )}
                  {billingOutcome?.state === "ready" && billingOutcome.status === "pending" && (
                    <div>
                      <p className="text-sm font-semibold text-slate-900 mb-1">Session bill: ${billingOutcome.amount_due.toFixed(2)}</p>
                      <p className="text-xs text-slate-500 mb-3">Pay this bill to schedule your next session — or subscribe and save 50%.</p>
                      <div className="flex gap-2">
                        {billingOutcome.checkout_url ? (
                          <a href={billingOutcome.checkout_url} target="_blank" rel="noopener noreferrer"
                             className="flex-1 h-9 bg-[#1F5EFF] text-white rounded-lg text-xs font-semibold flex items-center justify-center hover:bg-[#1a4fd6] transition-colors">
                            Pay ${billingOutcome.amount_due.toFixed(2)} now
                          </a>
                        ) : (
                          <span className="flex-1 h-9 bg-slate-100 text-slate-500 rounded-lg text-xs flex items-center justify-center">
                            Payment link available in Settings → Billing
                          </span>
                        )}
                        <Link href="/settings" className="h-9 px-3 border border-slate-200 rounded-lg text-xs text-slate-600 flex items-center hover:bg-slate-50 transition-colors">
                          Plans
                        </Link>
                      </div>
                    </div>
                  )}
                  {billingOutcome?.state === "ready" && (billingOutcome.status === "included" || billingOutcome.status === "paid") && (
                    <div>
                      <p className="text-sm font-semibold text-slate-900 mb-1">
                        {billingOutcome.description || "Included in your plan"}
                      </p>
                      {billingOutcome.quota_remaining !== null && (
                        <p className="text-xs text-slate-500">{billingOutcome.quota_remaining} included sessions left this month.</p>
                      )}
                    </div>
                  )}
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={() => { setShowEndModal(false); setActiveRightTab("notes"); }}
                    className="flex-1 h-10 bg-secondary text-white rounded-xl text-sm font-semibold hover:bg-secondary/90 transition-colors flex items-center justify-center gap-2"
                  >
                    <Brain className="w-4 h-4" /> Generate note
                  </button>
                  <Link href="/sessions" className="flex-1 h-10 border border-slate-200 text-slate-600 rounded-xl text-sm font-medium hover:bg-slate-50 transition-colors flex items-center justify-center">
                    Back to sessions
                  </Link>
                </div>
              </>
            )}
          </div>
        </div>
      )}
      {/* Session Header Bar */}
      <div className="flex items-center justify-between px-4 py-2 bg-slate-900 border-b border-slate-700 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-7 h-7 bg-primary rounded-full flex items-center justify-center text-white text-xs font-bold">
            {getInitials(session.patient.name)}
          </div>
          <div>
            <div className="text-sm font-semibold text-white">{session.patient.name}</div>
            <div className="text-[10px] text-slate-400">{session.scheduled_time}</div>
          </div>
          {isLive && (
            <div className="flex items-center gap-1.5 ml-3">
              <div className="w-2 h-2 bg-red-500 rounded-full live-dot" />
              <span className="text-red-400 text-xs font-semibold">LIVE</span>
              <span className="text-slate-400 text-xs">{formatSessionTime(sessionDuration)}</span>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2">
          {/* Session phase indicator */}
          {sessionPhase === "waiting" && (
            <span className="text-xs text-slate-400 bg-slate-800 px-3 py-1 rounded-full">Waiting to start</span>
          )}

          <button className="h-7 w-7 flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-700 rounded transition-colors">
            <Settings2 className="w-4 h-4" />
          </button>
          <button className="h-7 w-7 flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-700 rounded transition-colors">
            <Share2 className="w-4 h-4" />
          </button>
          <Link href="/sessions" className="flex items-center gap-1.5 h-7 px-2.5 text-slate-400 hover:text-white border border-slate-700 rounded text-xs transition-colors">
            <X className="w-3 h-3" /> Exit
          </Link>
        </div>
      </div>

      {/* Main 3-Panel Layout */}
      <div className="flex flex-1 overflow-hidden">
        {/* LEFT PANEL — Context + Transcript */}
        <div className="w-[320px] shrink-0 bg-slate-800 border-r border-slate-700 flex flex-col">
          {/* Tab switcher */}
          <div className="flex border-b border-slate-700">
            {(["transcript", "context"] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveLeftTab(tab)}
                className={cn(
                  "flex-1 py-2.5 text-xs font-medium capitalize transition-colors",
                  activeLeftTab === tab ? "text-white border-b-2 border-secondary" : "text-slate-400 hover:text-white"
                )}
              >
                {tab === "transcript" ? "Live Transcript" : "Patient Context"}
              </button>
            ))}
          </div>

          {/* TRANSCRIPT TAB */}
          {activeLeftTab === "transcript" && (
            <div className="flex flex-col flex-1 overflow-hidden">
              <div ref={transcriptRef} className="flex-1 overflow-y-auto p-3 space-y-3">
                {roomStore.transcript.length === 0 && !isLive && (
                  <div className="text-center py-8 text-xs text-slate-500">
                    Transcript will appear here once the session starts.
                  </div>
                )}
                {roomStore.transcript.map((segment) => (
                  <div key={segment.id} className={cn("group", segment.speaker === "patient" ? "ml-0" : "ml-4")}>
                    <div className={cn(
                      "text-[10px] font-semibold mb-1 uppercase tracking-wide",
                      segment.speaker === "therapist" ? "text-secondary" : "text-accent"
                    )}>
                      {segment.speaker === "therapist" ? "You" : session.patient.name.split(" ")[0]}
                      <span className="ml-2 text-slate-500 normal-case">{formatSessionTime(segment.timestamp)}</span>
                    </div>
                    <div className={cn(
                      "rounded-lg px-3 py-2 text-xs text-slate-200 leading-relaxed",
                      segment.speaker === "therapist" ? "bg-secondary/20" : "bg-slate-700"
                    )}>
                      {segment.text}
                    </div>
                    {segment.tags && segment.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1">
                        {segment.tags.map((tag) => (
                          <span key={tag} className={cn("text-[9px] px-1.5 py-0.5 rounded font-medium", tagColors[tag] || "bg-slate-700 text-slate-300")}>
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
                {isLive && (
                  <div className="flex items-center gap-2 px-3 py-2">
                    <div className="flex gap-0.5">
                      {[0, 0.15, 0.3].map((delay) => (
                        <div
                          key={delay}
                          className="w-1.5 h-1.5 bg-slate-500 rounded-full animate-bounce"
                          style={{ animationDelay: `${delay}s` }}
                        />
                      ))}
                    </div>
                    <span className="text-[10px] text-slate-500">Transcribing...</span>
                  </div>
                )}
              </div>

              {/* Tag quick-add toolbar */}
              <div className="p-2 border-t border-slate-700">
                <div className="flex flex-wrap gap-1">
                  {["risk", "goal", "medication", "trigger"].map((tag) => (
                    <button key={tag} className="text-[10px] px-2 py-1 border border-slate-600 text-slate-400 hover:border-slate-400 hover:text-white rounded transition-colors">
                      + {tag}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* CONTEXT TAB */}
          {activeLeftTab === "context" && (
            <div className="flex-1 overflow-y-auto p-3 space-y-4">
              {/* Diagnoses */}
              <div>
                <div className="text-[10px] text-slate-400 font-semibold uppercase tracking-wide mb-2">Diagnoses</div>
                {patientCtx === null ? (
                  <div className="h-4 bg-slate-700 rounded animate-pulse w-3/4" />
                ) : patientCtx.diagnoses.length === 0 ? (
                  <div className="text-xs text-slate-500 italic">No diagnoses on file</div>
                ) : patientCtx.diagnoses.map((d) => (
                  <div key={d} className="text-xs text-slate-300 bg-slate-700/50 rounded px-2 py-1 mb-1">{d}</div>
                ))}
              </div>

              {/* Risk Level */}
              <div>
                <div className="text-[10px] text-slate-400 font-semibold uppercase tracking-wide mb-2">Risk Factors</div>
                {(patientCtx?.risk_factors || []).map((r) => (
                  <div key={r} className="flex items-center gap-1.5 text-xs text-amber-400 mb-1">
                    <AlertTriangle className="w-3 h-3" /> {r}
                  </div>
                ))}
              </div>

              {/* Medications */}
              <div>
                <div className="text-[10px] text-slate-400 font-semibold uppercase tracking-wide mb-2">Current Medications</div>
                {(patientCtx?.medications || []).map((med: any) => (
                  <div key={med.name || med.medication_name} className="bg-slate-700/50 rounded px-2 py-1.5 mb-1">
                    <div className="text-xs font-medium text-slate-200">{med.name || med.medication_name}</div>
                    <div className="text-[10px] text-slate-400">{med.frequency || med.dosage}</div>
                  </div>
                ))}
              </div>

              {/* Goals */}
              <div>
                <div className="text-[10px] text-slate-400 font-semibold uppercase tracking-wide mb-2">Treatment Goals</div>
                {(patientCtx?.goals || []).map((goal: any) => (
                  <div key={goal.title || goal.description} className="mb-2">
                    <div className="flex items-center justify-between mb-1">
                      <div className="text-[11px] text-slate-300 truncate">{goal.title || goal.description}</div>
                      <span className="text-[10px] text-slate-400 ml-1 shrink-0">{goal.progress}%</span>
                    </div>
                    <div className="w-full bg-slate-700 rounded-full h-1">
                      <div className="bg-secondary h-1 rounded-full" style={{ width: `${goal.progress}%` }} />
                    </div>
                  </div>
                ))}
              </div>

              {/* Last Session */}
              <div>
                <div className="text-[10px] text-slate-400 font-semibold uppercase tracking-wide mb-2">Last Session Summary</div>
                <p className="text-[11px] text-slate-300 leading-relaxed">{patientCtx?.last_session_summary || '—'}</p>
              </div>

              {/* Assessment Scores */}
              <div>
                <div className="text-[10px] text-slate-400 font-semibold uppercase tracking-wide mb-2">Latest Assessments</div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="bg-slate-700/50 rounded p-2 text-center">
                    <div className="text-lg font-bold text-white">{patientCtx?.last_phq9 ?? '—'}</div>
                    <div className="text-[10px] text-slate-400">PHQ-9</div>
                  </div>
                  <div className="bg-slate-700/50 rounded p-2 text-center">
                    <div className="text-lg font-bold text-white">{patientCtx?.last_gad7 ?? '—'}</div>
                    <div className="text-[10px] text-slate-400">GAD-7</div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* CENTER PANEL — Video */}
        <div className="flex-1 flex flex-col bg-black relative overflow-hidden">
          {/* Video Area */}
          <div className="flex-1 flex items-center justify-center relative">
            {sessionPhase === "waiting" ? (
              <div className="text-center">
                <div className="w-20 h-20 bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-4">
                  <div className="w-16 h-16 bg-primary rounded-full flex items-center justify-center text-white text-2xl font-bold">
                    {getInitials(session.patient.name)}
                  </div>
                </div>
                <p className="text-white text-lg font-semibold mb-1">{session.patient.name}</p>
                <p className="text-slate-400 text-sm mb-6">{session.scheduled_time} · {session.duration} min</p>
                <button
                  onClick={startSession}
                  className="flex items-center gap-2 h-10 px-6 bg-green-500 text-white rounded-xl font-medium hover:bg-green-600 transition-colors mx-auto"
                >
                  <VideoIcon className="w-4 h-4" />
                  Start Session
                </button>
                {startError && (
                  <div className="mt-4 max-w-sm mx-auto bg-red-500/10 border border-red-500/40 rounded-lg px-4 py-2.5 text-red-300 text-xs">
                    {startError}
                  </div>
                )}
              </div>
            ) : sessionPhase === "ended" ? (
              <div className="text-center">
                <CheckCircle2 className="w-16 h-16 text-green-500 mx-auto mb-4" />
                <p className="text-white text-xl font-semibold mb-2">Session Complete</p>
                <p className="text-slate-400 text-sm mb-6">Duration: {formatSessionTime(sessionDuration)}</p>
                <button
                  onClick={generateNote}
                  className="flex items-center gap-2 h-10 px-6 bg-secondary text-white rounded-xl font-medium hover:bg-secondary/90 transition-colors mx-auto"
                >
                  <Brain className="w-4 h-4" />
                  {isGeneratingNote ? "Generating SOAP Note..." : "Generate AI Note"}
                </button>
              </div>
            ) : session.video_room_url ? (
              /* Live session — Daily.co video room */
              <iframe
                src={session.video_room_url}
                allow="camera; microphone; fullscreen; display-capture; autoplay"
                className="w-full h-full border-0"
                title="Video Session"
              />
            ) : (
              /* Live session - no video room URL, show avatar placeholder */
              <div className="w-full h-full bg-gradient-to-br from-slate-800 to-slate-900 flex items-center justify-center">
                <div className="w-24 h-24 bg-primary rounded-full flex items-center justify-center text-white text-3xl font-bold">
                  {getInitials(session.patient.name)}
                </div>
                {/* Self view */}
                <div className="absolute bottom-4 right-4 w-32 h-20 bg-slate-700 rounded-lg flex items-center justify-center border-2 border-slate-600">
                  <div className="w-10 h-10 bg-primary/60 rounded-full flex items-center justify-center text-white text-sm font-bold">
                    DR
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Session Controls */}
          <div className="flex items-center justify-center gap-3 py-3 bg-slate-900/90 border-t border-slate-800">
            <button
              onClick={() => setIsMuted(!isMuted)}
              className={cn(
                "w-10 h-10 rounded-full flex items-center justify-center transition-colors",
                isMuted ? "bg-red-500/20 text-red-400 border border-red-500/50" : "bg-slate-700 text-white hover:bg-slate-600"
              )}
            >
              {isMuted ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
            </button>

            <button
              onClick={() => setIsVideoOff(!isVideoOff)}
              className={cn(
                "w-10 h-10 rounded-full flex items-center justify-center transition-colors",
                isVideoOff ? "bg-red-500/20 text-red-400 border border-red-500/50" : "bg-slate-700 text-white hover:bg-slate-600"
              )}
            >
              {isVideoOff ? <VideoOff className="w-4 h-4" /> : <VideoIcon className="w-4 h-4" />}
            </button>

            <button className="w-10 h-10 rounded-full bg-slate-700 text-white hover:bg-slate-600 flex items-center justify-center transition-colors">
              <Volume2 className="w-4 h-4" />
            </button>

            <button className="w-10 h-10 rounded-full bg-slate-700 text-white hover:bg-slate-600 flex items-center justify-center transition-colors">
              <MessageSquare className="w-4 h-4" />
            </button>

            <button className="w-10 h-10 rounded-full bg-slate-700 text-white hover:bg-slate-600 flex items-center justify-center transition-colors">
              <Share2 className="w-4 h-4" />
            </button>

            <button className="w-10 h-10 rounded-full bg-slate-700 text-white hover:bg-slate-600 flex items-center justify-center transition-colors">
              <Flag className="w-4 h-4" />
            </button>

            <button className="w-10 h-10 rounded-full bg-slate-700 text-white hover:bg-slate-600 flex items-center justify-center transition-colors">
              <Bookmark className="w-4 h-4" />
            </button>

            {isLive && (
              <button
                onClick={endSession}
                className="w-10 h-10 rounded-full bg-red-500 text-white hover:bg-red-600 flex items-center justify-center transition-colors"
              >
                <PhoneOff className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* RIGHT PANEL — AI Copilot + Notes */}
        <div className="w-[320px] shrink-0 bg-white border-l border-slate-200 flex flex-col">
          {/* Tab switcher */}
          <div className="flex border-b border-slate-200">
            {(["copilot", "notes", "risk"] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveRightTab(tab)}
                className={cn(
                  "flex-1 py-2.5 text-xs font-medium capitalize transition-colors",
                  activeRightTab === tab ? "text-secondary border-b-2 border-secondary" : "text-slate-400 hover:text-slate-700"
                )}
              >
                {tab === "copilot" ? (
                  <span className="flex items-center justify-center gap-1">
                    <Brain className="w-3 h-3" /> Copilot
                  </span>
                ) : tab === "notes" ? (
                  <span className="flex items-center justify-center gap-1">
                    <FileText className="w-3 h-3" /> Notes
                  </span>
                ) : (
                  <span className="flex items-center justify-center gap-1">
                    <AlertTriangle className="w-3 h-3" /> Risk
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* COPILOT TAB */}
          {activeRightTab === "copilot" && (
            <div className="flex-1 overflow-y-auto p-3 space-y-2">
              <div className="flex items-center gap-2 mb-3">
                <div className="flex items-center gap-1.5 text-xs text-slate-500">
                  <Brain className="w-3.5 h-3.5 text-secondary" />
                  <span>AI Copilot</span>
                  <span className="bg-secondary/10 text-secondary text-[10px] px-1.5 py-0.5 rounded font-semibold">LIVE</span>
                </div>
              </div>

              {/* Emotional Context Card — updates every 5 transcript segments */}
              {emotionalContext && (
                <div className="bg-violet-50 border border-violet-200 rounded-lg p-2.5 space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-violet-200 text-violet-800 uppercase">Emotional State</span>
                    <span className={cn(
                      "text-[10px] font-semibold px-1.5 py-0.5 rounded-full capitalize",
                      emotionalContext.intensity === 'strong' ? 'bg-red-100 text-red-700' :
                      emotionalContext.intensity === 'moderate' ? 'bg-amber-100 text-amber-700' :
                      'bg-slate-100 text-slate-600'
                    )}>
                      {emotionalContext.emotion} · {emotionalContext.intensity}
                    </span>
                    {emotionalContext.minimizing_language && (
                      <span className="text-[10px] bg-orange-100 text-orange-700 px-1.5 py-0.5 rounded-full font-semibold">⚠ Minimizing</span>
                    )}
                    <span className={cn(
                      "text-[10px] px-1.5 py-0.5 rounded-full",
                      emotionalContext.trajectory === 'improving' ? 'bg-green-100 text-green-700' :
                      emotionalContext.trajectory === 'declining' ? 'bg-red-100 text-red-700' :
                      'bg-slate-100 text-slate-600'
                    )}>
                      {emotionalContext.trajectory === 'improving' ? '↑' : emotionalContext.trajectory === 'declining' ? '↓' : '→'} {emotionalContext.trajectory}
                    </span>
                  </div>
                  <p className="text-xs text-violet-800 leading-relaxed">{emotionalContext.clinical_note}</p>
                  {emotionalContext.intervention_suggestion && (
                    <p className="text-[11px] italic text-violet-600">💡 {emotionalContext.intervention_suggestion}</p>
                  )}
                </div>
              )}

              {roomStore.copilotSuggestions.filter((s) => !dismissedSuggestions.includes(s.id)).map((suggestion) => (
                <div key={suggestion.id} className="copilot-suggestion group relative">
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <span className={cn("text-[10px] font-bold px-1.5 py-0.5 rounded capitalize", copilotTypeColors[suggestion.type] || copilotTypeColors['observation'])}>
                      {suggestion.type}
                    </span>
                    <button
                      onClick={() => setDismissedSuggestions((s) => [...s, suggestion.id])}
                      className="text-slate-300 hover:text-slate-500 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                  <p className="text-xs text-slate-700 leading-relaxed">{suggestion.content}</p>
                </div>
              ))}

              {roomStore.copilotSuggestions.filter((s) => !dismissedSuggestions.includes(s.id)).length === 0 && (
                <div className="text-center py-8 text-xs text-slate-400">
                  <Brain className="w-6 h-6 mx-auto mb-2 opacity-30" />
                  {isLive ? 'Waiting for AI suggestions…' : 'AI copilot activates when session is live'}
                </div>
              )}
            </div>
          )}

          {/* NOTES TAB */}
          {activeRightTab === "notes" && (
            <div className="flex flex-col flex-1 overflow-hidden">
              <div className="p-3 border-b border-slate-100 flex items-center justify-between">
                <div className="flex gap-1">
                  {(["SOAP", "DAP", "BIRP"] as const).map((type) => (
                    <button
                      key={type}
                      onClick={() => setNoteType(type)}
                      className={cn(
                        "h-6 px-2 rounded text-[10px] font-bold transition-colors",
                        noteType === type ? "bg-secondary text-white" : "text-slate-400 hover:text-slate-600 border border-slate-200"
                      )}
                    >
                      {type}
                    </button>
                  ))}
                </div>
                <button
                  onClick={generateNote}
                  disabled={isGeneratingNote}
                  className="flex items-center gap-1 h-6 px-2 bg-secondary/10 text-secondary rounded text-[10px] font-semibold hover:bg-secondary/20 transition-colors disabled:opacity-50"
                >
                  <Brain className="w-3 h-3" />
                  {isGeneratingNote ? "Generating..." : "Generate AI"}
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-3">
                {generatedNote ? (
                  <div className="text-xs text-slate-700 leading-relaxed whitespace-pre-wrap font-mono text-[11px]">
                    {generatedNote}
                  </div>
                ) : (
                  <textarea
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder="Session notes... (AI will generate a full SOAP/DAP note after the session)"
                    className="w-full h-full resize-none text-xs text-slate-700 placeholder:text-slate-300 focus:outline-none"
                  />
                )}
              </div>

              {generatedNote && (
                <div className="p-3 border-t border-slate-100 flex gap-2">
                  {generatedNoteId ? (
                    <Link
                      href={`/notes/${generatedNoteId}`}
                      className="flex-1 h-8 bg-secondary text-white rounded text-xs font-medium hover:bg-secondary/90 transition-colors flex items-center justify-center gap-1"
                    >
                      <Edit3 className="w-3 h-3" /> Review & Edit
                    </Link>
                  ) : (
                    <button disabled className="flex-1 h-8 bg-slate-100 text-slate-400 rounded text-xs font-medium flex items-center justify-center gap-1">
                      <Edit3 className="w-3 h-3" /> Review & Edit
                    </button>
                  )}
                  <button
                    onClick={approveGeneratedNote}
                    disabled={!generatedNoteId || noteApproved}
                    className={cn(
                      "flex-1 h-8 rounded text-xs font-medium transition-colors flex items-center justify-center gap-1",
                      noteApproved ? "bg-green-100 text-green-700" : "bg-green-500 text-white hover:bg-green-600 disabled:opacity-50"
                    )}
                  >
                    <CheckCircle2 className="w-3 h-3" /> {noteApproved ? "Approved" : "Approve Note"}
                  </button>
                </div>
              )}
            </div>
          )}

          {/* RISK TAB — real AI risk check on the live transcript; no fabricated data */}
          {activeRightTab === "risk" && (
            <div className="flex-1 overflow-y-auto p-3 space-y-3">
              {crisisAlert === null && !riskResult && (
                <div className="bg-slate-50 border border-slate-200 rounded-lg p-3">
                  <div className="flex items-center gap-2 mb-1">
                    <AlertTriangle className="w-4 h-4 text-slate-400" />
                    <span className="text-xs font-bold text-slate-600">No alerts this session</span>
                  </div>
                  <p className="text-xs text-slate-500">
                    Crisis monitoring runs automatically on the live transcript. You can also run an on-demand AI risk check.
                  </p>
                </div>
              )}

              {riskResult && !riskResult.error && (
                <div className={cn(
                  "border rounded-lg p-3",
                  String(riskResult.risk_level || riskResult.level || "low") === "high" || String(riskResult.risk_level || riskResult.level) === "critical"
                    ? "bg-red-50 border-red-200" : "bg-amber-50 border-amber-200"
                )}>
                  <div className="flex items-center gap-2 mb-1">
                    <AlertTriangle className="w-4 h-4 text-amber-600" />
                    <span className="text-xs font-bold text-amber-700 uppercase">
                      Risk level: {String(riskResult.risk_level || riskResult.level || "low")}
                    </span>
                  </div>
                  {Array.isArray(riskResult.indicators) && (riskResult.indicators as string[]).length > 0 && (
                    <ul className="text-xs text-amber-700 list-disc ml-4 mt-1 space-y-0.5">
                      {(riskResult.indicators as string[]).slice(0, 6).map((ind) => <li key={ind}>{ind}</li>)}
                    </ul>
                  )}
                  {typeof riskResult.recommended_action === "string" && (
                    <p className="text-xs text-slate-600 mt-2 italic">{riskResult.recommended_action}</p>
                  )}
                </div>
              )}
              {riskResult?.error === true && (
                <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-xs text-slate-500">
                  Risk check unavailable right now — automatic crisis monitoring is still active.
                </div>
              )}

              <button
                onClick={runRiskCheck}
                disabled={isCheckingRisk}
                className="w-full flex items-center justify-center gap-2 h-8 px-3 border border-slate-200 rounded text-xs text-slate-600 hover:bg-slate-50 transition-colors disabled:opacity-50"
              >
                <Zap className="w-3 h-3" /> {isCheckingRisk ? "Analyzing transcript…" : "Run AI risk check"}
              </button>

              <div>
                <div className="text-[10px] font-semibold text-slate-500 uppercase mb-2">Crisis Resources</div>
                <div className="space-y-2">
                  <a href="tel:988" className="w-full flex items-center gap-2 h-8 px-3 border border-red-200 bg-red-50 rounded text-xs text-red-700 hover:bg-red-100 transition-colors">
                    <AlertTriangle className="w-3 h-3" /> 988 Suicide &amp; Crisis Lifeline
                  </a>
                  <Link href="/risk-monitor" className="w-full flex items-center gap-2 h-8 px-3 border border-slate-200 rounded text-xs text-slate-600 hover:bg-slate-50 transition-colors">
                    <Flag className="w-3 h-3" /> Open Risk Monitor
                  </Link>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Reviewed: 2026-06-13 — 24Therapy audit
