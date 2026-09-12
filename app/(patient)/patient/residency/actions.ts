"use server";

import { revalidatePath } from "next/cache";

import { recordCrossBorderConsent, withdrawCrossBorderConsent } from "@/lib/data/residency";
import { getLocale } from "@/lib/i18n/server";
import { requirePatient } from "@/lib/patient-auth/guard";

export type ResidencyActionState = { error?: string; ok?: boolean };

/**
 * The patient agrees to their record being held outside their country.
 *
 * PLAN.md 30.3. The locale is read here and stored on the row, because the
 * record of processing has to say which language somebody read the wording in:
 * "they agreed" is not a defence if the sentences were in a language they do
 * not speak.
 */
export async function agreeToCrossBorder(): Promise<ResidencyActionState> {
  const actor = await requirePatient();
  const { locale } = await getLocale().then((l) => ({ locale: l })).catch(() => ({ locale: "en" }));

  const result = await recordCrossBorderConsent({ personId: actor.personId, locale });
  if (!result.ok) return { error: result.error };

  revalidatePath("/patient/residency");
  return { ok: true };
}

/** Withdrawing. The row stays; a record of processing is a record. */
export async function withdrawCrossBorder(): Promise<ResidencyActionState> {
  const actor = await requirePatient();
  await withdrawCrossBorderConsent(actor.personId);

  revalidatePath("/patient/residency");
  return { ok: true };
}
