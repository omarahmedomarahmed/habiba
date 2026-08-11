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
 * compute a set time after the last query — so the real cost of a cron is not
 * its runtime, it is the whole idle timeout it resets on the way past.
 *
 * The first version of this ran `crisis` every five minutes against a
 * five-minute idle timeout, which meant the compute never suspended once: it
 * was billed for twenty-six of the thirty hours it had existed, with nobody
 * using the product at all.
 *
 * Moving to a quarter of an hour was an improvement and not a fix. Four wakes
 * an hour, each holding the database up for the full five-minute timeout, is
 * twenty minutes in every sixty — a third of the clock, in perpetuity, for an
 * idle product. Vercel's own logs made it plain: twenty-four hits on
 * /api/cron/crisis in six hours and eleven on everything else combined.
 *
 * So the schedule is hourly, and the thing that used to justify running it
 * often does not live here any more.
 *
 * ## What moved, and why that is the actual fix
 *
 * Of the three sweeps inside `crisis`, only one was time-critical: a patient
 * left sitting in an empty room, which is measured in ten minutes. Catching
 * that with a clock meant waking the database constantly to ask a question
 * whose answer is almost always "nobody is waiting".
 *
 * It is now checked on the patient's own five-second poll instead — see
 * `markAbandonedIfWaiting`. The event that matters is the patient waiting, and
 * that patient is already talking to us. Nothing runs when nobody is waiting,
 * and when somebody is, it fires at ten minutes rather than at whatever point
 * the next cron happens to land.
 *
 * What is left here is a backstop for the one case the poll cannot see: a
 * patient who closed the tab and walked away. An hour late is fine for that —
 * it decides when a clinician's warning email is sent, not whether anyone gets
 * help.
 *
 * The other two never needed the frequency. `sweepUndeliveredAlerts` retries
 * notifications that have already been persisted, and `sweepRadar` is
 * cosmetic: the reachability predicate excludes a stale clinician at query
 * time, so the board is correct whether or not the sweep has run.
 *
 * The radar sweep lives *inside* `crisis` for the same billing reason. Giving
 * it its own entry would buy a second set of wakes for work that costs nothing
 * to do alongside the first.
 *
 * ## The other half of this, which is not in this file
 *
 * The idle timeout itself. At Neon's default of five minutes, one hourly cron
 * still holds the compute up for five minutes an hour; at sixty seconds it is
 * one. That is a project setting ("Scale to zero after"), not code, and it is
 * worth strictly more than any schedule written here.
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
