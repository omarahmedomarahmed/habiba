/**
 * The arithmetic of a bookable hour. PLAN.md 11.1 / 11.5 / 11.6.
 *
 * Pure, so the rules that decide whether two people can be in the same room at
 * the same time are tested rather than trusted.
 */

/** 11.1 — 19:00, never 19:15. The database enforces it too; this is the UI's copy. */
export function isWholeHour(at: Date): boolean {
  return at.getUTCMinutes() === 0 && at.getUTCSeconds() === 0 && at.getUTCMilliseconds() === 0;
}

/** The hour a moment falls in, rounded **down**. */
export function floorToHour(at: Date): Date {
  const out = new Date(at);
  out.setUTCMinutes(0, 0, 0);
  return out;
}

/** The next whole hour strictly after `at`. */
export function nextHour(at: Date): Date {
  const floored = floorToHour(at);
  return floored.getTime() === at.getTime()
    ? new Date(floored.getTime() + 3_600_000)
    : new Date(floored.getTime() + 3_600_000);
}

export const HOUR_MS = 3_600_000;

/**
 * How long a slot is held while somebody pays. 11.3.
 *
 * Ten minutes: long enough for 3-D Secure and a mistyped card, short enough
 * that an abandoned checkout does not hold a Tuesday evening all afternoon.
 */
export const HOLD_MS = 10 * 60_000;

/**
 * How close to a booked hour a clinician is taken off the crisis radar. 11.5.
 *
 * Fifteen minutes. The radar exists to put a stranger in crisis into a room
 * *now*, and a fifty-minute crisis session starting twelve minutes before a
 * booked appointment guarantees one of the two people is let down. Taking the
 * clinician off the board is the version where nobody is promised anything we
 * cannot deliver.
 */
export const OFFLINE_BEFORE_MS = 15 * 60_000;

/**
 * How far ahead a live session warns about the next booking. 11.6.
 *
 * Ten minutes, which is the same countdown the session clock already uses —
 * a clinician who has learned "ten minutes left" from one place should not
 * have to learn a second number from another.
 */
export const WARN_BEFORE_MS = 10 * 60_000;

export type SlotView = {
  startsAt: Date;
  status: "open" | "held" | "booked" | "blocked";
  heldUntil: Date | null;
};

/**
 * Can this slot be booked right now?
 *
 * A `held` slot whose hold has run out is bookable again — the expiry is a
 * timestamp, compared here, rather than a job that flips rows. A cron that
 * runs late holds an hour nobody wants, and this way the worst case is a
 * stale-looking row rather than an unbookable evening.
 */
export function isBookable(slot: SlotView, now: Date): boolean {
  if (slot.status === "open") return slot.startsAt.getTime() > now.getTime();
  if (slot.status !== "held") return false;
  if (!slot.heldUntil) return false;
  return slot.heldUntil.getTime() <= now.getTime() && slot.startsAt.getTime() > now.getTime();
}

/**
 * 11.5 — should the radar hide this clinician?
 *
 * True from fifteen minutes before a booked hour until the end of it. Note
 * that it hides them for the *whole* booked hour, not only the run-up: a
 * clinician in a booked session is exactly as unavailable as one about to
 * start it.
 */
export function shouldAutoOffline(
  bookings: { startsAt: Date; durationMinutes: number }[],
  now: Date,
): boolean {
  return bookings.some((booking) => {
    const from = booking.startsAt.getTime() - OFFLINE_BEFORE_MS;
    const until = booking.startsAt.getTime() + booking.durationMinutes * 60_000;
    return now.getTime() >= from && now.getTime() < until;
  });
}

/**
 * 11.6 — the next booking a live session should warn about.
 *
 * Returns the minutes until it, or null when there is nothing close enough to
 * matter. Only *future* bookings count: a clinician already ten minutes into
 * an overrunning session does not need to be told about the hour they are
 * currently in.
 */
export function bookingWarning(
  bookings: { startsAt: Date }[],
  now: Date,
): { minutes: number; startsAt: Date } | null {
  const soon = bookings
    .filter((b) => b.startsAt.getTime() > now.getTime())
    .filter((b) => b.startsAt.getTime() - now.getTime() <= WARN_BEFORE_MS)
    .sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime());

  const next = soon[0];
  if (!next) return null;

  return {
    // Rounded up, so "1 minute" never means "twenty seconds".
    minutes: Math.ceil((next.startsAt.getTime() - now.getTime()) / 60_000),
    startsAt: next.startsAt,
  };
}

/**
 * The hours a clinician offers on a given day, as whole-hour timestamps.
 *
 * `from` and `to` are hours of the day in UTC, `to` exclusive: 18→21 is
 * 18:00, 19:00 and 20:00. An inverted or empty range yields nothing rather
 * than wrapping around midnight — a clinician who types 21→18 has made a
 * mistake, and silently offering them a night shift is not a kindness.
 */
export function hoursOn(day: Date, from: number, to: number): Date[] {
  if (!Number.isInteger(from) || !Number.isInteger(to)) return [];
  if (from < 0 || to > 24 || from >= to) return [];

  const midnight = new Date(
    Date.UTC(day.getUTCFullYear(), day.getUTCMonth(), day.getUTCDate(), 0, 0, 0, 0),
  );

  const out: Date[] = [];
  for (let hour = from; hour < to; hour += 1) {
    out.push(new Date(midnight.getTime() + hour * HOUR_MS));
  }
  return out;
}

/** Group slots by UTC day, for a calendar. Days with nothing in them are absent. */
export function byDay<T extends { startsAt: Date }>(slots: T[]): { day: string; slots: T[] }[] {
  const map = new Map<string, T[]>();

  for (const slot of [...slots].sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime())) {
    const day = slot.startsAt.toISOString().slice(0, 10);
    const list = map.get(day);
    if (list) list.push(slot);
    else map.set(day, [slot]);
  }

  return [...map.entries()].map(([day, list]) => ({ day, slots: list }));
}
