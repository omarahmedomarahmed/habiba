"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireOrgAccount } from "@/lib/auth/org-account";
import { beginConnection, revokeConnectionsFor } from "@/lib/data/ehr";
import { putPending } from "@/lib/ehr/pending";
import { authorizeUrl, pkce } from "@/lib/ehr/smart";
import type { EhrVendor } from "@/lib/db/schema";

/**
 * 43.1c — the solo clinician's home for the records connection.
 *
 * 🔴 The organisation comes from the session. A solo therapist is an organisation of one
 * (C259/C266), so `actor.organizationId` is the owner and no form field can supply another.
 * W1-02: a clinic seat clinician's session carries the CLINIC's id, so `requireOrgAccount`
 * refuses them; the clinic's connection is run from `/clinic/records`.
 *
 * Same actions, same data module and same panel as the clinic's. What differs is the guard, because
 * an `Actor` and a `ClinicActor` are deliberately different types.
 */
export async function begin(_prev: { error?: string }, formData: FormData): Promise<{ error?: string }> {
  const { actor, refused } = await requireOrgAccount();
  if (refused) return { error: refused };

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

export async function disconnect(formData: FormData): Promise<void> {
  const { actor, refused } = await requireOrgAccount();
  if (refused) return;
  /*
   * 🔴 W1-22: the connection that was chosen. One live connection per organisation per VENDOR
   * still allows two vendors, so "disconnect" without an id revoked both. The id is pinned to
   * this organisation inside `revokeConnectionsFor`, so changing it reaches nothing else.
   */
  const connectionId = String(formData.get("connectionId") ?? "");
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(connectionId)) return;
  await revokeConnectionsFor(actor.organizationId, null, "disconnected by the practice", connectionId);
  revalidatePath("/settings/records");
}
