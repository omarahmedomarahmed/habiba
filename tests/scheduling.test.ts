import assert from "node:assert/strict";
import { test } from "node:test";

import {
  bookingWarning,
  byDay,
  floorToHour,
  hoursOn,
  isBookable,
  isWholeHour,
  nextHour,
  OFFLINE_BEFORE_MS,
  shouldAutoOffline,
  WARN_BEFORE_MS,
} from "../lib/scheduling/hours";

/**
 * Sprint 11's arithmetic.
 *
 * Two of these decide whether two people end up in the same room at the same
 * time, which is the only failure in this sprint that a patient experiences
 * directly:
 *
 *   - **whole hours only** (11.1), so a calendar cannot carry 19:00 and 19:15
 *   - **auto-offline** (11.5), so the radar stops offering a clinician who is
 *     twelve minutes from somebody else's appointment
 */

const at = (iso: string) => new Date(iso);

/* -------------------------------------------------------- 11.1 whole hours -- */

test("19:00 is a whole hour and 19:15 is not", () => {
  assert.equal(isWholeHour(at("2026-10-01T19:00:00.000Z")), true);
  assert.equal(isWholeHour(at("2026-10-01T19:15:00.000Z")), false);
  assert.equal(isWholeHour(at("2026-10-01T19:00:30.000Z")), false);
  assert.equal(isWholeHour(at("2026-10-01T19:00:00.500Z")), false);
});

test("flooring and stepping stay on the hour", () => {
  assert.equal(
    floorToHour(at("2026-10-01T19:47:12.345Z")).toISOString(),
    "2026-10-01T19:00:00.000Z",
  );
  assert.equal(nextHour(at("2026-10-01T19:47:00.000Z")).toISOString(), "2026-10-01T20:00:00.000Z");
  // Exactly on the hour steps forward, never returns itself — otherwise
  // "the next bookable hour" is the one already in progress.
  assert.equal(nextHour(at("2026-10-01T19:00:00.000Z")).toISOString(), "2026-10-01T20:00:00.000Z");
});

test("a published range is whole hours, end exclusive", () => {
  const hours = hoursOn(at("2026-10-01T00:00:00Z"), 18, 21);
  assert.deepEqual(
    hours.map((h) => h.toISOString()),
    ["2026-10-01T18:00:00.000Z", "2026-10-01T19:00:00.000Z", "2026-10-01T20:00:00.000Z"],
  );
  assert.ok(hours.every(isWholeHour));
});

test("🔴 an inverted range yields nothing rather than wrapping past midnight", () => {
  // A clinician who types 21→18 has made a mistake. Silently offering them a
  // night shift is not a kindness.
  assert.deepEqual(hoursOn(at("2026-10-01T00:00:00Z"), 21, 18), []);
  assert.deepEqual(hoursOn(at("2026-10-01T00:00:00Z"), 18, 18), []);
  assert.deepEqual(hoursOn(at("2026-10-01T00:00:00Z"), -1, 5), []);
  assert.deepEqual(hoursOn(at("2026-10-01T00:00:00Z"), 20, 25), []);
  assert.deepEqual(hoursOn(at("2026-10-01T00:00:00Z"), 18.5, 21), []);
});

/* ------------------------------------------------------------ bookability -- */

const now = at("2026-10-01T12:00:00Z");
const future = at("2026-10-01T19:00:00Z");

test("an open future hour is bookable; an open past one is not", () => {
  assert.equal(isBookable({ startsAt: future, status: "open", heldUntil: null }, now), true);
  assert.equal(
    isBookable({ startsAt: at("2026-10-01T09:00:00Z"), status: "open", heldUntil: null }, now),
    false,
  );
});

test("a live hold blocks the hour; an expired one releases it", () => {
  // The expiry is compared, not swept. A cron that runs late would hold a
  // Tuesday evening that nobody wants.
  const live = { startsAt: future, status: "held" as const, heldUntil: at("2026-10-01T12:05:00Z") };
  const stale = {
    startsAt: future,
    status: "held" as const,
    heldUntil: at("2026-10-01T11:55:00Z"),
  };

  assert.equal(isBookable(live, now), false);
  assert.equal(isBookable(stale, now), true);
});

test("booked and blocked are never bookable", () => {
  assert.equal(isBookable({ startsAt: future, status: "booked", heldUntil: null }, now), false);
  assert.equal(isBookable({ startsAt: future, status: "blocked", heldUntil: null }, now), false);
});

/* --------------------------------------------------------- 11.5 auto-offline -- */

const booking = { startsAt: at("2026-10-01T19:00:00Z"), durationMinutes: 60 };

test("🔴 the radar hides a clinician from 15 minutes before a booked hour", () => {
  // The radar exists to put a stranger in crisis into a room *now*. A
  // fifty-minute crisis session starting twelve minutes before an appointment
  // guarantees one of the two people is let down.
  const justOutside = new Date(booking.startsAt.getTime() - OFFLINE_BEFORE_MS - 1000);
  const justInside = new Date(booking.startsAt.getTime() - OFFLINE_BEFORE_MS);

  assert.equal(shouldAutoOffline([booking], justOutside), false);
  assert.equal(shouldAutoOffline([booking], justInside), true);
});

test("…and for the whole booked hour, not only the run-up", () => {
  assert.equal(shouldAutoOffline([booking], at("2026-10-01T19:30:00Z")), true);
  // The last millisecond of the hour is still booked.
  assert.equal(shouldAutoOffline([booking], at("2026-10-01T19:59:59Z")), true);
  // And the moment it ends, they are back.
  assert.equal(shouldAutoOffline([booking], at("2026-10-01T20:00:00Z")), false);
});

test("no bookings means no hiding", () => {
  assert.equal(shouldAutoOffline([], now), false);
});

test("a 90-minute slot hides them for 90 minutes", () => {
  // The duration is read from the row, not assumed to be an hour.
  const long = { startsAt: at("2026-10-01T19:00:00Z"), durationMinutes: 90 };
  assert.equal(shouldAutoOffline([long], at("2026-10-01T20:15:00Z")), true);
  assert.equal(shouldAutoOffline([booking], at("2026-10-01T20:15:00Z")), false);
});

/* ------------------------------------------------------------ 11.6 warning -- */

test("the room warns about a booking inside the window, and not before", () => {
  const soon = { startsAt: new Date(now.getTime() + WARN_BEFORE_MS - 60_000) };
  const later = { startsAt: new Date(now.getTime() + WARN_BEFORE_MS + 60_000) };

  assert.equal(bookingWarning([soon], now)?.minutes, 9);
  assert.equal(bookingWarning([later], now), null);
});

test("🔴 it never warns about an hour already in progress", () => {
  // A clinician ten minutes into an overrunning session does not need telling
  // about the hour they are currently in — they are in it.
  const started = { startsAt: new Date(now.getTime() - 60_000) };
  assert.equal(bookingWarning([started], now), null);
});

test("minutes round up, so '1 minute' never means twenty seconds", () => {
  const almost = { startsAt: new Date(now.getTime() + 20_000) };
  assert.equal(bookingWarning([almost], now)?.minutes, 1);
});

test("the soonest booking wins when several are close", () => {
  const later = { startsAt: new Date(now.getTime() + 9 * 60_000) };
  const sooner = { startsAt: new Date(now.getTime() + 3 * 60_000) };
  assert.equal(bookingWarning([later, sooner], now)?.minutes, 3);
});

/* ----------------------------------------------------------------- grouping -- */

test("slots group by day, in order, and empty days are absent", () => {
  const grouped = byDay([
    { startsAt: at("2026-10-02T19:00:00Z") },
    { startsAt: at("2026-10-01T20:00:00Z") },
    { startsAt: at("2026-10-01T18:00:00Z") },
  ]);

  assert.deepEqual(
    grouped.map((g) => g.day),
    ["2026-10-01", "2026-10-02"],
  );
  assert.deepEqual(
    grouped[0]!.slots.map((s) => s.startsAt.getUTCHours()),
    [18, 20],
  );
  // 2026-10-03 has nothing in it and does not appear — a calendar of empty
  // days is a calendar nobody scrolls.
  assert.equal(grouped.length, 2);
});
