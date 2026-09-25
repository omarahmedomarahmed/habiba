"use server";

import { revalidatePath } from "next/cache";

import { requireUser, requireVerified } from "@/lib/auth/guard";
import { accessFor } from "@/lib/data/grants";
import { getPatient } from "@/lib/data/patients";
import { bookSlot, publishHours, withdrawHour } from "@/lib/data/scheduling";
import { env } from "@/lib/env";
import { whenFor, wordsFor } from "@/lib/i18n/message-words";
import { notify } from "@/lib/notify";
import { resolveZone } from "@/lib/scheduling/tz";
import { patientSessionLink } from "@/lib/sessions/patient-link";
import { fullName } from "@/lib/utils";

export type BookingState = { error?: string; ok?: boolean; message?: string };

/**
 * The clinician's own calendar. PLAN.md 51.7, 11.1, 11.2.
 *
 * Every action here is scoped to `actor.userId` inside the data layer:
 * `publishHours` writes the actor's own rows, `withdrawHour` is conditional on
 * both the slot id AND the therapist id, so a borrowed slot id closes nothing.
 */

export async function openHoursOn(input: {
  days: string[];
  fromHour: number;
  toHour: number;
  zone: string;
  /** 🔴 Ruling 5c. */
  place?: "online" | "in_person" | "either";
}): Promise<BookingState> {
  const actor = await requireVerified(); // 🔴 25 September inventory: puts a clinician in front of a patient

  const result = await publishHours({ actor, ...input });
  if (!result.ok) return { error: result.error };

  revalidatePath("/bookings");
  return { ok: true, message: String(result.added) };
}

/**
 * Close an hour nobody has taken.
 *
 * `withdrawHour` is conditional on `status = 'open'`. A booked hour is an
 * appointment somebody is planning their week around, and it is cancelled with
 * a message rather than deleted out from under them.
 */
export async function closeHour(slotId: string): Promise<BookingState> {
  const actor = await requireUser();

  const removed = await withdrawHour(actor, slotId);
  if (!removed) {
    return { error: "That hour is booked or already gone, so it stays on the calendar." };
  }

  revalidatePath("/bookings");
  return { ok: true };
}

/**
 * 🔴 51.7 — invite an existing patient to a future scheduled session.
 *
 * ## Why this is an invitation and not a booking
 *
 * The hour becomes theirs and they are TOLD. A clinician quietly placing an
 * appointment into somebody else's week, which they discover from a reminder
 * the night before, is a different product from this one. So the notification
 * is not optional and its failure is reported rather than swallowed.
 *
 * ## Two gates, and the second is the one that matters
 *
 * `getPatient` establishes that this patient is in this clinician's practice.
 * `accessFor` establishes that the person has not revoked them — the same gate
 * homework and assessments use, and for the same reason: this is a surface
 * that REACHES OUT to somebody rather than waiting to be read.
 *
 * ## The patient row is passed by id
 *
 * `bookSlot`'s public path finds or creates a patient from a typed name, which
 * is right for a stranger off the radar and would mint a duplicate file here.
 * `patientId` short-circuits that, and these two gates are what earn it.
 */
export async function invitePatient(input: {
  slotId: string;
  patientId: string;
}): Promise<BookingState> {
  const actor = await requireVerified(); // 🔴 25 September inventory: puts a clinician in front of a patient

  const patient = await getPatient(actor, input.patientId);
  if (!patient) return { error: "That patient is not in your practice." };

  const access = await accessFor(actor, input.patientId);
  if (access.state === "revoked") {
    return {
      error: "This person has not granted you access, so you cannot put an hour in their week.",
    };
  }

  const name = fullName(patient.firstName, patient.lastName, "");

  const booked = await bookSlot({
    slotId: input.slotId,
    patientId: input.patientId,
    bookedBy: actor.userId,
    patientName: name,
    patientEmail: patient.email,
    patientPhone: patient.phone,
    patientTimezone: patient.timezone,
  });

  if (!booked.ok) return { error: booked.error };

  /*
   * 🔴 The telling is the point, so it happens here and not on a cron.
   *
   * The day-before reminder already exists and runs hourly; this is the
   * message that says the hour was made in the first place. A patient who
   * learns about an appointment from its reminder was never invited to it.
   */
  const zone = resolveZone(patient.timezone, booked.therapistTimezone);
  /* 🔴 Ruling 8: in the patient's own language, the date included. */
  const words = await wordsFor(patient.personId ? { personId: patient.personId } : null);
  const when = whenFor(booked.startsAt, zone, words);
  const therapist = fullName(actor.firstName, actor.lastName, "");
  const door = patientSessionLink(env.appUrl, booked.joinToken);

  const delivery = await notify(
    {
      personId: patient.personId,
      email: patient.email,
      phone: patient.phone,
      timezone: patient.timezone,
      locale: words.locale,
    },
    {
      notice: { kind: "session_invited", key: "pnotice.booked", sessionId: booked.sessionId },
      kind: "booking.confirmed",
      subject: words.t("pmsg.booked.subject", { therapist }),
      body: words.t("pmsg.booked.body", { therapist, when }),
      /* 🔴 W2-P05: to the PATIENT, so their own door, never this app's session page. */
      link: door ? { ...door, label: words.t("pmsg.openSession") } : null,
      variables: [therapist, when],
    },
  );

  revalidatePath("/bookings");

  /*
   * A booked hour with nobody told is a half-finished invitation, and the
   * clinician is the only person who can fix it. Reported rather than hidden
   * behind a green tick.
   */
  if (!delivery.sent) {
    return {
      ok: true,
      error:
        "The hour is held for them, but we have no way to reach them. Tell them yourself, and add an email or a number to their file.",
    };
  }

  return { ok: true, message: name };
}

/**
 * 🔴 Ruling 16: move a booked hour to another of the clinician's open hours.
 * Never charged again; the patient is told (`rescheduleBooking`). Answers are
 * dictionary keys, said in the clinician's language by the calendar.
 */
export async function moveBookedHour(input: {
  fromSlotId: string;
  toSlotId: string;
}): Promise<{ ok?: boolean; errorKey?: import("@/lib/i18n/messages").MessageKey }> {
  const actor = await requireVerified();
  const { rescheduleBooking, sessionInMyHour } = await import("@/lib/data/booking-change");
  const sessionId = await sessionInMyHour(actor, input.fromSlotId);
  if (!sessionId) return { errorKey: "pchange.errGone" };
  const result = await rescheduleBooking({
    sessionId,
    toSlotId: input.toSlotId,
    by: { kind: "therapist", actor },
  });
  if (!result.ok) return { errorKey: result.error };
  revalidatePath("/bookings");
  return { ok: true };
}

/** 🔴 Ruling 16: the clinician agrees to refund a late cancellation anyway. */
export async function refundLateCancellation(
  sessionId: string,
): Promise<{ ok?: boolean; errorKey?: import("@/lib/i18n/messages").MessageKey }> {
  /* Giving money back never waits on a licence. */
  const actor = await requireUser();
  const { agreeLateRefund } = await import("@/lib/data/booking-change");
  const result = await agreeLateRefund(actor, sessionId);
  if (!result.ok) return { errorKey: result.error };
  revalidatePath("/bookings");
  return { ok: true };
}
