import assert from "node:assert/strict";
import { test } from "node:test";

import {
  MIN_HOURS_BETWEEN,
  hourIn,
  inQuietWindow,
  shouldSend,
  type CheckinSettings,
} from "../lib/checkins/policy";
import { WORDING_KEYS, isStopWord, nextWording, type WordingKey } from "../lib/checkins/wording";

/**
 * The check-in policy. PLAN.md 44.1, 44.2, C97.
 *
 * ## 🔴 What these tests are defending
 *
 * C97's own warning: *four unprompted messages a day is a lot for somebody in distress, and a person
 * who mutes it is worse off than one who was messaged less.* Every case below is a way this feature
 * sends a message it should not have:
 *
 *   - a quiet window that does not work because it crosses midnight
 *   - an unknown timezone treated as UTC, which is a 3am message somewhere
 *   - a cadence setting somebody typed `1` into
 *   - a mute rate that halts nothing because it divided by zero
 *
 * And the one that matters most, in `isStopWord`: somebody who writes "I cannot stop crying" must
 * not be unsubscribed.
 */

const settings: CheckinSettings = {
  enabled: true,
  everyHours: 24,
  quietFromHour: 21,
  quietToHour: 9,
  muteRateHalt: 0.2,
};

const base = {
  settings,
  muteRate: 0,
  muted: false,
  timezone: "Africa/Cairo",
  lastSentAt: null,
  reachable: true,
};

/* A time that is the middle of the working day in Cairo (UTC+2 or +3). */
const midday = new Date("2026-09-13T10:00:00Z");
/* And the middle of the night there. */
const night = new Date("2026-09-13T00:30:00Z");

test("🔴 the quiet window works even though it crosses midnight", () => {
  /*
   * 21:00 to 09:00 is the default and it wraps. The naive `hour >= from && hour < to` is false for
   * every hour of it, so a quiet window that looked configured would have been no window at all.
   */
  for (const hour of [21, 22, 23, 0, 3, 8]) {
    assert.equal(inQuietWindow(hour, 21, 9), true, `${hour}:00 should be quiet`);
  }
  for (const hour of [9, 12, 17, 20]) {
    assert.equal(inQuietWindow(hour, 21, 9), false, `${hour}:00 should not be quiet`);
  }
});

test("a window that does not wrap still works", () => {
  assert.equal(inQuietWindow(13, 12, 14), true);
  assert.equal(inQuietWindow(15, 12, 14), false);
});

test("a window of zero width is no window", () => {
  assert.equal(inQuietWindow(5, 9, 9), false);
});

test("🔴 the quiet window is in the PATIENT's timezone, not the server's", () => {
  /*
   * The same instant is the middle of the night in Cairo and the afternoon in Los Angeles. A window
   * evaluated on server time is a 3am message to somebody three timezones away, which is exactly the
   * harm the window exists to prevent.
   */
  assert.equal(shouldSend({ ...base, timezone: "Africa/Cairo", now: night }).send, false);
  assert.equal(shouldSend({ ...base, timezone: "America/Los_Angeles", now: night }).send, true);
});

test("🔴 an unknown timezone is treated as night, so nobody is woken by a guess", () => {
  assert.equal(hourIn(null, midday), null);
  assert.equal(hourIn("Not/AZone", midday), null);

  const decision = shouldSend({ ...base, timezone: null, now: midday });
  assert.equal(decision.send, false);
  assert.equal(decision.send === false && decision.because, "quiet_hours");
});

test("🔴 the cadence is clamped at six hours whatever the setting says", () => {
  /*
   * C97's requirement was six-hourly and the ruling made the rate adjustable. Adjustable downward
   * without a floor means somebody types 1 into a box and sends twenty-four unprompted messages a day
   * to people in distress.
   */
  const oneHourAgo = new Date(midday.getTime() - 60 * 60 * 1000);

  const decision = shouldSend({
    ...base,
    settings: { ...settings, everyHours: 1 },
    lastSentAt: oneHourAgo,
    now: midday,
  });

  assert.equal(decision.send, false);
  assert.equal(decision.send === false && decision.because, "too_soon");
  assert.equal(MIN_HOURS_BETWEEN, 6);
});

test("a person messaged longer ago than the cadence is messaged again", () => {
  const twoDaysAgo = new Date(midday.getTime() - 48 * 60 * 60 * 1000);
  assert.equal(shouldSend({ ...base, lastSentAt: twoDaysAgo, now: midday }).send, true);
});

test("🔴 the halt outranks everything, and it is checked first", () => {
  /*
   * Checked first so a halted channel considers nobody individually. And it applies even to somebody
   * who is reachable, unmuted, awake and overdue: that is the point of a halt.
   */
  const decision = shouldSend({ ...base, muteRate: 0.5, now: midday });
  assert.equal(decision.send, false);
  assert.equal(decision.send === false && decision.because, "mute_rate_halt");
});

test("the halt fires exactly at the threshold, not just above it", () => {
  assert.equal(shouldSend({ ...base, muteRate: 0.2, now: midday }).send, false);
  assert.equal(shouldSend({ ...base, muteRate: 0.19, now: midday }).send, true);
});

test("their own mute outranks the cadence and the window", () => {
  const decision = shouldSend({ ...base, muted: true, now: midday });
  assert.equal(decision.send, false);
  assert.equal(decision.send === false && decision.because, "muted");
});

test("a channel that is off sends nothing", () => {
  const decision = shouldSend({ ...base, settings: { ...settings, enabled: false }, now: midday });
  assert.equal(decision.send, false);
  assert.equal(decision.send === false && decision.because, "channel_off");
});

test("somebody with no way to be reached is skipped, not attempted", () => {
  const decision = shouldSend({ ...base, reachable: false, now: midday });
  assert.equal(decision.send, false);
  assert.equal(decision.send === false && decision.because, "unreachable");
});

/* ------------------------------------------------------------------ wording */

function renderAll(): Record<WordingKey, string> {
  return Object.fromEntries(WORDING_KEYS.map((key, i) => [key, `wording ${i}`])) as Record<
    WordingKey,
    string
  >;
}

test("🔴 the same wording is never used twice in a row for one person", () => {
  const rendered = renderAll();

  /* `pick` pinned to 0, so without the exclusion this would return the first key every time. */
  const first = nextWording(null, rendered, () => 0);
  const second = nextWording(rendered[first], rendered, () => 0);

  assert.notEqual(second, first, "a repeat is what makes it feel like a template");
});

test("the exclusion matches on the rendered TEXT, so an admin edit does not misfire", () => {
  /*
   * `checkins.body` holds what we actually sent. Storing a key instead would go stale the moment an
   * admin edits a wording: the key would match while the words had changed, so the exclusion would
   * suppress a sentence this person has never seen.
   */
  const rendered = renderAll();
  const chosen = nextWording("a sentence nobody has ever sent", rendered, () => 0);
  assert.equal(chosen, WORDING_KEYS[0], "nothing to exclude, so the first is allowed");
});

test("twelve wordings, all distinct keys", () => {
  assert.equal(WORDING_KEYS.length, 12);
  assert.equal(new Set(WORDING_KEYS).size, 12);
});

/* ------------------------------------------------------------- the stop word */

test("🔴 'I cannot stop crying' is NOT an opt-out", () => {
  /*
   * The single most important assertion in this file. Muting somebody who wrote that, instead of
   * routing it to the crisis path, would be the worst possible failure of this sprint — which is why
   * `isStopWord` matches the whole trimmed message rather than a substring, AND why `handleReply`
   * scans for crisis language before it ever asks this question.
   */
  assert.equal(isStopWord("I cannot stop crying"), false);
  assert.equal(isStopWord("please make it stop"), false);
  assert.equal(isStopWord("I want it all to stop"), false);
});

test("a message that is nothing but a stop word is an opt-out, in both languages", () => {
  for (const word of ["stop", "STOP", " stop ", "stop.", "unsubscribe", "إيقاف", "توقف"]) {
    assert.equal(isStopWord(word), true, `${word} should opt out`);
  }
});

test("an ordinary answer is not an opt-out", () => {
  for (const reply of ["fine thanks", "not great today", "ok", "", "   "]) {
    assert.equal(isStopWord(reply), false, `${reply} should not opt out`);
  }
});
