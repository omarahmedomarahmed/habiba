"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireUser } from "@/lib/auth/guard";
import { issueInvite, revokeInvite } from "@/lib/data/claims";
import { createPatient, getPatient, updatePatient } from "@/lib/data/patients";
import { ensurePersonForPatient } from "@/lib/data/people";
import { env } from "@/lib/env";

export type PatientActionState = { error?: string; ok?: boolean };

export async function addPatient(
  _prev: PatientActionState,
  formData: FormData,
): Promise<PatientActionState> {
  const actor = await requireUser();

  const firstName = String(formData.get("firstName") ?? "").trim();
  if (!firstName) return { error: "A first name is the only thing we need." };

  const patient = await createPatient(actor, {
    firstName,
    lastName: String(formData.get("lastName") ?? "").trim() || undefined,
    email: String(formData.get("email") ?? "").trim() || undefined,
    phone: String(formData.get("phone") ?? "").trim() || undefined,
  });

  revalidatePath("/patients");
  redirect(`/patients/${patient.id}`);
}

export async function savePatient(
  patientId: string,
  input: {
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
    diagnoses: string[];
    goals: string[];
  },
): Promise<PatientActionState> {
  const actor = await requireUser();
  if (!input.firstName.trim()) return { error: "A first name is required." };

  await updatePatient(actor, patientId, {
    firstName: input.firstName,
    lastName: input.lastName || null,
    email: input.email || null,
    phone: input.phone || null,
    clinical: {
      diagnoses: input.diagnoses.filter(Boolean),
      goals: input.goals.filter(Boolean),
    },
  });

  revalidatePath(`/patients/${patientId}`);
  return { ok: true };
}

/*
 * A clinician cannot send a patient's record anywhere, and that is the point.
 *
 * There was a button here that emailed a patient their full chart. It only
 * ever sent to the address on file, which made it safe enough — but "a
 * clinician can cause clinical text to leave the practice" is a capability,
 * and this product now has exactly one of those: an administrator acting on a
 * patient's own request, from the admin console, audited, with the clinician
 * notified. See `emailPatientRecordToPatient` in the admin actions.
 *
 * What a patient gets automatically is their brief, which they pull themselves
 * by rating the session. That path can only ever send `patientBrief`.
 */

/*
 * There is deliberately no way for a clinician to delete a patient or a
 * session, and this is not an oversight.
 *
 * A therapy record is a legal document. Retention periods run to years — six
 * in most US states, longer for minors — and a clinician who deletes a chart
 * after a complaint has destroyed evidence, whether or not they meant to. The
 * old `deletePatient` is gone from this file rather than merely hidden from the
 * UI: a server action that exists can be called, and the only reliable way to
 * refuse a capability is not to ship it.
 *
 * What a clinician *can* do is correct a record (`savePatient`), cancel a
 * session before it completes, and reset their own copilot conversation. What
 * a patient can do is ask for their data, which an operator exports. Genuine
 * erasure requests go through us, deliberately, because they need a decision
 * about retention law that a product surface cannot make.
 */

/* ----------------------------------------------- 6.10: handing a record over -- */

/**
 * Issue an invite link for this patient's person record.
 *
 * Tenancy is enforced by `getPatient(actor, …)` — a clinician can only hand
 * over a record they can already read. Everything after that is on the person
 * rather than the patient row, because the record being handed over is the
 * identity, not one clinic's file on it.
 *
 * The token comes back exactly once. We show it, and we never store it, so a
 * clinician who loses the link revokes and issues another rather than asking
 * us to look it up.
 */
export async function createInviteLink(
  patientId: string,
): Promise<{ url: string; expiresAt: string } | { error: string }> {
  const actor = await requireUser();

  const patient = await getPatient(actor, patientId);
  if (!patient) return { error: "That patient is not in your practice." };

  const personId = await ensurePersonForPatient(patientId);
  if (!personId) return { error: "That patient no longer exists." };

  const issued = await issueInvite({ personId, issuedByUserId: actor.userId });
  if ("error" in issued) return issued;

  revalidatePath(`/patients/${patientId}`);
  return {
    url: `${env.appUrl}/patient/invite/${issued.token}`,
    expiresAt: issued.expiresAt.toISOString(),
  };
}

/**
 * Take a link back.
 *
 * `revokeInvite` is scoped to the issuing clinician, so this cannot revoke
 * somebody else's invite even with a guessed id.
 */
export async function cancelInviteLink(
  patientId: string,
  inviteId: string,
): Promise<PatientActionState> {
  const actor = await requireUser();

  const patient = await getPatient(actor, patientId);
  if (!patient) return { error: "That patient is not in your practice." };

  const revoked = await revokeInvite(inviteId, actor.userId);
  if (!revoked) return { error: "That link was already used or cancelled." };

  revalidatePath(`/patients/${patientId}`);
  return { ok: true };
}
