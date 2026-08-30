import assert from "node:assert/strict";
import { test } from "node:test";

import {
  formatRemaining,
  INCLUDED_MINUTES,
  MAX_MINUTES,
  SILENCE_SECONDS,
  sessionClock,
} from "../lib/session-clock";

/**
 * The ladder, tested as arithmetic.
 *
 * No database and no network: this function is pure precisely so that the
 * clinician's room, the patient's page and the server can each run it and get
 * the same answer, and a test that needed a session to exist would be testing
 * the plumbing instead of the rule.
 */

const START = new Date("2026-08-30T10:00:00Z");
const at = (minutes: number, seconds = 0) =>
  new Date(START.getTime() + minutes * 60_000 + seconds * 1000);

const clockAt = (minutes: number, opts: { extended?: boolean; lastActivity?: Date } = {}) =>
  sessionClock({
    startedAt: START,
    extendedAt: opts.extended ? at(INCLUDED_MINUTES) : null,
    lastActivityAt: opts.lastActivity ?? at(minutes),
    now: at(minutes),
  });

test("a session that has not started shows no countdown", () => {
  const clock = sessionClock({ startedAt: null, extendedAt: null, now: at(90) });
  assert.equal(clock.stage, "running");
  assert.equal(clock.elapsedSeconds, 0);
  assert.equal(clock.shouldEnd, false);
  // A patient in the waiting room must not see time counting against a session
  // they are not yet in.
  assert.equal(clock.remainingSeconds, INCLUDED_MINUTES * 60);
});

test("the first twenty-five minutes say nothing", () => {
  for (const minute of [0, 5, 17, 24]) {
    assert.equal(clockAt(minute).stage, "running", `minute ${minute}`);
  }
});

test("the last five minutes of the paid time warn, and do not end anything", () => {
  const clock = clockAt(26);
  assert.equal(clock.stage, "closing");
  assert.equal(clock.remainingSeconds, 4 * 60);
  assert.equal(clock.shouldEnd, false);
});

test("thirty minutes is a question, not a hangup", () => {
  const clock = clockAt(INCLUDED_MINUTES);
  assert.equal(clock.stage, "decision");
  assert.equal(clock.shouldEnd, false, "nobody is cut off at the half hour");
  assert.equal(clock.extended, false);
  // The countdown now points at the cap, because that is the next thing that
  // actually happens.
  assert.equal(clock.remainingSeconds, (MAX_MINUTES - INCLUDED_MINUTES) * 60);
});

test("an unanswered question waits, and is bounded by the cap", () => {
  // Forty minutes in with no decision: still waiting, still not ended.
  const waiting = clockAt(40);
  assert.equal(waiting.stage, "decision");
  assert.equal(waiting.shouldEnd, false);

  // But it cannot wait past the cap.
  const capped = clockAt(MAX_MINUTES);
  assert.equal(capped.stage, "over");
  assert.equal(capped.shouldEnd, true);
  assert.equal(capped.endReason, "cap");
});

test("choosing to continue counts down to the cap", () => {
  const extended = clockAt(35, { extended: true });
  assert.equal(extended.stage, "extended");
  assert.equal(extended.extended, true);
  assert.equal(extended.remainingSeconds, (MAX_MINUTES - 35) * 60);
  assert.equal(extended.shouldEnd, false);
});

test("the last five minutes before the cap are a hard warning", () => {
  const wrap = clockAt(46, { extended: true });
  assert.equal(wrap.stage, "wrapUp");
  assert.equal(wrap.remainingSeconds, 4 * 60);
  assert.equal(wrap.shouldEnd, false);
});

test("the cap ends the session whether or not it was extended", () => {
  for (const extended of [false, true]) {
    const clock = clockAt(MAX_MINUTES + 3, { extended });
    assert.equal(clock.stage, "over", `extended=${extended}`);
    assert.equal(clock.endReason, "cap");
  }
});

test("a room everybody left ends, but only after the paid time", () => {
  // Silent for three minutes at minute 35 — everyone has gone.
  const gone = clockAt(35, { extended: true, lastActivity: at(32) });
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
    extendedAt: at(INCLUDED_MINUTES),
    lastActivityAt: new Date(at(35).getTime() - (SILENCE_SECONDS - 5) * 1000),
    now: at(35),
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
    extendedAt: at(INCLUDED_MINUTES),
    lastActivityAt: null,
    now: at(40),
  });
  assert.equal(offRecord.shouldEnd, false);
  assert.equal(offRecord.stage, "extended");
});

test("the countdown reads as a clock", () => {
  assert.equal(formatRemaining(0), "0:00");
  assert.equal(formatRemaining(9), "0:09");
  assert.equal(formatRemaining(65), "1:05");
  assert.equal(formatRemaining(4 * 60), "4:00");
  // Never negative: a boundary crossed between a poll and a tick would
  // otherwise render "-1:-3" on somebody's screen mid-session.
  assert.equal(formatRemaining(-12), "0:00");
});
