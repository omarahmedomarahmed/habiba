"use server";

import { revalidatePath } from "next/cache";

import { audit } from "@/lib/audit";
import { requireStaff } from "@/lib/auth/guard";
import { discardCart, resolveException, retryGrant } from "@/lib/billing/rail-exceptions";
import { getI18n } from "@/lib/i18n/server";

export type ExceptionState = { error?: string; ok?: boolean };

/**
 * 🔴 W2-A03: the three acts on money that needs a decision, for staff (the
 * queue is theirs, `lib/admin/access.ts`).
 *
 * None of them can confirm a claim, edit an amount or reopen a decision,
 * which is what `verify:rail` protects in `actions.ts`; it names these three
 * as well. Retry re-runs the grant a confirmation already ran. Resolve writes
 * down what a person did. Discard removes an open cart, which carries no money
 * and no claim. Every one is audited with the person who did it.
 */

async function say(error: Parameters<Awaited<ReturnType<typeof getI18n>>["t"]>[0]): Promise<string> {
  return (await getI18n()).t(error);
}

export async function retryException(paymentId: string): Promise<ExceptionState> {
  const actor = await requireStaff();
  const result = await retryGrant({ paymentId });
  await audit({
    actor,
    category: "billing",
    action: result.ok ? "transfer.grant_retried" : "transfer.grant_retry_failed",
    resourceType: "manual_payment",
    resourceId: paymentId,
  });
  revalidatePath("/admin/transfers");
  return result.error ? { error: await say(result.error) } : { ok: true };
}

export async function resolveTransferException(
  paymentId: string,
  note: string,
): Promise<ExceptionState> {
  const actor = await requireStaff();
  const result = await resolveException({ paymentId, byUserId: actor.userId, note });
  if (result.error) return { error: await say(result.error) };

  await audit({
    actor,
    category: "billing",
    action: "transfer.exception_resolved",
    resourceType: "manual_payment",
    resourceId: paymentId,
    reason: note.trim().slice(0, 500),
  });
  revalidatePath("/admin/transfers");
  return { ok: true };
}

/**
 * 🔴 K20: the patient asked for the money back instead of keeping it in their
 * wallet. Only while that credit is whole; the reason is required and kept on
 * the transfer and in the audit row. Queued on the refund queue like any other.
 */
export async function refundInsteadOfWallet(paymentId: string, reason: string): Promise<ExceptionState> {
  const actor = await requireStaff();
  const { refundTransferInstead } = await import("@/lib/billing/transfer-wallet");
  const result = await refundTransferInstead({ paymentId, byUserId: actor.userId, reason });
  if (result.error) return { error: result.error };

  await audit({
    actor,
    category: "billing",
    action: "transfer.refund_instead_of_wallet",
    resourceType: "manual_payment",
    resourceId: paymentId,
    reason: reason.trim().slice(0, 500),
  });
  revalidatePath("/admin/transfers");
  revalidatePath("/admin/payouts");
  return { ok: true };
}

export async function discardOpenCart(paymentId: string): Promise<ExceptionState> {
  const actor = await requireStaff();
  if (!(await discardCart(paymentId))) return { error: await say("arefund.errMoved") };

  await audit({
    actor,
    category: "billing",
    action: "transfer.cart_discarded",
    resourceType: "manual_payment",
    resourceId: paymentId,
  });
  revalidatePath("/admin/transfers");
  return { ok: true };
}
