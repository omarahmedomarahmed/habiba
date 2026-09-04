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
 *   0–50    running     nothing on screen
 *   50–60   countdown   the same timer on *both* screens
 *   60      over        ended, by us
 *
 * ## What this replaced, and why
 *
 * There used to be a middle state: the paid half hour ended at thirty minutes,
 * the clinician was asked whether to continue, and choosing to continue
 * unlocked a free extension to a fifty-minute cap. Two things were wrong with
 * it. It put a commercial prompt in front of a clinician mid-session, at the
 * exact moment the answer should have been clinical; and the patient's screen
 * and the clinician's showed different things, because only one of them could
 * answer the prompt.
 *
 * Now there is one timeline, both sides see the same number, and continuing
 * past the hard stop means the therapist creates a new session — free or paid —
 * and sends that patient the link. That is a deliberate friction: it makes the
 * decision to keep going explicit and, when it is a paid session, honest.
 *
 * `sessions.extendedAt` still exists and is still readable on historical rows,
 * because sessions that were extended under the old rules really were, and §6
 * does not let us rewrite what happened. Nothing writes it any more.
 *
 * ## Where the numbers come from
 *
 * `platform_settings.clock`, passed in as `limits`. They are an argument rather
 * than an import so that this module stays pure and the browser can be handed
 * the same snapshot the server used — a clock whose bounds are fetched at two
 * different moments is a clock that disagrees with itself.
 */
import { SETTINGS_DEFAULTS } from "@/lib/settings/defs";

export type ClockLimits = {
  runningMinutes: number;
  countdownMinutes: number;
  silenceSeconds: number;
};

/**
 * The fallback, and only the fallback.
 *
 * Exported so a caller with no settings snapshot to hand — a unit test, a
 * client component during its first paint — has one obvious wrong-but-safe
 * answer rather than three different ones.
 */
export const DEFAULT_CLOCK_LIMITS: ClockLimits = SETTINGS_DEFAULTS.clock;

export type ClockStage =
  /** Running normally, nothing to say. */
  | "running"
  /** Inside the last stretch before the hard stop. Shown on both screens. */
  | "countdown"
  /** Past the hard stop, or gone quiet. Should be ended. */
  | "over";

export type SessionClock = {
  stage: ClockStage;
  elapsedSeconds: number;
  /** To the hard stop. The same number on both screens. */
  remainingSeconds: number;
  /** The server should end this session now. */
  shouldEnd: boolean;
  /** Why, when it should. Shown to nobody — it goes in the log. */
  endReason: "cap" | "silence" | null;
};

/** The hard stop, in seconds. */
export function capSeconds(limits: ClockLimits): number {
  return (limits.runningMinutes + limits.countdownMinutes) * 60;
}

export function sessionClock(input: {
  startedAt: Date | string | null;
  /** The most recent transcript segment, for the "everyone left" check. */
  lastActivityAt?: Date | string | null;
  now?: Date;
  limits?: ClockLimits;
}): SessionClock {
  const limits = input.limits ?? DEFAULT_CLOCK_LIMITS;
  const now = input.now ?? new Date();
  const started = toDate(input.startedAt);
  const cap = capSeconds(limits);

  // Not started: a clock that counts before the session begins would show a
  // patient in the waiting room a countdown against time they are not using.
  if (!started) {
    return {
      stage: "running",
      elapsedSeconds: 0,
      remainingSeconds: cap,
      shouldEnd: false,
      endReason: null,
    };
  }

  const elapsed = Math.max(0, Math.floor((now.getTime() - started.getTime()) / 1000));
  const running = limits.runningMinutes * 60;

  /*
   * Everybody left.
   *
   * Only once the session is past its running time, and only when there was
   * activity to lose in the first place: a session whose transcript never
   * started — the microphone was refused, or the clinician is working off
   * record — has no last segment, and inferring abandonment from that would end
   * a real session in progress.
   */
  const lastActivity = toDate(input.lastActivityAt);
  const silent =
    elapsed > running &&
    lastActivity !== null &&
    now.getTime() - lastActivity.getTime() > limits.silenceSeconds * 1000;

  if (elapsed >= cap || silent) {
    return {
      stage: "over",
      elapsedSeconds: elapsed,
      remainingSeconds: 0,
      shouldEnd: true,
      endReason: elapsed >= cap ? "cap" : "silence",
    };
  }

  return {
    stage: elapsed >= running ? "countdown" : "running",
    elapsedSeconds: elapsed,
    remainingSeconds: cap - elapsed,
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
