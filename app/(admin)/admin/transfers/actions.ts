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

export async function confirm(paymentId: string): Promise<TransferState> {
  const actor = await requireStaff();

  const result = await confirmPayment({
    paymentId,
    byUserId: actor.userId,
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
