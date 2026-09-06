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
import { HOLD_MS, isWholeHour, shouldAutoOffline } from "@/lib/scheduling/hours";
import { parseDayKey, usable, zonedHourToUtc } from "@/lib/scheduling/tz";

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
  | { ok: true; added: number; skipped: number; impossible: number }
  | { ok: false; error: string };

/**
 * A clinician opens hours. 11.1, rewritten for 11R.2.
 *
 * ## The hours are theirs, not the server's
 *
 * `days` are calendar days as `YYYY-MM-DD` and `fromHour`/`toHour` are
 * wall-clock hours **in `zone`** — the clinician's own. A therapist in Cairo
 * publishing 18:00–21:00 means their evening, which is 15:00Z in summer and
 * 16:00Z in winter; the old version stored 18:00Z both times, so half the year
 * their evening appeared at 20:00 Cairo and the other half at 19:00. The
 * clinician had no way to see that from this screen, because the screen
 * rendered the same UTC number back at them.
 *
 * `zonedHourToUtc` returns null for an hour that does not exist in that zone
 * (the spring-forward gap). Those are counted and reported rather than
 * silently dropped or coerced to the hour next door.
 *
 * `onConflictDoNothing` on the (therapist, hour) unique index, so republishing
 * an overlapping range adds the new hours and leaves the booked ones alone —
 * rather than failing the whole request because one Tuesday is already taken.
 */
export async function publishHours(input: {
  actor: Actor;
  /** `YYYY-MM-DD`, as picked. A calendar day, not an instant. */
  days: string[];
  fromHour: number;
  toHour: number;
  /** IANA. Required: there is no "publish in whatever zone the server is in". */
  zone: string;
}): Promise<PublishResult> {
  if (input.days.length === 0) return { ok: false, error: "Pick at least one day." };
  if (input.days.length > 60) return { ok: false, error: "Publish up to 60 days at a time." };
  if (!usable(input.zone)) return { ok: false, error: "We do not recognise that time zone." };

  const from = Math.trunc(input.fromHour);
  const to = Math.trunc(input.toHour);
  if (!Number.isInteger(from) || !Number.isInteger(to) || from < 0 || to > 24 || from >= to) {
    return { ok: false, error: "That is not a range of hours — the end must be after the start." };
  }

  const parsed = input.days.map(parseDayKey);
  if (parsed.some((day) => day === null)) {
    return { ok: false, error: "One of those dates is not a date." };
  }

  const wanted: Date[] = [];
  let impossible = 0;

  for (const day of parsed as { year: number; month: number; date: number }[]) {
    for (let hour = from; hour < to; hour += 1) {
      const at = zonedHourToUtc(day, hour, input.zone);
      if (at) wanted.push(at);
      else impossible += 1;
    }
  }

  if (wanted.length === 0) {
    return {
      ok: false,
      error:
        impossible > 0
          ? "Those hours do not exist where you are — the clocks go forward that morning."
          : "That is not a range of hours — the end must be after the start.",
    };
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

  return { ok: true, added: inserted.length, skipped, impossible };
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
  | {
      ok: true;
      sessionId: string;
      startsAt: Date;
      therapistName: string;
      /** For the confirmation's zone fallback. 11R.3. */
      therapistTimezone: string | null;
    }
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
  /** E.164 only. `toE164` is the one way a number gets here. 11R.12. */
  patientPhone?: string | null;
  patientTimezone?: string | null;
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
      therapistTimezone: users.timezone,
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
    timezone: input.patientTimezone ?? null,
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
    therapistTimezone: slot.therapistTimezone,
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
  timezone: string | null;
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
      timezone: input.timezone,
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

/* -------------------------------------------- 11R.22 releasing dead holds -- */

/**
 * How long a booking may sit unpaid before the hour goes back on the calendar.
 *
 * Twenty-four hours. Long enough that somebody who booked on a phone with a
 * declined card and came back the next morning still has their appointment;
 * short enough that a Tuesday evening is not held for a fortnight by a booking
 * that was never going to happen.
 */
export const UNCONFIRMED_AFTER_MS = 24 * 3_600_000;

/**
 * How close to the appointment we stop releasing it.
 *
 * Two hours. Below that, releasing the hour helps nobody: the patient may be
 * on their way, and the clinician cannot fill it. An unpaid session that close
 * is a conversation between the two of them, not a sweep's decision.
 */
export const UNCONFIRMED_GRACE_MS = 2 * 3_600_000;

export type ReleasedBooking = {
  slotId: string;
  sessionId: string;
  startsAt: Date;
  patientEmail: string | null;
  patientPhone: string | null;
  patientTimezone: string | null;
  therapistFirstName: string;
  therapistLastName: string | null;
  therapistTimezone: string | null;
};

/**
 * 11R.22 — put unconfirmed bookings back on the calendar.
 *
 * ## What "unconfirmed" means here, precisely
 *
 * A **paid** session (`price_cents > 0`) whose payment is still `pending`
 * twenty-four hours after it was created, and which is more than two hours
 * away. Nothing else. A free hour is never released, because there is nothing
 * to confirm; neither is one somebody already paid for; neither is one about
 * to start.
 *
 * ## Why a sweep and not an expiry compared at read time
 *
 * `held` slots expire by comparison — `openHours` treats a lapsed hold as
 * bookable — and that works because nobody is told about a hold. A booking is
 * different: the patient was sent a confirmation, so releasing it is an event
 * they have to hear about. An event needs something to run, and this is it.
 *
 * The rows are returned rather than notified from in here: `lib/data` does not
 * send messages, and the caller (the hourly cron) already owns the zone
 * resolution and the quiet window.
 */
export async function releaseUnconfirmedBookings(now = new Date()): Promise<ReleasedBooking[]> {
  const staleBefore = new Date(now.getTime() - UNCONFIRMED_AFTER_MS);
  const soonest = new Date(now.getTime() + UNCONFIRMED_GRACE_MS);

  const candidates = await db
    .select({
      slotId: availabilitySlots.id,
      sessionId: sessions.id,
      startsAt: availabilitySlots.startsAt,
      patientEmail: sql<string | null>`COALESCE(${patients.email}, ${sessions.guestEmail})`,
      patientPhone: patients.phone,
      patientTimezone: patients.timezone,
      therapistFirstName: users.firstName,
      therapistLastName: users.lastName,
      therapistTimezone: users.timezone,
    })
    .from(availabilitySlots)
    .innerJoin(sessions, eq(sessions.id, availabilitySlots.sessionId))
    .innerJoin(users, eq(users.id, availabilitySlots.therapistUserId))
    .leftJoin(patients, eq(patients.id, sessions.patientId))
    .where(
      and(
        eq(availabilitySlots.status, "booked"),
        eq(sessions.status, "scheduled"),
        eq(sessions.paymentStatus, "pending"),
        gt(sessions.priceCents, 0),
        lt(sessions.createdAt, staleBefore),
        gt(availabilitySlots.startsAt, soonest),
      ),
    )
    .limit(200);

  const released: ReleasedBooking[] = [];

  for (const row of candidates) {
    /*
     * Conditional on everything that made it a candidate, so a payment that
     * landed between the SELECT and here wins. The slot is only freed if this
     * UPDATE matched, and the session is only cancelled if the slot was freed
     * — in that order, so the failure mode is a cancelled session with no
     * slot (recoverable) rather than an open hour whose session still says
     * somebody is coming.
     */
    const [freed] = await db
      .update(availabilitySlots)
      .set({
        status: "open",
        sessionId: null,
        bookedByAccountId: null,
        // 🔴 §6 / C63 — the note is the patient's own words. It goes with the
        // booking rather than being edited, annotated or kept.
        note: null,
        remindedAt: null,
        updatedAt: now,
      })
      .where(
        and(
          eq(availabilitySlots.id, row.slotId),
          eq(availabilitySlots.status, "booked"),
          eq(availabilitySlots.sessionId, row.sessionId),
        ),
      )
      .returning({ id: availabilitySlots.id });

    if (!freed) continue;

    await db
      .update(sessions)
      .set({ status: "cancelled", updatedAt: now })
      .where(and(eq(sessions.id, row.sessionId), eq(sessions.paymentStatus, "pending")));

    released.push(row);
  }

  if (released.length > 0) {
    log.info("released unconfirmed bookings", { count: released.length });
  }

  return released;
}

/**
 * Who owns this hour, for the ceilings in the booking action. 11R.22.
 *
 * Read before the hold, because a per-clinician limit cannot be counted
 * against a clinician nobody has looked up yet.
 */
export async function slotOwner(slotId: string): Promise<string | null> {
  const [row] = await db
    .select({ therapistUserId: availabilitySlots.therapistUserId })
    .from(availabilitySlots)
    .where(eq(availabilitySlots.id, slotId))
    .limit(1);

  return row?.therapistUserId ?? null;
}

/* ------------------------------------------------------------- reminders -- */

/**
 * Bookings inside the reminder window that have not been reminded. 11R.15.
 *
 * ## The window, not a single daily pass
 *
 * The old job ran once at 03:20 UTC looking 24 hours ahead, which missed
 * everything booked after 03:20 for later the same day — C65 — and landed at
 * 05:20 in Cairo. This runs hourly and takes bookings **20 to 24 hours out**,
 * so each one is caught by exactly one run of the sweep. Anything booked
 * inside that window is picked up by `sameDayNeedingReminder` instead.
 *
 * ## "Not reminded" is a column now
 *
 * 🔴 It used to be derived from a ` [reminded]` marker appended to
 * `note` — the column holding the **patient's own words** about why they are
 * seeking help. §6: never edit text a patient wrote. `reminded_at` is the
 * flag; nothing appends to `note` ever again.
 */
export async function bookingsNeedingReminder(fromHours = 20, toHours = 24) {
  const now = new Date();
  const from = new Date(now.getTime() + fromHours * 3_600_000);
  const until = new Date(now.getTime() + toHours * 3_600_000);

  return db
    .select({
      slotId: availabilitySlots.id,
      startsAt: availabilitySlots.startsAt,
      sessionId: availabilitySlots.sessionId,
      therapistFirstName: users.firstName,
      therapistLastName: users.lastName,
      therapistTimezone: users.timezone,
      patientEmail: patients.email,
      patientPhone: patients.phone,
      patientFirstName: patients.firstName,
      patientTimezone: patients.timezone,
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
        gte(availabilitySlots.startsAt, from),
        lt(availabilitySlots.startsAt, until),
        isNull(availabilitySlots.remindedAt),
      ),
    )
    .limit(100);
}

/**
 * 11R.15 — anything booked *inside* the window, which the sweep above misses.
 *
 * A patient who books at 4pm for 7pm the same evening never enters the 20–24
 * hour band at all. They get one reminder as soon as the next hourly run sees
 * them, which is at most an hour later and usually much less.
 */
export async function sameDayNeedingReminder() {
  const now = new Date();
  const soon = new Date(now.getTime() + 20 * 3_600_000);

  return db
    .select({
      slotId: availabilitySlots.id,
      startsAt: availabilitySlots.startsAt,
      sessionId: availabilitySlots.sessionId,
      therapistFirstName: users.firstName,
      therapistLastName: users.lastName,
      therapistTimezone: users.timezone,
      patientEmail: patients.email,
      patientPhone: patients.phone,
      patientFirstName: patients.firstName,
      patientTimezone: patients.timezone,
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
        gt(availabilitySlots.startsAt, new Date(now.getTime() + 30 * 60_000)),
        lt(availabilitySlots.startsAt, soon),
        isNull(availabilitySlots.remindedAt),
      ),
    )
    .limit(100);
}

/**
 * Stamp a slot as reminded. 11R.6.
 *
 * 🔴 Writes `reminded_at`. It does **not** touch `note` — that column holds the
 * patient's own words, and §6 forbids editing them. This function replacing an
 * append is the whole of C63.
 */
export async function markReminded(slotId: string): Promise<void> {
  await db
    .update(availabilitySlots)
    .set({ remindedAt: new Date() })
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
