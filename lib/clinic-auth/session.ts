import "server-only";

import { createHash, randomBytes } from "node:crypto";

import { cookies, headers } from "next/headers";
import { and, eq, gt, isNull } from "drizzle-orm";

import { controlDb } from "@/lib/db";
import { clinicAuthSessions, clinicManagers, organizations } from "@/lib/db/schema";
import { env } from "@/lib/env";
import { CLINIC_COOKIE } from "@/lib/routing";
import type { ClinicRole, ClinicState } from "@/lib/db/schema";

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
    })
    .from(clinicAuthSessions)
    .innerJoin(clinicManagers, eq(clinicManagers.id, clinicAuthSessions.clinicManagerId))
    .innerJoin(organizations, eq(organizations.id, clinicManagers.organizationId))
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

  return row;
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
