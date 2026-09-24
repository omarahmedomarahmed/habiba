import "server-only";

import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";

import { env } from "@/lib/env";

import type {
  CollectionEvent,
  CollectionGateway,
  PayoutEvent,
  PayoutProvider,
} from "./types";

/**
 * 🔴 THE SIMULATOR: a gateway and a payouts provider that behave like real
 * ones, for development and the verifiers, and never on the live deployment.
 *
 * It is not a mock that says yes. It hands out a hosted checkout page
 * (`/dev/gateway/[ref]`) where a person presses Pay or Decline, and it answers
 * by POSTING A SIGNED CALLBACK to the same route a real gateway will call, so
 * the signature check, the idempotent claim and the books are exercised exactly
 * as they will be. Its signing secret is `EGYPT_GATEWAY_HMAC` when set and a
 * development constant otherwise, which is harmless because `index.ts` refuses
 * the simulator on the live deployment.
 *
 * Its own record of what happened lives in memory, which is what a status read
 * asks. A cold start forgets it and a status read then says "pending", which is
 * also what a real gateway says about a checkout nobody has finished.
 */

const DEV_SECRET = "fake-gateway-development-secret";
export const SIGNATURE_HEADER = "x-gateway-signature";

function secret(kind: "collection" | "payouts"): string {
  return (kind === "collection" ? env.egyptGatewayHmac : env.egyptPayoutsHmac) || DEV_SECRET;
}

export function signFake(kind: "collection" | "payouts", rawBody: string): string {
  return createHmac("sha256", secret(kind)).update(rawBody).digest("hex");
}

function verified(kind: "collection" | "payouts", rawBody: string, headers: Headers): boolean {
  const given = headers.get(SIGNATURE_HEADER) ?? "";
  const expected = signFake(kind, rawBody);
  if (given.length !== expected.length) return false;
  return timingSafeEqual(Buffer.from(given), Buffer.from(expected));
}

const checkouts = new Map<string, CollectionEvent>();
const transfers = new Map<string, PayoutEvent>();

/** The simulator page's own record, so a status read agrees with the callback. */
export function recordFakeOutcome(event: CollectionEvent): void {
  checkouts.set(event.providerRef, event);
}
export function recordFakePayout(event: PayoutEvent): void {
  transfers.set(event.providerRef, event);
}

export const FAKE_GATEWAY: CollectionGateway = {
  name: "fake",

  async createCheckout(input) {
    const providerRef = `fake_chk_${randomUUID()}`;
    checkouts.set(providerRef, {
      providerRef,
      reference: input.reference,
      outcome: "pending",
      transactionId: null,
      amountMinor: input.amountMinor,
      currency: input.currency,
      failure: null,
    });
    const url = new URL(`${env.appUrl}/dev/gateway/${providerRef}`);
    url.searchParams.set("reference", input.reference);
    url.searchParams.set("amount", String(input.amountMinor));
    url.searchParams.set("return", input.returnUrl);
    return { ok: true, providerRef, checkoutUrl: url.toString() };
  },

  async verifyCallback({ rawBody, headers }) {
    if (!verified("collection", rawBody, headers)) return null;
    try {
      const event = JSON.parse(rawBody) as CollectionEvent;
      if (!event.providerRef || !event.reference || !event.outcome) return null;
      checkouts.set(event.providerRef, event);
      return event;
    } catch {
      return null;
    }
  },

  async fetchStatus(providerRef) {
    return (
      checkouts.get(providerRef) ?? {
        providerRef,
        reference: "",
        outcome: "pending",
        transactionId: null,
        amountMinor: 0,
        currency: "egp",
        failure: null,
      }
    );
  },

  async refund(input) {
    if (input.amountMinor <= 0) return { ok: false, reason: "Nothing to refund." };
    return { ok: true, refundRef: `fake_ref_${randomUUID()}` };
  },
};

export const FAKE_PAYOUTS: PayoutProvider = {
  name: "fake",

  async send(input) {
    if (input.amountMinor <= 0) return { ok: false, reason: "Nothing to send." };
    const providerRef = `fake_pay_${randomUUID()}`;
    transfers.set(providerRef, { providerRef, reference: input.reference, outcome: "pending", failure: null });
    return { ok: true, providerRef };
  },

  async verifyCallback({ rawBody, headers }) {
    if (!verified("payouts", rawBody, headers)) return null;
    try {
      const event = JSON.parse(rawBody) as PayoutEvent;
      if (!event.providerRef || !event.reference || !event.outcome) return null;
      transfers.set(event.providerRef, event);
      return event;
    } catch {
      return null;
    }
  },

  async fetchStatus(providerRef) {
    return transfers.get(providerRef) ?? { providerRef, reference: "", outcome: "pending", failure: null };
  },
};
