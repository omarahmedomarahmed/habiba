"use server";

import { redirect } from "next/navigation";

import { checkPartnerPassword } from "@/lib/data/partner-admin";
import { createPartnerSession, revokePartnerSession } from "@/lib/partner-auth/session";
import { callerKey, consume } from "@/lib/rate-limit";

export type PartnerSignInState = { error?: string };

/**
 * The partner's door. PLAN.md 55.2, C264.
 *
 * 🔴 Rate limited on the way IN rather than on a failure, the same as the sponsor's and
 * the clinic's: a limiter that only counts wrong passwords lets somebody try one password
 * against a thousand addresses, and against this portal that is a list of which companies
 * are integrating with us.
 */
export async function signInPartner(
  _prev: PartnerSignInState,
  formData: FormData,
): Promise<PartnerSignInState> {
  const throttle = await consume(await callerKey("partner-sign-in"), 8, 15 * 60);
  if (!throttle.allowed) return { error: "Too many attempts. Try again in a few minutes." };

  const result = await checkPartnerPassword(
    String(formData.get("email") ?? ""),
    String(formData.get("password") ?? ""),
  );

  if (result.error || !result.partnerUserId) {
    return { error: result.error ?? "That email address and password do not match." };
  }

  await createPartnerSession(result.partnerUserId);
  redirect("/partner");
}

export async function signOutPartner(): Promise<void> {
  await revokePartnerSession();
  redirect("/partner/sign-in");
}
