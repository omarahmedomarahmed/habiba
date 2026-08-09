import { NextResponse } from "next/server";
import { lt } from "drizzle-orm";

import { sweepUndeliveredAlerts } from "@/lib/ai/crisis";
import { purgeExpiredSessions } from "@/lib/auth/session";
import { reconcileMissingCharges } from "@/lib/billing/service";
import { db } from "@/lib/db";
import { auditLog } from "@/lib/db/schema";
import { env } from "@/lib/env";
import { log, safeErrorMessage } from "@/lib/logger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * Scheduled work. Three jobs, down from nine.
 *
 * Authenticated with a shared secret, because a cron endpoint that anyone can
 * hit is a free way to make the platform do work — and `retention` deletes
 * rows.
 */
const JOBS = {
  /**
   * Re-deliver crisis alerts that were persisted but whose notification failed.
   * This is the reason a failed notification does not lose an alert, and it is
   * the single most safety-relevant scheduled job in the system.
   */
  async crisis() {
    const delivered = await sweepUndeliveredAlerts();
    return { delivered };
  },

  /** Charge completed sessions that somehow produced no charge row. */
  async billing() {
    const reconciled = await reconcileMissingCharges();
    return { reconciled };
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
    return { auditPurged: purged.length, sessionsPurged };
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
