import "server-only";

import { and, desc, eq, isNull, sql } from "drizzle-orm";

import { audit } from "@/lib/audit";
import { controlDb } from "@/lib/db";
import {
  ehrConnections,
  ehrLaunches,
  ehrWritebacks,
  users,
  type EhrVendor,
} from "@/lib/db/schema";
import { decryptSecret, encryptSecret, secretsConfigured } from "@/lib/crypto/secretbox";
import { log, ref } from "@/lib/logger";
import { discover, refresh } from "@/lib/ehr/smart";

/**
 * Everything that CHANGES an EHR connection. PLAN.md 43.1, 43.1b, 43.4, C266.
 *
 * Separate from `lib/ehr/*`, which is the protocol: those files talk to a hospital and hold no
 * database handle (`fhir.ts` deliberately has none at all, which is 43.4's third rule made
 * structural). This file is the one place a connection is created, refreshed or torn down.
 */

/**
 * 🔴 C266 / 43.1b — THE CONNECTION IS THE ORGANISATION'S, so this takes an organisation id and
 * there is no argument for a user.
 *
 * 43.1c is "same flow, two homes": a clinic manager reaches it from the clinic portal and a solo
 * clinician from settings, and both arrive here with the id of the organisation that will own the
 * credential. A solo therapist is an organisation of one (C259), so there is no second case.
 */
export async function beginConnection(input: {
  organizationId: string;
  vendor: EhrVendor;
  fhirBaseUrl: string;
}): Promise<{ authorizeUrl?: string; tokenUrl?: string; issuer?: string; error?: string }> {
  if (!secretsConfigured()) {
    /*
     * 🔴 Refused rather than stored in clear, the same as `registerWebhook` in sprint 55. A
     * connection whose refresh token is a plaintext column is worse than no connection.
     */
    return { error: "Token sealing is not configured on this deployment." };
  }

  const { config, error } = await discover(input.fhirBaseUrl);
  if (error || !config) return { error: error ?? "That server could not be read." };

  return { authorizeUrl: config.authorizeUrl, tokenUrl: config.tokenUrl, issuer: config.issuer };
}

/**
 * Store a completed connection.
 *
 * 🔴 IT REVOKES ANY EXISTING LIVE ONE FIRST, in the same call.
 *
 * `ehr_connections_live_unique` would refuse the insert otherwise, and the operator's intent when
 * they reconnect is always "replace", never "fail". Doing it here rather than letting the index
 * throw means the old row is stamped with a reason a year later rather than existing unexplained
 * beside a newer one.
 */
export async function completeConnection(input: {
  organizationId: string;
  vendor: EhrVendor;
  fhirBaseUrl: string;
  issuer: string;
  accessToken: string;
  refreshToken: string | null;
  expiresAt: Date | null;
  scopes: string[];
  tenantLabel: string | null;
}): Promise<{ connectionId?: string; error?: string }> {
  await revokeConnectionsFor(input.organizationId, input.vendor, "reconnected");

  const [created] = await controlDb
    .insert(ehrConnections)
    .values({
      organizationId: input.organizationId,
      vendor: input.vendor,
      fhirBaseUrl: input.fhirBaseUrl.replace(/\/+$/, ""),
      issuer: input.issuer,
      accessTokenSealed: encryptSecret(input.accessToken),
      refreshTokenSealed: input.refreshToken ? encryptSecret(input.refreshToken) : null,
      expiresAt: input.expiresAt,
      scopes: input.scopes,
      tenantLabel: input.tenantLabel,
    })
    .returning({ id: ehrConnections.id });

  if (!created) return { error: "That connection could not be saved." };

  log.info("ehr connected", { org: ref(input.organizationId), vendor: input.vendor });
  return { connectionId: created.id };
}

/**
 * 🔴 43.1b / 43.4 — REVOKE, AND SEVER EVERY LINK UNDER IT. THIS IS THE SPRINT'S SHARPEST FUNCTION.
 *
 * Three writes, and the ORDER is the whole of it:
 *
 *   1. The launches are severed first: `fhir_patient_id` and `fhir_encounter_id` set to null,
 *      `severed_at` stamped.
 *   2. Then the connection is stamped revoked and both sealed tokens are cleared.
 *
 * ## 🔴 WHY THAT ORDER AND NOT THE OTHER ONE
 *
 * The same instinct sprint 54's `removeClinician` applied and the founder endorsed: **fail toward
 * the state that leaks nothing.** If this crashes between the two writes, severing first leaves a
 * connection that still works and no foreign identifiers — useless but harmless. Revoking first
 * would leave a dead credential and a full set of a hospital's patient identifiers still resolvable
 * in our database, which is the state 43.4's second clock exists to forbid.
 *
 * ## 🔴 AND IT DELETES NO CLINICAL RECORD, DELIBERATELY
 *
 * `ehr_launches.patient_id` is left alone. The sessions, notes, transcripts and assessments stay
 * exactly where they are, because 43.4's first clock is that what we produced answers to the
 * PATIENT and §7 says they can claim it and leave, including leaving the institution. Deleting on
 * a hospital's disconnection would make a patient's own record disposable by their employer's IT
 * department, which is C234 one layer up.
 *
 * What is left afterwards is an orphan: our record of a person, with a name and a history, and no
 * link to the hospital. That reads like a bug the first time somebody meets it and it is the
 * correct outcome.
 */
export async function revokeConnectionsFor(
  organizationId: string,
  vendor: EhrVendor | null,
  reason: string,
  /**
   * 🔴 W1-22: the one connection a person chose to disconnect. Still scoped to
   * the organisation, so an id from a form cannot reach another practice's row.
   */
  connectionId?: string,
): Promise<{ revoked: number; severed: number }> {
  const live = await controlDb
    .select({ id: ehrConnections.id })
    .from(ehrConnections)
    .where(
      and(
        eq(ehrConnections.organizationId, organizationId),
        isNull(ehrConnections.revokedAt),
        ...(vendor ? [eq(ehrConnections.vendor, vendor)] : []),
        ...(connectionId !== undefined ? [eq(ehrConnections.id, connectionId)] : []),
      ),
    );

  if (live.length === 0) return { revoked: 0, severed: 0 };

  let severed = 0;

  for (const connection of live) {
    /* 🔴 FIRST. See the header: fail toward the state that leaks nothing. */
    const cut = await controlDb
      .update(ehrLaunches)
      .set({ fhirPatientId: null, fhirEncounterId: null, severedAt: new Date() })
      .where(and(eq(ehrLaunches.connectionId, connection.id), isNull(ehrLaunches.severedAt)))
      .returning({ id: ehrLaunches.id });

    severed += cut.length;

    /* 🔴 THEN. And the credential is cleared, which `ehr_connections_revoked_holds_no_secret`
       also requires, so a revoke that forgot would be refused by the database. */
    await controlDb
      .update(ehrConnections)
      .set({
        revokedAt: new Date(),
        revokedReason: reason,
        accessTokenSealed: null,
        refreshTokenSealed: null,
        expiresAt: null,
        updatedAt: new Date(),
      })
      .where(eq(ehrConnections.id, connection.id));
  }

  await audit({
    actor: null,
    category: "admin",
    action: "ehr.revoked",
    resourceType: "organization",
    resourceId: organizationId,
    reason: `${reason}; ${live.length} connection(s), ${severed} launch(es) severed`,
  });

  log.info("ehr connections revoked", { org: ref(organizationId), revoked: live.length, severed });
  return { revoked: live.length, severed };
}

/**
 * The live connection for an organisation, with its access token unsealed and refreshed if stale.
 *
 * 🔴 Returns the token only to the caller that needs it for one request, and never selects the
 * sealed columns onto anything that reaches a screen. `connectionsFor` below is the screen's
 * version and it has no token in its select list at all.
 */
export async function liveConnection(
  organizationId: string,
): Promise<{ connectionId: string; fhirBaseUrl: string; accessToken: string } | null> {
  const [row] = await controlDb
    .select({
      id: ehrConnections.id,
      fhirBaseUrl: ehrConnections.fhirBaseUrl,
      accessTokenSealed: ehrConnections.accessTokenSealed,
      refreshTokenSealed: ehrConnections.refreshTokenSealed,
      expiresAt: ehrConnections.expiresAt,
    })
    .from(ehrConnections)
    .where(
      and(eq(ehrConnections.organizationId, organizationId), isNull(ehrConnections.revokedAt)),
    )
    .limit(1);

  if (!row?.accessTokenSealed) return null;

  /* Sixty seconds of headroom, because a token that expires mid-request is a failed filing. */
  const stale = row.expiresAt !== null && row.expiresAt.getTime() < Date.now() + 60_000;

  if (!stale) {
    return {
      connectionId: row.id,
      fhirBaseUrl: row.fhirBaseUrl,
      accessToken: decryptSecret(row.accessTokenSealed),
    };
  }

  if (!row.refreshTokenSealed) {
    /*
     * Expired with nothing to refresh from. Revoked rather than left looking live, because a
     * connection listed as connected that cannot make a request is the screen that lies.
     */
    await revokeConnectionsFor(organizationId, null, "the access token expired and there is no refresh token");
    return null;
  }

  const { config } = await discover(row.fhirBaseUrl);
  if (!config) return null;

  const { grant, error } = await refresh({
    tokenUrl: config.tokenUrl,
    refreshToken: decryptSecret(row.refreshTokenSealed),
  });

  if (error || !grant) {
    await revokeConnectionsFor(organizationId, null, error ?? "the refresh was refused");
    return null;
  }

  await controlDb
    .update(ehrConnections)
    .set({
      accessTokenSealed: encryptSecret(grant.accessToken),
      refreshTokenSealed: grant.refreshToken ? encryptSecret(grant.refreshToken) : row.refreshTokenSealed,
      expiresAt: grant.expiresAt,
      updatedAt: new Date(),
    })
    .where(eq(ehrConnections.id, row.id));

  return { connectionId: row.id, fhirBaseUrl: row.fhirBaseUrl, accessToken: grant.accessToken };
}

/**
 * 🔴 What a SCREEN sees. No token column, sealed or otherwise, in the select list.
 *
 * The sponsor and clinic walls taught this: the select list IS the wall, and an absence enforced
 * by remembering not to render something is an absence one careless spread operator away from
 * being a leak.
 */
export async function connectionsFor(organizationId: string) {
  return controlDb
    .select({
      id: ehrConnections.id,
      vendor: ehrConnections.vendor,
      fhirBaseUrl: ehrConnections.fhirBaseUrl,
      tenantLabel: ehrConnections.tenantLabel,
      scopes: ehrConnections.scopes,
      connectedAt: ehrConnections.connectedAt,
      /* 🔴 67.4 — the indicator reads THIS. See the column's own comment. */
      lastSuccessAt: ehrConnections.lastSuccessAt,
      lastError: ehrConnections.lastError,
      revokedAt: ehrConnections.revokedAt,
      revokedReason: ehrConnections.revokedReason,
    })
    .from(ehrConnections)
    .where(eq(ehrConnections.organizationId, organizationId))
    .orderBy(desc(ehrConnections.connectedAt));
}

/** 43.1 — record a launch. The mapping, and nothing of theirs but the id. */
export async function recordLaunch(input: {
  connectionId: string;
  userId: string;
  fhirPatientId: string | null;
  fhirEncounterId: string | null;
}): Promise<{ launchId: string } | { error: string }> {
  const [created] = await controlDb
    .insert(ehrLaunches)
    .values({
      connectionId: input.connectionId,
      userId: input.userId,
      fhirPatientId: input.fhirPatientId,
      fhirEncounterId: input.fhirEncounterId,
    })
    .returning({ id: ehrLaunches.id });

  if (!created) return { error: "That launch could not be recorded." };
  return { launchId: created.id };
}

/**
 * 🔴 Have we seen this hospital's patient before? Scoped to the CONNECTION.
 *
 * This is the identity-collision problem `lib/integrations/registry.ts` has called unsolved since
 * sprint 28: *two clinics will both send us a patient called P123, and treating either as ours is
 * how one person's note reaches another person's chart.* The answer is that a foreign id is only
 * ever resolved within the connection that issued it, so `P123` at one hospital and `P123` at
 * another are two rows that cannot reach each other.
 *
 * Severed launches are excluded, so a disconnected hospital's identifiers resolve to nothing.
 */
export async function patientForFhirId(
  connectionId: string,
  fhirPatientId: string,
): Promise<string | null> {
  const [row] = await controlDb
    .select({ patientId: ehrLaunches.patientId })
    .from(ehrLaunches)
    .where(
      and(
        eq(ehrLaunches.connectionId, connectionId),
        eq(ehrLaunches.fhirPatientId, fhirPatientId),
        isNull(ehrLaunches.severedAt),
        sql`${ehrLaunches.patientId} IS NOT NULL`,
      ),
    )
    .limit(1);

  return row?.patientId ?? null;
}

/** Tie a launch to one of our patients, once the clinician has confirmed the match. */
export async function linkLaunchToPatient(launchId: string, patientId: string): Promise<void> {
  await controlDb
    .update(ehrLaunches)
    .set({ patientId })
    .where(and(eq(ehrLaunches.id, launchId), isNull(ehrLaunches.severedAt)));
}

/** 43.3 — the filing log, for the screen that answers "did the note land". */
export async function writebacksFor(organizationId: string, limit = 100) {
  return controlDb
    .select({
      id: ehrWritebacks.id,
      noteId: ehrWritebacks.noteId,
      state: ehrWritebacks.state,
      fhirDocumentReferenceId: ehrWritebacks.fhirDocumentReferenceId,
      lastError: ehrWritebacks.lastError,
      /* 🔴 67.5 — the status their server returned, and whose note it was. */
      responseStatus: ehrWritebacks.responseStatus,
      approvedByFirstName: users.firstName,
      approvedByLastName: users.lastName,
      attempts: ehrWritebacks.attempts,
      filedAt: ehrWritebacks.filedAt,
      createdAt: ehrWritebacks.createdAt,
    })
    .from(ehrWritebacks)
    .innerJoin(ehrConnections, eq(ehrConnections.id, ehrWritebacks.connectionId))
    /*
     * 🔴 A LEFT JOIN, because a filing whose clinician has left the practice must
     * still appear in the log. `approved_by_user_id` is ON DELETE SET NULL, and a
     * filing that vanished when somebody left would take a failed one with it.
     */
    .leftJoin(users, eq(users.id, ehrWritebacks.approvedByUserId))
    .where(eq(ehrConnections.organizationId, organizationId))
    .orderBy(desc(ehrWritebacks.createdAt))
    .limit(limit);
}

/**
 * 🔴 67.4 — A CALL TO THEIR SERVER SUCCEEDED, OR IT DID NOT.
 *
 * Stamped by whatever actually talks to the FHIR server, so the indicator on the
 * practice's page means a token that works rather than a URL we stored.
 *
 * 🔴 THE ERROR IS CLEARED ON SUCCESS AND SET ON FAILURE, in one function, because two
 * functions is how a connection ends up green with last week's error beside it.
 */
export async function recordConnectionResult(input: {
  connectionId: string;
  ok: boolean;
  error?: string | null;
}): Promise<void> {
  await controlDb
    .update(ehrConnections)
    .set(
      input.ok
        ? { lastSuccessAt: new Date(), lastError: null }
        : { lastError: (input.error ?? "That call failed.").slice(0, 500) },
    )
    .where(eq(ehrConnections.id, input.connectionId));
}

/**
 * 🔴 67.7 — WHAT STOPS FILING IF THEY DISCONNECT, as a number, before they do.
 *
 * A practice pressing disconnect is deciding something about every clinician on the
 * account, and "12 clinicians file notes through this" is the fact that decides it.
 * Without the count the button reads as undoing a setting.
 */
export async function filersOn(organizationId: string): Promise<number> {
  const [row] = await controlDb
    .select({ n: sql<number>`count(distinct ${ehrWritebacks.approvedByUserId})::int` })
    .from(ehrWritebacks)
    .innerJoin(ehrConnections, eq(ehrConnections.id, ehrWritebacks.connectionId))
    .where(
      and(
        eq(ehrConnections.organizationId, organizationId),
        isNull(ehrConnections.revokedAt),
      ),
    );

  return Number(row?.n ?? 0);
}

/**
 * 🔴 67.1 — IS THIS ORGANISATION A CLINIC?
 *
 * A records connection binds an ORGANISATION to a hospital system: the registration
 * is the practice's, the token is the practice's, and a clinician who leaves loses it
 * because it was never theirs (C266). That only makes sense for an organisation that
 * outlives one person.
 *
 * Here rather than read off a plan tier, because the question is about the shape of
 * the account rather than about what they pay: a clinic on a lapsed subscription
 * still has three clinicians whose notes belong in one hospital chart.
 */
export async function isClinicOrganization(organizationId: string): Promise<boolean> {
  const { organizations } = await import("@/lib/db/schema");

  const [row] = await controlDb
    .select({ kind: organizations.kind })
    .from(organizations)
    .where(eq(organizations.id, organizationId))
    .limit(1);

  return row?.kind === "clinic";
}
