/**
 * Break glass: clear a back office member's authenticator app, for the case
 * the console cannot cover (review fix, DD-2 B2.3). An owner resets another
 * member's app from Team, but never their own, so a sole super_admin who lost
 * the phone and the recovery codes had no way back in.
 *
 *     npm run factor:reset -- owner@example.com --dry
 *     CONFIRM_PRODUCTION=<host> npm run on:production -- factor:reset -- owner@example.com \
 *       --i-understand-this-deletes-production-data
 *
 * It deletes that member's app, recovery codes and emailed codes, makes every
 * live session of theirs owe the second step again (which, with no app, means
 * enrolling a new one after an emailed code), and writes an audit row naming
 * the operator's machine user. Back office members only; nothing else moves.
 */
import { and, eq, inArray, isNull, sql } from "drizzle-orm";

import { BACK_OFFICE_ROLES } from "../lib/db/schema";
import { connect, schema } from "./db";
import { writesTo } from "./_verify";

const { auditLog, authSessions, staffEmailCodes, staffRecoveryCodes, staffSecondFactors, users } = schema;

const DRY = process.argv.includes("--dry");
const [email] = process.argv.slice(2).filter((a) => !a.startsWith("--"));

async function main() {
  if (!email || !email.includes("@")) {
    console.error("Usage: npm run factor:reset -- <back office email> [--dry]");
    process.exit(1);
  }
  writesTo({ productionIsAllowed: true });
  const { pool, db } = connect();
  try {
    const [member] = await db
      .select({ id: users.id, role: users.role, organizationId: users.organizationId })
      .from(users)
      .where(
        and(
          sql`lower(${users.email}) = ${email.trim().toLowerCase()}`,
          inArray(users.role, [...BACK_OFFICE_ROLES]),
          isNull(users.deletedAt),
        ),
      )
      .limit(1);
    if (!member) {
      console.error("No back office member has that email. Nothing changed.");
      process.exit(1);
    }
    console.log(`member ${member.id} (${member.role})${DRY ? ": dry run, nothing is written" : ""}`);
    if (DRY) return;

    await db.transaction(async (tx) => {
      await tx.delete(staffSecondFactors).where(eq(staffSecondFactors.userId, member.id));
      await tx.delete(staffRecoveryCodes).where(eq(staffRecoveryCodes.userId, member.id));
      await tx.delete(staffEmailCodes).where(eq(staffEmailCodes.userId, member.id));
      await tx
        .update(authSessions)
        .set({ secondFactorAt: null })
        .where(and(eq(authSessions.userId, member.id), isNull(authSessions.revokedAt)));
      await tx.insert(auditLog).values({
        organizationId: member.organizationId,
        actorUserId: null,
        category: "admin",
        action: "second_factor.reset",
        resourceType: "user",
        resourceId: member.id,
        reason: "break glass: scripts/reset-second-factor.ts",
      });
    });
    console.log("cleared. Their next sign-in enrols a new app after an emailed code.");
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
