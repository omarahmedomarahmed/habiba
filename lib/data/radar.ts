import "server-only";

import { and, eq, gte, isNull, lt, or, sql } from "drizzle-orm";

import type { Actor } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { notifications, sessions, therapistRadar, users } from "@/lib/db/schema";
import { log, ref } from "@/lib/logger";

/**
 * Crisis Radar.
 *
 * One rule dominates this module: **two patients must never book the same
 * clinician**. Everything else is presentation.
 *
 * That rule is enforced by a single conditional UPDATE. Not a SELECT followed
 * by an UPDATE, not a transaction with a read inside it, not an advisory lock —
 * one statement whose WHERE clause *is* the precondition, returning zero rows
 * when someone else got there first. Postgres serialises concurrent UPDATEs to
 * the same row, so the loser re-evaluates the WHERE against the winner's
 * committed value and matches nothing. There is no window between the check and
 * the write because there is no check separate from the write.
 */

/** A clinician who stops sending heartbeats drops off the radar. */
export const HEARTBEAT_STALE_MS = 90_000;

/** How long a patient has to finish paying before the claim is released. */
export const CLAIM_MINUTES = 10;

export type RadarTherapist = {
  userId: string;
  organizationId: string;
  firstName: string;
  lastName: string | null;
  credentials: string | null;
  headline: string | null;
  photoUrl: string | null;
  languages: string[];
  specialties: string[];
  country: string | null;
  rateCents: number;
  status: "online" | "pending" | "in_session";
};

/**
 * Everyone currently bookable, plus those mid-booking and mid-session.
 *
 * Pending and in-session clinicians are returned deliberately rather than
 * filtered out: a radar that silently drops someone the moment another patient
 * starts booking them looks broken, and "with someone right now" is useful
 * information to a person deciding whether to wait.
 *
 * Anonymous callers reach this. It returns nothing that is not the clinician's
 * own published profile — no email, no organisation, no patient anything.
 */
export async function listRadar(): Promise<RadarTherapist[]> {
  const fresh = new Date(Date.now() - HEARTBEAT_STALE_MS);

  const rows = await db
    .select({
      userId: users.id,
      organizationId: users.organizationId,
      firstName: users.firstName,
      lastName: users.lastName,
      profile: users.profile,
      rateCents: users.sessionRateCents,
      chargesEnabled: users.chargesEnabled,
      headline: therapistRadar.headline,
      photoUrl: therapistRadar.photoUrl,
      languages: therapistRadar.languages,
      specialties: therapistRadar.specialties,
      country: therapistRadar.country,
      status: therapistRadar.status,
      pendingUntil: therapistRadar.pendingUntil,
    })
    .from(therapistRadar)
    .innerJoin(users, eq(users.id, therapistRadar.userId))
    .where(
      and(
        isNull(users.deletedAt),
        eq(users.status, "active"),
        gte(therapistRadar.lastSeenAt, fresh),
        or(
          eq(therapistRadar.status, "online"),
          eq(therapistRadar.status, "pending"),
          eq(therapistRadar.status, "in_session"),
        ),
      ),
    )
    // Bookable first. Ordering by the status column alone sorts alphabetically,
    // which buries "online" between "in_session" and "pending" — the one group
    // a visitor can actually do something with, in the middle of the list.
    .orderBy(
      sql`CASE ${therapistRadar.status} WHEN 'online' THEN 0 WHEN 'pending' THEN 1 ELSE 2 END`,
      users.firstName,
    )
    .limit(100);

  const now = Date.now();

  return rows.map((row) => ({
    userId: row.userId,
    organizationId: row.organizationId,
    firstName: row.firstName,
    lastName: row.lastName,
    credentials: row.profile?.credentials ?? null,
    headline: row.headline,
    photoUrl: row.photoUrl,
    languages: row.languages ?? [],
    specialties: row.specialties ?? [],
    country: row.country,
    // A clinician who has not finished Stripe onboarding cannot be charged for,
    // so they are shown as free rather than as a price that cannot be paid.
    rateCents: row.chargesEnabled ? row.rateCents : 0,
    // An expired claim reads as available, because that is what the claiming
    // UPDATE will decide a moment later. Showing "booking" for a claim that has
    // already lapsed sends people away from someone who is free.
    status:
      row.status === "pending" && row.pendingUntil && row.pendingUntil.getTime() < now
        ? "online"
        : (row.status as "online" | "pending" | "in_session"),
  }));
}

export async function getRadarProfile(userId: string) {
  const [row] = await db
    .select()
    .from(therapistRadar)
    .where(eq(therapistRadar.userId, userId))
    .limit(1);
  return row ?? null;
}

/** Create the row on first use so the therapist console has something to edit. */
export async function ensureRadarProfile(actor: Actor) {
  const existing = await getRadarProfile(actor.userId);
  if (existing) return existing;

  await db
    .insert(therapistRadar)
    .values({ userId: actor.userId, organizationId: actor.organizationId, status: "offline" })
    .onConflictDoNothing({ target: therapistRadar.userId });

  return (await getRadarProfile(actor.userId))!;
}

export async function saveRadarProfile(
  actor: Actor,
  input: {
    headline: string | null;
    photoUrl: string | null;
    languages: string[];
    specialties: string[];
    country: string | null;
  },
): Promise<void> {
  await ensureRadarProfile(actor);
  await db
    .update(therapistRadar)
    .set({ ...input, updatedAt: new Date() })
    .where(eq(therapistRadar.userId, actor.userId));
}

/**
 * Go on or off the radar.
 *
 * Going offline is refused mid-booking and mid-session. A clinician cannot
 * vanish out from under a patient who is at that moment typing their card
 * number, and the session already exists by then.
 */
export async function setOnline(actor: Actor, online: boolean): Promise<{ error?: string }> {
  await ensureRadarProfile(actor);

  if (!online) {
    const updated = await db
      .update(therapistRadar)
      .set({ status: "offline", lastSeenAt: null, updatedAt: new Date() })
      .where(
        and(
          eq(therapistRadar.userId, actor.userId),
          or(eq(therapistRadar.status, "online"), eq(therapistRadar.status, "offline")),
        ),
      )
      .returning({ id: therapistRadar.id });

    return updated.length > 0
      ? {}
      : { error: "You have a booking in progress — finish or end it first." };
  }

  const updated = await db
    .update(therapistRadar)
    .set({ status: "online", lastSeenAt: new Date(), updatedAt: new Date() })
    .where(and(eq(therapistRadar.userId, actor.userId), eq(therapistRadar.status, "offline")))
    .returning({ id: therapistRadar.id });

  // Already online, pending or in session — all fine, nothing to change.
  if (updated.length === 0) await heartbeat(actor.userId);
  return {};
}

/** Keep an online clinician on the radar. Cheap enough to call every 30s. */
export async function heartbeat(userId: string): Promise<void> {
  await db
    .update(therapistRadar)
    .set({ lastSeenAt: new Date() })
    .where(eq(therapistRadar.userId, userId));
}

/**
 * Claim a clinician for a booking. **This is the concurrency guarantee.**
 *
 * The WHERE clause is the precondition and the UPDATE is the claim, in one
 * statement. Two patients pressing Book in the same millisecond both reach
 * Postgres; one row is locked, updated and committed, and the other statement
 * re-evaluates its WHERE against the new value, matches nothing, and returns
 * zero rows. The loser is told to pick someone else.
 *
 * An expired pending is claimable by the same condition, which is what makes an
 * abandoned checkout self-healing rather than a clinician stuck out of service
 * until a cron happens to run.
 */
export async function claimTherapist(opts: {
  therapistUserId: string;
  sessionId: string;
}): Promise<boolean> {
  const now = new Date();
  const until = new Date(now.getTime() + CLAIM_MINUTES * 60_000);

  const claimed = await db
    .update(therapistRadar)
    .set({
      status: "pending",
      pendingSessionId: opts.sessionId,
      pendingUntil: until,
      updatedAt: now,
    })
    .where(
      and(
        eq(therapistRadar.userId, opts.therapistUserId),
        gte(therapistRadar.lastSeenAt, new Date(now.getTime() - HEARTBEAT_STALE_MS)),
        or(
          eq(therapistRadar.status, "online"),
          and(eq(therapistRadar.status, "pending"), lt(therapistRadar.pendingUntil, now)),
        ),
      ),
    )
    .returning({ id: therapistRadar.id });

  return claimed.length > 0;
}

/**
 * Give the clinician back.
 *
 * Scoped to the claiming session id, so a late release from an abandoned
 * booking cannot cancel the *next* patient's claim — the classic way a
 * time-based lock releases someone else's lock.
 */
export async function releaseClaim(sessionId: string): Promise<void> {
  await db
    .update(therapistRadar)
    .set({ status: "online", pendingSessionId: null, pendingUntil: null, updatedAt: new Date() })
    .where(
      and(
        eq(therapistRadar.pendingSessionId, sessionId),
        or(eq(therapistRadar.status, "pending"), eq(therapistRadar.status, "in_session")),
      ),
    );
}

/** Payment cleared: the booking is real, the clinician is busy. */
export async function markInSession(sessionId: string): Promise<void> {
  await db
    .update(therapistRadar)
    .set({ status: "in_session", pendingUntil: null, updatedAt: new Date() })
    .where(
      and(eq(therapistRadar.pendingSessionId, sessionId), eq(therapistRadar.status, "pending")),
    );
}

/**
 * The therapist's own view of an incoming booking. Polled by the console, which
 * is what triggers the alert sound.
 */
export async function pendingBooking(userId: string) {
  const [row] = await db
    .select({
      status: therapistRadar.status,
      sessionId: therapistRadar.pendingSessionId,
      pendingUntil: therapistRadar.pendingUntil,
    })
    .from(therapistRadar)
    .where(eq(therapistRadar.userId, userId))
    .limit(1);

  if (!row?.sessionId) return null;
  if (row.status !== "pending" && row.status !== "in_session") return null;
  if (row.status === "pending" && row.pendingUntil && row.pendingUntil < new Date()) return null;

  return { sessionId: row.sessionId, paid: row.status === "in_session" };
}

export async function notifyIncomingBooking(opts: {
  therapistUserId: string;
  sessionId: string;
  patientName: string;
}): Promise<void> {
  await db.insert(notifications).values({
    userId: opts.therapistUserId,
    kind: "system",
    title: "Someone is booking you on the radar",
    // First name only: this is a notification row, not a chart.
    body: `${opts.patientName.split(/\s+/)[0]} is paying for a session with you right now.`,
    actionUrl: `/sessions/${opts.sessionId}/room`,
  });
}

/**
 * Housekeeping, run by the cron.
 *
 * Not the safety net for double-booking — the claim UPDATE already handles an
 * expired pending. This exists so the *public list* stops advertising someone
 * whose claim lapsed, and so a closed laptop eventually reads as offline.
 */
export async function sweepRadar(): Promise<{
  released: number;
  offline: number;
  abandoned: number;
}> {
  const now = new Date();

  const released = await db
    .update(therapistRadar)
    .set({ status: "online", pendingSessionId: null, pendingUntil: null, updatedAt: now })
    .where(and(eq(therapistRadar.status, "pending"), lt(therapistRadar.pendingUntil, now)))
    .returning({ id: therapistRadar.id });

  /*
   * Bin the sessions nobody ever paid for.
   *
   * Every abandoned checkout leaves a `scheduled` session with a live join
   * token behind it. Harmless individually, but they accumulate in the
   * clinician's session list as bookings that never happened, and each one
   * carries a token that still works for its full three hours.
   */
  const abandoned = await db
    .update(sessions)
    .set({ status: "cancelled", joinToken: null, joinTokenExpiresAt: null, updatedAt: now })
    .where(
      and(
        eq(sessions.status, "scheduled"),
        eq(sessions.paymentStatus, "pending"),
        isNull(sessions.patientJoinedAt),
        lt(sessions.createdAt, new Date(now.getTime() - CLAIM_MINUTES * 60_000)),
      ),
    )
    .returning({ id: sessions.id });

  const offline = await db
    .update(therapistRadar)
    .set({ status: "offline", updatedAt: now })
    .where(
      and(
        eq(therapistRadar.status, "online"),
        or(
          isNull(therapistRadar.lastSeenAt),
          lt(therapistRadar.lastSeenAt, new Date(now.getTime() - HEARTBEAT_STALE_MS)),
        ),
      ),
    )
    .returning({ id: therapistRadar.id });

  if (released.length || offline.length || abandoned.length) {
    log.info("radar swept", {
      released: released.length,
      offline: offline.length,
      abandoned: abandoned.length,
    });
  }

  return {
    released: released.length,
    offline: offline.length,
    abandoned: abandoned.length,
  };
}

/** How many clinicians are bookable this second. Used by the public hero. */
export async function radarCount(): Promise<number> {
  const [row] = await db
    .select({ count: sql<number>`COUNT(*)::int` })
    .from(therapistRadar)
    .innerJoin(users, eq(users.id, therapistRadar.userId))
    .where(
      and(
        eq(therapistRadar.status, "online"),
        gte(therapistRadar.lastSeenAt, new Date(Date.now() - HEARTBEAT_STALE_MS)),
        isNull(users.deletedAt),
      ),
    );
  return row?.count ?? 0;
}

export function logRadarClaimFailure(therapistUserId: string): void {
  log.info("radar claim lost", { therapist: ref(therapistUserId) });
}
