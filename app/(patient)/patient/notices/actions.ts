"use server";

import { revalidatePath } from "next/cache";

import { dismissNotice } from "@/lib/data/notices";
import { requirePatient } from "@/lib/patient-auth/guard";

/**
 * 🔴 Hiding a notice, and that is the whole of what this can do. 53.20, C231.
 *
 * The person id comes from the session, so the only thing the client supplies
 * is which of their own rows to stamp — and `dismissNotice` scopes on the person
 * inside the WHERE rather than trusting this function to have checked.
 *
 * There is no delete action here. A patient notice log with a delete button is a
 * log that cannot answer "when did my benefit end", which is the question it
 * exists to answer.
 */
export async function dismiss(noticeId: string): Promise<{ ok: boolean }> {
  const actor = await requirePatient();

  await dismissNotice(actor.personId, noticeId);

  revalidatePath("/patient/notices");
  revalidatePath("/patient");
  return { ok: true };
}
