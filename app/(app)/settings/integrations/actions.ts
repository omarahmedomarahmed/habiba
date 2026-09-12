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
