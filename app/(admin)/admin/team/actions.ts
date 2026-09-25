"use server";

import { revalidatePath } from "next/cache";

import { reasonProblem, reasonText } from "@/lib/admin/reason";
import { audit } from "@/lib/audit";
import { emailAccountLink } from "@/lib/auth/account-links";
import { requireRole } from "@/lib/auth/guard";
import { resetSecondFactor } from "@/lib/auth/second-factor";
import {
  createBackOfficeUser,
  linkableMember,
  otherActiveOwners,
  setBackOfficeActive,
  setBackOfficeRole,
} from "@/lib/data/admin-team";
import { getI18n } from "@/lib/i18n/server";

export type TeamState = { ok?: boolean; error?: string; asked?: boolean };

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

/**
 * 🔴 K3: another owner. A ledger adjustment waits for a second super admin,
 * and this page could only make staff and managers, so a company with one
 * founder could never post one: the four eyes asked for a person nobody could
 * create. The first extra owner needs only the reason, because there is no
 * other owner to ask; from then on a further one is asked for here and
 * completed by one of the others, through the same approvals as the ledger.
 * Every invite is audited with its reason, and the new owner meets the same
 * sign-in and second step as everybody on the team.
 */
export async function inviteOwner(_prev: TeamState, formData: FormData): Promise<TeamState> {
  const actor = await requireRole("super_admin");
  const reason = String(formData.get("reason") ?? "");
  const problem = reasonProblem(reason);
  if (problem) return { error: (await getI18n()).t(problem) };
  const asked = {
    email: String(formData.get("email") ?? "").trim().toLowerCase(),
    firstName: String(formData.get("firstName") ?? ""),
    lastName: String(formData.get("lastName") ?? ""),
  };
  if (!asked.email.includes("@")) return { error: "That email address does not look right." };

  /*
   * Completing re-runs this action (`completeApproval`), and the gate then
   * hands back the invite as it was asked, not what the form says.
   */
  const { closeApproval, secondPersonGate } = await import("@/lib/billing/approvals");
  const gate = await secondPersonGate({
    kind: "owner_invite",
    subjectId: asked.email,
    payload: asked,
    reason: reasonText(reason),
    actorUserId: actor.userId,
    enabled: (await otherActiveOwners(actor.userId)) > 0,
  });
  if (!gate.go) {
    revalidatePath("/admin/team");
    /* The gate's two refusals: written down just now, or this owner asked it already. */
    return gate.message.startsWith("Asked")
      ? { ok: true, asked: true }
      : { error: (await getI18n()).t("ateam.ownerYours") };
  }

  const created = await createBackOfficeUser({ ...gate.payload, role: "super_admin" });
  if (created.error || !created.id) return { error: created.error };

  await emailAccountLink({
    audience: "staff",
    accountId: created.id,
    email: created.email!,
    createdByUserId: actor.userId,
  });
  if (gate.approvalId) {
    await closeApproval({ approvalId: gate.approvalId, decidedBy: actor.userId, state: "done" });
  }
  await audit({
    actor,
    category: "admin",
    action: "team.owner_invited",
    resourceType: "user",
    resourceId: created.id,
    reason: `super_admin, ${gate.reason}${gate.askedBy ? ` (asked by ${gate.askedBy})` : ""}`,
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

/**
 * 🔴 Task 40: clear another member's authenticator and recovery codes, so
 * their next sign-in asks for a code by email and they can enrol again. Never
 * the owner's own: `resetSecondFactor` refuses it and writes the refusal down.
 */
export async function resetMemberSecondFactor(_prev: TeamState, formData: FormData): Promise<TeamState> {
  const actor = await requireRole("super_admin");
  const userId = String(formData.get("userId") ?? "");

  const result = await resetSecondFactor(actor, userId);
  if (!result.ok) return { error: (await getI18n()).t(result.error) };

  await audit({
    actor,
    category: "admin",
    action: "second_factor.reset",
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
