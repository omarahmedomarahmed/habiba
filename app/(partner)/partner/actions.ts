"use server";

import { revalidatePath } from "next/cache";

import { requirePartnerAdmin } from "@/lib/partner-auth/guard";
import { mintKey, revokeKey } from "@/lib/partner/keys";
import type { ApiEnvironment } from "@/lib/db/schema";

export type KeyState = { error?: string; raw?: string; prefix?: string };

/**
 * 55.2 / 55.3 / C265 — mint a key from the portal, and NOWHERE ELSE.
 *
 * 🔴 `requirePartnerAdmin`, which returns a `PartnerActor`, which no clinician session can
 * produce. That is the whole of how 55.3 holds: a therapist never sees an API key because
 * every path to one starts with a function that hands back a type a therapist's cookie
 * cannot mint.
 *
 * 🔴 AND THE PARTNER ID COMES FROM THE ACTOR, NEVER THE FORM.
 *
 * A `partnerId` field in this form would be a key minted against somebody else's account
 * by anybody who can edit a request body. The same rule as every scoped write in this
 * product: the tenancy comes from the session.
 */
export async function createKey(_prev: KeyState, formData: FormData): Promise<KeyState> {
  const actor = await requirePartnerAdmin();

  const sponsorId = String(formData.get("sponsorId") ?? "").trim();

  const result = await mintKey({
    partnerId: actor.partnerId,
    label: String(formData.get("label") ?? ""),
    scopes: formData.getAll("scopes").map(String),
    environment: String(formData.get("environment") ?? "sandbox") as ApiEnvironment,
    /*
     * 🔴 C265 — empty means none, not "all of them". `mintKey` refuses
     * `employment:verify` without one, and `partner_api_keys_employment_needs_sponsor`
     * refuses it again in the database.
     */
    sponsorId: sponsorId || null,
  });

  if (result.error || !result.key) return { error: result.error ?? "That key could not be made." };

  revalidatePath("/partner");
  /*
   * 🔴 The raw key travels back in the action's return value and is stored nowhere. This is
   * the only moment it exists outside the caller's clipboard.
   */
  return { raw: result.key.raw, prefix: result.key.prefix };
}

export async function revoke(formData: FormData): Promise<void> {
  const actor = await requirePartnerAdmin();
  await revokeKey(actor.partnerId, String(formData.get("keyId") ?? ""));
  revalidatePath("/partner");
}
