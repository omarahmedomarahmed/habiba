"use client";

import { Clock, Loader2 } from "lucide-react";

import { Button } from "@/components/ui";
import { formatRemaining, INCLUDED_MINUTES, MAX_MINUTES, type ClockStage } from "@/lib/session-clock";
import { cn } from "@/lib/utils";

/**
 * The countdown, on the clinician's side.
 *
 * Silent for the first twenty-five minutes. A timer that is visible from the
 * first second turns a therapy session into something being clocked, and the
 * clinician watching it is a clinician not listening — so it says nothing until
 * there is something worth saying.
 *
 * At thirty minutes it stops being a countdown and becomes a question, and the
 * question does not answer itself. There is no auto-hangup at the half hour:
 * cutting somebody off mid-sentence is the exact failure this whole ladder
 * exists to prevent, and the cap twenty minutes later is what stops the
 * unanswered question running forever.
 */
export function SessionClockBar({
  stage,
  remainingSeconds,
  extended,
  onExtend,
  onEnd,
  pending,
}: {
  stage: ClockStage;
  remainingSeconds: number;
  extended: boolean;
  onExtend: () => void;
  onEnd: () => void;
  pending: boolean;
}) {
  if (stage === "running" || stage === "extended") return null;

  if (stage === "decision") {
    return (
      <div className="border-b border-amber-400/25 bg-amber-400/10 px-4 py-3.5">
        <p className="flex items-center gap-2 text-sm font-semibold text-amber-100">
          <Clock className="h-4 w-4 shrink-0" aria-hidden />
          The {INCLUDED_MINUTES} minutes they paid for are up
        </p>
        <p className="mt-1 text-xs leading-relaxed text-amber-200/75">
          Nothing has stopped. Keep going if you need to — up to {MAX_MINUTES} minutes in total,
          and they are not charged a penny more for it.
        </p>
        <div className="mt-3 flex flex-col gap-2 sm:flex-row">
          <Button variant="secondary" full disabled={pending} onClick={onEnd}>
            {pending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
            Wrap up and end
          </Button>
          <Button variant="teal" full disabled={pending} onClick={onExtend}>
            Keep going
          </Button>
        </div>
      </div>
    );
  }

  // "closing" and "wrapUp": a plain countdown, and a different last line for
  // each, because one of them can be extended and the other cannot.
  const hard = stage === "wrapUp";
  return (
    <div
      className={cn(
        "flex items-center gap-2.5 border-b px-4 py-2.5",
        hard ? "border-red-400/25 bg-red-500/10" : "border-white/10 bg-white/5",
      )}
    >
      <Clock
        className={cn("h-4 w-4 shrink-0", hard ? "text-red-300" : "text-white/50")}
        aria-hidden
      />
      <p className="min-w-0 flex-1 text-sm text-white/80">
        <span className="font-semibold tabular-nums text-white">
          {formatRemaining(remainingSeconds)}
        </span>{" "}
        {hard
          ? "left — this session ends at the 50 minute mark."
          : extended
            ? "left."
            : "of the paid half hour left."}
      </p>
    </div>
  );
}
