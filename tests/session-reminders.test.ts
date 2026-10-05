import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

import { en, ar } from "../lib/i18n/messages";
import { clockAnchor, sessionClock, type ClockLimits } from "../lib/session-clock";
import {
  lowerMarker,
  MARKER_CLOCK_SKEW_MINUTES,
  MARKER_FRESH_MINUTES,
  markerFrom,
  parseMarker,
  serializeMarker,
  TICK_HOURLY_MINUTE,
  tickDecision,
  type ReminderMarker,
} from "../lib/sessions/reminder-marker";
import {
  dueMark,
  GRACE_MINUTES,
  LOOKAHEAD_MINUTES,
  marksForBooking,
  OPEN_NOW_MARK,
  REMINDER_MARKS,
  remindable,
} from "../lib/sessions/reminders";

/**
 * 🔴 0183: the founder's ask, as arithmetic.
 *
 *   "send email reminders of session starting in 1 hr then 30 mins then 15
 *    mins, then at 5 mins before the session tell them they can start it now,
 *    and don't count the 50 mins until the therapist joins if they started the
 *    session early."
 */

const AT = new Date("2026-10-01T19:00:00Z");
const before = (minutes: number, seconds = 0) => AT.getTime() - minutes * 60_000 - seconds * 1000;
const booked = { status: "scheduled", scheduledAt: AT };

test("the schedule is 60, 30, 15, then 5", () => {
  assert.deepEqual([...REMINDER_MARKS], [60, 30, 15, 5]);
  assert.equal(OPEN_NOW_MARK, 5);
  /* A booking made a day ahead, ticked once a minute through its last 24 hours. */
  assert.deepEqual(marksForBooking(24 * 60), [60, 30, 15, 5]);
  /* Each lands on its own minute and not a minute before. */
  assert.equal(dueMark(booked, before(60, 1)), null);
  assert.equal(dueMark(booked, before(60)), 60);
  assert.equal(dueMark(booked, before(30)), 30);
  assert.equal(dueMark(booked, before(15)), 15);
  assert.equal(dueMark(booked, before(5)), 5);
  /* Between marks nothing is due. */
  assert.equal(dueMark(booked, before(45), [60]), null);
  assert.equal(dueMark(booked, before(20), [60, 30]), null);
});

test("a tick a minute or two late still sends; one far too late does not", () => {
  assert.equal(dueMark(booked, before(58)), 60);
  assert.equal(dueMark(booked, before(60 - GRACE_MINUTES)), 60);
  assert.equal(dueMark(booked, before(60 - GRACE_MINUTES, -1)), null);
  /* The 5 stays due until the booked time itself, then nothing. */
  assert.equal(dueMark(booked, before(0, 30)), 5);
  assert.equal(dueMark(booked, AT.getTime()), null);
  assert.equal(dueMark(booked, AT.getTime() + 60_000), null);
});

test("idempotent: a mark already claimed is never due again", () => {
  assert.equal(dueMark(booked, before(60), [60]), null);
  assert.equal(dueMark(booked, before(59), [60]), null);
  assert.equal(dueMark(booked, before(5), [60, 30, 15, 5]), null);
  /* A tick every minute sends each mark exactly once, never twice. */
  const marks = marksForBooking(90);
  assert.equal(new Set(marks).size, marks.length);
  /* The claim is taken BEFORE the message leaves, and a lost claim sends nothing. */
  const source = readFileSync("lib/data/session-reminders.ts", "utf8");
  const claim = source.indexOf(".onConflictDoNothing()");
  const send = source.indexOf("await sendReminder(");
  assert.ok(claim > 0 && send > claim, "claim, then send");
  assert.match(source, /if \(!claimed\) continue;/);
  /* A booking moved to another hour is reminded afresh: the booked instant is in the key. */
  assert.match(source, /r\."scheduled_for" = \$\{qualified\(sessions\.scheduledAt\)\}/);
  const migration = readFileSync("drizzle/0183_the_hour_before_and_the_clock_that_waits.sql", "utf8");
  assert.match(migration, /PRIMARY KEY \("session_id", "mark", "scheduled_for"\)/);
});

test("cancelled, started or finished sessions are never reminded", () => {
  for (const status of ["cancelled", "in_progress", "completed", "no_show"]) {
    assert.equal(dueMark({ status, scheduledAt: AT }, before(15)), null, status);
  }
  assert.equal(dueMark({ ...booked, cancelledAt: new Date(before(90)) }, before(15)), null);
  assert.equal(dueMark({ ...booked, startedAt: new Date(before(6)) }, before(5)), null);
  assert.equal(remindable({ status: "scheduled", scheduledAt: null }), false);
  assert.equal(dueMark({ status: "scheduled", scheduledAt: null }, before(5)), null);
});

test("a booking made inside the hour gets only the reminders still ahead, never a burst", () => {
  /* 40 minutes ahead: no late "in 1 hour"; the 30, 15 and 5. */
  assert.deepEqual(marksForBooking(40), [30, 15, 5]);
  assert.equal(dueMark(booked, before(40)), null);
  /* 20 minutes ahead: the 15 and the 5. */
  assert.deepEqual(marksForBooking(20), [15, 5]);
  /* 10 minutes ahead: the 15 is stale; only "you can go in now". */
  assert.deepEqual(marksForBooking(10), [5]);
  /* 3 minutes ahead: straight to "you can go in now". */
  assert.deepEqual(marksForBooking(3), [5]);
  /* 62 minutes ahead: all four. */
  assert.deepEqual(marksForBooking(62), [60, 30, 15, 5]);
  /* At most one mark is due at any instant, so one tick never sends two. */
  for (let s = 0; s < 61 * 60; s += 7) {
    const due = dueMark(booked, AT.getTime() - s * 1000);
    assert.ok(due === null || REMINDER_MARKS.includes(due));
  }
});

test("the messages exist in English and Arabic, carry the join link, and use no dashes", () => {
  const keys = [
    "pmsg.soon.subjectHour",
    "pmsg.soon.subjectMinutes",
    "pmsg.soon.body",
    "pmsg.openNow.subject",
    "pmsg.openNow.body",
    "pmsg.openNow.link",
    "pnotice.reminderSoon",
    "pnotice.openNow",
    "room.waitingFor",
    "room.clockWaits",
    "troom.waitingClock",
  ] as const;
  for (const key of keys) {
    assert.ok(en[key], `${key} in English`);
    assert.match(ar[key], /[؀-ۿ]/, `${key} in Arabic`);
    assert.doesNotMatch(en[key] + ar[key], /[\u2013\u2014]/, `${key} has no en or em dash`);
  }
  assert.match(en["pmsg.openNow.body"], /\{length\} minutes start when \{therapist\} joins/);
  const source = readFileSync("lib/data/session-reminders.ts", "utf8");
  /* The patient's own door, the join link, never the clinician's session page. */
  assert.match(source, /patientSessionUrl\(env\.appUrl, row\.joinToken\)/);
  assert.match(source, /notice: \{ kind: "session_invited", key: "pnotice\.openNow"/);
});

test("the tick runs every minute, is watched, and the hourly reminder leaves the last 90 minutes to it", () => {
  const vercel = JSON.parse(readFileSync("vercel.json", "utf8")) as { crons: { path: string; schedule: string }[] };
  assert.deepEqual(vercel.crons.find((c) => c.path === "/api/cron/tick"), { path: "/api/cron/tick", schedule: "* * * * *" });
  const route = readFileSync("app/api/cron/[job]/route.ts", "utf8");
  assert.match(route, /async tick\(\) \{[\s\S]*sweepSessionReminders\(\)/);
  const scheduling = readFileSync("lib/data/scheduling.ts", "utf8");
  assert.match(scheduling, /gt\(availabilitySlots\.startsAt, new Date\(now\.getTime\(\) \+ 90 \* 60_000\)\)/);
  const journal = JSON.parse(readFileSync("drizzle/meta/_journal.json", "utf8")) as { entries: { tag: string }[] };
  assert.ok(journal.entries.some((e) => e.tag === "0183_the_hour_before_and_the_clock_that_waits"));
});

/* ------------------------------------------------------------ the clock -- */

const LIMITS: ClockLimits = { runningMinutes: 40, countdownMinutes: 10, silenceSeconds: 90 };
const CAP_MS = 50 * 60_000;

test("the clock does not count while the patient waits for the therapist", () => {
  /* The patient came in five minutes early. Nobody has pressed Start: no clock. */
  const waiting = sessionClock({
    startedAt: clockAnchor({ startedAt: null, clockStartedAt: null, now: new Date(before(5)), limits: LIMITS }),
    now: new Date(before(5)),
    limits: LIMITS,
  });
  assert.equal(waiting.elapsedSeconds, 0);
  assert.equal(waiting.remainingSeconds, CAP_MS / 1000);
  assert.equal(waiting.shouldEnd, false);
});

test("the clock starts when the therapist joins, and the full 50 minutes follow", () => {
  /* Patient in at 18:55, therapist joins at 19:02: both there from 19:02. */
  const joined = new Date(AT.getTime() + 2 * 60_000);
  const at = (minutesAfterJoin: number) => new Date(joined.getTime() + minutesAfterJoin * 60_000);
  const clockAt = (m: number) =>
    sessionClock({
      startedAt: clockAnchor({ startedAt: joined, clockStartedAt: joined, now: at(m), limits: LIMITS }),
      now: at(m),
      lastActivityAt: at(m),
      limits: LIMITS,
    });
  assert.equal(clockAt(0).remainingSeconds, 50 * 60);
  assert.equal(clockAt(49).shouldEnd, false);
  assert.equal(clockAt(50).shouldEnd, true);
  /* Not counted from the patient's arrival at 18:55: at 19:48, 53 minutes after it, still running. */
  assert.equal(clockAt(46).shouldEnd, false);
  assert.equal(clockAt(46).remainingSeconds, 4 * 60);
});

test("on video, a therapist who starts early alone does not spend the patient's minutes", () => {
  const started = new Date(before(5));
  /* Started, patient's page not seen yet: no anchor, no elapsed time. */
  assert.equal(clockAnchor({ startedAt: started, clockStartedAt: null, now: new Date(before(1)), limits: LIMITS }), null);
  /* The patient's page arrives at 19:03: the clock counts from there. */
  const both = new Date(AT.getTime() + 3 * 60_000);
  const anchor = clockAnchor({ startedAt: started, clockStartedAt: both, now: new Date(both.getTime() + 60_000), limits: LIMITS });
  assert.equal(anchor?.getTime(), both.getTime());
  /* Backstop: a room the patient never opened still ends at the cap from Start. */
  const late = new Date(started.getTime() + CAP_MS);
  assert.equal(clockAnchor({ startedAt: started, clockStartedAt: null, now: late, limits: LIMITS })?.getTime(), started.getTime());
  assert.equal(sessionClock({ startedAt: started, now: late, limits: LIMITS }).shouldEnd, true);
});

test("the server writes the clock's start once, from the patient's poll, and counts the duration from it", () => {
  const sessions = readFileSync("lib/data/sessions.ts", "utf8");
  assert.match(sessions, /export async function markClockStarted[\s\S]*isNull\(sessions\.clockStartedAt\)/);
  /* In person both are in the room at Start; on video the patient's page confirms it. */
  assert.match(sessions, /clockStartedAt: sql`CASE WHEN \$\{sessions\.modality\} = 'video' THEN NULL ELSE now\(\) END`/);
  /* Duration and the overrun backstop read the clock's start, not the first arrival. */
  assert.match(sessions, /COALESCE\(\$\{sessions\.clockStartedAt\}, \$\{sessions\.startedAt\}\)\)\) \/ 60\)/);
  assert.match(sessions, /const countedFrom = current\.clockStartedAt \?\? current\.startedAt;/);
  const join = readFileSync("app/join/[token]/actions.ts", "utf8");
  assert.match(join, /if \(live\) await markClockStarted\(session\.id\);/);
});

/* ------------------------------------------- the tick without the database -- */

/*
 * 🔴 The minute tick kept the Neon compute awake around the clock. It now reads
 * a two timestamp marker from Vercel Blob and skips the database when no session
 * can be due. The rule, as arithmetic; the I/O is `lib/data/reminder-marker.ts`.
 */
const NOW = new Date("2026-10-01T17:07:00Z"); // minute 07: not the hourly minute
const minutes = (m: number) => new Date(NOW.getTime() + m * 60_000).toISOString();
const fresh = (nextAt: string | null, writtenMinutesAgo = 10): ReminderMarker => ({
  nextAt,
  writtenAt: minutes(-writtenMinutesAgo),
});

test("the tick skips the database when the marker is fresh and nothing starts within 61 minutes", () => {
  assert.equal(LOOKAHEAD_MINUTES, 61);
  assert.deepEqual(tickDecision(fresh(null), NOW), { run: false, reason: "idle" });
  assert.deepEqual(tickDecision(fresh(minutes(62)), NOW), { run: false, reason: "far" });
  assert.deepEqual(tickDecision(fresh(minutes(24 * 60)), NOW), { run: false, reason: "far" });
  /* Fresh right up to 75 minutes old. */
  assert.equal(tickDecision(fresh(null, MARKER_FRESH_MINUTES), NOW).run, false);
});

test("the tick runs when a session starts within 61 minutes, or already began", () => {
  assert.deepEqual(tickDecision(fresh(minutes(61)), NOW), { run: true, reason: "due" });
  assert.deepEqual(tickDecision(fresh(minutes(60)), NOW), { run: true, reason: "due" });
  assert.deepEqual(tickDecision(fresh(minutes(5)), NOW), { run: true, reason: "due" });
  assert.deepEqual(tickDecision(fresh(minutes(-3)), NOW), { run: true, reason: "due" });
  /* Every minute of the hour before a session, from a minute before its first mark. */
  for (let m = 61; m > 0; m -= 1) {
    assert.equal(tickDecision(fresh(minutes(m)), NOW).run, true, `${m} minutes ahead`);
  }
});

test("fail safe: a missing, malformed, stale or future marker runs the database path", () => {
  assert.deepEqual(tickDecision(null, NOW), { run: true, reason: "missing" });
  assert.deepEqual(tickDecision(fresh(null, MARKER_FRESH_MINUTES + 1), NOW), { run: true, reason: "stale" });
  assert.deepEqual(tickDecision(fresh(minutes(600), 24 * 60), NOW), { run: true, reason: "stale" });
  assert.deepEqual(tickDecision(fresh(null, -(MARKER_CLOCK_SKEW_MINUTES + 1)), NOW), { run: true, reason: "stale" });
  for (const text of [
    "",
    "not json",
    "null",
    "[]",
    '{"nextAt":null}',
    '{"writtenAt":"2026-10-01T17:00:00Z"}',
    '{"nextAt":"soon","writtenAt":"2026-10-01T17:00:00Z"}',
    '{"nextAt":null,"writtenAt":"yesterday"}',
    '{"nextAt":null,"writtenAt":1759338000000}',
    '{"nextAt":null,"writtenAt":"2026-10-01T17:00:00Z","patient":"Omar"}',
  ]) {
    assert.equal(parseMarker(text), null, text);
  }
  const good = parseMarker('{"nextAt":null,"writtenAt":"2026-10-01T17:00:00.000Z"}');
  assert.deepEqual(good, { nextAt: null, writtenAt: "2026-10-01T17:00:00.000Z" });
  assert.deepEqual(tickDecision(good, NOW), { run: false, reason: "idle" });
  /* Only the two timestamps are ever written, whatever the object carried. */
  const extra = { ...fresh(null), patient: "Omar" } as ReminderMarker;
  assert.deepEqual(Object.keys(JSON.parse(serializeMarker(extra))), ["nextAt", "writtenAt"]);
  assert.deepEqual(parseMarker(serializeMarker(fresh(minutes(90)))), fresh(minutes(90)));
});

test("the tick always reaches the database at :20, the minute the hourly jobs wake it", () => {
  assert.equal(TICK_HOURLY_MINUTE, 20);
  assert.deepEqual(tickDecision(fresh(null), new Date("2026-10-01T17:20:30Z")), { run: true, reason: "hourly" });
  assert.equal(tickDecision(fresh(null), new Date("2026-10-01T17:21:00Z")).run, false);
});

test("a booking lowers nextAt without the database, and never raises it", () => {
  const held = fresh(minutes(3 * 60));
  const lowered = lowerMarker(held, new Date(minutes(40)), NOW);
  assert.deepEqual(lowered, { nextAt: minutes(40), writtenAt: held.writtenAt });
  /* And the next tick runs for it. */
  assert.equal(tickDecision(lowered, NOW).run, true);
  /* From nothing booked. */
  assert.deepEqual(lowerMarker(fresh(null), new Date(minutes(90)), NOW), { nextAt: minutes(90), writtenAt: held.writtenAt });
  /* Later than the one held, the same, or already past: nothing to write. */
  assert.equal(lowerMarker(held, new Date(minutes(4 * 60)), NOW), null);
  assert.equal(lowerMarker(held, new Date(minutes(3 * 60)), NOW), null);
  assert.equal(lowerMarker(held, new Date(minutes(-1)), NOW), null);
  assert.equal(markerFrom(null, NOW).nextAt, null);
  assert.equal(markerFrom(new Date(minutes(30)), NOW).writtenAt, NOW.toISOString());
});

test("every write that books, moves or cancels a session tells the marker, after it is committed", () => {
  const data = readFileSync("lib/data/reminder-marker.ts", "utf8");
  /* A booking lowers with a conditional write; with no marker it reads the database. */
  assert.match(
    data,
    /export async function noteSessionBooked[\s\S]*lowerMarker\(read\.marker, startsAt, new Date\(\)\)[\s\S]*writeMarkerBlob\(markerPath\(\), serializeMarker\(lowered\), read\.etag\)/,
  );
  assert.match(data, /if \(read\.state !== "ok"\) \{\s*await refreshReminderMarker\(\);/);
  /* A cancel triggers a recompute from the database. */
  assert.match(data, /export async function noteSessionCancelled\(\)[\s\S]{0,80}await refreshReminderMarker\(\);/);
  /* A refresh reads the marker first and the database second, then writes only over what it read. */
  const refresh = data.slice(data.indexOf("export async function refreshReminderMarker"));
  assert.ok(refresh.indexOf("readMarker()") < refresh.indexOf("nextReminderAt("), "marker, then database");
  assert.match(refresh, /read\.state === "missing" \? null : read\.etag/);
  /* One marker per database, so a preview cannot speak for production. */
  assert.match(data, /ops\/reminder-marker\/\$\{createHash\("sha256"\)/);

  const scheduling = readFileSync("lib/data/scheduling.ts", "utf8");
  const book = scheduling.slice(scheduling.indexOf("export async function bookSlot"));
  assert.ok(book.indexOf("await noteSessionBooked(slot.startsAt)") > book.indexOf(".insert(sessions)"), "bookSlot");
  const cancelBooking = scheduling.slice(scheduling.indexOf("export async function cancelBooking"));
  assert.ok(cancelBooking.indexOf("await noteSessionCancelled()") > cancelBooking.indexOf('status: "cancelled"'), "cancelBooking");
  const change = readFileSync("lib/data/booking-change.ts", "utf8");
  const patientCancel = change.slice(
    change.indexOf("export async function patientCancel"),
    change.indexOf("export async function agreeLateRefund"),
  );
  assert.ok(patientCancel.indexOf("await noteSessionCancelled()") > patientCancel.indexOf('status: "cancelled"'), "patientCancel");
  const reschedule = change.slice(
    change.indexOf("export async function rescheduleBooking"),
    change.indexOf("export async function cancelledView"),
  );
  assert.ok(
    reschedule.indexOf("await noteSessionBooked(target.startsAt)") > reschedule.indexOf("scheduledAt: target.startsAt"),
    "rescheduleBooking",
  );
  const sessionsSource = readFileSync("lib/data/sessions.ts", "utf8");
  const cancelSession = sessionsSource.slice(sessionsSource.indexOf("export async function cancelSession"));
  assert.ok(cancelSession.indexOf("await noteSessionCancelled()") > cancelSession.indexOf('status: "cancelled"'), "cancelSession");
  /* A seed that writes sessions with SQL, past these hooks, writes the marker again from the database. */
  assert.match(readFileSync("scripts/seed-demo.ts", "utf8"), /await refreshReminderMarker\(\);/);
});

test("the tick gates on the marker, refreshes it after the sweep, and a skip records no heartbeat", () => {
  const route = readFileSync("app/api/cron/[job]/route.ts", "utf8");
  const tick = route.slice(route.indexOf("async tick()"));
  assert.ok(tick.indexOf("await tickGate()") < tick.indexOf("sweepSessionReminders()"), "gate before the sweep");
  assert.match(tick, /if \(!gate\.run\) return \{ skipped: true, gate: gate\.reason \};/);
  assert.ok(tick.indexOf("sweepSessionReminders()") < tick.indexOf("await refreshReminderMarker()"), "refresh after the sweep");
  /* The hourly reminders job refreshes it too, while the database is awake. */
  const reminders = route.slice(route.indexOf("async reminders()"), route.indexOf("async webhooks()"));
  assert.match(reminders, /await refreshReminderMarker\(\)/);
  /* A skipped run returns before the heartbeat, which is a database write. */
  const handler = route.slice(route.indexOf("export async function GET"));
  assert.ok(handler.indexOf("result.skipped === true") < handler.indexOf("await recordHeartbeat(job, { failedSteps })"));
  /* The watchdog holds the tick's heartbeat to the hour it is written in, not the minute it runs. */
  const heartbeat = readFileSync("lib/observability/heartbeat.ts", "utf8");
  assert.match(heartbeat, /export const HEARTBEAT_HOURS: Record<string, number> = \{\s*tick: 1,\s*\};/);
  assert.match(heartbeat, /tick: 1 \/ 60,/);
  assert.match(heartbeat, /lateAfterMs\(heartbeatHoursFor\(job\) \?\? hours\)/);
  /* No module but the upload module talks to blob storage. */
  assert.doesNotMatch(readFileSync("lib/data/reminder-marker.ts", "utf8"), /from "@vercel\/blob"/);
});

test("only main deploys: every other branch would make the Neon integration a database branch", () => {
  const vercel = JSON.parse(readFileSync("vercel.json", "utf8")) as { git?: { deploymentEnabled?: Record<string, boolean> } };
  assert.deepEqual(vercel.git?.deploymentEnabled, { main: true, "*": false, "**": false });
});

test("the legacy showcase runs no job: the switch answers after the secret and before any query", () => {
  const route = readFileSync("app/api/cron/[job]/route.ts", "utf8");
  const handler = route.slice(route.indexOf("export async function GET"));
  const guard = handler.indexOf("if (env.showcaseMode)");
  assert.ok(guard > handler.indexOf("bearerMatches(request, env.cronSecret)"), "the secret is still checked first");
  assert.ok(guard < handler.indexOf("recordHeartbeat"), "no heartbeat query in showcase");
  assert.ok(guard < handler.indexOf("JOBS[job as JobName]()"), "no job runs in showcase");
  assert.match(readFileSync("lib/env.ts", "utf8"), /showcaseMode: process\.env\.SHOWCASE_MODE === "1"/);
});
