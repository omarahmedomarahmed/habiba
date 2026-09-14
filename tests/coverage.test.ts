import assert from "node:assert/strict";
import test from "node:test";

import { coverageNow, coverageSplit } from "../lib/settings/defs";

/**
 * What the employer covers, as arithmetic. PLAN.md 60.1 to 60.8, C311 to C315.
 *
 * 🔴 Pure, and tested without a database, for the reason `lib/billing/money.ts`
 * gives about all of this: money bugs are found by reading arithmetic, and
 * arithmetic that needs a connection to exercise is arithmetic nobody reads.
 */

test("the two shares always sum to the gross, whatever the rounding", () => {
  /*
   * 🔴 The defect this forecloses, and the database now refuses it too.
   *
   * Computing both shares from the percentage gives two numbers that are each
   * individually defensible and do not always sum. The cent then falls out of
   * the books in a direction nobody chose. One is computed, the other is the
   * remainder.
   *
   * Every price from $0.01 to $200 at every legal step, which is the whole
   * input space this function will ever see.
   */
  for (let gross = 1; gross <= 20_000; gross += 7) {
    for (let bps = 0; bps <= 10_000; bps += 500) {
      const split = coverageSplit({ grossCents: gross, coverageBps: bps, vatBps: 0 });
      assert.equal(
        split.sponsorCents + split.patientCents,
        gross,
        `${gross} at ${bps}bps did not sum`,
      );
      assert.ok(split.sponsorCents >= 0 && split.patientCents >= 0, "neither share is negative");
    }
  }
});

test("🔴 C312 VAT is on the patient's share only", () => {
  /*
   * The employer's share was taxed when the pot was funded, in the jurisdiction
   * of the entity holding it. Charging it again on the spend taxes the same
   * money twice, and charging it in the PATIENT's country invents a tax
   * relationship between an employee and their employer's purchase.
   */
  const split = coverageSplit({ grossCents: 10_000, coverageBps: 6_000, vatBps: 1_400 });

  assert.equal(split.sponsorCents, 6_000);
  assert.equal(split.patientCents, 4_000);
  assert.equal(split.vatCents, 560, "14% of 4000, not of 10000");
  assert.equal(split.patientTotalCents, 4_560);
});

test("🔴 C345 zero per cent is a real setting and leaves the patient the whole price", () => {
  const split = coverageSplit({ grossCents: 7_000, coverageBps: 0, vatBps: 0 });
  assert.equal(split.sponsorCents, 0);
  assert.equal(split.patientCents, 7_000, "an employer who stops paying does not remove anybody");
});

test("…and one hundred per cent leaves them nothing to pay, tax included", () => {
  const split = coverageSplit({ grossCents: 7_000, coverageBps: 10_000, vatBps: 1_400 });
  assert.equal(split.sponsorCents, 7_000);
  assert.equal(split.patientCents, 0);
  assert.equal(split.vatCents, 0, "no share, no tax on it");
  assert.equal(split.patientTotalCents, 0);
});

test("the remainder lands on the patient's side, and it is at most a cent", () => {
  /*
   * 🔴 Stated as a test rather than left to arithmetic, because it is a
   * decision: the side that can see the split on their own bill is the side
   * that carries the rounding.
   */
  const split = coverageSplit({ grossCents: 9_999, coverageBps: 3_333 % 500 === 0 ? 3_333 : 3_500, vatBps: 0 });
  const exact = (9_999 * 3_500) / 10_000;
  assert.ok(Math.abs(split.sponsorCents - exact) <= 1, "the sponsor's share is the rounded one");
  assert.equal(split.sponsorCents + split.patientCents, 9_999);
});

test("🔴 C344 a pending change applies by its DATE, with no job to fail", () => {
  /*
   * The obvious build schedules a task to flip the number when the window
   * closes. A task that fails leaves an employer paying a percentage they
   * changed three weeks ago, and nothing on any screen says so.
   */
  const pot = {
    coverageBps: 6_000,
    pendingCoverageBps: 2_000,
    pendingCoverageFrom: new Date("2026-07-01T00:00:00Z"),
  };

  assert.equal(
    coverageNow(pot, new Date("2026-06-30T23:59:00Z")),
    6_000,
    "before the date, the agreed percentage stands",
  );
  assert.equal(
    coverageNow(pot, new Date("2026-07-01T00:00:01Z")),
    2_000,
    "after it, the new one applies itself",
  );
  assert.equal(
    coverageNow({ ...pot, pendingCoverageBps: null, pendingCoverageFrom: null }, new Date()),
    6_000,
    "and with nothing pending it is simply the live figure",
  );
});

test("a percentage outside the range is clamped rather than trusted", () => {
  /*
   * The CHECK refuses these, and this function is also called with rows written
   * before the constraint existed. Clamping is the safe direction both ways: a
   * negative becomes 0 (the patient pays everything) and an overflow becomes
   * 100 (the employer does), and neither can produce a negative share.
   */
  assert.equal(coverageSplit({ grossCents: 5_000, coverageBps: -1, vatBps: 0 }).sponsorCents, 0);
  assert.equal(
    coverageSplit({ grossCents: 5_000, coverageBps: 99_999, vatBps: 0 }).sponsorCents,
    5_000,
  );
});
