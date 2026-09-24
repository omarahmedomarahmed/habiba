import assert from "node:assert/strict";
import { test } from "node:test";

import { readSource } from "../scripts/_verify";
import {
  moneyEntryFigures,
  refundOwedCents,
  splitRefundPlan,
} from "../lib/billing/split-refund";

/**
 * W2-S12: a refund of a partly company-covered session returns each party
 * exactly what they paid. `takeover/FIX-PLAN.md`, Wave 2.
 *
 * The money itself is exercised against the database in `verify:w2s` (pot
 * balance, journal, refund queue); this is the arithmetic and the wiring, which
 * need no database and so run where 0134 is not applied.
 */

const split = (coverageBps: number, grossCents = 10_000) => {
  const sponsorShareCents = Math.round((grossCents * coverageBps) / 10_000);
  return {
    grossCents,
    coverageBps,
    sponsorShareCents,
    patientShareCents: grossCents - sponsorShareCents,
  };
};

test("W2-S12 covered in full: the pot gets the whole price, the employee had nothing to pay", () => {
  const plan = splitRefundPlan({ ...split(10_000), vatCents: 0, employeePaid: false, stripePaymentIntentId: null });
  assert.equal(plan.potCents, 10_000);
  assert.deepEqual(plan.employee, { rail: "none", cents: 0 });
});

test("W2-S12 covered half, share unpaid: the pot gets 50, never 100, and the 50 is no longer owed", () => {
  const plan = splitRefundPlan({ ...split(5_000), vatCents: 0, employeePaid: false, stripePaymentIntentId: null });
  assert.equal(plan.potCents, 5_000);
  assert.deepEqual(plan.employee, { rail: "unpaid", cents: 0 });
});

test("W2-S12 covered half, share paid by card: their own charge is refunded, VAT with it", () => {
  const plan = splitRefundPlan({
    ...split(5_000),
    vatCents: 700,
    employeePaid: true,
    stripePaymentIntentId: "pi_example",
  });
  assert.equal(plan.potCents, 5_000);
  assert.deepEqual(plan.employee, { rail: "card", cents: 5_700 });
});

test("W2-S12 covered half, share paid by transfer: a person sends it back from the queue", () => {
  const plan = splitRefundPlan({ ...split(5_000), vatCents: 700, employeePaid: true, stripePaymentIntentId: null });
  assert.equal(plan.potCents, 5_000);
  assert.deepEqual(plan.employee, { rail: "queue", cents: 5_700 });
});

test("W2-S12 a pot row from before the split (0090) paid the whole price, and gets it back", () => {
  const plan = splitRefundPlan({
    grossCents: 4_000,
    coverageBps: 0,
    sponsorShareCents: 0,
    patientShareCents: 0,
    vatCents: 0,
    employeePaid: false,
    stripePaymentIntentId: null,
  });
  assert.equal(plan.potCents, 4_000);
  assert.equal(plan.employee.rail, "none");
});

test("W2-S12 the refund queue owes an employee their own share and VAT, never the company's", () => {
  assert.equal(refundOwedCents({ ...split(5_000), fundingSource: "pot", vatCents: 700 }), 5_700);
  assert.equal(refundOwedCents({ ...split(10_000), fundingSource: "pot", vatCents: 0 }), 0);
  /* CONTROL: a card or transfer payment with no pot in it is owed whole, as before. */
  assert.equal(
    refundOwedCents({ ...split(0), fundingSource: "card", sponsorShareCents: 0, patientShareCents: 10_000, vatCents: 1_400 }),
    11_400,
  );
});

test("W2-S12 the company's refund entry mirrors the session's: its share, and the employee's share as frozen", () => {
  for (const bps of [10_000, 5_000, 6_000, 0]) {
    const figures = moneyEntryFigures(split(bps, 2_500));
    assert.equal(figures.priceCents, 2_500);
    assert.equal(figures.coveredCents + figures.employeeCents, 2_500, `at ${bps}`);
  }
  const half = moneyEntryFigures(split(5_000));
  assert.deepEqual(half, { priceCents: 10_000, coverageBps: 5_000, coveredCents: 5_000, employeeCents: 5_000 });
});

test("W2-S12 the session entry and the refund entry are written from the same figures", () => {
  const pot = readSource("lib/billing/pot.ts");
  const writes = [...pot.matchAll(/recordMoneyEntry\(\{([\s\S]*?)\}\);/g)].map((match) => match[1]!);
  assert.equal(writes.length, 2, "one session entry and one refund entry");
  for (const body of writes) {
    assert.match(body, /moneyEntryFigures\(/, "figures come from the one helper");
    assert.doesNotMatch(body, /coveredCents:|employeeCents:/, "no figure is typed in by hand");
  }
});

test("W2-S12 a pot refund credits the pot its share, never the gross", () => {
  const pot = readSource("lib/billing/pot.ts");
  const start = pot.indexOf("export async function refundToPot");
  const body = pot.slice(start, pot.indexOf("\nexport ", start + 1));
  assert.ok(start >= 0);
  assert.doesNotMatch(body, /balanceCents\}\s*\+\s*\$\{payment\.grossCents\}/);
  assert.doesNotMatch(body, /amountCents:\s*-?payment\.grossCents/);
});

test("W2-S12 a pot refund does not wait on Stripe being configured", () => {
  const connect = readSource("lib/billing/connect.ts");
  const start = connect.indexOf("export async function refundSessionPayment");
  const body = connect.slice(start, connect.indexOf("\nexport ", start + 1));
  assert.ok(body.indexOf('fundingSource === "pot"') >= 0);
  assert.ok(
    body.indexOf('fundingSource === "pot"') < body.indexOf("Payments are not configured"),
    "the pot branch comes before the Stripe check",
  );
});
