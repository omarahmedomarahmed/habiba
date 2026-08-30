import "server-only";

import { createHash } from "node:crypto";
import { and, eq, gte, isNull, lt, or, sql } from "drizzle-orm";

import type { Actor } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { notifications, sessions, therapistRadar, users } from "@/lib/db/schema";
import { RATINGS_VISIBLE_AFTER, therapistRatings } from "@/lib/data/feedback";
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
  region: string | null;
  city: string | null;
  /**
   * A door a patient may walk through.
   *
   * Only ever populated when the clinician turned walk-ins on *and* confirmed
   * the pin — an unconfirmed address is worse than no address, so it is not
   * published at all.
   */
  practice: {
    name: string | null;
    address: string;
    lat: string | null;
    lon: string | null;
  } | null;
  rateCents: number;
  /**
   * Star rating, or null until enough people have rated them.
   *
   * Withheld below the threshold on purpose: one bad night at 1.0 stars would
   * follow somebody around, and a single five-star rating is not evidence of
   * anything. A missing number is more honest than a meaningless one.
   */
  rating: { average: number; count: number } | null;
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
/**
 * Is this clinician's presence real, right now?
 *
 * One predicate, used by the listing, the reservation and the claim — because
 * it was written three times and only one of them knew about demonstration
 * accounts. The listing exempted them from the heartbeat; reserving and
 * claiming did not. So a seeded clinician appeared on the radar, and the
 * moment anyone opened their profile the reservation failed and the sheet
 * announced that somebody else had got there first. Nobody had. The booking
 * would have failed the same way a second later.
 *
 * A rule that decides whether a person can be reached has to live in exactly
 * one place, or the copies drift and the product lies about why.
 */
function reachable(now: Date) {
  return and(
    // A suspended clinician is unbookable even by a direct call to the action,
    // not merely hidden from the board.
    or(isNull(therapistRadar.suspendedUntil), lt(therapistRadar.suspendedUntil, now)),
    or(
      // Nothing is beating for a fixture, and nothing needs to.
      eq(therapistRadar.demo, true),
      gte(therapistRadar.lastSeenAt, new Date(now.getTime() - HEARTBEAT_STALE_MS)),
    ),
  );
}

/**
 * The board, shared between everyone looking at it.
 *
 * The public radar is polled every four seconds by every open tab, and each
 * poll used to be its own pair of queries. That makes the database's load a
 * function of how many people are on the marketing page — which is exactly
 * backwards, because the answer it computes is *the same for all of them*. Only
 * `reservedByYou` differs, and that is one comparison against a hash, done in
 * memory below.
 *
 * Two seconds, which is the number that matters and is chosen against
 * something specific: the client already polls at four, so the list a visitor
 * sees is at most six seconds old rather than four. It is not correctness that
 * absorbs the difference — it is that this list has never been the thing that
 * decides a booking. `reserveTherapist` re-reads availability inside the
 * atomic UPDATE, so a stale entry costs one honest "someone got there first"
 * and never a double-booking. If that were not already true, none of this
 * would be safe to cache for any length of time.
 *
 * Per lambda instance rather than shared, which means the saving scales with
 * concurrency rather than being a fixed win: one visitor sees no change, fifty
 * visitors on one instance collapse to the same two queries.
 */
const BOARD_TTL_MS = 2_000;

type Board = { rows: Awaited<ReturnType<typeof queryBoard>>; ratings: Map<string, { average: number; count: number }> };
let board: { at: number; value: Promise<Board> } | null = null;

/** Exposed so a booking that changes the board can invalidate it immediately. */
export function invalidateRadarBoard() {
  board = null;
}

async function loadBoard(): Promise<Board> {
  const fresh = Date.now();
  if (board && fresh - board.at < BOARD_TTL_MS) return board.value;

  /*
   * The promise is cached, not the result.
   *
   * Twenty requests arriving in the same millisecond on a cold cache would
   * otherwise each start their own pair of queries — a stampede that is worst
   * exactly when traffic is highest, which is the opposite of what a cache is
   * for. Storing the in-flight promise means they all wait on the first one.
   */
  const value = (async () => {
    const [rows, ratings] = await Promise.all([queryBoard(), therapistRatings()]);
    return { rows, ratings };
  })();

  board = { at: fresh, value };

  // A failure must not be cached, or one blip poisons the board for two
  // seconds and every retry inside that window returns the same rejection.
  value.catch(() => {
    if (board?.value === value) board = null;
  });

  return value;
}

export async function listRadar(viewer?: string | null): Promise<RadarTherapist[]> {
  const viewerHash = viewer ? hashViewer(viewer) : null;
  const { rows, ratings } = await loadBoard();
  return shapeBoard(rows, ratings, viewerHash);
}

async function queryBoard() {
  const now = new Date();

  const rows = await db
    .select({
      userId: users.id,
      organizationId: users.organizationId,
      firstName: users.firstName,
      lastName: users.lastName,
      profile: users.profile,
      rateCents: users.sessionRateCents,
      headline: therapistRadar.headline,
      photoUrl: therapistRadar.photoUrl,
      languages: therapistRadar.languages,
      specialties: therapistRadar.specialties,
      country: therapistRadar.country,
      region: therapistRadar.region,
      city: therapistRadar.city,
      practiceName: therapistRadar.practiceName,
      practiceAddress: therapistRadar.practiceAddress,
      practiceLat: therapistRadar.practiceLat,
      practiceLon: therapistRadar.practiceLon,
      practiceConfirmedAt: therapistRadar.practiceConfirmedAt,
      acceptsWalkIns: therapistRadar.acceptsWalkIns,
      status: therapistRadar.status,
      pendingUntil: therapistRadar.pendingUntil,
      pendingSessionId: therapistRadar.pendingSessionId,
      reservedBy: therapistRadar.reservedBy,
      demo: therapistRadar.demo,
      suspendedUntil: therapistRadar.suspendedUntil,
    })
    .from(therapistRadar)
    .innerJoin(users, eq(users.id, therapistRadar.userId))
    .where(
      and(
        isNull(users.deletedAt),
        eq(users.status, "active"),
        /*
         * A suspended clinician is off the board entirely — not shown busy,
         * not shown offline, not shown at all. Being visible with a reason
         * would publish a disciplinary fact about a named person to anonymous
         * strangers, which is nobody's business but ours and theirs.
         */
        reachable(now),
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

  return rows;
}

function shapeBoard(
  rows: Awaited<ReturnType<typeof queryBoard>>,
  ratings: Map<string, { average: number; count: number }>,
  viewerHash: string | null,
): RadarTherapist[] {
  const nowMs = Date.now();

  return rows.map((row) => {
    const lapsed = Boolean(row.pendingUntil && row.pendingUntil.getTime() < nowMs);
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
      region: row.region,
      city: row.city,
      practice:
        row.acceptsWalkIns && row.practiceConfirmedAt && row.practiceAddress
          ? {
              name: row.practiceName,
              address: row.practiceAddress,
              lat: row.practiceLat,
              lon: row.practiceLon,
            }
          : null,
      /*
       * The price they set, whatever Stripe thinks of them.
       *
       * This used to show a clinician as free until their connected account was
       * live, which was wrong in both directions: a patient was quoted nothing
       * and then met somebody who works for money, and a clinician waiting on
       * verification was advertised on a rate they never chose. The payment now
       * goes through either way — held by the platform if it has to be — so
       * there is no longer a price nobody can pay.
       */
      rateCents: row.rateCents,
      rating: (() => {
        const found = ratings.get(row.userId);
        return found && found.count >= RATINGS_VISIBLE_AFTER
          ? { average: Math.round(found.average * 10) / 10, count: found.count }
          : null;
      })(),
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
/**
 * Why a reservation failed, not just that it did.
 *
 * The sheet used to render a single message for every failure — "someone else
 * opened this profile a moment before you" — which was a guess presented as a
 * fact. Most of the time it was wrong: the clinician was stale, or suspended,
 * or already in a session, and there was no other visitor at all. Telling
 * somebody in distress that they lost a race that never happened is worse than
 * telling them nothing.
 */
export type ReservationOutcome = "held" | "taken" | "unavailable";

/**
 * One clinician, published, whether or not they are on shift.
 *
 * `listRadar` deliberately returns only people who are reachable right now —
 * that is what a board of live availability means. A profile is the opposite
 * promise: it is a link a clinician hands out, and a link that 404s every time
 * its owner logs off is not a link anybody can hand out. So this returns them
 * offline too, and says so.
 *
 * What it will not do is publish somebody who has been suspended. Being
 * visible with a reason attached would tell anonymous strangers a
 * disciplinary fact about a named person; being visible without one would
 * offer a booking that cannot complete. Neither is acceptable, so a suspended
 * clinician has no public profile at all.
 */
export type PublicProfile = Omit<RadarTherapist, "status"> & {
  status: RadarTherapist["status"] | "offline";
  /** Their own words. Longer than the one-line headline the board shows. */
  bio: string | null;
};

export async function publicProfile(
  userId: string,
  viewer?: string | null,
): Promise<PublicProfile | null> {
  const now = new Date();
  const viewerHash = viewer ? hashViewer(viewer) : null;

  const rows = await db
    .select({
      userId: users.id,
      organizationId: users.organizationId,
      firstName: users.firstName,
      lastName: users.lastName,
      profile: users.profile,
      rateCents: users.sessionRateCents,
      headline: therapistRadar.headline,
      photoUrl: therapistRadar.photoUrl,
      languages: therapistRadar.languages,
      specialties: therapistRadar.specialties,
      country: therapistRadar.country,
      region: therapistRadar.region,
      city: therapistRadar.city,
      practiceName: therapistRadar.practiceName,
      practiceAddress: therapistRadar.practiceAddress,
      practiceLat: therapistRadar.practiceLat,
      practiceLon: therapistRadar.practiceLon,
      practiceConfirmedAt: therapistRadar.practiceConfirmedAt,
      acceptsWalkIns: therapistRadar.acceptsWalkIns,
      status: therapistRadar.status,
      pendingUntil: therapistRadar.pendingUntil,
      pendingSessionId: therapistRadar.pendingSessionId,
      reservedBy: therapistRadar.reservedBy,
      demo: therapistRadar.demo,
      suspendedUntil: therapistRadar.suspendedUntil,
      lastSeenAt: therapistRadar.lastSeenAt,
    })
    .from(therapistRadar)
    .innerJoin(users, eq(users.id, therapistRadar.userId))
    .where(
      and(
        eq(users.id, userId),
        isNull(users.deletedAt),
        eq(users.status, "active"),
        eq(users.verificationStatus, "verified"),
        or(isNull(therapistRadar.suspendedUntil), lt(therapistRadar.suspendedUntil, now)),
      ),
    )
    .limit(1);

  const row = rows[0];
  if (!row) return null;

  const ratings = await therapistRatings();
  const [shaped] = shapeBoard([row], ratings, viewerHash);
  if (!shaped) return null;

  /*
   * `shapeBoard` assumes everything it is given is on the board, so it never
   * produces "offline". Here it has to: the row was fetched without the
   * reachability predicate, so the heartbeat is the only thing that says
   * whether this person is actually there.
   */
  const beating =
    row.lastSeenAt !== null &&
    row.lastSeenAt.getTime() >= now.getTime() - HEARTBEAT_STALE_MS;
  const stale = !row.demo && !beating;
  return {
    ...shaped,
    status: row.status === "offline" || stale ? "offline" : shaped.status,
    bio: row.profile?.bio ?? null,
  };
}

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
        reachable(now),
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

/**
 * The same reservation, with a reason when it does not happen.
 *
 * Costs one extra read, and only on the failure path — the happy path is still
 * the single atomic UPDATE that makes the whole radar safe.
 */
export async function reserveWithReason(opts: {
  therapistUserId: string;
  viewer: string;
}): Promise<ReservationOutcome> {
  if (await reserveTherapist(opts)) return "held";

  const now = new Date();
  const [row] = await db
    .select({
      status: therapistRadar.status,
      pendingUntil: therapistRadar.pendingUntil,
      suspendedUntil: therapistRadar.suspendedUntil,
      demo: therapistRadar.demo,
      lastSeenAt: therapistRadar.lastSeenAt,
    })
    .from(therapistRadar)
    .where(eq(therapistRadar.userId, opts.therapistUserId))
    .limit(1);

  if (!row) return "unavailable";

  const held = row.status === "pending" && row.pendingUntil && row.pendingUntil > now;
  // Someone genuinely is on this profile, or genuinely is paying for it.
  if (held) return "taken";

  return "unavailable";
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
 * Where the practice is, and whether the door is open.
 *
 * Separate from `saveRadarProfile` because the two forms are separate and,
 * more importantly, because the confirmation timestamp must only ever be set by
 * the path that actually showed the clinician a pin and asked. Folding this
 * into the general profile save would make "confirmed" mean "was in the request
 * body", which is the whole safeguard gone.
 */
export async function savePracticeLocation(
  actor: Actor,
  input: {
    practiceName: string | null;
    practiceAddress: string | null;
    practiceLat: string | null;
    practiceLon: string | null;
    country: string | null;
    region: string | null;
    city: string | null;
    acceptsWalkIns: boolean;
    confirmed: boolean;
  },
): Promise<void> {
  await ensureRadarProfile(actor);

  const { confirmed, ...rest } = input;

  await db
    .update(therapistRadar)
    .set({
      ...rest,
      // Clearing the address clears the confirmation with it — an old
      // timestamp against a new address is how a stale pin gets published.
      practiceConfirmedAt: confirmed && rest.practiceAddress ? new Date() : null,
      // And walk-ins cannot be on without somewhere to walk in to.
      acceptsWalkIns: rest.acceptsWalkIns && confirmed && Boolean(rest.practiceAddress),
      updatedAt: new Date(),
    })
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
        reachable(now),
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
  | { kind: "booking"; sessionId: string; patientName: string | null; waiting: boolean }
  /** Paid and on their way in. */
  | { kind: "confirmed"; sessionId: string; patientName: string | null; waiting: boolean };

export async function pendingBooking(userId: string): Promise<RadarAttention | null> {
  const [row] = await db
    .select({
      status: therapistRadar.status,
      sessionId: therapistRadar.pendingSessionId,
      pendingUntil: therapistRadar.pendingUntil,
      /*
       * Whether there is a person sitting in the room right now.
       *
       * This is the difference between "somebody has booked you" and "somebody
       * is waiting for you", and the alarm should not sound the same for both.
       * A patient who has joined and is watching an empty screen is the single
       * most urgent state this product has.
       */
      patientJoinedAt: sessions.patientJoinedAt,
      startedAt: sessions.startedAt,
      guestName: sessions.guestName,
    })
    .from(therapistRadar)
    .leftJoin(sessions, eq(sessions.id, therapistRadar.pendingSessionId))
    .where(eq(therapistRadar.userId, userId))
    .limit(1);

  if (!row) return null;

  const waiting = Boolean(row.patientJoinedAt && !row.startedAt);
  const patientName = row.guestName ?? null;

  if (row.status === "in_session") {
    return row.sessionId
      ? { kind: "confirmed", sessionId: row.sessionId, patientName, waiting }
      : null;
  }
  if (row.status !== "pending") return null;
  if (row.pendingUntil && row.pendingUntil < new Date()) return null;

  return row.sessionId
    ? { kind: "booking", sessionId: row.sessionId, patientName, waiting }
    : { kind: "viewing" };
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
        // Demonstration accounts never go stale — nothing is beating for them.
        eq(therapistRadar.demo, false),
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
