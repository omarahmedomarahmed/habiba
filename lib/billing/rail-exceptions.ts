import "server-only";

import { and, asc, eq, isNotNull, isNull, lt, sql } from "drizzle-orm";

import { controlDb as db } from "@/lib/db";
import {
  manualPayments,
  pendingApprovals,
  type ManualPayment,
  type ManualPaymentException,
} from "@/lib/db/schema";
import { log } from "@/lib/logger";

/**
 * 🔴 W2-A03: the transfer rail's exceptions, as work. Migration 0142.
 *
 * A4: "Money that arrives with no claim is a line somebody has to decide
 * about, never silently kept." Four cases were kept silently, each as a log
 * line and nothing else:
 *
 *   grant_failed   confirmed, and the grant threw. The operator was told
 *                  "tell an engineer", and nothing listed or re-ran it.
 *   not_payable    confirmed for a session that was cancelled (or otherwise
 *                  no longer waiting) while the transfer was checked, or a
 *                  bill that was already settled. The money is ours and
 *                  bought nothing.
 *   overpaid       more than the bill. There is no credit balance on this
 *                  rail, so somebody decides: send it back or hold it.
 *
 * and the fourth, the open cart nobody submitted, is discarded here or
 * expires (`expireOpenCarts`, from the daily retention job), because every
 * open cart blocks editing the bank details (`detailsLockedBy`).
 *
 * Nothing here moves money by itself. A retry re-runs the same grant the
 * confirmation ran; a resolution records what a person did and why.
 */

/** Raise one. Loud as well, because a log line is still the first thing an engineer reads. */
export async function flagException(
  paymentId: string,
  kind: ManualPaymentException,
  detail: string,
): Promise<void> {
  await db
    .update(manualPayments)
    .set({
      exception: kind,
      exceptionDetail: detail.slice(0, 300),
      exceptionAt: new Date(),
      exceptionResolvedAt: null,
      exceptionResolvedBy: null,
      exceptionResolution: null,
    })
    .where(eq(manualPayments.id, paymentId));
  log.warn("transfer rail exception raised", { paymentId, kind, detail: detail.slice(0, 120) });
}

/** Everything waiting for a decision, oldest first because they are waiting. */
export async function openExceptions(): Promise<ManualPayment[]> {
  return db
    .select()
    .from(manualPayments)
    .where(and(isNotNull(manualPayments.exception), isNull(manualPayments.exceptionResolvedAt)))
    .orderBy(asc(manualPayments.exceptionAt))
    .limit(200);
}

/**
 * Re-run the grant a confirmation ran and could not finish.
 *
 * The claim is guarded like every move on this rail: the flag is cleared in
 * the WHERE, so two operators pressing Retry run the grant once. Each grant is
 * already built to be re-run (its own guards refuse a second credit), which is
 * why the original comment said "an operator can re-run a grant"; this is the
 * button it never had. A failure raises the flag again with the new error.
 */
export async function retryGrant(input: {
  paymentId: string;
}): Promise<{ ok?: true; error?: "arefund.errMoved" | "arail.errStillFailing" }> {
  const [payment] = await db
    .update(manualPayments)
    .set({ exception: null, exceptionDetail: null, exceptionAt: null })
    .where(
      and(
        eq(manualPayments.id, input.paymentId),
        eq(manualPayments.state, "confirmed"),
        eq(manualPayments.exception, "grant_failed"),
        isNull(manualPayments.exceptionResolvedAt),
      ),
    )
    .returning();
  if (!payment) return { error: "arefund.errMoved" };

  try {
    const { grantFor } = await import("./manual-grants");
    await grantFor(payment);
  } catch (error) {
    await flagException(payment.id, "grant_failed", String(error));
    return { error: "arail.errStillFailing" };
  }

  // The grant can find the thing it paid for gone, and raise that instead. Then nobody is told "ready".
  const [after] = await db
    .select({ exception: manualPayments.exception })
    .from(manualPayments)
    .where(eq(manualPayments.id, payment.id))
    .limit(1);
  if (after?.exception) return { ok: true };

  // The same message the ordinary confirmation sends, after the grant and never before it (76.14).
  const { noticePaymentConfirmed } = await import("./payment-notices");
  await noticePaymentConfirmed(payment.id);
  return { ok: true };
}

/** Somebody decided, and says what they did. The CHECK refuses it without the sentence. */
export async function resolveException(input: {
  paymentId: string;
  byUserId: string;
  note: string;
}): Promise<{ ok?: true; error?: "arail.errNote" | "arefund.errMoved" }> {
  const note = input.note.trim();
  if (note.length < 10) return { error: "arail.errNote" };
  const done = await db
    .update(manualPayments)
    .set({
      exceptionResolvedAt: new Date(),
      exceptionResolvedBy: input.byUserId,
      exceptionResolution: note.slice(0, 500),
    })
    .where(
      and(
        eq(manualPayments.id, input.paymentId),
        isNotNull(manualPayments.exception),
        isNull(manualPayments.exceptionResolvedAt),
      ),
    )
    .returning({ id: manualPayments.id });
  return done.length ? { ok: true } : { error: "arefund.errMoved" };
}

/**
 * An operator throws away an open cart. Only ever an `awaiting_proof` row,
 * the same rule as the payer's own `cancelCart`: the moment proof arrives it
 * is a claim about money and nothing may remove it from the queue.
 *
 * 🔴 AE10: A CART SOMEBODY ASKED A SECOND PERSON TO CREDIT. Discarding it left
 * the "transfer without proof" request asked for ever, its Complete answering
 * that the payment was gone. A second person who discards it now declines the
 * request in the same breath; the person who asked may not (the database
 * refuses anybody closing their own request), so they are told to leave it to
 * the second person, who can complete or decline it.
 */
export async function discardCart(paymentId: string, byUserId?: string): Promise<boolean | "asked"> {
  const [open] = await db
    .select({ id: pendingApprovals.id, askedBy: pendingApprovals.askedBy })
    .from(pendingApprovals)
    .where(
      and(
        eq(pendingApprovals.kind, "transfer_without_proof"),
        eq(pendingApprovals.subjectId, paymentId),
        eq(pendingApprovals.state, "asked"),
      ),
    )
    .limit(1);
  if (open && (!byUserId || open.askedBy === byUserId)) return "asked";

  const gone = await db
    .delete(manualPayments)
    .where(and(eq(manualPayments.id, paymentId), eq(manualPayments.state, "awaiting_proof")))
    .returning({ id: manualPayments.id });
  if (gone.length > 0 && open && byUserId) {
    const { closeApproval } = await import("./approvals");
    await closeApproval({ approvalId: open.id, decidedBy: byUserId, state: "declined" });
  }
  return gone.length > 0;
}

/**
 * Open carts expire. Thirty days is longer than any bank transfer takes to
 * land, and a cart that old is a sheet somebody closed, not a payment in
 * flight; it was blocking the bank details for everybody meanwhile.
 */
export const CART_EXPIRY_DAYS = 30;

export async function expireOpenCarts(now = new Date()): Promise<number> {
  const cutoff = new Date(now.getTime() - CART_EXPIRY_DAYS * 86_400_000);
  const gone = await db
    .delete(manualPayments)
    .where(
      and(
        eq(manualPayments.state, "awaiting_proof"),
        lt(manualPayments.createdAt, cutoff),
        /*
         * 🔴 AE10: not one a second person has been asked to credit. Deleting it
         * left that request asked for ever; it waits for them instead.
         */
        sql`NOT EXISTS (SELECT 1 FROM pending_approvals pa
                         WHERE pa.kind = 'transfer_without_proof' AND pa.state = 'asked'
                           AND pa.subject_id = ${manualPayments.id}::text)`,
      ),
    )
    .returning({ id: manualPayments.id });
  if (gone.length > 0) log.info("open carts expired", { count: gone.length });
  return gone.length;
}
