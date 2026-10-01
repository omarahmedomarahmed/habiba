"use server";

import { revalidatePath } from "next/cache";

import type { AuthenticatorState } from "@/components/auth/authenticator-card";
import { requireUser } from "@/lib/auth/guard";
import { beginEnrolment, confirmEnrolment, removeOwnFactor } from "@/lib/auth/second-factor";
import { getSessionState } from "@/lib/auth/session";
import { getI18n } from "@/lib/i18n/server";

/**
 * DD-2 B2.4: a clinician's own authenticator app, optional. Nothing here takes
 * a user id from the form: the cookie says whose it is.
 */

export async function startAuthenticator(_prev: AuthenticatorState, _formData: FormData): Promise<AuthenticatorState> {
  const actor = await requireUser();
  const result = await beginEnrolment(actor);
  if (!result.ok) return { error: (await getI18n()).t(result.error) };
  revalidatePath("/settings");
  return {};
}

export async function finishAuthenticator(_prev: AuthenticatorState, formData: FormData): Promise<AuthenticatorState> {
  const actor = await requireUser();
  const session = await getSessionState();
  if (!session) return { error: (await getI18n()).t("asec.startAgain") };
  const result = await confirmEnrolment(actor, session.sessionId, String(formData.get("code") ?? ""));
  if (!result.ok) return { error: (await getI18n()).t(result.error) };
  /* Shown once, in the answer only; a reload shows the enrolled state. */
  return { recoveryCodes: result.recoveryCodes };
}

export async function removeAuthenticator(_prev: AuthenticatorState, formData: FormData): Promise<AuthenticatorState> {
  const actor = await requireUser();
  const result = await removeOwnFactor(actor, String(formData.get("code") ?? "").trim().slice(0, 40));
  if (!result.ok) return { error: (await getI18n()).t(result.error) };
  revalidatePath("/settings");
  return { removed: true };
}
