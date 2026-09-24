"use server";

import { revalidatePath } from "next/cache";

import { audit } from "@/lib/audit";
import { emailAccountLink } from "@/lib/auth/account-links";
import { requireRole } from "@/lib/auth/guard";
import {
  createBackOfficeUser,
  linkableMember,
  setBackOfficeActive,
  setBackOfficeRole,
} from "@/lib/data/admin-team";
import { getI18n } from "@/lib/i18n/server";

export type TeamState = { ok?: boolean; error?: string };

/**
 * 🔴 W2-A06: the back office's own team, managed from the console.
 *
 * The owner's, like every other door that decides who can reach the money
 * (`lib/admin/access.ts`). Every act is audited, and none of them involves a
 * password anybody but its owner knows: a new member and a forgotten password
 * both get an emailed link.
 */

export async function inviteMember(_prev: TeamState, formData: FormData): Promise<TeamState> {
  const actor = await requireRole("super_admin");
  const role = String(formData.get("role") ?? "staff") === "manager" ? "manager" : "staff";

  const created = await createBackOfficeUser({
    email: String(formData.get("email") ?? ""),
    firstName: String(formData.get("firstName") ?? ""),
    lastName: String(formData.get("lastName") ?? ""),
    role,
  });
  if (created.error || !created.id) return { error: created.error };

  await emailAccountLink({
    audience: "staff",
    accountId: created.id,
    email: created.email!,
    createdByUserId: actor.userId,
  });
  await audit({
    actor,
    category: "admin",
    action: "team.member_invited",
    resourceType: "user",
    resourceId: created.id,
    reason: role,
  });
  revalidatePath("/admin/team");
  return { ok: true };
}

export async function changeRole(_prev: TeamState, formData: FormData): Promise<TeamState> {
  const actor = await requireRole("super_admin");
  const userId = String(formData.get("userId") ?? "");
  const role = String(formData.get("role") ?? "");

  const result = await setBackOfficeRole({ userId, role, actorUserId: actor.userId });
  if (result.error) return { error: (await getI18n()).t(result.error) };

  await audit({
    actor,
    category: "admin",
    action: "team.role_changed",
    resourceType: "user",
    resourceId: userId,
    reason: role,
  });
  revalidatePath("/admin/team");
  return { ok: true };
}

export async function setActive(_prev: TeamState, formData: FormData): Promise<TeamState> {
  const actor = await requireRole("super_admin");
  const userId = String(formData.get("userId") ?? "");
  const active = String(formData.get("active") ?? "") === "true";

  const result = await setBackOfficeActive({ userId, active, actorUserId: actor.userId });
  if (result.error) return { error: (await getI18n()).t(result.error) };

  await audit({
    actor,
    category: "admin",
    action: active ? "team.member_reactivated" : "team.member_deactivated",
    resourceType: "user",
    resourceId: userId,
  });
  revalidatePath("/admin/team");
  return { ok: true };
}

export async function sendPasswordLink(_prev: TeamState, formData: FormData): Promise<TeamState> {
  const actor = await requireRole("super_admin");
  const userId = String(formData.get("userId") ?? "");

  const member = await linkableMember(userId, actor.userId);
  if (!member) return { error: (await getI18n()).t("ateam.errNotChangeable") };

  await emailAccountLink({
    audience: "staff",
    accountId: userId,
    email: member.email,
    purpose: "reset",
    createdByUserId: actor.userId,
  });
  await audit({
    actor,
    category: "admin",
    action: "team.password_link_sent",
    resourceType: "user",
    resourceId: userId,
  });
  return { ok: true };
}
