"use server";

import { revalidatePath } from "next/cache";

import type { AuthenticatorState } from "@/components/auth/authenticator-card";
import { audit } from "@/lib/audit";
import { confirmPortalFactor, removePortalFactor, startPortalFactor } from "@/lib/auth/portal-second-step";
import { requireClinic } from "@/lib/clinic-auth/guard";
import { getI18n } from "@/lib/i18n/server";

/** DD-2 B2.4: a clinic manager's own authenticator app, optional. The cookie says whose. */

export async function startClinicAuthenticator(_prev: AuthenticatorState, formData: FormData): Promise<AuthenticatorState> {
  const actor = await requireClinic();
  /* Review fix: the password again, so a borrowed session cannot plant an app. */
  const { passwordConfirmed } = await import("@/lib/auth/enrolment-proof");
  if (!(await passwordConfirmed({ kind: "clinic", id: actor.clinicManagerId }, String(formData.get("password") ?? "")))) {
    return { error: (await getI18n()).t("asec.passwordWrong") };
  }
  const result = await startPortalFactor("clinic", actor.clinicManagerId);
  if (!result.ok) return { error: (await getI18n()).t(result.error) };
  revalidatePath("/clinic");
  return {};
}

export async function finishClinicAuthenticator(_prev: AuthenticatorState, formData: FormData): Promise<AuthenticatorState> {
  const actor = await requireClinic();
  const result = await confirmPortalFactor("clinic", actor.clinicManagerId, String(formData.get("code") ?? ""));
  if (!result.ok) return { error: (await getI18n()).t(result.error) };
  await audit({
    actor: null,
    clinicManagerId: actor.clinicManagerId,
    category: "auth",
    action: "second_factor.enrolled",
    resourceType: "clinic_manager",
    resourceId: actor.clinicManagerId,
    reason: "authenticator app, 10 recovery codes",
  });
  /* Shown once, in the answer only. */
  return { recoveryCodes: result.recoveryCodes };
}

export async function removeClinicAuthenticator(_prev: AuthenticatorState, formData: FormData): Promise<AuthenticatorState> {
  const actor = await requireClinic();
  const result = await removePortalFactor("clinic", actor.clinicManagerId, String(formData.get("code") ?? "").trim().slice(0, 40));
  if (!result.ok) return { error: (await getI18n()).t(result.error) };
  await audit({
    actor: null,
    clinicManagerId: actor.clinicManagerId,
    category: "auth",
    action: "second_factor.removed",
    resourceType: "clinic_manager",
    resourceId: actor.clinicManagerId,
    reason: result.method,
  });
  revalidatePath("/clinic");
  return { removed: true };
}
