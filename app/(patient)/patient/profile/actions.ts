"use server";

import { revalidatePath } from "next/cache";

import { raiseFlag } from "@/lib/data/documents";
import { requirePatient } from "@/lib/patient-auth/guard";
import type { FlagReason } from "@/lib/db/schema";

export type ProfileState = { error?: string; ok?: boolean };

/*
 * 🔴 26.5 — `addOwnFile` and `addOwnNote` were here, and they are gone.
 *
 * They let a patient upload files and dictate clinical history onto their own
 * record. Deleted rather than hidden behind a flag, because a server action
 * that no component renders is still a function somebody re-wires next sprint,
 * and the point of 26.5 is not that the button is invisible. It is that we
 * stopped asking a person in therapy to be their own medical records clerk.
 *
 * What replaced them is `writeJournal` (`lib/data/journals.ts`), which asks a
 * different question: not "give us your history" but "how was your week".
 * A clinician adding a document to somebody's record is unchanged.
 */

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
