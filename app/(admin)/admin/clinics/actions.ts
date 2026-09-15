"use server";

import { revalidatePath } from "next/cache";

import { audit } from "@/lib/audit";
import { requireRole } from "@/lib/auth/guard";
import { createClinicManager, setClinicRegion, setClinicState } from "@/lib/data/clinic-admin";
import { isRegion } from "@/lib/db/region";
import { CLINIC_STATES, type ClinicState } from "@/lib/db/schema";

export type AdminClinicState = { error?: string; ok?: boolean };

/**
 * Admin's side of a practice. PLAN.md 54.3, C259, C267.
 *
 * 🔴 `requireRole("super_admin")`, all of it. Activating a clinic opens an organisation
 * that will hold clinical records, which is a strictly larger act than activating a
 * sponsor: a sponsor's tenancy contains nothing, and this one contains charts.
 *
 * 🔴 AND THERE IS NO ACTION HERE THAT VERIFIES A CLINICIAN EITHER. C267 says the
 * clinic's word is not evidence; it does not say ours is. Verification runs through
 * `/admin/verifications` against a document a clinician submitted, which is the one path
 * that exists and the one C106's invariant is written against.
 */
export async function setState(
  clinicOrganizationId: string,
  state: string,
): Promise<AdminClinicState> {
  const actor = await requireRole("super_admin");

  if (!CLINIC_STATES.includes(state as ClinicState)) return { error: "Not a state." };

  const result = await setClinicState(clinicOrganizationId, state as ClinicState);
  if (result.error) return { error: result.error };

  await audit({
    actor,
    category: "admin",
    action: `clinic.${state}`,
    resourceType: "organization",
    resourceId: clinicOrganizationId,
  });

  revalidatePath("/admin/clinics");
  return { ok: true };
}

/**
 * 🔴 74.6 — WHERE THE PRACTICE BILLS FROM.
 *
 * A solo clinician answers this on their own settings page: it is their
 * practice. A clinic's is an operator's, because it decides which of our
 * companies invoices a roster of colleagues and it is answered from a
 * registration document rather than from a dropdown somebody guessed at.
 */
export async function setRegion(
  clinicOrganizationId: string,
  region: string,
): Promise<AdminClinicState> {
  const actor = await requireRole("super_admin");

  if (!isRegion(region)) return { error: "Not a region." };

  const result = await setClinicRegion(clinicOrganizationId, region);
  if (result.error) return { error: result.error };

  await audit({
    actor,
    category: "admin",
    action: "clinic.region",
    resourceType: "organization",
    resourceId: clinicOrganizationId,
    reason: `Billed from the ${region} entity`,
  });

  revalidatePath("/admin/clinics");
  return { ok: true };
}

/** 54.3 — the first manager, with a password an operator sets on the call. */
export async function addManager(
  _prev: AdminClinicState,
  formData: FormData,
): Promise<AdminClinicState> {
  const actor = await requireRole("super_admin");

  const clinicOrganizationId = String(formData.get("clinicOrganizationId") ?? "");
  const role = String(formData.get("role") ?? "viewer");

  const result = await createClinicManager({
    clinicOrganizationId,
    email: String(formData.get("email") ?? ""),
    name: String(formData.get("name") ?? "") || null,
    password: String(formData.get("password") ?? ""),
    role: role === "admin" ? "admin" : "viewer",
  });

  if (result.error) return { error: result.error };

  await audit({
    actor,
    category: "admin",
    action: "clinic.manager_created",
    resourceType: "organization",
    resourceId: clinicOrganizationId,
  });

  revalidatePath("/admin/clinics");
  return { ok: true };
}
