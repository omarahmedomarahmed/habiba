"use server";

import { revalidatePath } from "next/cache";

import { audit } from "@/lib/audit";
import { SPONSOR_ROLES, type SponsorRole } from "@/lib/db/schema";
import {
  changeSponsorPassword,
  inviteSponsorUser,
  removeSponsorUser,
  setSponsorUserRole,
} from "@/lib/data/sponsor-users";
import { getI18n } from "@/lib/i18n/server";
import { createSponsorSession } from "@/lib/sponsor-auth/session";
import { requireSponsor, requireSponsorAdmin } from "@/lib/sponsor-auth/guard";

export type TeamState = { error?: string; ok?: boolean };

/**
 * 🔴 W2-S05: a company's own logins, which only an operator could make.
 *
 * Inviting, changing a role and removing are admin acts, like every other write
 * in this portal, and each is audited against the sponsor user who did it.
 * Changing your own password is anybody's. None of these names or touches any
 * person the company funds (C227): a login is somebody at the company.
 */
export async function inviteColleague(_prev: TeamState, formData: FormData): Promise<TeamState> {
  const actor = await requireSponsorAdmin();
  const { t } = await getI18n();

  const role = String(formData.get("role") ?? "viewer");
  if (!SPONSOR_ROLES.includes(role as SponsorRole)) return { error: "Pick a role." };

  const result = await inviteSponsorUser({
    sponsorId: actor.sponsorId,
    email: String(formData.get("email") ?? ""),
    role: role as SponsorRole,
    message: {
      subject: t("sponsor.inviteMailSubject", { org: actor.sponsorName }),
      body: t("sponsor.inviteMailBody"),
    },
  });
  if (result.error) return { error: result.error };

  await audit({
    actor: null,
    sponsorUserId: actor.sponsorUserId,
    category: "admin",
    action: "sponsor.user_invited",
    resourceType: "sponsor_user",
    resourceId: result.sponsorUserId ?? null,
    reason: role,
  });

  revalidatePath("/sponsor/team");
  return { ok: true };
}

export async function changeRole(sponsorUserId: string, role: string): Promise<TeamState> {
  const actor = await requireSponsorAdmin();
  if (!SPONSOR_ROLES.includes(role as SponsorRole)) return { error: "Pick a role." };

  const result = await setSponsorUserRole({
    sponsorId: actor.sponsorId,
    sponsorUserId,
    role: role as SponsorRole,
  });
  if (result.error) return { error: result.error };

  await audit({
    actor: null,
    sponsorUserId: actor.sponsorUserId,
    category: "admin",
    action: "sponsor.user_role",
    resourceType: "sponsor_user",
    resourceId: sponsorUserId,
    reason: role,
  });

  revalidatePath("/sponsor/team");
  return { ok: true };
}

export async function removeColleague(sponsorUserId: string): Promise<TeamState> {
  const actor = await requireSponsorAdmin();

  const result = await removeSponsorUser({
    sponsorId: actor.sponsorId,
    sponsorUserId,
    bySponsorUserId: actor.sponsorUserId,
  });
  if (result.error) return { error: result.error };

  await audit({
    actor: null,
    sponsorUserId: actor.sponsorUserId,
    category: "admin",
    action: "sponsor.user_removed",
    resourceType: "sponsor_user",
    resourceId: sponsorUserId,
  });

  revalidatePath("/sponsor/team");
  return { ok: true };
}

/**
 * Your own password. Every session of this login ends, including this one,
 * so a fresh one is made here: somebody who changed their password because
 * another person had it is the only one left signed in.
 */
export async function changeOwnPassword(_prev: TeamState, formData: FormData): Promise<TeamState> {
  const actor = await requireSponsor();

  const result = await changeSponsorPassword(
    actor.sponsorUserId,
    String(formData.get("current") ?? ""),
    String(formData.get("next") ?? ""),
  );
  if (result.error) return { error: result.error };

  await createSponsorSession(actor.sponsorUserId);
  await audit({
    actor: null,
    sponsorUserId: actor.sponsorUserId,
    category: "auth",
    action: "sponsor.password_changed",
    resourceType: "sponsor_user",
    resourceId: actor.sponsorUserId,
  });
  return { ok: true };
}
