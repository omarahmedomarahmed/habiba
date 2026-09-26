"use server";

import { redirect } from "next/navigation";

import { audit } from "@/lib/audit";
import { setClinicPasswordByToken } from "@/lib/clinic-auth/tokens";
import { callerKey, consume } from "@/lib/rate-limit";
import { CLINIC_SIGN_IN } from "@/lib/routing";

export type ClinicSetPasswordState = { error?: string };

/**
 * 🔴 W2-C04 / W2-C05: choose a password from a link, an invitation or a reset.
 *
 * The person choosing it is the person who will type it. On success every
 * session they held has ended (`setClinicPasswordByToken`), and they sign in
 * at the door like anybody else.
 */
export async function setPassword(
  _prev: ClinicSetPasswordState,
  formData: FormData,
): Promise<ClinicSetPasswordState> {
  const { getI18n } = await import("@/lib/i18n/server");
  const { t } = await getI18n();

  const throttle = await consume(await callerKey("clinic-set-password"), 10, 15 * 60);
  if (!throttle.allowed) return { error: t("common.somethingWrong") };

  const result = await setClinicPasswordByToken(
    String(formData.get("token") ?? ""),
    String(formData.get("password") ?? ""),
  );

  if (result.error === "password") return { error: result.problem ?? t("tauth.passwordHint") };
  if (result.error || !result.clinicManagerId) return { error: t("clinic.linkInvalid") };

  await audit({
    actor: null,
    clinicManagerId: result.clinicManagerId,
    category: "auth",
    action: "clinic.password.set",
    resourceType: "clinic_manager",
    resourceId: result.clinicManagerId,
    reason: "chosen by the manager from a single-use link; every session ended",
  });

  /* 🔴 Board ORG CL8.3: the door says the password is set, as `/welcome`'s landing does. */
  redirect(`${CLINIC_SIGN_IN}?set=1`);
}
