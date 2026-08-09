"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireUser } from "@/lib/auth/guard";
import { createPatient, updatePatient } from "@/lib/data/patients";

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
