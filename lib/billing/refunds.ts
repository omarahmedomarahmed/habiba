import "server-only";

import { and, asc, eq, inArray, isNull } from "drizzle-orm";

import { controlDb } from "@/lib/db";
import {
  manualPayments,
  patients,
  refundRequests,
  sessionPayments,
  sessions,
  type RefundRequestStatus,
} from "@/lib/db/schema";
import { MIN_REASON } from "@/lib/admin/reason";
import type { MessageKey } from "@/lib/i18n/messages";
import { log, ref } from "@/lib/logger";
import { getSettings } from "@/lib/settings";

import { fourEyesProblem } from "./four-eyes";
import {
  POT_SHARE_REFUND,
  refundOwedCents,
  sharesOf,
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
 * 🔴 Board 807/808: whether an employee's share of a pot row ever arrived, for
 * the patient's own screens, refunded rows included. A refund puts the session
 * back to `pending`, so the session alone cannot say it once the money went
 * back; the rails that brought it can: a confirmed transfer, a card charge (on
 * the row or through the gateway), or their wallet.
 */
export async function employeeShareArrived(payment: {
  id: string;
  sessionId: string;
  stripePaymentIntentId: string | null;
}): Promise<boolean> {
  if (payment.stripePaymentIntentId) return true;
  const { paidAttemptFor } = await import("./gateway/session");
  const { walletSpentOn } = await import("./wallet");
  const [[session], [transfer], gatewayPaid, walletSpent] = await Promise.all([
    db
      .select({ paymentStatus: sessions.paymentStatus })
      .from(sessions)
      .where(eq(sessions.id, payment.sessionId))
      .limit(1),
    db
      .select({ id: manualPayments.id })
      .from(manualPayments)
      .where(
        and(
          eq(manualPayments.refId, payment.sessionId),
          inArray(manualPayments.purpose, ["session", "payg_session"]),
          eq(manualPayments.state, "confirmed"),
        ),
      )
      .limit(1),
    paidAttemptFor(payment.id).then(Boolean),
    walletSpentOn(payment.sessionId),
  ]);
  return session?.paymentStatus === "paid" || Boolean(transfer) || gatewayPaid || walletSpent > 0;
}

/**
 * 🔴 W2-S12: the employee's half of a pot-funded payment, and which rail it
 * goes back on (`splitRefundPlan`). Their share arrived if the session is paid
 * (a partly covered one is paid only once they pay) or a transfer for it was
 * confirmed; a covered-in-full session is paid with nothing of theirs in it,
 * which the plan reads from the shares.
 */
export async function employeeHalfOf(payment: FrozenSplit & {
  id: string;
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

  const { paidAttemptFor } = await import("./gateway/session");
  const gatewayPaid = Boolean(await paidAttemptFor(payment.id));
  const employee = splitRefundPlan({
    ...payment,
    employeePaid: session?.paymentStatus === "paid" || Boolean(transfer) || gatewayPaid,
    gatewayPaid,
  }).employee;
  /*
   * 🔴 0169: the part their wallet paid goes back to the wallet
   * (`returnSpentHold`), so only the rest is sent. All of it from the wallet
   * means nothing to send.
   */
  if (employee.rail === "none" || employee.rail === "unpaid") return employee;
  const { walletSpentOn } = await import("./wallet");
  const cents = Math.max(0, employee.cents - (await walletSpentOn(payment.sessionId)));
  return cents > 0 ? { ...employee, cents } : { rail: "none", cents: 0 };
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
  /*
   * 🔴 W2-M05: a `pot_share` row is the COMPANY's share, opened when its return
   * to the pot failed. It pays nobody: `returnPotShare` retries the return and
   * then finishes the refund, so the money cannot sit in a log line.
   */
  const amountCents =
    input.reason === POT_SHARE_REFUND
      ? sharesOf({ ...payment, coverageBps: payment.coverageBps ?? 0 }).potCents
      : payment.fundingSource === "pot"
        ? (await employeeHalfOf(payment)).cents
        : Math.max(0, refundOwedCents(payment) - (await walletSpentOnSession(payment.sessionId)));
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

/**
 * 🔴 W2-M05: the company's share, back in its pot, from the queue.
 *
 * Opened when `refundToPot` failed during a refund, which used to leave the
 * money in a log line. No money leaves us, so there is no receipt: the proof is
 * the pot credit itself. The row closes first, then the rest of the refund runs
 * again (`refundToPot` is once-only, so it returns nothing twice) and settles
 * the employee's half by its own rail.
 */
export async function returnPotShare(input: {
  requestId: string;
  actorUserId: string;
}): Promise<Result> {
  const [row] = await db
    .select()
    .from(refundRequests)
    .where(eq(refundRequests.id, input.requestId))
    .limit(1);
  if (!row || row.status !== "owed" || row.reason !== POT_SHARE_REFUND || !row.sessionPaymentId) {
    return { error: "arefund.errMoved" };
  }
  const sessionPaymentId = row.sessionPaymentId;
  /* 🔴 0161: the opener may not also return it while refunds need two people. */
  if ((await getSettings()).rules.approvals.refunds && row.requestedByUserId === input.actorUserId) {
    return { error: "arefund.errTwo" };
  }

  const { refundToPot } = await import("./pot");
  const pot = await refundToPot({
    paymentId: sessionPaymentId,
    reason: "Company share returned from the refund queue",
  });
  if (pot.error) {
    log.error("company share still not returned", { payment: ref(row.sessionPaymentId), reason: pot.error });
    return { error: "arefund.errPot" };
  }

  const now = new Date();
  const moved = await db
    .update(refundRequests)
    .set({
      status: "confirmed",
      sentByUserId: input.actorUserId,
      sentAt: now,
      confirmedAt: now,
      proofUrl: `pot:${row.sessionPaymentId}`,
      ledgerTxnId: crypto.randomUUID(),
      payeeMethod: "pot",
      updatedAt: now,
    })
    .where(and(eq(refundRequests.id, row.id), eq(refundRequests.status, "owed")))
    .returning({ id: refundRequests.id });
  if (moved.length === 0) return { error: "arefund.errMoved" };

  const { refundSessionPayment } = await import("./connect");
  const rest = await refundSessionPayment({
    paymentId: sessionPaymentId,
    reason: "Company share returned; finishing the refund",
    adminUserId: input.actorUserId,
    why: "admin",
  });
  if (rest.error) {
    log.error("company share returned, the rest of the refund did not finish", {
      payment: ref(row.sessionPaymentId),
      reason: rest.error,
    });
    /* 🔴 25 September inventory: said, not only logged, so the operator finishes it. */
    return { error: "arefund.restFailed" };
  }
  return { ok: true };
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
  const destinationTyped = identifier.length >= 3 && accountName.length >= 3 && Boolean(method);

  const [row] = await db
    .select()
    .from(refundRequests)
    .where(eq(refundRequests.id, input.requestId))
    .limit(1);
  if (!row || row.status !== "owed") return { error: "arefund.errMoved" };
  /* W2-M05: the company's share goes back to its pot (`returnPotShare`), never by transfer. */
  if (row.reason === POT_SHARE_REFUND) return { error: "arefund.errMoved" };

  /* K20: a refund of a transfer has no session payment; its books moved when it was queued. */
  const [held] = row.sessionPaymentId
    ? await db.select().from(sessionPayments).where(eq(sessionPayments.id, row.sessionPaymentId)).limit(1)
    : [];

  /*
   * 🔴 W2-M06: never more than the payer paid. Rows queued for a pot payment
   * before W2-S12 carry the whole price plus VAT, which would send an employee
   * the company's money too, and this is the step where money leaves. The
   * ceiling is asked of the same arithmetic that opens a row today.
   */
  if (held) {
    const ceiling =
      held.fundingSource === "pot"
        ? (await employeeHalfOf({
            ...held,
            coverageBps: held.coverageBps ?? 0,
          })).cents
        : Math.max(
            0,
            refundOwedCents({ ...held, coverageBps: held.coverageBps ?? 0 }) -
              (await walletSpentOnSession(held.sessionId)),
          );
    if (row.amountCents > ceiling) {
      log.error("refund not sent: the queued amount is more than the payer paid", {
        request: ref(row.id),
        queued: row.amountCents,
        ceiling,
      });
      return { error: "arefund.errOverpaid" };
    }
  }

  /*
   * 🔴 0152 — WHERE THE MONEY GOES IS ONE PERSON'S WORD, SENDING IT ANOTHER'S.
   *
   * With no destination on record yet, this records the one typed and sends
   * nothing. With one on record, only a different person sends, and to the
   * recorded destination, whatever was typed this time. At any amount: the
   * threshold below is about how much, this is about where.
   */
  /* 🔴 0161 / ruling 13: refunds keep two people by default; the switch can drop it to one. */
  const settings = await getSettings();
  const twoPeople = settings.rules.approvals.refunds;
  let recordedNow = false;
  if (!row.payeeIdentifier || !row.payeeSetByUserId) {
    if (!destinationTyped) return { error: "arefund.errProof" };
    await db
      .update(refundRequests)
      .set({
        payeeMethod: method,
        payeeIdentifier: identifier,
        payeeAccountName: accountName,
        payeeSetByUserId: input.senderUserId,
        updatedAt: new Date(),
      })
      .where(and(eq(refundRequests.id, input.requestId), eq(refundRequests.status, "owed")));
    if (twoPeople) return { error: "arefund.destinationSaved" };
    recordedNow = true;
  } else if (twoPeople && row.payeeSetByUserId === input.senderUserId) {
    return { error: "arefund.errTwo" };
  }
  if (proof.length < 5) return { error: "arefund.errProof" };
  const destination = recordedNow
    ? { method, identifier, accountName }
    : {
        method: row.payeeMethod ?? method,
        identifier: row.payeeIdentifier ?? identifier,
        accountName: row.payeeAccountName ?? accountName,
      };

  /*
   * W2-A01 / D9: the payout queue's rule, asked of the same function. The
   * person who opened the refund is its "editor": they named what is owed and
   * may not also be the one who sends it.
   */
  const problem = fourEyesProblem({
    actorUserId: input.senderUserId,
    payeeUserId: null,
    editorUserId: row.requestedByUserId,
    amountCents: row.amountCents,
    thresholdCents: settings.payouts.twoPersonThresholdCents,
    ownerUserId: row.ownerUserId,
    movesMoney: true,
    twoPeople,
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
  if (held?.fundingSource === "pot" && held.status === "paid") {
    const { refundToPot } = await import("./pot");
    const pot = await refundToPot({ paymentId: held.id, reason: row.reason });
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

  const sent = await db
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
          payeeMethod: destination.method,
          payeeIdentifier: destination.identifier,
          payeeAccountName: destination.accountName,
          updatedAt: now,
        })
        .where(and(eq(refundRequests.id, input.requestId), eq(refundRequests.status, "owed")))
        .returning({ id: refundRequests.id });
      if (moved.length === 0) return { error: "arefund.errMoved" as const };

      /*
       * 🔴 K20: a transfer's refund. The wallet credit it replaced was reversed
       * when it was queued (`refundTransferInstead`), so the money leaving now
       * has already left the books; nothing posts twice.
       */
      if (!row.sessionPaymentId) return { ok: true };

      const [payment] = await tx
        .update(sessionPayments)
        .set({ status: "refunded" })
        .where(
          and(eq(sessionPayments.id, row.sessionPaymentId), eq(sessionPayments.status, "paid")),
        )
        .returning();
      // Refunded some other way already: nothing here may post a second reversal.
      if (!payment) throw new PaymentNotHeld();

      const { postReversalOf, postSessionRefund } = await import("./ledger");
      if (payment.fundingSource === "pot") {
        /* W2-M01: a pot row's books are its legs, not one posting of the price. */
        await postReversalOf({
          paymentId: payment.id,
          txnId,
          executor: tx,
          createdBy: input.senderUserId,
        });
      } else {
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
      }

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

  /* 🔴 0169: the part the wallet paid goes back to the wallet. After the transaction, which held the connection. */
  if ("ok" in sent && sent.ok && held) {
    const { returnSpentHold } = await import("./wallet");
    await returnSpentHold(held.sessionId, row.reason);
  }
  return sent;
}

class PaymentNotHeld extends Error {}

async function walletSpentOnSession(sessionId: string): Promise<number> {
  const { walletSpentOn } = await import("./wallet");
  return walletSpentOn(sessionId);
}

/** It arrived. */
export async function confirmRefund(input: { requestId: string }): Promise<Result> {
  const updated = await db
    .update(refundRequests)
    .set({ status: "confirmed", confirmedAt: new Date(), updatedAt: new Date() })
    .where(and(eq(refundRequests.id, input.requestId), eq(refundRequests.status, "sent")))
    .returning({ id: refundRequests.id });
  return updated.length ? { ok: true } : { error: "arefund.errMoved" };
}

/**
 * Not owed after all, with the reason. Never once money has left.
 *
 * 🔴 0157 / A16: TWO PEOPLE. Money owed back to a patient was one click away
 * from not being owed, by anybody on staff, and the row did not say who. The
 * first person asks, with the reason; a different person cancels. Like 0152,
 * the first step answers with `arefund.cancelAsked`, which the action reads
 * as done. The database refuses a cancel by the person who asked.
 */
/**
 * Cancel an owed refund. K20: a transfer's refund that is cancelled puts the
 * money back in the patient's wallet, where it was before they asked, so
 * cancelling a refund never loses it. Only the call that cancelled does this.
 */
export async function cancelRefund(input: { requestId: string; reason: string; byUserId: string }): Promise<Result> {
  const result = await cancelRefundRow(input);
  if (result.ok) {
    const { rewalletCancelledRefund } = await import("./transfer-wallet");
    await rewalletCancelledRefund(input.requestId);
  }
  return result;
}

async function cancelRefundRow(input: { requestId: string; reason: string; byUserId: string }): Promise<Result> {
  const [row] = await db
    .select({ status: refundRequests.status, askedBy: refundRequests.cancelAskedByUserId })
    .from(refundRequests)
    .where(eq(refundRequests.id, input.requestId))
    .limit(1);
  if (!row || row.status !== "owed") return { error: "arefund.errMoved" };
  /* 🔴 0161: one person asks and cancels in one step when refunds need only one. */
  const twoPeople = (await getSettings()).rules.approvals.refunds;

  if (!row.askedBy && !twoPeople) {
    const reason = input.reason.trim();
    if (reason.length < MIN_REASON) return { error: "aconfirm.tooShort" };
    const now = new Date();
    const done = await db
      .update(refundRequests)
      .set({
        status: "cancelled",
        cancelAskedByUserId: input.byUserId,
        cancelAskedAt: now,
        cancelledReason: reason.slice(0, 300),
        cancelledByUserId: input.byUserId,
        cancelledAt: now,
        updatedAt: now,
      })
      .where(and(eq(refundRequests.id, input.requestId), eq(refundRequests.status, "owed")))
      .returning({ id: refundRequests.id });
    return done.length ? { ok: true } : { error: "arefund.errMoved" };
  }

  if (!row.askedBy) {
    const reason = input.reason.trim();
    if (reason.length < MIN_REASON) return { error: "aconfirm.tooShort" };
    const asked = await db
      .update(refundRequests)
      .set({ cancelAskedByUserId: input.byUserId, cancelAskedAt: new Date(), cancelledReason: reason.slice(0, 300), updatedAt: new Date() })
      .where(and(eq(refundRequests.id, input.requestId), eq(refundRequests.status, "owed"), isNull(refundRequests.cancelAskedByUserId)))
      .returning({ id: refundRequests.id });
    return asked.length ? { error: "arefund.cancelAsked" } : { error: "arefund.errMoved" };
  }

  if (twoPeople && row.askedBy === input.byUserId) return { error: "arefund.errTwo" };
  const updated = await db
    .update(refundRequests)
    .set({ status: "cancelled", cancelledByUserId: input.byUserId, cancelledAt: new Date(), updatedAt: new Date() })
    .where(
      and(
        eq(refundRequests.id, input.requestId),
        eq(refundRequests.status, "owed"),
        eq(refundRequests.cancelAskedByUserId, row.askedBy),
      ),
    )
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
  /** 0152 — where it goes, once somebody has said, and who said it. */
  destination: string | null;
  destinationSetBy: string | null;
  /** 0157 — a cancel somebody asked for, and who, waiting on a second person. */
  cancelAsked: string | null;
  cancelAskedBy: string | null;
  /**
   * What goes back, in the currency it came in: the pounds of the transfer
   * that paid, when one did. The queue showed "$68.40" for a patient who sent
   * EGP 3,420, and no name at all (live walkthrough).
   */
  sendMinor: number | null;
  sendCurrency: string | null;
  patientName: string | null;
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

  /* The session behind each payment: who it was for, and the transfer that paid it. */
  const paymentIds = rows.map((row) => row.sessionPaymentId).filter((id): id is string => Boolean(id));
  const facts =
    paymentIds.length > 0
      ? await db
          .select({
            paymentId: sessionPayments.id,
            sessionId: sessions.id,
            guestName: sessions.guestName,
            firstName: patients.firstName,
            lastName: patients.lastName,
          })
          .from(sessionPayments)
          .innerJoin(sessions, eq(sessions.id, sessionPayments.sessionId))
          .leftJoin(patients, eq(patients.id, sessions.patientId))
          .where(inArray(sessionPayments.id, paymentIds))
      : [];
  const sessionIds = facts.map((f) => f.sessionId);
  const transfers =
    sessionIds.length > 0
      ? await db
          .select({ refId: manualPayments.refId, amountCents: manualPayments.amountCents, currency: manualPayments.currency })
          .from(manualPayments)
          .where(
            and(
              /* ME70: a pay-as-you-go session transfer pays a session too, and names it the same way. */
              inArray(manualPayments.purpose, ["session", "payg_session"]),
              inArray(manualPayments.refId, sessionIds),
              eq(manualPayments.state, "confirmed"),
            ),
          )
      : [];
  const paid = new Map(
    facts.map((f) => {
      const transfer = transfers.find((t) => t.refId === f.sessionId);
      return [
        f.paymentId,
        {
          sendMinor: transfer?.amountCents ?? null,
          sendCurrency: transfer?.currency ?? null,
          patientName: [f.firstName, f.lastName].filter(Boolean).join(" ") || f.guestName || null,
        },
      ] as const;
    }),
  );

  /*
   * K20: a transfer asked back instead of kept in the wallet. The pounds it
   * sent are what goes back, and the name is the session's patient.
   */
  const transfersBack = new Map<string, { sendMinor: number | null; sendCurrency: string | null; patientName: string | null }>();
  for (const row of rows) {
    if (!row.manualPaymentId) continue;
    const [fact] = await db
      .select({
        amountCents: manualPayments.amountCents,
        currency: manualPayments.currency,
        guestName: sessions.guestName,
        firstName: patients.firstName,
        lastName: patients.lastName,
      })
      .from(manualPayments)
      .leftJoin(sessions, eq(sessions.id, manualPayments.refId))
      .leftJoin(patients, eq(patients.id, sessions.patientId))
      .where(eq(manualPayments.id, row.manualPaymentId))
      .limit(1);
    transfersBack.set(row.id, {
      sendMinor: fact?.amountCents ?? null,
      sendCurrency: fact?.currency ?? null,
      patientName: [fact?.firstName, fact?.lastName].filter(Boolean).join(" ") || fact?.guestName || null,
    });
  }

  return rows.map((row) => ({
    id: row.id,
    amountCents: row.amountCents,
    currency: row.currency,
    payeeName: row.payeeName,
    status: row.status,
    reason: row.reason,
    owned: row.ownerUserId !== null,
    /* 🔴 0161: only while the refunds switch asks for two people. */
    needsTwoPeople:
      settings.rules.approvals.refunds && row.amountCents > settings.payouts.twoPersonThresholdCents,
    createdAt: row.createdAt,
    proofUrl: row.proofUrl,
    destination: row.payeeIdentifier
      ? [row.payeeMethod, row.payeeIdentifier, row.payeeAccountName].filter(Boolean).join(" · ")
      : null,
    destinationSetBy: row.payeeSetByUserId,
    cancelAsked: row.cancelAskedByUserId ? row.cancelledReason : null,
    cancelAskedBy: row.cancelAskedByUserId,
    ...((row.sessionPaymentId ? paid.get(row.sessionPaymentId) : transfersBack.get(row.id)) ?? {
      sendMinor: null,
      sendCurrency: null,
      patientName: null,
    }),
  }));
}
