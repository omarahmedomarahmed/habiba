import assert from "node:assert/strict";
import { test } from "node:test";

import { receiptInChargedCurrency } from "../lib/billing/receipt-figures";

/**
 * Board 807: a receipt reads in the money the patient sent, and its lines add
 * up to exactly what left their account.
 */

const covered = {
  currency: "usd",
  priceCents: 1_200,
  coveredCents: 120,
  vatCents: 0,
  cardFeeCents: 0,
  totalCents: 1_080,
};

test("Board 807 a 10%-covered session paid EGP 540 by transfer reads in pounds", () => {
  const out = receiptInChargedCurrency(covered, { minor: 54_000, currency: "EGP" });
  assert.deepEqual(out, {
    currency: "EGP",
    priceCents: 60_000,
    coveredCents: 6_000,
    vatCents: 0,
    cardFeeCents: 0,
    totalCents: 54_000,
  });
});

test("Board 807 the lines always add up to what was taken, whatever the rounding", () => {
  for (const minor of [54_001, 53_999, 51_234, 1]) {
    const out = receiptInChargedCurrency({ ...covered, vatCents: 151 }, { minor, currency: "EGP" });
    assert.equal(out.priceCents - out.coveredCents + out.vatCents + out.cardFeeCents, minor);
    assert.equal(out.totalCents, minor);
    assert.ok(out.coveredCents >= 0);
  }
  const plain = receiptInChargedCurrency(
    { currency: "usd", priceCents: 1_200, coveredCents: 0, vatCents: 168, cardFeeCents: 0, totalCents: 1_368 },
    { minor: 68_401, currency: "EGP" },
  );
  assert.equal(plain.coveredCents, 0);
  assert.equal(plain.priceCents + plain.vatCents, 68_401);
});

test("Board 807 CONTROL nothing taken in another currency: the figures as booked", () => {
  assert.equal(receiptInChargedCurrency(covered, null), covered);
  assert.equal(receiptInChargedCurrency(covered, { minor: 1_080, currency: "USD" }), covered);
});
