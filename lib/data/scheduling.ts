import "server-only";

import { and, asc, eq, gt, gte, isNull, lt, or, sql } from "drizzle-orm";

import { audit } from "@/lib/audit";
import type { Actor } from "@/lib/auth/session";
import { db } from "@/lib/db";
import {
  availabilitySlots,
  organizations,
  patients,
  sessions,
  users,
  type AvailabilitySlot,
} from "@/lib/db/schema";
import { log, ref, safeErrorMessage } from "@/lib/logger";
import { HOLD_MS, hoursOn, isWholeHour, shouldAutoOffline } from "@/lib/scheduling/hours";

/**
 * Bookable hours, and what happens when somebody takes one. PLAN.md 11.1–11.6.
 *
 * ## Concurrency is the whole problem
 *
 * Everything that changes a slot's state is a **conditional UPDATE** against
 * the state it is leaving. Two patients pressing "book" on the same Tuesday
 * evening at the same moment is the ordinary case, and the loser must be told
 * so rather than silently overwriting the winner. There is no read-then-write
 * anywhere in this module.
 */

/* ------------------------------------------------------------- publishing -- */

export type PublishResult =
  { ok: true; added: number; skipped: number } | { ok: false; error: string };

/**
 * A clinician opens hours. 11.1.
 *
 * `onConflictDoNothing` on the (therapist, hour) unique index, so republishing
 * an overlapping range adds the new hours and leaves the booked ones alone —
 * rather than failing the whole request because one Tuesday is already taken.
 */
export async function publishHours(input: {
  actor: Actor;
  days: Date[];
  fromHour: number;
  toHour: number;
}): Promise<PublishResult> {
  if (input.days.length === 0) return { ok: false, error: "Pick at least one day." };
  if (input.days.length > 60) return { ok: false, error: "Publish up to 60 days at a time." };

  const wanted = input.days.flatMap((day) => hoursOn(day, input.fromHour, input.toHour));
  if (wanted.length === 0) {
    return { ok: false, error: "That is not a range of hours — the end must be after the start." };
  }

  const now = new Date();
  const future = wanted.filter((at) => at.getTime() > now.getTime());
  const skipped = wanted.length - future.length;

  if (future.length === 0) {
    return { ok: false, error: "Those hours are all in the past." };
  }

  const inserted = await db
    .insert(availabilitySlots)
    .values(
      future.map((startsAt) => ({
        therapistUserId: input.actor.userId,
        organizationId: input.actor.organizationId,
        startsAt,
      })),
    )
    // An hour that already exists — open, held, booked or blocked — is left
    // exactly as it is. Republishing a week must never disturb a booking.
    .onConflictDoNothing({
      target: [availabilitySlots.therapistUserId, availabilitySlots.startsAt],
    })
    .returning({ id: availabilitySlots.id });

  return { ok: true, added: inserted.length, skipped };
}

/**
 * Withdraw an hour nobody has taken.
 *
 * Conditional on `status = 'open'`: a booked hour is an appointment somebody is
 * planning their week around, and it is cancelled — with a message — rather
 * than deleted out from under them. See `cancelBooking`.
 */
export async function withdrawHour(actor: Actor, slotId: string): Promise<boolean> {
  const removed = await db
    .delete(availabilitySlots)
    .where(
      and(
        eq(availabilitySlots.id, slotId),
        eq(availabilitySlots.therapistUserId, actor.userId),
        eq(availabilitySlots.status, "open"),
      ),
    )
    .returning({ id: availabilitySlots.id });

  return removed.length > 0;
}

/* ---------------------------------------------------------------- reading -- */

/** The clinician's own calendar, including what is booked. */
export async function myHours(actor: Actor, days = 28): Promise<AvailabilitySlot[]> {
  const until = new Date(Date.now() + days * 24 * 3_600_000);

  return db
    .select()
    .from(availabilitySlots)
    .where(
      and(
        eq(availabilitySlots.therapistUserId, actor.userId),
        gte(availabilitySlots.startsAt, new Date()),
        lt(availabilitySlots.startsAt, until),
      ),
    )
    .orderBy(asc(availabilitySlots.startsAt));
}

export type PublicSlot = { id: string; startsAt: Date };

/**
 * What a patient may book on a public profile. 11.3.
 *
 * `open`, or `held` with an expired hold — the expiry is compared here rather
 * than swept by a job, so an abandoned checkout frees its hour the moment it
 * runs out instead of at the next cron.
 */
export async function openHours(therapistUserId: string, days = 21): Promise<PublicSlot[]> {
  const now = new Date();
  const until = new Date(now.getTime() + days * 24 * 3_600_000);

  const rows = await db
    .select({ id: availabilitySlots.id, startsAt: availabilitySlots.startsAt })
    .from(availabilitySlots)
    .where(
      and(
        eq(availabilitySlots.therapistUserId, therapistUserId),
        gt(availabilitySlots.startsAt, now),
        lt(availabilitySlots.startsAt, until),
        or(
          eq(availabilitySlots.status, "open"),
          and(eq(availabilitySlots.status, "held"), lt(availabilitySlots.heldUntil, now)),
        ),
      ),
    )
    .orderBy(asc(availabilitySlots.startsAt))
    .limit(200);

  return rows;
}

/**
 * 11.5 — is this clinician about to be, or currently, in a booked hour?
 *
 * Read by the radar. Computed rather than stored: a boolean column would need
 * something to flip it, and whatever flipped it would be late exactly when it
 * mattered.
 */
export async function inBookedWindow(therapistUserId: string, now = new Date()): Promise<boolean> {
  const soon = await db
    .select({
      startsAt: availabilitySlots.startsAt,
      durationMinutes: availabilitySlots.durationMinutes,
    })
    .from(availabilitySlots)
    .where(
      and(
        eq(availabilitySlots.therapistUserId, therapistUserId),
        eq(availabilitySlots.status, "booked"),
        // A window either side, so the predicate sees the hour it is inside.
        gte(availabilitySlots.startsAt, new Date(now.getTime() - 3 * 3_600_000)),
        lt(availabilitySlots.startsAt, new Date(now.getTime() + 3_600_000)),
      ),
    );

  return shouldAutoOffline(soon, now);
}

/** 11.6 — the next booked hours, for the room's warning. */
export async function upcomingBookings(
  therapistUserId: string,
  withinMs = 60 * 60_000,
): Promise<{ startsAt: Date }[]> {
  const now = new Date();

  return db
    .select({ startsAt: availabilitySlots.startsAt })
    .from(availabilitySlots)
    .where(
      and(
        eq(availabilitySlots.therapistUserId, therapistUserId),
        eq(availabilitySlots.status, "booked"),
        gt(availabilitySlots.startsAt, now),
        lt(availabilitySlots.startsAt, new Date(now.getTime() + withinMs)),
      ),
    )
    .orderBy(asc(availabilitySlots.startsAt));
}

/* ---------------------------------------------------------------- booking -- */

export type HoldResult =
  { ok: true; slotId: string; heldUntil: Date } | { ok: false; error: string };

/**
 * Take an hour off the board while somebody pays. 11.3.
 *
 * One conditional UPDATE. The `WHERE` says "still bookable" — open, or held by
 * somebody whose hold has run out — so two patients racing produce one winner
 * and one honest refusal, decided by the database rather than by whichever
 * request read first.
 */
export async function holdSlot(slotId: string): Promise<HoldResult> {
  const now = new Date();
  const heldUntil = new Date(now.getTime() + HOLD_MS);

  const [held] = await db
    .update(availabilitySlots)
    .set({ status: "held", heldUntil, updatedAt: now })
    .where(
      and(
        eq(availabilitySlots.id, slotId),
        gt(availabilitySlots.startsAt, now),
        or(
          eq(availabilitySlots.status, "open"),
          and(eq(availabilitySlots.status, "held"), lt(availabilitySlots.heldUntil, now)),
        ),
      ),
    )
    .returning({ id: availabilitySlots.id });

  if (!held) return { ok: false, error: "Somebody just took that time. Pick another." };
  return { ok: true, slotId: held.id, heldUntil };
}

export type BookResult =
  | { ok: true; sessionId: string; startsAt: Date; therapistName: string }
  | { ok: false; error: string };

/**
 * Turn a held hour into a real session. 11.2 / 11.3.
 *
 * Creates the `sessions` row with `scheduledAt` set and `startedAt` null —
 * the gap between those two is what sprint 12 reads to decide whether anybody
 * turned up, so collapsing them would make no-show recovery unanswerable.
 */
export async function bookSlot(input: {
  slotId: string;
  patientName: string;
  patientEmail?: string | null;
  patientPhone?: string | null;
  accountId?: string | null;
  note?: string | null;
}): Promise<BookResult> {
  const now = new Date();

  const [slot] = await db
    .select({
      id: availabilitySlots.id,
      startsAt: availabilitySlots.startsAt,
      status: availabilitySlots.status,
      heldUntil: availabilitySlots.heldUntil,
      therapistUserId: availabilitySlots.therapistUserId,
      organizationId: availabilitySlots.organizationId,
      therapistFirstName: users.firstName,
      therapistLastName: users.lastName,
      rateCents: users.sessionRateCents,
    })
    .from(availabilitySlots)
    .innerJoin(users, eq(users.id, availabilitySlots.therapistUserId))
    .where(eq(availabilitySlots.id, input.slotId))
    .limit(1);

  if (!slot) return { ok: false, error: "That time is no longer on the calendar." };
  if (slot.startsAt.getTime() <= now.getTime()) {
    return { ok: false, error: "That time has already passed." };
  }

  const name = input.patientName.trim();
  if (!name) return { ok: false, error: "Please enter your first name." };

  /*
   * The patient row, found or created. Matched on email within this
   * clinician's caseload only — never across organisations, which is the
   * merge C39 measured going wrong.
   */
  const patientId = await findOrCreatePatient({
    organizationId: slot.organizationId,
    therapistId: slot.therapistUserId,
    name,
    email: input.patientEmail ?? null,
    phone: input.patientPhone ?? null,
  });

  const [created] = await db
    .insert(sessions)
    .values({
      organizationId: slot.organizationId,
      therapistId: slot.therapistUserId,
      patientId,
      status: "scheduled",
      modality: "video",
      // 11.2 / C57. `startedAt` stays null until somebody actually joins.
      scheduledAt: slot.startsAt,
      priceCents: slot.rateCents ?? 0,
      paymentStatus: (slot.rateCents ?? 0) > 0 ? "pending" : "not_required",
    })
    .returning({ id: sessions.id });

  if (!created) return { ok: false, error: "That booking could not be saved. Try again." };

  /*
   * The claim on the hour, conditional on it still being takeable. If this
   * matches nothing, somebody else won the race — the session row is left
   * behind rather than rolled back, because a cancelled `scheduled` session
   * with no slot is recoverable and a half-booked hour is not.
   */
  const [booked] = await db
    .update(availabilitySlots)
    .set({
      status: "booked",
      sessionId: created.id,
      bookedByAccountId: input.accountId ?? null,
      note: input.note?.trim() || null,
      heldUntil: null,
      updatedAt: now,
    })
    .where(
      and(
        eq(availabilitySlots.id, input.slotId),
        or(eq(availabilitySlots.status, "open"), eq(availabilitySlots.status, "held")),
      ),
    )
    .returning({ id: availabilitySlots.id });

  if (!booked) {
    await db
      .update(sessions)
      .set({ status: "cancelled", updatedAt: now })
      .where(eq(sessions.id, created.id));
    return { ok: false, error: "Somebody just took that time. Pick another." };
  }

  log.info("slot booked", { slot: ref(input.slotId), session: ref(created.id) });

  return {
    ok: true,
    sessionId: created.id,
    startsAt: slot.startsAt,
    therapistName: [slot.therapistFirstName, slot.therapistLastName].filter(Boolean).join(" "),
  };
}

/**
 * Cancel a booking, from either side.
 *
 * The hour goes back to `open` rather than disappearing: a clinician who
 * cancels one appointment has not withdrawn the hour, and a patient cancelling
 * frees it for somebody else. The session is cancelled, never deleted (§6).
 */
export async function cancelBooking(input: {
  slotId: string;
  by: "therapist" | "patient";
  actor?: Actor;
  accountId?: string | null;
}): Promise<{ ok: true; sessionId: string | null } | { ok: false; error: string }> {
  const now = new Date();

  const [cancelled] = await db
    .update(availabilitySlots)
    .set({ status: "open", sessionId: null, bookedByAccountId: null, note: null, updatedAt: now })
    .where(
      and(
        eq(availabilitySlots.id, input.slotId),
        eq(availabilitySlots.status, "booked"),
        // Whoever is cancelling must own their side of it.
        input.by === "therapist"
          ? eq(availabilitySlots.therapistUserId, input.actor?.userId ?? "")
          : eq(availabilitySlots.bookedByAccountId, input.accountId ?? ""),
      ),
    )
    .returning({ id: availabilitySlots.id, sessionId: availabilitySlots.sessionId });

  if (!cancelled) return { ok: false, error: "That booking is no longer active." };

  if (cancelled.sessionId) {
    await db
      .update(sessions)
      .set({ status: "cancelled", updatedAt: now })
      .where(and(eq(sessions.id, cancelled.sessionId), eq(sessions.status, "scheduled")));
  }

  await audit({
    actor: input.by === "therapist" ? (input.actor ?? null) : null,
    patientAccountId: input.by === "patient" ? (input.accountId ?? null) : null,
    category: "clinical",
    action: "booking.cancelled",
    resourceType: "availability_slot",
    resourceId: input.slotId,
  });

  return { ok: true, sessionId: cancelled.sessionId };
}

/* ------------------------------------------------------------ the patient -- */

async function findOrCreatePatient(input: {
  organizationId: string;
  therapistId: string;
  name: string;
  email: string | null;
  phone: string | null;
}): Promise<string> {
  const email = input.email?.trim().toLowerCase() || null;

  if (email) {
    const [existing] = await db
      .select({ id: patients.id })
      .from(patients)
      .where(
        and(
          eq(patients.organizationId, input.organizationId),
          eq(patients.therapistId, input.therapistId),
          eq(patients.email, email),
          isNull(patients.deletedAt),
        ),
      )
      .limit(1);

    if (existing) return existing.id;
  }

  const [first, ...rest] = input.name.split(/\s+/);

  const [created] = await db
    .insert(patients)
    .values({
      organizationId: input.organizationId,
      therapistId: input.therapistId,
      firstName: first ?? input.name,
      lastName: rest.join(" ") || null,
      email,
      phone: input.phone?.trim() || null,
      source: "join_link",
    })
    .returning({ id: patients.id });

  // Every patient gets a person (5.1). Best-effort: a booking must not fail
  // because an identity row was slow.
  if (created) {
    try {
      const { ensurePersonForPatient } = await import("./people");
      await ensurePersonForPatient(created.id);
    } catch (error) {
      log.warn("person creation after booking failed", { reason: safeErrorMessage(error) });
    }
  }

  return created!.id;
}

/* ------------------------------------------------------------- reminders -- */

/**
 * Bookings starting inside the next window that have not been reminded.
 *
 * "Not reminded" is derived from the note column rather than a flag, so the
 * cron is idempotent without another migration: a slot whose note already
 * carries the marker is skipped. Crude, and honest about being crude — a
 * dedicated column is the right shape once there is a second kind of reminder.
 */
export async function bookingsNeedingReminder(withinHours = 24) {
  const now = new Date();
  const until = new Date(now.getTime() + withinHours * 3_600_000);

  return db
    .select({
      slotId: availabilitySlots.id,
      startsAt: availabilitySlots.startsAt,
      sessionId: availabilitySlots.sessionId,
      therapistFirstName: users.firstName,
      therapistLastName: users.lastName,
      patientEmail: patients.email,
      patientPhone: patients.phone,
      patientFirstName: patients.firstName,
      practice: organizations.name,
    })
    .from(availabilitySlots)
    .innerJoin(users, eq(users.id, availabilitySlots.therapistUserId))
    .innerJoin(organizations, eq(organizations.id, availabilitySlots.organizationId))
    .leftJoin(sessions, eq(sessions.id, availabilitySlots.sessionId))
    .leftJoin(patients, eq(patients.id, sessions.patientId))
    .where(
      and(
        eq(availabilitySlots.status, "booked"),
        gt(availabilitySlots.startsAt, now),
        lt(availabilitySlots.startsAt, until),
        or(isNull(availabilitySlots.note), sql`${availabilitySlots.note} NOT LIKE '%[reminded]%'`),
      ),
    )
    .limit(100);
}

/** Stamp a slot as reminded. See the note above about the marker. */
export async function markReminded(slotId: string): Promise<void> {
  await db
    .update(availabilitySlots)
    .set({ note: sql`COALESCE(${availabilitySlots.note}, '') || ' [reminded]'` })
    .where(eq(availabilitySlots.id, slotId));
}

/* ------------------------------------------------------------------ misc -- */

/** Guard used by the actions. The DB has the same CHECK; this is the message. */
export function hourProblem(at: Date): string | null {
  if (!isWholeHour(at)) return "Sessions start on the hour — 19:00, not 19:15.";
  if (at.getTime() <= Date.now()) return "That time has already passed.";
  return null;
}

/** For the verifier and the console. */
export async function slotCounts(therapistUserId?: string) {
  const [row] = await db
    .select({
      open: sql<number>`COUNT(*) FILTER (WHERE status = 'open')::int`,
      held: sql<number>`COUNT(*) FILTER (WHERE status = 'held')::int`,
      booked: sql<number>`COUNT(*) FILTER (WHERE status = 'booked')::int`,
    })
    .from(availabilitySlots)
    .where(therapistUserId ? eq(availabilitySlots.therapistUserId, therapistUserId) : sql`true`);

  return row ?? { open: 0, held: 0, booked: 0 };
}
