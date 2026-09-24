"use server";

import { applyToSponsor } from "@/lib/data/sponsor-admin";
import { getI18n } from "@/lib/i18n/server";
import { callerKey, consume } from "@/lib/rate-limit";
import type { SponsorKind } from "@/lib/db/schema";

export type ApplyState = { error?: string; sent?: boolean; email?: string };

/**
 * 53.5 — the corporate enquiry, and the only thing on `/sponsor` a stranger
 * reaches.
 *
 * 🔴 It creates a HELD account and nothing else: no password, no pot, no code, no
 * portal. So the worst an abusive submission can do is put a row in a list an
 * operator reads, which is why this is rate limited but not gated.
 */
export async function apply(_prev: ApplyState, formData: FormData): Promise<ApplyState> {
  const throttle = await consume(await callerKey("sponsor-apply"), 5, 60 * 60);
  if (!throttle.allowed) return { error: "Too many attempts. Try again later." };

  const kind = String(formData.get("kind") ?? "company");
  if (kind !== "company" && kind !== "university") {
    return { error: "Tell us whether you are a company or a university." };
  }

  const { t } = await getI18n();
  const organisation = String(formData.get("name") ?? "").trim().slice(0, 200);
  const contact = String(formData.get("contactName") ?? "").trim().slice(0, 120);

  const result = await applyToSponsor({
    name: String(formData.get("name") ?? ""),
    kind: kind as SponsorKind,
    contactName: String(formData.get("contactName") ?? ""),
    contactEmail: String(formData.get("contactEmail") ?? ""),
    contactPhone: String(formData.get("contactPhone") ?? ""),
    contactBestTime: String(formData.get("contactBestTime") ?? ""),
    /* W2-S09 — the entity follows the country, and the applicant hears from us. */
    country: String(formData.get("country") ?? ""),
    acknowledgement: {
      subject: t("sponsor.apply.mailSubject"),
      body: t("sponsor.apply.mailBody", { contact, name: organisation }),
    },
  });

  if (result.error) return { error: result.error };
  return { sent: true, email: String(formData.get("contactEmail") ?? "").trim() };
}
