"use server";

import { redirect } from "next/navigation";

import { checkClinicPassword } from "@/lib/data/clinic-admin";
import { createClinicSession, revokeClinicSession } from "@/lib/clinic-auth/session";
import { callerKey, consume } from "@/lib/rate-limit";

export type ClinicSignInState = { error?: string };

/**
 * The clinic's door. PLAN.md 54.2, C259, C264.
 *
 * 🔴 Rate limited on the way IN rather than on a failure, the same as the sponsor's: a
 * limiter that only counts wrong passwords lets somebody try one password against a
 * thousand addresses, and against this portal that is a list of which practices use us.
 */
export async function signInClinic(
  _prev: ClinicSignInState,
  formData: FormData,
): Promise<ClinicSignInState> {
  const throttle = await consume(await callerKey("clinic-sign-in"), 8, 15 * 60);
  if (!throttle.allowed) return { error: "Too many attempts. Try again in a few minutes." };

  const result = await checkClinicPassword(
    String(formData.get("email") ?? ""),
    String(formData.get("password") ?? ""),
  );

  if (result.error || !result.clinicManagerId) {
    return { error: result.error ?? "That email address and password do not match." };
  }

  await createClinicSession(result.clinicManagerId);
  redirect("/clinic");
}

export async function signOutClinic(): Promise<void> {
  await revokeClinicSession();
  redirect("/clinic/sign-in");
}
