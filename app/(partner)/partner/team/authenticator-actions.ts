"use server";

import { revalidatePath } from "next/cache";

import type { AuthenticatorState } from "@/components/auth/authenticator-card";
import { audit } from "@/lib/audit";
import { confirmPortalFactor, removePortalFactor, startPortalFactor } from "@/lib/auth/portal-second-step";
import { getI18n } from "@/lib/i18n/server";
import { requirePartner } from "@/lib/partner-auth/guard";

/** DD-2 B2.4: a partner user's own authenticator app, optional. The cookie says whose. */

export async function startPartnerAuthenticator(_prev: AuthenticatorState, _formData: FormData): Promise<AuthenticatorState> {
  const actor = await requirePartner();
  const result = await startPortalFactor("partner", actor.partnerUserId);
  if (!result.ok) return { error: (await getI18n()).t(result.error) };
  revalidatePath("/partner/team");
  return {};
}

export async function finishPartnerAuthenticator(_prev: AuthenticatorState, formData: FormData): Promise<AuthenticatorState> {
  const actor = await requirePartner();
  const result = await confirmPortalFactor("partner", actor.partnerUserId, String(formData.get("code") ?? ""));
  if (!result.ok) return { error: (await getI18n()).t(result.error) };
  await audit({
    actor: null,
    category: "auth",
    action: "second_factor.enrolled",
    resourceType: "partner_user",
    resourceId: actor.partnerUserId,
    reason: `partner ${actor.partnerId}: authenticator app, 10 recovery codes`,
  });
  /* Shown once, in the answer only. */
  return { recoveryCodes: result.recoveryCodes };
}

export async function removePartnerAuthenticator(_prev: AuthenticatorState, formData: FormData): Promise<AuthenticatorState> {
  const actor = await requirePartner();
  const result = await removePortalFactor("partner", actor.partnerUserId, String(formData.get("code") ?? "").trim().slice(0, 40));
  if (!result.ok) return { error: (await getI18n()).t(result.error) };
  await audit({
    actor: null,
    category: "auth",
    action: "second_factor.removed",
    resourceType: "partner_user",
    resourceId: actor.partnerUserId,
    reason: `partner ${actor.partnerId}: ${result.method}`,
  });
  revalidatePath("/partner/team");
  return { removed: true };
}
