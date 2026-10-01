import "server-only";

import { and, eq, sql } from "drizzle-orm";

import { audit } from "@/lib/audit";
import type { Actor } from "@/lib/auth/session";
import { adultConfirmedFrom } from "@/lib/consent/adult";
import { controlDb } from "@/lib/db";
import { qualified } from "@/lib/db/qualified";
import { patientAccounts, patients, sessions } from "@/lib/db/schema";
import { log, ref, safeErrorMessage } from "@/lib/logger";

/**
 * DD-2 B1: has somebody confirmed this session's patient is 18 or over? On the
 * session, on its chart, or on the patient's own account. Fails closed: if the
 * check cannot run, the answer is no and nothing is recorded.
 */
export async function adultConfirmedForSession(sessionId: string): Promise<boolean> {
  try {
    const [row] = await controlDb
      .select({
        session: sessions.adultConfirmedAt,
        chart: patients.adultConfirmedAt,
        account: sql<Date | null>`(
          SELECT MAX(a.adult_confirmed_at) FROM ${patientAccounts} a
           WHERE a.person_id = ${qualified(patients.personId)}
        )`,
      })
      .from(sessions)
      .leftJoin(patients, eq(patients.id, sessions.patientId))
      .where(eq(sessions.id, sessionId))
      .limit(1);
    if (!row) return false;
    return adultConfirmedFrom({
      session: row.session,
      chart: row.chart,
      account: row.account ? new Date(row.account) : null,
    });
  } catch (error) {
    log.error("adult check failed, treating as unconfirmed", {
      session: ref(sessionId),
      reason: safeErrorMessage(error),
    });
    return false;
  }
}

/**
 * The clinician confirms, in the room, that the patient in front of them is 18
 * or over. Stored on the session and, when the chart has none yet, on the chart,
 * so the next session does not ask again. Scoped to the clinician's own session.
 */
export async function confirmAdultForSession(actor: Actor, sessionId: string): Promise<boolean> {
  const now = new Date();
  const [session] = await controlDb
    .update(sessions)
    .set({ adultConfirmedAt: now, adultConfirmedBy: actor.userId })
    .where(
      and(
        eq(sessions.id, sessionId),
        eq(sessions.organizationId, actor.organizationId),
        eq(sessions.therapistId, actor.userId),
      ),
    )
    .returning({ patientId: sessions.patientId });
  if (!session) return false;

  if (session.patientId) await confirmAdultForChart(actor, session.patientId, now);

  await audit({
    actor,
    category: "clinical",
    action: "patient.adult_confirmed",
    resourceType: "session",
    resourceId: sessionId,
  });

  /* Review fix: a yes to recording that waited on this confirmation now sends the meeting's recorder. */
  const { sendBotOnceAdult } = await import("@/lib/meetings/dispatch");
  await sendBotOnceAdult(sessionId);
  return true;
}

/** The chart's own confirmation, written once and never overwritten. */
export async function confirmAdultForChart(actor: Actor, patientId: string, at = new Date()): Promise<void> {
  await controlDb
    .update(patients)
    .set({ adultConfirmedAt: at, adultConfirmedBy: actor.userId })
    .where(
      and(
        eq(patients.id, patientId),
        eq(patients.organizationId, actor.organizationId),
        sql`${patients.adultConfirmedAt} IS NULL`,
      ),
    );
}
