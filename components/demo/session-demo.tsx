"use client";

import { Component, type ReactNode, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Mic, MicOff, Pause, Play, RotateCcw, Sparkles, Square, User } from "lucide-react";

import { MotionRoot, soft } from "./motion";
import { NoteCard } from "@/components/clinical/note-card";
import { TranscriptPanel } from "@/components/clinical/transcript-panel";
import { Avatar, Glow } from "@/components/clinician/kit";
import type { DemoContent } from "@/lib/content/demo";
import { useLocale, useT } from "@/lib/i18n/client";
import { DEMO_PATIENT_NAME } from "@/lib/marketing/fixtures";
import { DEMO_NOTE, DEMO_TRANSCRIPT } from "./fixtures";
import { SessionCopilot } from "./session-copilot";
import { cn } from "@/lib/utils";

/**
 * 🔴 THE SESSION ROOM, AS THE REDESIGN DRAWS IT, running on its own.
 *
 * The room's ground is navy-900, as `components/session/session-room.tsx` is.
 * It opens on the consent card the real room shows for an in-person session:
 * recording waits for the patient's yes, and the session runs either way. Yes
 * starts the transcript and the copilot beside it; No leaves the room off the
 * record, which is the rule demonstrated rather than described. Ending it
 * writes the note, and the note opens on the two documents the real review
 * screen has (`components/session/note-review.tsx`): the clinical note, and the
 * summary the patient reads.
 *
 * ## Why it still runs by itself
 *
 * A hero that waits for a click shows an empty room to everybody who does not
 * click, which is most people. So it answers the consent card itself after a
 * beat, lines arrive every couple of seconds, and a few seconds after the last
 * one the session ends and the note is written. Every step is also a control:
 * Yes or No, pause, End session, Replay.
 *
 * `prefers-reduced-motion` skips to the finished note, with the whole
 * transcript above it and nothing moving.
 */

const STATIC_LINES = 4;
const TICK_MS = 2400;
/** How long the finished conversation sits before the session ends on its own. */
const GRACE_MS = 6000;
/** How long "writing the note" shows before the note appears. */
const WRITE_MS = 1800;
/** How long the consent card waits before the demo answers it. */
const ASK_MS = 2600;

export type SessionDemoLabels = {
  inProgress: string;
  ended: string;
  meta: string;
  play: string;
  pause: string;
  replay: string;
  recording: string;
  endSession: string;
  waiting: string;
  generated: string;
  disclaimer: string;
  patientLabel: string;
};

export const SESSION_DEMO_LABELS: SessionDemoLabels = {
  inProgress: "Session in progress",
  ended: "Session ended",
  meta: "In person · 24:10",
  play: "Play",
  pause: "Pause",
  replay: "Replay",
  recording: "Recording, both speakers",
  endSession: "End session",
  waiting: "Writing the note from what was said.",
  generated: "Generated in 18 seconds",
  disclaimer: "Simulated session with invented data, not a real patient.",
  patientLabel: "demo",
};

type Phase = "live" | "writing" | "done";
type Consent = "asking" | "yes" | "no";

function SessionDemoInner({
  className,
  content,
  labels,
}: {
  className?: string;
  content?: DemoContent;
  labels: SessionDemoLabels;
}) {
  const t = useT();
  const locale = useLocale();
  const name = DEMO_PATIENT_NAME[locale];
  const transcript = content?.transcript ?? DEMO_TRANSCRIPT;
  const note = content?.note ?? DEMO_NOTE;

  const [visible, setVisible] = useState(STATIC_LINES);
  const [playing, setPlaying] = useState(false);
  const [phase, setPhase] = useState<Phase>("live");
  const [consent, setConsent] = useState<Consent>("asking");
  const [reducedMotion, setReducedMotion] = useState(false);
  const [run, setRun] = useState(0);
  const [doc, setDoc] = useState<"clinical" | "patient">("clinical");
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (query.matches) {
      setReducedMotion(true);
      setConsent("yes");
      setVisible(transcript.length);
      setPhase("done");
      return;
    }
    setVisible(0);
    setPlaying(true);
  }, []);

  /* The card answers itself after a beat, so a reader who never presses still sees the room work. */
  useEffect(() => {
    if (consent !== "asking" || reducedMotion || !playing) return;
    const answer = setTimeout(() => { yes(); }, ASK_MS);
    return () => { clearTimeout(answer); };
  }, [consent, reducedMotion, playing, run]);

  useEffect(() => {
    if (!playing || reducedMotion || phase !== "live" || consent !== "yes") return;
    timer.current = setInterval(() => {
      setVisible((n) => (n >= transcript.length ? n : n + 1));
    }, TICK_MS);
    return () => {
      if (timer.current) clearInterval(timer.current);
    };
  }, [playing, reducedMotion, phase, consent, transcript.length]);

  const said = visible >= transcript.length;

  useEffect(() => {
    if (!said || reducedMotion || phase !== "live" || !playing) return;
    const end = setTimeout(() => { setPhase("writing"); }, GRACE_MS);
    return () => { clearTimeout(end); };
  }, [said, reducedMotion, phase, playing]);

  useEffect(() => {
    if (phase !== "writing") return;
    const done = setTimeout(() => { setPhase("done"); }, WRITE_MS);
    return () => { clearTimeout(done); };
  }, [phase]);

  function yes() {
    setConsent("yes");
    setVisible((n) => Math.max(n, 1));
  }

  /* Ending is a control, not only a timer: the note, now. */
  function endNow() {
    setVisible(transcript.length);
    setPhase("writing");
  }

  function replay() {
    setVisible(0);
    setConsent("asking");
    setPhase("live");
    setDoc("clinical");
    setPlaying(true);
    setRun((n) => n + 1);
  }

  const lines = consent === "yes" ? transcript.slice(0, visible) : [];
  const live = phase === "live";
  const recording = live && consent === "yes";

  return (
    <MotionRoot>
      <div className={cn("w-full", className)}>
        {/* ───────────────────────────────────────────────── the room ── */}
        <div className="relative overflow-hidden rounded-[28px] bg-navy-900 text-white shadow-[0_40px_120px_-40px_rgba(3,11,23,0.8)] ring-1 ring-white/10">
          <Glow className="-start-24 -top-24 h-64 w-64 opacity-60" />

          <header className="relative flex items-center gap-3 border-b border-white/10 px-4 py-3">
            <Avatar name={name} size={38} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-[15px] font-bold">{name}</p>
              <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1">
                <p className="truncate text-xs text-white/70 tabular-nums">{labels.meta}</p>
                {live ? (
                  <span className="flex shrink-0 items-center gap-1.5 rounded-full bg-white/10 px-2.5 py-0.5 ring-1 ring-white/15">
                    <span className={cn("h-2 w-2 rounded-full", recording ? "live-dot bg-red-500" : "bg-amber-400")} />
                    <span className="text-[12px] font-semibold">{recording ? t("troom.live") : t("troom.offRecord")}</span>
                  </span>
                ) : (
                  <span className="shrink-0 rounded-full bg-white/10 px-2.5 py-0.5 text-[12px] font-semibold ring-1 ring-white/15">
                    {labels.ended}
                  </span>
                )}
              </div>
            </div>

            {!reducedMotion ? (
              <button
                type="button"
                onClick={() => {
                  if (phase === "done") replay();
                  else setPlaying((p) => !p);
                }}
                aria-label={phase === "done" ? labels.replay : playing ? labels.pause : labels.play}
                className="tap-target flex shrink-0 items-center gap-1.5 rounded-xl px-2.5 text-[12px] font-semibold text-white/85 hover:bg-white/5"
              >
                {phase === "done" ? (
                  <RotateCcw className="h-3.5 w-3.5" aria-hidden />
                ) : playing ? (
                  <Pause className="h-3.5 w-3.5" aria-hidden />
                ) : (
                  <Play className="h-3.5 w-3.5" aria-hidden />
                )}
                <span className="hidden sm:inline">
                  {phase === "done" ? labels.replay : playing ? labels.pause : labels.play}
                </span>
              </button>
            ) : null}
          </header>

          {/*
            🔴 THE CONSENT CARD, the real room's (`data-consent-ask="in-person"`):
            teal on the navy, the two answers side by side, and the session
            running whichever is pressed.
          */}
          <AnimatePresence initial={false}>
            {consent === "asking" && live ? (
              <motion.div
                key="ask"
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                transition={soft}
                className="relative overflow-hidden"
              >
                <div className="mx-4 mt-3 rounded-3xl border border-teal-400/30 bg-teal-400/10 p-4">
                  <p className="flex items-start gap-2.5 text-[15px] font-bold">
                    <MicOff className="mt-0.5 h-5 w-5 shrink-0 text-teal-300" aria-hidden />
                    {t("troom.consentAsk", { name })}
                  </p>
                  <p className="mt-1 ps-7.5 text-sm leading-relaxed text-white/75">{t("troom.consentHand")}</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={yes}
                      className="tap-target h-11 min-w-0 flex-1 rounded-2xl bg-teal-400 px-3 text-sm font-bold text-navy-700"
                    >
                      {t("troom.consentYes")}
                    </button>
                    <button
                      type="button"
                      onClick={() => { setConsent("no"); }}
                      className="tap-target h-11 min-w-0 flex-1 rounded-2xl bg-white/10 px-3 text-sm font-bold text-white ring-1 ring-white/15"
                    >
                      {t("troom.consentNo")}
                    </button>
                  </div>
                </div>
              </motion.div>
            ) : null}
          </AnimatePresence>

          {consent === "no" ? (
            <p className="relative mx-4 mt-3 flex items-start gap-2.5 rounded-2xl bg-amber-400/15 px-4 py-3 text-sm leading-relaxed text-amber-100 ring-1 ring-amber-400/30">
              <MicOff className="mt-0.5 h-4 w-4 shrink-0 text-amber-300" aria-hidden />
              <span>
                <strong className="font-semibold">{t("troom.declined", { name })}</strong>{" "}
                {t("troom.declinedBody")}
              </span>
            </p>
          ) : null}

          {/* The recording strip: it is listening, and the one control that matters. */}
          {live && consent === "yes" ? (
            <div className="relative mt-3 flex items-center gap-3 border-y border-white/10 bg-white/[0.03] px-4 py-2.5">
              <span className="flex shrink-0 items-center gap-1.5 text-[12px] font-semibold text-teal-200">
                <Mic className="h-3.5 w-3.5" aria-hidden />
                <span className="hidden sm:inline">{labels.recording}</span>
              </span>
              <Wave live={playing && !reducedMotion} />
              <button
                type="button"
                onClick={endNow}
                className="tap-target flex shrink-0 items-center gap-1.5 rounded-xl bg-red-500/15 px-3 text-[12px] font-semibold text-red-100 ring-1 ring-red-400/30 hover:bg-red-500/25"
              >
                <Square className="h-3 w-3 fill-current" aria-hidden />
                {labels.endSession}
              </button>
            </div>
          ) : null}

          <TranscriptPanel
            lines={lines}
            live={recording}
            paused={consent === "no"}
            autoScroll={!reducedMotion}
            className="relative h-40 sm:h-48"
          />

          {/*
            THE PANEL UNDER THE TRANSCRIPT: the copilot while the session runs,
            the note being written, then the two documents. One fixed height,
            so nothing under the room moves when the phase changes.
          */}
          <div className="relative h-[22rem] border-t border-white/10 p-3 sm:h-[23rem]">
            {phase === "done" ? (
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={soft}
                className="flex h-full flex-col gap-2.5"
              >
                {/* The two documents, as the review screen's own switch. */}
                <div className="flex shrink-0 gap-1.5 rounded-3xl bg-white/[0.06] p-1.5 ring-1 ring-white/10">
                  {(
                    [
                      { id: "clinical", icon: Sparkles, label: t("tnote.clinicalTab") },
                      { id: "patient", icon: User, label: t("tnote.patientTab") },
                    ] as const
                  ).map((tab) => {
                    const on = doc === tab.id;
                    return (
                      <button
                        key={tab.id}
                        type="button"
                        aria-pressed={on}
                        onClick={() => { setDoc(tab.id); }}
                        className={cn(
                          "relative flex min-w-0 flex-1 flex-col gap-1 rounded-2xl px-3 py-2 text-start",
                          on ? "bg-white text-navy-700" : "text-white/80 hover:text-white",
                        )}
                      >
                        <span className="relative flex items-center gap-1.5 truncate text-[13px] font-bold">
                          <tab.icon className="h-3.5 w-3.5 shrink-0" aria-hidden />
                          <span className="truncate">{tab.label}</span>
                        </span>
                        <span className="relative w-fit max-w-full truncate rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-800">
                          {tab.id === "clinical" ? t("tnote.stateDraft") : t("tnote.stateNotApproved")}
                        </span>
                      </button>
                    );
                  })}
                </div>
                <div className="no-scrollbar min-h-0 flex-1 overflow-y-auto rounded-2xl bg-white text-navy-700">
                  {doc === "clinical" ? (
                    <NoteCard
                      note={note}
                      status="draft"
                      patientLabel={labels.patientLabel}
                      dateLabel={labels.generated}
                      compact
                    />
                  ) : (
                    <p className="p-4 text-[14px] leading-relaxed text-navy-600">{content?.brief}</p>
                  )}
                </div>
              </motion.div>
            ) : phase === "writing" ? (
              <div className="flex h-full flex-col items-center justify-center gap-3 px-6 text-center">
                <Sparkles className="h-5 w-5 animate-pulse text-brand-300" aria-hidden />
                <p className="text-sm font-medium text-white/85">{labels.waiting}</p>
                <span className="h-1 w-40 overflow-hidden rounded-full bg-white/10">
                  <span className="live-dot block h-full w-1/2 rounded-full bg-brand-400" />
                </span>
              </div>
            ) : consent === "yes" ? (
              /*
                🔴 THE COPILOT, beside the room as the redesign puts it, in its
                own white panel because it is the one surface in that room a
                person reads rather than glances at. `key` is the run counter
                so Replay gives an empty thread back.
              */
              <div className="h-full overflow-hidden rounded-2xl bg-white text-navy-700">
                <SessionCopilot key={run} content={content} className="h-full" />
              </div>
            ) : (
              <div className="flex h-full items-center justify-center rounded-2xl bg-white/[0.04] ring-1 ring-white/10">
                <MicOff className="h-6 w-6 text-white/40" aria-hidden />
              </div>
            )}
          </div>
        </div>

        <p className="mt-4 text-center text-[12px] text-white/70">{labels.disclaimer}</p>
      </div>
    </MotionRoot>
  );
}

function Wave({ live }: { live: boolean }) {
  const heights = [0.45, 0.85, 0.6, 1, 0.5, 0.75, 0.35];
  return (
    <span aria-hidden className="flex min-w-0 flex-1 items-center justify-center gap-[3px]">
      {heights.map((h, i) => (
        <span
          key={i}
          className={cn("w-[3px] rounded-full", live ? "wave-bar bg-teal-300/80" : "bg-white/20")}
          style={{
            height: `${String(Math.round(h * 18))}px`,
            animationDelay: `${String(i * 130)}ms`,
          }}
        />
      ))}
    </span>
  );
}

/**
 * What renders if the animated demo throws: the conversation so far and the
 * note it produced, standing still. A hero that fails to a blank rectangle is
 * worse than one that fails to a picture of the same thing.
 */
function StaticFallback({
  className,
  content,
  labels,
}: {
  className?: string;
  content?: DemoContent;
  labels: SessionDemoLabels;
}) {
  return (
    <div className={cn("w-full", className)}>
      <div className="overflow-hidden rounded-[28px] bg-navy-900 ring-1 ring-white/10">
        <TranscriptPanel
          lines={(content?.transcript ?? DEMO_TRANSCRIPT).slice(0, STATIC_LINES)}
          className="h-44 sm:h-52"
        />
        <div className="no-scrollbar h-[21rem] overflow-y-auto border-t border-white/10 p-3">
          <div className="rounded-2xl bg-white">
            <NoteCard note={content?.note ?? DEMO_NOTE} status="draft" compact />
          </div>
        </div>
      </div>
      <p className="mt-4 text-center text-[12px] text-white/70">{labels.disclaimer}</p>
    </div>
  );
}

class DemoBoundary extends Component<
  { children: ReactNode; fallback: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

export function SessionDemo({
  className,
  content,
  labels = SESSION_DEMO_LABELS,
}: {
  className?: string;
  content?: DemoContent;
  labels?: SessionDemoLabels;
}) {
  return (
    <DemoBoundary
      fallback={<StaticFallback className={className} content={content} labels={labels} />}
    >
      <SessionDemoInner className={className} content={content} labels={labels} />
    </DemoBoundary>
  );
}

export { StaticFallback as SessionDemoStatic };
