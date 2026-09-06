"use server";

import { revalidatePath } from "next/cache";

import { requestPhoneChange } from "@/lib/data/phone-change";
import { requirePatient } from "@/lib/patient-auth/guard";

export type AccountState = { error?: string; ok?: boolean };

/**
 * Ask to change the number. PLAN.md 20.13.
 *
 * Not a settings field — a request, in their own words, with their permission
 * to be called on the new number. §3b makes the phone the identity, and an
 * identity that can be edited from a form is not one.
 */
export async function askToChangeNumber(
  _prev: AccountState,
  formData: FormData,
): Promise<AccountState> {
  const actor = await requirePatient();

  const result = await requestPhoneChange({
    accountId: actor.accountId,
    newPhone: String(formData.get("newPhone") ?? ""),
    country: String(formData.get("country") ?? "") || null,
    reason: String(formData.get("reason") ?? ""),
    contactConsent: formData.get("consent") === "on",
  });

  if (result.error) return { error: result.error };

  revalidatePath("/patient/account");
  return { ok: true };
}
