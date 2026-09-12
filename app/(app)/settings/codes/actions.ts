"use server";

import { revalidatePath } from "next/cache";

import { requireUser } from "@/lib/auth/guard";
import { createCode, revokeCode } from "@/lib/data/therapist-codes";

export type CodeState = { error?: string; ok?: boolean };

/** 25.17 — mint a poster. */
export async function newWallCode(_prev: CodeState, formData: FormData): Promise<CodeState> {
  const actor = await requireUser();

  const result = await createCode(actor, String(formData.get("label") ?? ""));
  if (result.error) return { error: result.error };

  revalidatePath("/settings/codes");
  return { ok: true };
}

/**
 * 🔴 25.17 — kill a poster.
 *
 * No confirmation step on the server side, deliberately: revoking is the safe
 * direction. The dangerous action here is leaving a stale code alive, and a
 * clinician who revokes one by accident can print another in five seconds.
 */
export async function killWallCode(formData: FormData): Promise<void> {
  const actor = await requireUser();

  await revokeCode(actor, String(formData.get("id") ?? ""));

  revalidatePath("/settings/codes");
}
