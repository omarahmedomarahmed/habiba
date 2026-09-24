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
 * as they will be.
 *
 * 🔴 C23: SIGNED WITH A SECRET FROM THE ENVIRONMENT, OVER A TIME. It fell back
 * to a constant printed in this file when `EGYPT_GATEWAY_HMAC` was unset, and
 * signed the body alone. "Only off the live deployment" is not "only on a
 * laptop": a preview or staging deployment with the simulator on took a
 * "paid" callback anybody could sign from the public source, and replayed one
 * for ever. Now there is no constant: without `EGYPT_GATEWAY_HMAC` (or
 * `EGYPT_PAYOUTS_HMAC`) the simulator is not configured (`index.ts` says so and
 * hands out no adapter), nothing signs, and nothing verifies. The header is
 * `t=<unix seconds>,v1=<hex HMAC of "t.body">`, the construction our own
 * webhooks use, and a time more than five minutes from now is refused.
 *
 * Its own record of what happened lives in memory, which is what a status read
 * asks. A cold start forgets it and a status read then says "pending", which is
 * also what a real gateway says about a checkout nobody has finished.
 */

export const SIGNATURE_HEADER = "x-gateway-signature";
/** How far a callback's signed time may be from ours, either way. */
const TOLERANCE_SECONDS = 5 * 60;

type Kind = "collection" | "payouts";

function secret(kind: Kind): string {
  return kind === "collection" ? env.egyptGatewayHmac : env.egyptPayoutsHmac;
}

/** Whether this side of the simulator has a secret to sign and verify with. */
export function fakeSecretSet(kind: Kind): boolean {
  return secret(kind).length > 0;
}

/**
 * The header value for a callback. Throws with no secret: a simulator that
 * cannot sign has nothing to say, and a silent default is the defect C23 fixed.
 */
export function signFake(kind: Kind, rawBody: string, at: Date = new Date()): string {
  const key = secret(kind);
  if (!key) {
    throw new Error(
      `The payment simulator has no signing secret: set ${kind === "collection" ? "EGYPT_GATEWAY_HMAC" : "EGYPT_PAYOUTS_HMAC"}.`,
    );
  }
  const t = Math.floor(at.getTime() / 1000);
  return `t=${t},v1=${createHmac("sha256", key).update(`${t}.${rawBody}`).digest("hex")}`;
}

function verified(kind: Kind, rawBody: string, headers: Headers): boolean {
  const key = secret(kind);
  if (!key) return false;
  const parts = new Map(
    (headers.get(SIGNATURE_HEADER) ?? "").split(",").map((part) => {
      const at = part.indexOf("=");
      return [part.slice(0, at).trim(), part.slice(at + 1).trim()] as const;
    }),
  );
  const t = Number(parts.get("t"));
  const given = parts.get("v1") ?? "";
  if (!Number.isInteger(t) || Math.abs(Date.now() / 1000 - t) > TOLERANCE_SECONDS) return false;
  const expected = createHmac("sha256", key).update(`${t}.${rawBody}`).digest("hex");
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
