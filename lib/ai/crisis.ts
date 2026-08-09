import "server-only";

import { and, desc, eq, gt } from "drizzle-orm";

import { db } from "@/lib/db";
import { notifications, riskAssessments, sessions } from "@/lib/db/schema";
import type { RiskLevel } from "@/lib/db/schema";
import { log, ref, safeErrorMessage } from "@/lib/logger";

/**
 * The single crisis keyword list, and the single place it is applied.
 *
 * The old codebase had four divergent lists, and the scan itself lived only in
 * the typed-segment path — the Whisper path used a different function that never
 * scanned at all. Since essentially every real session is audio, that meant
 * crisis detection was effectively off in production while the product page
 * advertised it. This module is imported by exactly one caller
 * (`appendTranscriptSegment`), so both paths cannot diverge again.
 */
const CRISIS_PHRASES = [
  "kill myself",
  "killing myself",
  "end my life",
  "ending my life",
  "take my own life",
  "want to die",
  "wish i was dead",
  "wish i were dead",
  "better off dead",
  "suicidal",
  "suicide",
  "hurt myself",
  "hurting myself",
  // "harm myself" was missing from the first version of this list while
  // "hurt myself" and "self-harm" were present, so a patient using that exact
  // phrasing raised nothing. Phrasings a patient actually uses matter more here
  // than a tidy list.
  "harm myself",
  "harming myself",
  "cut myself",
  "cutting myself",
  "self harm",
  "self-harm",
  "overdose",
  "no reason to live",
  "nothing to live for",
  "not worth living",
  "end it all",
  "want it to end",
  "kill me",
  "cant go on",
  "can't go on",
  "hopeless",
  "hurt someone",
  "kill him",
  "kill her",
  "kill them",
] as const;

/** Ten minutes. Re-alerting on every mention turns the alert into noise. */
const DEDUP_WINDOW_MS = 10 * 60 * 1000;

export function scanForCrisisLanguage(text: string): string[] {
  const haystack = text.toLowerCase();
  return CRISIS_PHRASES.filter((phrase) => haystack.includes(phrase));
}

/**
 * Record and deliver a crisis alert.
 *
 * The write ordering is load-bearing: the risk row is persisted as `pending`
 * *before* anyone is notified and only flipped to `delivered` afterwards. That
 * way a notification failure leaves a durable record for the sweeper cron to
 * retry, instead of the alert evaporating.
 */
export async function raiseCrisisAlert(opts: {
  sessionId: string;
  organizationId: string;
  therapistId: string;
  patientId: string | null;
  level: RiskLevel;
  source: "keyword" | "model";
  indicators: string[];
  recommendedAction?: string;
}): Promise<void> {
  const recent = await db
    .select({ id: riskAssessments.id })
    .from(riskAssessments)
    .where(
      and(
        eq(riskAssessments.sessionId, opts.sessionId),
        gt(riskAssessments.createdAt, new Date(Date.now() - DEDUP_WINDOW_MS)),
      ),
    )
    .orderBy(desc(riskAssessments.createdAt))
    .limit(1);

  if (recent.length > 0) return;

  const inserted = await db
    .insert(riskAssessments)
    .values({
      sessionId: opts.sessionId,
      organizationId: opts.organizationId,
      therapistId: opts.therapistId,
      patientId: opts.patientId,
      level: opts.level,
      source: opts.source,
      indicators: opts.indicators,
      recommendedAction:
        opts.recommendedAction ??
        "Pause and assess directly. If there is imminent risk, follow your local emergency protocol.",
      alertStatus: "pending",
    })
    .returning({ id: riskAssessments.id });

  const riskId = inserted[0]?.id;
  if (!riskId) return;

  // Note: the notification body never contains the matched phrases. The
  // clinician sees those in the room and in the chart, not in a push payload.
  try {
    await db.insert(notifications).values({
      userId: opts.therapistId,
      kind: "crisis",
      title: "Risk language detected",
      body: "Language associated with risk was detected in a live session. Open the session to review.",
      actionUrl: `/sessions/${opts.sessionId}`,
    });

    await db
      .update(riskAssessments)
      .set({ alertStatus: "delivered" })
      .where(eq(riskAssessments.id, riskId));
  } catch (error) {
    log.error("crisis alert delivery failed; left pending for sweeper", {
      session: ref(opts.sessionId),
      reason: safeErrorMessage(error),
    });
  }

  // Logged without the matched phrases — those are the patient's words.
  log.warn("crisis alert raised", {
    session: ref(opts.sessionId),
    level: opts.level,
    source: opts.source,
    indicatorCount: opts.indicators.length,
  });
}

/**
 * Re-deliver alerts that were persisted but never delivered. Run on a schedule.
 */
export async function sweepUndeliveredAlerts(): Promise<number> {
  const stale = await db
    .select({
      id: riskAssessments.id,
      sessionId: riskAssessments.sessionId,
      therapistId: riskAssessments.therapistId,
    })
    .from(riskAssessments)
    .innerJoin(sessions, eq(sessions.id, riskAssessments.sessionId))
    .where(eq(riskAssessments.alertStatus, "pending"))
    .limit(50);

  let delivered = 0;
  for (const row of stale) {
    try {
      await db.insert(notifications).values({
        userId: row.therapistId,
        kind: "crisis",
        title: "Risk language detected",
        body: "Language associated with risk was detected in a session. Open the session to review.",
        actionUrl: `/sessions/${row.sessionId}`,
      });
      await db
        .update(riskAssessments)
        .set({ alertStatus: "delivered" })
        .where(eq(riskAssessments.id, row.id));
      delivered += 1;
    } catch (error) {
      log.error("crisis sweeper delivery failed", { reason: safeErrorMessage(error) });
    }
  }
  return delivered;
}

/**
 * What a patient on a join link is allowed to see. No level, no indicators, no
 * clinical detail — only support and a number to call. This shape is asserted
 * by a test so it cannot quietly grow a `level` field.
 */
export function patientFacingCrisisMessage(): { message: string; helpline: string } {
  return {
    message:
      "Your therapist has been notified and is here with you. If you need immediate help right now, you can call or text 988 at any time.",
    helpline: "988",
  };
}
