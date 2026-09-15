import "server-only";

import { eq } from "drizzle-orm";

import { hashPassword, validatePassword } from "@/lib/auth/password";
import { controlDb } from "@/lib/db";
import { organizations, users } from "@/lib/db/schema";
import { log, ref } from "@/lib/logger";

/**
 * 🔴 THE 24/7 TEAM, WHO COULD NOT SIGN IN.
 *
 * `ROLES` has had `staff` and `manager` in it since sprint 20, five admin pages
 * are behind `requireStaff()` and `/admin/tv` is behind `requireManager()`. And
 * **nothing in the product could create an account with either role.** Grepping
 * the whole of `app/` for a write that sets one returned nothing: the seed makes
 * a `super_admin`, and `/staff/sign-in` only signs in accounts that already
 * exist.
 *
 * So the operating plan pays two support staff from month one to work a
 * payments queue they have no way to reach, and the only way anybody could work
 * it was by sharing the owner's login. A shared login is the end of the audit
 * trail: every confirmation, every rejection and every receipt opened is
 * attributed to one person who did not do it.
 *
 * ## The rules this deliberately keeps
 *
 * **A super_admin is not creatable here.** Elevating somebody to the role that
 * can create roles is a decision that should cost a database session, not a
 * form. `staff` and `manager` are the two this mints and the enum is closed.
 *
 * **They join OUR organisation**, found by slug rather than passed in, so a
 * back-office account cannot be created inside a customer's clinic by getting
 * one field wrong.
 *
 * **The password goes through `validatePassword`**, the same rule a clinician's
 * does. An operator setting a colleague's first password on a call is the one
 * moment a weak one is most tempting.
 */
export async function createBackOfficeUser(input: {
  email: string;
  firstName: string;
  lastName: string;
  password: string;
  role: "staff" | "manager";
}): Promise<{ ok?: true; error?: string }> {
  const email = input.email.trim().toLowerCase();
  if (!email.includes("@")) return { error: "That email address does not look right." };

  const weak = validatePassword(input.password);
  if (weak) return { error: weak };

  if (input.role !== "staff" && input.role !== "manager") {
    return { error: "A back office account is staff or manager. Nothing else is set here." };
  }

  const [org] = await controlDb
    .select({ id: organizations.id })
    .from(organizations)
    .where(eq(organizations.slug, "24therapy"))
    .limit(1);

  if (!org) return { error: "The platform organisation does not exist on this database." };

  try {
    await controlDb.insert(users).values({
      organizationId: org.id,
      email,
      passwordHash: await hashPassword(input.password),
      firstName: input.firstName.trim().slice(0, 80) || "Staff",
      lastName: input.lastName.trim().slice(0, 80) || "Member",
      role: input.role,
    });
  } catch {
    return { error: "There is already an account with that email address." };
  }

  log.info("back office account created", { email: ref(email), role: input.role });
  return { ok: true };
}
