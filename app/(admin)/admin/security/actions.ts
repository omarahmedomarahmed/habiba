"use server";

import { revalidatePath } from "next/cache";

import { requireRole, requireStaff } from "@/lib/auth/guard";
import { beginEnrolment, confirmEnrolment, resetAccountFactor } from "@/lib/auth/second-factor";
import { isFactorResetTarget } from "@/lib/auth/factor-reset";
import { getSessionState } from "@/lib/auth/session";
import { getI18n } from "@/lib/i18n/server";

export type EnrolState = { error?: string; recoveryCodes?: string[] };

/**
 * 🔴 Task 40: a member enrols their OWN authenticator, from inside the
 * console, so the enrolment itself is behind the second step it replaces (by
 * email, until this succeeds). Nobody enrols anybody else, and nothing here
 * takes a user id from the form.
 */

export async function startEnrolment(_prev: EnrolState, _formData: FormData): Promise<EnrolState> {
  const actor = await requireStaff();
  const session = await getSessionState();
  if (!session) return { error: (await getI18n()).t("asec.startAgain") };
  const result = await beginEnrolment(actor, session.sessionId);
  if (!result.ok) return { error: (await getI18n()).t(result.error) };
  revalidatePath("/admin/security");
  return {};
}

export async function finishEnrolment(_prev: EnrolState, formData: FormData): Promise<EnrolState> {
  const actor = await requireStaff();
  const session = await getSessionState();
  if (!session) return { error: (await getI18n()).t("asec.startAgain") };

  const result = await confirmEnrolment(actor, session.sessionId, String(formData.get("code") ?? ""));
  if (!result.ok) return { error: (await getI18n()).t(result.error) };
  /*
   * 🔴 The codes go back in the action's answer and nowhere else. They are
   * not revalidated into the page, not logged, and not stored except as
   * hashes, so a reload shows the enrolled state and never the codes again.
   */
  return { recoveryCodes: result.recoveryCodes };
}

export type AccountResetState = { error?: string; done?: boolean };

/**
 * Review fix: an owner or a manager resets a clinician's, clinic manager's or
 * partner user's authenticator app, named by email. Audited, found or not.
 */
export async function resetAccountAuthenticator(
  _prev: AccountResetState,
  formData: FormData,
): Promise<AccountResetState> {
  const actor = await requireRole("super_admin", "manager");
  const target = formData.get("target");
  const { t } = await getI18n();
  if (!isFactorResetTarget(target)) return { error: t("asec.resetNotFound") };
  const result = await resetAccountFactor(actor, target, String(formData.get("email") ?? "").slice(0, 200));
  if (!result.ok) return { error: t(result.error) };
  return { done: true };
}
