"use server";

import { applyToClinic } from "@/lib/data/clinic-admin";
import { callerKey, consume } from "@/lib/rate-limit";

export type ClinicApplyState = { error?: string; sent?: boolean };

/**
 * 54.3 — the practice enquiry, and the only thing on `/clinic` a stranger reaches
 * besides an invitation link.
 *
 * 🔴 It creates a HELD `organizations` row and nothing else: no manager, no password,
 * no clinician, no portal. So the worst an abusive submission does is put a row in a
 * list an operator reads, which is why this is rate limited but not gated.
 */
export async function apply(
  _prev: ClinicApplyState,
  formData: FormData,
): Promise<ClinicApplyState> {
  const throttle = await consume(await callerKey("clinic-apply"), 5, 60 * 60);
  if (!throttle.allowed) return { error: "Too many attempts. Try again later." };

  const result = await applyToClinic({
    name: String(formData.get("name") ?? ""),
    contactName: String(formData.get("contactName") ?? ""),
    contactEmail: String(formData.get("contactEmail") ?? ""),
    contactPhone: String(formData.get("contactPhone") ?? ""),
  });

  if (result.error) return { error: result.error };
  return { sent: true };
}
