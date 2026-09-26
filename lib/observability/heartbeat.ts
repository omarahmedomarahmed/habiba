/*
 * 🔴 30.1: the CONTROL PLANE, like the error log: the scheduler is operational
 * and an operator watches one board.
 */
import "server-only";

import { and, eq, gte, sql } from "drizzle-orm";

import { controlDb as db } from "@/lib/db";
import { cronHeartbeats, cronLeases, errorEvents, opsAlerts, users } from "@/lib/db/schema";
import { log, safeErrorMessage } from "@/lib/logger";

/**
 * 🔴 0165: A JOB THAT STOPS IS NOTICED. Launch blockers, 25 September 2026.
 *
 * Errors went to `error_events` and nowhere else, and a scheduled job that
 * stopped running was noticed by nobody. That is not hypothetical here: the
 * file at `app/api/cron/[job]/route.ts` records a session that sat
 * `in_progress` for days because the schedule was off, and the crisis sweep is
 * one of these jobs.
 *
 * Three pieces, all in this file so the rule is in one place:
 *
 *   - `recordHeartbeat`: the cron route calls it after every run
 *   - `watchdog`: hourly, emails the super admins when a scheduled job is twice
 *     its interval late, or when new server errors appeared in the last hour
 *   - `claimLease` / `releaseLease`: a sweep that sends unprompted messages
 *     takes one first, so two overlapping runs cannot both send
 *
 * 🔴 AN ALERT NEVER CARRIES PATIENT DATA. The job alert is a job name and two
 * times. The error alert is a count, the scrubbed route and a message with every
 * quoted value, number, email and id taken out: an error thrown while writing a
 * note can carry a patient's words, and an email inbox is not where those go.
 * The full row stays on /admin/errors, behind the console's own access control.
 */

/**
 * 🔴 How often each SCHEDULED job runs, in hours, and it must match `vercel.json`.
 *
 * `verify:launch` reads both and fails when they disagree, because a watchdog
 * holding its own idea of a schedule is a watchdog that goes quiet the day
 * somebody tunes the real one. A job not in this map (a job run by hand, like
 * `radar`) records a heartbeat and is never called late.
 */
export const CRON_INTERVAL_HOURS: Record<string, number> = {
  crisis: 1,
  reminders: 1,
  billing: 24,
  retention: 24,
  extract: 24,
};

/** Late means twice the interval: one missed run is a blip, two is a stopped job. */
export const OVERDUE_FACTOR = 2;

/**
 * After every run, whatever happened. `failedSteps` empty means a clean run;
 * `threw` means the job did not finish at all.
 *
 * Never throws: a heartbeat that cannot be written must not turn a job that
 * worked into a 500. The watchdog notices the missing heartbeat instead, which
 * is the right outcome for a database that cannot take a one-row upsert.
 */
export async function recordHeartbeat(
  job: string,
  outcome: { failedSteps?: string | undefined; threw?: boolean },
  now = new Date(),
): Promise<void> {
  const clean = !outcome.threw && !outcome.failedSteps;
  const failedSteps = outcome.threw ? "job" : (outcome.failedSteps ?? null);
  try {
    await db
      .insert(cronHeartbeats)
      .values({ job, lastRunAt: now, lastSuccessAt: clean ? now : null, failedSteps, updatedAt: now })
      .onConflictDoUpdate({
        target: cronHeartbeats.job,
        set: {
          lastRunAt: now,
          /* 🔴 Only a clean run moves it, so a step failing every hour still goes late. */
          lastSuccessAt: clean ? now : sql`${cronHeartbeats.lastSuccessAt}`,
          failedSteps,
          updatedAt: now,
        },
      });
  } catch (error) {
    log.warn("cron heartbeat not written", { job, reason: safeErrorMessage(error) });
  }
}

/**
 * 🔴 Take a lease for `minutes`, or learn that somebody else holds one.
 *
 * A conditional upsert: the row is inserted, or updated only when the current
 * lease has run out. Postgres takes the row lock for `ON CONFLICT DO UPDATE`
 * and re-checks the WHERE against the committed row, so of two runs arriving
 * together exactly one gets `true`. The lease expires on its own, so a run
 * that died holding it blocks the next one for at most `minutes`.
 */
export async function claimLease(name: string, minutes: number, now = new Date()): Promise<boolean> {
  const until = new Date(now.getTime() + minutes * 60_000);
  const claimed = await db
    .insert(cronLeases)
    .values({ name, heldUntil: until })
    .onConflictDoUpdate({
      target: cronLeases.name,
      set: { heldUntil: until },
      setWhere: sql`${cronLeases.heldUntil} < ${now}`,
    })
    .returning({ name: cronLeases.name });
  return claimed.length > 0;
}

/** Hand the lease back as soon as the work is done, so the next run is not held for nothing. */
export async function releaseLease(name: string): Promise<void> {
  try {
    await db.update(cronLeases).set({ heldUntil: new Date(0) }).where(eq(cronLeases.name, name));
  } catch (error) {
    /* It expires on its own; a failed release costs one skipped run at most. */
    log.warn("cron lease not released", { name, reason: safeErrorMessage(error) });
  }
}

/**
 * An error message with anything that could be a person's taken out.
 *
 * `recordError` already replaced emails and ids. This goes further for an
 * inbox: quoted values (where a thrown message puts the input it choked on),
 * every run of digits, and anything after a colon past the first, then a hard
 * cap. What is left names the kind of failure, which is all an alert needs.
 */
export function alertSafeMessage(message: string): string {
  return message
    .replace(/(["'`])(?:(?!\1).)*\1/g, "[value]")
    .replace(/[^\s@]+@[^\s@]+/g, "[email]")
    .replace(/\d+/g, "#")
    .replace(/^([^:]*:[^:]*):.*$/, "$1: [detail]")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 120);
}

export type WatchdogProblem = { key: string; subject: string; body: string };

/** What is wrong right now, without sending anything. Split out so a verifier can read it. */
export async function findProblems(now = new Date()): Promise<WatchdogProblem[]> {
  const problems: WatchdogProblem[] = [];

  const beats = await db.select().from(cronHeartbeats);
  const byJob = new Map(beats.map((row) => [row.job, row]));

  for (const [job, hours] of Object.entries(CRON_INTERVAL_HOURS)) {
    const beat = byJob.get(job);
    const last = beat?.lastSuccessAt ?? null;
    const lateBy = OVERDUE_FACTOR * hours * 60 * 60 * 1000;
    /*
     * No row at all is late too. The migration seeds a row for every scheduled
     * job, so a missing one means somebody deleted it, and a job nobody can
     * vouch for is exactly the case this exists to report.
     */
    if (last && now.getTime() - last.getTime() <= lateBy) continue;

    const since = last ? `${Math.round((now.getTime() - last.getTime()) / 3_600_000)} hours ago` : "never";
    const lastRun = beat?.lastRunAt ? beat.lastRunAt.toISOString() : "no run recorded";
    problems.push({
      key: `cron-overdue:${job}`,
      subject: `Scheduled job "${job}" has not run cleanly for ${OVERDUE_FACTOR * hours}+ hours`,
      body: [
        `The "${job}" job runs every ${hours === 1 ? "hour" : `${hours} hours`}. Its last clean run was ${since}.`,
        `Last run of any kind: ${lastRun}.`,
        beat?.failedSteps ? `Steps that failed on that run: ${beat.failedSteps}.` : null,
        "",
        "Check the Vercel cron log for the " + job + " job, and the CRON_SECRET on the deployment.",
        job === "crisis"
          ? "This job re-delivers crisis alerts whose notification failed. Treat it as urgent."
          : null,
      ]
        .filter((line) => line !== null)
        .join("\n"),
    });
  }

  /*
   * 🔴 New SERVER errors in the last hour. A count and the top five, grouped by
   * route and fingerprint, so a thousand of one bug reads as one bug. Client
   * errors are left out: a browser extension on one laptop is not an incident.
   */
  const hourAgo = new Date(now.getTime() - 60 * 60 * 1000);
  const top = await db
    .select({
      route: errorEvents.route,
      fingerprint: errorEvents.fingerprint,
      message: sql<string>`min(${errorEvents.message})`,
      n: sql<number>`count(*)::int`,
    })
    .from(errorEvents)
    .where(and(eq(errorEvents.kind, "server"), gte(errorEvents.createdAt, hourAgo)))
    .groupBy(errorEvents.route, errorEvents.fingerprint)
    .orderBy(sql`count(*) desc`)
    .limit(5);

  if (top.length > 0) {
    const [total] = await db
      .select({ n: sql<number>`count(*)::int` })
      .from(errorEvents)
      .where(and(eq(errorEvents.kind, "server"), gte(errorEvents.createdAt, hourAgo)));
    const count = total?.n ?? 0;
    problems.push({
      key: "server-errors",
      subject: `${count} new server error${count === 1 ? "" : "s"} in the last hour`,
      body: [
        `${count} server error record${count === 1 ? "" : "s"} in the last hour (one row per bug per ten minutes). The most frequent:`,
        "",
        ...top.map((row) => `  ${row.n} x ${row.route} (${row.fingerprint}): ${alertSafeMessage(row.message)}`),
        "",
        "The full records are on /admin/errors. This email is sent at most once a day.",
      ].join("\n"),
    });
  }

  return problems;
}

/**
 * 🔴 The hourly check. Emails every super admin about each problem, at most
 * once per problem per day.
 *
 * The `ops_alerts` row is inserted BEFORE the email and the email goes only if
 * the insert landed. Two hourly jobs call this in the same minute (so either
 * one stopping is noticed by the other), and the primary key is what stops
 * both of them sending.
 */
export async function watchdog(now = new Date()): Promise<{ problems: number; alerted: number }> {
  const problems = await findProblems(now);
  if (problems.length === 0) return { problems: 0, alerted: 0 };

  const day = now.toISOString().slice(0, 10);
  const { notify } = await import("@/lib/notify");
  let alerted = 0;

  for (const problem of problems) {
    const [claimed] = await db
      .insert(opsAlerts)
      .values({ key: problem.key, day })
      .onConflictDoNothing()
      .returning({ key: opsAlerts.key });
    if (!claimed) continue;

    const founders = await db
      .select({ email: users.email, timezone: users.timezone })
      .from(users)
      .where(eq(users.role, "super_admin"))
      .limit(10);

    for (const person of founders) {
      await notify(
        /* Email only: an ops alert on WhatsApp needs a template nobody has approved. */
        { email: person.email, phone: null, timezone: person.timezone },
        { kind: "ops.watchdog", subject: problem.subject, body: problem.body },
      );
    }
    alerted += 1;
    log.warn("ops alert sent", { key: problem.key, recipients: founders.length });
  }

  return { problems: problems.length, alerted };
}

/**
 * 🔴 51.6: what the watchdog reads, for the operator who has to believe it.
 * Each scheduled job's last run and last clean run, whether it is overdue by
 * the same rule the watchdog emails on. The alerts are `opsAlertBoard` below.
 */
export async function jobHealth(now = new Date()): Promise<{
  jobs: { job: string; lastRunAt: Date | null; lastSuccessAt: Date | null; failedSteps: string | null; overdue: boolean }[];
}> {
  const rows = await db.select().from(cronHeartbeats).orderBy(cronHeartbeats.job);
  return {
    jobs: rows.map((row) => {
      const hours = CRON_INTERVAL_HOURS[row.job] ?? 24;
      const since = row.lastSuccessAt ?? row.updatedAt;
      return {
        job: row.job,
        lastRunAt: row.lastRunAt,
        lastSuccessAt: row.lastSuccessAt,
        failedSteps: row.failedSteps,
        overdue: now.getTime() - since.getTime() > hours * OVERDUE_FACTOR * 3_600_000,
      };
    }),
  };
}

/**
 * 🔴 Board 423: the alerts of the last week, one per key, each open or cleared
 * by the same `findProblems` the watchdog emails from. The /admin overview
 * counts the open ones and /admin/errors lists them all; see
 * `lib/observability/alert-words.ts` for the rule.
 */
export async function opsAlertBoard(now = new Date()) {
  const { alertBoard } = await import("./alert-words");
  const [sent, problems] = await Promise.all([
    db
      .select({ key: opsAlerts.key, sentAt: opsAlerts.sentAt })
      .from(opsAlerts)
      .where(gte(opsAlerts.sentAt, new Date(now.getTime() - 7 * 86_400_000)))
      .orderBy(sql`${opsAlerts.sentAt} DESC`)
      .limit(50),
    findProblems(now),
  ]);
  return alertBoard(sent, new Set(problems.map((problem) => problem.key)));
}
