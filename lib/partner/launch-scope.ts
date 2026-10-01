import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";

import { and, eq, inArray, isNull } from "drizzle-orm";

import { controlDb } from "@/lib/db";
import { partnerSubjects, patients } from "@/lib/db/schema";

/**
 * 🔴 F6: WHAT A SESSION A PARTNER OPENED MAY REACH.
 *
 * The first launch minted an ordinary one-hour clinician session: the whole
 * caseload, settings, payouts, everything, on a partner's call. Now a launched
 * session is restricted, and the restriction is a rule in one place that
 * `requireUser` applies on every page and action:
 *
 *   - FIFTEEN MINUTES, absolute (`LAUNCH_SESSION_MS`); launched again next time.
 *   - READ ONLY: no server action and no API route. A launch is for looking at a
 *     chart inside somebody else's workflow; writing goes through the partner
 *     API, where consent and scopes already govern it.
 *   - Only the landing page (`LAUNCH_LANDING`, the partner's patients of this
 *     clinician) and the chart of a patient whose person this partner's subject
 *     is LINKED to, by the patient's own act (`partner_subjects`). No dashboard,
 *     no other patient, no settings, no money.
 *
 * `getActor` returns null for such a session, so any surface that skips the
 * guard treats it as signed out rather than as a full clinician.
 */

export const LAUNCH_SESSION_MS = 15 * 60 * 1000;
export const LAUNCH_LANDING = "/partner-launch";

const UUID = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";
const PATIENT_PATH = new RegExp(`^/patients/(${UUID})(?:/[^?#]*)?$`, "i");

export type ScopedRoute = { kind: "landing" } | { kind: "patient"; patientId: string } | null;

/**
 * The signature middleware puts on `x-pathname` and `x-request-method`
 * (`scopeSignature` in `middleware.ts`, the same HMAC). `/api/` skips
 * middleware, so a caller there could send those headers itself; without a
 * valid signature the guard treats the request as an API call and refuses it.
 */
export function scopeSignatureFor(method: string, path: string, secret: string): string {
  return createHmac("sha256", `launch-scope:${secret}`).update(`${method} ${path}`).digest("base64url");
}

export function validScopeSignature(input: { method: string; path: string; signature: string | null; secret: string }): boolean {
  if (!input.signature) return false;
  const want = Buffer.from(scopeSignatureFor(input.method, input.path, input.secret));
  const got = Buffer.from(input.signature);
  return want.length === got.length && timingSafeEqual(want, got);
}

/** Pure: which in-scope route a path is, or null for everything else. */
export function scopedRoute(path: string): ScopedRoute {
  const clean =
    (path.split(/[?#]/)[0] ?? "").replace(/^\/(?:ar|en)(?=\/|$)/, "").replace(/\/+$/, "") || "/";
  if (clean === LAUNCH_LANDING) return { kind: "landing" };
  const match = PATIENT_PATH.exec(clean);
  return match ? { kind: "patient", patientId: match[1]!.toLowerCase() } : null;
}

/**
 * Pure: the decision, given what the request is. `patientInScope` is asked only
 * for a patient route (null otherwise).
 */
export function scopeVerdict(input: {
  path: string;
  isAction: boolean;
  isApi: boolean;
  patientInScope: boolean | null;
}): "admit" | "refuse" {
  if (input.isApi || input.isAction) return "refuse";
  const route = scopedRoute(input.path);
  if (!route) return "refuse";
  if (route.kind === "landing") return "admit";
  return input.patientInScope === true ? "admit" : "refuse";
}

/** The people this partner's subjects are linked to, by the patients' own act. */
async function linkedPeople(partnerId: string): Promise<string[]> {
  const rows = await controlDb
    .select({ personId: partnerSubjects.personId })
    .from(partnerSubjects)
    .where(and(eq(partnerSubjects.partnerId, partnerId), isNull(partnerSubjects.revokedAt)))
    .limit(5000);
  return rows.map((row) => row.personId).filter((id): id is string => Boolean(id));
}

/** Whether this chart is this clinician's AND its person is linked to this partner. */
export async function patientInLaunchScope(input: {
  partnerId: string;
  userId: string;
  patientId: string;
}): Promise<boolean> {
  const [row] = await controlDb
    .select({ personId: patients.personId })
    .from(patients)
    .where(and(eq(patients.id, input.patientId), eq(patients.therapistId, input.userId)))
    .limit(1);
  if (!row?.personId) return false;
  return (await linkedPeople(input.partnerId)).includes(row.personId);
}

/** The landing page's list: this clinician's patients who are this partner's, and nobody else. */
export async function launchScopePatients(input: {
  partnerId: string;
  userId: string;
}): Promise<{ id: string; name: string }[]> {
  const people = await linkedPeople(input.partnerId);
  if (people.length === 0) return [];
  const rows = await controlDb
    .select({ id: patients.id, firstName: patients.firstName, lastName: patients.lastName })
    .from(patients)
    .where(and(eq(patients.therapistId, input.userId), inArray(patients.personId, people)))
    .orderBy(patients.firstName)
    .limit(200);
  return rows.map((row) => ({ id: row.id, name: `${row.firstName} ${row.lastName ?? ""}`.trim() }));
}
