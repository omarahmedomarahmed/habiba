"use client";

import { useEffect, useRef } from "react";
import { Mic, MicOff } from "lucide-react";

import { cn } from "@/lib/utils";

export type TranscriptLine = {
  id: string;
  speaker: "therapist" | "patient" | "unknown";
  text: string;
};

/**
 * The live transcript.
 *
 * Purely presentational: props in, no fetching, no store, no socket, no browser
 * API beyond a scroll ref. That is what lets the marketing site render this
 * exact component with fixture data — and it is what makes it structurally
 * impossible for a public page to pull real chart data through it, because
 * there is no code path here that could fetch any.
 */
export function TranscriptPanel({
  lines,
  live = false,
  paused = false,
  emptyTitle = "Listening…",
  emptyBody = "The transcript will appear here as you talk.",
  className,
  autoScroll = true,
}: {
  lines: TranscriptLine[];
  live?: boolean;
  paused?: boolean;
  emptyTitle?: string;
  emptyBody?: string;
  className?: string;
  autoScroll?: boolean;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!autoScroll) return;
    const el = scrollRef.current;
    if (!el) return;
    // `instant` rather than smooth: a smooth scroll that restarts every few
    // seconds is exactly the kind of unrequested motion that makes people
    // reach for reduced-motion settings.
    el.scrollTo({ top: el.scrollHeight, behavior: "instant" as ScrollBehavior });
  }, [lines.length, autoScroll]);

  return (
    <div className={cn("flex min-h-0 flex-col", className)}>
      <div className="flex items-center justify-between border-b border-slate-800/60 px-4 py-2.5">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold tracking-wide text-slate-300 uppercase">
            Transcript
          </span>
          {live ? (
            <span className="flex items-center gap-1.5">
              <span
                className={cn(
                  "h-1.5 w-1.5 rounded-full",
                  paused ? "bg-amber-400" : "live-dot bg-red-500",
                )}
              />
              <span className="text-[11px] font-medium text-slate-400">
                {paused ? "Paused" : "Recording"}
              </span>
            </span>
          ) : null}
        </div>
        {live ? (
          paused ? (
            <MicOff className="h-4 w-4 text-amber-400" aria-hidden />
          ) : (
            <Mic className="h-4 w-4 text-slate-400" aria-hidden />
          )
        ) : null}
      </div>

      <div
        ref={scrollRef}
        // Announce new lines to assistive tech, politely — this updates often.
        aria-live="polite"
        aria-atomic="false"
        aria-label="Session transcript"
        className="no-scrollbar min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-4"
      >
        {lines.length === 0 ? (
          <div className="flex h-full min-h-32 flex-col items-center justify-center text-center">
            <p className="text-sm font-medium text-slate-300">{emptyTitle}</p>
            <p className="mt-1 max-w-[22rem] text-xs text-slate-500">{emptyBody}</p>
          </div>
        ) : (
          lines.map((line) => (
            <div key={line.id} className="animate-fade-rise">
              <p
                className={cn(
                  "text-[11px] font-semibold tracking-wide uppercase",
                  line.speaker === "patient" ? "text-teal-300" : "text-brand-300",
                )}
              >
                {line.speaker === "patient"
                  ? "Patient"
                  : line.speaker === "therapist"
                    ? "You"
                    : "Speaker"}
              </p>
              <p className="mt-0.5 text-[15px] leading-relaxed text-slate-100">{line.text}</p>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
