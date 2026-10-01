"use server";

import { revalidatePath } from "next/cache";

import { requireUser } from "@/lib/auth/guard";
import { revokeConnection } from "@/lib/data/meeting-connections";
import { MEETING_PROVIDERS, type MeetingProvider } from "@/lib/db/schema";

export type IntegrationState = { error?: string; ok?: boolean };

/**
 * Disconnecting a meeting account. PLAN.md 41.3.
 *
 * Connecting is not here, and that is the point: it happens through an OAuth
 * redirect and a callback route, so there is no action a clinician could be
 * asked to submit a credential to. §7: a therapist holding an API key is a
 * therapist who got lost in our product, and the way to keep that true is for
 * there to be no field.
 */
export async function disconnectMeetingAccount(
  provider: string,
): Promise<IntegrationState> {
  const actor = await requireUser();

  if (!MEETING_PROVIDERS.includes(provider as MeetingProvider)) {
    return { error: "That is not a provider we connect to." };
  }

  await revokeConnection(actor, provider as MeetingProvider);
  revalidatePath("/settings/integrations");
  return { ok: true };
}

/**
 * 🔴 F6: the clinician's own approval of the platform their practice is on,
 * before it may open 24Therapy for them. Only the partner their practice is
 * billed through can be approved (`approvePartner` checks); revoking also ends
 * any session that partner opened for them.
 */
export async function approvePartnerLaunch(partnerId: string): Promise<void> {
  const actor = await requireUser();
  const { approvePartner } = await import("@/lib/partner/approvals");
  await approvePartner(actor, partnerId);
  revalidatePath("/settings/integrations");
}

export async function revokePartnerLaunch(partnerId: string): Promise<void> {
  const actor = await requireUser();
  const { revokePartner } = await import("@/lib/partner/approvals");
  await revokePartner(actor, partnerId);
  revalidatePath("/settings/integrations");
}
