"use server";

import { revalidatePath } from "next/cache";

import { audit } from "@/lib/audit";
import {
  mintSponsorKey,
  revokeSponsorKey,
  setEmploymentVerification,
} from "@/lib/data/sponsor-integrations";
import { requireSponsorAdmin } from "@/lib/sponsor-auth/guard";

export type IntegrationState = { error?: string; raw?: string };

/**
 * The HR connection's three writes. PLAN.md 66.2, 66.4, 66.10, C227, C265.
 *
 * ## 🔴 EVERY ONE OF THEM IS `requireSponsorAdmin`
 *
 * Turning employment verification on is the only thing in this product that touches
 * employment at all, and minting a key is minting a credential that answers about
 * their own staff. Neither is a thing a viewer on the account should reach by
 * mis-tapping, and both are audited: "who turned this on, and when" is the first
 * question anybody asks about a feature like this one.
 *
 * ## 🔴 AND NO ACTION HERE TAKES AN ORGANISATION
 *
 * 66.4's ruling is that the scope is structural. `actor.sponsorId` comes from the
 * session; there is no parameter any of these three could be given that would name a
 * different organisation, so there is no way to name the wrong one.
 */

export async function setVerification(
  enabled: boolean,
  hrSystem: string,
): Promise<IntegrationState> {
  const actor = await requireSponsorAdmin();

  const result = await setEmploymentVerification({
    sponsorId: actor.sponsorId,
    enabled,
    hrSystem: enabled ? hrSystem : null,
  });

  if (result.error) return { error: result.error };

  await audit({
    actor: null,
    sponsorUserId: actor.sponsorUserId,
    category: "admin",
    action: enabled ? "sponsor.employment_verification.on" : "sponsor.employment_verification.off",
    resourceType: "sponsor",
    resourceId: actor.sponsorId,
    reason: enabled
      ? `connected to ${hrSystem}`
      : "switched off, and every key of theirs revoked with it",
  });

  revalidatePath("/sponsor/integrations");
  return {};
}

/**
 * 🔴 66.6 — THE KEY IS GENERATED AT THE STEP THAT NEEDS IT.
 *
 * The raw key travels back in this action's return value and is stored nowhere. This
 * is the only moment it exists outside the caller's clipboard, which is the same rule
 * the partner portal's `mint` follows and for the same reason.
 */
export async function mintHrKey(): Promise<IntegrationState> {
  const actor = await requireSponsorAdmin();

  const result = await mintSponsorKey({
    sponsorId: actor.sponsorId,
    label: "HR connection",
  });

  if (result.error || !result.raw) {
    return { error: result.error ?? "That key could not be made." };
  }

  await audit({
    actor: null,
    sponsorUserId: actor.sponsorUserId,
    category: "admin",
    action: "sponsor.hr_key.minted",
    resourceType: "sponsor",
    resourceId: actor.sponsorId,
    /* 🔴 The prefix, never the key. An audit row holding a credential is a credential. */
    reason: `prefix ${result.prefix}`,
  });

  revalidatePath("/sponsor/integrations");
  return { raw: result.raw };
}

export async function revokeHrKey(keyId: string): Promise<IntegrationState> {
  const actor = await requireSponsorAdmin();

  const result = await revokeSponsorKey({ sponsorId: actor.sponsorId, keyId });
  if (!result.ok) return { error: "That key is no longer here." };

  await audit({
    actor: null,
    sponsorUserId: actor.sponsorUserId,
    category: "admin",
    action: "sponsor.hr_key.revoked",
    resourceType: "sponsor",
    resourceId: actor.sponsorId,
    reason: "calls using it stop immediately",
  });

  revalidatePath("/sponsor/integrations");
  return {};
}
