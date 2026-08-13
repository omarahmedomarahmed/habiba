import "server-only";

import { and, asc, desc, eq, gte, isNotNull, isNull, lte, or, sql } from "drizzle-orm";

import { db } from "@/lib/db";
import { aiRequestLogs, sessions, users } from "@/lib/db/schema";

/**
 * What was happening, minute by minute, backwards and forwards.
 *
 * The brief asked for a complete minute-by-minute backlog of every session
 * that was ever active, recorded as we go. It turns out not to need recording:
 * a session already stores `started_at` and `ended_at`, and "which sessions
 * were live at 14:32" is a range query over those two columns. Every minute of
 * history is already in the database and always has been.
 *
 * That is worth stating plainly rather than quietly building the table anyway,
 * because a sampled time series would be strictly *worse* than what exists. It
 * would need a writer running every minute — waking the database sixty times
 * an hour, which is the exact bill we spent a day removing — and it would be
 * an approximation: a session that started and ended between two samples would
 * vanish from a record whose whole purpose is that nothing vanishes. Derived
 * from the timestamps, the answer is exact, costs nothing while nobody is
 * asking, and cannot drift from the sessions it describes.
 *
 * The same holds for AI spend per minute: `ai_request_logs.created_at` is
 * already stamped per call, so grouping by minute is a query rather than a
 * pipeline.
 *
 * Nothing here returns transcript text, note content or risk indicators. It
 * answers who, when, how long and how much — the questions an operator or an
 * auditor asks — and deliberately not what was said.
 */

export type LiveSession = {
  sessionId: string;
  therapistId: string;
  therapistName: string;
  patientLabel: string;
  modality: "in_person" | "video";
  startedAt: Date;
  minutesElapsed: number;
  recording: boolean;
  consent: "granted" | "declined" | null;
};

/** Everyone in a session right this second. */
export async function liveNow(): Promise<LiveSession[]> {
  const rows = await db
    .select({
      sessionId: sessions.id,
      therapistId: sessions.therapistId,
      firstName: users.firstName,
      lastName: users.lastName,
      guestName: sessions.guestName,
      modality: sessions.modality,
      startedAt: sessions.startedAt,
      recordingPausedAt: sessions.recordingPausedAt,
      consent: sessions.recordingConsent,
    })
    .from(sessions)
    .innerJoin(users, eq(users.id, sessions.therapistId))
    .where(and(isNotNull(sessions.startedAt), isNull(sessions.endedAt)))
    .orderBy(desc(sessions.startedAt));

  const now = Date.now();
  return rows
    .filter((row) => row.startedAt !== null)
    .map((row) => ({
      sessionId: row.sessionId,
      therapistId: row.therapistId,
      therapistName: `${row.firstName} ${row.lastName}`.trim(),
      patientLabel: row.guestName ?? "Patient",
      modality: row.modality,
      startedAt: row.startedAt!,
      minutesElapsed: Math.floor((now - row.startedAt!.getTime()) / 60_000),
      recording: !row.recordingPausedAt,
      consent: row.consent,
    }));
}

/**
 * Every session that overlapped a given minute.
 *
 * The range test is the whole feature: a session covers a minute when it began
 * at or before it and had not yet ended. `ended_at IS NULL` is included
 * because a session still running covers every minute up to now.
 */
export async function sessionsAtMinute(minute: Date) {
  const edge = new Date(minute.getTime() + 60_000);

  return db
    .select({
      sessionId: sessions.id,
      therapistId: sessions.therapistId,
      firstName: users.firstName,
      lastName: users.lastName,
      patientLabel: sessions.guestName,
      modality: sessions.modality,
      startedAt: sessions.startedAt,
      endedAt: sessions.endedAt,
      status: sessions.status,
    })
    .from(sessions)
    .innerJoin(users, eq(users.id, sessions.therapistId))
    .where(
      and(
        isNotNull(sessions.startedAt),
        lte(sessions.startedAt, edge),
        or(isNull(sessions.endedAt), gte(sessions.endedAt, minute)),
      ),
    )
    .orderBy(asc(sessions.startedAt));
}

export type MinuteBucket = {
  minute: Date;
  liveSessions: number;
  aiCalls: number;
  costMicrocents: number;
  audioSeconds: number;
};

/**
 * The last N hours as one row per minute, with nothing missing.
 *
 * `generate_series` produces every minute in the window whether or not
 * anything happened in it, which matters: a gap in a timeline should be
 * visibly empty rather than absent, or a reader cannot tell "nothing happened"
 * from "we stopped recording".
 *
 * Two lateral aggregates rather than a join, because sessions and AI calls are
 * different cardinalities against the same minute and joining them would
 * multiply one by the other.
 */
export async function minuteTimeline(hours = 6): Promise<MinuteBucket[]> {
  const since = new Date(Date.now() - hours * 60 * 60 * 1000);

  const rows = await db.execute<{
    minute: string;
    live_sessions: number;
    ai_calls: number;
    cost_microcents: string;
    audio_seconds: number;
  }>(sql`
    with minutes as (
      select generate_series(
        date_trunc('minute', ${since}::timestamptz),
        date_trunc('minute', now()),
        interval '1 minute'
      ) as minute
    )
    select
      m.minute,
      (
        select count(*)
        from sessions s
        where s.started_at is not null
          and s.started_at <= m.minute + interval '1 minute'
          and (s.ended_at is null or s.ended_at >= m.minute)
      )::int as live_sessions,
      coalesce(a.calls, 0)::int as ai_calls,
      coalesce(a.microcents, 0) as cost_microcents,
      coalesce(a.audio, 0)::int as audio_seconds
    from minutes m
    left join (
      select
        date_trunc('minute', created_at) as minute,
        count(*) as calls,
        sum(cost_microcents) as microcents,
        sum(audio_seconds) as audio
      from ai_request_logs
      where created_at >= ${since}
      group by 1
    ) a on a.minute = m.minute
    order by m.minute asc
  `);

  return (rows.rows ?? []).map((row) => ({
    minute: new Date(row.minute),
    liveSessions: Number(row.live_sessions ?? 0),
    aiCalls: Number(row.ai_calls ?? 0),
    costMicrocents: Number(row.cost_microcents ?? 0),
    audioSeconds: Number(row.audio_seconds ?? 0),
  }));
}

/** Concurrency peak — what capacity has actually had to carry. */
export async function peakConcurrency(hours = 24) {
  const buckets = await minuteTimeline(hours);
  const peak = buckets.reduce<MinuteBucket | null>(
    (best, row) => (!best || row.liveSessions > best.liveSessions ? row : best),
    null,
  );
  return {
    peakSessions: peak?.liveSessions ?? 0,
    at: peak?.minute ?? null,
    minutesWithActivity: buckets.filter((row) => row.liveSessions > 0).length,
  };
}
