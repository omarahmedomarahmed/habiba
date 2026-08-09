"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireUser } from "@/lib/auth/guard";
import { createPatient, deletePatient, updatePatient } from "@/lib/data/patients";

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

export async function removePatient(patientId: string): Promise<void> {
  const actor = await requireUser();
  await deletePatient(actor, patientId);
  revalidatePath("/patients");
  redirect("/patients");
}
