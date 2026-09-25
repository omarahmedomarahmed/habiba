import "server-only";

import { and, count, desc, eq, gte, ilike, isNull, or, sql } from "drizzle-orm";

import { likePattern } from "@/lib/admin/paging";

import { dbFor} from "@/lib/db";
import { qualified } from "@/lib/db/qualified";
import { pinnedToDefaultRegion } from "@/lib/db/region";
import {
  aiRequestLogs,
  auditLog,
  clinicManagers,
  copilotMessages,
  copilotThreads,
  organizations,
  patients,
  invoices,
  sessions,
  sponsorUsers,
  subscriptions,
  transcriptSegments,
  users,
} from "@/lib/db/schema";

/*
 * ⚠️ 30.1 — NOT ROUTED YET, and counted rather than hidden.
 *
 * `pinnedToDefaultRegion` returns the default region and registers this
 * module so `verify:sprint30` can print it. The alternative, `dbFor("us")`
 * with a comment, compiles and is indistinguishable from a decision, which
 * is the "seam by convention" this sprint exists to prevent.
 */
const db = dbFor(pinnedToDefaultRegion("lib/data/admin.ts", "not routed yet: this call site has no entity in hand, so 30.x threads one"));


/**
 * Admin reads. Cross-organisation by definition, so every function in this file
 * must only ever be called behind `requireRole("super_admin")`.
 *
 * Note what is not here: user impersonation. The old console could mint a token
 * as any user, but never recorded it — the audit insert named columns that did
 * not exist and swallowed the failure, so impersonation was untraceable. An
 * untraceable "become this clinician" button over a chart of therapy
 * transcripts is not a feature worth rebuilding.
 */

export async function platformStats() {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  /*
   * 🔴 B26: `users` is not a list of clinicians, and an organisation is not
   * a practice. Every back office account (staff, managers, the founders) is a
   * `users` row with a solo organisation of its own, so the bare counts put
   * the whole console team on the overview as clinicians running practices.
   * A practice is a clinic, or a solo organisation somebody practises in.
   */
  const [orgs] = await db
    .select({ value: count() })
    .from(organizations)
    .where(
      and(
        isNull(organizations.deletedAt),
        or(
          eq(organizations.kind, "clinic"),
          sql`exists (select 1 from ${users} where ${users.organizationId} = ${organizations.id} and ${users.role} = 'therapist' and ${users.deletedAt} is null)`,
        ),
      ),
    );
  const [clinicians] = await db
    .select({ value: count() })
    .from(users)
    .where(and(isNull(users.deletedAt), eq(users.role, "therapist")));
  const [charts] = await db.select({ value: count() }).from(patients).where(isNull(patients.deletedAt));
  const [completed] = await db
    .select({ value: count() })
    .from(sessions)
    .where(and(eq(sessions.status, "completed"), gte(sessions.createdAt, thirtyDaysAgo)));

  const [ai] = await db
    .select({
      calls: count(),
      /*
       * 🔴 C279 — `cost_microcents`, never `cost_cents`.
       *
       * This summed the lossy column while `lib/data/vault.ts` summed the
       * precise one, so two admin screens reported different totals for the
       * same calls, in production, for four sprints. Measured: 6 cents against
       * 4, over twelve calls, six of them rounded to zero.
       *
       * The error runs BOTH ways, which is why neither screen looked wrong.
       * `Math.round(microcents / 1000)` per row sends a 0.6c call up to 1c and
       * a 0.4c call down to 0, so this figure was higher than the truth on
       * medium calls and lower on tiny ones. Rounding once, at the end, is the
       * only version that is merely imprecise rather than biased.
       */
      costCents: sql<number>`ROUND(COALESCE(SUM(${aiRequestLogs.costMicrocents}), 0) / 1000.0)::int`,
      errors: sql<number>`COALESCE(SUM(CASE WHEN ${aiRequestLogs.status} = 'error' THEN 1 ELSE 0 END), 0)::int`,
    })
    .from(aiRequestLogs)
    .where(gte(aiRequestLogs.createdAt, thirtyDaysAgo));

  const [revenue] = await db
    .select({
      collectedCents: sql<number>`COALESCE(SUM(CASE WHEN ${invoices.status} = 'paid' THEN ${invoices.amountCents} ELSE 0 END), 0)::int`,
      pendingCents: sql<number>`COALESCE(SUM(CASE WHEN ${invoices.status} = 'pending' THEN ${invoices.amountCents} ELSE 0 END), 0)::int`,
    })
    .from(invoices)
    .where(gte(invoices.issuedAt, thirtyDaysAgo));

  return {
    organizations: orgs?.value ?? 0,
    clinicians: clinicians?.value ?? 0,
    patients: charts?.value ?? 0,
    sessions30d: completed?.value ?? 0,
    aiCalls30d: ai?.calls ?? 0,
    aiCostCents30d: ai?.costCents ?? 0,
    aiErrors30d: ai?.errors ?? 0,
    collectedCents30d: revenue?.collectedCents ?? 0,
    pendingCents30d: revenue?.pendingCents ?? 0,
  };
}

export async function listClinicians() {
  return db
    .select({
      id: users.id,
      email: users.email,
      firstName: users.firstName,
      lastName: users.lastName,
      role: users.role,
      status: users.status,
      verificationStatus: users.verificationStatus,
      createdAt: users.createdAt,
      lastLoginAt: users.lastLoginAt,
      organizationName: organizations.name,
      plan: subscriptions.plan,
      sessionCount: sql<number>`(
        SELECT count(*)::int FROM ${sessions}
        WHERE ${sessions.therapistId} = ${qualified(users.id)} AND ${sessions.status} = 'completed'
      )`,
    })
    .from(users)
    .innerJoin(organizations, eq(organizations.id, users.organizationId))
    .leftJoin(subscriptions, eq(subscriptions.organizationId, users.organizationId))
    .where(isNull(users.deletedAt))
    .orderBy(desc(users.createdAt))
    .limit(200);
}

export async function setUserStatus(userId: string, status: "active" | "suspended") {
  await db.update(users).set({ status, updatedAt: new Date() }).where(eq(users.id, userId));
}

/**
 * The audit trail. Deliberately does not join to patients: an administrator
 * reviewing who accessed what does not need the patient's name to do it, and
 * putting it on this screen would make the compliance tool itself a source of
 * casual PHI exposure.
 */
export async function listAuditLog(
  opts: {
    category?: string;
    limit?: number;
    /** 🔴 W2-A09: the page, and a search over action, reason, resource and who did it. */
    offset?: number;
    q?: string | null;
  } = {},
) {
  const pattern = opts.q ? likePattern(opts.q) : null;
  const where = and(
    opts.category ? eq(auditLog.category, opts.category as never) : undefined,
    pattern
      ? or(
          ilike(auditLog.action, pattern),
          ilike(auditLog.reason, pattern),
          ilike(auditLog.resourceKey, pattern),
          ilike(users.email, pattern),
          ilike(sponsorUsers.email, pattern),
          ilike(clinicManagers.email, pattern),
          sql`${auditLog.resourceId}::text = ${opts.q}`,
          sql`${auditLog.patientId}::text = ${opts.q}`,
        )
      : undefined,
  );

  return db
    .select({
      id: auditLog.id,
      category: auditLog.category,
      action: auditLog.action,
      resourceType: auditLog.resourceType,
      resourceId: auditLog.resourceId,
      /* W2-A09: the reason was written on every row and shown on none. */
      reason: auditLog.reason,
      resourceKey: auditLog.resourceKey,
      patientId: auditLog.patientId,
      createdAt: auditLog.createdAt,
      ipAddress: auditLog.ipAddress,
      actorEmail: users.email,
      /*
       * 🔴 0086 — THE OTHER TWO PRINCIPALS, or this screen renders them blank.
       *
       * A sponsor user and a clinic manager can now write to this table. If the
       * reader still joined only `users`, every one of their rows would arrive
       * with `actorEmail: null` and show as an act nobody performed, which is
       * worse than not recording it: the operator would read "somebody ended
       * this benefit" off a screen that had the answer and did not select it.
       *
       * Separate columns rather than a coalesce, so the screen can say WHICH
       * kind of principal it was. "ahmed@acme.com" means nothing without
       * knowing whether that is our operator, their HR admin or their practice
       * manager, and those three have very different authority.
       */
      sponsorActorEmail: sponsorUsers.email,
      clinicActorEmail: clinicManagers.email,
      organizationName: organizations.name,
    })
    .from(auditLog)
    .leftJoin(users, eq(users.id, auditLog.actorUserId))
    .leftJoin(sponsorUsers, eq(sponsorUsers.id, auditLog.actorSponsorUserId))
    .leftJoin(clinicManagers, eq(clinicManagers.id, auditLog.actorClinicManagerId))
    .leftJoin(organizations, eq(organizations.id, auditLog.organizationId))
    .where(where)
    .orderBy(desc(auditLog.createdAt))
    .limit(opts.limit ?? 100)
    .offset(opts.offset ?? 0);
}

/* ------------------------------------------------- one clinician, in full -- */

/**
 * The administrator's view of a single clinician.
 *
 * Where the PHI line is drawn, and why it is drawn there:
 *
 *  - **Shown:** who their patients are (name, email), when sessions happened,
 *    how long they ran, whether a note exists, how much copilot they use, and
 *    every penny in both directions. An operator has to be able to answer
 *    "this therapist says they were charged twice" and "is this account real",
 *    and cannot do either blind.
 *
 *  - **Never shown, by construction:** transcript text, note content, risk
 *    indicators, copilot messages. Not hidden behind a toggle — the queries
 *    below do not select those columns, so there is no admin screen from which
 *    a session can be read. That is the difference between a policy and a
 *    guarantee.
 *
 * Every call site writes a `break_glass` audit entry. Looking at someone's
 * caseload is a thing that should leave a mark.
 */
export async function therapistOverview(userId: string) {
  const [row] = await db
    .select({
      id: users.id,
      email: users.email,
      firstName: users.firstName,
      lastName: users.lastName,
      role: users.role,
      status: users.status,
      verificationStatus: users.verificationStatus,
      profile: users.profile,
      createdAt: users.createdAt,
      lastLoginAt: users.lastLoginAt,
      organizationId: users.organizationId,
      organizationName: organizations.name,
      stripeAccountId: users.stripeAccountId,
      chargesEnabled: users.chargesEnabled,
      payoutsEnabled: users.payoutsEnabled,
      sessionRateCents: users.sessionRateCents,
      plan: subscriptions.plan,
      subscriptionStatus: subscriptions.status,
    })
    .from(users)
    .innerJoin(organizations, eq(organizations.id, users.organizationId))
    .leftJoin(subscriptions, eq(subscriptions.organizationId, users.organizationId))
    .where(and(eq(users.id, userId), isNull(users.deletedAt)))
    .limit(1);

  return row ?? null;
}

/** Their caseload. Identifiers only — nothing clinical is selected. */
export async function therapistPatients(userId: string) {
  return db
    .select({
      id: patients.id,
      firstName: patients.firstName,
      lastName: patients.lastName,
      email: patients.email,
      phone: patients.phone,
      source: patients.source,
      createdAt: patients.createdAt,
      lastSessionAt: patients.lastSessionAt,
      /*
       * The outer column is qualified by hand, and it has to be.
       *
       * Drizzle only prefixes column names with their table when the query has
       * a join to disambiguate. This select reads from `patients` alone, so it
       * emitted every column bare — and inside a correlated subquery, a bare
       * name binds to the *innermost* scope that has one.
       *
       * That produced two different failures from one cause. `sessionCount`
       * resolved `id` to `sessions.id` and quietly counted the sessions whose
       * patient_id equals their own id, which is none of them: every clinician's
       * patient list showed zero sessions and nothing looked broken. The
       * copilot count had two inner tables carrying an `id`, so Postgres could
       * not choose at all and the whole clinician page 500'd.
       *
       * `${patients}` interpolates the table name, so this stays correct if the
       * table is ever renamed, and no longer depends on how Drizzle decides to
       * qualify.
       */
      sessionCount: sql<number>`(
        SELECT count(*)::int FROM ${sessions} s
        WHERE s.patient_id = ${patients}."id" AND s.status = 'completed'
      )`,
      copilotMessages: sql<number>`(
        SELECT count(*)::int FROM ${copilotMessages} m
        JOIN ${copilotThreads} t ON t.id = m.thread_id
        WHERE t.patient_id = ${patients}."id" AND m.role = 'therapist'
      )`,
    })
    .from(patients)
    .where(and(eq(patients.therapistId, userId), isNull(patients.deletedAt)))
    .orderBy(desc(patients.lastSessionAt), desc(patients.createdAt))
    .limit(300);
}

/**
 * Session history: when, how long, what state.
 *
 * `noteStatus` is here and note *content* is not, deliberately — an operator
 * needs to know a note failed to generate; they do not need to read it.
 */
export async function therapistSessions(userId: string, limit = 200) {
  return db
    .select({
      id: sessions.id,
      status: sessions.status,
      modality: sessions.modality,
      noteStatus: sessions.noteStatus,
      createdAt: sessions.createdAt,
      startedAt: sessions.startedAt,
      endedAt: sessions.endedAt,
      durationMinutes: sessions.durationMinutes,
      priceCents: sessions.priceCents,
      paymentStatus: sessions.paymentStatus,
      reportSentAt: sessions.reportSentAt,
      patientFirstName: patients.firstName,
      patientLastName: patients.lastName,
      guestName: sessions.guestName,
      segmentCount: sql<number>`(
        SELECT count(*)::int FROM ${transcriptSegments}
        WHERE ${transcriptSegments.sessionId} = ${qualified(sessions.id)}
      )`,
    })
    .from(sessions)
    .leftJoin(patients, eq(patients.id, sessions.patientId))
    .where(eq(sessions.therapistId, userId))
    .orderBy(desc(sessions.createdAt))
    .limit(limit);
}

/** Copilot activity: volume and recency, never a single word of content. */
export async function therapistCopilotUsage(userId: string) {
  const startOfMonth = new Date();
  startOfMonth.setUTCDate(1);
  startOfMonth.setUTCHours(0, 0, 0, 0);

  const threads = await db
    .select({
      threadId: copilotThreads.id,
      patientFirstName: patients.firstName,
      patientLastName: patients.lastName,
      lastMessageAt: copilotThreads.lastMessageAt,
      asked: sql<number>`(
        SELECT count(*)::int FROM ${copilotMessages}
        WHERE ${copilotMessages.threadId} = ${qualified(copilotThreads.id)}
          AND ${copilotMessages.role} = 'therapist'
      )`,
      askedThisMonth: sql<number>`(
        SELECT count(*)::int FROM ${copilotMessages}
        WHERE ${copilotMessages.threadId} = ${qualified(copilotThreads.id)}
          AND ${copilotMessages.role} = 'therapist'
          AND ${copilotMessages.createdAt} >= ${startOfMonth.toISOString()}
      )`,
      corrections: sql<number>`(
        SELECT count(*)::int FROM ${copilotMessages}
        WHERE ${copilotMessages.threadId} = ${qualified(copilotThreads.id)}
          AND ${copilotMessages.role} = 'correction'
      )`,
    })
    .from(copilotThreads)
    .innerJoin(patients, eq(patients.id, copilotThreads.patientId))
    .where(eq(copilotThreads.therapistId, userId))
    .orderBy(desc(copilotThreads.lastMessageAt))
    .limit(200);

  return threads;
}

/** What their AI usage has actually cost us, by purpose. */
export async function therapistAiSpend(userId: string) {
  const rows = await db
    .select({
      kind: aiRequestLogs.kind,
      calls: count(),
      // C279 — the precise column. See the first of these, above.
      costCents: sql<number>`ROUND(COALESCE(SUM(${aiRequestLogs.costMicrocents}), 0) / 1000.0)::int`,
      errors: sql<number>`COALESCE(SUM(CASE WHEN ${aiRequestLogs.status} = 'error' THEN 1 ELSE 0 END), 0)::int`,
    })
    .from(aiRequestLogs)
    .where(eq(aiRequestLogs.userId, userId))
    .groupBy(aiRequestLogs.kind);

  return rows;
}

/** Every therapist's email, for an announcement. */
export async function allTherapistRecipients() {
  return db
    .select({
      id: users.id,
      email: users.email,
      firstName: users.firstName,
      lastName: users.lastName,
    })
    .from(users)
    .where(and(isNull(users.deletedAt), eq(users.status, "active"), eq(users.role, "therapist")))
    .orderBy(users.email);
}

export async function aiUsageByDay(days = 14) {
  return db
    .select({
      day: sql<string>`to_char(date_trunc('day', ${aiRequestLogs.createdAt}), 'YYYY-MM-DD')`,
      calls: count(),
      // C279 — the precise column. See the first of these, above.
      costCents: sql<number>`ROUND(COALESCE(SUM(${aiRequestLogs.costMicrocents}), 0) / 1000.0)::int`,
    })
    .from(aiRequestLogs)
    .where(gte(aiRequestLogs.createdAt, new Date(Date.now() - days * 24 * 60 * 60 * 1000)))
    .groupBy(sql`date_trunc('day', ${aiRequestLogs.createdAt})`)
    .orderBy(sql`date_trunc('day', ${aiRequestLogs.createdAt}) DESC`);
}

/**
 * 🔴 A12: every clinician, with their practice, for the same picker.
 *
 * Deleted and suspended clinicians are kept, unlike the organisations above:
 * a clinician who left can still be owed money, and correcting what we hold
 * for them is exactly when somebody opens the escape hatch.
 */
export async function adjustableClinicians(): Promise<
  { id: string; name: string; organizationId: string }[]
> {
  const rows = await db
    .select({
      id: users.id,
      firstName: users.firstName,
      lastName: users.lastName,
      organizationId: users.organizationId,
    })
    .from(users)
    .where(eq(users.role, "therapist"))
    .orderBy(users.firstName, users.lastName);
  return rows.map((row) => ({
    id: row.id,
    name: `${row.firstName} ${row.lastName}`.trim(),
    organizationId: row.organizationId,
  }));
}

/**
 * Every organisation, for a picker. 58.1.
 *
 * Added with `LedgerAdjust`, which is the escape hatch's screen. Deleted rows
 * are excluded: an adjustment against an organisation nobody can reach any more
 * is a correction nobody will be able to explain.
 */
export async function allOrganizations(): Promise<{ id: string; name: string }[]> {
  return db
    .select({ id: organizations.id, name: organizations.name })
    .from(organizations)
    .where(isNull(organizations.deletedAt))
    .orderBy(organizations.name);
}
