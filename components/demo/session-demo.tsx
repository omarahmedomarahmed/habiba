"use client";

import { Component, type ReactNode, useEffect, useRef, useState } from "react";
import { Pause, Play, Sparkles } from "lucide-react";

import { NoteCard } from "@/components/clinical/note-card";
import { TranscriptPanel } from "@/components/clinical/transcript-panel";
import { DEMO_NOTE, DEMO_TRANSCRIPT } from "./fixtures";
import { cn } from "@/lib/utils";

/** How many lines are rendered on the server and before hydration. */
const STATIC_LINES = 4;
const TICK_MS = 2200;

/**
 * The live hero: the real `TranscriptPanel` and the real `NoteCard` from the
 * clinician's portal, driven by synthetic fixtures.
 *
 * Constraints this component is built around:
 *
 *  - **No hydration mismatch.** The server and the first client render both
 *    show exactly `STATIC_LINES` lines. Animation only ever starts inside an
 *    effect, after hydration.
 *  - **Works without JavaScript.** What renders statically is a genuinely
 *    useful mockup — four transcript lines and the complete note — rather than
 *    an empty shell waiting for a timer.
 *  - **Pausable, and honours reduced motion.** WCAG 2.2.2 requires a control
 *    for content that moves for more than five seconds. Users who have asked
 *    for reduced motion get the finished state immediately and no ticker.
 *  - **Bundle cost.** This imports two presentational components and lucide
 *    icons. It deliberately does not touch the API client, the auth session or
 *    anything that reaches a database — importing those at module scope is what
 *    would drag the authenticated app onto a marketing page.
 */
function SessionDemoInner({ className }: { className?: string }) {
  const [visible, setVisible] = useState(STATIC_LINES);
  const [playing, setPlaying] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (query.matches) {
      setReducedMotion(true);
      setVisible(DEMO_TRANSCRIPT.length);
      return;
    }
    // Restart from the beginning so the animation reads as a session unfolding.
    setVisible(1);
    setPlaying(true);
  }, []);

  useEffect(() => {
    if (!playing || reducedMotion) return;
    timer.current = setInterval(() => {
      setVisible((n) => {
        if (n >= DEMO_TRANSCRIPT.length) {
          setPlaying(false);
          return n;
        }
        return n + 1;
      });
    }, TICK_MS);
    return () => {
      if (timer.current) clearInterval(timer.current);
    };
  }, [playing, reducedMotion]);

  const complete = visible >= DEMO_TRANSCRIPT.length;
  const lines = DEMO_TRANSCRIPT.slice(0, visible);

  return (
    <div className={cn("w-full", className)}>
      <div className="overflow-hidden rounded-3xl border border-slate-800/60 bg-navy-500 shadow-2xl shadow-navy-900/25">
        <div className="flex items-center justify-between border-b border-slate-800/60 px-4 py-3">
          <div className="flex items-center gap-2.5">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-teal-500/15 text-teal-300">
              <Sparkles className="h-3.5 w-3.5" aria-hidden />
            </span>
            <div>
              <p className="text-sm font-semibold text-white">Session in progress</p>
              <p className="text-[11px] text-slate-400">In person · 24:10</p>
            </div>
          </div>

          {!reducedMotion ? (
            <button
              type="button"
              onClick={() => (complete ? (setVisible(1), setPlaying(true)) : setPlaying((p) => !p))}
              aria-label={complete ? "Replay demo" : playing ? "Pause demo" : "Play demo"}
              className="tap-target flex items-center gap-1.5 rounded-lg px-2.5 text-[11px] font-medium text-slate-300 hover:bg-white/5"
            >
              {playing ? (
                <Pause className="h-3.5 w-3.5" aria-hidden />
              ) : (
                <Play className="h-3.5 w-3.5" aria-hidden />
              )}
              {complete ? "Replay" : playing ? "Pause" : "Play"}
            </button>
          ) : null}
        </div>

        <TranscriptPanel
          lines={lines}
          live
          autoScroll={!reducedMotion}
          className="h-64 sm:h-72"
        />
      </div>

      <div className="relative -mt-4 px-3 sm:px-6">
        {complete ? (
          <div className="animate-fade-rise">
            <NoteCard
              note={DEMO_NOTE}
              status="draft"
              patientLabel="demo"
              dateLabel="Generated in 18 seconds"
              compact
              className="shadow-xl shadow-navy-900/10"
            />
          </div>
        ) : (
          <div className="rounded-2xl border border-slate-200 bg-white px-4 py-4 shadow-xl shadow-navy-900/10">
            <p className="flex items-center gap-2 text-sm font-medium text-slate-500">
              <Sparkles className="h-4 w-4 text-brand-500" aria-hidden />
              Your SOAP note appears here the moment the session ends.
            </p>
          </div>
        )}
      </div>

      <p className="mt-4 text-center text-[11px] text-slate-400">
        Simulated session with invented data — not a real patient.
      </p>
    </div>
  );
}

/** Static fallback, used if the live demo throws for any reason. */
function StaticFallback({ className }: { className?: string }) {
  return (
    <div className={cn("w-full", className)}>
      <div className="overflow-hidden rounded-3xl border border-slate-800/60 bg-navy-500 shadow-2xl">
        <TranscriptPanel lines={DEMO_TRANSCRIPT.slice(0, STATIC_LINES)} className="h-64" />
      </div>
      <div className="relative -mt-4 px-3 sm:px-6">
        <NoteCard note={DEMO_NOTE} status="draft" compact />
      </div>
      <p className="mt-4 text-center text-[11px] text-slate-400">
        Simulated session with invented data — not a real patient.
      </p>
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

export function SessionDemo({ className }: { className?: string }) {
  return (
    <DemoBoundary fallback={<StaticFallback className={className} />}>
      <SessionDemoInner className={className} />
    </DemoBoundary>
  );
}

export { StaticFallback as SessionDemoStatic };
