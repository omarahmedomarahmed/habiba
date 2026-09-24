import "server-only";

import { env } from "@/lib/env";

import { realEtaClient, remoteSigner } from "./client";
import { FAKE_ETA, FAKE_SIGNER } from "./fake";
import type { EtaClient, EtaSigner } from "./types";

/**
 * 🔴 WHICH ETA, WHICH SIGNER, AND WHAT IS MISSING WHEN EITHER IS NOT THERE.
 *
 * The simulator (`fake`) is refused on the live deployment whatever the
 * environment says, for the same reason as the payment simulator: a pretend
 * tax invoice sent to a real company is worse than none.
 */
export function whatEtaNeeds(): string[] {
  const needs: string[] = [];
  const mode = env.etaMode;
  if (!mode) {
    needs.push("E-invoicing is off. Set ETA_MODE to preprod to certify with the Tax Authority, then prod.");
  } else if (mode === "fake") {
    if (env.liveDeployment) needs.push("The ETA simulator is switched on here, and it never issues real invoices.");
  } else if (mode !== "preprod" && mode !== "prod") {
    needs.push(`ETA_MODE "${mode}" is not one of preprod or prod.`);
  } else {
    if (!env.etaClientId || !env.etaClientSecret) {
      needs.push("The ERP system's client id and secret from our ETA profile, in ETA_CLIENT_ID and ETA_CLIENT_SECRET.");
    }
  }

  const signer = env.etaSigner;
  if (!signer) {
    needs.push("A signer holding our eSeal certificate: ETA_SIGNER=remote with ETA_SIGNER_URL and ETA_SIGNER_TOKEN.");
  } else if (signer === "fake") {
    if (env.liveDeployment || (mode !== "fake" && mode !== "")) {
      needs.push("The simulated signer only signs for the simulated Tax Authority.");
    }
  } else if (signer === "remote") {
    if (!env.etaSignerUrl || !env.etaSignerToken) needs.push("ETA_SIGNER_URL and ETA_SIGNER_TOKEN for the signing service.");
  } else {
    needs.push(`ETA_SIGNER "${signer}" is not one of remote or fake.`);
  }
  return needs;
}

export function etaClient(): EtaClient | null {
  if (whatEtaNeeds().length > 0) return null;
  if (env.etaMode === "fake") return FAKE_ETA;
  return realEtaClient(env.etaMode as "preprod" | "prod");
}

export function etaSigner(): EtaSigner | null {
  if (whatEtaNeeds().length > 0) return null;
  return env.etaSigner === "fake" ? FAKE_SIGNER : remoteSigner();
}
