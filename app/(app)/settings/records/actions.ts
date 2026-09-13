"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireUser } from "@/lib/auth/guard";
import { beginConnection, revokeConnectionsFor } from "@/lib/data/ehr";
import { putPending } from "@/lib/ehr/pending";
import { authorizeUrl, pkce } from "@/lib/ehr/smart";
import type { EhrVendor } from "@/lib/db/schema";

/**
 * 43.1c — the solo clinician's home for the records connection.
 *
 * 🔴 `requireUser`, so the organisation comes from the session. A solo therapist is an organisation
 * of one (C259/C266), so `actor.organizationId` is the owner with no second case and no
 * `organizationId` field this form could supply.
 *
 * Same actions, same data module and same panel as the clinic's. What differs is the guard, because
 * an `Actor` and a `ClinicActor` are deliberately different types.
 */
export async function begin(_prev: { error?: string }, formData: FormData): Promise<{ error?: string }> {
  const actor = await requireUser();

  const vendor = String(formData.get("vendor") ?? "epic") as EhrVendor;
  const fhirBaseUrl = String(formData.get("fhirBaseUrl") ?? "").trim();
  const pair = pkce();

  const result = await beginConnection({
    organizationId: actor.organizationId,
    vendor,
    fhirBaseUrl,
  });

  if (result.error || !result.authorizeUrl || !result.tokenUrl || !result.issuer) {
    return { error: result.error ?? "That server could not be read." };
  }

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
    organizationId: actor.organizationId,
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

export async function disconnect(): Promise<void> {
  const actor = await requireUser();
  /*
   * 🔴 No connection id from the form, deliberately. There is at most one live connection per
   * organisation per vendor (`ehr_connections_live_unique`), so "disconnect" is unambiguous, and an
   * id in the body would be an id somebody could change.
   */
  await revokeConnectionsFor(actor.organizationId, null, "disconnected by the practice");
  revalidatePath("/settings/records");
}
