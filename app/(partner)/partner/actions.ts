"use server";

import { revalidatePath } from "next/cache";

import { requirePartnerAdmin } from "@/lib/partner-auth/guard";
import { mintKey, revokeKey, rotateKey } from "@/lib/partner/keys";
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
    byPartnerUserId: actor.partnerUserId,
  });

  if (result.error || !result.key) return { error: result.error ?? "That key could not be made." };

  revalidatePath("/partner");
  /*
   * 🔴 The raw key travels back in the action's return value and is stored nowhere. This is
   * the only moment it exists outside the caller's clipboard.
   */
  return { raw: result.key.raw, prefix: result.key.prefix };
}

/** Revoke, after the screen's own confirm step. W2-X04: audited in `revokeKey`. */
export async function revoke(formData: FormData): Promise<void> {
  const actor = await requirePartnerAdmin();
  await revokeKey(actor.partnerId, String(formData.get("keyId") ?? ""), actor.partnerUserId);
  revalidatePath("/partner");
}

/**
 * 🔴 W2-X04: ROLL A KEY. The new raw key comes back once, exactly as a new key
 * does, and the old one keeps working for the overlap chosen on the form.
 */
export async function rotate(_prev: KeyState, formData: FormData): Promise<KeyState> {
  const actor = await requirePartnerAdmin();

  const result = await rotateKey({
    partnerId: actor.partnerId,
    keyId: String(formData.get("keyId") ?? ""),
    overlapHours: Number(formData.get("overlapHours") ?? 0),
    byPartnerUserId: actor.partnerUserId,
  });

  if (result.error || !result.key) return { error: result.error ?? "That key could not be made." };

  revalidatePath("/partner");
  return { raw: result.key.raw, prefix: result.key.prefix };
}

/**
 * 🔴 68.15 / 68.16 — THE LIMIT THEY SET, AND ONLY AN ADMIN SETS IT.
 *
 * The same rule that guards minting a key, and for the same reason: this number is
 * what the account spends. A developer on the team reads the usage page; the person
 * who signed the contract chooses the ceiling.
 *
 * 🔴 RAISING IT CLEARS THE STOP AND BOTH ALERT STAMPS, so the 80% alert fires again
 * against the new number. `setLimit` does that; it is written here because it is the
 * behaviour somebody reading this action will want to know about.
 */
export async function saveLimit(monthlySessionLimit: number): Promise<{ error?: string }> {
  const actor = await requirePartnerAdmin();

  const { setLimit } = await import("@/lib/partner/usage");
  const result = await setLimit({
    partnerId: actor.partnerId,
    monthlySessionLimit,
  });

  if (result.error) return { error: result.error };

  /*
   * 🔴 AUDITED, because a limit is the one setting on this account that can stop a
   * therapist's copilot mid-session. "Who raised it, and when" is a question support
   * will be asked, and the answer has to come from a row rather than from a memory.
   */
  const { audit } = await import("@/lib/audit");
  await audit({
    actor: null,
    category: "admin",
    action: "partner.limit.set",
    resourceType: "partner",
    resourceId: actor.partnerId,
    reason: `${Math.max(0, Math.floor(monthlySessionLimit))} sessions a month`,
  });

  revalidatePath("/partner/usage");
  return {};
}
