"use server";

import { redirect } from "next/navigation";

import { requireUser } from "@/lib/auth/guard";
import { enterClinicPrincipal } from "@/lib/clinic-auth/switch";

/**
 * 🔴 63.2 / C352 — THE SWITCH, FROM THE CLINICIAN'S SIDE.
 *
 * The mirror of `switchToClinician`, and the order is the same ruling read the other
 * way: every session of the principal being LEFT is revoked before the one being
 * entered is minted.
 *
 * > *Never one session carrying both capability sets.*
 *
 * Two separate cookies mean both principals can be live in one browser at one moment
 * unless something ends one of them. A crash between the two revokes leaves somebody
 * signed out of both, which is an inconvenience; the other order leaves a clinical
 * grant and a management grant live together, which is the thing forbidden.
 *
 * 🔴 THE PRACTICE IS NEVER NAMED BY THE CALLER. `enterClinicPrincipal` reads the link
 * from the manager row keyed on this user id, so there is no argument anybody could
 * pass that signs them into a practice they are not linked to.
 */
export async function switchToClinic(): Promise<void> {
  const actor = await requireUser();

  const result = await enterClinicPrincipal(actor.userId);
  if (result.error || !result.clinicManagerId) redirect("/settings");

  /* 🔴 REVOKE FIRST, and every session rather than this one: a switch that left a
     phone signed in as the clinician is the same defect at a distance. */
  const { revokeAllSessionsForUser } = await import("@/lib/auth/session");
  await revokeAllSessionsForUser(actor.userId);

  const { createClinicSession } = await import("@/lib/clinic-auth/session");
  await createClinicSession(result.clinicManagerId);

  redirect("/clinic");
}
