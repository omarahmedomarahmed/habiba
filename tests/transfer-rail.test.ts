import assert from "node:assert/strict";
import test from "node:test";

import { egpMinorFor } from "../lib/billing/manual";
import { potTopUpMoney } from "../lib/billing/pot";
import { payableCents } from "../lib/db/schema";
import { vatOn } from "../lib/settings";

/**
 * Sprint 76 — THE ARITHMETIC OF THE ONLY RAIL THIS MARKET HAS, with no database.
 *
 * ## Why this suite did not exist and had to
 *
 * Thirty suites agree about what we charge, and not one of them touched the
 * Egyptian transfer rail: every sum on it was reached through a query, so the
 * only way to exercise it was to run the product. That is how `grantPotTopUp`
 * came to credit a pot its gross for a sprint, and how a rail that a country
 * says owes 14% collected none of it. Both were arithmetic, and arithmetic that
 * needs a connection to exercise is arithmetic nobody exercises.
 *
 * ## 🔴 THE ORDER OF OPERATIONS IS THE PART A TAX AUTHORITY CARES ABOUT
 *
 * VAT is computed on the settlement amount in DOLLARS, and the total is
 * converted to pounds afterwards. Doing it the other way gives nearly the same
 * number and only one of them is defensible, so "nearly" is not a defence. The
 * tests below pin the order, not just the answer.
 *
 * ## And the two numbers that are not the same number
 *
 * What a payer SENDS and what it SETTLES are separate facts, and 0106 exists
 * because one column tried to be both: a company that sent 10,000 EGP had a
 * dollar balance credited 1,000,000, fifty times what they paid, with no
 * processor anywhere to reverse it.
 */

/* ------------------------------------------------------------ the tax -- */

test("VAT is added on top of the price, never carved out of it", () => {
  /*
   * 🔴 THE DEFECT THIS IS ABOUT. The first pot implementation divided the tax
   * OUT of the amount a company chose, so choosing $1,000 credited $877 and
   * nobody could say why. A payer picks what they are buying; the tax is what
   * it costs them on top.
   */
  const money = potTopUpMoney({ creditCents: 100_000, vatBps: 1400 });

  assert.equal(money.creditCents, 100_000, "the pot receives what they chose");
  assert.equal(money.vatCents, 14_000, "14% of the credit");
  assert.equal(money.settlesCents, 114_000, "and they send the sum of both");
});

test("a jurisdiction with no rate is charged nothing, not a guess", () => {
  const money = potTopUpMoney({ creditCents: 100_000, vatBps: 0 });

  assert.equal(money.vatCents, 0);
  assert.equal(money.settlesCents, money.creditCents);
});

test("the patient's session: 1,000 EGP of therapy is 1,140 EGP to send", () => {
  /*
   * 🔴 THE SUM THE FOUNDER ASKED ABOUT, pinned. Our 15% comes OUT of the
   * session price and the therapist nets the rest; only the tax is added. A
   * patient pays 1,140 and not 1,290, and the difference between those two
   * answers is a fee charged twice.
   */
  const priceCents = 2_000; // $20, which is 1,000 EGP at 50.
  const vat = vatOn(priceCents, 1400);
  const settles = priceCents + vat;

  const rateMicro = 50_000_000; // 50 EGP to the dollar.
  assert.equal(egpMinorFor(priceCents, rateMicro), 100_000, "1,000.00 EGP of therapy");
  assert.equal(egpMinorFor(vat, rateMicro), 14_000, "140.00 EGP of VAT");
  assert.equal(egpMinorFor(settles, rateMicro), 114_000, "1,140.00 EGP to send");

  /* And the platform's cut is inside the price, so it is not in the total. */
  const ourCut = Math.round(priceCents * 0.15);
  assert.equal(ourCut + 1_700, priceCents, "$3 of ours, $17 to the therapist");
});

test("the tax is taken in dollars and converted after, not the reverse", () => {
  /*
   * 🔴 BOTH ORDERS ARE SHOWN, so the one we do not use is visible rather than
   * merely absent. They agree here and they do not always: the rounding lands
   * differently the moment a rate has a fraction in it, and the defensible
   * answer is the one where the tax is a percentage of a price we set.
   */
  const priceCents = 1_999;
  const rateMicro = 48_500_000;

  const taxThenConvert = egpMinorFor(priceCents + vatOn(priceCents, 1400), rateMicro);
  const convertThenTax = (() => {
    const pounds = egpMinorFor(priceCents, rateMicro);
    return pounds + vatOn(pounds, 1400);
  })();

  assert.equal(taxThenConvert, 110_532, "the order we use");
  assert.equal(convertThenTax, 110_525, "and the order we do not");
  assert.notEqual(
    taxThenConvert,
    convertThenTax,
    "seven piastres apart here, which is the whole reason the order has to be fixed",
  );
});

/* ------------------------------------------------------- the conversion -- */

test("dollars become pounds at the operator's rate, rounded once", () => {
  assert.equal(egpMinorFor(2_000, 50_000_000), 100_000, "$20 at 50");
  assert.equal(egpMinorFor(100, 50_000_000), 5_000, "a dollar is the rate itself");
  assert.equal(egpMinorFor(0, 50_000_000), 0);
});

test("a fractional rate rounds once, at the end", () => {
  /*
   * 🔴 ROUNDED ONCE. Converting each line of a bill and summing the results
   * gives a different total from converting the sum, and a payer whose bank
   * transfer is a piastre off a claim is a payer an operator cannot match.
   */
  /*
   * ⚠️ AND THE FIRST DRAFT OF THIS TEST PROVED NOTHING. It used $4, $4 and $3
   * at 48.37, where the two methods happen to agree, and asserted that they
   * differed — so it failed honestly rather than passing on a coincidence,
   * which is the only thing that saved it. Half-cent errors cancel far more
   * often than they accumulate, so a case has to be CHOSEN rather than
   * assumed: an odd number of cents at a rate ending in .5 rounds up on every
   * line, and the gains add up.
   */
  const rateMicro = 48_500_000;
  const lines = [401, 403];

  const eachThenSum = lines.reduce((sum, c) => sum + egpMinorFor(c, rateMicro), 0);
  const sumThenOnce = egpMinorFor(
    lines.reduce((a, b) => a + b, 0),
    rateMicro,
  );

  assert.equal(sumThenOnce, 38_994, "the total we quote, rounded once");
  assert.equal(eachThenSum, 38_995, "and a piastre more if every line is rounded first");
  assert.notEqual(eachThenSum, sumThenOnce, "which is a claim an operator cannot match");
});

/* --------------------------------------------------------- the line items -- */

test("a discounted invoice is payable at its discounted amount, never below zero", () => {
  assert.equal(payableCents({ amountCents: 400, discountCents: 100 }), 300);
  assert.equal(payableCents({ amountCents: 400, discountCents: 0 }), 400);
  assert.equal(
    payableCents({ amountCents: 400, discountCents: 900 }),
    0,
    "a credit larger than the bill settles it, it does not owe the payer money",
  );
});

test("the lines a payer reads add up to the total they are asked for", () => {
  /*
   * 🔴 76.16 — the picker's whole promise. The lines are a description and
   * `settlesCents` is what money moves on, so they must agree before tax, and
   * the tax is the one thing that is never a line.
   */
  const invoices = [
    { amountCents: 400, discountCents: 0 },
    { amountCents: 400, discountCents: 0 },
    { amountCents: 400, discountCents: 100 },
  ];
  const lines = invoices.map((i) => payableCents(i));
  const total = lines.reduce((a, b) => a + b, 0);

  assert.equal(total, 1_100, "$11 across three sessions");
  assert.equal(
    lines.filter(Boolean).length,
    3,
    "and three lines, so nothing disappeared into the sum",
  );
});

/* ------------------------------------------------------- what NOT to do -- */

test("CONTROL the old pot arithmetic credited the gross, and would fail these", () => {
  /*
   * 🔴 THE PLANTED OFFENDER. `grantPotTopUp` added `amount_cents` — pounds —
   * straight onto a dollar balance. A company sending 10,000 EGP was credited
   * 1,000,000 dollar cents: fifty times what they paid.
   *
   * Written out rather than described, because a defect a suite only mentions
   * is a defect the suite cannot tell you has come back.
   */
  const sentEgpMinor = 1_000_000; // 10,000.00 EGP
  const wrong = sentEgpMinor; // straight onto a USD balance
  const right = Math.round((sentEgpMinor * 1_000_000) / 50_000_000); // $200

  assert.equal(right, 20_000, "$200.00 in cents");
  assert.equal(wrong / right, 50, "and the old answer was fifty times it");
});
