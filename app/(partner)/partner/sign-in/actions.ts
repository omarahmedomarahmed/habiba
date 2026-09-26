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

export type ResetState = { error?: string; sent?: boolean };

/**
 * 🔴 W2-X06: ASK FOR A RESET LINK. Limited on the way in, like sign-in, and the
 * answer is the same whether or not the address has an account.
 */
export async function requestReset(_prev: ResetState, formData: FormData): Promise<ResetState> {
  const throttle = await consume(await callerKey("partner-reset"), 5, 15 * 60);
  if (!throttle.allowed) return { error: "Too many attempts. Try again in a few minutes." };

  const { requestPartnerReset } = await import("@/lib/partner/team");
  await requestPartnerReset(String(formData.get("email") ?? ""));
  return { sent: true };
}

/** 🔴 W2-X06: CHOOSE A PASSWORD from a signed link: a reset, or a colleague's first. */
export async function choosePassword(_prev: ResetState, formData: FormData): Promise<ResetState> {
  const throttle = await consume(await callerKey("partner-reset"), 5, 15 * 60);
  if (!throttle.allowed) return { error: "Too many attempts. Try again in a few minutes." };

  const { setPartnerPassword } = await import("@/lib/partner/team");
  const result = await setPartnerPassword(
    String(formData.get("token") ?? ""),
    String(formData.get("password") ?? ""),
  );
  if (result.error) return { error: result.error };
  /* 🔴 Board 641: the door says the password is set, as `/welcome`'s landing does. */
  redirect("/partner/sign-in?set=1");
}

export async function signOutPartner(): Promise<void> {
  await revokePartnerSession();
  redirect("/partner/sign-in");
}
