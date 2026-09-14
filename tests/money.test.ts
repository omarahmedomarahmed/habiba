import assert from "node:assert/strict";
import test from "node:test";

import {
  CURRENCY_BY_ENTITY,
  SUPPORTED_CURRENCIES,
  collectionCurrencyFor,
  collectionRailFor,
  convert,
  crossingFor,
  egpSettlement,
  entityFor,
  holdsMoney,
  isCrossBorder,
  payoutCurrencyFor,
  payoutRailFor,
  rateWithSpread,
} from "../lib/billing/money";

/**
 * Sprint 16 — the arithmetic of two currencies and two rails. §3c, 16.4–16.9.
 *
 * Pure, so every one of these runs without a database. Money bugs are found by
 * reading arithmetic, and arithmetic that needs a connection to exercise is
 * arithmetic nobody exercises.
 */

test("a dollar converts at the quoted rate, rounded once", () => {
  // $30.00 at 48 EGP to the dollar.
  assert.equal(convert(3000, 48_000_000), 144_000);
});

test("🔴 a refund converts to exactly what the payment did, and back", () => {
  /*
   * The half-cent case. `Math.round(-0.5)` is -0 in JavaScript, so a naive
   * conversion rounds a refund one way and the payment it reverses the other,
   * and the ledger keeps a cent for ever.
   */
  const rate = 48_555_555;
  const paid = convert(1_667, rate);
  const refunded = convert(-1_667, rate);
  assert.equal(refunded, -paid, "a refund must be the exact negation of its payment");
});

test("a spread is added to the rate, never hidden in the amount", () => {
  assert.equal(rateWithSpread(48_000_000, 0), 48_000_000);
  assert.equal(rateWithSpread(48_000_000, 250), 49_200_000); // +2.5%
});

test("🔴 C76, the EGP screen carries the rate and the dollars it settles", () => {
  const s = egpSettlement({
    usdCents: 4_000,
    marketRateMicro: 48_000_000,
    spreadBps: 0,
    quotedAt: new Date("2026-09-06T00:00:00Z"),
  });

  assert.equal(s.settlesMinor, 4_000, "the dollar price is the price");
  assert.equal(s.payMinor, 192_000);
  assert.equal(s.marketRateMicro, 48_000_000, "the market rate stays visible beside the used one");
  // Every field the disclosure needs is present, so a screen cannot render the
  // amount without the rate that produced it.
  assert.ok(s.rateMicro && s.quotedAt && s.settlesCurrency === "usd");
});

test("the four crossings are named, and only one of them holds nothing", () => {
  assert.equal(crossingFor({ paidVia: "stripe_usd", therapist: "connect" }), "usd_stripe_to_connect");
  assert.equal(crossingFor({ paidVia: "stripe_usd", therapist: "manual" }), "usd_stripe_to_manual");
  assert.equal(crossingFor({ paidVia: "local_egp", therapist: "connect" }), "egp_local_to_connect");
  assert.equal(crossingFor({ paidVia: "local_egp", therapist: "manual" }), "egp_local_to_manual");

  assert.equal(holdsMoney("usd_stripe_to_connect"), false);
  for (const c of ["usd_stripe_to_manual", "egp_local_to_connect", "egp_local_to_manual"] as const) {
    assert.equal(holdsMoney(c), true, `${c} leaves money in our hands`);
  }
});

test("🔴 the two cross-border crossings are the two §3c calls the exposure", () => {
  assert.equal(isCrossBorder("usd_stripe_to_manual"), true);
  assert.equal(isCrossBorder("egp_local_to_connect"), true);
  assert.equal(isCrossBorder("usd_stripe_to_connect"), false);
  assert.equal(isCrossBorder("egp_local_to_manual"), false);
});

test("the entity follows the money in, not the person it is owed to", () => {
  // An Egyptian patient paying for a therapist on Connect is EGP collected in
  // Egypt: the Egyptian entity holds it, and owes a clinician abroad.
  assert.equal(entityFor("egp_local_to_connect"), "eg");
  assert.equal(entityFor("usd_stripe_to_manual"), "us");
});

test("a clinician Stripe cannot pay is on the manual rail", () => {
  const gb = { country: "GB" };
  assert.equal(payoutRailFor({ ...gb, stripeAccountId: "acct_1", payoutsEnabled: true }), "connect");
  assert.equal(payoutRailFor({ ...gb, stripeAccountId: "acct_1", payoutsEnabled: false }), "manual");
  assert.equal(payoutRailFor({ ...gb, stripeAccountId: null, payoutsEnabled: true }), "manual");
});

test("an Egyptian clinician is manual however good the Stripe row looks", () => {
  /*
   * 🔴 Stripe does not pay out to Egypt. A row that says otherwise is a
   * mis-set flag, an operator fixing something by hand, or a Connect account
   * opened against a foreign address, and routing on it would record the
   * crossing as `usd_stripe_to_connect` — the one crossing `holdsMoney`
   * answers false for. The exposure register §3c exists to keep would have
   * under-counted, and an under-count reads as good news.
   */
  assert.equal(
    payoutRailFor({ country: "EG", stripeAccountId: "acct_1", payoutsEnabled: true }),
    "manual",
  );
  assert.equal(
    payoutRailFor({ country: "eg", stripeAccountId: "acct_1", payoutsEnabled: true }),
    "manual",
    "the column is not guaranteed to be upper case",
  );
  assert.equal(
    holdsMoney(crossingFor({ paidVia: "stripe_usd", therapist: payoutRailFor({ country: "EG", stripeAccountId: "acct_1", payoutsEnabled: true }) })),
    true,
    "a foreign patient paying an Egyptian clinician leaves the money with us",
  );
});

test("no verification yet means no Connect payout on an assumption", () => {
  assert.equal(
    payoutRailFor({ country: null, stripeAccountId: "acct_1", payoutsEnabled: true }),
    "connect",
    "a filed Stripe account with no country on file is still payable",
  );
});

test("two currencies, decided by where the PATIENT is", () => {
  /*
   * 🔴 The founder's rule, as arithmetic: "Egypt patients pay in EGP even if
   * the therapist is in the UK". Collection follows the patient; payout
   * follows the clinician; they are allowed to disagree.
   */
  assert.equal(collectionCurrencyFor("EG"), "egp");
  assert.equal(collectionCurrencyFor("eg"), "egp");
  assert.equal(collectionCurrencyFor("US"), "usd");
  assert.equal(collectionCurrencyFor("GB"), "usd", "a pound country still prices in dollars");
  assert.equal(collectionCurrencyFor("DE"), "usd");

  assert.equal(collectionRailFor("EG"), "local_egp");
  assert.equal(collectionRailFor("GB"), "stripe_usd");

  /* The pair the rule was written for: EGP in, USD out, across two entities. */
  const crossing = crossingFor({
    paidVia: collectionRailFor("EG"),
    therapist: payoutRailFor({ country: "GB", stripeAccountId: "acct_1", payoutsEnabled: true }),
  });
  assert.equal(crossing, "egp_local_to_connect");
  assert.equal(isCrossBorder(crossing), true, "it needs an explicit entity transfer");
  assert.equal(entityFor(crossing), "eg", "the money came in to the Egyptian entity");

  /* And the mirror: a foreign patient paying an Egyptian clinician. */
  const mirror = crossingFor({
    paidVia: collectionRailFor("US"),
    therapist: payoutRailFor({ country: "EG", stripeAccountId: null, payoutsEnabled: false }),
  });
  assert.equal(mirror, "usd_stripe_to_manual");
  assert.equal(isCrossBorder(mirror), true);
  assert.equal(entityFor(mirror), "us");
});

test("there are exactly two currencies and each entity has one", () => {
  assert.deepEqual([...SUPPORTED_CURRENCIES], ["usd", "egp"]);
  assert.equal(CURRENCY_BY_ENTITY.us, "usd");
  assert.equal(CURRENCY_BY_ENTITY.eg, "egp");
});

test("there is no such thing as an InstaPay transfer in dollars", () => {
  assert.equal(payoutCurrencyFor("instapay"), "egp");
  assert.equal(payoutCurrencyFor("wallet"), "egp");
  assert.equal(payoutCurrencyFor("stripe"), "usd");
});
