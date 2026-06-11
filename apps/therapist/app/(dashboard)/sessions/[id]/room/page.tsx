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
import { sessionsAPI, aiAPI } from "@/lib/api";

// Mock session data
const MOCK_SESSION = {
  id: "s1",
  video_room_url: undefined as string | undefined,
  patient: {
    id: "p1", name: "Sarah Chen", age: 34, diagnosis: "Major Depressive Disorder",
    risk_level: "medium", sessions_count: 24,
  },
  scheduled_time: "10:00 AM",
  duration: 50,
  type: "video",
  context: {
    diagnoses: ["Major Depressive Disorder (F32.1)", "Generalized Anxiety Disorder (F41.1)"],
    medications: [
      { name: "Lexapro 10mg", frequency: "Daily morning", status: "active" },
      { name: "Melatonin 5mg", frequency: "As needed for sleep", status: "active" },
    ],
    goals: [
      { title: "Reduce PHQ-9 below 9", progress: 52 },
      { title: "Develop 5 coping strategies", progress: 80 },
      { title: "Improve sleep quality", progress: 70 },
    ],
    risk_factors: ["Performance anxiety", "Perfectionism"],
    last_session_summary: "Discussed work-related anxiety triggers. Developed 3 new coping strategies: grounding technique, breathing exercise, cognitive reframing. Assigned thought record homework.",
    last_phq9: 13,
    last_gad7: 8,
  },
};

const MOCK_TRANSCRIPT: Array<{
  id: string;
  speaker: "therapist" | "patient";
  text: string;
  timestamp: number;
  tags?: string[];
}> = [
  { id: "t1", speaker: "therapist", text: "Good morning Sarah. How have you been feeling since our last session?", timestamp: 0, tags: [] },
  { id: "t2", speaker: "patient", text: "Honestly, it's been a mixed week. I had a performance review at work on Tuesday and I was really anxious about it beforehand.", timestamp: 15, tags: ["anxiety", "work"] },
  { id: "t3", speaker: "therapist", text: "That sounds really challenging. How did it go, and how did you handle the anxiety leading up to it?", timestamp: 38, tags: [] },
  { id: "t4", speaker: "patient", text: "I actually used the breathing technique we practiced. It helped a lot. The review went well — my manager said I'm doing great. But I still felt this dread beforehand.", timestamp: 60, tags: ["progress", "coping"] },
  { id: "t5", speaker: "therapist", text: "That's really important progress, Sarah. You used a tool we practiced together and it worked. What do you notice about how you felt even after hearing positive feedback?", timestamp: 95, tags: [] },
  { id: "t6", speaker: "patient", text: "I guess I still don't fully believe it. Even when he said I'm doing great, I kept thinking about all the things I could have done better. I feel like nothing is ever good enough.", timestamp: 120, tags: ["cognitive_distortion", "perfectionism"] },
];

const MOCK_COPILOT: Array<{
  id: string;
  type: "question" | "observation" | "risk" | "technique" | "memory";
  content: string;
  priority: "high" | "medium" | "low";
  source?: string;
}> = [
  { id: "c1", type: "observation", content: "Patient showing positive behavioral activation — using breathing technique despite anticipatory anxiety. Reinforce this.", priority: "high", source: "Behavioral Analysis" },
  { id: "c2", type: "question", content: "\"When you say nothing is ever good enough — can you tell me, good enough for whom?\"", priority: "high", source: "Socratic Questioning" },
  { id: "c3", type: "memory", content: "Pattern match: Father's emotional unavailability → external validation seeking → performance anxiety. Session #8 insight.", priority: "high", source: "Memory Agent" },
  { id: "c4", type: "question", content: "\"What would you say to a close friend who had the same performance review outcome you described?\"", priority: "medium", source: "Compassionate Reframing" },
  { id: "c5", type: "technique", content: "Consider introducing the 'Double Standard Technique' — applying same self-judgment rules to others vs. self.", priority: "medium", source: "CBT Toolkit" },
  { id: "c6", type: "question", content: "Explore connection between perfectionism and childhood expectations around achievement.", priority: "medium", source: "Attachment Theory" },
];

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
  const [noteType, setNoteType] = useState<"SOAP" | "DAP" | "BIRP">("SOAP");
  const [isGeneratingNote, setIsGeneratingNote] = useState(false);
  const [generatedNote, setGeneratedNote] = useState("");
  const [crisisAlert, setCrisisAlert] = useState<CrisisAlert | null>(null);
  const [emotionalContext, setEmotionalContext] = useState<{
    emotion: string; intensity: string; minimizing_language: boolean;
    trajectory: string; clinical_note: string; intervention_suggestion: string;
  } | null>(null);
  const transcriptRef = useRef<HTMLDivElement>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const [liveSession, setLiveSession] = useState<Record<string, unknown> | null>(null);

  useEffect(() => {
    if (!id) return;
    sessionsAPI.get(id)
      .then((s: any) => setLiveSession(s))
      .catch(() => {/* keep mock */});
  }, [id]);

  const session = liveSession ? {
    ...MOCK_SESSION,
    id: liveSession.id as string,
    video_room_url: (liveSession.video_room_url as string) || undefined,
    patient: {
      ...MOCK_SESSION.patient,
      id: (liveSession.patient_id as string) || MOCK_SESSION.patient.id,
      name: (liveSession.patient_name as string) || MOCK_SESSION.patient.name,
    },
    scheduled_time: liveSession.scheduled_at
      ? new Date(liveSession.scheduled_at as string).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      : MOCK_SESSION.scheduled_time,
    duration: (liveSession.duration_minutes as number) || MOCK_SESSION.duration,
  } : MOCK_SESSION;

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
            `${(process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api/v1').replace(/\/api\/v1\/?$/, '')}/api/v1/ai/sessions/${id}/transcribe`,
            { method: 'POST', headers: { Authorization: `Bearer ${accessToken}` }, body: form }
          );
        } catch { /* transcription failure is non-fatal */ }
      };
      recorder.start(5000); // 5-second chunks
      recorderRef.current = recorder;
    } catch { /* mic permission denied — continue without audio */ }
  };

  const endSession = () => {
    setShowEndModal(true);
    setIsLive(false);
    setSessionPhase("ended");
    // Stop audio recording
    if (recorderRef.current && recorderRef.current.state !== 'inactive') {
      recorderRef.current.stop();
      recorderRef.current.stream?.getTracks().forEach(t => t.stop());
    }
  };

  const generateNote = async () => {
    setIsGeneratingNote(true);
    await new Promise((r) => setTimeout(r, 2000));
    setGeneratedNote(`**SOAP Note — ${session.patient.name} — Session #${session.patient.sessions_count}**

**S (Subjective):**
Patient reports experiencing anticipatory anxiety prior to work performance review. States: "I still don't fully believe it [positive feedback]." Describes persistent cognitive distortions characterized by minimizing achievements and focusing on perceived shortcomings ("nothing is ever good enough"). Patient demonstrated successful use of breathing technique during high-stress situation, showing behavioral progress.

**O (Objective):**
Patient appeared engaged and reflective throughout session. Affect congruent with reported mood. Demonstrated insight into cognitive patterns when prompted. Used coping skills learned in previous sessions (breathing technique) successfully in real-world context. Speech organized and coherent.

**A (Assessment):**
Patient continues to demonstrate moderate depressive symptoms with significant improvement in anxiety management skills. The core cognitive distortion of perfectionism (linked to childhood attachment patterns) remains primary treatment target. Positive reinforcement of coping skill use is warranted. PHQ-9 trending down (17 → 13).

**P (Plan):**
1. Continue CBT targeting perfectionism schema using Double Standard Technique
2. Assign: Write down one achievement per day without qualifying statements
3. Explore connection between father's emotional unavailability and current performance anxiety (next session)
4. Continue Lexapro 10mg — check in with prescriber (Dr. Walsh) re: sleep improvements
5. Return in 1 week`);
    setIsGeneratingNote(false);
  };

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
      {/* Session Header Bar */}
      <div className="flex items-center justify-between px-4 py-2 bg-slate-900 border-b border-slate-700 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-7 h-7 bg-primary rounded-full flex items-center justify-center text-white text-xs font-bold">
            {getInitials(session.patient.name)}
          </div>
          <div>
            <div className="text-sm font-semibold text-white">{session.patient.name}</div>
            <div className="text-[10px] text-slate-400">Session #{session.patient.sessions_count} · {session.patient.diagnosis}</div>
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
                {MOCK_TRANSCRIPT.map((segment) => (
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
                {session.context.diagnoses.map((d) => (
                  <div key={d} className="text-xs text-slate-300 bg-slate-700/50 rounded px-2 py-1 mb-1">{d}</div>
                ))}
              </div>

              {/* Risk Level */}
              <div>
                <div className="text-[10px] text-slate-400 font-semibold uppercase tracking-wide mb-2">Risk Factors</div>
                {session.context.risk_factors.map((r) => (
                  <div key={r} className="flex items-center gap-1.5 text-xs text-amber-400 mb-1">
                    <AlertTriangle className="w-3 h-3" /> {r}
                  </div>
                ))}
              </div>

              {/* Medications */}
              <div>
                <div className="text-[10px] text-slate-400 font-semibold uppercase tracking-wide mb-2">Current Medications</div>
                {session.context.medications.map((med) => (
                  <div key={med.name} className="bg-slate-700/50 rounded px-2 py-1.5 mb-1">
                    <div className="text-xs font-medium text-slate-200">{med.name}</div>
                    <div className="text-[10px] text-slate-400">{med.frequency}</div>
                  </div>
                ))}
              </div>

              {/* Goals */}
              <div>
                <div className="text-[10px] text-slate-400 font-semibold uppercase tracking-wide mb-2">Treatment Goals</div>
                {session.context.goals.map((goal) => (
                  <div key={goal.title} className="mb-2">
                    <div className="flex items-center justify-between mb-1">
                      <div className="text-[11px] text-slate-300 truncate">{goal.title}</div>
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
                <p className="text-[11px] text-slate-300 leading-relaxed">{session.context.last_session_summary}</p>
              </div>

              {/* Assessment Scores */}
              <div>
                <div className="text-[10px] text-slate-400 font-semibold uppercase tracking-wide mb-2">Latest Assessments</div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="bg-slate-700/50 rounded p-2 text-center">
                    <div className="text-lg font-bold text-white">{session.context.last_phq9}</div>
                    <div className="text-[10px] text-slate-400">PHQ-9</div>
                    <div className="text-[10px] text-amber-400">Moderate</div>
                  </div>
                  <div className="bg-slate-700/50 rounded p-2 text-center">
                    <div className="text-lg font-bold text-white">{session.context.last_gad7}</div>
                    <div className="text-[10px] text-slate-400">GAD-7</div>
                    <div className="text-[10px] text-green-400">Mild</div>
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
                <p className="text-slate-400 text-sm mb-6">Session #{session.patient.sessions_count} · {session.scheduled_time} · {session.duration} min</p>
                <button
                  onClick={startSession}
                  className="flex items-center gap-2 h-10 px-6 bg-green-500 text-white rounded-xl font-medium hover:bg-green-600 transition-colors mx-auto"
                >
                  <VideoIcon className="w-4 h-4" />
                  Start Session
                </button>
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

              {MOCK_COPILOT.filter((s) => !dismissedSuggestions.includes(s.id)).map((suggestion) => (
                <div key={suggestion.id} className="copilot-suggestion group relative">
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <span className={cn("text-[10px] font-bold px-1.5 py-0.5 rounded capitalize", copilotTypeColors[suggestion.type])}>
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
                  {suggestion.source && (
                    <div className="text-[10px] text-slate-400 mt-1.5 flex items-center gap-1">
                      <Activity className="w-2.5 h-2.5" />
                      {suggestion.source}
                      {suggestion.type === "memory" && (
                        <span className="ml-1 text-amber-600 font-medium">← Memory</span>
                      )}
                    </div>
                  )}
                </div>
              ))}

              {MOCK_COPILOT.filter((s) => !dismissedSuggestions.includes(s.id)).length === 0 && (
                <div className="text-center py-8 text-xs text-slate-400">
                  <Brain className="w-6 h-6 mx-auto mb-2 opacity-30" />
                  All suggestions reviewed
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
                  <button className="flex-1 h-8 bg-secondary text-white rounded text-xs font-medium hover:bg-secondary/90 transition-colors flex items-center justify-center gap-1">
                    <Edit3 className="w-3 h-3" /> Review & Edit
                  </button>
                  <button className="flex-1 h-8 bg-green-500 text-white rounded text-xs font-medium hover:bg-green-600 transition-colors flex items-center justify-center gap-1">
                    <CheckCircle2 className="w-3 h-3" /> Approve Note
                  </button>
                </div>
              )}
            </div>
          )}

          {/* RISK TAB */}
          {activeRightTab === "risk" && (
            <div className="flex-1 overflow-y-auto p-3 space-y-3">
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                <div className="flex items-center gap-2 mb-1">
                  <AlertTriangle className="w-4 h-4 text-amber-600" />
                  <span className="text-xs font-bold text-amber-700">Current Risk Level: MEDIUM</span>
                </div>
                <p className="text-xs text-amber-600">Monitor: Perfectionism patterns + performance anxiety. No acute safety concerns.</p>
              </div>

              <div>
                <div className="text-[10px] font-semibold text-slate-500 uppercase mb-2">Risk Indicators (This Session)</div>
                <div className="space-y-2">
                  {[
                    { item: "Cognitive distortions (perfectionism)", level: "medium" },
                    { item: "Self-critical statements", level: "medium" },
                    { item: "No evidence of SI/SH", level: "none" },
                    { item: "No substance use mentioned", level: "none" },
                  ].map(({ item, level }) => (
                    <div key={item} className="flex items-center gap-2">
                      <div className={cn(
                        "w-2 h-2 rounded-full shrink-0",
                        level === "high" ? "bg-red-500" :
                        level === "medium" ? "bg-amber-500" :
                        level === "low" ? "bg-yellow-400" : "bg-green-400"
                      )} />
                      <span className="text-xs text-slate-600">{item}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <div className="text-[10px] font-semibold text-slate-500 uppercase mb-2">Quick Actions</div>
                <div className="space-y-2">
                  <button className="w-full flex items-center gap-2 h-8 px-3 border border-slate-200 rounded text-xs text-slate-600 hover:bg-slate-50 transition-colors">
                    <Plus className="w-3 h-3" /> Create Risk Assessment
                  </button>
                  <button className="w-full flex items-center gap-2 h-8 px-3 border border-slate-200 rounded text-xs text-slate-600 hover:bg-slate-50 transition-colors">
                    <Flag className="w-3 h-3" /> Flag for Review
                  </button>
                  <button className="w-full flex items-center gap-2 h-8 px-3 border border-red-200 bg-red-50 rounded text-xs text-red-700 hover:bg-red-100 transition-colors">
                    <AlertTriangle className="w-3 h-3" /> Escalate Crisis Protocol
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
