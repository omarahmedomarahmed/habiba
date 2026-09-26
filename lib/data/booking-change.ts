import "server-only";

import { and, eq, gt, isNull, lt, or, sql } from "drizzle-orm";

import { audit } from "@/lib/audit";
import type { Actor } from "@/lib/auth/session";
import { controlDb } from "@/lib/db";
import {
  availabilitySlots,
  manualPayments,
  notifications,
  patientCredits,
  patients,
  sessionPayments,
  sessions,
  users,
} from "@/lib/db/schema";
import { whenFor, wordsFor } from "@/lib/i18n/message-words";
import type { MessageKey } from "@/lib/i18n/messages";
import { log, ref } from "@/lib/logger";
import { notify } from "@/lib/notify";
import { insideFreeWindow, placeFits } from "@/lib/scheduling/cancel-window";
import { resolveZone } from "@/lib/scheduling/tz";
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

/**
 * What happened to the patient's money, in one word the screen turns into a
 * sentence. 🔴 Board 430/407/419: `wallet` (ruling 18, a transfer we held),
 * `waiting` (a transfer still being checked, which goes to the wallet when it
 * arrives), `covered` (their benefit paid it; nothing of theirs to return).
 */
export type MoneyAfterCancel = "refunded" | "queued" | "none" | "held" | "wallet" | "waiting" | "covered";

export type ChangeResult =
  | { ok: true; refund?: MoneyAfterCancel }
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

/**
 * 🔴 Board 406/419: the two facts about the money the change page has to say
 * before anything is pressed: a transfer they sent that is still being checked,
 * and a session their benefit paid in full.
 */
async function moneyOn(sessionId: string): Promise<{ transferWaiting: boolean; covered: boolean }> {
  const [[waiting], [covered]] = await Promise.all([
    db
      .select({ id: manualPayments.id })
      .from(manualPayments)
      .where(
        and(
          sql`${manualPayments.purpose} IN ('session', 'payg_session')`,
          eq(manualPayments.refId, sessionId),
          eq(manualPayments.state, "submitted"),
        ),
      )
      .limit(1),
    db
      .select({ id: sessionPayments.id })
      .from(sessionPayments)
      .where(
        and(
          eq(sessionPayments.sessionId, sessionId),
          sql`${sessionPayments.status} IN ('paid', 'refunded')`,
          eq(sessionPayments.fundingSource, "pot"),
          eq(sessionPayments.patientShareCents, 0),
        ),
      )
      .limit(1),
  ]);
  return { transferWaiting: Boolean(waiting), covered: Boolean(covered) };
}

/**
 * 🔴 Board 407: what became of the money on a booking already cancelled, read
 * back from the records, so the page that just cancelled it can say so when it
 * redraws (it used to answer 404, and the patient never learned where her
 * transfer went).
 */
async function moneyAfterCancel(booking: Booking): Promise<MoneyAfterCancel> {
  const money = await moneyOn(booking.id);
  if (money.covered) return "covered";
  /* 🔴 Board 796: nothing of theirs was in it, so nothing of theirs is held or coming back. */
  if (await shareUnpaid(booking.id)) return money.transferWaiting ? "waiting" : "none";
  if (booking.lateCancel === "held") return "held";
  const [payment] = await db
    .select({ id: sessionPayments.id, status: sessionPayments.status })
    .from(sessionPayments)
    .where(and(eq(sessionPayments.sessionId, booking.id), sql`${sessionPayments.status} IN ('paid', 'refunded')`))
    .limit(1);
  const [credit] = await db
    .select({ id: patientCredits.id })
    .from(patientCredits)
    .where(eq(patientCredits.fromSessionId, booking.id))
    .limit(1);
  if (credit) return "wallet";
  if (money.transferWaiting) return "waiting";
  if (payment?.status === "refunded") return "refunded";
  if (payment?.status === "paid") return "queued";
  return "none";
}

/**
 * 🔴 Board 796/808: a company's payment row whose employee share never
 * arrived. `payFromPot` writes it `paid` at booking, so "there is a paid
 * payment" is true of a session the patient has paid nothing towards, and
 * cancelling one said "Your money is on its way back" to somebody who had sent
 * none. Their money is only ever the share, and only once it came.
 */
async function shareUnpaid(sessionId: string): Promise<boolean> {
  const [row] = await db
    .select({
      id: sessionPayments.id,
      sessionId: sessionPayments.sessionId,
      fundingSource: sessionPayments.fundingSource,
      grossCents: sessionPayments.grossCents,
      coverageBps: sessionPayments.coverageBps,
      sponsorShareCents: sessionPayments.sponsorShareCents,
      patientShareCents: sessionPayments.patientShareCents,
      stripePaymentIntentId: sessionPayments.stripePaymentIntentId,
    })
    .from(sessionPayments)
    .where(and(eq(sessionPayments.sessionId, sessionId), sql`${sessionPayments.status} IN ('paid', 'refunded')`))
    .limit(1);
  if (!row || row.fundingSource !== "pot") return false;
  const { potRowForPatient } = await import("@/lib/billing/split-refund");
  const { employeeShareArrived } = await import("@/lib/billing/refunds");
  return (
    potRowForPatient({ ...row, coverageBps: row.coverageBps ?? 0, shareArrived: await employeeShareArrived(row) }) ===
    "share_unpaid"
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
}): Promise<"refunded" | "queued" | "none" | "wallet"> {
  const { refundSessionPayment, refundTransferToWallet } = await import("@/lib/billing/connect");
  /* 🔴 Board 430, ruling 18: a transfer we hold goes to their wallet by default. */
  const toWallet = await refundTransferToWallet({
    paymentId: input.paymentId,
    reason: input.reason.slice(0, 200),
    byUserId: input.by,
  });
  if (toWallet.ok) return "wallet";
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
  title: MessageKey;
  body: MessageKey;
  when: Date;
}): Promise<void> {
  const therapist = await therapistContact(input.therapistId);
  if (!therapist) return;
  /* 🔴 Ruling 8: in the clinician's own language, in the app and outside it. */
  const words = await wordsFor({ userId: input.therapistId });
  const { t } = words;
  const title = t(input.title);
  const body = t(input.body);
  await db.insert(notifications).values({
    userId: input.therapistId,
    kind: "system",
    title,
    body,
    actionUrl: "/bookings",
  });
  const when = whenFor(input.when, resolveZone(therapist.timezone), words);
  await notify(
    {
      email: therapist.email,
      phone: therapist.profile?.phone ?? null,
      timezone: therapist.timezone,
      locale: words.locale,
    },
    {
      kind: input.kind,
      subject: title,
      body: `${body}\n\n${when}`,
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
  /* Read before any refund, which puts the session back to pending. */
  const nothingOfTheirs = paymentId ? await shareUnpaid(booking.id) : false;

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

  /*
   * 🔴 K20 (PE24): a transfer they declared and staff have not confirmed stays
   * in the queue, and confirming it would mark nothing paid. It is raised now
   * as money to give back (a refund or the wallet), on the staff screen.
   */
  const { flagTransfersForCancelled } = await import("@/lib/billing/rail-exceptions");
  await flagTransfersForCancelled(booking.id);

  let refund: MoneyAfterCancel = "none";
  const money = await moneyOn(booking.id);
  if (money.covered) {
    /* 🔴 Board 419: their benefit paid all of it; nothing of theirs is held or returned. */
    refund = "covered";
    if (free && paymentId) {
      await refundPatient({ paymentId, reason: "Cancelled by the patient inside the free window", by: null });
    }
  } else if (paymentId && free) {
    refund = await refundPatient({
      paymentId,
      reason: "Cancelled by the patient inside the free window",
      by: null,
    });
  } else if (paymentId) {
    refund = "held";
  } else if (money.transferWaiting) {
    /* 🔴 Board 407: ruling 18, it goes to the wallet when it arrives. */
    refund = "waiting";
  }
  /*
   * 🔴 Board 796: the company's share went back to its pot (or stays with the
   * clinician on a late cancellation), and the patient had paid nothing, so
   * nothing of theirs is "on its way back" or "held".
   */
  /* The clinician's message is about the hour, not whose money it was. */
  const lateForClinician = refund === "held";
  if (nothingOfTheirs && refund !== "covered") refund = money.transferWaiting ? "waiting" : "none";

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
    title: "tchange.patientCancelled",
    body: lateForClinician ? "tchange.patientCancelledLate" : "tchange.patientCancelledFree",
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
    const { t, locale } = await wordsFor(booking.personId ? { personId: booking.personId } : null);
    await notify(
      {
        personId: booking.personId,
        email: booking.patientEmail ?? booking.guestEmail,
        phone: booking.patientPhone,
        timezone: booking.patientTimezone,
        organizationId: booking.organizationId,
        locale,
      },
      {
        kind: "booking.cancelled",
        notice: { kind: "session_cancelled", key: "pnotice.lateRefunded", sessionId },
        subject: t("pnotice.lateRefunded"),
        body: [
          t("pnotice.lateRefunded"),
          refund === "queued" ? t("w1a.refundOwedBody") : refund === "wallet" ? t("w1a.walletCreditBody") : "",
        ]
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
    /* 🔴 Ruling 8: the patient's language, the time included. */
    const words = await wordsFor(booking.personId ? { personId: booking.personId } : null);
    const { t } = words;
    const when = whenFor(target.startsAt, resolveZone(booking.patientTimezone, therapist?.timezone), words);
    await notify(
      {
        personId: booking.personId,
        email: booking.patientEmail ?? booking.guestEmail,
        phone: booking.patientPhone,
        timezone: booking.patientTimezone,
        organizationId: booking.organizationId,
        locale: words.locale,
      },
      {
        kind: "booking.rescheduled",
        notice: { kind: "session_rescheduled", key: "pnotice.rescheduled", sessionId: booking.id },
        subject: t("pnotice.rescheduled"),
        body: `${t("pnotice.rescheduled")}\n\n${name}, ${when}`,
        variables: [name, when],
      },
    );
  } else {
    await tellTherapist({
      therapistId: booking.therapistId,
      kind: "booking.patient_moved",
      title: "tchange.patientMoved",
      body: "tchange.patientMovedBody",
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
export type CancelledView = {
  cancelled: true;
  sessionId: string;
  at: Date | null;
  therapistName: string;
  therapistTimezone: string | null;
  windowHours: number;
  money: MoneyAfterCancel;
};

/** 🔴 Board 407: a booking of theirs that is cancelled, and what became of the money. */
export async function cancelledView(personId: string, sessionId: string): Promise<CancelledView | null> {
  const booking = await bookingFor(sessionId);
  if (!booking || booking.personId !== personId || booking.status !== "cancelled") return null;
  const [therapist, money, settings] = await Promise.all([
    therapistContact(booking.therapistId),
    moneyAfterCancel(booking),
    getSettings(),
  ]);
  return {
    cancelled: true,
    sessionId: booking.id,
    at: booking.scheduledAt,
    therapistName: [therapist?.firstName, therapist?.lastName].filter(Boolean).join(" "),
    therapistTimezone: therapist?.timezone ?? null,
    windowHours: settings.rules.refunds.patientCancelWindowHours,
    money,
  };
}

export async function changeView(personId: string, sessionId: string, now = new Date()) {
  const booking = await bookingFor(sessionId);
  if (!booking || booking.personId !== personId || !changeable(booking, now)) return null;
  const settings = await getSettings();
  const hours = settings.rules.refunds.patientCancelWindowHours;
  const free = insideFreeWindow(booking.scheduledAt, now, hours);
  /* 🔴 Board 796: a company's row with their share still owed is not money they paid. */
  const [paidRow, unpaidShare, money] = await Promise.all([
    paidPaymentOf(booking.id).then(Boolean),
    shareUnpaid(booking.id),
    moneyOn(booking.id),
  ]);
  const paid = paidRow && !unpaidShare;
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
    /* 🔴 Board 406: a transfer they sent that is still being checked. */
    transferWaiting: money.transferWaiting,
    /* 🔴 Board 419: their benefit paid it all; no refund rule is about their money. */
    covered: money.covered,
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
