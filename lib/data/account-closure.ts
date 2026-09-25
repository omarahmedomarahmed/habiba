import "server-only";

import { and, eq, isNull } from "drizzle-orm";

import { audit } from "@/lib/audit";
import { controlDb as db } from "@/lib/db";
import { historyGrants, patientAccounts } from "@/lib/db/schema";
import { log, ref } from "@/lib/logger";

/**
 * 🔴 K24 — A PATIENT CLOSES THEIR ACCOUNT.
 *
 * There was no way to. What closing does, and deliberately does not do:
 *
 *   - The LOGIN goes: `deleted_at` is set (every sign-in, reset and code path
 *     already reads only live accounts), the email is released so the address
 *     can sign up again, the password is cleared, and every session everywhere
 *     is revoked. The phone stays on the row only because the table requires
 *     one (`patient_accounts_phone_present`); a closed row is invisible to every
 *     lookup, so it holds nobody's number against a fresh signup.
 *   - Every clinician they let read their history loses it: live grants are
 *     revoked through `revokeGrant` (audited, and the partner is told), and an
 *     unanswered request is declined, since nobody is left to answer it.
 *   - Check-ins stop, because a closed account is not a candidate.
 *   - 🔴 The CLINICAL RECORD stays. Notes, sessions and the files clinicians
 *     keep are their clinical record, which they are obliged to hold, and the
 *     screen says so in plain words before anybody presses the button. The
 *     `people` row is never deleted (5.1).
 *
 * Idempotent: closing a closed account does nothing and says so.
 */
export async function closePatientAccount(input: {
  accountId: string;
  personId: string;
}): Promise<{ ok: true; grantsWithdrawn: number } | { ok: false; error: string }> {
  const now = new Date();

  const [closed] = await db
    .update(patientAccounts)
    .set({
      deletedAt: now,
      email: null,
      emailVerifiedAt: null,
      passwordHash: null,
      updatedAt: now,
    })
    .where(and(eq(patientAccounts.id, input.accountId), isNull(patientAccounts.deletedAt)))
    .returning({ id: patientAccounts.id });
  if (!closed) return { ok: false, error: "This account is already closed." };

  const { revokeAllPatientSessions } = await import("@/lib/patient-auth/session");
  await revokeAllPatientSessions(input.accountId);

  const live = await db
    .select({ id: historyGrants.id })
    .from(historyGrants)
    .where(and(eq(historyGrants.personId, input.personId), eq(historyGrants.status, "granted")));
  const { revokeGrant } = await import("@/lib/data/grants");
  let grantsWithdrawn = 0;
  for (const grant of live) {
    const result = await revokeGrant({
      accountId: input.accountId,
      personId: input.personId,
      grantId: grant.id,
    });
    if (result.ok) grantsWithdrawn += 1;
  }
  await db
    .update(historyGrants)
    .set({ status: "rejected", decidedAt: now, updatedAt: now })
    .where(and(eq(historyGrants.personId, input.personId), eq(historyGrants.status, "pending")));

  await audit({
    patientAccountId: input.accountId,
    actor: null,
    category: "phi_access",
    action: "account.close",
    resourceType: "person",
    resourceId: input.personId,
    reason: `closed by the patient; ${grantsWithdrawn} history grant(s) withdrawn; clinical record kept`,
  });

  log.info("patient account closed", { person: ref(input.personId), grantsWithdrawn });
  return { ok: true, grantsWithdrawn };
}
