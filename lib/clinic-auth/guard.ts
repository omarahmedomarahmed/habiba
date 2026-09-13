import "server-only";

import { redirect } from "next/navigation";

import { CLINIC_SIGN_IN } from "@/lib/routing";
import { getClinicActor, type ClinicActor } from "./session";

/**
 * The clinic authorization boundary. PLAN.md 54.2, 54.9, §3f, C259.
 *
 * Mirrors `requireSponsor` and `requirePatient`, and the same rule holds for the same
 * reason: middleware runs on the edge with no database, so the most it can know is
 * that a cookie exists. Every clinic page and action calls this.
 *
 * ## 🔴 WHAT THIS FUNCTION CANNOT PRODUCE
 *
 * It returns a `ClinicActor`, which has no `userId`, no `Role` and no property
 * spelled `organizationId`. So there is no call site anywhere that could hand the
 * result to `requireRole`, `auditPhi`, `getPatient`, `listPatients`, `getSession` or
 * anything else clinical: the compiler refuses, not a guard.
 *
 * That is weaker than the sponsor's seam and it is as strong as C259 allows. A clinic
 * IS the organisation, so this principal is genuinely inside the tenancy; what keeps
 * it away from clinical content is the select lists in `lib/data/clinic.ts` and a
 * verifier that runs as this principal against rendered output (54.9).
 */
export async function requireClinic(): Promise<ClinicActor> {
  const actor = await getClinicActor();
  if (!actor) redirect(CLINIC_SIGN_IN);
  return actor;
}

/**
 * 🔴 Only an admin invites a clinician or removes one.
 *
 * A viewer reads schedules and bills. Inviting somebody commits the practice to
 * paying for that clinician's sessions (54.7), and removing one ends a caseload's
 * clinic connection immediately (54.11, C266) — neither is a thing a practice
 * manager's assistant should reach by mis-tapping.
 */
export async function requireClinicAdmin(): Promise<ClinicActor> {
  const actor = await requireClinic();
  if (actor.role !== "admin") redirect("/clinic");
  return actor;
}
