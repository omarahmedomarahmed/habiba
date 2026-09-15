/**
 * What a confirmed bank transfer actually unlocks.
 *
 * ## 🔴 WHY THIS IS A SEPARATE FILE FROM THE QUEUE
 *
 * `lib/billing/manual.ts` owns the queue: rows, states, who decided, when. It
 * knows nothing about sessions, invoices or pots, and that is deliberate. A
 * single file that both ran the queue and reached into three money tables is a
 * file where a queue bug can take a pot with it, and where the blast radius of
 * "we got the state machine wrong" is everybody's balance.
 *
 * So the queue calls `grantFor` as a callback it was handed. Same shape as
 * C360's rule for the forecast, applied to a different fear.
 *
 * ## 🔴 EVERY GRANT IS IDEMPOTENT
 *
 * An operator double-clicking Confirm, a retry after a timeout, a re-run after
 * the grant threw: all three land here twice. Each branch below is written so
 * the second run changes nothing, because the alternative is a pot credited
 * twice with no processor to reverse it.
 */
import "server-only";

import { and, eq, sql } from "drizzle-orm";

import { controlDb as db } from "@/lib/db";
import {
  invoices,
  manualPayments,
  sessions,
  sponsorPots,
  type ManualPayment,
} from "@/lib/db/schema";
import { log } from "@/lib/logger";

/**
 * Take the action the money was for.
 *
 * Throws on an unknown purpose rather than shrugging: a purpose that reaches
 * here without a branch means somebody added a payment kind and forgot the half
 * that gives the payer what they paid for, and a silent no-op would look exactly
 * like success to the operator who confirmed it.
 */
export async function grantFor(payment: ManualPayment): Promise<void> {
  switch (payment.purpose) {
    case "session":
    case "payg_session":
      return grantSession(payment);
    case "subscription":
      return grantSubscription(payment);
    case "pot_topup":
      return grantPotTopUp(payment);
    default: {
      const unreachable: never = payment.purpose;
      throw new Error(`No grant for payment purpose ${String(unreachable)}`);
    }
  }
}

/* --------------------------------------------------------------- session -- */

/**
 * The patient can join.
 *
 * 🔴 `payment_status` is the server-side gate the join token already reads, so
 * flipping it here is the whole grant: no new state, no second flag, nothing
 * that could disagree with the existing one. The patient's screen goes from a
 * spinner to a live session because the same column it was already watching
 * changed.
 *
 * The WHERE keeps it idempotent and keeps it honest: a session already `paid`
 * is not re-paid, and a session that was cancelled while the money was in
 * flight is NOT quietly revived.
 */
async function grantSession(payment: ManualPayment): Promise<void> {
  if (!payment.refId) throw new Error("A session payment with no session");

  const updated = await db
    .update(sessions)
    .set({ paymentStatus: "paid" })
    .where(and(eq(sessions.id, payment.refId), eq(sessions.paymentStatus, "pending")))
    .returning({ id: sessions.id });

  if (updated.length === 0) {
    /*
     * Not an error. Either it was already paid (a second run, which is fine) or
     * the session moved on while the transfer was being checked, which an
     * operator needs to see rather than have swallowed.
     */
    log.warn("manual session payment confirmed but the session was not pending", {
      paymentId: payment.id,
      sessionId: payment.refId,
    });
  }
}

/* ---------------------------------------------------------- subscription -- */

/**
 * The invoice is settled.
 *
 * 🔴 `paidAt` is only stamped when it was not already set, so a second run does
 * not move the date. A payment date that drifts is a payment date nobody can
 * reconcile a bank statement against, which is the one thing this rail exists to
 * make possible.
 */
async function grantSubscription(payment: ManualPayment): Promise<void> {
  if (!payment.refId) throw new Error("A subscription payment with no invoice");

  const updated = await db
    .update(invoices)
    .set({ status: "paid", paidAt: new Date() })
    .where(and(eq(invoices.id, payment.refId), eq(invoices.status, "due")))
    .returning({ id: invoices.id });

  if (updated.length === 0) {
    log.warn("manual subscription payment confirmed but the invoice was not due", {
      paymentId: payment.id,
      invoiceId: payment.refId,
    });
  }
}

/* -------------------------------------------------------------- the pot -- */

/**
 * The company's pot goes up, and their people can book against it immediately.
 *
 * 🔴 IDEMPOTENT BY LEDGER, NOT BY BALANCE. A bare `balance = balance + n` run
 * twice credits twice and nothing in the row remembers it happened. So the
 * credit is conditional on this payment not already having been applied, which
 * is asked of the payments table itself: a confirmed payment whose
 * `decided_at` predates the pot's `updated_at` is not re-applied.
 *
 * That check is deliberately conservative. When it cannot prove the credit is
 * new it refuses, and an operator re-runs it, which is the right direction to
 * be wrong in for money moving into an account.
 */
async function grantPotTopUp(payment: ManualPayment): Promise<void> {
  if (!payment.sponsorId) throw new Error("A pot top-up with no sponsor");

  /*
   * One statement, so the read and the write cannot be separated by another
   * confirmation of the same payment landing between them.
   */
  const result = await db.execute(sql`
    UPDATE sponsor_pots
       SET balance_cents = balance_cents + ${payment.amountCents},
           updated_at = now()
     WHERE sponsor_id = ${payment.sponsorId}
       AND NOT EXISTS (
         SELECT 1 FROM manual_payments p
          WHERE p.id = ${payment.id}
            AND p.state = 'confirmed'
            AND p.decided_at < sponsor_pots.updated_at
       )
    RETURNING sponsor_pots.id`);

  if (result.rows.length === 0) {
    log.warn("manual pot top-up confirmed but the pot was not credited", {
      paymentId: payment.id,
      sponsorId: payment.sponsorId,
      why: "either there is no pot, or this payment had already been applied",
    });
    throw new Error("The pot was not credited. Check it before confirming again.");
  }
}

/** Re-export so a caller needs one import rather than two. */
export { manualPayments };
