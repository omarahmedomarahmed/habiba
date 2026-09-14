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

/* ------------------------------------------------- two currencies, no more -- */

/**
 * 🔴 THE WHOLE CURRENCY MODEL, AS TWO VALUES. Founder, 2026-09-14.
 *
 * > *Only 2 currencies for now, EGP in Egypt and USD for the rest of the world.
 * > We have Stripe for USD and we have an Egyptian gateway for EGP. We will add
 * > GBP and EUR soon, but in those countries price with USD and pay with USD and
 * > payouts in USD.*
 *
 * So "we support the UK" will never mean "we charge in pounds". A British
 * patient sees a dollar price, pays dollars on the card rail, and a British
 * clinician is paid dollars into Connect. Adding GB to `country_settings`
 * adds a jurisdiction, a regulator and a document list. It does not add a
 * currency, and `parseCountry` will not let it.
 *
 * ## 🔴 WHY THIS IS A HARD LIST AND NOT A SETTING
 *
 * `country_settings.currency` is a free text column an operator can type into,
 * and C218's rule is that a switch an operator can set is read by the code or
 * it does not exist. There is no code in this product that can collect a pound:
 * no acquirer, no entity, no VAT rate, no payout rail, no ledger currency. An
 * operator typing `gbp` would produce a Stripe checkout in a currency our own
 * fee arithmetic, our invoices and our reconciliation all assume is one of two.
 *
 * A guessed currency is the same class of mistake as a guessed VAT rate, which
 * `COUNTRY_SEED` already refuses to make: *"a guessed 0% is an under-collection
 * somebody eventually owes"*. This is the same sentence about the other column.
 */
export const SUPPORTED_CURRENCIES = ["usd", "egp"] as const;
export type SupportedCurrency = (typeof SUPPORTED_CURRENCIES)[number];

/** The Egyptian entity is the only one that holds anything but dollars. */
export const CURRENCY_BY_ENTITY: Record<Entity, SupportedCurrency> = {
  us: "usd",
  eg: "egp",
};

/**
 * 🔴 WHAT THE PATIENT IS CHARGED IN, DECIDED BY WHERE THE PATIENT IS.
 *
 * > *Egypt patients pay in EGP even if the therapist is in the UK and gets their
 * > payout on Stripe in USD, and we collected from the patient in EGP through
 * > the Egyptian gateway.*
 *
 * That sentence is the reason collection and payout are two separate functions
 * in this file rather than one "rail" answer. They are decided by two different
 * people's countries and they can disagree, and when they disagree the result is
 * a cross-border crossing that needs an explicit `entity_transfer` to settle.
 * The obvious build asks "which rail is this session on" once, and is wrong for
 * every Egyptian patient seeing a foreign clinician.
 */
export function collectionCurrencyFor(patientCountryCode: string): SupportedCurrency {
  return patientCountryCode.trim().toUpperCase() === "EG" ? "egp" : "usd";
}

/** Which rail takes the money, by the same rule and for the same reason. */
export function collectionRailFor(patientCountryCode: string): Rail {
  return collectionCurrencyFor(patientCountryCode) === "egp" ? "local_egp" : "stripe_usd";
}

/* ------------------------------------------------------- the four crossings -- */

/**
 * 🔴 53.10 — `pot` is a third rail IN, and it is the one where the money arrived
 * months ago.
 *
 * A sponsor tops up by card in USD, so the cash rail is Stripe's. What makes this
 * its own value is not how the money got here but WHEN and WHOSE it was: it sat
 * on our balance as a liability and was spent by somebody who is not the payer.
 * `holdsMoney` has to answer true for it, and it cannot if a pot session files
 * itself under `usd_stripe_to_connect`.
 */
export type Rail = "stripe_usd" | "local_egp" | "pot";
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
  if (input.paidVia === "pot") {
    return input.therapist === "connect" ? "pot_held_to_connect" : "pot_held_to_manual";
  }
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
 *
 * 🔴 Both pot crossings hold, and a pot holds for LONGER than anything else here:
 * a card payment is held between the session and the payout, a pot between a
 * top-up and whenever it is spent. That is the duration C232 puts to counsel.
 */
export function holdsMoney(crossing: Crossing): boolean {
  return crossing !== "usd_stripe_to_connect";
}

/**
 * 🔴 The crossings §3c calls the exposure: cross-border, and ours to
 * defend if anybody asks. Named as a predicate so a report can count them.
 *
 * 🔴 `pot_held_to_manual` belongs here and this is the reason the pot needed two
 * crossing values rather than one. USD comes into the US entity at top-up and EGP
 * leaves the Egyptian one at payout, so the two halves are in different entities
 * and settling them needs an explicit `entity_transfer`. A single combined pot
 * crossing would have answered false here for every pot session, which is the
 * §6 failure family: a predicate that reads green because it was asked the wrong
 * question.
 */
export function isCrossBorder(crossing: Crossing): boolean {
  return (
    crossing === "usd_stripe_to_manual" ||
    crossing === "egp_local_to_connect" ||
    crossing === "pot_held_to_manual"
  );
}

/**
 * Which entity ends up holding it. 16.9.
 *
 * EGP collected in Egypt is the Egyptian entity's, whoever it is owed to.
 * Dollars taken on the card rail are the US entity's, likewise. The entity
 * follows the **money in**, never the person it is owed to — which is exactly
 * why a cross-border crossing needs an explicit `entity_transfer` to settle,
 * rather than being quietly netted at read time.
 *
 * 🔴 Both pot crossings are `us`, which follows the same rule rather than making
 * an exception to it: the money came IN as USD on the card rail, into the US
 * entity, at top-up. `topUpPot` refuses an Egyptian sponsor outright until
 * counsel has confirmed e-invoicing (C241), so there is no pot money in the
 * Egyptian entity for this to be wrong about.
 */
export function entityFor(crossing: Crossing): Entity {
  return crossing === "egp_local_to_manual" || crossing === "egp_local_to_connect" ? "eg" : "us";
}

/**
 * Which rail can actually pay this clinician out.
 *
 * 🔴 EGYPT IS ALWAYS MANUAL, WHATEVER ELSE IS TRUE OF THE ROW. Founder, 2026-09-14.
 *
 * > *A therapist in Egypt is on manual payouts even if the patient paid in USD
 * > from abroad.*
 *
 * The first version of this read only `stripeAccountId && payoutsEnabled`, which
 * is a question about our own database and not about the world. Stripe does not
 * pay out to Egypt at all, so an Egyptian clinician holding those two values —
 * from a mis-set flag, an operator fixing something by hand, a Connect account
 * opened against a foreign address — would have been routed to `connect`, the
 * crossing would have been recorded as `usd_stripe_to_connect`, and
 * `holdsMoney` would have answered FALSE for money we were definitely holding.
 *
 * That is the §6 family pointed at the exposure register itself: the one
 * predicate §3c exists to count would have under-counted, and the under-count
 * would have looked like good news.
 *
 * 🔴 The country is the clinician's own, from `therapist_verifications.country`,
 * which is the column that decides which documents we ask them for. A clinician
 * with no verification row yet has no country, and gets `manual`: we do not pay
 * an unverified clinician through Connect on an assumption.
 */
export function payoutRailFor(input: {
  stripeAccountId: string | null;
  payoutsEnabled: boolean;
  /** ISO-3166 alpha-2, from their verification. Null before they file one. */
  country: string | null;
}): TherapistRail {
  if ((input.country ?? "").trim().toUpperCase() === "EG") return "manual";
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
