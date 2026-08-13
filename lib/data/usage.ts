import "server-only";

import { and, count, desc, eq, gte, sql, sum } from "drizzle-orm";

import { db } from "@/lib/db";
import { aiRequestLogs, sessionPayments, sessions, users } from "@/lib/db/schema";

/**
 * What everything actually cost, and who spent it.
 *
 * This exists because the accounting underneath it did not work. Usage was
 * being logged on every model call — with a database write each time — into a
 * whole-cent integer column, and 91% of calls rounded to zero. The ledger ran,
 * cost money, and reported nothing; nobody looked for the missing figure
 * precisely because a usage table existed.
 *
 * So every read here is in microcents, and every figure that reaches a screen
 * is formatted from that. `cost_cents` is still written for anything old that
 * reads it, and nothing in this file touches it.
 *
 * The margin question this is really for: a clinician on an unlimited plan
 * paying a flat fee, transcribing forty hours a month, is the one who decides
 * whether the pricing works. Until now there was no way to find them.
 */

/** 1 cent = 1000 microcents. Formatting money is the one place to be pedantic. */
export function formatMicrocents(microcents: number): string {
  const dollars = microcents / 100_000;
  if (dollars >= 1) return `$${dollars.toFixed(2)}`;
  if (dollars >= 0.01) return `${(microcents / 1000).toFixed(1)}¢`;
  // Below a tenth of a cent, two decimals of a cent is the honest resolution —
  // rounding it away is the bug this whole file exists because of.
  return `${(microcents / 1000).toFixed(2)}¢`;
}

export type TherapistUsage = {
  userId: string;
  firstName: string;
  lastName: string;
  email: string;
  sessions: number;
  aiCalls: number;
  audioMinutes: number;
  costMicrocents: number;
  /** What patients paid them, so cost can be read against revenue. */
  patientCents: number;
  /** Our cut of that. */
  feeCents: number;
};

/**
 * Every clinician, with their spend beside their earnings.
 *
 * Three separate aggregates rather than one join. Joining sessions, usage and
 * payments in a single query multiplies rows — a session with twelve
 * transcription chunks and one payment counts that payment twelve times — and
 * the resulting revenue figure is wrong in a direction that flatters us.
 */
export async function usageByTherapist(sinceDays = 30): Promise<TherapistUsage[]> {
  const since = new Date(Date.now() - sinceDays * 24 * 60 * 60 * 1000);

  const [people, ai, sessionCounts, money] = await Promise.all([
    db
      .select({
        userId: users.id,
        firstName: users.firstName,
        lastName: users.lastName,
        email: users.email,
      })
      .from(users)
      .where(and(eq(users.role, "therapist"), sql`${users.deletedAt} is null`)),

    db
      .select({
        userId: aiRequestLogs.userId,
        calls: count(),
        audioSeconds: sum(aiRequestLogs.audioSeconds),
        microcents: sum(aiRequestLogs.costMicrocents),
      })
      .from(aiRequestLogs)
      .where(gte(aiRequestLogs.createdAt, since))
      .groupBy(aiRequestLogs.userId),

    db
      .select({ userId: sessions.therapistId, total: count() })
      .from(sessions)
      .where(gte(sessions.createdAt, since))
      .groupBy(sessions.therapistId),

    db
      .select({
        userId: sessionPayments.therapistId,
        patientCents: sum(sessionPayments.grossCents),
        feeCents: sum(sessionPayments.platformFeeCents),
      })
      .from(sessionPayments)
      .where(gte(sessionPayments.createdAt, since))
      .groupBy(sessionPayments.therapistId),
  ]);

  const aiBy = new Map(ai.map((row) => [row.userId, row]));
  const sessionsBy = new Map(sessionCounts.map((row) => [row.userId, row.total]));
  const moneyBy = new Map(money.map((row) => [row.userId, row]));

  return people
    .map((person) => {
      const usage = aiBy.get(person.userId);
      const paid = moneyBy.get(person.userId);
      return {
        ...person,
        sessions: sessionsBy.get(person.userId) ?? 0,
        aiCalls: Number(usage?.calls ?? 0),
        audioMinutes: Math.round(Number(usage?.audioSeconds ?? 0) / 60),
        costMicrocents: Number(usage?.microcents ?? 0),
        patientCents: Number(paid?.patientCents ?? 0),
        feeCents: Number(paid?.feeCents ?? 0),
      };
    })
    .sort((a, b) => b.costMicrocents - a.costMicrocents);
}

/** Spend split by what it was spent on. The shape of the bill, not its size. */
export async function usageByKind(sinceDays = 30) {
  const since = new Date(Date.now() - sinceDays * 24 * 60 * 60 * 1000);
  return db
    .select({
      kind: aiRequestLogs.kind,
      model: aiRequestLogs.model,
      calls: count(),
      microcents: sum(aiRequestLogs.costMicrocents),
      errors: sql<number>`count(*) filter (where ${aiRequestLogs.status} = 'error')`,
    })
    .from(aiRequestLogs)
    .where(gte(aiRequestLogs.createdAt, since))
    .groupBy(aiRequestLogs.kind, aiRequestLogs.model)
    .orderBy(desc(sum(aiRequestLogs.costMicrocents)));
}

/**
 * One session, itemised.
 *
 * The number that decides the business: what a single session costs us to run.
 * A pricing model is a guess until this is a real figure with real sessions
 * behind it, and it is the first thing the ten-clinician beta exists to
 * measure.
 */
export async function costPerSession(sinceDays = 30) {
  const since = new Date(Date.now() - sinceDays * 24 * 60 * 60 * 1000);

  const [row] = await db
    .select({
      sessions: sql<number>`count(distinct ${aiRequestLogs.sessionId})`,
      microcents: sum(aiRequestLogs.costMicrocents),
      audioSeconds: sum(aiRequestLogs.audioSeconds),
    })
    .from(aiRequestLogs)
    .where(and(gte(aiRequestLogs.createdAt, since), sql`${aiRequestLogs.sessionId} is not null`));

  const sessionCount = Number(row?.sessions ?? 0);
  const microcents = Number(row?.microcents ?? 0);

  return {
    sessions: sessionCount,
    totalMicrocents: microcents,
    perSessionMicrocents: sessionCount > 0 ? Math.round(microcents / sessionCount) : 0,
    audioMinutes: Math.round(Number(row?.audioSeconds ?? 0) / 60),
  };
}

/** Itemised usage for one session — what Total View will read, once it exists. */
export async function usageForSession(sessionId: string) {
  return db
    .select({
      id: aiRequestLogs.id,
      kind: aiRequestLogs.kind,
      model: aiRequestLogs.model,
      inputTokens: aiRequestLogs.inputTokens,
      outputTokens: aiRequestLogs.outputTokens,
      audioSeconds: aiRequestLogs.audioSeconds,
      costMicrocents: aiRequestLogs.costMicrocents,
      durationMs: aiRequestLogs.durationMs,
      status: aiRequestLogs.status,
      createdAt: aiRequestLogs.createdAt,
    })
    .from(aiRequestLogs)
    .where(eq(aiRequestLogs.sessionId, sessionId))
    .orderBy(aiRequestLogs.createdAt);
}
