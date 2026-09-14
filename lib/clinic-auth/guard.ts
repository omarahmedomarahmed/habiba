import "server-only";

import { redirect } from "next/navigation";

import { CLINIC_SIGN_IN } from "@/lib/routing";
import { can, NEVER_DELEGABLE, THERAPIST_SCOPED, type ClinicCapability } from "./capabilities";
import { getClinicActor, type ClinicActor } from "./session";

/**
 * The clinic authorization boundary. PLAN.md 54.2, 54.9, 63.4 to 63.7, §3f, C259,
 * C325, C353.
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
 *
 * ## 🔴 C325 — AND A GUARD IN A PAGE IS STILL NOT THE PERMISSION
 *
 * Everything below redirects, which is what a PAGE needs. The permission itself is
 * `refuseWithout` and `scopeToAssigned` in `lib/data/clinic.ts`, checked on the
 * resource inside the query. A route guard that let somebody through to a function
 * that trusted them would be the navigation filter C325 names as the classic hole.
 */
export async function requireClinic(): Promise<ClinicActor> {
  const actor = await getClinicActor();
  if (!actor) redirect(CLINIC_SIGN_IN);
  return actor;
}

/**
 * 🔴 63.7 — ONLY THE CLINIC ADMIN BUYS A SEAT OR INVITES A CLINICIAN.
 *
 * *Money and membership are never delegable.* Inviting somebody commits the practice
 * to paying for that clinician's sessions (54.7); removing one ends a caseload's
 * clinic connection immediately (54.11, C266); buying a seat is a bill. None of the
 * three is a thing a practice manager's assistant should reach by mis-tapping, and
 * none can be put into a custom role: `roleProblem` refuses it at write time and a
 * database CHECK refuses it underneath that.
 */
export async function requireClinicAdmin(): Promise<ClinicActor> {
  const actor = await requireClinic();
  if (actor.role !== "admin") redirect("/clinic");
  return actor;
}

/**
 * 🔴 63.4 / C325 — A PAGE THAT NEEDS A CAPABILITY ASKS FOR IT BY NAME.
 *
 * Redirects rather than throws, because the caller is a screen and the honest
 * outcome for somebody who followed a link they cannot use is the overview rather
 * than a stack trace.
 *
 * 🔴 THE TWO UNDELEGATABLE CAPABILITIES ARE REFUSED HERE TO NON-ADMINS regardless
 * of what a role says, which is deliberate belt and braces: `roleProblem` cannot
 * store them and the database will not hold them, and if both of those were ever
 * got around, this still refuses. Three locks on one rule is the right number for
 * the rule that decides who can spend a practice's money.
 */
export async function requireClinicCapability(
  capability: ClinicCapability,
): Promise<ClinicActor> {
  const actor = await requireClinic();

  if (NEVER_DELEGABLE.includes(capability) && actor.role !== "admin") redirect("/clinic");
  if (!can(actor.capabilities, capability)) redirect("/clinic");

  return actor;
}

/**
 * 🔴 63.4 / C325 — WHICH CLINICIANS THIS PRINCIPAL MAY SEE, for a scoped read.
 *
 * > *Assistant 1 assigned to therapist A is refused therapist B's calendar on the
 * > same route.*
 *
 * Returns null for a principal that is not scoped, which is the clinic admin, and
 * an array otherwise. An empty array means nobody, and every caller must treat it
 * as nobody rather than as "no filter": that confusion IS the hole, and it is why
 * this returns `string[] | null` rather than `string[]` with an empty default.
 *
 * Exported and pure so a verifier can call it as every role without a browser.
 */
export function assignedTherapists(
  actor: Pick<ClinicActor, "role" | "therapistIds">,
  capability: ClinicCapability,
): string[] | null {
  if (actor.role === "admin") return null;
  if (!THERAPIST_SCOPED.includes(capability)) return null;
  return actor.therapistIds ?? [];
}
