"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

import { audit } from "@/lib/audit";
import { requireClinic, requireClinicAdmin } from "@/lib/clinic-auth/guard";
import { revokeClinicSession } from "@/lib/clinic-auth/session";
import { leaveClinicPrincipal } from "@/lib/clinic-auth/switch";
import {
  addStaff,
  createRole,
  removeRole,
  setAssignments,
  updateRole,
} from "@/lib/data/clinic-team";
import { callerKey, consume } from "@/lib/rate-limit";

export type TeamState = { error?: string; ok?: boolean };

/**
 * The practice's staff and roles. PLAN.md 63.2 to 63.7, C325, C326, C352, C353.
 *
 * ## 🔴 EVERY WRITE HERE GOES THROUGH `requireClinicAdmin`
 *
 * Not `requireClinicCapability("team.manage")`, which would be the consistent-looking
 * choice and is wrong: `team.manage` is what lets somebody READ the team screen and
 * set assignments. Creating a role is creating a permission, and a product where the
 * permission to manage the team includes the permission to write permissions has one
 * role, called admin, with extra steps.
 *
 * Assignments are the exception and they say why at their own function.
 */

export async function saveRole(_prev: TeamState, formData: FormData): Promise<TeamState> {
  const actor = await requireClinicAdmin();

  const throttle = await consume(await callerKey("clinic-team"), 30, 15 * 60);
  if (!throttle.allowed) return { error: "Too many changes at once. Wait a few minutes." };

  const roleId = String(formData.get("roleId") ?? "");
  const name = String(formData.get("name") ?? "");
  const capabilities = formData.getAll("capabilities").map(String);

  const result = roleId
    ? await updateRole({
        clinicOrganizationId: actor.clinicOrganizationId,
        roleId,
        name,
        capabilities,
      })
    : await createRole({
        clinicOrganizationId: actor.clinicOrganizationId,
        byManagerId: actor.clinicManagerId,
        name,
        capabilities,
      });

  if (result.error) return { error: result.error };

  /*
   * 🔴 58.7 / C326 — A ROLE IS A PERMISSION, AND A PERMISSION WRITE IS AUDITED.
   *
   * "Who could see this, and since when" is a question somebody will ask after the
   * fact, and the only honest answer comes from a record made at the time. The
   * capabilities are in the reason string because WHICH ones changed is the whole
   * substance: "a role was edited" answers nothing.
   */
  await audit({
    actor: null,
    clinicManagerId: actor.clinicManagerId,
    category: "admin",
    action: roleId ? "clinic.role.update" : "clinic.role.create",
    resourceType: "clinic_role",
    resourceId: roleId || null,
    reason: `${name.trim().slice(0, 40)}: ${capabilities.join(", ") || "nothing"}`,
  });

  revalidatePath("/clinic/team");
  return { ok: true };
}

export async function deleteRole(roleId: string): Promise<TeamState> {
  const actor = await requireClinicAdmin();

  const result = await removeRole({
    clinicOrganizationId: actor.clinicOrganizationId,
    roleId,
  });
  if (result.error) return { error: result.error };

  await audit({
    actor: null,
    clinicManagerId: actor.clinicManagerId,
    category: "admin",
    action: "clinic.role.remove",
    resourceType: "clinic_role",
    resourceId: roleId,
    reason: "everybody holding it keeps their account and loses every capability",
  });

  revalidatePath("/clinic/team");
  return { ok: true };
}

export async function inviteStaff(_prev: TeamState, formData: FormData): Promise<TeamState> {
  const actor = await requireClinicAdmin();

  const throttle = await consume(await callerKey("clinic-team"), 30, 15 * 60);
  if (!throttle.allowed) return { error: "Too many changes at once. Wait a few minutes." };

  const result = await addStaff({
    clinicOrganizationId: actor.clinicOrganizationId,
    email: String(formData.get("email") ?? ""),
    name: String(formData.get("name") ?? "") || null,
    password: String(formData.get("password") ?? ""),
    roleId: String(formData.get("roleId") ?? ""),
  });

  if (result.error) return { error: result.error };

  /* 🔴 58.7 — a new principal inside a tenancy is the most auditable thing here. */
  await audit({
    actor: null,
    clinicManagerId: actor.clinicManagerId,
    category: "admin",
    action: "clinic.staff.add",
    resourceType: "clinic_manager",
    resourceId: result.id ?? null,
    reason: "added to the practice with a custom role",
  });

  revalidatePath("/clinic/team");
  return { ok: true };
}

/**
 * 🔴 63.4 — assignments take `team.manage` rather than admin, and this is the line.
 *
 * Deciding WHICH clinicians a receptionist covers is a rota question, and a practice
 * with two receptionists and a rota has an office manager who does it. It grants
 * nothing that role does not already hold: an assignment can only narrow what a
 * capability reaches, never add one.
 */
export async function saveAssignments(
  clinicManagerId: string,
  userIds: string[],
): Promise<TeamState> {
  const actor = await requireClinic();
  if (!actor.capabilities.includes("team.manage")) return { error: "You cannot do that." };

  const result = await setAssignments({
    clinicOrganizationId: actor.clinicOrganizationId,
    clinicManagerId,
    userIds,
  });

  if (result.error) return { error: result.error };

  /*
   * 🔴 58.7 / C325 — an assignment decides WHOSE calendars somebody reads, so it is
   * the row an auditor needs beside the read itself. Count rather than names: the
   * ids are in `clinic_staff_assignments`, and copying a list of clinicians into a
   * reason string puts the same data in two places with two retention stories.
   */
  await audit({
    actor: null,
    clinicManagerId: actor.clinicManagerId,
    category: "admin",
    action: "clinic.assignments.set",
    resourceType: "clinic_manager",
    resourceId: clinicManagerId,
    reason: `${userIds.length} clinician(s)`,
  });

  revalidatePath("/clinic/team");
  return { ok: true };
}

/**
 * 🔴 63.2 / C352 — THE SWITCH, AND THE ORDER IS THE RULING.
 *
 * Revoke every clinic session this manager holds, THEN mint the clinician's. A crash
 * between the two signs them out of both, which is an inconvenience; the other order
 * leaves one browser holding a management grant and a clinical grant at once, which
 * is the thing C352 forbids.
 *
 * `revokeClinicSession` also clears the cookie, so the browser is not left carrying a
 * token to a session that no longer exists.
 */
export async function switchToClinician(): Promise<void> {
  const actor = await requireClinic();

  const result = await leaveClinicPrincipal(actor.clinicManagerId);
  if (result.error || !result.userId) redirect("/clinic");

  await revokeClinicSession();

  const { createSession } = await import("@/lib/auth/session");
  await createSession(result.userId);

  redirect("/");
}
