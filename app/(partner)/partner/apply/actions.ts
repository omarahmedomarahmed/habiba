"use server";

import { applyToPartner } from "@/lib/data/partner-admin";
import { callerKey, consume } from "@/lib/rate-limit";

export type PartnerApplyState = { error?: string; sent?: boolean };

/**
 * 55.2 — the integrator enquiry, and the only thing on `/partner` a stranger reaches.
 *
 * 🔴 It creates a HELD `partners` row and nothing else: no user, no password, no key, no
 * portal. So the worst an abusive submission does is put a row in a list an operator
 * reads, which is why this is rate limited but not gated.
 */
export async function apply(
  _prev: PartnerApplyState,
  formData: FormData,
): Promise<PartnerApplyState> {
  const throttle = await consume(await callerKey("partner-apply"), 5, 60 * 60);
  if (!throttle.allowed) return { error: "Too many attempts. Try again later." };

  const result = await applyToPartner({
    name: String(formData.get("name") ?? ""),
    contactName: String(formData.get("contactName") ?? ""),
    contactEmail: String(formData.get("contactEmail") ?? ""),
    contactPhone: String(formData.get("contactPhone") ?? ""),
    intent: String(formData.get("intent") ?? ""),
  });

  if (result.error) return { error: result.error };
  return { sent: true };
}
