import "server-only";

import { and, asc, eq, inArray, isNull, ne } from "drizzle-orm";

import { unusablePasswordHash } from "@/lib/auth/account-links";
import { controlDb } from "@/lib/db";
import { BACK_OFFICE_ROLES, organizations, users, type Role } from "@/lib/db/schema";
import { log, ref } from "@/lib/logger";

/**
 * 🔴 THE 24/7 TEAM, WHO COULD NOT SIGN IN.
 *
 * `ROLES` has had `staff` and `manager` in it since sprint 20, five admin pages
 * are behind `requireStaff()`. And **nothing in the product could create an
 * account with either role.** Grepping the whole of `app/` for a write that
 * sets one returned nothing: the seed makes a `super_admin`, and
 * `/staff/sign-in` only signs in accounts that already exist.
 *
 * So the operating plan pays two support staff from month one to work a
 * payments queue they have no way to reach, and the only way anybody could work
 * it was by sharing the owner's login. A shared login is the end of the audit
 * trail: every confirmation, every rejection and every receipt opened is
 * attributed to one person who did not do it.
 *
 * ## The rules this deliberately keeps
 *
 * **A super_admin is not demotable or deactivatable here.** Taking the role
 * that can create roles away is a decision that should cost a database
 * session, not a form. `staff` and `manager` are what `inviteMember` mints.
 *
 * 🔴 K3: **a super_admin IS invitable, by a separate act.** A ledger
 * adjustment needs a second super admin, and with no way to make one a
 * company with one founder could never post one. `inviteOwner` asks for a
 * reason, is audited, and once a second owner exists a further one waits for
 * one of the others (`pending_approvals` kind `owner_invite`). The new owner
 * signs in through the same door and second step as every back office member.
 *
 * **They join OUR organisation**, found by slug rather than passed in, so a
 * back-office account cannot be created inside a customer's clinic by getting
 * one field wrong.
 *
 * 🔴 **W2-A06: nobody types their password.** The owner used to set a
 * colleague's first password on a call. The account is now created with a
 * password nobody knows, and the new member sets their own from an emailed
 * link (`lib/auth/account-links.ts`), which is also how a forgotten one is
 * reset. There was no list, no role change and no way to take access away,
 * so a leaver kept it until somebody edited the database; those are below.
 */

async function platformOrgId(): Promise<string | null> {
  const [org] = await controlDb
    .select({ id: organizations.id })
    .from(organizations)
    .where(eq(organizations.slug, "24therapy"))
    .limit(1);
  return org?.id ?? null;
}

export async function createBackOfficeUser(input: {
  email: string;
  firstName: string;
  lastName: string;
  role: "staff" | "manager" | "super_admin";
}): Promise<{ ok?: true; error?: string; id?: string; email?: string }> {
  const email = input.email.trim().toLowerCase();
  if (!email.includes("@")) return { error: "That email address does not look right." };

  if (input.role !== "staff" && input.role !== "manager" && input.role !== "super_admin") {
    return { error: "A back office account is staff, manager or owner. Nothing else is set here." };
  }

  const orgId = await platformOrgId();
  if (!orgId) return { error: "The platform organisation does not exist on this database." };

  try {
    const [row] = await controlDb
      .insert(users)
      .values({
        organizationId: orgId,
        email,
        passwordHash: await unusablePasswordHash(),
        firstName: input.firstName.trim().slice(0, 80) || "Staff",
        lastName: input.lastName.trim().slice(0, 80) || "Member",
        role: input.role,
      })
      .returning({ id: users.id });
    log.info("back office account created", { email: ref(email), role: input.role });
    return { ok: true, id: row?.id, email };
  } catch {
    return { error: "There is already an account with that email address." };
  }
}

export type TeamMember = {
  id: string;
  name: string;
  email: string;
  role: Role;
  active: boolean;
  /** Task 40: an authenticator app is enrolled, rather than codes by email. Never the secret. */
  app: boolean;
};

/** Everybody who can open the console, the owner first. */
export async function listBackOffice(): Promise<TeamMember[]> {
  const rows = await controlDb
    .select({
      id: users.id,
      firstName: users.firstName,
      lastName: users.lastName,
      email: users.email,
      role: users.role,
      status: users.status,
    })
    .from(users)
    .where(and(inArray(users.role, [...BACK_OFFICE_ROLES]), isNull(users.deletedAt)))
    .orderBy(asc(users.role), asc(users.email))
    .limit(200);

  const rank = (role: Role) => (role === "super_admin" ? 0 : role === "manager" ? 1 : 2);
  const { enrolledAmong } = await import("@/lib/auth/second-factor");
  const withApp = await enrolledAmong(rows.map((row) => row.id));
  return rows
    .map((row) => ({
      id: row.id,
      name: [row.firstName, row.lastName].filter(Boolean).join(" "),
      email: row.email,
      role: row.role,
      active: row.status === "active",
      app: withApp.has(row.id),
    }))
    .sort((a, b) => rank(a.role) - rank(b.role));
}

/**
 * The one member this may change: staff or manager, never the owner, never
 * the person asking. Returns their email, for the link.
 */
async function changeable(userId: string, actorUserId: string): Promise<{ email: string } | null> {
  if (userId === actorUserId) return null;
  const [row] = await controlDb
    .select({ email: users.email })
    .from(users)
    .where(
      and(
        eq(users.id, userId),
        inArray(users.role, ["staff", "manager"]),
        ne(users.id, actorUserId),
        isNull(users.deletedAt),
      ),
    )
    .limit(1);
  return row ?? null;
}

export async function setBackOfficeRole(input: {
  userId: string;
  role: string;
  actorUserId: string;
}): Promise<{ ok?: true; error?: "ateam.errNotChangeable" }> {
  if (input.role !== "staff" && input.role !== "manager") return { error: "ateam.errNotChangeable" };
  if (!(await changeable(input.userId, input.actorUserId))) return { error: "ateam.errNotChangeable" };
  await controlDb
    .update(users)
    .set({ role: input.role, updatedAt: new Date() })
    .where(and(eq(users.id, input.userId), inArray(users.role, ["staff", "manager"])));
  return { ok: true };
}

/**
 * Take access away, or give it back. Deactivating ends every session at once:
 * `getActor` refuses a user who is not active, and the sessions are revoked
 * as well so nothing waits for a cookie to expire.
 */
export async function setBackOfficeActive(input: {
  userId: string;
  active: boolean;
  actorUserId: string;
}): Promise<{ ok?: true; error?: "ateam.errNotChangeable" }> {
  if (!(await changeable(input.userId, input.actorUserId))) return { error: "ateam.errNotChangeable" };
  await controlDb
    .update(users)
    .set({ status: input.active ? "active" : "suspended", updatedAt: new Date() })
    .where(and(eq(users.id, input.userId), inArray(users.role, ["staff", "manager"])));
  if (!input.active) {
    const { revokeAllSessionsForUser } = await import("@/lib/auth/session");
    await revokeAllSessionsForUser(input.userId);
  }
  return { ok: true };
}

/** Active owners other than this one: none means a new owner is the second, and needs nobody else. */
export async function otherActiveOwners(actorUserId: string): Promise<number> {
  const rows = await controlDb
    .select({ id: users.id })
    .from(users)
    .where(
      and(
        eq(users.role, "super_admin"),
        eq(users.status, "active"),
        ne(users.id, actorUserId),
        isNull(users.deletedAt),
      ),
    )
    .limit(10);
  return rows.length;
}

/** A member whose password the owner may send a link for. */
export async function linkableMember(userId: string, actorUserId: string) {
  return changeable(userId, actorUserId);
}
