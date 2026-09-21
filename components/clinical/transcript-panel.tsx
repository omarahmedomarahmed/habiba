"use client";

import { useEffect, useRef } from "react";
import { Mic, MicOff } from "lucide-react";

import { cn } from "@/lib/utils";
import { useT } from "@/lib/i18n/client";

export type TranscriptLine = {
  id: string;
  speaker: "therapist" | "patient" | "unknown";
  text: string;
  /**
   * The speaker was worked out from the words, not heard on their own track.
   *
   * Shown, not hidden. A clinician reading their own record is entitled to know
   * which attributions are measurements and which are inferences, because only
   * one of those is worth correcting.
   */
  speakerInferred?: boolean;
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
  emptyTitle,
  emptyBody,
  className,
  autoScroll = true,
}: {
  lines: TranscriptLine[];
  live?: boolean;
  paused?: boolean;
  /* 37L.2 — no English default. A default is a string nothing translates. */
  emptyTitle?: string;
  emptyBody?: string;
  className?: string;
  autoScroll?: boolean;
}) {
  const t = useT();
  const scrollRef = useRef<HTMLDivElement>(null);

  /*
   * 🔴 76.67 — THE TRANSCRIPT WROTE ITSELF AND THE PANEL STAYED WHERE IT WAS.
   *
   * ## The defect
   *
   * This effect depended on `lines.length`, and live transcription does not
   * mainly APPEND lines: it grows the text of the line being spoken. So through
   * a whole sentence the count never changed, the effect never re-ran, and the
   * words went on arriving below the fold. A therapist mid-session had to drag
   * the panel down every few seconds to see what had just been said, which is
   * the one thing they cannot spare attention for while a patient is talking.
   *
   * The dependency is now the content itself, so a line that lengthens is a
   * change like any other.
   *
   * ## …but only when they are already at the bottom
   *
   * Yanking somebody to the end while they are deliberately reading back is a
   * worse bug than the one being fixed, and it is the usual consequence of
   * fixing this carelessly. `pinned` is false the moment they scroll up, and
   * true again when they return to within a line of the end, so following the
   * live edge is the default and reading history is never fought.
   */
  const pinnedRef = useRef(true);
  const last = lines.at(-1);
  const signature = `${String(lines.length)}:${last?.id ?? ""}:${last?.text.length ?? 0}`;

  useEffect(() => {
    if (!autoScroll) return;
    const el = scrollRef.current;
    if (!el || !pinnedRef.current) return;
    // `instant` rather than smooth: a smooth scroll that restarts every few
    // seconds is exactly the kind of unrequested motion that makes people
    // reach for reduced-motion settings.
    el.scrollTo({ top: el.scrollHeight, behavior: "instant" as ScrollBehavior });
  }, [signature, autoScroll]);

  const onScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    /* One line of slack, so a pixel of overscroll does not unpin the panel. */
    pinnedRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 28;
  };

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
              <span className="text-[11px] font-medium text-slate-300">
                {paused ? t("ttr.paused") : t("ttr.recording")}
              </span>
            </span>
          ) : null}
        </div>
        {live ? (
          paused ? (
            <MicOff className="h-4 w-4 text-amber-400" aria-hidden />
          ) : (
            <Mic className="h-4 w-4 text-slate-300" aria-hidden />
          )
        ) : null}
      </div>

      <div
        ref={scrollRef}
        onScroll={onScroll}
        // Announce new lines to assistive tech, politely — this updates often.
        aria-live="polite"
        aria-atomic="false"
        aria-label={t("ttr.sessionTranscript")}
        className="no-scrollbar min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-4"
      >
        {lines.length === 0 ? (
          <div className="flex h-full min-h-32 flex-col items-center justify-center text-center">
            <p className="text-sm font-medium text-slate-300">{emptyTitle ?? t("ttr.listening")}</p>
            <p className="mt-1 max-w-[22rem] text-xs text-slate-300">{emptyBody ?? t("ttr.willAppear")}</p>
          </div>
        ) : (
          lines.map((line) => (
            <div key={line.id} className="animate-fade-rise">
              <p
                className={cn(
                  "flex items-center gap-1.5 text-[11px] font-semibold tracking-wide uppercase",
                  line.speaker === "patient" ? "text-brand-300" : "text-brand-300",
                )}
              >
                <span className={cn(line.speakerInferred && "border-b border-dotted border-current")}>
                  {line.speaker === "patient"
                    ? t("tev.speakerPatient")
                    : line.speaker === "therapist"
                      ? t("tev.speakerYou")
                      : t("tev.speakerOther")}
                </span>
                {line.speakerInferred ? (
                  <span
                    className="font-normal normal-case tracking-normal text-slate-300"
                    title={t("ttr.oneMic")}
                  >
                    {t("ttr.inferred")}
                  </span>
                ) : null}
              </p>
              <p className="mt-0.5 text-[15px] leading-relaxed text-slate-100">{line.text}</p>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
