import "server-only";

import { and, eq, isNull } from "drizzle-orm";

import { audit } from "@/lib/audit";
import { controlDb } from "@/lib/db";
import { clinicManagers, users } from "@/lib/db/schema";
import { log } from "@/lib/logger";

/**
 * 🔴 63.2 / C352 — SWITCHING PRINCIPAL, WHICH IS THE WHOLE OF THE RULING.
 *
 * > *One human with two principals in one session is how a clinical grant reaches a
 * > management screen. A therapist who upgrades is a clinician AND the clinic admin.
 * > Two principal rows, linked, and the session cookie names which is ACTIVE.
 * > Switching is explicit and audited. Never one session carrying both capability
 * > sets.*
 *
 * ## 🔴 SEPARATE COOKIES ARE THE PROBLEM, NOT THE SOLUTION
 *
 * The clinician and the clinic manager already have different cookies, which looks
 * like the ruling is satisfied and is exactly backwards: different cookies mean BOTH
 * can be live in one browser at one moment. A therapist who is also the practice's
 * admin would hold a clinical grant and a management grant together, and the only
 * thing separating them would be which tab is in front.
 *
 * So a switch is a HANDOVER: the side being left is revoked before the side being
 * entered is minted. Both functions below do the revoke first and the mint second,
 * and the order is the ruling rather than a preference:
 *
 *   - crash between the two → signed out of both, which is an inconvenience;
 *   - the other order → signed into both, which is the thing forbidden.
 *
 * ## 🔴 AND IT IS AUDITED, because "explicit" without a record is a habit
 *
 * The audit row names which principal was left and which was entered. A person who
 * changed hats and then read something is a sequence somebody has to be able to
 * reconstruct, and "they had both grants all afternoon" is precisely what this
 * prevents being true.
 */

/**
 * From the clinic principal to the clinician one.
 *
 * Returns the linked `users` row id, having ended every clinic session this manager
 * holds. The caller mints the clinician session, because minting one is the auth
 * module's job and a function here that set a cookie would be a function here that
 * could sign somebody in.
 */
export async function leaveClinicPrincipal(clinicManagerId: string): Promise<{
  userId?: string;
  error?: string;
}> {
  const [row] = await controlDb
    .select({
      linkedUserId: clinicManagers.linkedUserId,
      organizationId: clinicManagers.organizationId,
    })
    .from(clinicManagers)
    .where(and(eq(clinicManagers.id, clinicManagerId), isNull(clinicManagers.deletedAt)))
    .limit(1);

  if (!row?.linkedUserId) return { error: "There is no clinician account linked to this one." };

  /*
   * 🔴 And the clinician row must still be live and still be theirs. A link to a
   * deleted user, or to one who has left the practice, signs nobody in: the column
   * is `ON DELETE SET NULL` so this is belt and braces, and belt and braces is the
   * right amount for the function that hands somebody a clinical grant.
   */
  const [clinician] = await controlDb
    .select({ id: users.id })
    .from(users)
    .where(and(eq(users.id, row.linkedUserId), isNull(users.deletedAt)))
    .limit(1);

  if (!clinician) return { error: "That clinician account is no longer here." };

  /* 🔴 REVOKE FIRST. See the order argument above. */
  const { revokeClinicSessionsFor } = await import("@/lib/data/clinic-team");
  const ended = await revokeClinicSessionsFor(clinicManagerId);

  await audit({
    actor: null,
    clinicManagerId,
    category: "auth",
    action: "principal.switch",
    resourceType: "user",
    resourceId: clinician.id,
    reason: `left the clinic principal for the clinician one, ${ended} session(s) ended`,
  });

  log.info("principal switched, clinic to clinician");
  return { userId: clinician.id };
}

/**
 * The other direction, and the asymmetry is deliberate.
 *
 * A clinician switching INTO the management principal must be the linked human, and
 * the link is read from the manager row rather than from anything the caller passes:
 * a function that took a `clinicManagerId` from a form would be a function that signs
 * somebody into whichever practice they name.
 */
export async function enterClinicPrincipal(userId: string): Promise<{
  clinicManagerId?: string;
  error?: string;
}> {
  const [manager] = await controlDb
    .select({ id: clinicManagers.id })
    .from(clinicManagers)
    .where(and(eq(clinicManagers.linkedUserId, userId), isNull(clinicManagers.deletedAt)))
    .limit(1);

  if (!manager) return { error: "There is no practice account linked to yours." };

  /*
   * 🔴 THE CLINICIAN'S OWN SESSIONS ARE REVOKED BY THE CALLER, before this returns
   * into a clinic sign-in. It is done there rather than here because the clinician's
   * session table is the main auth module's and this file is the clinic's; reaching
   * across would put two owners on one table.
   *
   * The audit row is written here anyway, so the record of the switch exists on the
   * same path in both directions rather than in two places with two shapes.
   */
  await audit({
    actor: null,
    clinicManagerId: manager.id,
    category: "auth",
    action: "principal.switch",
    resourceType: "user",
    resourceId: userId,
    reason: "left the clinician principal for the clinic one",
  });

  log.info("principal switched, clinician to clinic");
  return { clinicManagerId: manager.id };
}
