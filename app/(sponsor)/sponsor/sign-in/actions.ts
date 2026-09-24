"use server";

import { redirect } from "next/navigation";

import { checkSponsorPassword } from "@/lib/data/sponsor-admin";
import { requestSponsorReset, setSponsorPassword } from "@/lib/data/sponsor-users";
import { getI18n } from "@/lib/i18n/server";
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

/**
 * 🔴 W2-S05 — forgot password. A company user who forgot theirs had no way back
 * in but a call to us. Rate limited like sign-in, and the answer is the same
 * whether or not the address has a login.
 */
export async function askForReset(
  _prev: { sent?: boolean; error?: string },
  formData: FormData,
): Promise<{ sent?: boolean; error?: string }> {
  const throttle = await consume(await callerKey("sponsor-reset"), 5, 60 * 60);
  if (!throttle.allowed) return { error: "Too many attempts. Try again later." };

  const { t } = await getI18n();
  await requestSponsorReset(String(formData.get("email") ?? ""), {
    subject: t("sponsor.forgotTitle"),
    body: t("sponsor.resetMailBody"),
  });
  return { sent: true };
}

/** W2-S05 — a password from a reset or invite link, then the sign-in page. */
export async function setPasswordFromLink(
  _prev: { error?: string },
  formData: FormData,
): Promise<{ error?: string }> {
  const throttle = await consume(await callerKey("sponsor-set-password"), 10, 15 * 60);
  if (!throttle.allowed) return { error: "Too many attempts. Try again in a few minutes." };

  const result = await setSponsorPassword(
    String(formData.get("token") ?? ""),
    String(formData.get("password") ?? ""),
  );
  if (result.error) return { error: result.error };
  redirect("/sponsor/sign-in?set=1");
}

export async function signOutSponsor(): Promise<void> {
  await revokeSponsorSession();
  redirect("/sponsor/sign-in");
}
