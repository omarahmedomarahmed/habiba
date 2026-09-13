"use server";

import { redirect } from "next/navigation";

import { checkSponsorPassword } from "@/lib/data/sponsor-admin";
import { callerKey, consume } from "@/lib/rate-limit";
import { createSponsorSession, revokeSponsorSession } from "@/lib/sponsor-auth/session";

export type SponsorSignInState = { error?: string };

/**
 * The sponsor's door. PLAN.md 53.4, C230.
 *
 * 🔴 Rate limited per caller, and the limit is on the WAY IN rather than on a
 * failure. A limiter that only counts wrong passwords lets somebody try one
 * password against a thousand addresses, which against a corporate portal is a
 * list of organisations that buy therapy for their staff.
 */
const ATTEMPTS = 8;
const WINDOW_SECONDS = 15 * 60;

export async function signInSponsor(
  _prev: SponsorSignInState,
  formData: FormData,
): Promise<SponsorSignInState> {
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");

  const throttle = await consume(await callerKey("sponsor-sign-in"), ATTEMPTS, WINDOW_SECONDS);
  if (!throttle.allowed) return { error: "Too many attempts. Try again in a few minutes." };

  const result = await checkSponsorPassword(email, password);
  if (result.error || !result.sponsorUserId) {
    return { error: result.error ?? "That email address and password do not match." };
  }

  await createSponsorSession(result.sponsorUserId);
  redirect("/sponsor");
}

export async function signOutSponsor(): Promise<void> {
  await revokeSponsorSession();
  redirect("/sponsor/sign-in");
}
