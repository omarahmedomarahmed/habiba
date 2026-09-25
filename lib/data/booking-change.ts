import "server-only";

import { and, eq, gt, isNull, lt, or, sql } from "drizzle-orm";

import { audit } from "@/lib/audit";
import type { Actor } from "@/lib/auth/session";
import { controlDb } from "@/lib/db";
import {
  availabilitySlots,
  notifications,
  patients,
  sessionPayments,
  sessions,
  users,
} from "@/lib/db/schema";
import { en, type MessageKey } from "@/lib/i18n/messages";
import { log, ref } from "@/lib/logger";
import { notify } from "@/lib/notify";
import { insideFreeWindow, placeFits } from "@/lib/scheduling/cancel-window";
import { formatWhenWithCaveat, resolveZone } from "@/lib/scheduling/tz";
import { getSettings } from "@/lib/settings";

/**
 * 🔴 RULING 16: A PATIENT CANCELS OR MOVES A BOOKING; A CLINICIAN MOVES ONE.
 *
 *   - Cancelled at least `rules.refunds.patientCancelWindowHours` before the
 *     start: refunded in full through `refundSessionPayment`, which returns a
 *     company's share to its pot and the patient's own share by its own rail
 *     (card, gateway, or the manual refund queue for a transfer).
 *   - Later: cancelled, and the money stays with the clinician
 *     (`late_cancel = 'held'`) unless the clinician agrees to return it
 *     (`agreeLateRefund`, one conditional UPDATE to `refunded`).
 *   - Moved: to another open hour of the same clinician, never charged again.
 *     A patient may move only inside the free window; a clinician any time
 *     before the start, and the patient is told.
 *
 * Every state change is a conditional UPDATE against the state it leaves, so
 * two presses make one cancellation and one refund, never two.
 */

const db = controlDb;

export type ChangeResult =
  | { ok: true; refund?: "refunded" | "queued" | "none" | "held" }
  | { ok: false; error: MessageKey };

type Booking = {
  id: string;
  therapistId: string;
  organizationId: string;
  status: string;
  modality: string;
  scheduledAt: Date | null;
  startedAt: Date | null;
  lateCancel: "held" | "refunded" | null;
  personId: string | null;
  patientEmail: string | null;
  patientPhone: string | null;
  patientTimezone: string | null;
  guestEmail: string | null;
};

async function bookingFor(sessionId: string): Promise<Booking | null> {
  const [row] = await db
    .select({
      id: sessions.id,
      therapistId: sessions.therapistId,
      organizationId: sessions.organizationId,
      status: sessions.status,
      modality: sessions.modality,
      scheduledAt: sessions.scheduledAt,
      startedAt: sessions.startedAt,
      lateCancel: sessions.lateCancel,
      personId: patients.personId,
      patientEmail: patients.email,
      patientPhone: patients.phone,
      patientTimezone: patients.timezone,
      guestEmail: sessions.guestEmail,
    })
    .from(sessions)
    .leftJoin(patients, eq(patients.id, sessions.patientId))
    .where(eq(sessions.id, sessionId))
    .limit(1);
  return row ?? null;
}

/** A booking that is still ahead and still changeable. */
function changeable(booking: Booking | null, now: Date): booking is Booking & { scheduledAt: Date } {
  return Boolean(
    booking &&
      booking.status === "scheduled" &&
      booking.startedAt === null &&
      booking.scheduledAt &&
      booking.scheduledAt.getTime() > now.getTime(),
  );
}

async function paidPaymentOf(sessionId: string): Promise<string | null> {
  const [payment] = await db
    .select({ id: sessionPayments.id })
    .from(sessionPayments)
    .where(and(eq(sessionPayments.sessionId, sessionId), eq(sessionPayments.status, "paid")))
    .limit(1);
  return payment?.id ?? null;
}

/**
 * Give a patient's money back, and say how. The same mapping the clinician's
 * cancellation uses (`afterClinicianCancel`): "refunded" only when something
 * went back to the patient themselves.
 */
async function refundPatient(input: {
  paymentId: string;
  reason: string;
  by: string | null;
}): Promise<"refunded" | "queued" | "none"> {
  const { refundSessionPayment } = await import("@/lib/billing/connect");
  const result = await refundSessionPayment({
    paymentId: input.paymentId,
    reason: input.reason.slice(0, 200),
    adminUserId: input.by,
    why: "patient_cancel",
  });
  if (result.error) {
    log.error("patient cancellation not refunded automatically, queued", {
      payment: ref(input.paymentId),
      reason: result.error,
    });
    const { openRefundRequest } = await import("@/lib/billing/refunds");
    await openRefundRequest({
      sessionPaymentId: input.paymentId,
      requestedByUserId: input.by,
      reason: "patient_cancel",
    });
    return "queued";
  }
  if (result.queuedCents) return "queued";
  return result.toPayerCents === 0 ? "none" : "refunded";
}

async function therapistContact(therapistId: string) {
  const [row] = await db
    .select({
      email: users.email,
      profile: users.profile,
      timezone: users.timezone,
      firstName: users.firstName,
      lastName: users.lastName,
    })
    .from(users)
    .where(eq(users.id, therapistId))
    .limit(1);
  return row ?? null;
}

/** An in-app line for the clinician, and the same by email and WhatsApp. */
async function tellTherapist(input: {
  therapistId: string;
  kind: "booking.patient_cancelled" | "booking.patient_moved";
  title: string;
  body: string;
  when: Date;
}): Promise<void> {
  const therapist = await therapistContact(input.therapistId);
  if (!therapist) return;
  await db.insert(notifications).values({
    userId: input.therapistId,
    kind: "system",
    title: input.title,
    body: input.body,
    actionUrl: "/bookings",
  });
  const when = formatWhenWithCaveat(input.when, resolveZone(therapist.timezone), "en");
  await notify(
    {
      email: therapist.email,
      phone: therapist.profile?.phone ?? null,
      timezone: therapist.timezone,
    },
    {
      kind: input.kind,
      subject: input.title,
      body: `${input.body}\n\n${when}`,
      /* The template carries the time only: no patient name on a lock screen. */
      variables: [when],
    },
  );
}

/* ---------------------------------------------------------------- cancel -- */

/**
 * The patient cancels their own booking. Ruling 16.
 *
 * Proof of being the patient is the signed-in person, whose `people` row the
 * session's patient file must point at. An id alone proves nothing.
 */
export async function patientCancel(input: {
  personId: string;
  accountId: string | null;
  sessionId: string;
  now?: Date;
}): Promise<ChangeResult> {
  const now = input.now ?? new Date();
  const booking = await bookingFor(input.sessionId);
  if (!booking || booking.personId !== input.personId) return { ok: false, error: "pchange.errGone" };
  if (!changeable(booking, now)) return { ok: false, error: "pchange.errGone" };

  const hours = (await getSettings()).rules.refunds.patientCancelWindowHours;
  const free = insideFreeWindow(booking.scheduledAt, now, hours);
  const paymentId = await paidPaymentOf(booking.id);

  /*
   * 🔴 THE ONE WRITE THAT DECIDES. `status = 'scheduled'` and no start in the
   * WHERE, so a second press, a clinician starting the session, or a sweep in
   * the same second makes this match nothing, and nothing below runs twice.
   */
  const [cancelled] = await db
    .update(sessions)
    .set({
      status: "cancelled",
      cancelledBy: "patient",
      cancelledAt: now,
      lateCancel: paymentId && !free ? "held" : null,
      updatedAt: now,
    })
    .where(
      and(
        eq(sessions.id, booking.id),
        eq(sessions.status, "scheduled"),
        isNull(sessions.startedAt),
      ),
    )
    .returning({ id: sessions.id });
  if (!cancelled) return { ok: false, error: "pchange.errGone" };

  /* The hour goes back on the calendar for somebody else. */
  await db
    .update(availabilitySlots)
    .set({ status: "open", sessionId: null, bookedByAccountId: null, note: null, remindedAt: null, updatedAt: now })
    .where(and(eq(availabilitySlots.sessionId, booking.id), eq(availabilitySlots.status, "booked")));

  let refund: "refunded" | "queued" | "none" | "held" = "none";
  if (paymentId && free) {
    refund = await refundPatient({
      paymentId,
      reason: "Cancelled by the patient inside the free window",
      by: null,
    });
  } else if (paymentId) {
    refund = "held";
  }

  await audit({
    actor: null,
    patientAccountId: input.accountId,
    category: "clinical",
    action: "booking.cancelled_by_patient",
    resourceType: "session",
    resourceId: booking.id,
    reason: refund,
  });
  log.info("patient cancelled a booking", { session: ref(booking.id), refund });

  await tellTherapist({
    therapistId: booking.therapistId,
    kind: "booking.patient_cancelled",
    title: en["tchange.patientCancelled"],
    body: refund === "held" ? en["tchange.patientCancelledLate"] : en["tchange.patientCancelledFree"],
    when: booking.scheduledAt,
  });

  return { ok: true, refund };
}

/**
 * The clinician agrees to refund a late cancellation anyway. Ruling 16's
 * "unless the therapist agrees". `held` to `refunded` in one conditional
 * UPDATE scoped to their own session: only one press refunds.
 */
export async function agreeLateRefund(actor: Actor, sessionId: string): Promise<ChangeResult> {
  const [agreed] = await db
    .update(sessions)
    .set({ lateCancel: "refunded", updatedAt: new Date() })
    .where(
      and(
        eq(sessions.id, sessionId),
        eq(sessions.therapistId, actor.userId),
        eq(sessions.lateCancel, "held"),
        eq(sessions.status, "cancelled"),
      ),
    )
    .returning({ id: sessions.id });
  if (!agreed) return { ok: false, error: "pchange.errGone" };

  const paymentId = await paidPaymentOf(sessionId);
  const refund = paymentId
    ? await refundPatient({
        paymentId,
        reason: "Late cancellation, refunded with the clinician's agreement",
        by: actor.userId,
      })
    : "none";

  await audit({
    actor,
    category: "billing",
    action: "booking.late_refund_agreed",
    resourceType: "session",
    resourceId: sessionId,
    reason: refund,
  });

  const booking = await bookingFor(sessionId);
  if (booking) {
    await notify(
      {
        personId: booking.personId,
        email: booking.patientEmail ?? booking.guestEmail,
        phone: booking.patientPhone,
        timezone: booking.patientTimezone,
        organizationId: booking.organizationId,
      },
      {
        kind: "booking.cancelled",
        notice: { kind: "session_cancelled", key: "pnotice.lateRefunded", sessionId },
        subject: en["pnotice.lateRefunded"],
        body: [en["pnotice.lateRefunded"], refund === "queued" ? en["w1a.refundOwedBody"] : ""]
          .filter(Boolean)
          .join("\n\n"),
      },
    );
  }
  return { ok: true, refund };
}

/** Late cancellations still holding money, for the clinician's bookings page. */
export async function heldLateCancellations(actor: Actor) {
  return db
    .select({
      sessionId: sessions.id,
      scheduledAt: sessions.scheduledAt,
      cancelledAt: sessions.cancelledAt,
      firstName: patients.firstName,
      lastName: patients.lastName,
      guestName: sessions.guestName,
    })
    .from(sessions)
    .leftJoin(patients, eq(patients.id, sessions.patientId))
    .where(and(eq(sessions.therapistId, actor.userId), eq(sessions.lateCancel, "held")))
    .limit(50);
}

/* ------------------------------------------------------------------ move -- */

export type Mover =
  | { kind: "patient"; personId: string; accountId: string | null }
  | { kind: "therapist"; actor: Actor };

/**
 * Move a booking to another open hour of the same clinician. Never charged
 * again: the payment stays on the session, and only the time changes.
 *
 * One transaction, three conditional UPDATEs: the new hour from open to
 * booked (it may have just been taken), the old hour from booked to open
 * (only while it still holds this session), and the session's time (only
 * while it is still the time it was). Any one matching nothing undoes all.
 */
export async function rescheduleBooking(input: {
  sessionId: string;
  toSlotId: string;
  by: Mover;
  now?: Date;
}): Promise<ChangeResult> {
  const now = input.now ?? new Date();
  const booking = await bookingFor(input.sessionId);
  if (!changeable(booking, now)) return { ok: false, error: "pchange.errGone" };

  if (input.by.kind === "patient") {
    if (booking.personId !== input.by.personId) return { ok: false, error: "pchange.errGone" };
    const hours = (await getSettings()).rules.refunds.patientCancelWindowHours;
    if (!insideFreeWindow(booking.scheduledAt, now, hours)) return { ok: false, error: "pchange.errClosed" };
  } else if (booking.therapistId !== input.by.actor.userId) {
    return { ok: false, error: "pchange.errGone" };
  }

  const [target] = await db
    .select({
      id: availabilitySlots.id,
      startsAt: availabilitySlots.startsAt,
      place: availabilitySlots.place,
      therapistUserId: availabilitySlots.therapistUserId,
    })
    .from(availabilitySlots)
    .where(eq(availabilitySlots.id, input.toSlotId))
    .limit(1);
  if (!target || target.therapistUserId !== booking.therapistId) return { ok: false, error: "pchange.errTaken" };
  if (!placeFits(booking.modality, target.place)) return { ok: false, error: "pchange.errPlace" };

  const [old] = await db
    .select({ id: availabilitySlots.id, bookedByAccountId: availabilitySlots.bookedByAccountId, note: availabilitySlots.note })
    .from(availabilitySlots)
    .where(and(eq(availabilitySlots.sessionId, booking.id), eq(availabilitySlots.status, "booked")))
    .limit(1);
  if (!old) return { ok: false, error: "pchange.errGone" };
  if (old.id === target.id) return { ok: false, error: "pchange.errTaken" };

  const linkHours = (await getSettings()).rules.links.bookingLinkHoursAfterStart;
  const from = booking.scheduledAt;

  try {
    await db.transaction(async (tx) => {
      const [taken] = await tx
        .update(availabilitySlots)
        .set({
          status: "booked",
          sessionId: booking.id,
          bookedByAccountId: old.bookedByAccountId,
          note: old.note,
          heldUntil: null,
          remindedAt: null,
          updatedAt: now,
        })
        .where(
          and(
            eq(availabilitySlots.id, target.id),
            eq(availabilitySlots.therapistUserId, booking.therapistId),
            gt(availabilitySlots.startsAt, now),
            sql`EXISTS (SELECT 1 FROM therapist_verifications v WHERE v.user_id = ${booking.therapistId} AND v.state = 'approved')`,
            or(
              eq(availabilitySlots.status, "open"),
              and(eq(availabilitySlots.status, "held"), lt(availabilitySlots.heldUntil, now)),
            ),
          ),
        )
        .returning({ id: availabilitySlots.id });
      if (!taken) throw new Moved("pchange.errTaken");

      const [freed] = await tx
        .update(availabilitySlots)
        .set({ status: "open", sessionId: null, bookedByAccountId: null, note: null, remindedAt: null, updatedAt: now })
        .where(
          and(
            eq(availabilitySlots.id, old.id),
            eq(availabilitySlots.status, "booked"),
            eq(availabilitySlots.sessionId, booking.id),
          ),
        )
        .returning({ id: availabilitySlots.id });
      if (!freed) throw new Moved("pchange.errGone");

      const [moved] = await tx
        .update(sessions)
        .set({
          scheduledAt: target.startsAt,
          joinTokenExpiresAt: new Date(target.startsAt.getTime() + linkHours * 3_600_000),
          rescheduledAt: now,
          rescheduleCount: sql`${sessions.rescheduleCount} + 1`,
          updatedAt: now,
        })
        .where(
          and(
            eq(sessions.id, booking.id),
            eq(sessions.status, "scheduled"),
            isNull(sessions.startedAt),
            eq(sessions.scheduledAt, from),
          ),
        )
        .returning({ id: sessions.id });
      if (!moved) throw new Moved("pchange.errGone");
    });
  } catch (error) {
    if (error instanceof Moved) return { ok: false, error: error.key };
    throw error;
  }

  await audit({
    actor: input.by.kind === "therapist" ? input.by.actor : null,
    patientAccountId: input.by.kind === "patient" ? input.by.accountId : null,
    category: "clinical",
    action: "booking.rescheduled",
    resourceType: "session",
    resourceId: booking.id,
    reason: `${from.toISOString()} to ${target.startsAt.toISOString()}`,
  });

  if (input.by.kind === "therapist") {
    /* The patient is told, in the app and by every channel that reaches them. */
    const therapist = await therapistContact(booking.therapistId);
    const name = [therapist?.firstName, therapist?.lastName].filter(Boolean).join(" ");
    const when = formatWhenWithCaveat(
      target.startsAt,
      resolveZone(booking.patientTimezone, therapist?.timezone),
      "en",
    );
    await notify(
      {
        personId: booking.personId,
        email: booking.patientEmail ?? booking.guestEmail,
        phone: booking.patientPhone,
        timezone: booking.patientTimezone,
        organizationId: booking.organizationId,
      },
      {
        kind: "booking.rescheduled",
        notice: { kind: "session_rescheduled", key: "pnotice.rescheduled", sessionId: booking.id },
        subject: en["pnotice.rescheduled"],
        body: `${en["pnotice.rescheduled"]}\n\n${name}, ${when}`,
        variables: [name, when],
      },
    );
  } else {
    await tellTherapist({
      therapistId: booking.therapistId,
      kind: "booking.patient_moved",
      title: en["tchange.patientMoved"],
      body: en["tchange.patientMovedBody"],
      when: target.startsAt,
    });
  }

  return { ok: true };
}

class Moved extends Error {
  constructor(readonly key: MessageKey) {
    super(key);
  }
}

/** What the patient's change page needs: the booking, the window and the hours it may move to. */
export async function changeView(personId: string, sessionId: string, now = new Date()) {
  const booking = await bookingFor(sessionId);
  if (!booking || booking.personId !== personId || !changeable(booking, now)) return null;
  const settings = await getSettings();
  const hours = settings.rules.refunds.patientCancelWindowHours;
  const free = insideFreeWindow(booking.scheduledAt, now, hours);
  const paid = Boolean(await paidPaymentOf(booking.id));
  const therapist = await therapistContact(booking.therapistId);
  const { openHours } = await import("./scheduling");
  /* Only a booking made on an hour can move to another hour. */
  const [ownHour] = await db
    .select({ id: availabilitySlots.id })
    .from(availabilitySlots)
    .where(and(eq(availabilitySlots.sessionId, booking.id), eq(availabilitySlots.status, "booked")))
    .limit(1);
  const hoursOpen = free && ownHour
    ? (await openHours(booking.therapistId, 28)).filter((slot) => placeFits(booking.modality, slot.place))
    : [];
  return {
    sessionId: booking.id,
    at: booking.scheduledAt,
    therapistName: [therapist?.firstName, therapist?.lastName].filter(Boolean).join(" "),
    therapistTimezone: therapist?.timezone ?? null,
    windowHours: hours,
    free,
    paid,
    slots: hoursOpen.map((slot) => ({ id: slot.id, startsAt: slot.startsAt })),
  };
}

/** The session in one of the clinician's own booked hours, or null. */
export async function sessionInMyHour(actor: Actor, slotId: string): Promise<string | null> {
  const [row] = await db
    .select({ sessionId: availabilitySlots.sessionId })
    .from(availabilitySlots)
    .where(
      and(
        eq(availabilitySlots.id, slotId),
        eq(availabilitySlots.therapistUserId, actor.userId),
        eq(availabilitySlots.status, "booked"),
      ),
    )
    .limit(1);
  return row?.sessionId ?? null;
}
