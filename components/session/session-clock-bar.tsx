"use client";

import { Clock } from "lucide-react";

import { formatRemaining, type ClockStage } from "@/lib/session-clock";

/**
 * The countdown, and it is the same one the patient sees.
 *
 * Silent for the whole running stretch. A timer that is visible from the first
 * second turns a therapy session into something being clocked, and the
 * clinician watching it is a clinician not listening — so it says nothing until
 * there is something worth saying.
 *
 * ## What this used to be
 *
 * At the paid half hour it became a *question* — wrap up, or keep going free to
 * a fifty-minute cap — with two buttons only the clinician could press. Both
 * halves of that were wrong. It put a commercial decision in front of a
 * clinician mid-session at the moment the answer should have been clinical, and
 * it meant the patient's screen and the clinician's showed different things,
 * because only one of them could answer.
 *
 * Now there is one number, both sides see it, and nobody has to decide anything
 * while a patient is talking. Continuing past the hard stop means a new session
 * and a new link, which is a deliberate friction: it makes going on an explicit
 * act, and — when the next one is paid — an honest one.
 */
export function SessionClockBar({
  stage,
  remainingSeconds,
}: {
  stage: ClockStage;
  remainingSeconds: number;
}) {
  if (stage === "running") return null;

  const over = stage === "over";

  return (
    <div
      className={
        over
          ? "flex items-center gap-2.5 border-b border-red-400/25 bg-red-500/15 px-4 py-2.5"
          : "flex items-center gap-2.5 border-b border-amber-400/25 bg-amber-400/10 px-4 py-2.5"
      }
      /*
       * H8: one polite region per screen, and the room already has one on the
       * transcript. A countdown is a slow, persistent change rather than an
       * announcement, so it carries no live region at all — screen-reader users
       * get it from the heading order, not from an interruption every second.
       */
    >
      <Clock
        className={`h-4 w-4 shrink-0 ${over ? "text-red-300" : "text-amber-300"}`}
        aria-hidden
      />
      {over ? (
        <p className="min-w-0 flex-1 text-sm text-white/85">
          <span className="font-semibold text-white">Time is up.</span> To keep going, end this
          session and send them a link to a new one.
        </p>
      ) : (
        <p className="min-w-0 flex-1 text-sm text-white/80">
          <span className="font-semibold tabular-nums text-white">
            {formatRemaining(remainingSeconds)}
          </span>{" "}
          left. Your patient sees this too.
        </p>
      )}
    </div>
  );
}
