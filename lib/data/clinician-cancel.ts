import "server-only";

import { and, eq } from "drizzle-orm";

import { controlDb } from "@/lib/db";
import { patients, sessionPayments, sessions } from "@/lib/db/schema";
import { wordsFor } from "@/lib/i18n/message-words";
import { log, ref } from "@/lib/logger";
import { notify } from "@/lib/notify";

export type ClinicianCancelOutcome = "notified" | "refunded" | "refund_owed" | "wallet";

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
 *   - Paid by bank transfer: 🔴 board 430, ruling 18: the money we hold goes
 *     to the patient's wallet by default (`refundTransferToWallet`), and the
 *     patient is told it is there and that they can ask for it back. Only
 *     where that cannot happen (a guest with no wallet, the wallet off) is it
 *     queued as a refund owed. Never called refunded when it was not (W1-12).
 *   - Never paid: the message alone.
 *
 * In the patient's own language (ruling 8); the words live in the
 * dictionary. The in-app notice (W1-28b) is a key plus the session it is about,
 * so it reads in the patient's own language, and the reason is read from the
 * session rather than stored in the notice log (C231).
 */
export async function afterClinicianCancel(input: {
  actorUserId: string;
  sessionId: string;
  reason: string;
  /**
   * 🔴 W2-A10: WE cancelled it, by taking the clinician off the board. The
   * patient is told that, not "your clinician cancelled", and the operator's
   * reason stays on our record rather than in their message.
   */
  byUs?: boolean;
}): Promise<{ outcome: ClinicianCancelOutcome }> {
  // 🔴 W1-28b (0124): the reason lives on the session; the notice points at it (C231).
  await controlDb
    .update(sessions)
    .set({ cancelledReason: input.byUs ? null : input.reason.slice(0, 300) })
    .where(eq(sessions.id, input.sessionId));

  const [payment] = await controlDb
    .select({ id: sessionPayments.id })
    .from(sessionPayments)
    .where(and(eq(sessionPayments.sessionId, input.sessionId), eq(sessionPayments.status, "paid")))
    .limit(1);

  let outcome: ClinicianCancelOutcome = "notified";
  const { refundSessionPayment, refundTransferToWallet } = await import("@/lib/billing/connect");
  const toWallet = payment
    ? await refundTransferToWallet({
        paymentId: payment.id,
        reason: `Cancelled by the clinician: ${input.reason}`.slice(0, 200),
        byUserId: input.actorUserId,
      })
    : null;
  if (toWallet?.ok) {
    outcome = "wallet";
  } else if (payment) {
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
      outcome = result.queuedCents
        ? "refund_owed" // W2-M04: their transfer-paid share is on the refund queue
        : result.toPayerCents === 0
          ? "notified"
          : "refunded";
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

  /* 🔴 Ruling 8: in the patient's own language, with admin overrides. */
  const words = await wordsFor(to?.personId ? { personId: to.personId } : null);
  const { t } = words;
  const moneyLine =
    outcome === "refunded"
      ? t("tshow.refundedBody")
      : outcome === "refund_owed"
        ? t("w1a.refundOwedBody")
        : outcome === "wallet"
          ? t("w1a.walletCreditBody")
          : "";

  if (to) {
    await notify(
      {
        personId: to.personId ?? null,
        email: to.email ?? to.guestEmail ?? null,
        phone: to.phone ?? null,
        timezone: to.timezone ?? null,
        locale: words.locale,
      },
      {
        kind: "booking.cancelled",
        // 🔴 W1-28b: and in the app. The notice points at the session, whose reason it shows.
        notice: {
          kind: "session_cancelled",
          key: input.byUs ? "w2a.cancelledByUs" : "w1a.cancelledByClinician",
          sessionId: input.sessionId,
        },
        subject: t("w1a.noShowCancelled"),
        body: [
          input.byUs ? t("w2a.cancelledByUs") : t("w1a.cancelledByClinician"),
          input.byUs ? "" : t("w1a.cancelReasonGiven", { reason: input.reason }),
          moneyLine,
        ]
          .filter(Boolean)
          .join("\n\n"),
      },
    );
  }

  return { outcome };
}
