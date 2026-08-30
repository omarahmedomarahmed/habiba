import "server-only";

import { and, desc, eq, gte, inArray, isNotNull, isNull, or, sql } from "drizzle-orm";

import { db } from "@/lib/db";
import {
  auditLog,
  copilotMessages,
  copilotThreads,
  patients,
  riskAssessments,
  sessionFeedback,
  sessionNotes,
  sessions,
  therapistRadar,
  users,
} from "@/lib/db/schema";

/**
 * Read-only queries, unscoped by organisation.
 *
 * Every function here is a SELECT. Nothing in this module writes.
 */

/* --------------------------------------------------------------- now -- */

export async function liveSessions() {
  return db
    .select({
      id: sessions.id,
      startedAt: sessions.startedAt,
      extendedAt: sessions.extendedAt,
      modality: sessions.modality,
      guestName: sessions.guestName,
      patientFirstName: patients.firstName,
      patientLastName: patients.lastName,
      patientEmail: patients.email,
      guestEmail: sessions.guestEmail,
      therapistFirstName: users.firstName,
      therapistLastName: users.lastName,
      therapistEmail: users.email,
      recordingPausedAt: sessions.recordingPausedAt,
      segments: sql<number>`(
        SELECT count(*)::int FROM transcript_segments t WHERE t.session_id = ${sessions}."id"
      )`,
      lastActivityAt: sql<Date | null>`(
        SELECT max(t.created_at) FROM transcript_segments t WHERE t.session_id = ${sessions}."id"
      )`,
    })
    .from(sessions)
    .innerJoin(users, eq(users.id, sessions.therapistId))
    .leftJoin(patients, eq(patients.id, sessions.patientId))
    .where(eq(sessions.status, "in_progress"))
    .orderBy(desc(sessions.startedAt))
    .limit(100);
}

export async function radarNow() {
  const now = new Date();
  return db
    .select({
      userId: users.id,
      firstName: users.firstName,
      lastName: users.lastName,
      email: users.email,
      status: therapistRadar.status,
      country: therapistRadar.country,
      city: therapistRadar.city,
      lastSeenAt: therapistRadar.lastSeenAt,
      suspendedUntil: therapistRadar.suspendedUntil,
      rateCents: users.sessionRateCents,
      demo: therapistRadar.demo,
    })
    .from(therapistRadar)
    .innerJoin(users, eq(users.id, therapistRadar.userId))
    .where(
      or(
        eq(therapistRadar.demo, true),
        gte(therapistRadar.lastSeenAt, new Date(now.getTime() - 15 * 60_000)),
        isNotNull(therapistRadar.suspendedUntil),
      ),
    )
    .orderBy(desc(therapistRadar.lastSeenAt))
    .limit(200);
}

/* ---------------------------------------------------------- timeline -- */

export type TimelineEvent = {
  at: Date;
  kind: string;
  who: string;
  what: string;
  ref: string | null;
};

/**
 * One ordered stream, assembled from the tables that carry a timestamp.
 *
 * `UNION ALL` over five sources rather than five round trips, ordered once in
 * the database. `sinceHours` bounds it; `limit` bounds it again.
 */
export async function timeline(opts: { sinceHours?: number; limit?: number } = {}) {
  const since = new Date(Date.now() - (opts.sinceHours ?? 24) * 3600_000);
  const limit = Math.min(1000, opts.limit ?? 400);

  const rows = await db.execute<{
    at: string;
    kind: string;
    who: string;
    what: string;
    ref: string | null;
  }>(sql`
    SELECT * FROM (
      SELECT s.started_at AS at, 'session.start' AS kind,
             concat_ws(' ', u.first_name, u.last_name) AS who,
             concat('Session started with ', coalesce(p.first_name, s.guest_name, 'a patient')) AS what,
             s.id::text AS ref
        FROM sessions s
        JOIN users u ON u.id = s.therapist_id
        LEFT JOIN patients p ON p.id = s.patient_id
       WHERE s.started_at IS NOT NULL AND s.started_at >= ${since}

      UNION ALL
      SELECT s.ended_at, 'session.end',
             concat_ws(' ', u.first_name, u.last_name),
             concat('Session ended after ', coalesce(s.duration_minutes, 0), ' min',
                    CASE WHEN s.auto_ended_reason IS NOT NULL
                         THEN concat(' (', s.auto_ended_reason, ')') ELSE '' END),
             s.id::text
        FROM sessions s
        JOIN users u ON u.id = s.therapist_id
       WHERE s.ended_at IS NOT NULL AND s.ended_at >= ${since}

      UNION ALL
      SELECT n.approved_at, 'note.sign',
             concat_ws(' ', u.first_name, u.last_name),
             'Clinical note signed', n.session_id::text
        FROM session_notes n
        JOIN users u ON u.id = n.therapist_id
       WHERE n.approved_at IS NOT NULL AND n.approved_at >= ${since}

      UNION ALL
      SELECT n.patient_approved_at, 'note.release',
             concat_ws(' ', u.first_name, u.last_name),
             'Patient summary released', n.session_id::text
        FROM session_notes n
        JOIN users u ON u.id = n.therapist_id
       WHERE n.patient_approved_at IS NOT NULL AND n.patient_approved_at >= ${since}

      UNION ALL
      SELECT m.created_at, concat('copilot.', m.role),
             concat_ws(' ', u.first_name, u.last_name),
             concat(left(m.content, 140), CASE WHEN length(m.content) > 140 THEN '…' ELSE '' END),
             t.patient_id::text
        FROM copilot_messages m
        JOIN copilot_threads t ON t.id = m.thread_id
        JOIN users u ON u.id = t.therapist_id
       WHERE m.created_at >= ${since}

      UNION ALL
      SELECT r.created_at, 'risk',
             concat_ws(' ', u.first_name, u.last_name),
             concat('Risk ', r.level, coalesce(concat(' — ', left(r.recommended_action, 100)), '')),
             r.session_id::text
        FROM risk_assessments r
        JOIN users u ON u.id = r.therapist_id
       WHERE r.created_at >= ${since} AND r.level <> 'none'

      UNION ALL
      SELECT f.created_at, 'rating',
             concat_ws(' ', u.first_name, u.last_name),
             concat(coalesce(f.therapist_stars, 0), '/5',
                    coalesce(concat(' — ', left(f.comment, 120)), '')),
             f.session_id::text
        FROM session_feedback f
        JOIN users u ON u.id = f.therapist_id
       WHERE f.created_at >= ${since} AND f.therapist_stars IS NOT NULL
    ) e
    ORDER BY at DESC
    LIMIT ${limit}
  `);

  return (rows.rows as Record<string, string>[]).map((row) => ({
    at: new Date(row.at!),
    kind: row.kind!,
    who: row.who || "—",
    what: row.what!,
    ref: row.ref ?? null,
  })) satisfies TimelineEvent[];
}

/* ------------------------------------------------------------ people -- */

/**
 * People, keyed by email, across every clinician who has seen them.
 *
 * An email address is the only identifier that survives a person being entered
 * separately by two clinicians in two organisations. Rows without one are
 * grouped by their own patient id instead so they are still listed rather than
 * collapsed together.
 */
export async function peopleByEmail(query?: string) {
  const term = query?.trim().toLowerCase();

  const rows = await db.execute<{
    key: string;
    email: string | null;
    names: string;
    patient_ids: string[];
    therapists: string;
    sessions: number;
    messages: number;
    last_seen: string | null;
  }>(sql`
    SELECT
      coalesce(lower(p.email), p.id::text) AS key,
      lower(p.email) AS email,
      string_agg(DISTINCT concat_ws(' ', p.first_name, p.last_name), ' · ') AS names,
      array_agg(DISTINCT p.id::text) AS patient_ids,
      string_agg(DISTINCT concat_ws(' ', u.first_name, u.last_name), ' · ') AS therapists,
      (SELECT count(*)::int FROM sessions s2 WHERE s2.patient_id = ANY(array_agg(p.id))) AS sessions,
      (SELECT count(*)::int FROM copilot_messages m2
         JOIN copilot_threads t2 ON t2.id = m2.thread_id
        WHERE t2.patient_id = ANY(array_agg(p.id))) AS messages,
      max(p.updated_at)::text AS last_seen
      FROM patients p
      JOIN users u ON u.id = p.therapist_id
     WHERE p.deleted_at IS NULL
       ${term ? sql`AND (lower(p.email) LIKE ${"%" + term + "%"} OR lower(concat_ws(' ', p.first_name, p.last_name)) LIKE ${"%" + term + "%"})` : sql``}
     GROUP BY coalesce(lower(p.email), p.id::text), lower(p.email)
     ORDER BY max(p.updated_at) DESC
     LIMIT 200
  `);

  return (rows.rows as Record<string, unknown>[]).map((row) => ({
    key: String(row.key),
    email: (row.email as string | null) ?? null,
    names: String(row.names ?? ""),
    patientIds: (row.patient_ids as string[]) ?? [],
    therapists: String(row.therapists ?? ""),
    sessionCount: Number(row.sessions ?? 0),
    messageCount: Number(row.messages ?? 0),
    lastSeen: row.last_seen ? new Date(String(row.last_seen)) : null,
  }));
}

/** Every copilot exchange about one person, across clinicians, in order. */
export async function conversationFor(patientIds: string[]) {
  if (patientIds.length === 0) return [];
  return db
    .select({
      id: copilotMessages.id,
      role: copilotMessages.role,
      content: copilotMessages.content,
      createdAt: copilotMessages.createdAt,
      therapistFirstName: users.firstName,
      therapistLastName: users.lastName,
      therapistEmail: users.email,
      patientId: copilotThreads.patientId,
    })
    .from(copilotMessages)
    .innerJoin(copilotThreads, eq(copilotThreads.id, copilotMessages.threadId))
    .innerJoin(users, eq(users.id, copilotThreads.therapistId))
    // `inArray`, never a built string: these ids arrive from a grouped read
    // and must still reach the database as bound parameters.
    .where(inArray(copilotThreads.patientId, patientIds))
    .orderBy(copilotMessages.createdAt)
    .limit(1000);
}

/** Every session for one person, across clinicians. */
export async function sessionsFor(patientIds: string[]) {
  if (patientIds.length === 0) return [];
  return db
    .select({
      id: sessions.id,
      status: sessions.status,
      modality: sessions.modality,
      startedAt: sessions.startedAt,
      endedAt: sessions.endedAt,
      durationMinutes: sessions.durationMinutes,
      autoEndedReason: sessions.autoEndedReason,
      priceCents: sessions.priceCents,
      paymentStatus: sessions.paymentStatus,
      therapistFirstName: users.firstName,
      therapistLastName: users.lastName,
      noteStatus: sessionNotes.status,
      patientStatus: sessionNotes.patientStatus,
      summary: sql<string | null>`${sessionNotes.content}->>'summary'`,
    })
    .from(sessions)
    .innerJoin(users, eq(users.id, sessions.therapistId))
    .leftJoin(sessionNotes, eq(sessionNotes.sessionId, sessions.id))
    .where(inArray(sessions.patientId, patientIds))
    .orderBy(desc(sessions.createdAt))
    .limit(300);
}

/** One session in full. */
export async function sessionDetail(sessionId: string) {
  const [row] = await db
    .select({
      session: sessions,
      note: sessionNotes,
      therapistFirstName: users.firstName,
      therapistLastName: users.lastName,
      therapistEmail: users.email,
      patientFirstName: patients.firstName,
      patientLastName: patients.lastName,
      patientEmail: patients.email,
    })
    .from(sessions)
    .innerJoin(users, eq(users.id, sessions.therapistId))
    .leftJoin(sessionNotes, eq(sessionNotes.sessionId, sessions.id))
    .leftJoin(patients, eq(patients.id, sessions.patientId))
    .where(eq(sessions.id, sessionId))
    .limit(1);

  if (!row) return null;

  const transcript = await db.execute<{ id: string; speaker: string; text: string; start_ms: number }>(
    sql`SELECT id::text, speaker, text, start_ms FROM transcript_segments
         WHERE session_id = ${sessionId} ORDER BY sequence LIMIT 2000`,
  );

  const risks = await db
    .select()
    .from(riskAssessments)
    .where(eq(riskAssessments.sessionId, sessionId))
    .orderBy(desc(riskAssessments.createdAt))
    .limit(20);

  return { ...row, transcript: transcript.rows as Record<string, unknown>[], risks };
}

/* ------------------------------------------------------------ counts -- */

export async function counts() {
  const [row] = await db
    .select({
      clinicians: sql<number>`(SELECT count(*)::int FROM users WHERE role = 'therapist' AND deleted_at IS NULL)`,
      people: sql<number>`(SELECT count(*)::int FROM patients WHERE deleted_at IS NULL)`,
      sessions: sql<number>`(SELECT count(*)::int FROM sessions)`,
      live: sql<number>`(SELECT count(*)::int FROM sessions WHERE status = 'in_progress')`,
      notes: sql<number>`(SELECT count(*)::int FROM session_notes)`,
      messages: sql<number>`(SELECT count(*)::int FROM copilot_messages)`,
      online: sql<number>`(SELECT count(*)::int FROM therapist_radar WHERE status <> 'offline')`,
    })
    .from(sql`(SELECT 1) AS one`);
  return row!;
}

/** The audit stream, unfiltered by organisation. */
export async function auditStream(limit = 200) {
  return db
    .select({
      id: auditLog.id,
      createdAt: auditLog.createdAt,
      category: auditLog.category,
      action: auditLog.action,
      resourceType: auditLog.resourceType,
      resourceId: auditLog.resourceId,
      reason: auditLog.reason,
      actorFirstName: users.firstName,
      actorLastName: users.lastName,
      actorEmail: users.email,
    })
    .from(auditLog)
    .leftJoin(users, eq(users.id, auditLog.actorUserId))
    .orderBy(desc(auditLog.createdAt))
    .limit(limit);
}

/** Clinicians, with the numbers that describe them. */
export async function clinicianRoster() {
  return db
    .select({
      id: users.id,
      firstName: users.firstName,
      lastName: users.lastName,
      email: users.email,
      status: users.status,
      verificationStatus: users.verificationStatus,
      createdAt: users.createdAt,
      lastLoginAt: users.lastLoginAt,
      organizationId: users.organizationId,
      sessionCount: sql<number>`(SELECT count(*)::int FROM sessions s WHERE s.therapist_id = ${users}."id")`,
      patientCount: sql<number>`(SELECT count(*)::int FROM patients p WHERE p.therapist_id = ${users}."id" AND p.deleted_at IS NULL)`,
    })
    .from(users)
    .where(and(eq(users.role, "therapist"), isNull(users.deletedAt)))
    .orderBy(desc(users.createdAt))
    .limit(500);
}
