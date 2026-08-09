import "server-only";

import { createHash } from "node:crypto";
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

/**
 * How long an open booking sheet holds a clinician.
 *
 * Short on purpose. Someone reading a profile should not be able to take a
 * clinician out of circulation for ten minutes by leaving a tab open, and the
 * person in the sheet is told the clock is running and why.
 */
export const RESERVATION_SECONDS = 60;

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
  /**
   * True when the pending state is *this* visitor's own reservation. The
   * difference between "someone is booking them" and "you are booking them",
   * which the UI absolutely has to be able to tell apart.
   */
  reservedByYou: boolean;
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
export async function listRadar(viewer?: string | null): Promise<RadarTherapist[]> {
  const fresh = new Date(Date.now() - HEARTBEAT_STALE_MS);
  const viewerHash = viewer ? hashViewer(viewer) : null;

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
      pendingSessionId: therapistRadar.pendingSessionId,
      reservedBy: therapistRadar.reservedBy,
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

  return rows.map((row) => {
    const lapsed = Boolean(row.pendingUntil && row.pendingUntil.getTime() < now);
    // An expired claim reads as available, because that is what the claiming
    // UPDATE will decide a moment later. Showing "booking" for a claim that has
    // already lapsed sends people away from someone who is free.
    const status = row.status === "pending" && lapsed ? "online" : row.status;

    return {
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
      // A clinician who has not finished Stripe onboarding cannot be charged
      // for, so they are shown as free rather than a price nobody can pay.
      rateCents: row.chargesEnabled ? row.rateCents : 0,
      status: status as "online" | "pending" | "in_session",
      reservedByYou:
        Boolean(viewerHash) && !lapsed && row.reservedBy === viewerHash && row.status === "pending",
    };
  });
}

/**
 * Reservations are keyed on a hash, not the raw id.
 *
 * The id is generated in the visitor's browser and never means anything to us
 * beyond "the same tab as before"; there is no reason to keep the original.
 */
export function hashViewer(viewer: string): string {
  return createHash("sha256").update(`radar-viewer:${viewer}`).digest("base64url").slice(0, 24);
}

/**
 * Hold a clinician while their booking sheet is open.
 *
 * Same shape as the booking claim, and for the same reason: the WHERE clause is
 * the precondition, so two visitors opening the sheet at the same instant
 * cannot both hold it. The extra term is `reserved_by = $viewer`, which lets
 * the holder renew their own reservation — without it, the heartbeat that keeps
 * the sheet alive would immediately fail against the reservation it just made.
 */
export async function reserveTherapist(opts: {
  therapistUserId: string;
  viewer: string;
}): Promise<boolean> {
  const now = new Date();
  const hash = hashViewer(opts.viewer);

  const reserved = await db
    .update(therapistRadar)
    .set({
      status: "pending",
      reservedBy: hash,
      // Taking over a lapsed booking must not leave its session id behind, or
      // the row would look like a live checkout to everything downstream.
      pendingSessionId: null,
      pendingUntil: new Date(now.getTime() + RESERVATION_SECONDS * 1000),
      updatedAt: now,
    })
    .where(
      and(
        eq(therapistRadar.userId, opts.therapistUserId),
        gte(therapistRadar.lastSeenAt, new Date(now.getTime() - HEARTBEAT_STALE_MS)),
        or(
          eq(therapistRadar.status, "online"),
          // Anything whose clock has run out, booking or reservation alike.
          and(eq(therapistRadar.status, "pending"), lt(therapistRadar.pendingUntil, now)),
          // My own reservation, renewed. Never a live booking — a reader must
          // not be able to displace someone already entering their card.
          and(
            eq(therapistRadar.status, "pending"),
            isNull(therapistRadar.pendingSessionId),
            eq(therapistRadar.reservedBy, hash),
          ),
        ),
      ),
    )
    .returning({ id: therapistRadar.id });

  return reserved.length > 0;
}

/** Give the clinician straight back when the sheet closes. */
export async function releaseReservation(opts: {
  therapistUserId: string;
  viewer: string;
}): Promise<void> {
  await db
    .update(therapistRadar)
    .set({ status: "online", reservedBy: null, pendingUntil: null, updatedAt: new Date() })
    .where(
      and(
        eq(therapistRadar.userId, opts.therapistUserId),
        eq(therapistRadar.status, "pending"),
        eq(therapistRadar.reservedBy, hashViewer(opts.viewer)),
        // Only a viewing reservation. Once it has become a real booking the
        // sheet closing must not cancel it.
        isNull(therapistRadar.pendingSessionId),
      ),
    );
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
  /** The reservation this booking is upgrading, if the sheet took one. */
  viewer?: string | null;
}): Promise<boolean> {
  const now = new Date();
  const until = new Date(now.getTime() + CLAIM_MINUTES * 60_000);
  const hash = opts.viewer ? hashViewer(opts.viewer) : null;

  /*
   * Three ways in, and the third one is the bug fix.
   *
   * 1. `online` — the obvious case.
   * 2. Anything pending whose clock has run out. This is what makes an
   *    abandoned checkout self-healing without waiting for a sweep, and it
   *    must keep working for lapsed *bookings*, not just lapsed reservations.
   * 3. **My own live viewing reservation.** Without this term, opening the
   *    sheet locked the clinician against the only person allowed to book
   *    them, which is exactly what happened in production. Restricted to
   *    reservations (`pending_session_id IS NULL`) so that a booking already
   *    at the checkout cannot be re-claimed even by its own holder.
   */
  const expired = and(eq(therapistRadar.status, "pending"), lt(therapistRadar.pendingUntil, now));

  const claimable = hash
    ? or(
        eq(therapistRadar.status, "online"),
        expired,
        and(
          eq(therapistRadar.status, "pending"),
          isNull(therapistRadar.pendingSessionId),
          eq(therapistRadar.reservedBy, hash),
        ),
      )
    : or(eq(therapistRadar.status, "online"), expired);

  const claimed = await db
    .update(therapistRadar)
    .set({
      status: "pending",
      pendingSessionId: opts.sessionId,
      pendingUntil: until,
      reservedBy: hash,
      updatedAt: now,
    })
    .where(
      and(
        eq(therapistRadar.userId, opts.therapistUserId),
        gte(therapistRadar.lastSeenAt, new Date(now.getTime() - HEARTBEAT_STALE_MS)),
        claimable,
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
    .set({
      status: "online",
      pendingSessionId: null,
      pendingUntil: null,
      reservedBy: null,
      updatedAt: new Date(),
    })
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
    .set({ status: "in_session", pendingUntil: null, reservedBy: null, updatedAt: new Date() })
    .where(
      and(eq(therapistRadar.pendingSessionId, sessionId), eq(therapistRadar.status, "pending")),
    );
}

/**
 * The therapist's own view of an incoming booking. Polled by the console, which
 * is what triggers the alert sound.
 */
export type RadarAttention =
  /** Someone has their profile open and is deciding. No session exists yet. */
  | { kind: "viewing" }
  /** They submitted the form; a session exists and payment is in flight. */
  | { kind: "booking"; sessionId: string }
  /** Paid and on their way in. */
  | { kind: "confirmed"; sessionId: string };

export async function pendingBooking(userId: string): Promise<RadarAttention | null> {
  const [row] = await db
    .select({
      status: therapistRadar.status,
      sessionId: therapistRadar.pendingSessionId,
      pendingUntil: therapistRadar.pendingUntil,
    })
    .from(therapistRadar)
    .where(eq(therapistRadar.userId, userId))
    .limit(1);

  if (!row) return null;
  if (row.status === "in_session") {
    return row.sessionId ? { kind: "confirmed", sessionId: row.sessionId } : null;
  }
  if (row.status !== "pending") return null;
  if (row.pendingUntil && row.pendingUntil < new Date()) return null;

  return row.sessionId ? { kind: "booking", sessionId: row.sessionId } : { kind: "viewing" };
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
    .set({
      status: "online",
      pendingSessionId: null,
      pendingUntil: null,
      reservedBy: null,
      updatedAt: now,
    })
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
