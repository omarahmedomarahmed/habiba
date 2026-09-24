"use server";

import { audit } from "@/lib/audit";
import { requestClinicReset } from "@/lib/clinic-auth/tokens";
import { callerKey, consume } from "@/lib/rate-limit";

export type ClinicForgotState = { sent?: boolean; error?: string };

/**
 * 🔴 W2-C05: a clinic manager or staff member who forgot their password.
 * There was no reset for this principal anywhere in the product.
 *
 * Always "sent", whatever the address: a reply that differs for an unknown
 * one lists which practices use us. Rate limited on the way in, like the
 * sign-in beside it.
 */
export async function requestReset(
  _prev: ClinicForgotState,
  formData: FormData,
): Promise<ClinicForgotState> {
  const throttle = await consume(await callerKey("clinic-reset"), 5, 15 * 60);
  if (!throttle.allowed) {
    const { getI18n } = await import("@/lib/i18n/server");
    const { t } = await getI18n();
    return { error: t("common.somethingWrong") };
  }

  const clinicManagerId = await requestClinicReset(String(formData.get("email") ?? ""));
  if (clinicManagerId) {
    await audit({
      actor: null,
      clinicManagerId,
      category: "auth",
      action: "clinic.password.reset_requested",
      resourceType: "clinic_manager",
      resourceId: clinicManagerId,
    });
  }

  return { sent: true };
}
