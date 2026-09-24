import assert from "node:assert/strict";
import { test } from "node:test";

import { availableToWithdraw } from "../lib/billing/available";

/**
 * 🔴 What the earnings page offers to withdraw.
 *
 * `held` is read from the ledger, and "Mark sent" posts the payout to the
 * ledger (W1-04), so a sent payout has already left `held`. Only requested and
 * approved ones are still inside it. The page subtracted sent ones a second
 * time, showing a clinician less than they have.
 */
const request = (status: string, amountCents: number) => ({ status, amountCents });

test("a sent payout is already out of held and is not subtracted again", () => {
  assert.equal(availableToWithdraw(10_000, [request("sent", 4_000)]), 10_000);
});

test("requested and approved payouts are still inside held and are subtracted", () => {
  assert.equal(availableToWithdraw(10_000, [request("requested", 3_000), request("approved", 2_000)]), 5_000);
});

test("never below zero", () => {
  assert.equal(availableToWithdraw(1_000, [request("requested", 3_000)]), 0);
});
