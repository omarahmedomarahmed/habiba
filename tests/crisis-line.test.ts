import assert from "node:assert/strict";
import { test } from "node:test";

import { countryForNumber, crisisLine, lineForNumber } from "../lib/crisis/line";
import { countryFromE164 } from "../lib/phone/e164";

/**
 * Whose crisis number the orb prints. PLAN.md 37R.25, C184, C98.
 *
 * 🔴 The walkthrough found the SOS sheet showing `988 · United States` to a
 * patient whose number begins `+20`. Every refusal below is paired with the
 * acceptance it must not swallow (C165): a guard that answers "no line" for
 * everybody would pass the Egyptian half of this file and leave the one
 * verified line in the product unreachable.
 */

test("🔴 an Egyptian number gets no line, because we have not verified one", () => {
  assert.equal(lineForNumber("+201001234567"), null);
  assert.equal(countryForNumber("+201001234567"), null);
});

test("🔴 …and a United States number still gets 988", () => {
  assert.deepEqual(lineForNumber("+15551234567"), { label: "988", tel: "988" });
  assert.equal(countryForNumber("+15551234567"), "US");
});

test("every country we have a dialling code for is answered, one way or the other", () => {
  /* Not a smoke test: it asserts the function never throws and never invents.
     Anything that comes back must be a line we actually hold. */
  for (const number of ["+9665551234", "+971501234567", "+447700900000", "+491701234567"]) {
    const line = lineForNumber(number);
    assert.equal(line, null, `${number} has no verified line and must not be given one`);
  }
});

test("a number with no country, or no plus, is refused rather than guessed", () => {
  assert.equal(lineForNumber(null), null);
  assert.equal(lineForNumber(""), null);
  assert.equal(lineForNumber("01001234567"), null, "national format names no country");
  assert.equal(lineForNumber("988"), null);
});

test("longest prefix wins, so +20 is Egypt rather than a shorter match", () => {
  /* `+1` is the United States and `+20` is Egypt; a naive startsWith over an
     unordered table can match the wrong one when codes share a first digit. */
  assert.equal(countryFromE164("+201001234567"), "EG");
  assert.equal(countryFromE164("+9701234567"), "PS", "970 beats 9 and 97");
  assert.equal(countryFromE164("+9661234567"), "SA");
});

test("🔴 a shared dialling code answers only when the countries agree", () => {
  /* +1 is the US and Canada. One verified line between them, so it is not a
     guess to print it. If Canada ever gets a different verified line, this
     test fails and the orb correctly falls silent for +1 until somebody
     decides what to do about it. */
  assert.deepEqual(lineForNumber("+14165550000"), { label: "988", tel: "988" });
});

test("the country lookup for a form is display only and may tie-break", () => {
  /* `countryFromE164` is allowed to pick one of two countries sharing a code,
     because it labels a selector that `toE164` ignores for E.164 input.
     `lineForNumber` is not allowed to, because it dials. */
  assert.ok(["US", "CA"].includes(countryFromE164("+14165550000")!));
});

test("the old by-country lookup is unchanged", () => {
  assert.deepEqual(crisisLine("US"), { label: "988", tel: "988" });
  assert.equal(crisisLine("EG"), null);
  assert.equal(crisisLine(null), null);
});
