"use server";

import { applyToSponsor } from "@/lib/data/sponsor-admin";
import { callerKey, consume } from "@/lib/rate-limit";
import type { SponsorKind } from "@/lib/db/schema";

export type ApplyState = { error?: string; sent?: boolean };

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

  const result = await applyToSponsor({
    name: String(formData.get("name") ?? ""),
    kind: kind as SponsorKind,
    contactName: String(formData.get("contactName") ?? ""),
    contactEmail: String(formData.get("contactEmail") ?? ""),
    contactPhone: String(formData.get("contactPhone") ?? ""),
    contactBestTime: String(formData.get("contactBestTime") ?? ""),
  });

  if (result.error) return { error: result.error };
  return { sent: true };
}
