import "server-only";

import { and, asc, eq, inArray, isNull, ne, sql } from "drizzle-orm";

import {
  ADMIN_CAPABILITIES,
  parseCapabilities,
  roleProblem,
} from "@/lib/clinic-auth/capabilities";
import { controlDb } from "@/lib/db";
import {
  clinicAuthSessions,
  clinicManagers,
  clinicRoles,
  clinicStaffAssignments,
  users,
} from "@/lib/db/schema";
import { log, ref } from "@/lib/logger";

/**
 * The clinic's own people and the roles they hold. PLAN.md 63.2 to 63.8, 63.14,
 * C325, C326, C352, C353.
 *
 * ## 🔴 WHY THIS IS A THIRD CLINIC FILE
 *
 * `lib/data/clinic.ts` is the WALL: what a clinic may read, with every select list
 * shaped by 54.9. `lib/data/clinic-admin.ts` is the practice's own account and its
 * clinicians. This one is the practice's STAFF, which is the seventh principal, and
 * it is separate because everything in it writes permissions.
 *
 * A file that can grant a capability is the file somebody reads first when they ask
 * "how could this person have seen that", and mixing it into either of the other two
 * would bury four writes among forty reads.
 */

/** Every custom role this practice has named, with what it can do. */
export async function rolesFor(clinicOrganizationId: string) {
  const rows = await controlDb
    .select({
      id: clinicRoles.id,
      slot: clinicRoles.slot,
      name: clinicRoles.name,
      capabilities: clinicRoles.capabilities,
      createdAt: clinicRoles.createdAt,
    })
    .from(clinicRoles)
    .where(
      and(eq(clinicRoles.organizationId, clinicOrganizationId), isNull(clinicRoles.deletedAt)),
    )
    .orderBy(asc(clinicRoles.slot));

  /*
   * 🔴 C353 — THROUGH `parseCapabilities`, EVEN ON THE WAY TO A SCREEN.
   *
   * The screen that lists roles is also the screen somebody reads to answer "what
   * can this person do", so it must show what the check will actually honour
   * rather than what the column happens to contain. A stale string shown as a
   * granted permission is worse than the stale string, because somebody then
   * believes a permission is in place.
   */
  return rows.map((row) => ({
    id: row.id,
    slot: row.slot,
    name: row.name,
    capabilities: parseCapabilities(row.capabilities),
    createdAt: row.createdAt,
  }));
}

/**
 * 🔴 63.3 / 63.6 / C326 — CREATE A CUSTOM ROLE, AND THE SUBSET IS ENFORCED HERE.
 *
 * *A custom role must never be grantable a capability its creator lacks, or a clinic
 * admin escalates by creating a role.* `roleProblem` is the rule and it runs at WRITE
 * time, because a role that exists with a capability its creator lacks is an
 * escalation whether or not a screen draws a button for it.
 *
 * 🔴 THE SLOT IS CLAIMED BY AN INSERT, NOT BY A COUNT.
 *
 * "Up to two" is a unique index on (organization_id, slot), so two requests arriving
 * together both counting one existing role cannot both succeed. Trying slot 1 then
 * slot 2 and taking the first that inserts is the whole of the race handling, and it
 * is the same shape the sponsor allowance uses.
 */
export async function createRole(input: {
  clinicOrganizationId: string;
  byManagerId: string;
  name: string;
  capabilities: string[];
}): Promise<{ id?: string; error?: string }> {
  const problem = roleProblem({
    name: input.name,
    capabilities: input.capabilities,
    /*
     * 🔴 The creator is always the clinic admin, because `requireClinicAdmin` is
     * the only door to this. It is passed rather than assumed so the rule reads as
     * "no more than the creator" at the one place the rule is written, which is
     * what it will still have to mean if a second kind of creator ever exists.
     */
    creatorHolds: ADMIN_CAPABILITIES,
  });
  if (problem) return { error: problem };

  const capabilities = parseCapabilities(input.capabilities);

  for (const slot of [1, 2]) {
    const [created] = await controlDb
      .insert(clinicRoles)
      .values({
        organizationId: input.clinicOrganizationId,
        slot,
        name: input.name.trim().slice(0, 40),
        capabilities,
        createdByManagerId: input.byManagerId,
      })
      .onConflictDoNothing()
      .returning({ id: clinicRoles.id });

    if (created) {
      log.info("clinic role created", { org: ref(input.clinicOrganizationId), slot });
      return { id: created.id };
    }
  }

  return { error: "You already have two roles. Change one of those, or remove it first." };
}

/**
 * 🔴 63.6 / C326 — CHANGE WHAT A ROLE CAN DO, through the same rule.
 *
 * The same `roleProblem`, not a second copy of it, and the same reason: a role that
 * could be CREATED within the rule and then EDITED outside it has no rule.
 *
 * 🔴 AND THE CHANGE REACHES A LIVE SESSION, because `getClinicActor` resolves
 * capabilities on every request from this row rather than stamping them into a cookie
 * at sign-in. Narrowing a role takes effect on the holder's next page load, which is
 * the only behaviour that makes "remove this person's access" mean anything.
 */
export async function updateRole(input: {
  clinicOrganizationId: string;
  roleId: string;
  name: string;
  capabilities: string[];
}): Promise<{ ok?: true; error?: string }> {
  const problem = roleProblem({
    name: input.name,
    capabilities: input.capabilities,
    creatorHolds: ADMIN_CAPABILITIES,
  });
  if (problem) return { error: problem };

  const [updated] = await controlDb
    .update(clinicRoles)
    .set({
      name: input.name.trim().slice(0, 40),
      capabilities: parseCapabilities(input.capabilities),
      updatedAt: new Date(),
    })
    /* Theirs, in the WHERE. A borrowed role id changes nobody else's practice. */
    .where(
      and(
        eq(clinicRoles.id, input.roleId),
        eq(clinicRoles.organizationId, input.clinicOrganizationId),
        isNull(clinicRoles.deletedAt),
      ),
    )
    .returning({ id: clinicRoles.id });

  if (!updated) return { error: "That role is no longer here." };
  return { ok: true };
}

/**
 * Remove a role.
 *
 * 🔴 SOFT, and the people holding it keep their accounts. `clinic_managers.role_id`
 * is `ON DELETE SET NULL`, and `getClinicActor` reads a deleted role as NO
 * capabilities rather than as an absent join: somebody whose role was withdrawn can
 * still sign in and sees nothing, which is a person to talk to rather than a locked
 * door with no explanation.
 */
export async function removeRole(input: {
  clinicOrganizationId: string;
  roleId: string;
}): Promise<{ ok?: true; error?: string }> {
  const [removed] = await controlDb
    .update(clinicRoles)
    .set({ deletedAt: new Date(), updatedAt: new Date() })
    .where(
      and(
        eq(clinicRoles.id, input.roleId),
        eq(clinicRoles.organizationId, input.clinicOrganizationId),
        isNull(clinicRoles.deletedAt),
      ),
    )
    .returning({ id: clinicRoles.id });

  if (!removed) return { error: "That role is no longer here." };
  return { ok: true };
}

/** The practice's staff, with the role each holds and who they are assigned to. */
export async function staffFor(clinicOrganizationId: string) {
  const people = await controlDb
    .select({
      id: clinicManagers.id,
      email: clinicManagers.email,
      name: clinicManagers.name,
      role: clinicManagers.role,
      roleId: clinicManagers.roleId,
      roleName: clinicRoles.name,
      linkedUserId: clinicManagers.linkedUserId,
      lastSignInAt: clinicManagers.lastSignInAt,
      /*
       * 🔴 W2-C04: invited and not yet in. Whether a password exists, never
       * the hash: a screen has no business holding one.
       */
      invited: sql<boolean>`${clinicManagers.passwordHash} IS NULL`,
    })
    .from(clinicManagers)
    .leftJoin(clinicRoles, eq(clinicRoles.id, clinicManagers.roleId))
    .where(
      and(
        eq(clinicManagers.organizationId, clinicOrganizationId),
        isNull(clinicManagers.deletedAt),
      ),
    )
    .orderBy(asc(clinicManagers.email));

  const assignments = await controlDb
    .select({
      clinicManagerId: clinicStaffAssignments.clinicManagerId,
      userId: clinicStaffAssignments.userId,
      firstName: users.firstName,
      lastName: users.lastName,
    })
    .from(clinicStaffAssignments)
    .innerJoin(users, eq(users.id, clinicStaffAssignments.userId))
    .where(eq(clinicStaffAssignments.organizationId, clinicOrganizationId));

  return people.map((person) => ({
    ...person,
    assigned: assignments
      .filter((assignment) => assignment.clinicManagerId === person.id)
      .map((assignment) => ({
        userId: assignment.userId,
        name: [assignment.firstName, assignment.lastName].filter(Boolean).join(" "),
      })),
  }));
}

/**
 * 🔴 63.3 — ADD A STAFF MEMBER, and they get a role rather than a set.
 *
 * The capability set is never written onto a person: it lives on the role, and a
 * person points at one. Per-person capability sets are how a practice ends up with
 * eleven different answers to "what can a receptionist do here" and no way to audit
 * any of them.
 *
 * 🔴 `role: "viewer"` on the built-in column, ALWAYS. The built-in `admin` is the
 * practice's owner and is created by us on the call (54.3); nothing on a self-serve
 * path may mint one, or "add a colleague" is "add an owner".
 *
 * 🔴 W2-C04: AND WITH NO PASSWORD. The admin used to type one here and pass it
 * on out of band. The row is created with none, which `checkClinicPassword`
 * refuses, and the caller issues an invitation link from which the staff
 * member chooses their own (`lib/clinic-auth/tokens.ts`).
 */
export async function addStaff(input: {
  clinicOrganizationId: string;
  email: string;
  name: string | null;
  roleId: string;
}): Promise<{ id?: string; error?: string }> {
  const email = input.email.trim().toLowerCase();
  if (!email.includes("@")) return { error: "That email address does not look right." };

  /* The role must be this practice's. A borrowed id is a role from another clinic. */
  const [role] = await controlDb
    .select({ id: clinicRoles.id })
    .from(clinicRoles)
    .where(
      and(
        eq(clinicRoles.id, input.roleId),
        eq(clinicRoles.organizationId, input.clinicOrganizationId),
        isNull(clinicRoles.deletedAt),
      ),
    )
    .limit(1);

  if (!role) return { error: "Choose one of your own roles for them." };

  try {
    const [created] = await controlDb
      .insert(clinicManagers)
      .values({
        organizationId: input.clinicOrganizationId,
        email,
        name: input.name?.trim().slice(0, 120) || null,
        passwordHash: null,
        role: "viewer",
        roleId: role.id,
      })
      .returning({ id: clinicManagers.id });

    log.info("clinic staff added", { org: ref(input.clinicOrganizationId) });
    return { id: created?.id };
  } catch {
    /*
     * The unique index is across clinics rather than within one, so this also
     * catches an address already managing a different practice. One message either
     * way: which of the two it was is a fact about another customer.
     */
    return { error: "There is already an account with that email address." };
  }
}

/**
 * 🔴 W2-C04: ONE OF THIS PRACTICE'S STAFF, and never its owner.
 *
 * Every lifecycle act below goes through this: the row must be this
 * practice's, live, and a `viewer`. The built-in admin is ours to create and
 * ours to change (54.3), so no screen here can remove, re-role or sign out the
 * person who runs the practice, including themselves.
 */
async function staffMember(clinicOrganizationId: string, clinicManagerId: string) {
  const [row] = await controlDb
    .select({ id: clinicManagers.id, email: clinicManagers.email })
    .from(clinicManagers)
    .where(
      and(
        eq(clinicManagers.id, clinicManagerId),
        eq(clinicManagers.organizationId, clinicOrganizationId),
        eq(clinicManagers.role, "viewer"),
        isNull(clinicManagers.deletedAt),
      ),
    )
    .limit(1);
  return row ?? null;
}

/** The staff member an invitation link is for, if they have still not set a password. */
export async function invitedStaff(clinicOrganizationId: string, clinicManagerId: string) {
  const [row] = await controlDb
    .select({ id: clinicManagers.id, email: clinicManagers.email })
    .from(clinicManagers)
    .where(
      and(
        eq(clinicManagers.id, clinicManagerId),
        eq(clinicManagers.organizationId, clinicOrganizationId),
        eq(clinicManagers.role, "viewer"),
        isNull(clinicManagers.passwordHash),
        isNull(clinicManagers.deletedAt),
      ),
    )
    .limit(1);
  return row ?? null;
}

/**
 * 🔴 W2-C04: REMOVE A STAFF MEMBER. Soft, like a role: the row stays for the
 * audit trail that names it, the assignments go, every session ends now and
 * the address is free to be used again (the unique index is on live rows).
 */
export async function removeStaff(input: {
  clinicOrganizationId: string;
  clinicManagerId: string;
}): Promise<{ ok?: true; error?: string }> {
  const staff = await staffMember(input.clinicOrganizationId, input.clinicManagerId);
  if (!staff) return { error: "That person is not on your team." };

  await controlDb
    .update(clinicManagers)
    .set({ deletedAt: new Date(), updatedAt: new Date() })
    .where(eq(clinicManagers.id, staff.id));
  await controlDb
    .delete(clinicStaffAssignments)
    .where(eq(clinicStaffAssignments.clinicManagerId, staff.id));
  await revokeClinicSessionsFor(staff.id);

  log.info("clinic staff removed", { org: ref(input.clinicOrganizationId) });
  return { ok: true };
}

/**
 * 🔴 W2-C04: GIVE A STAFF MEMBER A DIFFERENT ROLE. One of this practice's own
 * roles, never another clinic's. `getClinicActor` reads capabilities from the
 * role on every request, so the change reaches a live session on its next page.
 */
export async function changeStaffRole(input: {
  clinicOrganizationId: string;
  clinicManagerId: string;
  roleId: string;
}): Promise<{ ok?: true; error?: string }> {
  const staff = await staffMember(input.clinicOrganizationId, input.clinicManagerId);
  if (!staff) return { error: "That person is not on your team." };

  const [role] = await controlDb
    .select({ id: clinicRoles.id })
    .from(clinicRoles)
    .where(
      and(
        eq(clinicRoles.id, input.roleId),
        eq(clinicRoles.organizationId, input.clinicOrganizationId),
        isNull(clinicRoles.deletedAt),
      ),
    )
    .limit(1);
  if (!role) return { error: "Choose one of your own roles for them." };

  await controlDb
    .update(clinicManagers)
    .set({ roleId: role.id, updatedAt: new Date() })
    .where(and(eq(clinicManagers.id, staff.id), ne(clinicManagers.role, "admin")));
  return { ok: true };
}

/** 🔴 W2-C04: SIGN A STAFF MEMBER OUT EVERYWHERE, now. Their account stays. */
export async function signOutStaff(input: {
  clinicOrganizationId: string;
  clinicManagerId: string;
}): Promise<{ ok?: true; ended?: number; error?: string }> {
  const staff = await staffMember(input.clinicOrganizationId, input.clinicManagerId);
  if (!staff) return { error: "That person is not on your team." };
  return { ok: true, ended: await revokeClinicSessionsFor(staff.id) };
}

/**
 * 🔴 63.4 / C325 — WHICH CLINICIANS THIS STAFF MEMBER IS ASSIGNED TO.
 *
 * Replaces the whole set rather than adding one, because the screen is a list of
 * checkboxes and "save" means "this is the list now". An add-only function would need
 * a remove beside it and a screen that got the difference right, which is three ways
 * to leave somebody assigned to a clinician nobody intended.
 */
export async function setAssignments(input: {
  clinicOrganizationId: string;
  clinicManagerId: string;
  userIds: string[];
}): Promise<{ ok?: true; error?: string }> {
  /* Theirs. A borrowed manager id assigns nobody. */
  const [staff] = await controlDb
    .select({ id: clinicManagers.id, role: clinicManagers.role })
    .from(clinicManagers)
    .where(
      and(
        eq(clinicManagers.id, input.clinicManagerId),
        eq(clinicManagers.organizationId, input.clinicOrganizationId),
        isNull(clinicManagers.deletedAt),
      ),
    )
    .limit(1);

  if (!staff) return { error: "That person is not on your team." };

  /*
   * 🔴 ASSIGNING THE ADMIN IS REFUSED RATHER THAN IGNORED.
   *
   * An admin is not scoped: `scopeToAssigned` returns null for them, so rows here
   * would have no effect. Writing them anyway would leave a screen showing an
   * assignment list that does nothing, which is the worst kind of permission UI:
   * one somebody reads as a restriction that is not there.
   */
  if (staff.role === "admin") {
    return { error: "You can see everybody in the practice. Assignments are for your team." };
  }

  /* And every clinician must be one of this practice's own. */
  const wanted = [...new Set(input.userIds)].slice(0, 200);
  const valid =
    wanted.length === 0
      ? []
      : await controlDb
          .select({ id: users.id })
          .from(users)
          .where(
            and(
              eq(users.organizationId, input.clinicOrganizationId),
              eq(users.role, "therapist"),
              isNull(users.deletedAt),
              /*
               * 🔴 `inArray`, never a hand-built `ANY(ARRAY[...])`. The ids arrive
               * from a form, and interpolating them into SQL text would be an
               * injection in the one file in this product that writes permissions.
               */
              inArray(users.id, wanted),
            ),
          );

  await controlDb
    .delete(clinicStaffAssignments)
    .where(eq(clinicStaffAssignments.clinicManagerId, input.clinicManagerId));

  if (valid.length > 0) {
    await controlDb.insert(clinicStaffAssignments).values(
      valid.map((row) => ({
        organizationId: input.clinicOrganizationId,
        clinicManagerId: input.clinicManagerId,
        userId: row.id,
      })),
    );
  }

  log.info("clinic assignments set", {
    org: ref(input.clinicOrganizationId),
    count: valid.length,
  });
  return { ok: true };
}


/**
 * 🔴 C352 — END EVERY SESSION THIS MANAGEMENT PRINCIPAL HOLDS.
 *
 * Called on the way OUT of the clinic principal, before the clinician's session is
 * minted, so there is no instant at which both are live. The order is the ruling: a
 * crash between the two leaves somebody signed out of both, which is an inconvenience,
 * and the other order leaves them signed into both, which is the thing forbidden.
 */
export async function revokeClinicSessionsFor(clinicManagerId: string): Promise<number> {
  const rows = await controlDb
    .update(clinicAuthSessions)
    .set({ revokedAt: new Date() })
    .where(
      and(
        eq(clinicAuthSessions.clinicManagerId, clinicManagerId),
        isNull(clinicAuthSessions.revokedAt),
      ),
    )
    .returning({ id: clinicAuthSessions.id });

  return rows.length;
}
