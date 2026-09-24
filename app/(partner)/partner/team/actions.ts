"use server";

import { revalidatePath } from "next/cache";

import { requirePartnerAdmin } from "@/lib/partner-auth/guard";
import { inviteColleague, removeColleague } from "@/lib/partner/team";

export type TeamState = { error?: string; ok?: boolean };

/**
 * 🔴 W2-X06: ADD A COLLEAGUE. An admin's act, on the admin's own account: the
 * partner id comes from the session, never the form. The colleague chooses their
 * own password from the link they are sent.
 */
export async function invite(_prev: TeamState, formData: FormData): Promise<TeamState> {
  const actor = await requirePartnerAdmin();
  const result = await inviteColleague({
    partnerId: actor.partnerId,
    email: String(formData.get("email") ?? ""),
    name: String(formData.get("name") ?? ""),
    role: String(formData.get("role") ?? "developer"),
    byPartnerUserId: actor.partnerUserId,
  });
  if (result.error) return { error: result.error };
  revalidatePath("/partner/team");
  return { ok: true };
}

/** 🔴 W2-X06: REMOVE A COLLEAGUE, after the screen's confirm step. */
export async function remove(userId: string): Promise<TeamState> {
  const actor = await requirePartnerAdmin();
  const result = await removeColleague({
    partnerId: actor.partnerId,
    userId,
    byPartnerUserId: actor.partnerUserId,
  });
  if (result.error) return { error: result.error };
  revalidatePath("/partner/team");
  return { ok: true };
}
