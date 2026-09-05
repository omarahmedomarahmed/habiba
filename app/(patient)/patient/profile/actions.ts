"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";

import {
  addTextDocument,
  addUploadedDocument,
  extractPending,
  raiseFlag,
} from "@/lib/data/documents";
import { requirePatient } from "@/lib/patient-auth/guard";
import type { FlagReason } from "@/lib/db/schema";

export type ProfileState = { error?: string; ok?: boolean };

/**
 * The person adding to their own record. PLAN.md 8.1 / 13.x.
 *
 * No consent check, because there is nobody to ask: this is their record. The
 * person id comes from the signed-in actor and never from the request, so
 * there is no id to tamper with.
 */
export async function addOwnFile(formData: FormData): Promise<ProfileState> {
  const actor = await requirePatient();

  const file = formData.get("file");
  if (!(file instanceof File)) return { error: "Choose a file." };

  const result = await addUploadedDocument({
    personId: actor.personId,
    title: String(formData.get("title") ?? "").trim() || file.name,
    file,
    byAccountId: actor.accountId,
  });

  if (!result.ok) return { error: result.error };

  // Bounded nudge; the cron is the guarantee. See the clinician-side action.
  after(async () => {
    await extractPending(1);
  });

  revalidatePath("/patient/profile");
  return { ok: true };
}

export async function addOwnNote(input: {
  title: string;
  body: string;
  dictated?: boolean;
}): Promise<ProfileState> {
  const actor = await requirePatient();

  const result = await addTextDocument({
    personId: actor.personId,
    source: input.dictated ? "dictated" : "typed",
    title: input.title,
    body: input.body,
    byAccountId: actor.accountId,
  });

  if (!result.ok) return { error: result.error };

  revalidatePath("/patient/profile");
  return { ok: true };
}

/**
 * 8.8 — the person saying "that is outdated" about their own record.
 *
 * The flag never edits or deletes. That is stated on the screen, because
 * "flag as wrong" reads like "remove" to somebody who has just found something
 * upsetting written about them — and a clinical record has to stay as it was
 * written, whatever anybody thinks of it.
 */
export async function flagOwnContent(input: {
  targetType: "document" | "chunk" | "diagnosis";
  targetId: string;
  reason: FlagReason;
  note?: string;
}): Promise<ProfileState> {
  const actor = await requirePatient();

  const result = await raiseFlag({
    personId: actor.personId,
    targetType: input.targetType,
    targetId: input.targetId,
    reason: input.reason,
    note: input.note ?? null,
    byAccountId: actor.accountId,
  });

  if (!result.ok) return { error: result.error };

  revalidatePath("/patient/profile");
  return { ok: true };
}
