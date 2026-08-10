import { NextResponse } from "next/server";
import { lt } from "drizzle-orm";

import { sweepUndeliveredAlerts } from "@/lib/ai/crisis";
import { purgeExpiredSessions } from "@/lib/auth/session";
import { reconcileMissingCharges } from "@/lib/billing/service";
import { sweepRadar } from "@/lib/data/radar";
import { purgeExpiredLimits } from "@/lib/rate-limit";
import { db } from "@/lib/db";
import { auditLog } from "@/lib/db/schema";
import { env } from "@/lib/env";
import { log, safeErrorMessage } from "@/lib/logger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * Scheduled work. Four jobs, down from nine.
 *
 * Authenticated with a shared secret, because a cron endpoint that anyone can
 * hit is a free way to make the platform do work — and `retention` deletes
 * rows.
 *
 * ## Why the schedules are what they are
 *
 * Every one of these opens a database connection, and the database bills by
 * the hour it is *awake*, not by the work it does. Neon suspends an idle
 * compute after five minutes; a job running every five minutes therefore wakes
 * it forever and it never suspends once. That is exactly what happened: with
 * nobody using the product at all — the last therapist heartbeat was seventeen
 * hours earlier — the compute had been billed for twenty-six hours out of the
 * thirty it had existed, because `crisis` ran every five minutes and reset
 * the idle timer every time, just before it expired.
 *
 * So the interval is not about how often the work is *worth* doing. It is
 * about how long the database gets to sleep between wakes. At a quarter of
 * an hour it sleeps for roughly two thirds of every hour; at five minutes it
 * never slept at all.
 *
 * The radar sweep moved *into* `crisis` for the same reason. It was never
 * scheduled separately, and giving it its own entry would have bought a second
 * set of wakes for work that costs nothing to do alongside the first.
 */
const JOBS = {
  /**
   * Re-deliver crisis alerts that were persisted but whose notification failed.
   * This is the reason a failed notification does not lose an alert, and it is
   * the single most safety-relevant scheduled job in the system.
   */
  async crisis() {
    const delivered = await sweepUndeliveredAlerts();
    // Folded in rather than scheduled separately — see the note above. Both
    // are cheap sweeps and the expensive part is waking the database at all.
    // Flattened rather than nested: the log field type is a flat map, and a
    // nested object here is a type error at the call site rather than a
    // helpfully structured log line.
    const swept = await sweepRadar();
    // And the one that matters most: a patient sitting in an empty room
    // because the clinician who advertised themselves never turned up.
    const { sweepAbandonedPatients } = await import("@/lib/data/feedback");
    const left = await sweepAbandonedPatients();
    return {
      delivered,
      released: swept.released,
      wentOffline: swept.offline,
      abandoned: swept.abandoned,
      warned: left.warned,
      suspended: left.suspended,
    };
  },

  /** Charge completed sessions that somehow produced no charge row. */
  async billing() {
    const reconciled = await reconcileMissingCharges();
    return { reconciled };
  },

  /**
   * Radar housekeeping: release lapsed booking claims and drop clinicians whose
   * heartbeat has stopped.
   *
   * Explicitly *not* the guard against double-booking — the claiming UPDATE
   * already treats an expired claim as available, so correctness does not
   * depend on this running. What it fixes is the public list advertising
   * someone who closed their laptop twenty minutes ago.
   */
  /**
   * The radar sweep, still reachable by hand.
   *
   * Not on a schedule of its own — `crisis` runs it. Kept as a named job
   * because "put everyone's status back where it should be, now" is a thing
   * you want to be able to do from a terminal at the exact moment something
   * looks wrong, without waiting a quarter of an hour.
   */
  async radar() {
    return sweepRadar();
  },

  /**
   * Retention. Audit records are kept for six years, then deleted.
   *
   * The old job filtered on `accessed_at`, a column that does not exist on that
   * table, and wrapped the query in `.catch(() => [])` — so it threw on every
   * run, swallowed the error, reported success, and had never deleted a single
   * row. Here the column is real and the error is not swallowed.
   */
  async retention() {
    const cutoff = new Date(Date.now() - 6 * 365 * 24 * 60 * 60 * 1000);
    const purged = await db
      .delete(auditLog)
      .where(lt(auditLog.createdAt, cutoff))
      .returning({ id: auditLog.id });

    const sessionsPurged = await purgeExpiredSessions();
    // Rate-limit rows self-invalidate on read; this only stops the table
    // growing without bound.
    const limitsPurged = await purgeExpiredLimits();
    return { auditPurged: purged.length, sessionsPurged, limitsPurged };
  },
} as const;

type JobName = keyof typeof JOBS;

export async function GET(request: Request, { params }: { params: Promise<{ job: string }> }) {
  const { job } = await params;

  const provided =
    request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ??
    new URL(request.url).searchParams.get("secret") ??
    "";

  if (!env.cronSecret || provided !== env.cronSecret) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  if (!(job in JOBS)) {
    return NextResponse.json({ error: "unknown_job" }, { status: 404 });
  }

  try {
    const result = await JOBS[job as JobName]();
    log.info("cron job completed", { job, ...result });
    return NextResponse.json({ job, ...result });
  } catch (error) {
    log.error("cron job failed", { job, reason: safeErrorMessage(error) });
    return NextResponse.json({ error: "job_failed" }, { status: 500 });
  }
}
