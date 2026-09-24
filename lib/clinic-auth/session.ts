import "server-only";

import { createHash, randomBytes } from "node:crypto";

import { cookies, headers } from "next/headers";
import { and, eq, gt, isNull } from "drizzle-orm";

import { controlDb } from "@/lib/db";
import {
  clinicAuthSessions,
  clinicManagers,
  clinicRoles,
  clinicStaffAssignments,
  organizations,
  users,
} from "@/lib/db/schema";
import { env } from "@/lib/env";
import { CLINIC_COOKIE } from "@/lib/routing";
import type { ClinicRole, ClinicState } from "@/lib/db/schema";
import type { Region } from "@/lib/db/region";
import { resolveViewerZone, type Zone } from "@/lib/scheduling/tz";
import {
  ADMIN_CAPABILITIES,
  parseCapabilities,
  type ClinicCapability,
} from "./capabilities";

/**
 * The clinic manager's session. PLAN.md 54.2, §3f, C259, C264.
 *
 * ## 🔴 A CLINIC MANAGER IS NOT AN `Actor`, AND THIS IS THE HARDER CASE
 *
 * A sponsor could not reach a chart if it tried: `SponsorActor` has no
 * `organizationId` at all, so it does not fit anywhere an `Actor` is expected and
 * the compiler says so. That is the strongest possible seam and it was free.
 *
 * A clinic manager is the opposite situation. C259 says a clinic IS an
 * `organizations` row, so this principal MUST carry an organisation id, and that id
 * is the key every clinical query in the product scopes on. The seam cannot be the
 * shape of the id, because the id is the real thing.
 *
 * So three separate defences, in descending strength:
 *
 *   1. **The property is spelled `clinicOrganizationId`.** Not `organizationId`.
 *      `getPatient(clinicActor)` does not compile, and reaching for the id means
 *      writing a rename into a diff instead of accepting an autocomplete. This is
 *      the weakest of the three and it is the one that catches the honest mistake.
 *   2. **There is no `Role` and no `userId`.** Nothing on this type can be passed to
 *      `requireRole`, `auditPhi` or anything else that expects a clinician, so the
 *      compiler refuses the whole family of calls rather than one of them.
 *   3. **`lib/data/clinic.ts` is the only module a clinic surface reads from**, and
 *      every select list in it is named rather than spread. A verifier runs as this
 *      principal against RENDERED OUTPUT (54.9), because C243's lesson is that a
 *      leak is an absence as often as it is a value and a query-level check passes
 *      against it.
 *
 * ## 🔴 A HELD, SUSPENDED OR CLOSED CLINIC HAS NO PORTAL
 *
 * In the WHERE clause, like the sponsor's, so there is no branch anybody can forget.
 * And note what it does NOT do: suspending a clinic closes the portal and touches no
 * session, no clinician and no patient. A commercial dispute with a practice must
 * never reach somebody in a room.
 */

const IDLE_MS = 30 * 60 * 1000;
const ABSOLUTE_MS = 8 * 60 * 60 * 1000;

export type ClinicActor = {
  clinicManagerId: string;
  /**
   * 🔴 NOT `organizationId`. See defence 1 above.
   *
   * It is the same uuid with the same power, spelled so that using it requires
   * saying so. A clinic manager's whole relationship to the clinical boundary is
   * that they are inside the tenancy and must see none of it.
   */
  clinicOrganizationId: string;
  /** What the practice is called, for their own header. */
  clinicName: string;
  /** 🔴 `ClinicRole`, never `Role`. Admin or viewer, and neither is ours. */
  role: ClinicRole;
  email: string;
  /**
   * 🔴 63.4 / 63.5 / C325 / C353 — WHAT THIS PRINCIPAL MAY DO, resolved once.
   *
   * Built by `capabilitiesFor` from the closed vocabulary in
   * `lib/clinic-auth/capabilities.ts`, so a string that is not a capability
   * cannot be in here and asking about one returns false rather than matching.
   *
   * It is on the ACTOR rather than fetched per check because a permission read
   * that can fail open under load is not a permission. One query, at the same
   * moment the session is resolved, from the same row.
   */
  capabilities: ClinicCapability[];
  /**
   * 🔴 63.4 / C325 — the clinicians this principal may see under a scoped
   * capability, or `null` meaning ALL OF THEM.
   *
   * Null is the clinic admin, and it is null rather than a list of everybody
   * because a list would go stale the moment a clinician joined. An empty ARRAY
   * is a staff member with no assignments and means nothing, which is the safe
   * direction for an empty list to point and the opposite of what null means:
   * the two are distinguished on purpose and every consumer must handle both.
   */
  therapistIds: string[] | null;
  /**
   * 🔴 63.2 / C352 — the clinician account that is the same human, if there is
   * one. The switcher in the header renders only when this is set.
   */
  linkedUserId: string | null;
  /**
   * 🔴 T8: THE ZONE EVERY TIME ON THIS PORTAL IS READ IN, resolved once.
   *
   * The reader's own zone where there is one, which for a manager is the
   * `users.timezone` of the clinician account that is the same human
   * (`linkedUserId`); then the default for the practice's country (Cairo for
   * `eg`); then UTC. `source` says which, and the screen names the zone, so a
   * fallback is never silent.
   *
   * There is no zone column on a practice and this does not want one: a zone
   * is where the READER is, and the week a manager plans is their own.
   */
  zone: Zone;
};

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export async function createClinicSession(clinicManagerId: string): Promise<string> {
  const token = randomBytes(32).toString("base64url");
  const hdrs = await headers();

  await controlDb.insert(clinicAuthSessions).values({
    clinicManagerId,
    tokenHash: hashToken(token),
    absoluteExpiresAt: new Date(Date.now() + ABSOLUTE_MS),
    userAgent: hdrs.get("user-agent")?.slice(0, 300) ?? null,
  });

  const store = await cookies();
  store.set(CLINIC_COOKIE, token, {
    httpOnly: true,
    secure: env.isProduction,
    sameSite: "lax",
    path: "/",
    maxAge: Math.floor(ABSOLUTE_MS / 1000),
  });

  return token;
}

/**
 * Resolve the cookie, or null. Every condition in the WHERE clause.
 *
 * 🔴 Including `kind = 'clinic'`. A manager row whose organisation was somehow
 * turned back into a solo practice signs nobody in, rather than signing them into a
 * clinician's own tenancy with a manager's principal. The database constraint makes
 * that state unreachable; this makes it harmless if it ever becomes reachable.
 */
export async function getClinicActor(): Promise<ClinicActor | null> {
  const store = await cookies();
  const token = store.get(CLINIC_COOKIE)?.value;
  if (!token) return null;

  const now = new Date();

  const [row] = await controlDb
    .select({
      clinicManagerId: clinicManagers.id,
      clinicOrganizationId: organizations.id,
      clinicName: organizations.name,
      role: clinicManagers.role,
      email: clinicManagers.email,
      linkedUserId: clinicManagers.linkedUserId,
      /* 🔴 T8: where the reader is, and failing that, where the practice is. */
      linkedTimezone: users.timezone,
      region: organizations.region,
      /* 🔴 63.3 — the custom role's stored strings, which mean nothing yet. */
      roleCapabilities: clinicRoles.capabilities,
      roleDeletedAt: clinicRoles.deletedAt,
    })
    .from(clinicAuthSessions)
    .innerJoin(clinicManagers, eq(clinicManagers.id, clinicAuthSessions.clinicManagerId))
    .innerJoin(organizations, eq(organizations.id, clinicManagers.organizationId))
    .leftJoin(clinicRoles, eq(clinicRoles.id, clinicManagers.roleId))
    /*
     * A left join, and a zone is the only thing read through it: the linked
     * clinician is the same human, and nothing about their caseload is in reach
     * of this select list.
     */
    .leftJoin(users, and(eq(users.id, clinicManagers.linkedUserId), isNull(users.deletedAt)))
    .where(
      and(
        eq(clinicAuthSessions.tokenHash, hashToken(token)),
        isNull(clinicAuthSessions.revokedAt),
        isNull(clinicManagers.deletedAt),
        isNull(organizations.deletedAt),
        gt(clinicAuthSessions.absoluteExpiresAt, now),
        gt(clinicAuthSessions.lastSeenAt, new Date(now.getTime() - IDLE_MS)),
        eq(organizations.kind, "clinic"),
        eq(organizations.clinicState, "active" as ClinicState),
      ),
    )
    .limit(1);

  if (!row) return null;

  await controlDb
    .update(clinicAuthSessions)
    .set({ lastSeenAt: now })
    .where(eq(clinicAuthSessions.tokenHash, hashToken(token)));

  /*
   * 🔴 63.4 / 63.5 / C353 — THE CAPABILITIES, AND THE ADMIN IS NOT A ROLE LOOKUP.
   *
   * An admin holds everything, derived from the vocabulary rather than stored,
   * so there is no row anybody can edit to take the practice's own owner out of
   * their account and none to edit to put somebody else in.
   *
   * Below that: a custom role's strings, filtered through the closed list. A
   * DELETED role grants nothing, checked here rather than in the join, because a
   * left join that also filtered would have produced a null row and silently
   * turned a staff member into a viewer with no capabilities instead of a person
   * whose role was withdrawn. Both end at the same place today; only one of them
   * says why.
   */
  const capabilities: ClinicCapability[] =
    row.role === "admin"
      ? [...ADMIN_CAPABILITIES]
      : row.roleDeletedAt
        ? []
        : parseCapabilities(row.roleCapabilities);

  /*
   * 🔴 63.4 / C325 — NULL IS THE ADMIN AND AN EMPTY ARRAY IS NOBODY.
   *
   * The assignment query runs only for a non-admin, because an admin is not
   * scoped and a list of every clinician would go stale the moment one joined.
   */
  const therapistIds =
    row.role === "admin"
      ? null
      : (
          await controlDb
            .select({ userId: clinicStaffAssignments.userId })
            .from(clinicStaffAssignments)
            .where(eq(clinicStaffAssignments.clinicManagerId, row.clinicManagerId))
        ).map((assignment) => assignment.userId);

  return {
    clinicManagerId: row.clinicManagerId,
    clinicOrganizationId: row.clinicOrganizationId,
    clinicName: row.clinicName,
    role: row.role,
    email: row.email,
    capabilities,
    therapistIds,
    linkedUserId: row.linkedUserId,
    zone: clinicZone({ timezone: row.linkedTimezone, region: row.region }),
  };
}

/**
 * 🔴 T8: the reader's zone, then the practice country's, then UTC.
 *
 * Exported and pure so a verifier can ask it about a Cairo practice whose
 * manager set nothing, without a cookie or a database.
 */
export function clinicZone(input: { timezone: string | null; region: Region }): Zone {
  return resolveViewerZone(input.timezone, input.region);
}

export async function revokeClinicSession(): Promise<void> {
  const store = await cookies();
  const token = store.get(CLINIC_COOKIE)?.value;
  if (token) {
    await controlDb
      .update(clinicAuthSessions)
      .set({ revokedAt: new Date() })
      .where(eq(clinicAuthSessions.tokenHash, hashToken(token)));
  }
  store.delete(CLINIC_COOKIE);
}
