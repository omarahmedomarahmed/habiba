/**
 * How long a session runs, and what happens when it does not stop.
 *
 * Deliberately dependency-free and pure so the same function runs in three
 * places that must never disagree: the clinician's room, the patient's waiting
 * page, and the server that actually ends the session. A countdown the patient
 * sees ticking to zero while the clinician's says four minutes is worse than no
 * countdown at all.
 *
 * ## The shape of the thing
 *
 * A radar session is sold as thirty minutes. Thirty minutes is also, roughly,
 * how long a person in acute distress can usefully talk — and it is emphatically
 * not a duration anybody should be cut off at mid-sentence.
 *
 *   0–25    running     nothing on screen
 *   25–30   closing     "five minutes left", both sides
 *   30      decision    the paid half hour is up. The clinician chooses:
 *                       wrap up, or keep going. Nothing happens on its own.
 *   30–45   extended    only if they chose to continue
 *   45–50   wrapUp      "five minutes left, and this one is the last"
 *   50      capped      ended, by us
 *
 * ## Why there is a hard cap at all
 *
 * Because the alternative is a session that runs until somebody remembers. A
 * clinician who forgets to press End leaves a recording running, a patient
 * nominally in a room, and a radar slot occupied — and the clinician is
 * unavailable to everybody else the whole time. Fifty minutes is the standard
 * therapeutic hour, so the cap lands where a clinician's own instinct already
 * does.
 *
 * ## Why the extension is free
 *
 * The patient paid for a half hour with somebody who then judged that stopping
 * at thirty minutes would be wrong. Billing them for that judgement would make
 * the clinical decision a commercial one, and would teach every patient that
 * the honest answer to "are you all right?" costs money. `sessions.priceCents`
 * is fixed at booking and charged once; there is no code path that raises a
 * second charge, and this comment is here so nobody adds one.
 */

/** What the patient bought. */
export const INCLUDED_MINUTES = 30;

/** The therapeutic hour. Nothing runs past this. */
export const MAX_MINUTES = 50;

/** How long before each boundary the warning appears. */
export const WARNING_MINUTES = 5;

/**
 * A gap in the transcript this long, after the paid time, means nobody is
 * there.
 *
 * Ninety seconds rather than thirty: therapy contains silence, and a
 * ninety-second pause in a difficult session is a normal and sometimes
 * important thing. This is not a silence detector, it is an "everyone has left"
 * detector, and it only applies once the session is already past the time it
 * was sold for.
 */
export const SILENCE_SECONDS = 90;

export type ClockStage =
  /** Running normally, nothing to say. */
  | "running"
  /** Inside the last five minutes of the paid half hour. */
  | "closing"
  /** The half hour is up and the clinician has not decided yet. */
  | "decision"
  /** They chose to keep going. */
  | "extended"
  /** Inside the last five minutes before the cap. */
  | "wrapUp"
  /** Over the cap, or gone quiet past the paid time. Should be ended. */
  | "over";

export type SessionClock = {
  stage: ClockStage;
  elapsedSeconds: number;
  /** To the next boundary that matters: the half hour, or the cap. */
  remainingSeconds: number;
  /** True once the clinician has chosen to keep going. */
  extended: boolean;
  /** The server should end this session now. */
  shouldEnd: boolean;
  /** Why, when it should. Shown to nobody — it goes in the log. */
  endReason: "cap" | "silence" | null;
};

export function sessionClock(input: {
  startedAt: Date | string | null;
  /** When the clinician chose to continue past the paid time. */
  extendedAt: Date | string | null;
  /** The most recent transcript segment, for the "everyone left" check. */
  lastActivityAt?: Date | string | null;
  now?: Date;
}): SessionClock {
  const now = input.now ?? new Date();
  const started = toDate(input.startedAt);

  // Not started: a clock that counts before the session begins would show a
  // patient in the waiting room a countdown against time they are not using.
  if (!started) {
    return {
      stage: "running",
      elapsedSeconds: 0,
      remainingSeconds: INCLUDED_MINUTES * 60,
      extended: false,
      shouldEnd: false,
      endReason: null,
    };
  }

  const elapsed = Math.max(0, Math.floor((now.getTime() - started.getTime()) / 1000));
  const extended = toDate(input.extendedAt) !== null;
  const included = INCLUDED_MINUTES * 60;
  const cap = MAX_MINUTES * 60;
  const warning = WARNING_MINUTES * 60;

  /*
   * Everybody left.
   *
   * Only after the paid time, and only when there was activity to lose in the
   * first place: a session whose transcript never started — the microphone was
   * refused, or the clinician is working off record — has no last segment, and
   * inferring abandonment from that would end a real session in progress.
   */
  const lastActivity = toDate(input.lastActivityAt);
  const silent =
    elapsed > included &&
    lastActivity !== null &&
    now.getTime() - lastActivity.getTime() > SILENCE_SECONDS * 1000;

  if (elapsed >= cap || silent) {
    return {
      stage: "over",
      elapsedSeconds: elapsed,
      remainingSeconds: 0,
      extended,
      shouldEnd: true,
      endReason: elapsed >= cap ? "cap" : "silence",
    };
  }

  if (elapsed >= included) {
    /*
     * Past the half hour and nobody has decided.
     *
     * This state does *not* end the session. A prompt that becomes a hangup
     * after thirty seconds would cut somebody off in the middle of the exact
     * sentence that made the clinician want to keep going. It sits there until
     * the clinician answers it, and the cap is what stops it sitting forever.
     */
    if (!extended) {
      return {
        stage: "decision",
        elapsedSeconds: elapsed,
        remainingSeconds: Math.max(0, cap - elapsed),
        extended: false,
        shouldEnd: false,
        endReason: null,
      };
    }

    const toCap = cap - elapsed;
    return {
      stage: toCap <= warning ? "wrapUp" : "extended",
      elapsedSeconds: elapsed,
      remainingSeconds: toCap,
      extended: true,
      shouldEnd: false,
      endReason: null,
    };
  }

  const toIncluded = included - elapsed;
  return {
    stage: toIncluded <= warning ? "closing" : "running",
    elapsedSeconds: elapsed,
    remainingSeconds: toIncluded,
    extended: false,
    shouldEnd: false,
    endReason: null,
  };
}

/** `m:ss`, or `mm:ss`. The countdown both sides read. */
export function formatRemaining(seconds: number): string {
  const safe = Math.max(0, Math.round(seconds));
  const minutes = Math.floor(safe / 60);
  return `${minutes}:${String(safe % 60).padStart(2, "0")}`;
}

function toDate(value: Date | string | null | undefined): Date | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}
