"use server";

import { revalidatePath } from "next/cache";

import { audit } from "@/lib/audit";
import { requireStaff } from "@/lib/auth/guard";
import { confirmPayment, rejectPayment } from "@/lib/billing/manual";
import { grantFor } from "@/lib/billing/manual-grants";

/**
 * The two decisions, and nothing else.
 *
 * 🔴 An operator can confirm or reject. They cannot edit an amount, change a
 * reference, or reopen a decided payment. Every one of those is a way for the
 * record of what a person checked to stop matching what actually happened, and
 * this table is the ONLY record: there is no processor to reconcile against.
 *
 * A correction is a new payment, decided again, with both rows visible.
 */
export type TransferState = { error?: string; ok?: string };

export async function confirm(
  paymentId: string,
  expected?: { amountCents: number; settlesCents: number },
): Promise<TransferState> {
  const actor = await requireStaff();

  const result = await confirmPayment({
    paymentId,
    byUserId: actor.userId,
    expected,
    /*
     * 🔴 What a confirmation UNLOCKS lives in its own module. `lib/billing/manual.ts`
     * owns the queue and knows nothing about sessions, invoices or pots, which is
     * what stops a queue bug from being able to take a pot with it.
     */
    onConfirmed: grantFor,
  });

  /*
   * 🔴 K5: audited whenever the row moved to confirmed, including when the
   * grant after it failed. A person decided the money arrived; the audit row
   * is the record of that decision, and it went missing on exactly the
   * confirmations somebody would later need to trace.
   */
  if (result.confirmed) {
    await audit({
      actor,
      category: "admin",
      action: "transfer.confirm",
      resourceType: "manual_payment",
      resourceId: paymentId,
      reason: result.error
        ? "Bank transfer checked and confirmed; the grant failed and is under Needs a decision"
        : result.flagged
          ? `Bank transfer checked and confirmed; raised as ${result.flagged} under Needs a decision`
          : result.walletCredited
            ? "Bank transfer checked and confirmed; the booking was cancelled, so it was credited to the patient's wallet"
            : "Bank transfer checked and confirmed",
    });
    revalidatePath("/admin/transfers");
  }

  if (result.error) return { error: result.error };
  if (result.flagged) {
    return { error: flaggedMessage(result.flagged) };
  }
  if (result.walletCredited) {
    return { ok: "Confirmed. The booking was cancelled, so it went to the patient's wallet and they have been told." };
  }
  return { ok: "Confirmed. They can carry on." };
}

/** K5: what staff read when a confirmation delivered nothing. */
function flaggedMessage(kind: string): string {
  return kind === "overpaid"
    ? "Confirmed, but it was more than owed or already paid. It is under Needs a decision."
    : "Confirmed, but it paid for nothing that could take it. It is under Needs a decision.";
}

export async function reject(paymentId: string, reason: string): Promise<TransferState> {
  const actor = await requireStaff();

  const result = await rejectPayment({ paymentId, byUserId: actor.userId, reason });
  if (result.error) return { error: result.error };

  await audit({
    actor,
    category: "admin",
    action: "transfer.reject",
    resourceType: "manual_payment",
    resourceId: paymentId,
    /*
     * 🔴 The reason is in the audit row as well as on the payment, because the
     * payment row is what the payer reads and the audit row is what we read in
     * six months when they dispute it. They must say the same thing.
     */
    reason,
  });

  revalidatePath("/admin/transfers");
  return { ok: "Rejected, and they have been told why." };
}

/**
 * 🔴 76.15 — MONEY ARRIVED AND NOBODY EVER CLAIMED IT.
 *
 * The rail's design is that nothing moves until a person confirms a CLAIM, and
 * it has one gap it cannot close by itself: a payer who sends the money and
 * never presses Submit. They have paid us, the bank line is real, and refusing
 * to credit them would be the product punishing somebody for its own middle
 * state.
 *
 * The reason is required and it stays ON the payment rather than in a log,
 * because the fact that no proof was ever given has to follow this payment to
 * every screen it appears on. `confirmWithoutProof` routes through the ordinary
 * confirmation, so the grant, the ledger posting and the message to the payer
 * are the same code path as every other confirmation: there is no second way
 * for money to reach an account.
 */
export async function confirmUnclaimed(
  paymentId: string,
  reason: string,
): Promise<TransferState> {
  const actor = await requireStaff();

  const { MIN_REASON } = await import("@/lib/admin/reason");
  if (reason.trim().length < MIN_REASON) {
    return { error: "Say what you saw in the bank. This stays on the payment." };
  }

  /*
   * 🔴 0161 / ruling 13c: money with no proof is money from nothing when one
   * person confirms it. While the switch is on, the first person asks and a
   * second confirms, with the first person's words.
   */
  const { getSettings } = await import("@/lib/settings");
  const { closeApproval, secondPersonGate } = await import("@/lib/billing/approvals");
  const gate = await secondPersonGate({
    kind: "transfer_without_proof",
    subjectId: paymentId,
    payload: { paymentId },
    reason,
    actorUserId: actor.userId,
    enabled: (await getSettings()).rules.approvals.transferWithoutProof,
  });
  if (!gate.go) {
    revalidatePath("/admin/transfers");
    return { ok: gate.message };
  }

  const { confirmWithoutProof } = await import("@/lib/billing/manual");
  const result = await confirmWithoutProof({
    paymentId,
    byUserId: actor.userId,
    reason: gate.reason,
    onConfirmed: grantFor,
  });

  /*
   * 🔴 K5: the approval closes whenever the money was confirmed, even when the
   * grant after it failed. Left open, a second Complete found the payment no
   * longer open and failed on it for ever.
   */
  if (result.confirmed && gate.approvalId) {
    await closeApproval({ approvalId: gate.approvalId, decidedBy: actor.userId, state: "done" });
  }

  if (!result.confirmed) {
    /*
     * 🔴 K4: THE CART IS GONE OR MOVED ON. The payer cancelled it, retention
     * expired it, or they submitted proof and it is now an ordinary claim in
     * the queue. There is nothing left to credit without proof, so the request
     * closes as void and says so, instead of staying open with a Complete that
     * can never succeed.
     */
    const { controlDb: db } = await import("@/lib/db");
    const { manualPayments } = await import("@/lib/db/schema");
    const { eq } = await import("drizzle-orm");
    const [still] = await db
      .select({ state: manualPayments.state })
      .from(manualPayments)
      .where(eq(manualPayments.id, paymentId))
      .limit(1);
    if (gate.approvalId && still?.state !== "awaiting_proof") {
      const { voidApprovalsFor } = await import("@/lib/billing/approvals");
      await voidApprovalsFor("transfer_without_proof", [paymentId]);
      revalidatePath("/admin/transfers");
      return {
        error: still
          ? "That payment is no longer an open cart. The request is closed; check it in the queue."
          : "That cart was cancelled or expired. The request is closed and nothing was credited.",
      };
    }
    return { error: result.error ?? "Nothing was credited." };
  }

  revalidatePath("/admin/transfers");
  if (result.error) return { error: result.error };
  if (result.flagged) return { error: flaggedMessage(result.flagged) };
  return { ok: "Credited, and the payer has been told." };
}
