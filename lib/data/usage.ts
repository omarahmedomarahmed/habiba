/*
 * 🔴 30.1 — the CONTROL PLANE: model spend is our cost, measured once across the platform.
 */
import "server-only";

import { and, count, desc, eq, gte, sql, sum } from "drizzle-orm";

import { controlDb as db} from "@/lib/db";
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

/**
 * 🔴 49.14c — the bucket an unattributable call is reported under.
 *
 * Never a null. A null in a `GROUP BY` is silently omitted from every
 * per-account report while the total stays correct, which is the §6 family in
 * a reporting costume: nothing fails, and the number is wrong.
 */
export const PLATFORM_BUCKET = "PLATFORM";

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

  /*
   * 🔴 49.14c / C221 — the spend that belongs to nobody, named.
   *
   * `people` is the therapist list, so a usage row whose `user_id` is null has
   * no person to map onto and simply vanishes from this list. The total at the
   * top of the screen and the sum of the rows beneath it then disagree, with
   * nothing to say why: "an unattributable cost that silently disappears is
   * how a margin goes wrong quietly".
   *
   * It is a ROW now, with a name on it. An operator scanning which clinicians
   * cost the most can see, in the same column, that some of the spend belongs
   * to no clinician at all.
   */
  const unattributed = ai.find((row) => row.userId === null);

  const platformRow: TherapistUsage[] =
    unattributed && Number(unattributed.microcents ?? 0) > 0
      ? [
          {
            userId: PLATFORM_BUCKET,
            firstName: PLATFORM_BUCKET,
            lastName: "",
            email: "",
            sessions: 0,
            aiCalls: Number(unattributed.calls ?? 0),
            audioMinutes: Math.round(Number(unattributed.audioSeconds ?? 0) / 60),
            costMicrocents: Number(unattributed.microcents ?? 0),
            patientCents: 0,
            feeCents: 0,
          },
        ]
      : [];

  return [...platformRow, ...people
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
  ].sort((a, b) => b.costMicrocents - a.costMicrocents);
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

/**
 * 🔴 49.8 / C280 — what one person's care has cost us in model spend.
 *
 * This is the query `ai_request_logs.patient_id` exists for, and the one that
 * has to stay where it is.
 *
 * C280 names what the column makes possible: a timestamped record of every
 * model call concerning a person, queryable by person. Not one row contains a
 * clinical word, and the shape of somebody's care is still legible in the
 * timing and the volume. Internal cost accounting only. Never patient-facing,
 * never clinic-facing, never sponsor-facing, and inside C244 from the day
 * sponsors exist.
 *
 * 🔴 The platform bucket is a ROW here too. A patient list that quietly omits
 * the calls attributable to nobody adds up to less than the total above it,
 * and the reader has no way to tell whether the difference is unattributed
 * spend or a bug.
 */
export async function costByPatient(sinceDays = 30, limit = 20) {
  const since = new Date(Date.now() - sinceDays * 24 * 60 * 60 * 1000);

  const rows = await db
    .select({
      patientId: aiRequestLogs.patientId,
      calls: count(),
      microcents: sum(aiRequestLogs.costMicrocents),
    })
    .from(aiRequestLogs)
    .where(gte(aiRequestLogs.createdAt, since))
    .groupBy(aiRequestLogs.patientId)
    .orderBy(desc(sum(aiRequestLogs.costMicrocents)))
    .limit(limit);

  /*
   * 🔴 The null becomes the named bucket HERE, and it is the only place it
   * can. Grouping on the coalesced expression is what a reader expects and
   * Postgres rejects it through the query builder, so the naming happens on
   * the way out. What matters for 49.14c is that no caller can receive a null
   * and quietly drop it: the type says `string`, and the string has a name.
   */
  return rows.map((row) => ({
    patientId: row.patientId ?? PLATFORM_BUCKET,
    calls: Number(row.calls),
    costMicrocents: Number(row.microcents ?? 0),
  }));
}

/**
 * 49.7 — by account, which is what a margin is actually made of.
 *
 * Same platform bucket, same reason. An organisation-level report that drops
 * the null rows is the exact disappearance C221 forbids, and it is the one an
 * investor deck is built from.
 */
export async function costByAccount(sinceDays = 30, limit = 20) {
  const since = new Date(Date.now() - sinceDays * 24 * 60 * 60 * 1000);

  const rows = await db
    .select({
      organizationId: aiRequestLogs.organizationId,
      calls: count(),
      microcents: sum(aiRequestLogs.costMicrocents),
    })
    .from(aiRequestLogs)
    .where(gte(aiRequestLogs.createdAt, since))
    .groupBy(aiRequestLogs.organizationId)
    .orderBy(desc(sum(aiRequestLogs.costMicrocents)))
    .limit(limit);

  // The null becomes the named bucket here. See `costByPatient` above.
  return rows.map((row) => ({
    organizationId: row.organizationId ?? PLATFORM_BUCKET,
    calls: Number(row.calls),
    costMicrocents: Number(row.microcents ?? 0),
  }));
}

/**
 * 🔴 49.4 — the consent rate, which C220 calls the single number that says
 * whether the split fee works.
 *
 * Counted over SESSIONS rather than over invoices, because a session that was
 * waived or covered by credit still had a consent answer and still belongs in
 * the denominator. Reading it off the AI fee would report the consent rate of
 * sessions we billed for, which is a different and flattering number.
 *
 * Three buckets, not two: `granted`, `declined`, and the sessions nobody was
 * asked. The third is the one worth watching. A rising "not asked" is a
 * product that has stopped asking, and it would otherwise hide inside
 * "declined" and look like patients saying no.
 */
export async function consentRate(sinceDays = 30, country?: string | null) {
  const since = new Date(Date.now() - sinceDays * 24 * 60 * 60 * 1000);

  const [row] = await db
    .select({
      total: count(),
      granted: sql<number>`COUNT(*) FILTER (WHERE ${sessions.recordingConsent} = 'granted')::int`,
      declined: sql<number>`COUNT(*) FILTER (WHERE ${sessions.recordingConsent} = 'declined')::int`,
      notAsked: sql<number>`COUNT(*) FILTER (WHERE ${sessions.recordingConsent} IS NULL)::int`,
    })
    .from(sessions)
    .where(
      and(
        gte(sessions.createdAt, since),
        eq(sessions.status, "completed"),
        /*
         * 49.10 — the country filter, from the clinician's radar row rather
         * than from the patient: a session belongs to where it was practised,
         * which is the country an operator closed or opened (sprint 50).
         */
        country
          ? sql`EXISTS (SELECT 1 FROM therapist_radar r WHERE r.user_id = ${sessions.therapistId} AND r.country = ${country})`
          : undefined,
      ),
    );

  const total = Number(row?.total ?? 0);
  return {
    total,
    granted: row?.granted ?? 0,
    declined: row?.declined ?? 0,
    notAsked: row?.notAsked ?? 0,
    // Null rather than 0 when there is nothing to divide: "0% consented" and
    // "no sessions yet" are different facts and a dashboard must not conflate
    // them into the alarming one.
    percent: total > 0 ? Math.round(((row?.granted ?? 0) / total) * 100) : null,
  };
}

/**
 * 🔴 49.5 / C222 — revenue, split by source, never summed into one figure.
 *
 * Four numbers, and the reason they stay four is C222: a patient pays their
 * THERAPIST, not us. We earn the platform fee and, when they consent, the AI
 * fee. Reporting what a patient paid as "their revenue" would misdescribe who
 * paid whom, on a screen an investor reads.
 *
 *   platformFees  charged on every session, including declined ones (C209)
 *   aiFees        charged only where the patient turned the AI on
 *   planPurchases credit bought up front
 *   therapistGross what patients paid their clinicians, which is NOT ours
 *
 * The fourth is included precisely so nobody has to go and find it, and
 * labelled so nobody adds it to the other three.
 */
export async function revenueBySource(sinceDays = 30) {
  const since = new Date(Date.now() - sinceDays * 24 * 60 * 60 * 1000);

  const { invoiceLines, invoices, sessionCredits } = await import("@/lib/db/schema");

  const [lines, plans, gross] = await Promise.all([
    db
      .select({
        kind: invoiceLines.kind,
        cents: sum(invoiceLines.amountCents),
      })
      .from(invoiceLines)
      .innerJoin(invoices, eq(invoices.id, invoiceLines.invoiceId))
      .where(gte(invoices.issuedAt, since))
      .groupBy(invoiceLines.kind),

    db
      .select({ cents: sum(sessionCredits.creditCents) })
      .from(sessionCredits)
      .where(and(gte(sessionCredits.createdAt, since), eq(sessionCredits.status, "active"))),

    db
      .select({ cents: sum(sessionPayments.grossCents) })
      .from(sessionPayments)
      .where(gte(sessionPayments.createdAt, since)),
  ]);

  const byKind = new Map(lines.map((row) => [row.kind, Number(row.cents ?? 0)]));

  return {
    platformFeeCents: byKind.get("platform") ?? 0,
    aiFeeCents: byKind.get("ai") ?? 0,
    planPurchaseCents: Number(plans[0]?.cents ?? 0),
    /** 🔴 NOT ours. What patients paid their clinicians. Never summed with the rest. */
    therapistGrossCents: Number(gross[0]?.cents ?? 0),
  };
}
