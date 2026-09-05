import "server-only";

import { and, desc, eq, isNull, sql } from "drizzle-orm";

import { audit, auditPhi } from "@/lib/audit";
import type { Actor } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { ensurePersonForPatient } from "@/lib/data/people";
import { patients, sessionNotes, sessions, type PatientClinical } from "@/lib/db/schema";

function scope(actor: Actor) {
  const base = and(
    eq(patients.organizationId, actor.organizationId),
    isNull(patients.deletedAt),
  );
  // A clinician sees their own caseload. The old app showed every therapist in
  // an org every patient in that org, which is more access than the job needs.
  return actor.role === "super_admin"
    ? base
    : and(base, eq(patients.therapistId, actor.userId));
}

export async function listPatients(actor: Actor) {
  return db
    .select({
      id: patients.id,
      firstName: patients.firstName,
      lastName: patients.lastName,
      email: patients.email,
      lastSessionAt: patients.lastSessionAt,
      source: patients.source,
      /*
       * `${patients}."id"`, not `${patients.id}`.
       *
       * This select reads from one table, and Drizzle only prefixes column
       * names with their table when a join forces it — so it emitted the
       * correlated reference bare, as `"patient_id" = "id"`, and Postgres bound
       * `id` to the innermost scope that had one: `sessions`. The subquery
       * counted the sessions whose patient_id equals their own id, which is
       * none of them, and every clinician's caseload showed zero sessions
       * against patients they had just seen.
       *
       * Nothing errored. The same mistake in `lib/data/admin.ts` did error,
       * because there the subquery had two inner tables carrying an `id` and
       * Postgres could not choose — which is the only reason it was ever found.
       */
      sessionCount: sql<number>`(
        SELECT count(*)::int FROM ${sessions} s
        WHERE s.patient_id = ${patients}."id"
          AND s.status = 'completed'
      )`,
    })
    .from(patients)
    .where(scope(actor))
    .orderBy(desc(patients.lastSessionAt), desc(patients.createdAt))
    .limit(200);
}

export async function getPatient(actor: Actor, patientId: string) {
  const [patient] = await db
    .select()
    .from(patients)
    .where(and(scope(actor), eq(patients.id, patientId)))
    .limit(1);

  if (!patient) return null;

  await auditPhi(actor, "patient.read", {
    resourceType: "patient",
    resourceId: patientId,
    patientId,
  });

  return patient;
}

export async function getPatientHistory(actor: Actor, patientId: string) {
  const [owned] = await db
    .select({ id: patients.id })
    .from(patients)
    .where(and(scope(actor), eq(patients.id, patientId)))
    .limit(1);
  if (!owned) return [];

  return db
    .select({
      id: sessions.id,
      status: sessions.status,
      modality: sessions.modality,
      endedAt: sessions.endedAt,
      createdAt: sessions.createdAt,
      durationMinutes: sessions.durationMinutes,
      noteStatus: sessions.noteStatus,
      noteSummary: sessionNotes.content,
    })
    .from(sessions)
    .leftJoin(sessionNotes, eq(sessionNotes.sessionId, sessions.id))
    .where(eq(sessions.patientId, patientId))
    .orderBy(desc(sessions.createdAt))
    .limit(50);
}

export async function createPatient(
  actor: Actor,
  input: { firstName: string; lastName?: string; email?: string; phone?: string },
) {
  const [created] = await db
    .insert(patients)
    .values({
      organizationId: actor.organizationId,
      therapistId: actor.userId,
      firstName: input.firstName.trim(),
      lastName: input.lastName?.trim() || null,
      email: input.email?.trim().toLowerCase() || null,
      phone: input.phone?.trim() || null,
      source: "therapist",
    })
    .returning();

  /*
   * Every patient gets a person (5.1).
   *
   * Its own person, even where the email matches an existing one — the same
   * rule as the backfill, for the same reason: an address is not an identity.
   * Linking two records is a decision a human makes later, on a suggestion.
   *
   * Best-effort rather than transactional. A patient without a person is a row
   * `ensurePersonForPatient` will fix on the next read; a failed patient
   * creation is a clinician who cannot start a session.
   */
  if (created) await ensurePersonForPatient(created.id);

  await auditPhi(actor, "patient.create", {
    resourceType: "patient",
    resourceId: created!.id,
    patientId: created!.id,
  });

  return created!;
}

/**
 * Thrown when a consent state forbids a write. PLAN.md 7.7.
 *
 * Named so an action can turn it into a message rather than a 500, and so it
 * cannot be confused with a validation error — this one means "you may not",
 * not "that was malformed".
 */
export class AccessRefusedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AccessRefusedError";
  }
}

export async function updatePatient(
  actor: Actor,
  patientId: string,
  input: {
    firstName?: string;
    lastName?: string | null;
    email?: string | null;
    phone?: string | null;
    clinical?: PatientClinical;
  },
) {
  // Explicit allowlist rather than spreading the request body. The old code
  // wrote whatever it was handed, and once put the string "3-5 years" into an
  // integer column — which aborted the whole UPDATE, so onboarding and settings
  // silently saved nothing at all.
  const patch: Record<string, unknown> = { updatedAt: new Date() };
  if (input.firstName !== undefined) patch.firstName = input.firstName.trim();
  if (input.lastName !== undefined) patch.lastName = input.lastName?.trim() || null;
  if (input.email !== undefined) patch.email = input.email?.trim().toLowerCase() || null;
  if (input.phone !== undefined) patch.phone = input.phone?.trim() || null;

  if (input.clinical !== undefined) {
    /*
     * 7.7 — "no diagnosis changes" in the revoked state, enforced here.
     *
     * In the data layer rather than in the form, because a server action that
     * exists can be called: hiding the field would leave the capability
     * intact. `capabilities.diagnosisChanges` is false only for a claimed
     * person who has not granted this clinician access, and for a stranger.
     *
     * The refusal throws rather than silently dropping the field. A clinician
     * whose diagnosis quietly failed to save is a clinician treating on a
     * record they believe says something it does not.
     */
    const { accessFor } = await import("./grants");
    const access = await accessFor(actor, patientId);
    if (!access.capabilities.diagnosisChanges) {
      throw new AccessRefusedError(
        "This person has not granted you access to their profile, so their diagnosis cannot be changed from here. Your own notes and sessions are unaffected.",
      );
    }
    patch.clinical = input.clinical;
  }

  await db
    .update(patients)
    .set(patch)
    .where(and(scope(actor), eq(patients.id, patientId)));

  await auditPhi(actor, "patient.update", {
    resourceType: "patient",
    resourceId: patientId,
    patientId,
  });
}

/** Soft delete. Sessions are ON DELETE RESTRICT, so the chart is never orphaned. */
/*
 * `deletePatient` used to live here. It is gone, not disabled.
 *
 * A therapy record is a legal document with a retention period measured in
 * years, and a clinician deleting a chart after a complaint has destroyed
 * evidence whether or not they intended to. An unused soft-delete helper is a
 * loaded gun in the drawer: the next person to need "remove this row" finds it
 * and wires it to a button. Erasure requests go through an operator, who can
 * weigh the retention law that applies.
 */

export async function findPatientByEmail(actor: Actor, email: string) {
  const [row] = await db
    .select({ id: patients.id, firstName: patients.firstName, lastName: patients.lastName })
    .from(patients)
    .where(and(scope(actor), eq(patients.email, email.trim().toLowerCase())))
    .limit(1);
  return row ?? null;
}
