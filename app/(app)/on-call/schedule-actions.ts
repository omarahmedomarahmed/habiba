"use server";

import { revalidatePath } from "next/cache";

import { requireUser } from "@/lib/auth/guard";
import { cancelBooking, publishHours, withdrawHour } from "@/lib/data/scheduling";
import { clinicianZone } from "@/lib/data/timezone";

export type ScheduleState = {
  error?: string;
  ok?: boolean;
  added?: number;
  /** The zone the hours were read in, so the screen can say it. 11R.2. */
  zone?: string;
  zoneSource?: "stored" | "adopted" | "utc";
  /** Hours that do not exist that morning, because the clocks went forward. */
  impossible?: number;
};

/**
 * A clinician publishes bookable hours. PLAN.md 11.1, rewritten for 11R.2.
 *
 * Days arrive as `YYYY-MM-DD` strings and hours as integers, so there is no
 * way for a client to submit 19:15 — the minute is not in the wire format at
 * all. The database's CHECK is the backstop; this is the shape that makes
 * reaching it impossible.
 *
 * The hours are wall-clock hours **where the clinician is**, resolved from
 * `users.timezone` (falling back to the browser's answer, which is then
 * saved). The previous version wrote them as UTC and printed a grey line
 * admitting it — which is not a fix, because it leaves the therapist doing the
 * arithmetic every time they publish a week.
 */
export async function publish(input: {
  days: string[];
  fromHour: number;
  toHour: number;
  /** `Intl.DateTimeFormat().resolvedOptions().timeZone`, used only if nothing is stored. */
  browserZone?: string;
}): Promise<ScheduleState> {
  const actor = await requireUser();

  const choice = await clinicianZone(actor.userId, input.browserZone ?? null);

  const result = await publishHours({
    actor,
    days: input.days,
    fromHour: Math.trunc(input.fromHour),
    toHour: Math.trunc(input.toHour),
    zone: choice.zone,
  });

  if (!result.ok) return { error: result.error, zone: choice.zone, zoneSource: choice.source };

  revalidatePath("/on-call");
  return {
    ok: true,
    added: result.added,
    zone: choice.zone,
    zoneSource: choice.source,
    impossible: result.impossible,
  };
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
