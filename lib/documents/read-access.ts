import "server-only";

import { and, eq, isNull } from "drizzle-orm";

import type { Actor } from "@/lib/auth/session";
import { dbFor} from "@/lib/db";
import { pinnedToDefaultRegion } from "@/lib/db/region";
import { patients } from "@/lib/db/schema";
import type { PatientActor } from "@/lib/patient-auth/session";

/*
 * ⚠️ 30.1 — NOT ROUTED YET, and counted rather than hidden.
 *
 * `pinnedToDefaultRegion` returns the default region and registers this
 * module so `verify:sprint30` can print it. The alternative, `dbFor("us")`
 * with a comment, compiles and is indistinguishable from a decision, which
 * is the "seam by convention" this sprint exists to prevent.
 */
const db = dbFor(pinnedToDefaultRegion("lib/documents/read-access.ts", "not routed yet: this call site has no entity in hand, so 30.x threads one"));


/**
 * May this person read this document, right now? PLAN.md 8.10.
 *
 * One implementation, used by both the bytes route and the read-aloud route.
 * Two copies of a consent check is two chances for them to disagree, and the
 * one that disagrees in the permissive direction is the one nobody notices.
 */
export type ReadDecision =
  | { allowed: false }
  | {
      allowed: true;
      actor: { userId: string; organizationId: string } | null;
      patientAccountId: string | null;
    };

export async function documentReadDecision(input: {
  personId: string;
  uploadedByUserId: string | null;
  actor: Actor | null;
  patient: PatientActor | null;
}): Promise<ReadDecision> {
  /*
   * The patient first. A person reading their own documents needs no grant —
   * that is what "the record is theirs" means, and it is the whole point of
   * sprints 5 to 8.
   */
  if (input.patient) {
    if (input.patient.personId !== input.personId) return { allowed: false };
    return { allowed: true, actor: null, patientAccountId: input.patient.accountId };
  }

  const user = input.actor;
  if (!user) return { allowed: false };

  /*
   * A clinician reaches a person through a patient row they hold, scoped like
   * every other clinical read. No row means no relationship, and §3 gives that
   * state nothing.
   */
  const [row] = await db
    .select({ id: patients.id })
    .from(patients)
    .where(
      and(
        eq(patients.personId, input.personId),
        eq(patients.organizationId, user.organizationId),
        user.role === "super_admin" ? undefined : eq(patients.therapistId, user.userId),
        isNull(patients.deletedAt),
      ),
    )
    .limit(1);

  if (!row) return { allowed: false };

  const actor = { userId: user.userId, organizationId: user.organizationId };

  /*
   * §3's exception: a revoked clinician keeps "docs they uploaded". That is a
   * fact about one document rather than about the relationship, which is why
   * it lives here and not in `capabilities`.
   */
  if (input.uploadedByUserId === user.userId) {
    return { allowed: true, actor, patientAccountId: null };
  }

  const { accessFor } = await import("@/lib/data/grants");
  const access = await accessFor(user, row.id);
  if (!access.capabilities.patientFiles) return { allowed: false };

  return { allowed: true, actor, patientAccountId: null };
}
