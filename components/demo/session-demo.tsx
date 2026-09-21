"use client";

import { Component, type ReactNode, useEffect, useRef, useState } from "react";
import { Mic, Pause, Play, RotateCcw, Sparkles, Square } from "lucide-react";

import { NoteCard } from "@/components/clinical/note-card";
import { TranscriptPanel } from "@/components/clinical/transcript-panel";
import type { DemoContent } from "@/lib/content/demo";
import { DEMO_NOTE, DEMO_TRANSCRIPT } from "./fixtures";
import { SessionCopilot } from "./session-copilot";
import { cn } from "@/lib/utils";

/** How many lines are rendered on the server and before hydration. */
const STATIC_LINES = 4;
const TICK_MS = 2400;
/**
 * The pause between the last thing said and the session ending on its own.
 *
 * Long enough that a reader who has just started pressing the copilot's
 * questions is not cut off mid-answer, short enough that somebody who is only
 * watching still reaches the note. Anybody who wants it now presses End.
 */
const GRACE_MS = 6000;
/** How long the note takes to appear. The room reads as working, briefly. */
const WRITE_MS = 1800;

/**
 * 🔴 76.32 — THE HERO'S OWN WORDS, PASSED IN RATHER THAN TYPED HERE.
 *
 * This is a client component, so it cannot read the dictionary: `getI18n` is
 * server-only and C84's reasoning applies to the same boundary. Sprint 28 gave
 * the demo's CONTENT an Arabic floor and could not reach the chrome around it
 * from `lib/content/demo.ts`, so "Session in progress" and the rest rendered in
 * English on the Arabic homepage for fifty-four sprints under a `deferred` line.
 *
 * Plain strings, resolved by the server component that renders this. Not a
 * `t` function: `verify:boundary` forbids handing a function across the client
 * boundary, and it is right to, because that is how `/pricing` served 500 to
 * every visitor for seven sprints.
 */
export type SessionDemoLabels = {
  /** The status line in the room's header, while it is running. */
  inProgress: string;
  /** The same line once it has finished. */
  ended: string;
  /** The modality and the elapsed time beside it. */
  meta: string;
  play: string;
  pause: string;
  replay: string;
  /** The recording strip, which is what an in-person session actually shows. */
  recording: string;
  /** The therapist's own control for finishing. Real, and pressable here. */
  endSession: string;
  /** The short beat between the session ending and the note landing. */
  waiting: string;
  /** How long the note took, shown where a real note shows its date. */
  generated: string;
  /** The line under the whole thing, which is a disclosure rather than copy. */
  disclaimer: string;
  /** Where a real note names the patient. C225: never a name, real or invented. */
  patientLabel: string;
};

/**
 * The English floor, for a caller with no dictionary in hand.
 *
 * It is the same arrangement `DEMO_FALLBACK` has and for the same reason: the
 * marketing site must not go blank because something upstream failed, and a
 * hero with no words in it is a blank page with a border.
 */
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

/** Where the demo is in the one thing it is demonstrating. */
type Phase = "live" | "writing" | "done";

/**
 * The live hero: the real `TranscriptPanel` and the real `NoteCard` from the
 * clinician's portal, driven by synthetic fixtures.
 *
 * ## 🔴 76.82 — THE ROOM IS THE ROOM, AND THE NOTE WAITS ITS TURN
 *
 * What this used to be: a dark transcript with dark suggestion cards floating
 * over it, and under that a white box the height of the finished note holding
 * one grey sentence promising a note later. Two faults, and they were the same
 * fault twice.
 *
 *   1. **A third of the hero was a placeholder.** The largest white surface on
 *      the page, above the fold, reserved for fifteen seconds to say "something
 *      will appear here". A reader who scrolled past in eight seconds saw an
 *      empty panel and a promise, which is what an unfinished product looks
 *      like.
 *   2. **The copilot was dark on dark.** Grey cards at 13px over a navy
 *      transcript, which is the one thing nobody reads while a person is
 *      talking — and so the half of the product that speaks DURING the session
 *      was illegible in the picture that exists to show it.
 *
 * Both are the same room now. The dark panel is the session: a recording strip
 * and the transcript arriving. The white panel beneath it is the clinician's
 * own surface, and it holds the copilot WHILE the session runs — white, large,
 * answerable — and then the note when it ends. Nothing is reserved for later;
 * the space is doing the work the whole time, which is also exactly how the
 * therapist's screen spends it.
 *
 * ## Ending is a control, not only a timer
 *
 * The room carries the real End button. Press it and the note comes now; leave
 * it and the session ends on its own a few seconds after the last line, so a
 * reader who is only watching still gets there. Replay puts it back to the
 * first line, copilot thread and all.
 *
 * Constraints this component is still built around:
 *
 *  - **No hydration mismatch.** The server and the first client render both
 *    show exactly `STATIC_LINES` lines. Animation only ever starts inside an
 *    effect, after hydration.
 *  - **Works without JavaScript.** What renders statically is a genuinely
 *    useful mockup rather than an empty shell waiting for a timer.
 *  - **Pausable, and honours reduced motion.** WCAG 2.2.2 requires a control
 *    for content that moves for more than five seconds. Users who have asked
 *    for reduced motion get the finished state immediately and no ticker.
 *  - **Bundle cost.** This imports presentational components and lucide icons.
 *    It deliberately does not touch the API client, the auth session or
 *    anything that reaches a database — importing those at module scope is what
 *    would drag the authenticated app onto a marketing page.
 */
function SessionDemoInner({
  className,
  content,
  labels,
}: {
  className?: string;
  content?: DemoContent;
  labels: SessionDemoLabels;
}) {
  /*
   * 🔴 76.32 — the transcript and the note come from `content` when there is
   * one. The fixtures stay as the floor, unchanged, so a caller that has no
   * content renders exactly what it rendered before.
   */
  const transcript = content?.transcript ?? DEMO_TRANSCRIPT;
  const note = content?.note ?? DEMO_NOTE;

  const [visible, setVisible] = useState(STATIC_LINES);
  const [playing, setPlaying] = useState(false);
  const [phase, setPhase] = useState<Phase>("live");
  const [reducedMotion, setReducedMotion] = useState(false);
  /*
   * Bumped by Replay. It is the copilot panel's `key`, which is the only way to
   * put a component that owns a growing thread back to an empty one: the thread
   * is its state, and a prop that said "start again" would be a second source
   * of truth for the same thing.
   */
  const [run, setRun] = useState(0);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (query.matches) {
      setReducedMotion(true);
      setVisible(transcript.length);
      setPhase("done");
      return;
    }
    // Restart from the beginning so the animation reads as a session unfolding.
    setVisible(1);
    setPlaying(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!playing || reducedMotion || phase !== "live") return;
    timer.current = setInterval(() => {
      setVisible((n) => (n >= transcript.length ? n : n + 1));
    }, TICK_MS);
    return () => {
      if (timer.current) clearInterval(timer.current);
    };
  }, [playing, reducedMotion, phase, transcript.length]);

  const said = visible >= transcript.length;

  /* The session ends on its own a beat after the last thing said. */
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

  function endNow() {
    setVisible(transcript.length);
    setPhase("writing");
  }

  function replay() {
    setVisible(1);
    setPhase("live");
    setPlaying(true);
    setRun((n) => n + 1);
  }

  const lines = transcript.slice(0, visible);
  const live = phase === "live";

  return (
    <div className={cn("w-full", className)}>
      {/* ───────────────────────────────────────────────── the room ── */}
      <div className="overflow-hidden rounded-3xl border border-slate-800/60 bg-navy-500 shadow-2xl shadow-navy-900/25">
        <div className="flex items-center justify-between gap-3 border-b border-slate-800/60 px-4 py-3">
          <div className="flex min-w-0 items-center gap-2.5">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-teal-500/15 text-teal-300">
              <Sparkles className="h-3.5 w-3.5" aria-hidden />
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-white">
                {live ? labels.inProgress : labels.ended}
              </p>
              {/*
                🔴 76.83 — `text-slate-400` on navy is 3.2:1, which is under the
                floor for anything a person is meant to read. It is the same
                grey that was swept off every other surface this sprint, and a
                hero is the worst place to keep it.
              */}
              <p className="truncate text-[11px] text-slate-300">{labels.meta}</p>
            </div>
          </div>

          {!reducedMotion ? (
            <button
              type="button"
              onClick={() => {
                if (phase === "done") replay();
                else setPlaying((p) => !p);
              }}
              aria-label={
                phase === "done" ? labels.replay : playing ? labels.pause : labels.play
              }
              className="tap-target flex shrink-0 items-center gap-1.5 rounded-lg px-2.5 text-[11px] font-medium text-slate-200 hover:bg-white/5"
            >
              {phase === "done" ? (
                <RotateCcw className="h-3.5 w-3.5" aria-hidden />
              ) : playing ? (
                <Pause className="h-3.5 w-3.5" aria-hidden />
              ) : (
                <Play className="h-3.5 w-3.5" aria-hidden />
              )}
              {phase === "done" ? labels.replay : playing ? labels.pause : labels.play}
            </button>
          ) : null}
        </div>

        {/*
          🔴 THE RECORDING STRIP, which is what an in-person session IS.
          The demo's own meta line says "In person", so there is no video call
          to draw: two people in a room and a phone on the table between them.
          What the clinician sees is that it is listening, and the one control
          that matters — the end of it.
        */}
        <div className="flex items-center gap-3 border-b border-slate-800/60 bg-navy-600/60 px-4 py-2.5">
          {/*
            Only while it is running. The header above already says the session
            has ended, and a strip that repeated it put the same three words on
            the screen twice, one line apart.
          */}
          {live ? (
            <span className="flex shrink-0 items-center gap-1.5 text-[11px] font-semibold text-teal-200">
              <Mic className="h-3.5 w-3.5" aria-hidden />
              {labels.recording}
            </span>
          ) : null}

          <Wave live={live && playing && !reducedMotion} />

          {live ? (
            <button
              type="button"
              onClick={endNow}
              className="tap-target flex shrink-0 items-center gap-1.5 rounded-lg border border-red-400/30 bg-red-500/15 px-2.5 text-[11px] font-semibold text-red-200 hover:bg-red-500/25"
            >
              <Square className="h-3 w-3 fill-current" aria-hidden />
              {labels.endSession}
            </button>
          ) : null}
        </div>

        <TranscriptPanel
          lines={lines}
          live={live}
          autoScroll={!reducedMotion}
          className="h-44 sm:h-52"
        />
      </div>

      {/*
       * ─────────────────────────────────────── the clinician's surface ──
       *
       * Fixed height, and whatever is inside it scrolls.
       *
       * The demo runs on its own timer above the fold. If this slot grows when
       * the note arrives, the whole page shifts under the reader mid-sentence —
       * an unrequested layout jump on content nobody asked to play. The slot is
       * sized for the tallest state up front and never changes.
       */}
      <div className="relative -mt-4 h-[21rem] px-3 sm:h-[23rem] sm:px-6">
        <div className="h-full overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl shadow-navy-900/10">
          {phase === "done" ? (
            <div className="no-scrollbar h-full animate-fade-rise overflow-y-auto">
              <NoteCard
                note={note}
                status="draft"
                patientLabel={labels.patientLabel}
                dateLabel={labels.generated}
                compact
              />
            </div>
          ) : phase === "writing" ? (
            <div className="flex h-full flex-col items-center justify-center gap-3 px-6 text-center">
              <Sparkles className="h-5 w-5 animate-pulse text-brand-700" aria-hidden />
              <p className="text-sm font-medium text-slate-700">{labels.waiting}</p>
              <span className="h-1 w-40 overflow-hidden rounded-full bg-slate-200">
                <span className="live-dot block h-full w-1/2 rounded-full bg-brand-500" />
              </span>
            </div>
          ) : (
            /*
              🔴 THE COPILOT, WHITE, IN THE SPACE THAT USED TO HOLD A PROMISE.
              `key` is the run counter so Replay gives an empty thread back.
            */
            <SessionCopilot key={run} content={content} className="h-full" />
          )}
        </div>
      </div>

      <p className="mt-4 text-center text-[11px] text-slate-300">{labels.disclaimer}</p>
    </div>
  );
}

/**
 * The level meter. Seven bars, each on its own delay, so it reads as speech.
 *
 * `live` false leaves the bars at rest rather than unmounting them: a strip
 * that disappears when the session ends would take the room's height with it
 * and shift the page, which is the jump the note slot is sized to avoid.
 */
function Wave({ live }: { live: boolean }) {
  const heights = [0.45, 0.85, 0.6, 1, 0.5, 0.75, 0.35];
  return (
    <span aria-hidden className="flex min-w-0 flex-1 items-center justify-center gap-[3px]">
      {heights.map((h, i) => (
        <span
          key={i}
          className={cn(
            "w-[3px] rounded-full",
            live ? "wave-bar bg-teal-300/80" : "bg-slate-600",
          )}
          style={{
            height: `${String(Math.round(h * 18))}px`,
            animationDelay: `${String(i * 130)}ms`,
          }}
        />
      ))}
    </span>
  );
}

/** Static fallback, used if the live demo throws for any reason. */
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
      <div className="overflow-hidden rounded-3xl border border-slate-800/60 bg-navy-500 shadow-2xl">
        <TranscriptPanel
          lines={(content?.transcript ?? DEMO_TRANSCRIPT).slice(0, STATIC_LINES)}
          className="h-44 sm:h-52"
        />
      </div>
      <div className="no-scrollbar relative -mt-4 h-[21rem] overflow-y-auto px-3 sm:h-[23rem] sm:px-6">
        <NoteCard note={content?.note ?? DEMO_NOTE} status="draft" compact />
      </div>
      <p className="mt-4 text-center text-[11px] text-slate-300">{labels.disclaimer}</p>
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
