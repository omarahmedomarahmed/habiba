import "server-only";

import { and, eq } from "drizzle-orm";

import { controlDb } from "@/lib/db";
import { patients, sessionPayments, sessions } from "@/lib/db/schema";
import { en } from "@/lib/i18n/messages";
import { log, ref } from "@/lib/logger";
import { notify } from "@/lib/notify";

export type ClinicianCancelOutcome = "notified" | "refunded" | "refund_owed";

/**
 * 🔴 W1-13: what follows a clinician cancelling a session they had booked.
 *
 * The cancellation itself is the caller's (`cancelBooking`, `cancelSession`),
 * each guarded on who owns the row. This runs only after one of them succeeded,
 * and does the two things neither did: gives the money back, and tells the
 * patient why.
 *
 *   - Paid by card or from a pot: refunded through `refundSessionPayment`,
 *     each payer from their own rail when a company covered part (W2-S12).
 *   - Paid by bank transfer: that refuses (no charge to reverse), so the
 *     payment stays `paid` and the patient is told a refund is owed and to
 *     contact us. Never called refunded when it was not (W1-12).
 *   - Never paid: the message alone.
 *
 * English, like every other message `notify` sends; the words live in the
 * dictionary. The in-app notice (W1-28b) is a key plus the session it is about,
 * so it reads in the patient's own language, and the reason is read from the
 * session rather than stored in the notice log (C231).
 */
export async function afterClinicianCancel(input: {
  actorUserId: string;
  sessionId: string;
  reason: string;
}): Promise<{ outcome: ClinicianCancelOutcome }> {
  // 🔴 W1-28b (0124): the reason lives on the session; the notice points at it (C231).
  await controlDb
    .update(sessions)
    .set({ cancelledReason: input.reason.slice(0, 300) })
    .where(eq(sessions.id, input.sessionId));

  const [payment] = await controlDb
    .select({ id: sessionPayments.id })
    .from(sessionPayments)
    .where(and(eq(sessionPayments.sessionId, input.sessionId), eq(sessionPayments.status, "paid")))
    .limit(1);

  let outcome: ClinicianCancelOutcome = "notified";
  if (payment) {
    const { refundSessionPayment } = await import("@/lib/billing/connect");
    const result = await refundSessionPayment({
      paymentId: payment.id,
      reason: `Cancelled by the clinician: ${input.reason}`.slice(0, 200),
      adminUserId: input.actorUserId,
      why: "clinician_cancel",
    });
    if (result.error) {
      log.error("clinician cancellation not refunded, refund owed", {
        session: ref(input.sessionId),
        reason: result.error,
      });
      outcome = "refund_owed";
      // 🔴 W1-28a: the refund owed is a row on the operators' refund queue.
      const { openRefundRequest } = await import("@/lib/billing/refunds");
      await openRefundRequest({
        sessionPaymentId: payment.id,
        requestedByUserId: input.actorUserId,
        reason: "clinician_cancel",
      });
    } else {
      /*
       * 🔴 W2-S12: refunded only if something went back to THEM. A session the
       * company covered in full, or a share never paid, returns the company's
       * money and none of theirs, and "the full amount is on its way back" to
       * somebody who paid nothing is untrue.
       */
      outcome = result.toPayerCents === 0 ? "notified" : "refunded";
    }
  }

  const [to] = await controlDb
    .select({
      personId: patients.personId,
      email: patients.email,
      phone: patients.phone,
      timezone: patients.timezone,
      guestEmail: sessions.guestEmail,
    })
    .from(sessions)
    .leftJoin(patients, eq(patients.id, sessions.patientId))
    .where(eq(sessions.id, input.sessionId))
    .limit(1);

  const moneyLine =
    outcome === "refunded"
      ? en["tshow.refundedBody"]
      : outcome === "refund_owed"
        ? en["w1a.refundOwedBody"]
        : "";

  if (to) {
    await notify(
      {
        personId: to.personId ?? null,
        email: to.email ?? to.guestEmail ?? null,
        phone: to.phone ?? null,
        timezone: to.timezone ?? null,
      },
      {
        kind: "booking.cancelled",
        // 🔴 W1-28b: and in the app. The notice points at the session, whose reason it shows.
        notice: { kind: "session_cancelled", key: "w1a.cancelledByClinician", sessionId: input.sessionId },
        subject: en["w1a.noShowCancelled"],
        body: [
          en["w1a.cancelledByClinician"],
          en["w1a.cancelReasonGiven"].replace("{reason}", input.reason),
          moneyLine,
        ]
          .filter(Boolean)
          .join("\n\n"),
      },
    );
  }

  return { outcome };
}
