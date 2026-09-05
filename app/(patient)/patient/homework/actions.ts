"use server";

import { revalidatePath } from "next/cache";

import { closeStep } from "@/lib/data/homework";
import { requirePatient } from "@/lib/patient-auth/guard";

export type StepState = { error?: string; ok?: boolean };

/**
 * The person answers a step. PLAN.md 9.5.
 *
 * 🔴 There is no clinician-facing counterpart to this, anywhere. A therapist
 * marking somebody's homework done is a therapist recording something they do
 * not know.
 *
 * `skipped` is offered with the same weight as `done`. A person who did not do
 * a thing has told us something clinically useful, and an interface that only
 * accepts "done" turns every unfinished week into silence.
 */
export async function answerStep(
  itemId: string,
  outcome: "done" | "skipped",
  note?: string,
): Promise<StepState> {
  const actor = await requirePatient();

  const result = await closeStep({
    itemId,
    personId: actor.personId,
    accountId: actor.accountId,
    outcome,
    note: note ?? null,
  });

  if (!result.ok) return { error: result.error };

  revalidatePath("/patient/homework");
  revalidatePath("/patient");
  return { ok: true };
}
