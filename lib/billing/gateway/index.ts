import "server-only";

import { env } from "@/lib/env";

import { FAKE_GATEWAY, FAKE_PAYOUTS, fakeSecretSet } from "./fake";
import type { CollectionGateway, PayoutProvider } from "./types";

/**
 * 🔴 WHICH ADAPTER, AND WHAT IS MISSING WHEN THERE IS NONE. 64.1.
 *
 * The one place a provider is chosen. `EGYPT_GATEWAY` and `EGYPT_PAYOUTS` name
 * the adapter; a contracted adapter is added to `ADAPTERS` under its own name
 * the day its documents arrive, and nothing outside this folder changes.
 *
 * 🔴 THE SIMULATOR NEVER ON THE LIVE DEPLOYMENT. `fake` takes a pretend
 * payment, so it is refused where a real patient could meet it, whatever an
 * environment variable says.
 */
const ADAPTERS: Record<string, { collection?: CollectionGateway; payouts?: PayoutProvider }> = {
  fake: { collection: FAKE_GATEWAY, payouts: FAKE_PAYOUTS },
};

/** What the card rail still needs, in sentences an operator can act on. */
export function whatTheGatewayNeeds(): string[] {
  const name = env.egyptGateway;
  if (!name) {
    return [
      "A signed contract with an Egyptian payment gateway, named in EGYPT_GATEWAY once its adapter is written.",
    ];
  }
  if (name === "fake") {
    if (env.liveDeployment) return ["The simulator is switched on here, and it never takes real payments."];
    /* 🔴 C23: no built-in secret any more, so a simulator without one is not configured. */
    return fakeSecretSet("collection") ? [] : ["The simulator's callback signing secret in EGYPT_GATEWAY_HMAC."];
  }
  const needs: string[] = [];
  if (!ADAPTERS[name]?.collection) needs.push(`This build has no adapter for the gateway "${name}".`);
  if (!env.egyptGatewayKey) needs.push("The gateway's API key in EGYPT_GATEWAY_KEY.");
  if (!env.egyptMerchantId) needs.push("The merchant account id under the Egyptian entity in EGYPT_MERCHANT_ID.");
  if (!env.egyptGatewayHmac) needs.push("The gateway's callback signing secret in EGYPT_GATEWAY_HMAC.");
  return needs;
}

/** What automated payouts still need. Manual payouts are the designed path meanwhile (C309). */
export function whatPayoutsNeed(): string[] {
  const name = env.egyptPayouts;
  if (!name) {
    return ["A payouts provider contract, named in EGYPT_PAYOUTS once its adapter is written."];
  }
  if (name === "fake") {
    if (env.liveDeployment) return ["The simulator is switched on here, and it never sends real money."];
    return fakeSecretSet("payouts") ? [] : ["The simulator's callback signing secret in EGYPT_PAYOUTS_HMAC."];
  }
  const needs: string[] = [];
  if (!ADAPTERS[name]?.payouts) needs.push(`This build has no adapter for the payouts provider "${name}".`);
  if (!env.egyptPayoutsKey) needs.push("The provider's API key in EGYPT_PAYOUTS_KEY.");
  if (!env.egyptPayoutsHmac) needs.push("The provider's callback signing secret in EGYPT_PAYOUTS_HMAC.");
  return needs;
}

/** The card gateway, or null when anything above is missing. */
export function collectionGateway(): CollectionGateway | null {
  if (whatTheGatewayNeeds().length > 0) return null;
  return ADAPTERS[env.egyptGateway]?.collection ?? null;
}

/** The payouts provider, or null when anything above is missing. */
export function payoutProvider(): PayoutProvider | null {
  if (whatPayoutsNeed().length > 0) return null;
  return ADAPTERS[env.egyptPayouts]?.payouts ?? null;
}

/** A provider's own adapter by its stored name, to answer for an attempt it started. */
export function gatewayNamed(name: string): CollectionGateway | null {
  if (name === "fake" && env.liveDeployment) return null;
  return ADAPTERS[name]?.collection ?? null;
}

/** Payout methods a provider sends to. Stripe payouts are Connect's, never here. */
export const PROVIDER_METHODS = ["instapay", "wallet", "bank"] as const;
