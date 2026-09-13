import "server-only";

import { redirect } from "next/navigation";

import { SPONSOR_SIGN_IN } from "@/lib/routing";
import { getSponsorActor, type SponsorActor } from "./session";

/**
 * The sponsor authorization boundary. PLAN.md 53.4, C230.
 *
 * Mirrors `requirePatient`, and the same rule applies for the same reason:
 * middleware runs on the edge with no database, so it can see that a cookie
 * exists and nothing else. Every sponsor page and action calls this.
 *
 * ## 🔴 It returns a `SponsorActor`, and that type cannot become an `Actor`
 *
 * No `organizationId`, no clinical `Role`. So there is no call site anywhere
 * that could pass the result of this function to `getPatient`, `listPatients`,
 * `getSession` or anything else that scopes on clinical tenancy — not because a
 * guard refuses, but because the shape does not fit and the compiler says so.
 *
 * That is the seam C230 and C259 both rest on, and it is why sponsor auth is a
 * separate module rather than a role.
 */
export async function requireSponsor(): Promise<SponsorActor> {
  const actor = await getSponsorActor();
  if (!actor) redirect(SPONSOR_SIGN_IN);
  return actor;
}

/**
 * 🔴 Only an admin may remove somebody from the roster (C234).
 *
 * A viewer reads the roster and the reporting. Ending a person's funding is the
 * sponsor's only individual-level power in the entire product, so it is the one
 * thing that needs a second role — and an HR analyst with read access to spend
 * figures should not also be able to end somebody's therapy funding by
 * accident.
 */
export async function requireSponsorAdmin(): Promise<SponsorActor> {
  const actor = await requireSponsor();
  if (actor.role !== "admin") redirect("/sponsor");
  return actor;
}
