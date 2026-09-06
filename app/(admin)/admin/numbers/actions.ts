"use server";

import { revalidatePath } from "next/cache";

import { requireStaff } from "@/lib/auth/guard";
import { approveChange, refuseChange, sendChangeCode } from "@/lib/data/phone-change";

export type NumberState = { error?: string; ok?: boolean; note?: string };

/**
 * The number-change queue's three buttons. PLAN.md 20.16.
 *
 * 🔴 None of them changes an account. Approval unlocks sending a code;
 * sending the code puts it on the **new** handset; and the account moves only
 * when somebody enters that code in the app. A staff member cannot complete a
 * change from this screen, by design — the code is hashed, so reading the
 * table does not help either.
 */

export async function approve(_prev: NumberState, formData: FormData): Promise<NumberState> {
  const actor = await requireStaff();
  const result = await approveChange({
    requestId: String(formData.get("requestId") ?? ""),
    actor,
    note: String(formData.get("note") ?? ""),
  });
  if (result.error) return { error: result.error };
  revalidatePath("/admin/numbers");
  return { ok: true, note: "Approved. Send the code when you are ready." };
}

export async function sendCode(_prev: NumberState, formData: FormData): Promise<NumberState> {
  const actor = await requireStaff();
  const result = await sendChangeCode({
    requestId: String(formData.get("requestId") ?? ""),
    actorUserId: actor.userId,
  });
  if (result.error) return { error: result.error };
  revalidatePath("/admin/numbers");
  return { ok: true, note: "Code sent to the new number. It lasts 24 hours." };
}

export async function refuse(_prev: NumberState, formData: FormData): Promise<NumberState> {
  const actor = await requireStaff();
  const result = await refuseChange({
    requestId: String(formData.get("requestId") ?? ""),
    actorUserId: actor.userId,
    reason: String(formData.get("reason") ?? ""),
  });
  if (result.error) return { error: result.error };
  revalidatePath("/admin/numbers");
  return { ok: true };
}
