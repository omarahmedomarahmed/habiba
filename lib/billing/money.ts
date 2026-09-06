import type { Crossing, Entity, PayoutMethod } from "@/lib/db/schema";

/**
 * Two currencies and two rails, as arithmetic. PLAN.md §3c, 16.4–16.9.
 *
 * ## Why this is pure and has no database import
 *
 * Every function here is total, deterministic and testable without a
 * connection. Money bugs are found by reading arithmetic, and arithmetic
 * buried in a query is arithmetic nobody reads. The rate comes *in* as a
 * number — where it came from and how long it is good for is `fx.ts`'s
 * problem, and which entity holds the result is a fact recorded on a row.
 *
 * ## The one rule about rounding
 *
 * Convert once, round once, and store the rounded number. A figure that is
 * re-derived on each render is a figure that can disagree with the receipt by
 * a cent, and "only a cent" is exactly the discrepancy a reconciliation
 * cannot explain.
 */

/** Rates are quoted x1e6 — enough precision for EGP at ~48/USD, with no float. */
export const RATE_SCALE = 1_000_000;

export type Money = {
  /** Minor units: cents of USD, piastres of EGP. */
  minor: number;
  /** ISO 4217, lowercase. */
  currency: string;
};

export function money(minor: number, currency: string): Money {
  return { minor: Math.round(minor), currency: currency.trim().toLowerCase() };
}

/**
 * `amount` in the quote currency, at `rateMicro` quote-per-base.
 *
 * Rounds half away from zero rather than JavaScript's half-up, because
 * `Math.round(-0.5)` is `-0` and a refund is the case where the amount is
 * negative. A conversion that rounds a refund differently from the payment it
 * reverses leaves a cent behind in the ledger for ever.
 */
export function convert(amountMinor: number, rateMicro: number): number {
  const scaled = (amountMinor * rateMicro) / RATE_SCALE;
  return scaled < 0 ? -Math.round(-scaled) : Math.round(scaled);
}

/** The rate a therapist actually settles at, once C76's spread is applied. */
export function rateWithSpread(rateMicro: number, spreadBps: number): number {
  return Math.round(rateMicro * (1 + Math.max(0, spreadBps) / 10_000));
}

/**
 * 🔴 16.6b / C76 — everything the EGP screen must say before the button.
 *
 * Returned as one object rather than assembled per screen, so that a page
 * cannot show the amount without the rate. The therapist absorbs the
 * difference; that is only defensible if the difference is on the screen, and
 * the way to guarantee it is on the screen is to make it impossible to render
 * the amount without it.
 */
export type EgpSettlement = {
  /** What they will be charged, in piastres. */
  payMinor: number;
  payCurrency: "egp";
  /** What it settles, in cents of USD. The price itself. */
  settlesMinor: number;
  settlesCurrency: "usd";
  /** The rate used, including any spread, x1e6. */
  rateMicro: number;
  /** The market rate before the spread, so the spread is visible as a number. */
  marketRateMicro: number;
  spreadBps: number;
  quotedAt: Date;
};

export function egpSettlement(input: {
  usdCents: number;
  marketRateMicro: number;
  spreadBps: number;
  quotedAt: Date;
}): EgpSettlement {
  const rateMicro = rateWithSpread(input.marketRateMicro, input.spreadBps);
  return {
    payMinor: convert(input.usdCents, rateMicro),
    payCurrency: "egp",
    settlesMinor: input.usdCents,
    settlesCurrency: "usd",
    rateMicro,
    marketRateMicro: input.marketRateMicro,
    spreadBps: input.spreadBps,
    quotedAt: input.quotedAt,
  };
}

/* ------------------------------------------------------- the four crossings -- */

export type Rail = "stripe_usd" | "local_egp";
export type TherapistRail = "connect" | "manual";

/**
 * Which of §3c's four crossings a payment is. 16.7.
 *
 * 🔴 Two of the four mean **we hold the money**, and those two are the legal
 * exposure the whole of §3c is about. They are returned by name so that every
 * caller — the ledger memo, the payout queue, the reconciliation — says the
 * same word for the same thing, and so a `grep` for `usd_stripe_to_manual`
 * finds every place the risky path is taken.
 */
export function crossingFor(input: { paidVia: Rail; therapist: TherapistRail }): Crossing {
  if (input.paidVia === "stripe_usd") {
    return input.therapist === "connect" ? "usd_stripe_to_connect" : "usd_stripe_to_manual";
  }
  return input.therapist === "connect" ? "egp_local_to_connect" : "egp_local_to_manual";
}

/**
 * Does this crossing leave money in our hands?
 *
 * Only `usd_stripe_to_connect` does not: Stripe's destination charge routes
 * the gross to the clinician at the moment of payment and we never touch it.
 * Every other crossing means a held balance, and a held balance is a debt.
 */
export function holdsMoney(crossing: Crossing): boolean {
  return crossing !== "usd_stripe_to_connect";
}

/**
 * 🔴 The two crossings §3c calls the exposure: cross-border, and ours to
 * defend if anybody asks. Named as a predicate so a report can count them.
 */
export function isCrossBorder(crossing: Crossing): boolean {
  return crossing === "usd_stripe_to_manual" || crossing === "egp_local_to_connect";
}

/**
 * Which entity ends up holding it. 16.9.
 *
 * EGP collected in Egypt is the Egyptian entity's, whoever it is owed to.
 * Dollars taken on the card rail are the US entity's, likewise. The entity
 * follows the **money in**, never the person it is owed to — which is exactly
 * why a cross-border crossing needs an explicit `entity_transfer` to settle,
 * rather than being quietly netted at read time.
 */
export function entityFor(crossing: Crossing): Entity {
  return crossing === "egp_local_to_manual" || crossing === "egp_local_to_connect" ? "eg" : "us";
}

/** Which rail can actually pay this clinician out. */
export function payoutRailFor(input: {
  stripeAccountId: string | null;
  payoutsEnabled: boolean;
}): TherapistRail {
  return input.stripeAccountId && input.payoutsEnabled ? "connect" : "manual";
}

/**
 * The currency a manual payout goes out in, by method.
 *
 * InstaPay and Egyptian wallets are EGP instruments; there is no such thing as
 * an InstaPay transfer in dollars, and a UI that lets somebody pick one is a
 * UI that produces a transfer the bank rejects.
 */
export function payoutCurrencyFor(method: PayoutMethod): string {
  return method === "stripe" ? "usd" : "egp";
}
