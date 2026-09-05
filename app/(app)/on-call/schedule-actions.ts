"use server";

import { revalidatePath } from "next/cache";

import { requireUser } from "@/lib/auth/guard";
import { cancelBooking, publishHours, withdrawHour } from "@/lib/data/scheduling";

export type ScheduleState = { error?: string; ok?: boolean; added?: number };

/**
 * A clinician publishes bookable hours. PLAN.md 11.1.
 *
 * Days arrive as `YYYY-MM-DD` strings and hours as integers, so there is no
 * way for a client to submit 19:15 — the minute is not in the wire format at
 * all. The database's CHECK is the backstop; this is the shape that makes
 * reaching it impossible.
 */
export async function publish(input: {
  days: string[];
  fromHour: number;
  toHour: number;
}): Promise<ScheduleState> {
  const actor = await requireUser();

  const days = input.days
    .map((day) => new Date(`${day}T00:00:00.000Z`))
    .filter((day) => !Number.isNaN(day.getTime()));

  if (days.length !== input.days.length) return { error: "One of those dates is not a date." };

  const result = await publishHours({
    actor,
    days,
    fromHour: Math.trunc(input.fromHour),
    toHour: Math.trunc(input.toHour),
  });

  if (!result.ok) return { error: result.error };

  revalidatePath("/on-call");
  return { ok: true, added: result.added };
}

export async function withdraw(slotId: string): Promise<ScheduleState> {
  const actor = await requireUser();

  const removed = await withdrawHour(actor, slotId);
  if (!removed) {
    return { error: "That hour is booked. Cancel the appointment instead of removing the time." };
  }

  revalidatePath("/on-call");
  return { ok: true };
}

/**
 * Cancel an appointment.
 *
 * The hour goes back on the calendar rather than disappearing — a clinician
 * cancelling one appointment has not withdrawn the hour — and the patient is
 * told. Whether the telling arrives is reported honestly: see `notify`.
 */
export async function cancel(slotId: string): Promise<ScheduleState> {
  const actor = await requireUser();

  const result = await cancelBooking({ slotId, by: "therapist", actor });
  if (!result.ok) return { error: result.error };

  revalidatePath("/on-call");
  return { ok: true };
}
