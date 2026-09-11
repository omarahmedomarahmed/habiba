"use server";

import { revalidatePath } from "next/cache";

import { writeJournal } from "@/lib/data/journals";
import { requirePatient } from "@/lib/patient-auth/guard";

export type JournalState = { error?: string; ok?: boolean };

/**
 * Write a journal. PLAN.md 26.5, 26.8, C123, C124.
 *
 * ## 🔴 What this action deliberately does not return
 *
 * Anything about the risk scan. `writeJournal` scans the text and may alert a
 * clinician holding a grant, and the only thing that comes back here is
 * whether the entry saved. There is no field a screen could render as "we
 * noticed something", no "your therapist has been told", no reassuring shield.
 *
 * That is C123's ruling and it is not squeamishness. A person who believes
 * somebody is reading at 3am, and is wrong, is worse off than a person who
 * knows they are alone with a phone number on the screen. We cannot staff a
 * watch, so we do not imply one. The crisis line is on every screen because
 * that part we can actually keep.
 *
 * The person id comes from the signed-in actor and never from the request, so
 * there is no id to tamper with.
 */
export async function addJournal(
  _prev: JournalState,
  formData: FormData,
): Promise<JournalState> {
  const actor = await requirePatient();

  const result = await writeJournal({
    personId: actor.personId,
    accountId: actor.accountId,
    body: String(formData.get("body") ?? ""),
    source: formData.get("dictated") === "1" ? "dictated" : "typed",
  });

  if (!result.ok) return { error: result.error };

  revalidatePath("/patient/journal");
  return { ok: true };
}
