import "server-only";

import { and, asc, eq, inArray } from "drizzle-orm";

import { controlDb } from "@/lib/db";
import {
  manualPayments,
  refundRequests,
  sessionPayments,
  sessions,
  type RefundRequestStatus,
} from "@/lib/db/schema";
import type { MessageKey } from "@/lib/i18n/messages";
import { log, ref } from "@/lib/logger";
import { getSettings } from "@/lib/settings";

import { fourEyesProblem } from "./four-eyes";
import {
  refundOwedCents,
  splitRefundPlan,
  type EmployeeHalf,
  type FrozenSplit,
} from "./split-refund";

const db = controlDb;

/**
 * 🔴 W1-28a: the manual-rail refund queue. Migration 0121.
 *
 * A bank-transfer payment has no charge to reverse, so `refundSessionPayment`
 * refuses it and the product tells the patient a refund is owed (a no-show,
 * W1-12; a clinician's cancellation, W1-13). This is where that promise lives
 * until an operator keeps it, worked like the payout queue beside it:
 *
 *   owed       opened by the path that said "refund owed"
 *   sent       an operator sent the money back, with the receipt; the ledger
 *              reversal posts on THIS move, inside its transaction, and only
 *              for the call that won it (the W1-04 rule for payouts)
 *   confirmed  the patient or the bank says it arrived
 *   cancelled  with a reason, never after money left
 *
 * The patient's screen keeps saying "refund owed" while the payment is still
 * `paid`, which is exactly while this row is open; "sent" flips both.
 *
 * Errors are dictionary keys, so the action says them in the reader's language.
 */

type Result = { ok?: boolean; error?: MessageKey; id?: string };

/**
 * 🔴 W2-S12: the employee's half of a pot-funded payment, and which rail it
 * goes back on (`splitRefundPlan`). Their share arrived if the session is paid
 * (a partly covered one is paid only once they pay) or a transfer for it was
 * confirmed; a covered-in-full session is paid with nothing of theirs in it,
 * which the plan reads from the shares.
 */
export async function employeeHalfOf(payment: FrozenSplit & {
  sessionId: string;
  vatCents: number;
  stripePaymentIntentId: string | null;
}): Promise<EmployeeHalf> {
  const [session] = await db
    .select({ paymentStatus: sessions.paymentStatus })
    .from(sessions)
    .where(eq(sessions.id, payment.sessionId))
    .limit(1);
  const [transfer] = await db
    .select({ id: manualPayments.id })
    .from(manualPayments)
    .where(
      and(
        eq(manualPayments.refId, payment.sessionId),
        inArray(manualPayments.purpose, ["session", "payg_session"]),
        eq(manualPayments.state, "confirmed"),
      ),
    )
    .limit(1);

  return splitRefundPlan({
    ...payment,
    employeePaid: session?.paymentStatus === "paid" || Boolean(transfer),
  }).employee;
}

/**
 * Open (or find) the live row for a payment we still hold. Idempotent: the
 * partial unique index keeps one live row per payment, so a second path that
 * says "refund owed" for the same money lands on the first one.
 */
export async function openRefundRequest(input: {
  sessionPaymentId: string;
  requestedByUserId: string | null;
  reason: string;
}): Promise<Result> {
  const [payment] = await db
    .select({
      id: sessionPayments.id,
      organizationId: sessionPayments.organizationId,
      sessionId: sessionPayments.sessionId,
      grossCents: sessionPayments.grossCents,
      vatCents: sessionPayments.vatCents,
      currency: sessionPayments.currency,
      payerName: sessionPayments.payerName,
      status: sessionPayments.status,
      fundingSource: sessionPayments.fundingSource,
      coverageBps: sessionPayments.coverageBps,
      sponsorShareCents: sessionPayments.sponsorShareCents,
      patientShareCents: sessionPayments.patientShareCents,
      stripePaymentIntentId: sessionPayments.stripePaymentIntentId,
    })
    .from(sessionPayments)
    .where(eq(sessionPayments.id, input.sessionPaymentId))
    .limit(1);
  if (!payment || payment.status !== "paid") return { error: "arefund.errPaid" };

  /*
   * 🔴 W2-S12: what THIS payer paid, tax included. On a pot row that is the
   * employee's share, and only if it arrived: the whole price used to be queued,
   * so an operator would have sent an employee the company's money too, or
   * refunded a share nobody paid. The company's share goes back to its pot.
   */
  const amountCents =
    payment.fundingSource === "pot"
      ? (await employeeHalfOf(payment)).cents
      : refundOwedCents(payment);
  if (amountCents <= 0) return { error: "arefund.errPaid" };

  const [row] = await db
    .insert(refundRequests)
    .values({
      sessionPaymentId: payment.id,
      organizationId: payment.organizationId,
      // What the patient paid, tax included: the same cash the reversal returns.
      amountCents,
      currency: payment.currency,
      payeeName: payment.payerName,
      reason: input.reason.slice(0, 300),
      requestedByUserId: input.requestedByUserId,
    })
    .onConflictDoNothing()
    .returning({ id: refundRequests.id });
  if (row) {
    log.info("refund owed, queued", { payment: ref(payment.id) });
    return { ok: true, id: row.id };
  }

  const [live] = await db
    .select({ id: refundRequests.id })
    .from(refundRequests)
    .where(
      and(
        eq(refundRequests.sessionPaymentId, payment.id),
        inArray(refundRequests.status, ["owed", "sent"]),
      ),
    )
    .limit(1);
  return live ? { ok: true, id: live.id } : { error: "arefund.errMoved" };
}

/** A named owner. Above the two-person threshold, the sender must be somebody else. */
export async function claimRefund(input: { requestId: string; ownerUserId: string }): Promise<Result> {
  const updated = await db
    .update(refundRequests)
    .set({ ownerUserId: input.ownerUserId, updatedAt: new Date() })
    .where(and(eq(refundRequests.id, input.requestId), eq(refundRequests.status, "owed")))
    .returning({ id: refundRequests.id });
  return updated.length ? { ok: true } : { error: "arefund.errMoved" };
}

/**
 * The money went back. Proof and destination are required, four eyes apply
 * above the payout threshold, and the reversal posts exactly once.
 */
export async function markRefundSent(input: {
  requestId: string;
  senderUserId: string;
  proofUrl: string;
  method: string;
  identifier: string;
  accountName: string;
}): Promise<Result> {
  const proof = input.proofUrl.trim();
  const identifier = input.identifier.trim();
  const accountName = input.accountName.trim();
  const method = input.method.trim();
  if (proof.length < 5 || identifier.length < 3 || accountName.length < 3 || !method) {
    return { error: "arefund.errProof" };
  }

  const [row] = await db
    .select()
    .from(refundRequests)
    .where(eq(refundRequests.id, input.requestId))
    .limit(1);
  if (!row || row.status !== "owed") return { error: "arefund.errMoved" };

  /*
   * W2-A01 / D9: the payout queue's rule, asked of the same function. The
   * person who opened the refund is its "editor": they named what is owed and
   * may not also be the one who sends it.
   */
  const settings = await getSettings();
  const problem = fourEyesProblem({
    actorUserId: input.senderUserId,
    payeeUserId: null,
    editorUserId: row.requestedByUserId,
    amountCents: row.amountCents,
    thresholdCents: settings.payouts.twoPersonThresholdCents,
    ownerUserId: row.ownerUserId,
    movesMoney: true,
  });
  if (problem) return { error: "arefund.errTwo" };

  /*
   * 🔴 W2-S12: a pot-funded payment is called refunded only once the company
   * has its share back too. `refundSplit` returned it before it queued the
   * employee's half, so this is normally nothing; a row queued before W2-S12,
   * or one whose pot return failed, gets it here or is refused. Before the
   * transaction, because the pool has one connection and the transaction holds
   * it; `refundToPot` returns a share at most once.
   */
  const [held] = await db
    .select({ fundingSource: sessionPayments.fundingSource, status: sessionPayments.status })
    .from(sessionPayments)
    .where(eq(sessionPayments.id, row.sessionPaymentId))
    .limit(1);
  if (held?.fundingSource === "pot" && held.status === "paid") {
    const { refundToPot } = await import("./pot");
    const pot = await refundToPot({ paymentId: row.sessionPaymentId, reason: row.reason });
    if (pot.error) {
      log.error("refund not sent: the company's share is not back", {
        payment: ref(row.sessionPaymentId),
        reason: pot.error,
      });
      return { error: "arefund.errPot" };
    }
  }

  const txnId = crypto.randomUUID();
  const now = new Date();

  return db
    .transaction(async (tx) => {
      /*
       * The status is in the WHERE, so two operators pressing "sent" together
       * make one move, and only the winner reaches the ledger below.
       */
      const moved = await tx
        .update(refundRequests)
        .set({
          status: "sent",
          sentByUserId: input.senderUserId,
          sentAt: now,
          proofUrl: proof,
          ledgerTxnId: txnId,
          payeeMethod: method,
          payeeIdentifier: identifier,
          payeeAccountName: accountName,
          updatedAt: now,
        })
        .where(and(eq(refundRequests.id, input.requestId), eq(refundRequests.status, "owed")))
        .returning({ id: refundRequests.id });
      if (moved.length === 0) return { error: "arefund.errMoved" as const };

      const [payment] = await tx
        .update(sessionPayments)
        .set({ status: "refunded" })
        .where(
          and(eq(sessionPayments.id, row.sessionPaymentId), eq(sessionPayments.status, "paid")),
        )
        .returning();
      // Refunded some other way already: nothing here may post a second reversal.
      if (!payment) throw new PaymentNotHeld();

      const { postSessionRefund } = await import("./ledger");
      await postSessionRefund({
        id: payment.id,
        organizationId: payment.organizationId,
        therapistId: payment.therapistId,
        capture: payment.capture,
        grossCents: payment.grossCents,
        vatCents: payment.vatCents,
        platformFeeCents: payment.platformFeeCents,
        settledInvoiceCents: payment.settledInvoiceCents,
        therapistNetCents: payment.therapistNetCents,
        txnId,
        executor: tx,
        createdBy: input.senderUserId,
      });

      // The same two session writes the card path makes, now true here too.
      await tx
        .update(sessions)
        .set({ paymentStatus: "pending", updatedAt: now })
        .where(eq(sessions.id, payment.sessionId));
      await tx
        .update(sessions)
        .set({ recoveryOutcome: "refunded" })
        .where(and(eq(sessions.id, payment.sessionId), eq(sessions.recoveryOutcome, "refund_owed")));

      return { ok: true };
    })
    .catch((error: unknown) => {
      if (error instanceof PaymentNotHeld) return { error: "arefund.errPaid" as const };
      throw error;
    });
}

class PaymentNotHeld extends Error {}

/** It arrived. */
export async function confirmRefund(input: { requestId: string }): Promise<Result> {
  const updated = await db
    .update(refundRequests)
    .set({ status: "confirmed", confirmedAt: new Date(), updatedAt: new Date() })
    .where(and(eq(refundRequests.id, input.requestId), eq(refundRequests.status, "sent")))
    .returning({ id: refundRequests.id });
  return updated.length ? { ok: true } : { error: "arefund.errMoved" };
}

/** Not owed after all, with the reason. Never once money has left. */
export async function cancelRefund(input: { requestId: string; reason: string }): Promise<Result> {
  const reason = input.reason.trim();
  if (reason.length < 5) return { error: "arefund.errReason" };
  const updated = await db
    .update(refundRequests)
    .set({ status: "cancelled", cancelledReason: reason.slice(0, 300), cancelledAt: new Date(), updatedAt: new Date() })
    .where(and(eq(refundRequests.id, input.requestId), eq(refundRequests.status, "owed")))
    .returning({ id: refundRequests.id });
  return updated.length ? { ok: true } : { error: "arefund.errMoved" };
}

export type RefundQueueRow = {
  id: string;
  amountCents: number;
  currency: string;
  payeeName: string | null;
  status: RefundRequestStatus;
  reason: string;
  owned: boolean;
  needsTwoPeople: boolean;
  createdAt: Date;
  proofUrl: string | null;
};

/** Open work, oldest first. Money facts only: no session content, no clinician notes. */
export async function refundQueue(): Promise<RefundQueueRow[]> {
  const settings = await getSettings();
  const rows = await db
    .select()
    .from(refundRequests)
    .where(inArray(refundRequests.status, ["owed", "sent"]))
    .orderBy(asc(refundRequests.createdAt))
    .limit(200);
  return rows.map((row) => ({
    id: row.id,
    amountCents: row.amountCents,
    currency: row.currency,
    payeeName: row.payeeName,
    status: row.status,
    reason: row.reason,
    owned: row.ownerUserId !== null,
    needsTwoPeople: row.amountCents > settings.payouts.twoPersonThresholdCents,
    createdAt: row.createdAt,
    proofUrl: row.proofUrl,
  }));
}
