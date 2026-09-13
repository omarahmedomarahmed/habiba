"use server";

import { acceptInvitation } from "@/lib/data/clinic-admin";
import { callerKey, consume } from "@/lib/rate-limit";

export type JoinState = { error?: string; ok?: boolean };

/**
 * 54.5 / 54.6 — the invited clinician accepts. PLAN.md C261, C267.
 *
 * 🔴 THIS CREATES AN `unverified` CLINICIAN AND NOTHING MORE.
 *
 * They then walk the same verification flow as anybody who signed up alone, because the
 * clinic's word is not evidence (C267). `acceptInvitation` passes `unverified`
 * explicitly even though it is the column default, so a reader does not have to open the
 * schema to learn whether a hospital's invitation confers a licence.
 *
 * 🔴 And the database refuses an acceptance on a row whose `terms_shown_at` is null, so
 * C261's sentence having been served is a constraint rather than a paragraph somebody
 * remembered to render.
 */
export async function accept(_prev: JoinState, formData: FormData): Promise<JoinState> {
  const throttle = await consume(await callerKey("clinic-join"), 10, 15 * 60);
  if (!throttle.allowed) return { error: "Too many attempts. Wait a few minutes." };

  const result = await acceptInvitation({
    token: String(formData.get("token") ?? ""),
    password: String(formData.get("password") ?? ""),
    firstName: String(formData.get("firstName") ?? ""),
    lastName: String(formData.get("lastName") ?? ""),
  });

  if (result.error) return { error: result.error };
  return { ok: true };
}
