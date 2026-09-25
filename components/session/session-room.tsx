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
  goLive,
  setRecordingPaused,
  answerInPersonConsent,
  setTranscriptLanguage,
} from "@/app/(app)/sessions/actions";
import type { CopilotSuggestion } from "@/lib/ai/copilot";
import { callMicMuted } from "@/lib/sessions/may-record";
import { sessionClock, type ClockLimits } from "@/lib/session-clock";
import { pressOffRecord } from "@/lib/sessions/off-record";
import { cn, formatDuration } from "@/lib/utils";
import { useT } from "@/lib/i18n/client";
import { rich, slot } from "@/lib/i18n/rich";
import { AskPanel } from "@/components/session/ask-panel";
import { Money } from "@/components/ui/money";

type Speaker = "therapist" | "patient" | "unknown";

type RoomProps = {
  sessionId: string;
  /** 48.1 — null for a guest session with no chart to ask about. */
  patientId: string | null;
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
  /**
   * 🔴 THE INSTANT THE SERVER RENDERED, and the reason it is a prop.
   *
   * The clock used to start from the browser's own `Date.now()` in a
   * `useState` initialiser. The server computes one instant, renders the
   * elapsed time into the HTML, and seconds later the browser hydrates and
   * computes a different one. React sees two different TEXT NODES and throws
   * #418, which is not a warning: it discards the server tree and re-renders
   * the whole room on the client.
   *
   * Everything under it unmounts and remounts, including `VideoCall`, whose
   * cleanup then destroys the Daily call object the new mount is joining. That
   * is the "Use after destroy" and "already joined meeting" pair in the
   * console, and it is the clinician being thrown out of the room and back in.
   *
   * One text node. The whole session.
   *
   * The server's instant makes the first client render byte-identical to the
   * HTML. The interval takes over with the browser's own clock a second later,
   * so a skewed client corrects itself invisibly.
   */
  serverNow: number;
  /** ISO of the moment the clinician chose to keep going, if they have. */
  clockLimits: ClockLimits;
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
  const t = useT();
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
  /*
   * 🔴 Task 123 — the answer, followed live. Null is not yet asked, and the
   * server refuses audio until it is "granted" (`mayRecord`), so the room
   * starts off record for anything short of a standing yes rather than
   * sending chunks that are thrown away.
   */
  const [consent, setConsent] = useState(props.recordingConsent);
  const consentRef = useRef(props.recordingConsent);
  const [offRecord, setOffRecord] = useState(props.recordingConsent !== "granted");
  /*
   * 🔴 C370 — a ref beside the state, because both recorders are started from
   * callbacks that would otherwise close over whatever `offRecord` was when the
   * callback was created.
   */
  const offRecordRef = useRef(props.recordingConsent !== "granted");
  /* W1-06: an off-record press waiting on the server. */
  const [pausing, setPausing] = useState(false);
  useEffect(() => {
    offRecordRef.current = offRecord;
  }, [offRecord]);
  /*
   * The clock's two inputs, mirrored so the countdown ticks every second
   * instead of stepping every five when the poll lands. The poll is still the
   * authority — it is what corrects a tab that was asleep, and it is what
   * actually ends the session.
   */
  const [startedAt, setStartedAt] = useState<string | null>(props.startedAt);
  /*
   * 🔴 The SERVER's instant, not one read here.
   *
   * Reading the clock on both sides is what threw React #418 and remounted the
   * whole room. `serverNow` in the props above carries the full argument.
   */
  const [now, setNow] = useState(() => props.serverNow);
  const [crisis, setCrisis] = useState(false);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [micDenied, setMicDenied] = useState(false);
  const [spokenLanguage, setSpokenLanguage] = useState<string | null>(props.transcriptLanguage);
  const [patientJoined, setPatientJoined] = useState(props.patientAlreadyJoined);
  const [copied, setCopied] = useState(false);
  /** 11.6 — the appointment after this one, when it is close enough to matter. */
  const [nextBooking, setNextBooking] = useState<{ minutes: number } | null>(null);
  /**
   * 🔴 76.35 — HOW LONG THE PATIENT HAS BEEN AWAY FROM THE SCREEN, or null when
   * they are looking at it.
   *
   * Minimising does not leave the call. The audio never stops, so every other
   * signal in this room says the patient is present, because they are. From
   * here that is indistinguishable from somebody looking straight at you and
   * saying nothing, and those are very different things: one is a silence to
   * sit with, the other is a person who has stepped away. Reading the wrong one
   * is a clinical error rather than a UI annoyance.
   *
   * Seconds, computed on the SERVER, because a tab that has been asleep is
   * wrong about the time by however long it slept.
   */
  const [patientAway, setPatientAway] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ending, setEnding] = useState(false);

  const localRecorder = useRef<SessionRecorder | null>(null);
  const remoteRecorder = useRef<SessionRecorder | null>(null);
  const remoteTrack = useRef<MediaStreamTrack | null>(null);
  const inflight = useRef(0);
  const liveRef = useRef(live);
  liveRef.current = live;

  /**
   * One counter shared by both recorders, for TIMING only.
   *
   * 🔴 K11: it is no longer what identifies a chunk. It started at the count
   * of lines loaded, so after a rejoin or in a second tab two chunks carried
   * the same number and the server dropped the second as a retry. Each upload
   * now carries its own random id (`chunk`) and the server assigns the stored
   * sequence; this number only places the chunk on the session's clock.
   */
  const sequence = useRef(props.initialLines.length);

  /* -------------------------------------------------------------- upload -- */

  const uploadChunk = useCallback(
    async (blob: Blob, durationSeconds: number, speaker: Speaker) => {
      const seq = (sequence.current += 1);

      const form = new FormData();
      form.append("audio", blob, `chunk-${seq}.wav`);
      form.append("sequence", String(seq));
      form.append("chunk", crypto.randomUUID());
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
         * 🔴 B62: on video this is the clinician's own microphone, whoever
         * else is or is not connected.
         *
         * In person there is one microphone hearing two people, which is
         * `unknown` and resolved afterwards from the words (`lib/ai/diarise.ts`).
         *
         * On video it used to be `therapist` only while the patient's track was
         * also recording, on the reasoning that without it this microphone
         * "picks up whatever it can hear". The reasoning was backwards: the
         * patient's voice reaches this browser only through the call, which is
         * captured on its own track and removed from this one by echo
         * cancellation, and with no call audio there is nothing of theirs here
         * to hear. Labelling it `unknown` handed the clinician's own words to a
         * guess, which put a quarter of them in the patient's mouth (R1b: 8 of
         * 32 "Them", 9 "Not sure"). A session with no patient track now says
         * so on the note instead (B61, `capturedSideFor`).
         */
        void uploadChunk(blob, durationSeconds, props.modality === "video" ? "therapist" : "unknown");
      },
      /*
       * 🔴 C370 — the recorder starts in the state the SCREEN is already in.
       *
       * `offRecord` is initialised from `recordingConsent === "declined"`, so a
       * session opened after a refusal renders the amber pill immediately. The
       * recorder was constructed unmuted and only ever muted by the toggle, so
       * until somebody pressed a button the two disagreed and the microphone
       * won. Read from the ref rather than the state so a recorder started
       * inside a callback cannot capture a stale closure.
       */
      muted: offRecordRef.current,
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
      // 🔴 C370. The patient's own track, above all, starts in the state their
      // answer put the room in.
      muted: offRecordRef.current,
    });
    try {
      await recorder.start();
      remoteRecorder.current = recorder;
    } catch {
      setError(t("troom.errPatientAudio"));
    }
  }, [uploadChunk]);

  const handleRemoteTrack = useCallback(
    (track: MediaStreamTrack | null) => {
      const had = remoteRecorder.current !== null;
      remoteTrack.current = track;
      if (!track) {
        void remoteRecorder.current?.stop();
        remoteRecorder.current = null;
        /*
         * Say it out loud. This is the "silently" half of PLAN.md 3.4.
         *
         * When the patient's track drops, this microphone is still running, so
         * recording continues, with the clinician's side only, and nothing
         * of the patient's reaches the transcript until their track is back
         * (B62). That is invisible: the clinician sees the transcript carry on
         * and has no idea half the conversation stopped being captured.
         *
         * A degradation rather than a loss, which is exactly what the message
         * should say, and why it is not an error.
         */
        if (had && liveRef.current) {
          setError(
            t("troom.audioDropped"),
          );
        }
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
   * A change of answer, from the poll or from the in-person buttons. A yes
   * turns the microphone on; a no or a withdrawal turns it off. The
   * clinician's own off-record pause is left alone while the yes stands.
   */
  const applyConsent = useCallback((next: "granted" | "declined" | null) => {
    if (next === consentRef.current) return;
    consentRef.current = next;
    setConsent(next);
    const muted = next !== "granted";
    setOffRecord(muted);
    localRecorder.current?.setMuted(muted);
    remoteRecorder.current?.setMuted(muted);
  }, []);

  /*
   * The poll now runs for the whole session, not only while waiting.
   *
   * It used to stop the moment the patient arrived, because the only thing it
   * carried was one boolean. It also carries the clock — and the clock is what
   * ends a session nobody is ending, so it has to keep asking right up until
   * the session is over.
   */
  useEffect(() => {
    /*
     * 🔴 B66: and before Start on video, for as long as the room is open.
     *
     * It used to stop the moment the patient joined, before they had answered,
     * so "Waiting for their yes" stayed on screen beside "in the room" after the
     * yes was given. The answer rides on this poll and nothing else carries it.
     */
    if (!live && props.modality !== "video") return;
    const poll = setInterval(async () => {
      try {
        const response = await fetch(`/api/sessions/${props.sessionId}/state`, {
          credentials: "same-origin",
        });
        if (!response.ok) return;
        const data = (await response.json()) as {
          patientJoined?: boolean;
          patientAwaySeconds?: number | null;
          status?: string;
          clock?: { endReason?: string | null };
          nextBooking?: { minutes: number; startsAt: string } | null;
          recordingConsent?: "granted" | "declined" | null;
        };
        if (data.recordingConsent !== undefined) applyConsent(data.recordingConsent);
        if (data.patientJoined) setPatientJoined(true);
        /* 🔴 76.35 — `?? null` and never `|| null`: zero seconds is away. */
        setPatientAway(data.patientAwaySeconds ?? null);
        // 11.6 — somebody is booked soon. On this poll rather than its own, so
        // it can never disagree with the countdown six pixels away.
        setNextBooking(data.nextBooking ?? null);

        // The server ended it — the cap, or a room everybody left. Go to the
        // note rather than leaving a dead room on screen.
        if (data.status === "completed") {
          router.replace(`/sessions/${props.sessionId}`);
          return;
        }
      } catch {
        /* transient */
      }
    }, 5000);
    return () => clearInterval(poll);
  }, [props.modality, props.sessionId, patientJoined, live, router, applyConsent]);

  /* ---------------------------------------------------------- transitions -- */

  /* B64: the booked hour, when Start was pressed well before it. */
  const [earlyFor, setEarlyFor] = useState<string | null>(null);

  const handleStart = (confirmEarly = false) => {
    setError(null);
    startTransition(async () => {
      const result = await goLive(props.sessionId, { confirmEarly });
      if (result.early) {
        setEarlyFor(result.early);
        return;
      }
      setEarlyFor(null);
      if (result.error) {
        setError(result.error);
        return;
      }
      setLive(true);
      setStartedAt(new Date().toISOString());
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

  const answerInPerson = (answer: "granted" | "declined") => {
    startTransition(async () => {
      const result = await answerInPersonConsent(props.sessionId, answer);
      applyConsent(result.consent);
    });
  };

  /*
   * 🔴 W1-06: the press waits for the server, and a failure is put back and
   * said out loud. `pressOffRecord` carries which direction is optimistic.
   */
  const toggleOffRecord = async () => {
    if (pausing) return;
    setPausing(true);
    setError(null);
    const was = offRecord;
    const outcome = await pressOffRecord(was, consentRef.current, {
      apply: (off) => {
        setOffRecord(off);
        localRecorder.current?.setMuted(off);
        remoteRecorder.current?.setMuted(off);
      },
      write: (paused) => setRecordingPaused(props.sessionId, paused),
    });
    if (outcome.failed) setError(t(was ? "troom.resumeFailed" : "troom.pauseFailed"));
    setPausing(false);
  };

  const copyJoinLink = async () => {
    if (!props.joinUrl) return;
    try {
      await navigator.clipboard.writeText(props.joinUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError(t("troom.errCopy"));
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
  const clock = sessionClock({ startedAt, now: new Date(now), limits: props.clockLimits });

  return (
    <div data-surface="room" className="flex min-h-dvh flex-col bg-navy-600">
      <header className="flex items-center justify-between gap-3 border-b border-white/10 px-4 py-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-white">{props.patientLabel}</p>
          <p className="text-xs text-slate-500">
            {props.modality === "video" ? t("troom.videoSession") : t("troom.inPerson")}
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
              {offRecord ? t("troom.offRecord") : t("troom.live")}
            </span>
          </span>
        ) : null}
      </header>

      {live ? (
        <>
          <SessionClockBar stage={clock.stage} remainingSeconds={clock.remainingSeconds} />

          {/*
          11.6 — somebody else is booked, soon.
          -------------------------------------
          Under the clock, not over it: the countdown is about the person in
          the room and this is about the next one, and a clinician who is
          running over needs the first fact before the second. Stated as a
          fact with no instruction attached — "wrap up now" is a clinical
          judgement the product does not get to make.
          */}
          {nextBooking ? (
            <p className="mx-auto w-full px-3 pt-1 text-center text-xs text-amber-700 lg:max-w-3xl">
              {nextBooking.minutes === 1
                ? t("troom.nextInOne")
                : t("troom.nextInMany", { count: nextBooking.minutes })}
            </p>
          ) : null}

          {/*
            🔴 76.35 — THE PATIENT MINIMISED THE SESSION.
            ---------------------------------------------
            Stated as a fact and nothing else, in the same register as the
            booking line above it. What to do about a patient who has stepped
            away is a clinical judgement, and a product that told a therapist to
            "check in with them" would be making it for them.

            🔴 IT SAYS THE AUDIO IS STILL LIVE, because the first thing anybody
            assumes on reading "minimised" is that the other person cannot hear
            them. They can, and a clinician who believes otherwise may say
            something they would not say into a live room.

            🔴 AND IT IS AMBER RATHER THAN RED. Nothing has gone wrong: this is
            a control the patient was given on purpose, for exactly the moments
            that would otherwise end a session.
          */}
          {patientAway !== null ? (
            <p className="mx-auto w-full px-3 pt-1 text-center text-xs text-amber-700 lg:max-w-3xl">
              {patientAway < 60
                ? t("troom.minimised")
                : Math.floor(patientAway / 60) === 1
                  ? t("troom.minimisedOne")
                  : t("troom.minimisedMany", { count: Math.floor(patientAway / 60) })}
            </p>
          ) : null}
        </>
      ) : null}

      {/*
        The refusal, said once, where it cannot be missed.
        -------------------------------------------------
        Not a toast and not a line in a sidebar. A clinician who reaches for
        the record button out of habit needs the reason it is already off to
        be the most obvious thing on the screen — and needs to know it was the
        patient's decision rather than a bug, or they will simply "fix" it.
      */}
      {props.modality === "in_person" && consent === null ? (
        <div
          className="border-b border-teal-400/25 bg-teal-400/10 px-4 py-3"
          data-consent-ask="in-person"
        >
          <p className="flex items-start gap-2 text-sm font-semibold text-teal-50">
            <MicOff className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
            {t("troom.consentAsk", { name: props.patientLabel })}
          </p>
          <p className="mt-1 text-xs leading-relaxed text-teal-100/80">{t("troom.consentHand")}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => answerInPerson("granted")}
              disabled={pending}
              className="tap-target flex-1 rounded-xl bg-teal-400 px-4 py-2.5 text-sm font-semibold text-slate-950 disabled:opacity-60"
            >
              {t("troom.consentYes")}
            </button>
            <button
              type="button"
              onClick={() => answerInPerson("declined")}
              disabled={pending}
              className="tap-target flex-1 rounded-xl bg-white/10 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
            >
              {t("troom.consentNo")}
            </button>
          </div>
        </div>
      ) : null}

      {props.modality === "video" && consent === null ? (
        <p className="flex items-start gap-2 border-b border-white/10 bg-white/5 px-4 py-2.5 text-xs leading-relaxed text-slate-200">
          <MicOff className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
          {t("troom.consentWaiting", { name: props.patientLabel })}
        </p>
      ) : null}

      {consent === "declined" ? (
        <p className="flex items-start gap-2 border-b border-amber-500/25 bg-amber-500/15 px-4 py-2.5 text-xs leading-relaxed text-amber-100">
          <MicOff className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
          <span>
            <strong className="font-semibold">
              {t("troom.declined", { name: props.patientLabel })}
            </strong>{" "}
            {t("troom.declinedBody")}
          </span>
        </p>
      ) : null}

      {/*
        One row on a wide screen, one column on a narrow one.
        ------------------------------------------------------
        The complaint this fixes, stated precisely: `video-call.tsx` is
        `aspect-[3/4] w-full sm:aspect-video`, which is responsive between phone
        and tablet and then keeps growing. At 1440px wide, `aspect-video w-full`
        is 810px tall — so on the desktop a clinician actually works on, the
        video alone is taller than the viewport and the transcript begins below
        the fold. They could watch their patient or read the transcript, never
        both, which is the whole job.

        So the video stops being full-bleed past `lg` and takes a column of its
        own with a sane ceiling, and the transcript takes the rest. Nothing
        about the narrow layout changes: on a phone this is still the same
        single column it was, because that one was never the problem.
      */}
      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        <div className="flex min-h-0 shrink-0 flex-col lg:w-[38%] lg:max-w-xl lg:border-e lg:border-white/10">
          {props.modality === "video" ? (
            <div className="shrink-0">
              {props.videoRoomUrl ? (
                <VideoCall
                  roomUrl={props.videoRoomUrl}
                  token={props.videoToken}
                  userName={props.therapistName}
                  /*
                   * 🔴 The call goes quiet only for the clinician's OWN pause.
                   * `offRecord` is also true while the patient has not said yes
                   * or has said no, and that must stop the capture, never the
                   * conversation: a patient who declines recording still has to
                   * hear their therapist.
                   */
                  micMuted={callMicMuted({ offRecord, recordingConsent: consent })}
                  onRemoteAudioTrack={handleRemoteTrack}
                  onPatientPresence={(present) => present && setPatientJoined(true)}
                  onError={setError}
                />
              ) : (
                <div className="flex aspect-video w-full flex-col items-center justify-center gap-2 bg-black px-6 text-center">
                  <Video className="h-6 w-6 text-slate-500" aria-hidden />
                  <p className="text-sm font-medium text-slate-300">
                    {props.videoConfigured
                      ? t("troom.settingUp")
                      : t("troom.videoNotConfigured")}
                  </p>
                  <p className="max-w-xs text-xs text-slate-500">
                    {t("troom.videoNote")}
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
              <span
                className="live-dot h-1.5 w-1.5 shrink-0 rounded-full bg-teal-300"
                aria-hidden
              />
              {t("troom.patientIn", { name: props.patientLabel })}
            </p>
          ) : null}

          {props.joinUrl && !patientJoined ? (
            <div
              className="border-b border-white/10 bg-white/5 px-4 py-3"
              data-join-url={props.joinUrl}
            >
              <p className="text-xs font-medium text-slate-300">
                {t("troom.waitingPatient")}
                {props.priceCents > 0
                  ? props.paymentStatus === "paid"
                    ? ` · ${t("troom.paid")}`
                    : <> · {rich(t("troom.dueBefore", { amount: slot(0) }), [<Money key="due" cents={props.priceCents} />])}</>
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
                      <Copy className="h-3.5 w-3.5" aria-hidden /> {t("troom.copied")}
                    </>
                  ) : (
                    <>
                      <Link2 className="h-3.5 w-3.5" aria-hidden /> {t("troom.copyLink")}
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
                {t("troom.noMic")}
              </p>
            </div>
          ) : null}

          {error ? (
            <div className="mx-4 mt-3 rounded-xl bg-red-500/10 px-3.5 py-2.5">
              <p className="text-sm text-red-200">{error}</p>
            </div>
          ) : null}
        </div>

        {/*
          Anchored to the scrolling region, not the page.
          -----------------------------------------------
          The suggestions sit over the top of the transcript, which is the
          opposite end of the screen from where new lines land — so reading one
          never competes with watching the room.

          On a wide screen "the opposite end" is a different place: the newest
          line still lands at the bottom of this column, so the cards still go
          at its top. What changes is that they no longer cover a transcript
          that is the only thing on screen — there is a video column beside it
          now, so a dismissed card costs nothing and an undismissed one hides
          less.
        */}
        <div className="relative flex min-h-0 flex-1 flex-col">
          {live ? (
            <CopilotToasts
              toasts={toasts}
              onDismiss={(id) => setToasts((rest) => rest.filter((t) => t.id !== id))}
            />
          ) : null}

          {/*
            🔴 48.1 / C25 — the question a therapist wants to ask happens IN
            the room, and until now answering it meant leaving.

            Only while live, because the free window is the session (48.6) and
            a panel offered outside it would spend the ordinary allowance
            without saying so. Only with a chart, because the record it reads
            is the patient's.
          */}
          {live && props.patientId ? (
            <AskPanel patientId={props.patientId} className="mb-3 max-h-80" />
          ) : null}

          <TranscriptPanel
            lines={lines}
            live={live}
            paused={offRecord}
            className="min-h-0 flex-1"
            /* Off record is not listening: nothing is being kept (task 123). */
            emptyTitle={live ? (offRecord ? t("ttr.paused") : t("ttr.listening")) : t("troom.readyWhen")}
            emptyBody={
              live
                ? offRecord
                  ? t("troom.nothingKept")
                  : t("troom.appearsHere")
                : consent === "declined"
                  ? t("troom.pressStartNoRecord")
                  : t("troom.pressStart")
            }
          />
        </div>
      </div>

      {/*
        The controls stay one bar across the bottom, and stop being a phone bar
        stretched to 1440px.

        `mx-auto max-w-3xl` rather than a second desktop-only control cluster:
        rendering these twice and hiding one per breakpoint would put two "End
        session" buttons in the accessibility tree, and the wrong one is always
        the one a screen reader reaches first.
      */}
      <div className="safe-bottom sticky bottom-0 border-t border-white/10 bg-navy-600/95 px-4 pt-3 backdrop-blur">
        <div className="mx-auto w-full lg:max-w-3xl">
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
                {t("troom.spoken")}
              </span>
              <div className="flex flex-1 gap-1 rounded-xl bg-white/5 p-0.5">
                {(
                  [
                    [null, t("troom.detect")],
                    ["en", t("tcop.english")],
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
                onClick={() => void toggleOffRecord()}
                aria-pressed={offRecord}
                aria-busy={pausing}
                disabled={pausing || (offRecord && consent !== "granted")}
                className={cn(
                  "tap-target flex h-13 flex-1 items-center justify-center gap-2 rounded-2xl text-sm font-semibold transition-colors",
                  offRecord
                    ? "bg-amber-500 text-white disabled:bg-white/10 disabled:text-slate-400"
                    : "bg-white/10 text-white active:bg-white/20",
                )}
              >
                {offRecord && consent !== "granted" ? (
                  <>
                    <MicOff className="h-4 w-4" aria-hidden /> {t("troom.resumeNeedsYes")}
                  </>
                ) : offRecord ? (
                  <>
                    <MicOff className="h-4 w-4" aria-hidden /> {t("troom.resume")}
                  </>
                ) : (
                  <>
                    <Mic className="h-4 w-4" aria-hidden /> {t("troom.offRecord")}
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
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> {t("troom.ending")}
                  </>
                ) : (
                  <>
                    <Square className="h-4 w-4" aria-hidden /> {t("troom.endSession")}
                  </>
                )}
              </button>
            </div>
          ) : (
            <>
              {/*
                🔴 B64: asked, not refused. A clinician may have agreed an
                earlier time with the patient; what they may not do is wake
                somebody at midnight for a ten o'clock booking by accident.
              */}
              {earlyFor ? (
                <p role="alert" className="mb-2 rounded-xl bg-amber-500/15 px-3.5 py-2.5 text-sm text-amber-100">
                  {t("troom.earlyStart", { time: earlyFor, name: props.patientLabel })}
                </p>
              ) : null}
              <Button
                size="lg"
                variant="primary"
                full
                onClick={() => handleStart(earlyFor !== null)}
                disabled={pending}
              >
                {pending ? t("troom.starting") : earlyFor ? t("troom.startAnyway") : t("troom.startSession")}
              </Button>
            </>
          )}

          <p className="pt-2 pb-1 text-center text-[11px] text-slate-500">
            {live
              ? consent === "declined"
                ? t("troom.noteOwnOnEnd")
                : t("troom.noteOnEnd")
              : t("troom.consentFirst")}
          </p>
        </div>
      </div>
    </div>
  );
}
