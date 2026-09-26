"use server";

import { redirect } from "next/navigation";

import { requirePatient } from "@/lib/patient-auth/guard";
import { confirmSubjectLink } from "@/lib/partner/subject-link";

/**
 * 🔴 Board 932: the patient links a platform's reference to their own record.
 * The person id is from their session; the token only names the subject.
 */
export async function confirmLink(token: string): Promise<{ error?: "invalid" | "taken" }> {
  const actor = await requirePatient();
  const result = await confirmSubjectLink({ token, personId: actor.personId, accountId: actor.accountId });
  if ("error" in result) return { error: result.error };
  redirect("/patient/consent");
}
