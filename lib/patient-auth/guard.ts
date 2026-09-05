import "server-only";

import { redirect } from "next/navigation";

import { getPatientActor, type PatientActor } from "./session";

/**
 * The patient-side authorization boundary.
 *
 * Mirrors `requireUser`, and the same rule applies for the same reason:
 * middleware runs on the edge with no database, so it can see that a cookie
 * exists and nothing else. Every patient page and action calls this.
 *
 * There is no `requireRole` equivalent, because a patient has no role. What
 * they may read is decided by which `person` they own and, from sprint 7, which
 * grants exist — never by a role and never by an organisation.
 */
export async function requirePatient(): Promise<PatientActor> {
  const actor = await getPatientActor();
  if (!actor) redirect("/patient/login");
  return actor;
}

/**
 * The patient, if there is one. For pages that render either way.
 *
 * Separate from `requirePatient` so that "may be signed in" is a deliberate
 * choice at each call site rather than a redirect somebody forgot.
 */
export async function optionalPatient(): Promise<PatientActor | null> {
  return getPatientActor();
}
