"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { audit } from "@/lib/audit";
import { requireClinicAdmin } from "@/lib/clinic-auth/guard";
import { beginConnection, revokeConnectionsFor } from "@/lib/data/ehr";
import { putPending } from "@/lib/ehr/pending";
import { authorizeUrl, pkce } from "@/lib/ehr/smart";
import type { EhrVendor } from "@/lib/db/schema";

/**
 * 43.1c — the practice's home for the records connection.
 *
 * 🔴 `requireClinicAdmin` rather than `requireClinic`. Connecting a record system is the practice's
 * single largest integration decision and disconnecting it stops note filing for every clinician
 * under it, which is the same reasoning that put roster removal behind an admin in 53 (C234): a
 * viewer reading a screen should not be able to end something by accident.
 *
 * 🔴 `clinicOrganizationId`, which is the spelling sprint 54 chose so that reaching for it is a
 * rename in a diff rather than an autocomplete.
 */
export async function begin(_prev: { error?: string }, formData: FormData): Promise<{ error?: string }> {
  const actor = await requireClinicAdmin();

  const vendor = String(formData.get("vendor") ?? "epic") as EhrVendor;
  const fhirBaseUrl = String(formData.get("fhirBaseUrl") ?? "").trim();
  const pair = pkce();

  const result = await beginConnection({
    organizationId: actor.clinicOrganizationId,
    vendor,
    fhirBaseUrl,
  });

  if (result.error || !result.authorizeUrl || !result.tokenUrl || !result.issuer) {
    return { error: result.error ?? "That server could not be read." };
  }

  /*
   * 🔴 0086 — audited BEFORE the redirect, because `redirect` throws.
   *
   * Nothing after it runs, so an audit written below would never be written at
   * all. This records the attempt rather than the connection: the connection
   * itself is made in `/api/ehr/callback` and is the hospital's decision as
   * much as ours.
   */
  await audit({
    /* Explicit, like every other call site: this act has no clinician actor. */
    actor: null,
    clinicManagerId: actor.clinicManagerId,
    category: "admin",
    action: "records.connect_started",
    resourceType: "ehr_vendor",
    resourceId: vendor,
  });

  /*
   * 🔴 THE VERIFIER IS SEALED INTO A COOKIE AND THE BROWSER IS SENT TO THE HOSPITAL.
   *
   * `redirect` throws, so nothing below it runs and there is no `return` to reach. That is the
   * whole of the flow from here: the hospital asks the clinician to approve, then redirects to
   * `/api/ehr/callback`, which is the only place a token is exchanged or stored.
   */
  const state = await putPending({
    verifier: pair.verifier,
    vendor,
    fhirBaseUrl,
    tokenUrl: result.tokenUrl,
    issuer: result.issuer,
    organizationId: actor.clinicOrganizationId,
  });

  redirect(
    authorizeUrl({
      config: {
        authorizeUrl: result.authorizeUrl,
        tokenUrl: result.tokenUrl,
        issuer: result.issuer,
        supportedScopes: [],
      },
      fhirBaseUrl,
      state,
      challenge: pair.challenge,
    }),
  );
}

export async function disconnect(formData: FormData): Promise<void> {
  const actor = await requireClinicAdmin();

  /*
   * 🔴 W1-22 — the connection the admin chose, and only that one. This used to
   * ignore the posted id and revoke every live connection the practice had.
   * `revokeConnectionsFor` still pins the organisation, so a changed id reaches
   * nothing outside it; a malformed one reaches nothing at all.
   */
  const connectionId = String(formData.get("connectionId") ?? "");
  if (!UUID.test(connectionId)) return;

  const { revoked } = await revokeConnectionsFor(
    actor.clinicOrganizationId,
    null,
    "disconnected by the practice",
    connectionId,
  );
  if (revoked === 0) return;

  /*
   * 🔴 Disconnecting stops note filing for every clinician under the practice,
   * which is the reason this door is admin-only. It is also the act that will
   * be denied afterwards, so it leaves a row.
   */
  await audit({
    /* Explicit, like every other call site: this act has no clinician actor. */
    actor: null,
    clinicManagerId: actor.clinicManagerId,
    category: "admin",
    action: "records.disconnected",
    resourceType: "ehr_connection",
    resourceId: connectionId,
  });

  revalidatePath("/clinic/records");
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
