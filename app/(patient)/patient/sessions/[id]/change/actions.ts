"use server";

import { revalidatePath } from "next/cache";

import { patientCancel, rescheduleBooking } from "@/lib/data/booking-change";
import type { MessageKey } from "@/lib/i18n/messages";
import { requirePatient } from "@/lib/patient-auth/guard";
import { callerKey, consume } from "@/lib/rate-limit";

/**
 * 🔴 Ruling 16: the patient cancels or moves their own booking.
 *
 * Who they are comes from their session cookie and nothing else; the data
 * layer then checks the booking is theirs. Answers are dictionary keys, so the
 * screen says them in the reader's language.
 */
export type ChangeState = {
  error?: MessageKey;
  done?: "moved" | "cancelled";
  refund?: "refunded" | "queued" | "none" | "held";
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function cancelMyBooking(sessionId: string): Promise<ChangeState> {
  const actor = await requirePatient();
  if (!UUID.test(sessionId)) return { error: "pchange.errGone" };
  const throttle = await consume(await callerKey("booking-change"), 20, 60 * 60);
  if (!throttle.allowed) return { error: "pchange.errGone" };

  const result = await patientCancel({ personId: actor.personId, accountId: actor.accountId, sessionId });
  if (!result.ok) return { error: result.error };
  revalidatePath("/patient/sessions");
  return { done: "cancelled", refund: result.refund };
}

export async function moveMyBooking(sessionId: string, slotId: string): Promise<ChangeState> {
  const actor = await requirePatient();
  if (!UUID.test(sessionId) || !UUID.test(slotId)) return { error: "pchange.errGone" };
  const throttle = await consume(await callerKey("booking-change"), 20, 60 * 60);
  if (!throttle.allowed) return { error: "pchange.errGone" };

  const result = await rescheduleBooking({
    sessionId,
    toSlotId: slotId,
    by: { kind: "patient", personId: actor.personId, accountId: actor.accountId },
  });
  if (!result.ok) return { error: result.error };
  revalidatePath("/patient/sessions");
  return { done: "moved" };
}
