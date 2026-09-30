import "server-only";

import { createHash } from "node:crypto";

import { and, eq, gt, isNull, sql } from "drizzle-orm";

import { log, safeErrorMessage } from "@/lib/logger";
import {
  lowerMarker,
  markerFrom,
  parseMarker,
  serializeMarker,
  tickDecision,
  type ReminderMarker,
  type TickDecision,
} from "@/lib/sessions/reminder-marker";

/**
 * 🔴 THE MINUTE TICK'S MARKER, the I/O around `lib/sessions/reminder-marker.ts`.
 *
 * Read by the tick with no database; written from the database by the tick when
 * it runs, by the hourly `reminders` job, and after the writes that book, move
 * or cancel a session. Nothing here ever throws: a marker that cannot be read
 * or written sends the tick to the database, which is what it did before.
 *
 * ## Conditional writes, so a booking is never lost to a race
 *
 * Every write names the version it read (`ifMatch`) or asks that there be none.
 * A refresh reads the marker FIRST and the database SECOND, so any booking whose
 * own marker write landed before that read was committed before the database
 * read and is in it; any booking whose marker write landed after it changed the
 * version, and the refresh's write fails and starts again. After three losses
 * the marker is deleted, which is the fail safe: no marker, database path.
 *
 * ## One marker per database
 *
 * The blob store is shared by production, previews and a laptop. The path
 * carries a hash of the database's host and name (never the credentials), so a
 * preview writing what its own branch holds cannot tell production's tick that
 * nothing is booked.
 */

const ATTEMPTS = 3;

/** The marker's path, keyed to the database it describes. */
function markerPath(databaseUrl: string | undefined = process.env.DATABASE_URL): string {
  let key = "local";
  if (databaseUrl) {
    try {
      const url = new URL(databaseUrl);
      /* The pooled and direct hosts are one database. */
      key = `${url.hostname.replace("-pooler.", ".")}${url.pathname}`;
    } catch {
      key = "unparsed";
    }
  }
  return `ops/reminder-marker/${createHash("sha256").update(key).digest("hex").slice(0, 16)}.json`;
}

type Read =
  | { state: "ok"; marker: ReminderMarker; etag: string }
  | { state: "missing" }
  | { state: "malformed"; etag: string }
  | { state: "error" };

async function readMarker(): Promise<Read> {
  try {
    const { readMarkerBlob } = await import("@/lib/uploads");
    const blob = await readMarkerBlob(markerPath());
    if (!blob) return { state: "missing" };
    const marker = parseMarker(blob.text);
    return marker ? { state: "ok", marker, etag: blob.etag } : { state: "malformed", etag: blob.etag };
  } catch (error) {
    log.warn("reminder marker not read", { reason: safeErrorMessage(error) });
    return { state: "error" };
  }
}

/**
 * The start of the soonest session that could still need a reminder: booked,
 * not cancelled, not started, still ahead. Wider than the sweep's own query
 * (no join link required), so the marker can only ever run the tick early.
 * One read of `sessions_scheduled_upcoming_idx`.
 */
async function nextReminderAt(now: Date = new Date()): Promise<Date | null> {
  const { controlDb: db } = await import("@/lib/db");
  const { sessions } = await import("@/lib/db/schema");
  const [row] = await db
    .select({ next: sql<Date | string | null>`min(${sessions.scheduledAt})` })
    .from(sessions)
    .where(
      and(
        eq(sessions.status, "scheduled"),
        isNull(sessions.cancelledAt),
        isNull(sessions.startedAt),
        gt(sessions.scheduledAt, now),
      ),
    );
  const next = row?.next ?? null;
  if (next === null) return null;
  const at = next instanceof Date ? next : new Date(next);
  return Number.isNaN(at.getTime()) ? null : at;
}

/** Give up safely: no marker, so the next tick reads the database. */
async function forget(why: string): Promise<void> {
  try {
    const { deleteMarkerBlob } = await import("@/lib/uploads");
    await deleteMarkerBlob(markerPath());
    log.warn("reminder marker removed", { why });
  } catch (error) {
    log.error("reminder marker could not be written or removed", { why, reason: safeErrorMessage(error) });
  }
}

/**
 * 🔴 THE TICK'S QUESTION, with no database. Never throws: anything but a fresh,
 * well formed marker runs the database path.
 */
export async function tickGate(now: Date = new Date()): Promise<TickDecision> {
  const read = await readMarker();
  return tickDecision(read.state === "ok" ? read.marker : null, now);
}

/**
 * Write the marker again from the database. Returns whether it was written.
 * Never throws. The database must be reachable; callers are ones already using it.
 */
export async function refreshReminderMarker(): Promise<boolean> {
  const { writeMarkerBlob, isMarkerConflict } = await import("@/lib/uploads");
  for (let attempt = 0; attempt < ATTEMPTS; attempt += 1) {
    const read = await readMarker();
    if (read.state === "error") {
      /* The store cannot be read; a marker it holds may be wrong, so try to remove it. */
      await forget("unreadable");
      return false;
    }
    let marker: ReminderMarker;
    try {
      const now = new Date();
      marker = markerFrom(await nextReminderAt(now), now);
    } catch (error) {
      log.warn("reminder marker not refreshed: database", { reason: safeErrorMessage(error) });
      return false;
    }
    try {
      await writeMarkerBlob(markerPath(), serializeMarker(marker), read.state === "missing" ? null : read.etag);
      return true;
    } catch (error) {
      if (isMarkerConflict(error)) continue;
      log.warn("reminder marker not written", { reason: safeErrorMessage(error) });
      await forget("write refused");
      return false;
    }
  }
  await forget("lost every race");
  return false;
}

/**
 * 🔴 A SESSION WAS BOOKED OR MOVED TO `startsAt`. Called after the row is
 * committed. Lowers `nextAt` without reading the database; with no marker, or
 * one that cannot be parsed, it reads the database instead, so a refresh that
 * began before this booking cannot write a marker without it.
 */
export async function noteSessionBooked(startsAt: Date | null | undefined): Promise<void> {
  if (!startsAt) return;
  try {
    const { writeMarkerBlob, isMarkerConflict } = await import("@/lib/uploads");
    for (let attempt = 0; attempt < ATTEMPTS; attempt += 1) {
      const read = await readMarker();
      if (read.state !== "ok") {
        await refreshReminderMarker();
        return;
      }
      const lowered = lowerMarker(read.marker, startsAt, new Date());
      if (!lowered) return;
      try {
        await writeMarkerBlob(markerPath(), serializeMarker(lowered), read.etag);
        return;
      } catch (error) {
        if (isMarkerConflict(error)) continue;
        log.warn("reminder marker not lowered", { reason: safeErrorMessage(error) });
        await forget("lower refused");
        return;
      }
    }
    await forget("lost every race");
  } catch (error) {
    log.warn("reminder marker not lowered", { reason: safeErrorMessage(error) });
  }
}

/**
 * A booked session was cancelled (or otherwise stopped being ahead). Not needed
 * for correctness, since a marker that is too early only runs a tick that finds
 * nothing, but it lets the database sleep through the hour that session held.
 */
export async function noteSessionCancelled(): Promise<void> {
  try {
    await refreshReminderMarker();
  } catch (error) {
    log.warn("reminder marker not refreshed", { reason: safeErrorMessage(error) });
  }
}
