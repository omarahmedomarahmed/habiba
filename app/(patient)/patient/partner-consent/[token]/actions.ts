"use server";

import { redirect } from "next/navigation";

import { answerAsPatient } from "@/lib/partner/patient-consent";
import { requirePatient } from "@/lib/patient-auth/guard";

/**
 * 🔴 F6: the patient's own answer about a session on a partner's platform. The
 * person id is from their session; the token names only the session asked about.
 */
export async function answerPartnerConsent(token: string, state: "given" | "withdrawn"): Promise<void> {
  const actor = await requirePatient();
  const result = await answerAsPatient({
    token,
    personId: actor.personId,
    accountId: actor.accountId,
    state: state === "given" ? "given" : "withdrawn",
  });
  const outcome = "error" in result ? "dead" : state === "given" ? "yes" : "no";
  redirect(`/patient/partner-consent/${encodeURIComponent(token)}?done=${outcome}`);
}
