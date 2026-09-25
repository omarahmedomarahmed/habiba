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

  if (result.error) return { error: result.error };

  await audit({
    actor,
    category: "admin",
    action: "transfer.confirm",
    resourceType: "manual_payment",
    resourceId: paymentId,
    reason: "Bank transfer checked and confirmed",
  });

  revalidatePath("/admin/transfers");
  return { ok: "Confirmed. They can carry on." };
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

  if (result.error) return { error: result.error };
  if (gate.approvalId) {
    await closeApproval({ approvalId: gate.approvalId, decidedBy: actor.userId, state: "done" });
  }

  revalidatePath("/admin/transfers");
  return { ok: "Credited, and the payer has been told." };
}
