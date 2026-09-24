"use server";

import { revalidatePath } from "next/cache";

import { audit } from "@/lib/audit";
import { requireStaff } from "@/lib/auth/guard";
import type { MessageKey } from "@/lib/i18n/messages";
import {
  approvePayout,
  claimPayout,
  confirmPayout,
  markPayoutReturned,
  markPayoutSent,
  rejectPayout,
} from "@/lib/billing/payouts";

export type QueueState = { error?: string; ok?: boolean };

/**
 * W2-A01: the four-eyes refusals come back as dictionary keys, so the reader
 * gets them in their language; the older refusals are still sentences.
 */
async function say(error: string): Promise<string> {
  const { en } = await import("@/lib/i18n/messages");
  if (!(error in en)) return error;
  const { getI18n } = await import("@/lib/i18n/server");
  return (await getI18n()).t(error as MessageKey);
}

/**
 * The 24/7 team's four buttons. PLAN.md 16.2, 16.3a–d.
 *
 * 🔴 W2-A01 / D9: staff, not only the founder. The page was staff's and every
 * button was `super_admin`, so staff saw a queue they could not work and the
 * two-person rule needed two founders awake. The four-eyes rules that make
 * this safe are asked of every act in `lib/billing/payouts.ts`.
 *
 * Every one of them is audited and every one of them names the person, because
 * a manual money process with no attribution is a manual money process nobody
 * can investigate. The refusals live in `lib/billing/payouts.ts` and, for the
 * two that matter, in the database itself.
 */

export async function takeOn(_prev: QueueState, formData: FormData): Promise<QueueState> {
  const actor = await requireStaff();
  const requestId = String(formData.get("requestId") ?? "");

  const result = await claimPayout({ requestId, ownerUserId: actor.userId });
  if (result.error) return { error: await say(result.error) };

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
  const actor = await requireStaff();
  const requestId = String(formData.get("requestId") ?? "");

  const result = await approvePayout({ requestId, approverUserId: actor.userId });
  if (result.error) return { error: await say(result.error) };

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
  const actor = await requireStaff();
  const requestId = String(formData.get("requestId") ?? "");

  const result = await markPayoutSent({
    requestId,
    senderUserId: actor.userId,
    proofUrl: String(formData.get("proofUrl") ?? ""),
  });
  if (result.error) return { error: await say(result.error) };

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
  const actor = await requireStaff();
  const requestId = String(formData.get("requestId") ?? "");

  const result = await confirmPayout({ requestId, actorUserId: actor.userId });
  if (result.error) return { error: await say(result.error) };

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
  const actor = await requireStaff();
  const requestId = String(formData.get("requestId") ?? "");

  const result = await rejectPayout({
    requestId,
    actorUserId: actor.userId,
    reason: String(formData.get("reason") ?? ""),
  });
  if (result.error) return { error: await say(result.error) };

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

/**
 * 🔴 W2-A04: the transfer was made and never arrived. The ledger reversal and
 * the once-only rule live in `markPayoutReturned`; the reason is required and
 * the clinician reads it.
 */
export async function didNotArrive(_prev: QueueState, formData: FormData): Promise<QueueState> {
  const actor = await requireStaff();
  const requestId = String(formData.get("requestId") ?? "");
  const reason = String(formData.get("reason") ?? "");

  const result = await markPayoutReturned({ requestId, actorUserId: actor.userId, reason });
  if (result.error) return { error: await say(result.error) };

  await audit({
    actor,
    category: "billing",
    action: "payout.returned",
    resourceType: "payout_request",
    resourceId: requestId,
    reason: reason.trim(),
  });
  revalidatePath("/admin/payouts");
  return { ok: true };
}
