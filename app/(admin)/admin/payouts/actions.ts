"use server";

import { revalidatePath } from "next/cache";

import { audit } from "@/lib/audit";
import { requireRole } from "@/lib/auth/guard";
import {
  approvePayout,
  claimPayout,
  confirmPayout,
  markPayoutSent,
  rejectPayout,
} from "@/lib/billing/payouts";

export type QueueState = { error?: string; ok?: boolean };

/**
 * The 24/7 team's four buttons. PLAN.md 16.2, 16.3a–d.
 *
 * Every one of them is audited and every one of them names the person, because
 * a manual money process with no attribution is a manual money process nobody
 * can investigate. The refusals live in `lib/billing/payouts.ts` and, for the
 * two that matter, in the database itself.
 */

export async function takeOn(_prev: QueueState, formData: FormData): Promise<QueueState> {
  const actor = await requireRole("super_admin");
  const requestId = String(formData.get("requestId") ?? "");

  const result = await claimPayout({ requestId, ownerUserId: actor.userId });
  if (result.error) return { error: result.error };

  await audit({
    actor,
    category: "billing",
    action: "payout.claimed",
    resourceType: "payout_request",
    resourceId: requestId,
  });
  revalidatePath("/admin/payouts");
  return { ok: true };
}

export async function approve(_prev: QueueState, formData: FormData): Promise<QueueState> {
  const actor = await requireRole("super_admin");
  const requestId = String(formData.get("requestId") ?? "");

  const result = await approvePayout({ requestId, approverUserId: actor.userId });
  if (result.error) return { error: result.error };

  await audit({
    actor,
    category: "billing",
    action: "payout.approved",
    resourceType: "payout_request",
    resourceId: requestId,
  });
  revalidatePath("/admin/payouts");
  return { ok: true };
}

/**
 * The transfer has been made. 16.3c — the receipt is not optional.
 *
 * A payout marked sent with nothing to show for it is the state a dispute
 * cannot be settled from, so the URL of the uploaded screenshot is required
 * here and by `markPayoutSent`.
 */
export async function markSent(_prev: QueueState, formData: FormData): Promise<QueueState> {
  const actor = await requireRole("super_admin");
  const requestId = String(formData.get("requestId") ?? "");

  const result = await markPayoutSent({
    requestId,
    senderUserId: actor.userId,
    proofUrl: String(formData.get("proofUrl") ?? ""),
  });
  if (result.error) return { error: result.error };

  await audit({
    actor,
    category: "billing",
    action: "payout.sent",
    resourceType: "payout_request",
    resourceId: requestId,
  });
  revalidatePath("/admin/payouts");
  return { ok: true };
}

export async function confirm(_prev: QueueState, formData: FormData): Promise<QueueState> {
  const actor = await requireRole("super_admin");
  const requestId = String(formData.get("requestId") ?? "");

  const result = await confirmPayout({ requestId, actorUserId: actor.userId });
  if (result.error) return { error: result.error };

  await audit({
    actor,
    category: "billing",
    action: "payout.confirmed",
    resourceType: "payout_request",
    resourceId: requestId,
  });
  revalidatePath("/admin/payouts");
  return { ok: true };
}

export async function reject(_prev: QueueState, formData: FormData): Promise<QueueState> {
  const actor = await requireRole("super_admin");
  const requestId = String(formData.get("requestId") ?? "");

  const result = await rejectPayout({
    requestId,
    actorUserId: actor.userId,
    reason: String(formData.get("reason") ?? ""),
  });
  if (result.error) return { error: result.error };

  await audit({
    actor,
    category: "billing",
    action: "payout.rejected",
    resourceType: "payout_request",
    resourceId: requestId,
  });
  revalidatePath("/admin/payouts");
  return { ok: true };
}
