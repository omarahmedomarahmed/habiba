"use server";

import { revalidatePath } from "next/cache";

import { requireUser } from "@/lib/auth/guard";
import { fileTicket } from "@/lib/data/support";
import { getI18n } from "@/lib/i18n/server";

export type TherapistSupportState = { error?: string; ok?: { reference: string; hours: number } };

/**
 * A clinician raising a ticket. PLAN.md 20.23–20.25.
 *
 * Same intake as the public form, one field different: `audience: "therapist"`,
 * which is what puts it in the other queue (20.24). A therapist chasing a
 * payout and a patient in distress are different jobs with different clocks,
 * and one list sorted by age puts them in the wrong order.
 *
 * 20.25 — a ticket may reference a session or a payout request, and the queue
 * shows it. Staff should never be asked to work from "the payment did not
 * arrive" with nothing attached.
 */
export async function raiseTicket(
  _prev: TherapistSupportState,
  formData: FormData,
): Promise<TherapistSupportState> {
  const actor = await requireUser();
  const { locale } = await getI18n();

  const result = await fileTicket({
    name: [actor.firstName, actor.lastName].filter(Boolean).join(" ") || actor.email,
    email: actor.email,
    phone: null,
    country: null,
    topic: String(formData.get("topic") ?? ""),
    message: String(formData.get("message") ?? ""),
    locale,
    entity: "us",
    source: "therapist",
    audience: "therapist",
    userId: actor.userId,
    relatedSessionId: String(formData.get("sessionId") ?? "") || null,
    relatedPayoutRequestId: String(formData.get("payoutRequestId") ?? "") || null,
  });

  if (!result.ok) return { error: result.error };

  revalidatePath("/support");
  return {
    ok: {
      reference: result.reference,
      hours: Math.max(1, Math.round((result.dueAt.getTime() - Date.now()) / 3_600_000)),
    },
  };
}
