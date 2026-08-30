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
 * Scheduled work. Four jobs, three of them on a clock.
 *
 * ## The schedule, and why it is shaped like this
 *
 * All three run inside ten minutes of 03:00 UTC, and that is the whole trick.
 * Neon bills for the time the compute is *awake*, not for the work done, and a
 * cron holds the database up for the entire idle timeout it resets on the way
 * past. Three jobs spread across the day cost three wakes; three jobs inside
 * one idle window cost one. The five minutes of compute is the price, not the
 * few seconds of sweeping.
 *
 *   crisis     03:00  retries crisis alerts whose notification failed, sweeps
 *                     the radar, closes rooms a patient walked away from, and
 *                     tells patients whose summary is written and unclaimed.
 *                     SAFETY-RELEVANT.
 *   billing    03:05  charges completed sessions that produced no charge row,
 *                     which happens when a Stripe webhook is lost.
 *   retention  03:10  purges audit rows past six years, expired sessions,
 *                     spent rate-limit rows and errors past thirty days.
 *
 * These were switched off for a while, when the product had no users and the
 * only thing an hourly sweep achieved was five minutes of paid compute per
 * hour to look at an empty table. That was the right call then and the wrong
 * one now: with the schedule off, a session whose room was closed without
 * being ended stayed `in_progress` with a null duration forever, and one is
 * sitting in the database as proof.
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
 * So the schedule went hourly — and then to nothing at all, once it was clear
 * that hourly still meant five minutes of paid compute every hour to sweep an
 * empty table. The history below is kept because it is the reasoning to
 * re-apply when the schedules come back, not because it describes today.
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
    const { sweepAbandonedPatients, sweepUnratedSessions } = await import("@/lib/data/feedback");
    const left = await sweepAbandonedPatients();
    /*
     * And the patients whose summary is finished and who never came back for
     * it. Folded in here for the same billing reason as the radar sweep: the
     * expensive part is waking the database, not the query.
     *
     * The event-driven path in `approvePatientNote` catches most of these the
     * moment the clinician signs. This is the backstop for the ones it cannot
     * see — a note signed inside the first three-quarters of an hour, before
     * the reminder is allowed to send at all.
     */
    const unrated = await sweepUnratedSessions();

    /*
     * And sessions that ran past the cap with nobody watching.
     *
     * The ladder fires on the polls both sides make, which is right — but a
     * session whose clinician closed the tab and whose patient never had one is
     * polled by nobody, so nothing ever ends it. It stays in progress with the
     * clinician marked unavailable on the public radar. One such row predates
     * this sweep.
     */
    const { sweepOverrunSessions } = await import("@/lib/data/sessions");
    const overrun = await sweepOverrunSessions();

    return {
      delivered,
      released: swept.released,
      wentOffline: swept.offline,
      abandoned: swept.abandoned,
      warned: left.warned,
      suspended: left.suspended,
      reminded: unrated.reminded,
      overrunEnded: overrun.ended,
    };
  },

  /** Charge completed sessions that somehow produced no charge row. */
  async billing() {
    const reconciled = await reconcileMissingCharges();

    /*
     * And send out anything we are still holding for a clinician Stripe has
     * since verified.
     *
     * The webhook and the settings page both release on their own, and this is
     * the backstop for when neither fires — a dropped `account.updated`, a
     * clinician who finished onboarding on their phone and never came back to
     * the page. It is somebody else's money; one missed event is not an
     * acceptable reason for it to sit here.
     */
    const { releaseAllHeldEarnings } = await import("@/lib/billing/connect");
    const released = await releaseAllHeldEarnings();

    return { reconciled, released: released.released, centsMoved: released.centsMoved };
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
    // Errors are kept for a month — long enough to see a pattern, short
    // enough that a route throwing all weekend does not become the largest
    // table in the database.
    const { purgeOldErrors } = await import("@/lib/observability/errors");
    const errorsPurged = await purgeOldErrors();
    return { auditPurged: purged.length, sessionsPurged, limitsPurged, errorsPurged };
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
