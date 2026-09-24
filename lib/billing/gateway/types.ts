/**
 * 🔴 THE TWO CONTRACTS AN EGYPTIAN PROVIDER HAS TO MEET. PLAN.md 64.1, C37.
 *
 * Written before either contract is signed so that signing one means writing
 * one adapter file and nothing else. Every call site in the product speaks to
 * these types; no call site names a vendor.
 *
 * Both are shaped by how local gateways and disbursement providers actually
 * work, not by Stripe:
 *
 *   collection  a hosted checkout the payer is sent to, a server-to-server
 *               callback signed with a shared secret, a transaction id that a
 *               refund is issued against, and a status read for the payer who
 *               comes back before the callback does
 *   payouts     a request to send, answered at once with a reference and
 *               "pending", then a signed callback saying the money left or did
 *               not, and a status read for when the callback never comes
 *
 * Nothing here throws on a business outcome. A declined card, a refund the
 * gateway refuses, a payout to a closed wallet are all answers, and an answer
 * is a value a screen can say something honest about.
 */

export type ProviderRefusal = {
  ok: false;
  /** For the operator's screen and the log. Never shown to a patient as is. */
  reason: string;
};

/* ------------------------------------------------------------ collection -- */

export type CheckoutRequest = {
  /** Our reference, unique per attempt; the gateway echoes it on the callback. */
  reference: string;
  amountMinor: number;
  currency: "egp";
  /** Lines the payer sees: the session, the benefit's share, the tax. */
  items: { name: string; amountMinor: number }[];
  payer: { name: string; email: string | null; phone: string | null };
  /** Where the payer's browser comes back to, success or not. */
  returnUrl: string;
  /** Where the gateway posts its signed result. */
  callbackUrl: string;
};

export type CheckoutCreated = { ok: true; providerRef: string; checkoutUrl: string };

/** What a verified callback or a status read says happened to one attempt. */
export type CollectionEvent = {
  providerRef: string;
  reference: string;
  outcome: "paid" | "failed" | "pending" | "refunded";
  /** The gateway's transaction id: what a refund is issued against. */
  transactionId: string | null;
  amountMinor: number;
  currency: string;
  /** For a failure, the gateway's own words, for the operator. */
  failure: string | null;
};

export type CollectionGateway = {
  /** For logs and the operator's screen. Never branched on. */
  readonly name: string;
  createCheckout(input: CheckoutRequest): Promise<CheckoutCreated | ProviderRefusal>;
  /**
   * 🔴 The only way a callback becomes an event. Returns null for anything whose
   * signature does not verify, so a forged "paid" is not an event at all.
   */
  verifyCallback(input: { rawBody: string; headers: Headers }): Promise<CollectionEvent | null>;
  /** For the payer who returns before the callback: ask, never assume. */
  fetchStatus(providerRef: string): Promise<CollectionEvent | ProviderRefusal>;
  refund(input: {
    transactionId: string;
    amountMinor: number;
    reference: string;
  }): Promise<{ ok: true; refundRef: string } | ProviderRefusal>;
};

/* --------------------------------------------------------------- payouts -- */

export type PayoutInstruction = {
  /** Our reference, unique per payout request; echoed on the callback. */
  reference: string;
  amountMinor: number;
  currency: "egp";
  method: "instapay" | "wallet" | "bank";
  identifier: string;
  accountName: string;
  callbackUrl: string;
};

export type PayoutEvent = {
  providerRef: string;
  reference: string;
  outcome: "sent" | "failed" | "pending";
  failure: string | null;
};

export type PayoutProvider = {
  readonly name: string;
  send(input: PayoutInstruction): Promise<{ ok: true; providerRef: string } | ProviderRefusal>;
  verifyCallback(input: { rawBody: string; headers: Headers }): Promise<PayoutEvent | null>;
  fetchStatus(providerRef: string): Promise<PayoutEvent | ProviderRefusal>;
};
