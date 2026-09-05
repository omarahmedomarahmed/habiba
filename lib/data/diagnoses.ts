import "server-only";

import { and, desc, eq, isNull } from "drizzle-orm";

import { audit } from "@/lib/audit";
import { db } from "@/lib/db";
import { contentFlags, personDiagnoses, personDocuments } from "@/lib/db/schema";

/**
 * Diagnoses on a person, and the human who has to confirm them. PLAN.md 8.9.
 *
 * The extraction lives in `lib/ai/diagnoses.ts`. This is the part that decides
 * what a screen may call a diagnosis — and the answer is: only a row a person
 * moved to `confirmed`. A `proposed` row is a note that a document mentions
 * something, and it is never rendered as though a clinician agreed with it.
 */

export type DiagnosisView = {
  id: string;
  label: string;
  code: string | null;
  sourceSentence: string;
  status: "proposed" | "confirmed" | "rejected";
  documentTitle: string | null;
  documentOrdinal: number | null;
  confirmedAt: Date | null;
  flags: { id: string; reason: string; note: string | null }[];
};

export async function listDiagnoses(personId: string): Promise<DiagnosisView[]> {
  const rows = await db
    .select({
      id: personDiagnoses.id,
      label: personDiagnoses.label,
      code: personDiagnoses.code,
      sourceSentence: personDiagnoses.sourceSentence,
      status: personDiagnoses.status,
      confirmedAt: personDiagnoses.confirmedAt,
      documentTitle: personDocuments.title,
      documentOrdinal: personDocuments.ordinal,
    })
    .from(personDiagnoses)
    .leftJoin(personDocuments, eq(personDocuments.id, personDiagnoses.sourceDocumentId))
    .where(eq(personDiagnoses.personId, personId))
    .orderBy(desc(personDiagnoses.createdAt));

  const flags = await db
    .select({
      id: contentFlags.id,
      targetId: contentFlags.targetId,
      reason: contentFlags.reason,
      note: contentFlags.note,
    })
    .from(contentFlags)
    .where(
      and(
        eq(contentFlags.personId, personId),
        eq(contentFlags.targetType, "diagnosis"),
        isNull(contentFlags.withdrawnAt),
      ),
    );

  return rows.map((row) => ({
    ...row,
    flags: flags.filter((f) => f.targetId === row.id),
  }));
}

/**
 * Confirm or reject a proposal.
 *
 * Conditional on `status = 'proposed'`, so a second press — or two clinicians
 * on the same patient — cannot re-decide something already decided. Whoever
 * arrives second is told it is done rather than silently overwriting the first.
 */
export async function confirmDiagnosis(input: {
  diagnosisId: string;
  personId: string;
  decision: "confirmed" | "rejected";
  userId: string;
}): Promise<boolean> {
  const now = new Date();

  const [updated] = await db
    .update(personDiagnoses)
    .set({
      status: input.decision,
      confirmedByUserId: input.userId,
      confirmedAt: now,
      updatedAt: now,
    })
    .where(
      and(
        eq(personDiagnoses.id, input.diagnosisId),
        eq(personDiagnoses.personId, input.personId),
        eq(personDiagnoses.status, "proposed"),
      ),
    )
    .returning({ id: personDiagnoses.id });

  if (!updated) return false;

  await audit({
    actor: { userId: input.userId, organizationId: "" },
    category: "clinical",
    action: `diagnosis.${input.decision}`,
    resourceType: "person_diagnosis",
    resourceId: updated.id,
  });

  return true;
}

/** Only confirmed diagnoses count as diagnoses — used by the copilot and 8.9. */
export async function confirmedDiagnoses(personId: string) {
  return db
    .select({
      label: personDiagnoses.label,
      code: personDiagnoses.code,
      sourceSentence: personDiagnoses.sourceSentence,
    })
    .from(personDiagnoses)
    .where(and(eq(personDiagnoses.personId, personId), eq(personDiagnoses.status, "confirmed")));
}
