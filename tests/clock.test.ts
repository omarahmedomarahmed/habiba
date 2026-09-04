import assert from "node:assert/strict";
import { test } from "node:test";

import {
  capSeconds,
  DEFAULT_CLOCK_LIMITS,
  formatRemaining,
  sessionClock,
  type ClockLimits,
} from "../lib/session-clock";

/**
 * The timeline, tested as arithmetic.
 *
 * No database and no network: this function is pure precisely so that the
 * clinician's room, the patient's page and the server can each run it and get
 * the same answer, and a test that needed a session to exist would be testing
 * the plumbing instead of the rule.
 *
 * The bounds now come from `platform_settings`, so these tests pass them in
 * explicitly rather than importing constants. That is the point of the change:
 * the shape of the ladder is a property of the code, and the numbers on it are
 * not — so the numbers are a fixture here, and one test below runs the whole
 * thing again at completely different ones.
 */

const LIMITS: ClockLimits = { runningMinutes: 50, countdownMinutes: 10, silenceSeconds: 90 };
const CAP = LIMITS.runningMinutes + LIMITS.countdownMinutes;

const START = new Date("2026-08-30T10:00:00Z");
const at = (minutes: number, seconds = 0) =>
  new Date(START.getTime() + minutes * 60_000 + seconds * 1000);

const clockAt = (minutes: number, opts: { lastActivity?: Date | null } = {}) =>
  sessionClock({
    startedAt: START,
    lastActivityAt: opts.lastActivity === undefined ? at(minutes) : opts.lastActivity,
    now: at(minutes),
    limits: LIMITS,
  });

test("the seeded defaults are the shape §3 asks for", () => {
  // 50 running, a 10-minute countdown, a hard stop at 60.
  assert.equal(DEFAULT_CLOCK_LIMITS.runningMinutes, 50);
  assert.equal(DEFAULT_CLOCK_LIMITS.countdownMinutes, 10);
  assert.equal(capSeconds(DEFAULT_CLOCK_LIMITS), 60 * 60);
});

test("a session that has not started shows no countdown", () => {
  const clock = sessionClock({ startedAt: null, now: at(90), limits: LIMITS });
  assert.equal(clock.stage, "running");
  assert.equal(clock.elapsedSeconds, 0);
  assert.equal(clock.shouldEnd, false);
  // A patient in the waiting room must not see time counting against a session
  // they are not yet in.
  assert.equal(clock.remainingSeconds, CAP * 60);
});

test("the running stretch says nothing at all", () => {
  for (const minute of [0, 5, 17, 35, 49]) {
    assert.equal(clockAt(minute).stage, "running", `minute ${minute}`);
  }
});

test("the countdown starts at the running mark and points at the hard stop", () => {
  const clock = clockAt(LIMITS.runningMinutes);
  assert.equal(clock.stage, "countdown");
  assert.equal(clock.shouldEnd, false, "nobody is cut off when the countdown begins");
  assert.equal(clock.remainingSeconds, LIMITS.countdownMinutes * 60);
});

test("the countdown is the same number for both sides, all the way down", () => {
  /*
   * The whole reason the old `decision` / `extended` states are gone: only the
   * clinician could answer the prompt, so the two screens showed different
   * things. Here the stage and the remaining seconds are a function of the
   * elapsed time alone — there is no input that could make one side differ.
   */
  for (const minute of [50, 53, 57, 59]) {
    const clock = clockAt(minute);
    assert.equal(clock.stage, "countdown", `minute ${minute}`);
    assert.equal(clock.remainingSeconds, (CAP - minute) * 60, `minute ${minute}`);
    assert.equal(clock.shouldEnd, false, `minute ${minute}`);
  }
});

test("the hard stop ends the session", () => {
  const capped = clockAt(CAP);
  assert.equal(capped.stage, "over");
  assert.equal(capped.shouldEnd, true);
  assert.equal(capped.endReason, "cap");
  assert.equal(capped.remainingSeconds, 0);

  // And it stays ended afterwards rather than wrapping around.
  const past = clockAt(CAP + 7);
  assert.equal(past.stage, "over");
  assert.equal(past.endReason, "cap");
});

test("a room everybody left ends, but only after the running time", () => {
  // Silent for three minutes at minute 55 — everyone has gone.
  const gone = clockAt(55, { lastActivity: at(52) });
  assert.equal(gone.shouldEnd, true);
  assert.equal(gone.endReason, "silence");

  // The same silence at minute 20 is a pause in a difficult session, and
  // ending it would be the worst thing this code could do.
  const pause = clockAt(20, { lastActivity: at(17) });
  assert.equal(pause.shouldEnd, false);
  assert.equal(pause.stage, "running");
});

test("a long silence inside the threshold is left alone", () => {
  const nearly = sessionClock({
    startedAt: START,
    lastActivityAt: new Date(at(55).getTime() - (LIMITS.silenceSeconds - 5) * 1000),
    now: at(55),
    limits: LIMITS,
  });
  assert.equal(nearly.shouldEnd, false, "eighty-five seconds of silence is a silence, not an exit");
});

test("a session with no transcript at all is never called abandoned", () => {
  /*
   * The case this protects: the patient refused recording, or the clinician is
   * working off record. There are no segments, so there is no last activity —
   * and inferring "everybody left" from that would end a live session in
   * progress, in the one situation where nobody can see it happening.
   */
  const offRecord = sessionClock({
    startedAt: START,
    lastActivityAt: null,
    now: at(55),
    limits: LIMITS,
  });
  assert.equal(offRecord.shouldEnd, false);
  assert.equal(offRecord.stage, "countdown");
});

test("the ladder holds at settings nobody has seen before", () => {
  /*
   * H4: the fix that repairs case A frequently breaks case B. The numbers above
   * are the seeded ones, so passing them proves the seed works — not that the
   * function is actually parameterised. An admin who sets a twenty-minute
   * session with a two-minute countdown must get the same shape.
   */
  const odd: ClockLimits = { runningMinutes: 20, countdownMinutes: 2, silenceSeconds: 30 };
  const run = (minutes: number) =>
    sessionClock({ startedAt: START, now: at(minutes), limits: odd });

  assert.equal(capSeconds(odd), 22 * 60);
  assert.equal(run(19).stage, "running");
  assert.equal(run(20).stage, "countdown");
  assert.equal(run(20).remainingSeconds, 2 * 60);
  assert.equal(run(21).stage, "countdown");
  assert.equal(run(22).stage, "over");
  assert.equal(run(22).shouldEnd, true);
});

test("a zero-length countdown is a hard stop with no warning", () => {
  // Not a configuration anybody should choose, but `countdownMinutes` has a
  // floor of 0 and the function must not divide the timeline by zero or leave
  // a session running forever.
  const none: ClockLimits = { runningMinutes: 30, countdownMinutes: 0, silenceSeconds: 90 };
  const run = (minutes: number) =>
    sessionClock({ startedAt: START, now: at(minutes), limits: none });

  assert.equal(run(29).stage, "running");
  assert.equal(run(30).stage, "over");
  assert.equal(run(30).shouldEnd, true);
});

test("the countdown reads as a clock", () => {
  assert.equal(formatRemaining(0), "0:00");
  assert.equal(formatRemaining(9), "0:09");
  assert.equal(formatRemaining(65), "1:05");
  assert.equal(formatRemaining(4 * 60), "4:00");
  assert.equal(formatRemaining(10 * 60), "10:00");
  // Never negative: a boundary crossed between a poll and a tick would
  // otherwise render "-1:-3" on somebody's screen mid-session.
  assert.equal(formatRemaining(-12), "0:00");
});
