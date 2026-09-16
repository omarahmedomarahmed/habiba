/**
 * 🔴 76.24 — ONE SUPER ADMIN, ON ONE DATABASE, AND NOTHING ELSE.
 *
 *   SEED_ADMIN_EMAIL=… SEED_ADMIN_PASSWORD=… npm run grant:admin
 *
 * ## Why this is not `settings:seed` and not `scripts/seed.ts`
 *
 * `seed.ts` can already make a super admin, and it makes a demo organisation, a
 * therapist, a patient, sessions and content on the way past. That is right for
 * a branch and wrong for production, where the whole point is to add a person
 * who can sign in and change a setting, and to add NOTHING else.
 *
 * A script that does one thing is also a script somebody can read before
 * pointing it at a live database, which is the only kind worth running there.
 *
 * ## 🔴 WHAT IT WILL NOT DO
 *
 *   * It will not invent a password. The caller supplies one and it is checked
 *     against the product's own `validatePassword`, so an account created here
 *     cannot hold a password the sign-in form would reject.
 *   * It will not create an organisation. A super admin is an operator rather
 *     than a practice, and on production there is already one to attach to; if
 *     there is not, that is a fact somebody should see rather than a row this
 *     should invent.
 *   * It will not silently demote or re-password somebody by accident: it says
 *     which of the two it did, and the email it did it to.
 *
 * ## It is allowed to touch production, on purpose
 *
 * `hostOf` names the database and does not refuse it. An operator account is
 * the one thing a live system needs before anybody can operate it, and the
 * alternative is editing a password hash into a table by hand.
 */
import { and, eq, isNull } from "drizzle-orm";

import { hashPassword, validatePassword } from "../lib/auth/password";
import { connect, schema } from "./db";
import { hostOf } from "./_verify";

const { users, organizations } = schema;

async function main() {
  const email = (process.env.SEED_ADMIN_EMAIL ?? "").trim().toLowerCase();
  const password = process.env.SEED_ADMIN_PASSWORD ?? "";

  if (!email || !password) {
    console.error("Set SEED_ADMIN_EMAIL and SEED_ADMIN_PASSWORD.");
    process.exit(1);
  }

  const problem = validatePassword(password);
  if (problem) {
    console.error(`SEED_ADMIN_PASSWORD rejected: ${problem}`);
    process.exit(1);
  }

  console.log(`granting super admin on ${hostOf()}\n`);

  const { db, pool } = connect();

  try {
    /*
     * 🔴 THE ORGANISATION THAT IS ALREADY THERE, never one invented here.
     *
     * A super admin's `organizationId` is a foreign key rather than a
     * statement about who they work for: `isCleared` exempts the role, and
     * every admin screen is scoped by role and not by practice. Attaching to
     * the oldest row is the least surprising answer and it is printed, so a
     * database with an unexpected first organisation shows up in the output.
     */
    const [org] = await db
      .select({ id: organizations.id, name: organizations.name })
      .from(organizations)
      .orderBy(organizations.createdAt)
      .limit(1);

    if (!org) {
      console.error(
        "There is no organisation on this database to attach an operator to.\n" +
          "That is worth understanding before creating one: run `npm run settings:check` first.",
      );
      process.exit(1);
    }

    const passwordHash = await hashPassword(password);

    const [existing] = await db
      .select({ id: users.id, role: users.role })
      .from(users)
      .where(and(eq(users.email, email), isNull(users.deletedAt)))
      .limit(1);

    if (existing) {
      await db
        .update(users)
        .set({ passwordHash, role: "super_admin", status: "active", updatedAt: new Date() })
        .where(eq(users.id, existing.id));
      console.log(`updated an existing account: ${email} was ${existing.role}, is now super_admin`);
    } else {
      await db.insert(users).values({
        organizationId: org.id,
        email,
        passwordHash,
        firstName: process.env.SEED_ADMIN_FIRST || "Super",
        lastName: process.env.SEED_ADMIN_LAST || "Admin",
        role: "super_admin",
        /*
         * 🔴 C285 — derived by 0083's trigger from `therapist_verifications`,
         * and harmless here: `isCleared` exempts a super admin BY ROLE, so an
         * operator is not locked out of the product they operate for never
         * having submitted a licence they do not have.
         */
        verificationStatus: "unverified",
      });
      console.log(`created: ${email} as super_admin on "${org.name}"`);
    }

    console.log("\nSign in at /staff/sign-in. Change the password from the account screen.");
  } finally {
    await pool.end();
  }
}

main();
