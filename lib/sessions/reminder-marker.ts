/**
 * 🔴 THE MINUTE TICK WITHOUT THE DATABASE, when nothing can be due.
 *
 * The tick (`app/api/cron/[job]/route.ts`, 0183) ran every minute and opened a
 * database connection every time, so the Neon compute never suspended: awake
 * all day, every day, to find nothing on almost every minute. This is the rule
 * that lets it not ask.
 *
 * A tiny MARKER lives outside Postgres, in Vercel Blob: the start of the
 * soonest booked session that could still need a reminder, and when that was
 * read from the database. Nothing else, no id and no name:
 *
 *   { "nextAt": "2026-10-01T19:00:00.000Z" | null, "writtenAt": "..." }
 *
 * 🔴 F2: and, only while a crisis alert is open, a third timestamp,
 * `crisisDueAt`: when its escalation to a backup falls due (or now, for an
 * out-of-band send to retry). A due `crisisDueAt` runs the tick whatever the
 * sessions say, so an unacknowledged alert escalates within a minute of its
 * deadline while the database still sleeps through every minute before it.
 * It is lowered after the alert row is committed (`noteCrisisDue`) and written
 * again from the database by every refresh, exactly like `nextAt`.
 *
 * The tick reads it (no database) and skips when the marker is FRESH (written
 * inside `MARKER_FRESH_MINUTES`) and the next session is more than
 * `LOOKAHEAD_MINUTES` away, or there is none. Anything else runs the database
 * path exactly as before and writes the marker again.
 *
 * ## Why it can never miss a reminder
 *
 *   - Every write that books or moves a session lowers `nextAt` (or reads it
 *     again from the database) after the row is committed, with a conditional
 *     write, so a booking is never lost to a race with another writer.
 *   - Every hourly `reminders` run, and the tick itself whenever it reaches the
 *     database, writes it again from the database. So a write path nobody
 *     hooked is caught within the hour, and the fresh window (75 minutes) is
 *     longer than the hour between two refreshes, so the hourly refresh alone
 *     keeps the marker fresh.
 *   - FAIL SAFE: a marker that is missing, unreadable, malformed, from the
 *     future or stale is no marker, and the tick runs the database path.
 *
 * Pure and dependency free, so the rule is tested as arithmetic
 * (`tests/session-reminders.test.ts`); the I/O is `lib/data/reminder-marker.ts`.
 */

import { LOOKAHEAD_MINUTES } from "./reminders";

export type ReminderMarker = {
  /** The start of the soonest booked, not cancelled, not started session still ahead; null for none. */
  nextAt: string | null;
  /** When `nextAt` was last read from the database. Lowering it by a booking keeps this. */
  writtenAt: string;
  /**
   * 🔴 F2: the soonest moment a crisis alert needs the tick: an unacknowledged
   * alert's escalation coming due, or an out-of-band send to retry. ABSENT,
   * never null, when there is none, so a marker with no open alert is the same
   * two timestamps it always was and every existing marker still parses.
   */
  crisisDueAt?: string;
};

/** A marker older than this is no marker. Longer than the hour between two refreshes. */
export const MARKER_FRESH_MINUTES = 75;

/** A `writtenAt` this far ahead of the clock is not believed either. */
export const MARKER_CLOCK_SKEW_MINUTES = 5;

/**
 * 🔴 The minute past each hour when the tick always reaches the database, whatever
 * the marker says. The same minute as `crisis` and `reminders`, which wake the
 * database anyway, so it costs nothing, and it is what keeps the tick's
 * heartbeat honest: it proves every hour that the scheduled tick, its secret and
 * its database path all work (`lib/observability/heartbeat.ts`, HEARTBEAT_HOURS).
 */
export const TICK_HOURLY_MINUTE = 20;

export type TickReason =
  /** Skip: nothing is booked ahead. */
  | "idle"
  /** Skip: the next session is more than the lookahead away. */
  | "far"
  /** Run: the next session is inside the lookahead (or already began). */
  | "due"
  /** Run: no marker, or one that could not be read or parsed. */
  | "missing"
  /** Run: the marker is older than `MARKER_FRESH_MINUTES` or from the future. */
  | "stale"
  /** Run: the hourly minute, for the heartbeat and a refresh. */
  | "hourly"
  /** Run: 🔴 F2, a crisis alert's escalation or out-of-band retry is due. */
  | "crisis";

export type TickDecision = { run: boolean; reason: TickReason };

function isoMs(value: unknown): number | null {
  if (typeof value !== "string" || value.length > 40) return null;
  const ms = Date.parse(value);
  return Number.isNaN(ms) ? null : ms;
}

/** The marker in a blob's text, or null when it is anything but exactly a marker. */
export function parseMarker(text: string | null | undefined): ReminderMarker | null {
  if (typeof text !== "string" || text.length === 0 || text.length > 512) return null;
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    return null;
  }
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  const keys = Object.keys(record).sort();
  /* Exactly the two timestamps, or those and 🔴 F2's crisis timestamp; nothing else. */
  const two = keys.length === 2 && keys[0] === "nextAt" && keys[1] === "writtenAt";
  const three = keys.length === 3 && keys[0] === "crisisDueAt" && keys[1] === "nextAt" && keys[2] === "writtenAt";
  if (!two && !three) return null;
  if (isoMs(record.writtenAt) === null) return null;
  if (record.nextAt !== null && isoMs(record.nextAt) === null) return null;
  if (three && isoMs(record.crisisDueAt) === null) return null;
  return {
    nextAt: record.nextAt as string | null,
    writtenAt: record.writtenAt as string,
    ...(three ? { crisisDueAt: record.crisisDueAt as string } : {}),
  };
}

/** The blob's text. Only the timestamps, whatever the object carried. */
export function serializeMarker(marker: ReminderMarker): string {
  return JSON.stringify(
    marker.crisisDueAt
      ? { nextAt: marker.nextAt, writtenAt: marker.writtenAt, crisisDueAt: marker.crisisDueAt }
      : { nextAt: marker.nextAt, writtenAt: marker.writtenAt },
  );
}

/** A marker read from the database just now. */
export function markerFrom(nextAt: Date | null, now: Date, crisisDueAt: Date | null = null): ReminderMarker {
  return {
    nextAt: nextAt ? nextAt.toISOString() : null,
    writtenAt: now.toISOString(),
    ...(crisisDueAt ? { crisisDueAt: crisisDueAt.toISOString() } : {}),
  };
}

/** Is this marker recent enough to be believed at `now`? */
function markerIsFresh(marker: ReminderMarker, now: number): boolean {
  const written = isoMs(marker.writtenAt);
  if (written === null) return false;
  if (written - now > MARKER_CLOCK_SKEW_MINUTES * 60_000) return false;
  return now - written <= MARKER_FRESH_MINUTES * 60_000;
}

/**
 * 🔴 THE DECISION. Should this tick reach the database?
 *
 * `marker` is null for missing, unreadable or malformed; all three run. Skips
 * only on a fresh marker whose next session is more than the lookahead away,
 * the same `LOOKAHEAD_MINUTES` (61) the sweep itself reads, so the first mark
 * (60) is inside the window a minute before it is due.
 */
export function tickDecision(marker: ReminderMarker | null, now: Date): TickDecision {
  if (now.getUTCMinutes() === TICK_HOURLY_MINUTE) return { run: true, reason: "hourly" };
  if (!marker) return { run: true, reason: "missing" };
  const at = now.getTime();
  if (!markerIsFresh(marker, at)) return { run: true, reason: "stale" };
  /*
   * 🔴 F2: a crisis alert whose escalation (or retry) is due runs the tick, at
   * the minute it falls due, whatever the sessions say. Not yet due, it is
   * ignored, so an open alert costs no wakes before its time.
   */
  if (marker.crisisDueAt !== undefined) {
    const crisis = isoMs(marker.crisisDueAt);
    if (crisis === null || crisis <= at) return { run: true, reason: "crisis" };
  }
  if (marker.nextAt === null) return { run: false, reason: "idle" };
  const next = isoMs(marker.nextAt);
  if (next === null) return { run: true, reason: "missing" };
  if (next - at > LOOKAHEAD_MINUTES * 60_000) return { run: false, reason: "far" };
  return { run: true, reason: "due" };
}

/**
 * A booking (or a move) to `startsAt`, written into a marker without reading the
 * database: `nextAt` becomes the sooner of the two. `writtenAt` is kept, because
 * it says when the database was last read, and lowering does not read it.
 *
 * Returns null when nothing changes (a start already passed, or later than the
 * one held), so the caller writes nothing.
 */
export function lowerMarker(marker: ReminderMarker, startsAt: Date, now: Date): ReminderMarker | null {
  const start = startsAt.getTime();
  if (Number.isNaN(start) || start <= now.getTime()) return null;
  const held = marker.nextAt === null ? null : isoMs(marker.nextAt);
  if (held !== null && held <= start) return null;
  return {
    nextAt: startsAt.toISOString(),
    writtenAt: marker.writtenAt,
    /* A booking never touches the crisis timestamp. */
    ...(marker.crisisDueAt ? { crisisDueAt: marker.crisisDueAt } : {}),
  };
}

/**
 * 🔴 F2: a crisis alert was raised (or upgraded, or its send failed) and needs
 * the tick at `dueAt`. `crisisDueAt` becomes the sooner of the two; the
 * sessions half and `writtenAt` are kept. Null when nothing changes. Unlike a
 * booking, a due time already past is written: it means "the next tick".
 */
export function lowerCrisisDue(marker: ReminderMarker, dueAt: Date): ReminderMarker | null {
  const due = dueAt.getTime();
  if (Number.isNaN(due)) return null;
  const held = marker.crisisDueAt === undefined ? null : isoMs(marker.crisisDueAt);
  if (held !== null && held <= due) return null;
  return { nextAt: marker.nextAt, writtenAt: marker.writtenAt, crisisDueAt: dueAt.toISOString() };
}
