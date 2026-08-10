import "server-only";

import { and, count, desc, eq, gte, isNull, lt, or, sql } from "drizzle-orm";

import { db } from "@/lib/db";
import {
  organizations,
  sessionFeedback,
  sessionPayments,
  sessionReports,
  sessions,
  therapistRadar,
  users,
} from "@/lib/db/schema";
import { HEARTBEAT_STALE_MS } from "@/lib/data/radar";

/**
 * The whole radar, from above.
 *
 * The public list deliberately hides things: a suspended clinician is absent
 * rather than shown with a reason, an offline one is simply not there, and a
 * demonstration fixture is indistinguishable from a real person. All three of
 * those are right for a patient in crisis and wrong for whoever has to run
 * this — so this is a different query rather than a flag on the other one.
 *
 * It carries no clinical content. Who is online, where, in what state, with
 * what score and what money: nothing a patient said to anybody.
 */

export type CommandRow = {
  userId: string;
  name: string;
  email: string;
  organizationId: string;
  organizationName: string | null;
  country: string | null;
  region: string | null;
  city: string | null;
  languages: string[];
  specialties: string[];
  headline: string | null;
  status: "offline" | "online" | "pending" | "in_session";
  /** True when the heartbeat has lapsed — advertised but probably gone. */
  stale: boolean;
  demo: boolean;
  suspendedUntil: string | null;
  suspendedReason: string | null;
  rateCents: number;
  chargesEnabled: boolean;
  acceptsWalkIns: boolean;
  lastSeenAt: string | null;
  rating: { average: number; count: number } | null;
  sessions30d: number;
  grossCents30d: number;
  feeCents30d: number;
  openReports: number;
};

export type CommandView = {
  rows: CommandRow[];
  totals: {
    online: number;
    booking: number;
    inSession: number;
    offline: number;
    suspended: number;
    demo: number;
    countries: number;
    /** Our cut of radar bookings over the last thirty days, in cents. */
    feeCents30d: number;
    grossCents30d: number;
    sessions30d: number;
    openReports: number;
  };
  /** Ordered by headcount, for the country column. */
  byCountry: { country: string; online: number; total: number }[];
};

export async function radarCommandView(): Promise<CommandView> {
  const since = new Date(Date.now() - 30 * 24 * 3600_000);
  const fresh = new Date(Date.now() - HEARTBEAT_STALE_MS);
  const now = new Date();

  /*
   * One query with correlated subselects rather than five round trips.
   *
   * This endpoint is polled every few seconds by a page that is meant to feel
   * live, so the cost of a fan-out here is paid over and over. Each subselect
   * is indexed on the column it filters.
   */
  const rows = await db
    .select({
      userId: users.id,
      firstName: users.firstName,
      lastName: users.lastName,
      email: users.email,
      organizationId: users.organizationId,
      organizationName: organizations.name,
      rateCents: users.sessionRateCents,
      chargesEnabled: users.chargesEnabled,

      country: therapistRadar.country,
      region: therapistRadar.region,
      city: therapistRadar.city,
      languages: therapistRadar.languages,
      specialties: therapistRadar.specialties,
      headline: therapistRadar.headline,
      status: therapistRadar.status,
      demo: therapistRadar.demo,
      acceptsWalkIns: therapistRadar.acceptsWalkIns,
      suspendedUntil: therapistRadar.suspendedUntil,
      suspendedReason: therapistRadar.suspendedReason,
      lastSeenAt: therapistRadar.lastSeenAt,

      sessions30d: sql<number>`(
        SELECT COUNT(*)::int FROM ${sessions}
        WHERE ${sessions.therapistId} = ${users.id} AND ${sessions.createdAt} >= ${since}
      )`,
      grossCents30d: sql<number>`(
        SELECT COALESCE(SUM(p.gross_cents), 0)::int FROM ${sessionPayments} p
        JOIN ${sessions} s ON s.id = p.session_id
        WHERE s.therapist_id = ${users.id} AND p.created_at >= ${since}
      )`,
      feeCents30d: sql<number>`(
        SELECT COALESCE(SUM(p.platform_fee_cents), 0)::int FROM ${sessionPayments} p
        JOIN ${sessions} s ON s.id = p.session_id
        WHERE s.therapist_id = ${users.id} AND p.created_at >= ${since}
      )`,
      ratingAverage: sql<number | null>`(
        SELECT AVG(f.therapist_stars) FROM ${sessionFeedback} f WHERE f.therapist_id = ${users.id}
      )`,
      ratingCount: sql<number>`(
        SELECT COUNT(*)::int FROM ${sessionFeedback} f WHERE f.therapist_id = ${users.id}
      )`,
      openReports: sql<number>`(
        SELECT COUNT(*)::int FROM ${sessionReports} r
        WHERE r.therapist_id = ${users.id} AND r.status = 'open'
      )`,
    })
    .from(therapistRadar)
    .innerJoin(users, eq(users.id, therapistRadar.userId))
    .leftJoin(organizations, eq(organizations.id, users.organizationId))
    .where(and(isNull(users.deletedAt), eq(users.role, "therapist")))
    .orderBy(
      sql`CASE ${therapistRadar.status} WHEN 'in_session' THEN 0 WHEN 'pending' THEN 1 WHEN 'online' THEN 2 ELSE 3 END`,
      users.firstName,
    )
    .limit(1000);

  const mapped: CommandRow[] = rows.map((row) => {
    const suspended = row.suspendedUntil && row.suspendedUntil > now;
    const stale =
      !row.demo &&
      row.status !== "offline" &&
      (!row.lastSeenAt || row.lastSeenAt < fresh);

    return {
      userId: row.userId,
      name: [row.firstName, row.lastName].filter(Boolean).join(" "),
      email: row.email,
      organizationId: row.organizationId,
      organizationName: row.organizationName,
      country: row.country,
      region: row.region,
      city: row.city,
      languages: row.languages ?? [],
      specialties: row.specialties ?? [],
      headline: row.headline,
      // A suspended clinician reads as offline everywhere, whatever their own
      // toggle says — the ban is the truth about their availability.
      status: suspended ? "offline" : (row.status as CommandRow["status"]),
      stale,
      demo: row.demo,
      suspendedUntil: suspended ? row.suspendedUntil!.toISOString() : null,
      suspendedReason: suspended ? row.suspendedReason : null,
      rateCents: row.rateCents,
      chargesEnabled: row.chargesEnabled,
      acceptsWalkIns: row.acceptsWalkIns,
      lastSeenAt: row.lastSeenAt?.toISOString() ?? null,
      rating:
        Number(row.ratingCount) > 0
          ? {
              average: Math.round(Number(row.ratingAverage ?? 0) * 10) / 10,
              count: Number(row.ratingCount),
            }
          : null,
      sessions30d: Number(row.sessions30d),
      grossCents30d: Number(row.grossCents30d),
      feeCents30d: Number(row.feeCents30d),
      openReports: Number(row.openReports),
    };
  });

  const byCountry = new Map<string, { online: number; total: number }>();
  for (const row of mapped) {
    if (!row.country) continue;
    const entry = byCountry.get(row.country) ?? { online: 0, total: 0 };
    entry.total += 1;
    if (row.status !== "offline") entry.online += 1;
    byCountry.set(row.country, entry);
  }

  return {
    rows: mapped,
    totals: {
      online: mapped.filter((r) => r.status === "online" && !r.stale).length,
      booking: mapped.filter((r) => r.status === "pending").length,
      inSession: mapped.filter((r) => r.status === "in_session").length,
      offline: mapped.filter((r) => r.status === "offline").length,
      suspended: mapped.filter((r) => r.suspendedUntil).length,
      demo: mapped.filter((r) => r.demo).length,
      countries: byCountry.size,
      feeCents30d: mapped.reduce((sum, r) => sum + r.feeCents30d, 0),
      grossCents30d: mapped.reduce((sum, r) => sum + r.grossCents30d, 0),
      sessions30d: mapped.reduce((sum, r) => sum + r.sessions30d, 0),
      openReports: mapped.reduce((sum, r) => sum + r.openReports, 0),
    },
    byCountry: [...byCountry.entries()]
      .map(([country, value]) => ({ country, ...value }))
      .sort((a, b) => b.online - a.online || b.total - a.total),
  };
}

/* ---------------------------------------------------------------- reports -- */

export async function openReports(status: "open" | "actioned" | "dismissed" = "open") {
  return db
    .select({
      id: sessionReports.id,
      sessionId: sessionReports.sessionId,
      kind: sessionReports.kind,
      detail: sessionReports.detail,
      patientEmail: sessionReports.patientEmail,
      status: sessionReports.status,
      resolution: sessionReports.resolution,
      createdAt: sessionReports.createdAt,
      therapistId: sessionReports.therapistId,
      therapistFirst: users.firstName,
      therapistLast: users.lastName,
      therapistEmail: users.email,
      sessionEndedAt: sessions.endedAt,
      sessionDuration: sessions.durationMinutes,
    })
    .from(sessionReports)
    .innerJoin(users, eq(users.id, sessionReports.therapistId))
    .innerJoin(sessions, eq(sessions.id, sessionReports.sessionId))
    .where(eq(sessionReports.status, status))
    .orderBy(desc(sessionReports.createdAt))
    .limit(100);
}

export async function countOpenReports(): Promise<number> {
  const [row] = await db
    .select({ total: count() })
    .from(sessionReports)
    .where(eq(sessionReports.status, "open"));
  return Number(row?.total ?? 0);
}

/**
 * Everything about one reported session, for an investigation.
 *
 * This is the answer to "we need impersonation to look into abuse claims". It
 * is strictly narrower and it is enough: the transcript of the session that was
 * reported, the periods the recording was off, and who was in the room. It is
 * reachable only from a report, so there is no route from here to a chart
 * nobody complained about, and every open writes a break-glass audit row.
 */
export async function investigate(reportId: string) {
  const [report] = await db
    .select({
      id: sessionReports.id,
      sessionId: sessionReports.sessionId,
      kind: sessionReports.kind,
      detail: sessionReports.detail,
      patientEmail: sessionReports.patientEmail,
      createdAt: sessionReports.createdAt,
      therapistId: sessionReports.therapistId,
      therapistName: sql<string>`${users.firstName} || ' ' || ${users.lastName}`,
      startedAt: sessions.startedAt,
      endedAt: sessions.endedAt,
      durationMinutes: sessions.durationMinutes,
      guestName: sessions.guestName,
      patientId: sessions.patientId,
    })
    .from(sessionReports)
    .innerJoin(users, eq(users.id, sessionReports.therapistId))
    .innerJoin(sessions, eq(sessions.id, sessionReports.sessionId))
    .where(eq(sessionReports.id, reportId))
    .limit(1);

  if (!report) return null;

  const { offRecordGaps } = await import("@/lib/data/feedback");
  const { transcriptSegments } = await import("@/lib/db/schema");

  const [gaps, transcript] = await Promise.all([
    offRecordGaps(report.sessionId),
    db
      .select({
        speaker: transcriptSegments.speaker,
        text: transcriptSegments.text,
        startMs: transcriptSegments.startMs,
      })
      .from(transcriptSegments)
      .where(eq(transcriptSegments.sessionId, report.sessionId))
      .orderBy(transcriptSegments.sequence)
      .limit(4000),
  ]);

  return { report, gaps, transcript };
}

/** Clinicians whose heartbeat says one thing and whose status says another. */
export async function staleAdvertised(): Promise<number> {
  const [row] = await db
    .select({ total: count() })
    .from(therapistRadar)
    .where(
      and(
        eq(therapistRadar.demo, false),
        or(eq(therapistRadar.status, "online"), eq(therapistRadar.status, "pending")),
        or(
          isNull(therapistRadar.lastSeenAt),
          lt(therapistRadar.lastSeenAt, new Date(Date.now() - HEARTBEAT_STALE_MS)),
        ),
      ),
    );
  return Number(row?.total ?? 0);
}

/** Used by the overview card to show the board is genuinely live. */
export async function liveSince(): Promise<Date | null> {
  const [row] = await db
    .select({ latest: sql<Date | null>`MAX(${therapistRadar.lastSeenAt})` })
    .from(therapistRadar)
    .where(gte(therapistRadar.lastSeenAt, new Date(Date.now() - 3600_000)));
  return row?.latest ?? null;
}
