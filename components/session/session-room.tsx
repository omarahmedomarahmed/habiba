"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Copy, Link2, Loader2, Mic, MicOff, Square, Video } from "lucide-react";

import { RiskBanner } from "@/components/clinical/risk-banner";
import { TranscriptPanel, type TranscriptLine } from "@/components/clinical/transcript-panel";
import { Button } from "@/components/ui";
import { SessionRecorder } from "@/lib/audio/recorder";
import { endSession, goLive } from "@/app/(app)/sessions/actions";
import { cn, formatDuration } from "@/lib/utils";

type RoomProps = {
  sessionId: string;
  patientLabel: string;
  modality: "in_person" | "video";
  initialStatus: "scheduled" | "in_progress" | "completed" | "cancelled";
  videoRoomUrl: string | null;
  videoConfigured: boolean;
  joinUrl: string | null;
  initialLines: TranscriptLine[];
  patientAlreadyJoined: boolean;
};

export function SessionRoom(props: RoomProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const [live, setLive] = useState(props.initialStatus === "in_progress");
  const [lines, setLines] = useState<TranscriptLine[]>(props.initialLines);
  const [offRecord, setOffRecord] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [crisis, setCrisis] = useState(false);
  const [micDenied, setMicDenied] = useState(false);
  const [patientJoined, setPatientJoined] = useState(props.patientAlreadyJoined);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ending, setEnding] = useState(false);

  const recorderRef = useRef<SessionRecorder | null>(null);
  const inflight = useRef(0);

  /* -------------------------------------------------------------- upload -- */

  const uploadChunk = useCallback(
    async (blob: Blob, durationSeconds: number, sequence: number) => {
      const form = new FormData();
      form.append("audio", blob, `chunk-${sequence}.wav`);
      form.append("sequence", String(sequence));
      form.append("duration", String(durationSeconds));

      inflight.current += 1;
      try {
        // Credentials ride on the httpOnly session cookie, so there is no token
        // to read, refresh or accidentally capture in a stale closure. The old
        // client had to re-read a bearer token from localStorage on every
        // single chunk to avoid 401s after a silent refresh.
        const response = await fetch(`/api/sessions/${props.sessionId}/transcribe`, {
          method: "POST",
          body: form,
          credentials: "same-origin",
        });

        if (!response.ok) return;

        const data = (await response.json()) as {
          text?: string;
          sequence?: number;
          crisis?: boolean;
        };

        if (data.text) {
          setLines((current) => [
            ...current,
            { id: `s-${data.sequence}`, speaker: "unknown", text: data.text! },
          ]);
        }
        // The chunk response is the push channel — no socket required.
        if (data.crisis) setCrisis(true);
      } catch {
        // A dropped chunk costs a few seconds of transcript, never the session.
      } finally {
        inflight.current -= 1;
      }
    },
    [props.sessionId],
  );

  /* ------------------------------------------------------------ recording -- */

  const beginRecording = useCallback(async () => {
    if (recorderRef.current) return;
    const recorder = new SessionRecorder({
      onChunk: ({ blob, durationSeconds, sequence }) => {
        void uploadChunk(blob, durationSeconds, sequence);
      },
    });
    try {
      await recorder.start();
      recorderRef.current = recorder;
      setMicDenied(false);
    } catch {
      // No microphone is a degraded session, not a failed one: the video call
      // and the record still work, there is simply no transcript.
      setMicDenied(true);
    }
  }, [uploadChunk]);

  useEffect(() => {
    if (live && !recorderRef.current) void beginRecording();
  }, [live, beginRecording]);

  useEffect(() => {
    return () => {
      void recorderRef.current?.stop();
      recorderRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!live) return;
    const timer = setInterval(() => setElapsed((n) => n + 1), 1000);
    return () => clearInterval(timer);
  }, [live]);

  /* --------------------------------------------------- patient poll (video) */

  useEffect(() => {
    if (props.modality !== "video" || patientJoined) return;
    const poll = setInterval(async () => {
      try {
        const response = await fetch(`/api/sessions/${props.sessionId}/state`, {
          credentials: "same-origin",
        });
        if (!response.ok) return;
        const data = (await response.json()) as { patientJoined?: boolean };
        if (data.patientJoined) setPatientJoined(true);
      } catch {
        /* transient */
      }
    }, 5000);
    return () => clearInterval(poll);
  }, [props.modality, props.sessionId, patientJoined]);

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
    });
  };

  const handleEnd = () => {
    setEnding(true);
    setError(null);
    startTransition(async () => {
      // Flush the tail of the audio before the status flips, or the last few
      // seconds are dropped and the note is written without them.
      await recorderRef.current?.stop();
      recorderRef.current = null;

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
    recorderRef.current?.setMuted(next);
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

  return (
    <div className="flex min-h-dvh flex-col bg-navy-600">
      <header className="flex items-center justify-between gap-3 border-b border-white/10 px-4 py-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-white">{props.patientLabel}</p>
          <p className="text-xs text-slate-400">
            {props.modality === "video" ? "Video session" : "In person"}
            {live ? ` · ${formatDuration(elapsed)}` : ""}
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

      <div className="flex min-h-0 flex-1 flex-col">
        {props.modality === "video" ? (
          <div className="shrink-0 bg-black">
            {props.videoRoomUrl ? (
              <iframe
                src={props.videoRoomUrl}
                title="Video call"
                allow="camera; microphone; fullscreen; display-capture; autoplay"
                className="aspect-video w-full border-0"
              />
            ) : (
              <div className="flex aspect-video w-full flex-col items-center justify-center gap-2 px-6 text-center">
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

        {props.joinUrl && !patientJoined ? (
          <div className="border-b border-white/10 bg-white/5 px-4 py-3">
            <p className="text-xs font-medium text-slate-300">Waiting for your patient</p>
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

      <div className="safe-bottom sticky bottom-0 border-t border-white/10 bg-navy-600/95 px-4 pt-3 backdrop-blur">
        {live ? (
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={toggleOffRecord}
              aria-pressed={offRecord}
              className={cn(
                "tap-target flex h-13 flex-1 items-center justify-center gap-2 rounded-2xl text-sm font-semibold transition-colors",
                offRecord
                  ? "bg-amber-500 text-white"
                  : "bg-white/10 text-white active:bg-white/20",
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
