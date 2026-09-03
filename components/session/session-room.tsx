"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Copy, Link2, Loader2, Mic, MicOff, Square, Video, X } from "lucide-react";

import { RiskBanner } from "@/components/clinical/risk-banner";
import { TranscriptPanel, type TranscriptLine } from "@/components/clinical/transcript-panel";
import { VideoCall } from "@/components/session/video-call";
import { Button } from "@/components/ui";
import { SessionRecorder } from "@/lib/audio/recorder";
import { CopilotToasts, mergeToasts, type Toast } from "@/components/session/copilot-toasts";
import { SessionClockBar } from "@/components/session/session-clock-bar";
import {
  endSession,
  extendCurrentSession,
  goLive,
  setRecordingPaused,
  setTranscriptLanguage,
} from "@/app/(app)/sessions/actions";
import type { CopilotSuggestion } from "@/lib/ai/copilot";
import { sessionClock } from "@/lib/session-clock";
import { cn, formatDuration } from "@/lib/utils";

type Speaker = "therapist" | "patient" | "unknown";

type RoomProps = {
  sessionId: string;
  patientLabel: string;
  therapistName: string;
  modality: "in_person" | "video";
  initialStatus: "scheduled" | "in_progress" | "completed" | "cancelled";
  videoRoomUrl: string | null;
  videoToken: string | null;
  videoConfigured: boolean;
  joinUrl: string | null;
  /** Zero when the session is free to join, which is the default. */
  priceCents: number;
  paymentStatus: "not_required" | "pending" | "paid";
  initialLines: TranscriptLine[];
  patientAlreadyJoined: boolean;
  /** Null for sessions that predate the consent step, or that never used the join form. */
  recordingConsent: "granted" | "declined" | null;
  /** ISO, so the countdown survives a refresh mid-session. */
  startedAt: string | null;
  /** ISO of the moment the clinician chose to keep going, if they have. */
  extendedAt: string | null;
  /**
   * The language being spoken, or null to let the model work it out.
   *
   * Null is the honest default and it is what every existing session has. It is
   * not, however, what every existing session was *transcribed* with: the
   * request used to carry a hardcoded `language: "en"`, so an Arabic session
   * was decoded by a model told the audio was English. This control is how a
   * clinician stops that happening to them.
   */
  transcriptLanguage: string | null;
};

export function SessionRoom(props: RoomProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const [live, setLive] = useState(props.initialStatus === "in_progress");
  const [lines, setLines] = useState<TranscriptLine[]>(props.initialLines);
  /*
   * A refusal starts the room off record, and the clinician has to overrule it
   * deliberately.
   *
   * This is the only place the patient's answer can actually bind anything.
   * Storing "declined" and then opening a room with the microphone live would
   * be worse than never asking — it manufactures evidence that we knew. The
   * button still works, because a patient can change their mind out loud
   * mid-session and the clinician needs to be able to act on that; what it no
   * longer is, is the default.
   */
  const [offRecord, setOffRecord] = useState(props.recordingConsent === "declined");
  /*
   * The clock's two inputs, mirrored so the countdown ticks every second
   * instead of stepping every five when the poll lands. The poll is still the
   * authority — it is what corrects a tab that was asleep, and it is what
   * actually ends the session.
   */
  const [startedAt, setStartedAt] = useState<string | null>(props.startedAt);
  const [extendedAt, setExtendedAt] = useState<string | null>(props.extendedAt);
  const [now, setNow] = useState(() => Date.now());
  const [crisis, setCrisis] = useState(false);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [micDenied, setMicDenied] = useState(false);
  const [spokenLanguage, setSpokenLanguage] = useState<string | null>(props.transcriptLanguage);
  const [patientJoined, setPatientJoined] = useState(props.patientAlreadyJoined);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ending, setEnding] = useState(false);

  const localRecorder = useRef<SessionRecorder | null>(null);
  const remoteRecorder = useRef<SessionRecorder | null>(null);
  const remoteTrack = useRef<MediaStreamTrack | null>(null);
  const inflight = useRef(0);
  const liveRef = useRef(live);
  liveRef.current = live;

  /**
   * One sequence counter shared by both recorders.
   *
   * `(session_id, sequence)` is unique in the database — it is what makes a
   * retried chunk a no-op instead of a duplicate. Two recorders each keeping
   * their own count would collide on every single chunk, so the number is
   * assigned here, once, at upload time.
   */
  const sequence = useRef(props.initialLines.length);

  /* -------------------------------------------------------------- upload -- */

  const uploadChunk = useCallback(
    async (blob: Blob, durationSeconds: number, speaker: Speaker) => {
      const seq = (sequence.current += 1);

      const form = new FormData();
      form.append("audio", blob, `chunk-${seq}.wav`);
      form.append("sequence", String(seq));
      form.append("duration", String(durationSeconds));
      form.append("speaker", speaker);

      inflight.current += 1;
      try {
        // Credentials ride on the httpOnly session cookie, so there is no token
        // to read, refresh or accidentally capture in a stale closure.
        const response = await fetch(`/api/sessions/${props.sessionId}/transcribe`, {
          method: "POST",
          body: form,
          credentials: "same-origin",
        });

        if (!response.ok) return;

        const data = (await response.json()) as {
          text?: string;
          speaker?: Speaker;
          sequence?: number;
          crisis?: boolean;
          suggestions?: CopilotSuggestion[];
        };

        if (data.text) {
          setLines((current) => [
            ...current,
            {
              id: `s-${data.sequence}`,
              speaker: data.speaker ?? speaker,
              text: data.text!,
            },
          ]);
        }
        // The chunk response is the push channel — no socket required.
        if (data.crisis) setCrisis(true);
        /*
         * Merged, never replaced.
         *
         * `setSuggestions(data.suggestions)` overwrote, so a batch arriving
         * while the clinician was still reading the last one erased it. Each
         * suggestion now has its own card and its own fifteen seconds.
         */
        if (data.suggestions?.length) {
          setToasts((current) => mergeToasts(current, data.suggestions!));
        }
      } catch {
        // A dropped chunk costs a few seconds of transcript, never the session.
      } finally {
        inflight.current -= 1;
      }
    },
    [props.sessionId],
  );

  /* ------------------------------------------------------------ recording -- */

  const startLocalRecorder = useCallback(async () => {
    if (localRecorder.current) return;
    const recorder = new SessionRecorder({
      onChunk: ({ blob, durationSeconds }) => {
        /*
         * This track is only the therapist if somebody else's track is also
         * being recorded.
         *
         * In person there is one microphone hearing two people, which was
         * always labelled `unknown`. On video the label used to be `therapist`
         * unconditionally — but if the patient never connects, or their track
         * drops, this microphone is still the only one running and it is
         * picking up whatever it can hear. Calling that "the therapist" put the
         * patient's words in the clinician's mouth, in a clinical record,
         * silently.
         *
         * `unknown` is not a worse answer. It is the true one, and
         * `lib/ai/diarise.ts` resolves it afterwards from the words themselves.
         */
        const twoTrack = props.modality === "video" && remoteRecorder.current !== null;
        void uploadChunk(blob, durationSeconds, twoTrack ? "therapist" : "unknown");
      },
    });
    try {
      await recorder.start();
      localRecorder.current = recorder;
      setMicDenied(false);
    } catch {
      // No microphone is a degraded session, not a failed one: the video call
      // and the record still work, there is simply no transcript.
      setMicDenied(true);
    }
  }, [uploadChunk, props.modality]);

  const startRemoteRecorder = useCallback(async () => {
    const track = remoteTrack.current;
    if (!track || remoteRecorder.current || !liveRef.current) return;
    const recorder = new SessionRecorder({
      track,
      onChunk: ({ blob, durationSeconds }) => {
        void uploadChunk(blob, durationSeconds, "patient");
      },
    });
    try {
      await recorder.start();
      remoteRecorder.current = recorder;
    } catch {
      setError("Could not capture the patient's audio. Their side may not be transcribed.");
    }
  }, [uploadChunk]);

  const handleRemoteTrack = useCallback(
    (track: MediaStreamTrack | null) => {
      remoteTrack.current = track;
      if (!track) {
        void remoteRecorder.current?.stop();
        remoteRecorder.current = null;
        return;
      }
      void startRemoteRecorder();
    },
    [startRemoteRecorder],
  );

  useEffect(() => {
    if (!live) return;
    void startLocalRecorder();
    void startRemoteRecorder();
  }, [live, startLocalRecorder, startRemoteRecorder]);

  useEffect(() => {
    return () => {
      void localRecorder.current?.stop();
      void remoteRecorder.current?.stop();
      localRecorder.current = null;
      remoteRecorder.current = null;
    };
  }, []);

  useEffect(() => {
    if (!live) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [live]);

  /* --------------------------------------------------- patient poll (video) */

  /*
   * The poll now runs for the whole session, not only while waiting.
   *
   * It used to stop the moment the patient arrived, because the only thing it
   * carried was one boolean. It also carries the clock — and the clock is what
   * ends a session nobody is ending, so it has to keep asking right up until
   * the session is over.
   */
  useEffect(() => {
    if (!live && (props.modality !== "video" || patientJoined)) return;
    const poll = setInterval(async () => {
      try {
        const response = await fetch(`/api/sessions/${props.sessionId}/state`, {
          credentials: "same-origin",
        });
        if (!response.ok) return;
        const data = (await response.json()) as {
          patientJoined?: boolean;
          status?: string;
          clock?: { extended?: boolean; endReason?: string | null };
        };
        if (data.patientJoined) setPatientJoined(true);

        // The server ended it — the cap, or a room everybody left. Go to the
        // note rather than leaving a dead room on screen.
        if (data.status === "completed") {
          router.replace(`/sessions/${props.sessionId}`);
          return;
        }
        if (data.clock?.extended && !extendedAt) setExtendedAt(new Date().toISOString());
      } catch {
        /* transient */
      }
    }, 5000);
    return () => clearInterval(poll);
  }, [props.modality, props.sessionId, patientJoined, live, extendedAt, router]);

  /* ---------------------------------------------------------- transitions -- */

  const handleStart = () => {
    setError(null);
    startTransition(async () => {
      const result = await goLive(props.sessionId);
      if (result.error) {
        setError(result.error);
        return;
      }
      setLive(true);
      setStartedAt(new Date().toISOString());
    });
  };

  const handleExtend = () => {
    setError(null);
    startTransition(async () => {
      const result = await extendCurrentSession(props.sessionId);
      if (result.error) setError(result.error);
      else setExtendedAt(new Date().toISOString());
    });
  };

  const handleEnd = () => {
    setEnding(true);
    setError(null);
    startTransition(async () => {
      // Flush the tail of both streams before the status flips, or the last few
      // seconds are dropped and the note is written without them.
      await Promise.all([localRecorder.current?.stop(), remoteRecorder.current?.stop()]);
      localRecorder.current = null;
      remoteRecorder.current = null;

      // Give any in-flight chunk a moment to land.
      for (let i = 0; i < 20 && inflight.current > 0; i++) {
        await new Promise((resolve) => setTimeout(resolve, 250));
      }

      const result = await endSession(props.sessionId);
      if (result.error) {
        setError(result.error);
        setEnding(false);
        return;
      }
      router.replace(`/sessions/${props.sessionId}`);
    });
  };

  const toggleOffRecord = () => {
    const next = !offRecord;
    setOffRecord(next);
    localRecorder.current?.setMuted(next);
    remoteRecorder.current?.setMuted(next);
    // Fire and forget: the patient's indicator is allowed to lag a poll behind,
    // and a failed write must never stop the clinician pausing the microphone.
    void setRecordingPaused(props.sessionId, next);
  };

  const copyJoinLink = async () => {
    if (!props.joinUrl) return;
    try {
      await navigator.clipboard.writeText(props.joinUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError("Could not copy. Long-press the link to copy it manually.");
    }
  };

  /* ---------------------------------------------------------------- view -- */

  /*
   * Computed locally from the same pure function the server runs, so the bar
   * ticks second by second rather than stepping when a poll lands. Deliberately
   * without the silence check — that one needs the transcript's own timestamps
   * and only the server has them, which is also why only the server ends a
   * session.
   */
  const clock = sessionClock({ startedAt, extendedAt, now: new Date(now) });

  return (
    <div data-surface="room" className="flex min-h-dvh flex-col bg-navy-600">
      <header className="flex items-center justify-between gap-3 border-b border-white/10 px-4 py-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-white">{props.patientLabel}</p>
          <p className="text-xs text-slate-400">
            {props.modality === "video" ? "Video session" : "In person"}
            {live ? ` · ${formatDuration(clock.elapsedSeconds)}` : ""}
          </p>
        </div>

        {live ? (
          <span className="flex shrink-0 items-center gap-1.5 rounded-full bg-white/10 px-2.5 py-1">
            <span
              className={cn(
                "h-1.5 w-1.5 rounded-full",
                offRecord ? "bg-amber-400" : "live-dot bg-red-500",
              )}
            />
            <span className="text-[11px] font-medium text-white">
              {offRecord ? "Off record" : "Live"}
            </span>
          </span>
        ) : null}
      </header>

      {live ? (
        <SessionClockBar
          stage={clock.stage}
          remainingSeconds={clock.remainingSeconds}
          extended={clock.extended}
          onExtend={handleExtend}
          onEnd={handleEnd}
          pending={pending || ending}
        />
      ) : null}

      {/*
        The refusal, said once, where it cannot be missed.
        -------------------------------------------------
        Not a toast and not a line in a sidebar. A clinician who reaches for
        the record button out of habit needs the reason it is already off to
        be the most obvious thing on the screen — and needs to know it was the
        patient's decision rather than a bug, or they will simply "fix" it.
      */}
      {props.recordingConsent === "declined" ? (
        <p className="flex items-start gap-2 border-b border-amber-500/25 bg-amber-500/15 px-4 py-2.5 text-xs leading-relaxed text-amber-100">
          <MicOff className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
          <span>
            <strong className="font-semibold">{props.patientLabel} asked not to be recorded.</strong>{" "}
            The room is off record and no audio is being kept. Only turn recording on if they tell
            you, in the session, that they have changed their mind.
          </span>
        </p>
      ) : null}

      <div className="flex min-h-0 flex-1 flex-col">
        {props.modality === "video" ? (
          <div className="shrink-0">
            {props.videoRoomUrl ? (
              <VideoCall
                roomUrl={props.videoRoomUrl}
                token={props.videoToken}
                userName={props.therapistName}
                micMuted={offRecord}
                onRemoteAudioTrack={handleRemoteTrack}
                onPatientPresence={(present) => present && setPatientJoined(true)}
                onError={setError}
              />
            ) : (
              <div className="flex aspect-video w-full flex-col items-center justify-center gap-2 bg-black px-6 text-center">
                <Video className="h-6 w-6 text-slate-500" aria-hidden />
                <p className="text-sm font-medium text-slate-300">
                  {props.videoConfigured ? "Setting up the room…" : "Video is not configured"}
                </p>
                <p className="max-w-xs text-xs text-slate-500">
                  The session is still recorded and transcribed. Add a Daily.co API key to enable
                  video calls.
                </p>
              </div>
            )}
          </div>
        ) : null}

        {/*
          They are here — said out loud.
          ------------------------------
          Until this, the clinician's only signal that the patient had arrived
          was the *disappearance* of the waiting strip below. An absence is a
          terrible way to announce a person: a clinician who glanced away has
          nothing to glance back at, and "did the link work?" is the question
          they are actually holding while they wait.
        */}
        {props.joinUrl && patientJoined && !live ? (
          <p
            className="flex items-center gap-2 border-b border-teal-400/25 bg-teal-400/15 px-4 py-2.5 text-xs font-medium text-teal-100"
            data-patient-joined="true"
          >
            <span className="live-dot h-1.5 w-1.5 shrink-0 rounded-full bg-teal-300" aria-hidden />
            {props.patientLabel} is in the room, waiting for you to start.
          </p>
        ) : null}

        {props.joinUrl && !patientJoined ? (
          <div className="border-b border-white/10 bg-white/5 px-4 py-3" data-join-url={props.joinUrl}>
            <p className="text-xs font-medium text-slate-300">
              Waiting for your patient
              {props.priceCents > 0
                ? props.paymentStatus === "paid"
                  ? " · paid"
                  : ` · $${(props.priceCents / 100).toFixed(0)} to pay before they can join`
                : ""}
            </p>
            <div className="mt-2 flex gap-2">
              <button
                type="button"
                onClick={copyJoinLink}
                className="tap-target flex flex-1 items-center justify-center gap-2 rounded-xl bg-white/10 px-3 text-sm font-medium text-white active:bg-white/20"
              >
                {copied ? (
                  <>
                    <Copy className="h-3.5 w-3.5" aria-hidden /> Copied
                  </>
                ) : (
                  <>
                    <Link2 className="h-3.5 w-3.5" aria-hidden /> Copy join link
                  </>
                )}
              </button>
            </div>
          </div>
        ) : null}

        {crisis ? (
          <div className="px-4 pt-3">
            <RiskBanner level="high" onDismiss={() => setCrisis(false)} />
          </div>
        ) : null}

        {micDenied ? (
          <div className="mx-4 mt-3 rounded-xl bg-amber-500/10 px-3.5 py-2.5">
            <p className="text-sm text-amber-200">
              No microphone access, so nothing is being transcribed. Allow the microphone and
              reload to record this session.
            </p>
          </div>
        ) : null}

        {error ? (
          <div className="mx-4 mt-3 rounded-xl bg-red-500/10 px-3.5 py-2.5">
            <p className="text-sm text-red-200">{error}</p>
          </div>
        ) : null}

        {/*
          Anchored to the scrolling region, not the page.
          -----------------------------------------------
          The suggestions sit over the top of the transcript, which is the
          opposite end of the screen from where new lines land — so reading one
          never competes with watching the room.
        */}
        <div className="relative flex min-h-0 flex-1 flex-col">
          {live ? (
            <CopilotToasts
              toasts={toasts}
              onDismiss={(id) => setToasts((rest) => rest.filter((t) => t.id !== id))}
            />
          ) : null}

          <TranscriptPanel
              lines={lines}
            live={live}
            paused={offRecord}
            className="min-h-0 flex-1"
            emptyTitle={live ? "Listening…" : "Ready when you are"}
            emptyBody={
              live
                ? "What is said in the room appears here within a few seconds."
                : "Press Start session to begin recording and transcribing."
            }
          />
        </div>
      </div>

      <div className="safe-bottom sticky bottom-0 border-t border-white/10 bg-navy-600/95 px-4 pt-3 backdrop-blur">
        {/*
          Spoken language, above the controls rather than beside them.

          Detect is the default and should stay it. Measured on real sessions:
          clinicians here code-switch constantly — one recorded session has
          "كملي. What feelings come up for you?" as a single line — and pinning
          a language forces English clinical terms into transliteration, so
          "anxiety" comes back as "أنكزايتي". Detect keeps the real term.

          The pin is therefore not an accuracy setting and must not be sold as
          one. It exists for a clinician working strictly in one language, which
          is a minority of this user base.
        */}
        {live ? (
          <div className="mb-2.5 flex items-center gap-1.5">
            <span className="text-[10px] font-bold tracking-wider text-white/35 uppercase">
              Spoken
            </span>
            <div className="flex flex-1 gap-1 rounded-xl bg-white/5 p-0.5">
              {(
                [
                  [null, "Detect"],
                  ["en", "English"],
                  ["ar", "العربية"],
                ] as const
              ).map(([code, label]) => (
                <button
                  key={label}
                  type="button"
                  onClick={() => {
                    const previous = spokenLanguage;
                    setSpokenLanguage(code);
                    void setTranscriptLanguage(props.sessionId, code).then((r) => {
                      // Put it back rather than showing a setting that did not save.
                      if (!r.ok) setSpokenLanguage(previous);
                    });
                  }}
                  aria-pressed={spokenLanguage === code}
                  className={cn(
                    "flex-1 rounded-lg px-2 py-1 text-xs font-semibold transition-colors",
                    spokenLanguage === code
                      ? "bg-white/15 text-white"
                      : "text-white/45 active:bg-white/10",
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        ) : null}

        {live ? (
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={toggleOffRecord}
              aria-pressed={offRecord}
              className={cn(
                "tap-target flex h-13 flex-1 items-center justify-center gap-2 rounded-2xl text-sm font-semibold transition-colors",
                offRecord ? "bg-amber-500 text-white" : "bg-white/10 text-white active:bg-white/20",
              )}
            >
              {offRecord ? (
                <>
                  <MicOff className="h-4 w-4" aria-hidden /> Resume
                </>
              ) : (
                <>
                  <Mic className="h-4 w-4" aria-hidden /> Off record
                </>
              )}
            </button>

            <button
              type="button"
              onClick={handleEnd}
              disabled={ending || pending}
              className="tap-target flex h-13 flex-1 items-center justify-center gap-2 rounded-2xl bg-red-600 text-sm font-semibold text-white active:bg-red-700 disabled:opacity-60"
            >
              {ending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Ending…
                </>
              ) : (
                <>
                  <Square className="h-4 w-4" aria-hidden /> End session
                </>
              )}
            </button>
          </div>
        ) : (
          <Button size="lg" variant="teal" full onClick={handleStart} disabled={pending}>
            {pending ? "Starting…" : "Start session"}
          </Button>
        )}

        <p className="pt-2 pb-1 text-center text-[11px] text-slate-500">
          {live
            ? "Your note is written the moment you end the session."
            : "Make sure your patient has consented to recording."}
        </p>
      </div>
    </div>
  );
}

