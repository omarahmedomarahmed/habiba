"use server";

import { revalidatePath } from "next/cache";

import { audit } from "@/lib/audit";
import { requireStaff } from "@/lib/auth/guard";
import {
  cancelRefund,
  claimRefund,
  confirmRefund,
  markRefundSent,
} from "@/lib/billing/refunds";
import type { MessageKey } from "@/lib/i18n/messages";

export type RefundState = { error?: string; ok?: boolean };

/**
 * 🔴 W1-28a: the refund queue's four buttons, for staff and above (D9: the
 * founder decided staff may work payouts). Four eyes and the one-reversal
 * rule live in `lib/billing/refunds.ts` and the database; every act here is
 * audited with the person who did it. `resourceId` is the request's uuid (H6).
 */
async function done(
  actor: Awaited<ReturnType<typeof requireStaff>>,
  requestId: string,
  action: string,
  result: { ok?: boolean; error?: MessageKey },
  reason?: string,
): Promise<RefundState> {
  if (result.error) {
    const { getI18n } = await import("@/lib/i18n/server");
    return { error: (await getI18n()).t(result.error) };
  }
  await audit({
    actor,
    category: "billing",
    action,
    resourceType: "refund_request",
    resourceId: requestId,
    ...(reason ? { reason } : {}),
  });
  revalidatePath("/admin/payouts");
  return { ok: true };
}

export async function takeOnRefund(_prev: RefundState, formData: FormData): Promise<RefundState> {
  const actor = await requireStaff();
  const requestId = String(formData.get("requestId") ?? "");
  return done(actor, requestId, "refund.claimed", await claimRefund({ requestId, ownerUserId: actor.userId }));
}

export async function markRefundSentAction(_prev: RefundState, formData: FormData): Promise<RefundState> {
  const actor = await requireStaff();
  const requestId = String(formData.get("requestId") ?? "");
  const result = await markRefundSent({
    requestId,
    senderUserId: actor.userId,
    proofUrl: String(formData.get("proofUrl") ?? ""),
    method: String(formData.get("method") ?? ""),
    identifier: String(formData.get("identifier") ?? ""),
    accountName: String(formData.get("accountName") ?? ""),
  });
  return done(actor, requestId, "refund.sent", result);
}

export async function confirmRefundAction(_prev: RefundState, formData: FormData): Promise<RefundState> {
  const actor = await requireStaff();
  const requestId = String(formData.get("requestId") ?? "");
  return done(actor, requestId, "refund.confirmed", await confirmRefund({ requestId }));
}

export async function cancelRefundAction(_prev: RefundState, formData: FormData): Promise<RefundState> {
  const actor = await requireStaff();
  const requestId = String(formData.get("requestId") ?? "");
  const reason = String(formData.get("reason") ?? "");
  return done(actor, requestId, "refund.cancelled", await cancelRefund({ requestId, reason }), reason.trim());
}
