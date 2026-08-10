import "server-only";

import { and, avg, count, desc, eq, isNull, sql } from "drizzle-orm";

import { db } from "@/lib/db";
import {
  patients,
  sessionFeedback,
  sessionNotes,
  sessionReports,
  sessions,
  therapistRadar,
  users,
  type ReportKind,
} from "@/lib/db/schema";
import { log } from "@/lib/logger";

/**
 * The patient's side of a finished session.
 *
 * The design is one decision: the brief is the *reward* for the feedback, not
 * a thing we send and then beg for a rating afterwards. A "how did we do?"
 * email gets eight percent; a form standing between someone and the summary
 * they actually want gets nearly everyone. It also collects the email address
 * at the moment somebody wants to give it rather than before they have had any
 * help — which is the only moment it is honest to ask.
 *
 * Reached with the join token the patient already holds, so there is no
 * account, no password and no second link to lose.
 */

export const FEEDBACK_WINDOW_HOURS = 72;

export type FeedbackContext = {
  sessionId: string;
  therapistFirstName: string;
  therapistName: string;
  sessionDate: Date;
  /** Already given — the page shows the brief instead of the form. */
  done: boolean;
  brief: string | null;
  briefLanguage: string;
  /** Null while the clinician has not finished writing it up. */
  notePending: boolean;
  paidCents: number;
};

export async function feedbackContext(token: string): Promise<FeedbackContext | null> {
  if (!token || token.length < 16) return null;

  const [row] = await db
    .select({
      sessionId: sessions.id,
      endedAt: sessions.endedAt,
      createdAt: sessions.createdAt,
      status: sessions.status,
      priceCents: sessions.priceCents,
      paymentStatus: sessions.paymentStatus,
      therapistFirst: users.firstName,
      therapistLast: users.lastName,
      noteContent: sessionNotes.content,
      noteLanguage: sessionNotes.language,
      noteStatus: sessionNotes.status,
      feedbackId: sessionFeedback.id,
    })
    .from(sessions)
    .innerJoin(users, eq(users.id, sessions.therapistId))
    .leftJoin(sessionNotes, eq(sessionNotes.sessionId, sessions.id))
    .leftJoin(sessionFeedback, eq(sessionFeedback.sessionId, sessions.id))
    .where(eq(sessions.joinToken, token))
    .limit(1);

  if (!row) return null;

  const ended = row.endedAt ?? row.createdAt;
  if (Date.now() - ended.getTime() > FEEDBACK_WINDOW_HOURS * 3600_000) return null;

  /*
   * The brief is only shown once the clinician has signed the note.
   *
   * A draft is a machine's first attempt at describing somebody's therapy. It
   * goes to a person who was in the room only after the person who was in the
   * room with them has read it.
   */
  const signed = row.noteStatus === "approved";

  return {
    sessionId: row.sessionId,
    therapistFirstName: row.therapistFirst,
    therapistName: [row.therapistFirst, row.therapistLast].filter(Boolean).join(" "),
    sessionDate: ended,
    done: Boolean(row.feedbackId),
    brief: signed ? (row.noteContent?.patientBrief ?? row.noteContent?.summary ?? null) : null,
    briefLanguage: row.noteLanguage ?? "en",
    notePending: !signed,
    paidCents: row.paymentStatus === "paid" ? row.priceCents : 0,
  };
}

export type FeedbackInput = {
  token: string;
  therapistStars: number;
  serviceStars: number;
  therapistTags: string[];
  serviceTags: string[];
  comment: string;
  email: string;
};

export async function submitFeedback(
  input: FeedbackInput,
): Promise<{ error?: string; ok?: boolean }> {
  const [row] = await db
    .select({
      id: sessions.id,
      organizationId: sessions.organizationId,
      therapistId: sessions.therapistId,
      patientId: sessions.patientId,
    })
    .from(sessions)
    .where(eq(sessions.joinToken, input.token))
    .limit(1);

  if (!row) return { error: "This link is no longer valid." };

  const stars = (value: number) => Math.min(5, Math.max(1, Math.round(value)));
  const email = input.email.trim().toLowerCase();
  if (!email || !/^[^@\s]+@[^@\s.]+\.[^@\s]+$/.test(email)) {
    return { error: "We need an email address to send your summary to." };
  }

  const inserted = await db
    .insert(sessionFeedback)
    .values({
      sessionId: row.id,
      organizationId: row.organizationId,
      therapistId: row.therapistId,
      therapistStars: stars(input.therapistStars),
      serviceStars: stars(input.serviceStars),
      therapistTags: input.therapistTags.slice(0, 10),
      serviceTags: input.serviceTags.slice(0, 10),
      comment: input.comment.trim().slice(0, 2000) || null,
      patientEmail: email,
    })
    // Second submission is a no-op rather than an error. Somebody pressing the
    // button twice on a slow connection should get their summary, not a scold.
    .onConflictDoNothing({ target: sessionFeedback.sessionId })
    .returning({ id: sessionFeedback.id });

  /*
   * The address goes onto the patient record.
   *
   * This is how a radar patient — who never had a record created for them by
   * anybody — becomes a contactable person in the clinician's caseload. It is
   * also the only route by which a patient's email enters the system for radar
   * bookings, which is why it is written here and not asked for at booking
   * time, when nobody in crisis wants to fill in a form.
   */
  if (row.patientId) {
    await db
      .update(patients)
      .set({ email, updatedAt: new Date() })
      .where(and(eq(patients.id, row.patientId), isNull(patients.email)));
  }
  await db
    .update(sessions)
    .set({ guestEmail: email })
    .where(and(eq(sessions.id, row.id), isNull(sessions.guestEmail)));

  if (inserted.length === 0) log.info("duplicate feedback ignored");
  return { ok: true };
}

/** Mark the brief as delivered, so it is sent once. */
export async function markBriefSent(sessionId: string): Promise<void> {
  await db
    .update(sessionFeedback)
    .set({ briefSentAt: new Date() })
    .where(eq(sessionFeedback.sessionId, sessionId));
}

/* ---------------------------------------------------------------- reports -- */

export async function fileReport(input: {
  token: string;
  kind: ReportKind;
  detail: string;
  email: string;
}): Promise<{ error?: string; ok?: boolean; sessionId?: string; therapistId?: string }> {
  const [row] = await db
    .select({
      id: sessions.id,
      organizationId: sessions.organizationId,
      therapistId: sessions.therapistId,
    })
    .from(sessions)
    .where(eq(sessions.joinToken, input.token))
    .limit(1);

  if (!row) return { error: "This link is no longer valid." };

  const detail = input.detail.trim().slice(0, 4000);
  if (input.kind !== "no_show" && detail.length < 10) {
    return { error: "Tell us what happened — a sentence is enough." };
  }

  await db.insert(sessionReports).values({
    sessionId: row.id,
    organizationId: row.organizationId,
    therapistId: row.therapistId,
    kind: input.kind,
    detail: detail || null,
    patientEmail: input.email.trim().toLowerCase() || null,
  });

  return { ok: true, sessionId: row.id, therapistId: row.therapistId };
}

/* ---------------------------------------------------------------- ratings -- */

export type Rating = { average: number; count: number };

/**
 * A clinician's public score.
 *
 * Hidden until five sessions have been rated. One bad night should not follow
 * somebody around at 1.0 stars, and a single five-star rating is not evidence
 * of anything — showing either would make the number worse than no number.
 */
export const RATINGS_VISIBLE_AFTER = 5;

export async function therapistRatings(): Promise<Map<string, Rating>> {
  const rows = await db
    .select({
      therapistId: sessionFeedback.therapistId,
      average: avg(sessionFeedback.therapistStars),
      total: count(),
    })
    .from(sessionFeedback)
    .groupBy(sessionFeedback.therapistId);

  return new Map(
    rows.map((row) => [
      row.therapistId,
      { average: Number(row.average ?? 0), count: Number(row.total) },
    ]),
  );
}

/** One clinician's own view: their score, and what people said. */
export async function feedbackForTherapist(therapistId: string, limit = 30) {
  const [summary] = await db
    .select({
      therapist: avg(sessionFeedback.therapistStars),
      service: avg(sessionFeedback.serviceStars),
      total: count(),
    })
    .from(sessionFeedback)
    .where(eq(sessionFeedback.therapistId, therapistId));

  const recent = await db
    .select({
      id: sessionFeedback.id,
      stars: sessionFeedback.therapistStars,
      tags: sessionFeedback.therapistTags,
      comment: sessionFeedback.comment,
      createdAt: sessionFeedback.createdAt,
    })
    .from(sessionFeedback)
    .where(eq(sessionFeedback.therapistId, therapistId))
    .orderBy(desc(sessionFeedback.createdAt))
    .limit(limit);

  return {
    therapistAverage: Number(summary?.therapist ?? 0),
    serviceAverage: Number(summary?.service ?? 0),
    total: Number(summary?.total ?? 0),
    recent,
  };
}

/* -------------------------------------------------------- off-record gaps -- */

/**
 * Where the microphone was off.
 *
 * Not the words — there are none — but the shape of the silence: when it
 * started and how long it lasted. A patient alleging something happened during
 * a period the clinician took off record deserves to have that period exist as
 * a fact rather than as an argument, and an investigation that could only say
 * "there is no recording" would be worthless to everyone including an innocent
 * clinician.
 *
 * Derived from the transcript's own timeline, so it needs no extra bookkeeping
 * and cannot be edited away by someone who knows the schema.
 */
export const OFF_RECORD_THRESHOLD_MS = 20_000;

export async function offRecordGaps(sessionId: string) {
  const rows = await db.execute<{ gap_start: number; gap_end: number }>(sql`
    SELECT prev_end AS gap_start, start_ms AS gap_end FROM (
      SELECT start_ms, LAG(end_ms) OVER (ORDER BY sequence) AS prev_end
      FROM transcript_segments WHERE session_id = ${sessionId}
    ) t
    WHERE prev_end IS NOT NULL AND start_ms - prev_end > ${OFF_RECORD_THRESHOLD_MS}
    ORDER BY prev_end
  `);

  return (rows.rows as { gap_start: number; gap_end: number }[]).map((row) => ({
    fromMs: Number(row.gap_start),
    toMs: Number(row.gap_end),
    seconds: Math.round((Number(row.gap_end) - Number(row.gap_start)) / 1000),
  }));
}

/* ------------------------------------------------------------------ bans -- */

/**
 * Escalating suspensions for not turning up.
 *
 * A day for the first, three for the second, indefinite after that. The whole
 * promise of the radar is that somebody is actually there — a clinician who
 * takes payment and does not appear breaks the only thing that makes this
 * worth using, and the penalty has to be visible enough that it is never worth
 * the risk of a quiet nap.
 */
export function suspensionFor(priorNoShows: number): { hours: number; label: string } {
  if (priorNoShows <= 0) return { hours: 24, label: "24 hours" };
  if (priorNoShows === 1) return { hours: 72, label: "3 days" };
  return { hours: 24 * 3650, label: "indefinitely, pending review" };
}

export async function countNoShows(therapistId: string): Promise<number> {
  const [row] = await db
    .select({ total: count() })
    .from(sessionReports)
    .where(
      and(
        eq(sessionReports.therapistId, therapistId),
        eq(sessionReports.kind, "no_show"),
        eq(sessionReports.status, "actioned"),
      ),
    );
  return Number(row?.total ?? 0);
}

export async function suspendFromRadar(
  therapistId: string,
  hours: number,
  reason: string,
): Promise<void> {
  await db
    .update(therapistRadar)
    .set({
      suspendedUntil: new Date(Date.now() + hours * 3600_000),
      suspendedReason: reason.slice(0, 200),
      // Off the board immediately, not at the next sweep.
      status: "offline",
      updatedAt: new Date(),
    })
    .where(eq(therapistRadar.userId, therapistId));
}

export async function releaseFromRadarBan(therapistId: string): Promise<void> {
  await db
    .update(therapistRadar)
    .set({ suspendedUntil: null, suspendedReason: null, updatedAt: new Date() })
    .where(eq(therapistRadar.userId, therapistId));
}

/**
 * Send the brief to whoever asked for it, once.
 *
 * The only function in the codebase that emails clinical text to a patient,
 * and it reads exactly one field. There is no parameter for "which part" and
 * no caller that can pass the SOAP note: if you want to widen what a patient
 * receives you have to come here and mean it.
 *
 * Called after the clinician signs the note, and again from the rating form —
 * whichever happens second is the one that sends. Guarded by `briefSentAt`, so
 * the order does not matter and neither does a retry.
 */
export async function releaseBrief(sessionId: string): Promise<boolean> {
  const [row] = await db
    .select({
      email: sessionFeedback.patientEmail,
      alreadySent: sessionFeedback.briefSentAt,
      content: sessionNotes.content,
      language: sessionNotes.language,
      status: sessionNotes.status,
      endedAt: sessions.endedAt,
      createdAt: sessions.createdAt,
      therapistFirst: users.firstName,
      therapistLast: users.lastName,
    })
    .from(sessionFeedback)
    .innerJoin(sessions, eq(sessions.id, sessionFeedback.sessionId))
    .innerJoin(users, eq(users.id, sessionFeedback.therapistId))
    .leftJoin(sessionNotes, eq(sessionNotes.sessionId, sessionFeedback.sessionId))
    .where(eq(sessionFeedback.sessionId, sessionId))
    .limit(1);

  if (!row || row.alreadySent || !row.email) return false;
  if (row.status !== "approved") return false;

  const brief = row.content?.patientBrief?.trim() || row.content?.summary?.trim();
  if (!brief) return false;

  const { sendSessionReport } = await import("@/lib/mail");
  const sent = await sendSessionReport({
    to: row.email,
    patientName: "there",
    therapistName: [row.therapistFirst, row.therapistLast].filter(Boolean).join(" "),
    note: {
      soap: { subjective: "", objective: "", assessment: "", plan: "" },
      summary: "",
      patientBrief: brief,
      talkingPoints: [],
      observations: "",
      impressions: "",
      recommendations: [],
      followUp: "",
    },
    language: row.language ?? "en",
    sessionDate: row.endedAt ?? row.createdAt,
  });

  if (sent) {
    await markBriefSent(sessionId);
    await db
      .update(sessions)
      .set({ reportSentAt: new Date() })
      .where(eq(sessions.id, sessionId));
  }
  return sent;
}
