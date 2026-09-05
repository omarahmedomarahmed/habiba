import "server-only";

import { randomBytes } from "node:crypto";
import { and, asc, desc, eq, isNotNull, isNull, lt, or, sql } from "drizzle-orm";

import { raiseCrisisAlert, scanForCrisisLanguage } from "@/lib/ai/crisis";
import { pauseBeforeMs, wordsPerMinute } from "@/lib/ai/descriptors";
import { auditPhi } from "@/lib/audit";
import type { Actor } from "@/lib/auth/session";
import { db } from "@/lib/db";
import {
  patients,
  sessionNotes,
  sessions,
  transcriptSegments,
  type Modality,
} from "@/lib/db/schema";
import { log, ref } from "@/lib/logger";
import { capSeconds, sessionClock, type SessionClock } from "@/lib/session-clock";
import { getSettings } from "@/lib/settings";

/**
 * Every read and write of clinical data goes through this module, and every
 * query here is scoped by `organizationId` taken from the authenticated actor —
 * never from a request parameter.
 *
 * The old code threaded `req.user.organization_id` into hand-written SQL at
 * ~200 call sites with uneven coverage, so a single forgotten `AND
 * organization_id = $n` was a cross-tenant leak with nothing behind it. Here
 * there is one place to get it wrong.
 */

/** Scope predicate: an org, and for clinicians their own caseload. */
function scope(actor: Actor) {
  return actor.role === "super_admin"
    ? eq(sessions.organizationId, actor.organizationId)
    : and(
        eq(sessions.organizationId, actor.organizationId),
        eq(sessions.therapistId, actor.userId),
      );
}

export type SessionListItem = {
  id: string;
  status: string;
  modality: Modality;
  noteStatus: string;
  createdAt: Date;
  startedAt: Date | null;
  endedAt: Date | null;
  durationMinutes: number | null;
  patientId: string | null;
  patientFirstName: string | null;
  patientLastName: string | null;
  guestName: string | null;
};

export async function listSessions(
  actor: Actor,
  opts: { limit?: number } = {},
): Promise<SessionListItem[]> {
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
      patientId: sessions.patientId,
      patientFirstName: patients.firstName,
      patientLastName: patients.lastName,
      guestName: sessions.guestName,
    })
    .from(sessions)
    // LEFT JOIN, always. `sessions.patient_id` is nullable for link-based
    // sessions, and an INNER JOIN here silently hid those rows — the same bug
    // was fixed three separate times in the old codebase.
    .leftJoin(patients, eq(patients.id, sessions.patientId))
    .where(scope(actor))
    .orderBy(desc(sessions.createdAt))
    .limit(opts.limit ?? 50);
}

export async function getSession(actor: Actor, sessionId: string) {
  const [row] = await db
    .select({
      session: sessions,
      patient: patients,
    })
    .from(sessions)
    .leftJoin(patients, eq(patients.id, sessions.patientId))
    .where(and(scope(actor), eq(sessions.id, sessionId)))
    .limit(1);

  if (!row) return null;

  await auditPhi(actor, "session.read", {
    resourceType: "session",
    resourceId: sessionId,
    patientId: row.session.patientId,
  });

  return row;
}

export async function createSession(
  actor: Actor,
  input: {
    modality: Modality;
    patientId?: string | null;
    guestName?: string;
    guestEmail?: string;
    /** Zero means free to join, which is the default and the common case. */
    priceCents?: number;
  },
) {
  let patientId = input.patientId ?? null;

  // An in-person session with a typed name creates the chart immediately, so
  // the clinician never has to "add a patient" as a separate step.
  if (!patientId && input.guestName?.trim()) {
    const [created] = await db
      .insert(patients)
      .values({
        organizationId: actor.organizationId,
        therapistId: actor.userId,
        firstName: input.guestName.trim().split(/\s+/)[0]!,
        lastName: input.guestName.trim().split(/\s+/).slice(1).join(" ") || null,
        email: input.guestEmail?.trim() || null,
        source: "therapist",
      })
      .returning({ id: patients.id });
    patientId = created?.id ?? null;
  }

  const needsLink = input.modality === "video";
  // Belt and braces: a price on an in-person session would be an unreachable
  // paywall, because there is no link for the patient to pay through.
  const price = needsLink ? Math.max(0, Math.round(input.priceCents ?? 0)) : 0;

  const [created] = await db
    .insert(sessions)
    .values({
      organizationId: actor.organizationId,
      therapistId: actor.userId,
      patientId,
      guestName: input.guestName?.trim() || null,
      guestEmail: input.guestEmail?.trim() || null,
      modality: input.modality,
      status: "scheduled",
      // 4.6: where this session came from, recorded rather than inferred later.
      sessionType: price > 0 ? "paid_link" : "direct",
      joinToken: needsLink ? randomBytes(24).toString("base64url") : null,
      // Issued alongside the join token and never equal to it. This one has to
      // outlive the session, because a patient who closed the tab should still
      // be able to rate it days later.
      feedbackToken: randomBytes(24).toString("base64url"),
      joinTokenExpiresAt: needsLink ? new Date(Date.now() + 12 * 60 * 60 * 1000) : null,
      priceCents: price,
      paymentStatus: price > 0 ? "pending" : "not_required",
    })
    .returning();

  await auditPhi(actor, "session.create", {
    resourceType: "session",
    resourceId: created!.id,
    patientId,
  });

  return created!;
}

/**
 * A session created by a patient off the radar, with no authenticated actor.
 *
 * Kept separate from `createSession` because there is no `Actor` here to scope
 * anything by — the org and therapist come from the radar row, which is the
 * only reason this is safe. Deliberately does not create a patient record: that
 * happens when they type their name on the join page, exactly as it does for a
 * link the therapist sent, so there is one code path that turns a stranger into
 * a chart.
 */
export async function createRadarSession(input: {
  organizationId: string;
  therapistId: string;
  guestName: string;
  guestEmail: string | null;
  priceCents: number;
}) {
  const [created] = await db
    .insert(sessions)
    .values({
      organizationId: input.organizationId,
      therapistId: input.therapistId,
      guestName: input.guestName.trim().slice(0, 80),
      guestEmail: input.guestEmail?.trim().toLowerCase() || null,
      modality: "video",
      status: "scheduled",
      // Every session created here came off the live map, priced or not — the
      // distinction a free radar session and a free link both lose otherwise.
      sessionType: "radar",
      joinToken: randomBytes(24).toString("base64url"),
      feedbackToken: randomBytes(24).toString("base64url"),
      // Short: this is a session starting now, not an invitation for later.
      joinTokenExpiresAt: new Date(Date.now() + 3 * 60 * 60 * 1000),
      priceCents: input.priceCents,
      paymentStatus: input.priceCents > 0 ? "pending" : "not_required",
    })
    .returning();

  return created!;
}

/**
 * Status transitions. `waiting` from the old model is gone — a session is
 * scheduled until someone presses Start.
 *
 * Both `scheduled → completed` and `in_progress → completed` are allowed: a
 * clinician ending a session they never formally started used to get a 400.
 */
const TRANSITIONS: Record<string, string[]> = {
  scheduled: ["in_progress", "completed", "cancelled"],
  in_progress: ["completed", "cancelled"],
  completed: [],
  cancelled: [],
};

export class TransitionError extends Error {}

export async function startSession(actor: Actor, sessionId: string) {
  const [current] = await db
    .select({ status: sessions.status })
    .from(sessions)
    .where(and(scope(actor), eq(sessions.id, sessionId)))
    .limit(1);
  if (!current) throw new TransitionError("Session not found");

  // Re-entering a live room must be a no-op, not an error. The old client had
  // to special-case `in_progress → in_progress` in a string comparison.
  if (current.status === "in_progress") return;
  if (!TRANSITIONS[current.status]?.includes("in_progress")) {
    throw new TransitionError("This session can no longer be started");
  }

  await db
    .update(sessions)
    .set({ status: "in_progress", startedAt: new Date(), updatedAt: new Date() })
    .where(and(scope(actor), eq(sessions.id, sessionId)));
}

/* ---------------------------------------------------------- the clock -- */

/**
 * Where a live session is on its ladder, read from the database.
 *
 * The one authority. Both clients compute the same thing locally so the
 * countdown ticks smoothly between polls, but this is the copy that decides
 * whether a session is over — a client that computes its own answer and acts on
 * it is a client that can be lied to by a changed system clock.
 *
 * Unauthenticated by design, because the patient needs it too and has no
 * account. It returns nothing but a countdown.
 */
export async function readSessionClock(sessionId: string): Promise<SessionClock & { live: boolean }> {
  const { clock: limits } = await getSettings();

  const [row] = await db
    .select({
      status: sessions.status,
      startedAt: sessions.startedAt,
      /*
       * The last thing anybody said, for the "everyone left" check.
       *
       * `created_at` on the newest segment rather than a column on the session:
       * it is already written by the upload path, it cannot drift from the
       * transcript it describes, and it costs one indexed lookup.
       */
      lastActivityAt: sql<Date | null>`(
        SELECT max(t."created_at") FROM ${transcriptSegments} t
        WHERE t."session_id" = ${sessions}."id"
      )`,
    })
    .from(sessions)
    .where(eq(sessions.id, sessionId))
    .limit(1);

  if (!row) {
    return { ...sessionClock({ startedAt: null, limits }), live: false };
  }

  return {
    ...sessionClock({
      startedAt: row.status === "in_progress" ? row.startedAt : null,
      lastActivityAt: row.lastActivityAt,
      limits,
    }),
    live: row.status === "in_progress",
  };
}

/**
 * End a session nobody is ending.
 *
 * Runs off whichever side happens to poll — the clinician's room, or the
 * patient's page — for the same reason the abandonment check does: the event
 * that matters is somebody being in a session that has run over, and that
 * somebody is already talking to us every few seconds. A cron would have to
 * wake the database on a schedule to ask a question whose answer is almost
 * always no.
 *
 * Unscoped by actor on purpose. The patient has no account and is exactly the
 * party most likely to still have a tab open when the clinician's laptop has
 * gone to sleep — which is the case this exists for.
 *
 * The guard on `status` makes it safe to call from both sides at once: whoever
 * gets there second updates nothing and returns false.
 */
export async function autoEndSession(
  sessionId: string,
  reason: "cap" | "silence",
): Promise<{ ended: boolean; organizationId?: string; therapistId?: string; patientId?: string | null }> {
  const endedAt = new Date();

  const [row] = await db
    .update(sessions)
    .set({
      status: "completed",
      endedAt,
      autoEndedReason: reason,
      durationMinutes: sql`GREATEST(1, ROUND(EXTRACT(EPOCH FROM (${endedAt.toISOString()}::timestamptz - ${sessions.startedAt})) / 60))::int`,
      noteStatus: "generating",
      updatedAt: endedAt,
    })
    .where(and(eq(sessions.id, sessionId), eq(sessions.status, "in_progress")))
    .returning({
      organizationId: sessions.organizationId,
      therapistId: sessions.therapistId,
      patientId: sessions.patientId,
    });

  if (!row) return { ended: false };

  log.info("session auto-ended", { session: ref(sessionId), reason });
  return { ended: true, ...row };
}

/**
 * Close sessions that ran over and that nobody is watching.
 *
 * The ladder is enforced on the polls both sides make, which is the right place
 * for it — it costs nothing when nobody is in a session and it fires the moment
 * one runs over. But it has one blind spot, and this database contains an
 * example of it: a session whose clinician closed the tab and whose patient
 * never had one. Nothing polls, so nothing ever ends it, and it sits
 * `in_progress` with the clinician marked unavailable on the public radar.
 *
 * Bounded to sessions past the cap so it can never touch one that is genuinely
 * running, and folded into the nightly batch so it costs no extra wake.
 */
export async function sweepOverrunSessions(): Promise<{ ended: number }> {
  // The hard stop, read from settings rather than a constant: an admin who
  // lengthens a session must not have the sweeper end it early the same night.
  const { clock } = await getSettings();
  const cutoff = new Date(Date.now() - capSeconds(clock) * 1000);

  const stale = await db
    .select({ id: sessions.id })
    .from(sessions)
    .where(
      and(
        eq(sessions.status, "in_progress"),
        isNotNull(sessions.startedAt),
        lt(sessions.startedAt, cutoff),
      ),
    )
    .limit(200);

  let ended = 0;
  for (const row of stale) {
    const result = await autoEndSession(row.id, "cap");
    if (!result.ended) continue;
    ended += 1;
    const { finishSession } = await import("@/lib/session-finish");
    await finishSession({
      sessionId: row.id,
      organizationId: result.organizationId!,
      therapistId: result.therapistId!,
      patientId: result.patientId ?? null,
    });
  }

  return { ended };
}

export async function completeSession(actor: Actor, sessionId: string) {
  const [current] = await db
    .select({
      status: sessions.status,
      startedAt: sessions.startedAt,
      patientId: sessions.patientId,
    })
    .from(sessions)
    .where(and(scope(actor), eq(sessions.id, sessionId)))
    .limit(1);
  if (!current) throw new TransitionError("Session not found");
  if (current.status === "completed") return { alreadyCompleted: true, patientId: current.patientId };
  if (!TRANSITIONS[current.status]?.includes("completed")) {
    throw new TransitionError("This session can no longer be completed");
  }

  const endedAt = new Date();
  const durationMinutes = current.startedAt
    ? Math.max(1, Math.round((endedAt.getTime() - current.startedAt.getTime()) / 60000))
    : null;

  await db
    .update(sessions)
    .set({
      status: "completed",
      endedAt,
      durationMinutes,
      noteStatus: "generating",
      /*
       * The join token survives the session ending, and it must.
       *
       * It used to be nulled here — "kill the link the moment the session
       * ends" — which was belt and braces, because `resolveJoinToken` already
       * refuses any session with an `ended_at`. The braces were doing the work
       * and the belt was strangling the patient: every feedback lookup finds
       * the session by this token, so nulling it meant nobody could ever rate
       * a session or receive their brief. The whole flow was dead on arrival
       * and nothing failed loudly, because a missing row just reads as an
       * expired link.
       *
       * Cancelling still clears it. A cancelled session has no brief to
       * collect and no rating to give.
       */
      updatedAt: endedAt,
    })
    .where(and(scope(actor), eq(sessions.id, sessionId)));

  if (current.patientId) {
    await db
      .update(patients)
      .set({ lastSessionAt: endedAt })
      .where(eq(patients.id, current.patientId));
  }

  await auditPhi(actor, "session.complete", {
    resourceType: "session",
    resourceId: sessionId,
    patientId: current.patientId,
  });

  return { alreadyCompleted: false, patientId: current.patientId };
}

export async function cancelSession(actor: Actor, sessionId: string) {
  await db
    .update(sessions)
    .set({ status: "cancelled", joinToken: null, updatedAt: new Date() })
    .where(and(scope(actor), eq(sessions.id, sessionId)));
}

// --------------------------------------------------------------- transcript ---

export async function getTranscript(actor: Actor, sessionId: string) {
  const [owned] = await db
    .select({ id: sessions.id })
    .from(sessions)
    .where(and(scope(actor), eq(sessions.id, sessionId)))
    .limit(1);
  if (!owned) return [];

  return db
    .select()
    .from(transcriptSegments)
    .where(eq(transcriptSegments.sessionId, sessionId))
    .orderBy(asc(transcriptSegments.sequence));
}

/**
 * The one and only place a transcript segment is written.
 *
 * Because it is the only writer, the crisis scan below cannot be bypassed by
 * arriving through a different code path — which is exactly what happened
 * before, when audio-transcribed sessions went through a function that had no
 * scan in it at all.
 */
export async function appendTranscriptSegment(input: {
  sessionId: string;
  organizationId: string;
  therapistId: string;
  patientId: string | null;
  sequence: number;
  speaker: "therapist" | "patient" | "unknown";
  text: string;
  startMs: number;
  endMs: number;
}): Promise<{ inserted: boolean; crisis: boolean }> {
  const text = input.text.trim();
  if (!text) return { inserted: false, crisis: false };

  /*
   * Descriptors, computed here because this is the only writer.
   *
   * The previous segment's end is read rather than passed in: the caller is an
   * upload handler that knows about one chunk, and asking it to track the last
   * one would put the same state in two places and let them drift. One indexed
   * lookup on `(session_id, sequence)`, which is the index that already exists.
   */
  const [previous] = await db
    .select({ endMs: transcriptSegments.endMs })
    .from(transcriptSegments)
    .where(
      and(
        eq(transcriptSegments.sessionId, input.sessionId),
        lt(transcriptSegments.sequence, input.sequence),
      ),
    )
    .orderBy(desc(transcriptSegments.sequence))
    .limit(1);

  const result = await db
    .insert(transcriptSegments)
    .values({
      sessionId: input.sessionId,
      organizationId: input.organizationId,
      sequence: input.sequence,
      speaker: input.speaker,
      text,
      startMs: input.startMs,
      endMs: input.endMs,
      wordsPerMinute: wordsPerMinute(text, input.endMs - input.startMs),
      pauseBeforeMs: pauseBeforeMs(input.startMs, previous?.endMs ?? null),
    })
    // A retried chunk must not duplicate the segment.
    .onConflictDoNothing({
      target: [transcriptSegments.sessionId, transcriptSegments.sequence],
    })
    .returning({ id: transcriptSegments.id });

  const inserted = result.length > 0;

  const matches = scanForCrisisLanguage(text);
  if (inserted && matches.length > 0) {
    await raiseCrisisAlert({
      sessionId: input.sessionId,
      organizationId: input.organizationId,
      therapistId: input.therapistId,
      patientId: input.patientId,
      level: "high",
      source: "keyword",
      indicators: matches,
    });
  }

  return { inserted, crisis: matches.length > 0 };
}

export async function nextSequence(sessionId: string): Promise<number> {
  const [row] = await db
    .select({ max: sql<number>`COALESCE(MAX(${transcriptSegments.sequence}), 0)` })
    .from(transcriptSegments)
    .where(eq(transcriptSegments.sessionId, sessionId));
  return (row?.max ?? 0) + 1;
}

// -------------------------------------------------------------------- notes ---

export async function getNote(actor: Actor, sessionId: string) {
  const [row] = await db
    .select({ note: sessionNotes })
    .from(sessionNotes)
    .innerJoin(sessions, eq(sessions.id, sessionNotes.sessionId))
    .where(and(scope(actor), eq(sessionNotes.sessionId, sessionId)))
    .limit(1);
  return row?.note ?? null;
}

export async function listRecentNotes(actor: Actor, limit = 50) {
  return db
    .select({
      id: sessionNotes.id,
      sessionId: sessionNotes.sessionId,
      status: sessionNotes.status,
      patientStatus: sessionNotes.patientStatus,
      createdAt: sessionNotes.createdAt,
      content: sessionNotes.content,
      patientFirstName: patients.firstName,
      patientLastName: patients.lastName,
      guestName: sessions.guestName,
      sessionEndedAt: sessions.endedAt,
    })
    .from(sessionNotes)
    .innerJoin(sessions, eq(sessions.id, sessionNotes.sessionId))
    .leftJoin(patients, eq(patients.id, sessionNotes.patientId))
    .where(scope(actor))
    .orderBy(desc(sessionNotes.createdAt))
    .limit(limit);
}

/**
 * Notes still waiting on the clinician — either signature outstanding.
 *
 * A note whose chart is signed but whose patient summary has not been approved
 * is still work: somebody is waiting for it. Counting only `status` would have
 * dropped exactly those from the badge, which is the half that has a person on
 * the other end of it.
 */
export async function countOpenDrafts(actor: Actor): Promise<number> {
  const [row] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(sessionNotes)
    .innerJoin(sessions, eq(sessions.id, sessionNotes.sessionId))
    .where(
      and(
        scope(actor),
        or(eq(sessionNotes.status, "draft"), eq(sessionNotes.patientStatus, "draft")),
      ),
    );
  return row?.count ?? 0;
}

// ------------------------------------------------------------- join tokens ---

/**
 * Resolve a patient join link. Unauthenticated by definition, so it returns the
 * bare minimum: enough to render a waiting room, and nothing clinical.
 *
 * The old endpoint returned the therapist's name and avatar *and* eagerly
 * created the video room for any caller holding a token that never expired.
 */
export async function resolveJoinToken(token: string) {
  const [row] = await db
    .select({
      id: sessions.id,
      status: sessions.status,
      modality: sessions.modality,
      videoRoomUrl: sessions.videoRoomUrl,
      videoRoomName: sessions.videoRoomName,
      expiresAt: sessions.joinTokenExpiresAt,
      organizationId: sessions.organizationId,
      therapistId: sessions.therapistId,
      patientId: sessions.patientId,
      // The paywall state. Returned because the join page has to render it, and
      // it is not clinical: a price and whether it has been settled.
      priceCents: sessions.priceCents,
      paymentStatus: sessions.paymentStatus,
      guestName: sessions.guestName,
    })
    .from(sessions)
    .where(and(eq(sessions.joinToken, token), isNull(sessions.endedAt)))
    .limit(1);

  if (!row) return null;
  if (row.expiresAt && row.expiresAt < new Date()) return null;
  if (row.status === "cancelled" || row.status === "completed") return null;
  return row;
}

/** Records the patient's chosen name against the session and marks them joined. */
export async function joinByToken(token: string, displayName: string) {
  const target = await resolveJoinToken(token);
  if (!target) return null;

  const name = displayName.trim().slice(0, 80);
  if (!name) return null;

  await db.transaction(async (tx) => {
    let patientId = target.patientId;

    if (!patientId) {
      const [created] = await tx
        .insert(patients)
        .values({
          organizationId: target.organizationId,
          therapistId: target.therapistId,
          firstName: name.split(/\s+/)[0]!,
          lastName: name.split(/\s+/).slice(1).join(" ") || null,
          source: "join_link",
        })
        .returning({ id: patients.id });
      patientId = created?.id ?? null;
    }

    await tx
      .update(sessions)
      .set({
        // COALESCE semantics: never overwrite an existing link.
        patientId: target.patientId ?? patientId,
        guestName: name,
        patientJoinedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(sessions.id, target.id));
  });

  return target.id;
}

/**
 * The session this clinician has live with this patient, if any.
 *
 * Used to stamp a copilot question with the session it was asked during, so
 * that "how much copilot did this session use" has an answer. Scoped through
 * `scope(actor)` like everything else here: a patient id from a URL cannot
 * reach a session on somebody else's caseload.
 *
 * Returns null when nothing is live, and null is a real answer — a question
 * asked on a Tuesday about a patient seen last week belongs to no session.
 */
export async function liveSessionForPatient(
  actor: Actor,
  patientId: string,
): Promise<string | null> {
  const [row] = await db
    .select({ id: sessions.id })
    .from(sessions)
    .where(
      and(
        scope(actor),
        eq(sessions.patientId, patientId),
        eq(sessions.status, "in_progress"),
      ),
    )
    .orderBy(desc(sessions.startedAt))
    .limit(1);

  return row?.id ?? null;
}
