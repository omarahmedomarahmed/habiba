import "server-only";

import { env } from "@/lib/env";
import { log, safeErrorMessage } from "@/lib/logger";

import type { EtaClient, EtaSigner, EtaStatus } from "./types";

/**
 * 🔴 THE REAL ETA CLIENT, for the pre-production and production environments.
 *
 * Built from the SDK (sdk.invoicing.eta.gov.eg): OAuth client credentials on
 * the identity service (`/connect/token`, an hour's token, renewed before it
 * lapses), then the invoicing API. The base addresses are the ones the SDK's
 * FAQ publishes. Used the day `ETA_MODE` is `preprod` (to certify against the
 * Authority's test environment) and then `prod`; until then the simulator
 * stands here, and `verify:eta` runs the same issuing code over it.
 */
const BASES = {
  preprod: { id: "https://id.preprod.eta.gov.eg", api: "https://api.preprod.invoicing.eta.gov.eg" },
  prod: { id: "https://id.eta.gov.eg", api: "https://api.invoicing.eta.gov.eg" },
} as const;

let token: { value: string; until: number } | null = null;

async function accessToken(base: (typeof BASES)[keyof typeof BASES]): Promise<string> {
  if (token && token.until > Date.now() + 60_000) return token.value;
  const basic = Buffer.from(`${env.etaClientId}:${env.etaClientSecret}`).toString("base64");
  const response = await fetch(`${base.id}/connect/token`, {
    method: "POST",
    headers: { Authorization: `Basic ${basic}`, "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "client_credentials", scope: "InvoicingAPI" }),
  });
  if (!response.ok) throw new Error(`ETA login refused (${response.status})`);
  const body = (await response.json()) as { access_token: string; expires_in: number };
  token = { value: body.access_token, until: Date.now() + body.expires_in * 1000 };
  return token.value;
}

export function realEtaClient(mode: "preprod" | "prod"): EtaClient {
  const base = BASES[mode];
  const call = async (path: string, init: RequestInit = {}) => {
    const response = await fetch(`${base.api}${path}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${await accessToken(base)}`,
        "Content-Type": "application/json",
        ...(init.headers ?? {}),
      },
    });
    return response;
  };

  return {
    name: `eta-${mode}`,

    async submit(documentsJson) {
      try {
        const response = await call("/api/v1.0/documentsubmissions", {
          method: "POST",
          body: `{"documents":${documentsJson}}`,
        });
        const body = (await response.json().catch(() => ({}))) as {
          submissionId?: string;
          acceptedDocuments?: { uuid: string; longId: string; internalId: string }[];
          rejectedDocuments?: { internalId: string; error?: { message?: string; details?: { message?: string }[] } }[];
        };
        if (response.status !== 202) return { ok: false, reason: `ETA answered ${response.status}` };
        return {
          ok: true,
          submissionUuid: body.submissionId ?? "",
          accepted: (body.acceptedDocuments ?? []).map((d) => ({ internalId: d.internalId, uuid: d.uuid, longId: d.longId })),
          rejected: (body.rejectedDocuments ?? []).map((d) => ({
            internalId: d.internalId,
            error: [d.error?.message, ...(d.error?.details ?? []).map((x) => x.message)].filter(Boolean).join(" · "),
          })),
        };
      } catch (error) {
        log.error("ETA submission failed", { reason: safeErrorMessage(error) });
        return { ok: false, reason: safeErrorMessage(error) };
      }
    },

    async status(uuid) {
      try {
        const response = await call(`/api/v1.0/documents/${encodeURIComponent(uuid)}/details`);
        if (!response.ok) return { ok: false, reason: `ETA answered ${response.status}` };
        const body = (await response.json()) as {
          status: EtaStatus["status"];
          validationResults?: { validationSteps?: { status: string; error?: { error?: string } }[] };
        };
        const failed = (body.validationResults?.validationSteps ?? []).filter((s) => s.status === "Invalid");
        return {
          uuid,
          status: body.status,
          error: failed.map((s) => s.error?.error).filter(Boolean).join(" · ") || null,
        };
      } catch (error) {
        return { ok: false, reason: safeErrorMessage(error) };
      }
    },

    async printout(uuid) {
      try {
        const response = await call(`/api/v1.0/documents/${encodeURIComponent(uuid)}/pdf`);
        if (!response.ok) return { ok: false, reason: `ETA answered ${response.status}` };
        return { ok: true, pdf: await response.arrayBuffer() };
      } catch (error) {
        return { ok: false, reason: safeErrorMessage(error) };
      }
    },

    async cancel(uuid, reason) {
      try {
        const response = await call(`/api/v1.0/documents/state/${encodeURIComponent(uuid)}/state`, {
          method: "PUT",
          body: JSON.stringify({ status: "cancelled", reason: reason.slice(0, 100) }),
        });
        return response.ok ? { ok: true } : { ok: false, reason: `ETA answered ${response.status}` };
      } catch (error) {
        return { ok: false, reason: safeErrorMessage(error) };
      }
    },
  };
}

/**
 * 🔴 THE SIGNER, a service that holds the eSeal.
 *
 * The private key cannot live on a serverless host: it is on a USB token or in
 * an HSM, issued by a licensed Egyptian certificate provider. So signing is a
 * call to whichever holds it, over TLS with a shared secret: it receives the
 * canonical text and answers the base64 CAdES-BES. A small machine with the
 * token plugged in, or the provider's cloud signing API, both fit this shape.
 */
export function remoteSigner(): EtaSigner {
  return {
    name: "remote",
    async sign(serialized) {
      try {
        const response = await fetch(env.etaSignerUrl, {
          method: "POST",
          headers: { Authorization: `Bearer ${env.etaSignerToken}`, "Content-Type": "application/json" },
          body: JSON.stringify({ data: serialized }),
        });
        if (!response.ok) return { ok: false, reason: `the signer answered ${response.status}` };
        const body = (await response.json()) as { signature?: string };
        return body.signature ? { ok: true, cades: body.signature } : { ok: false, reason: "the signer returned no signature" };
      } catch (error) {
        return { ok: false, reason: safeErrorMessage(error) };
      }
    },
  };
}
