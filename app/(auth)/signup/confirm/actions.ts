"use server";

import { redirect } from "next/navigation";

import { consumeSignupLink } from "@/lib/auth/signup-link";

/**
 * F14, review fix: THE WELCOME LINK IS SPENT BY A PRESS, NEVER BY OPENING IT.
 *
 * Mail scanners (Outlook Safe Links and the like) fetch every link in an email
 * before the person sees it. When a plain GET spent this single-use token, the
 * scanner signed in (into nowhere) and the clinician's own click met "link
 * used". So `/signup/confirm` now only shows a "Continue" button, and the token
 * is spent here, by the form that button submits, which scanners do not do.
 *
 * It stays single use (one conditional UPDATE in `consumeSignupLink`) and
 * short lived (its expiry is unchanged). A used, expired or foreign token goes
 * to sign in with one sentence, and nothing about which of the three it was.
 */
export async function continueSignup(formData: FormData): Promise<void> {
  const token = String(formData.get("token") ?? "");
  const userId = await consumeSignupLink(token);
  redirect(userId ? "/onboarding?welcome=1" : "/login?link=1");
}
