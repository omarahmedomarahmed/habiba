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

/**
 * 🔴 C350 — this test used to assert that an Egyptian number gets NO line.
 *
 * That was the correct assertion for as long as it was true: nobody had dialled
 * the number, and `lib/crisis/line.ts` refuses to print a number from memory.
 * On 2026-09-14 the product's owner verified 105 and the two menu choices that
 * reach the mental health service, so the honest assertion changed with the
 * fact. It is written out here rather than quietly edited, because a test that
 * flips from "must be absent" to "must be present" with no note reads like
 * somebody moved a goalpost.
 *
 * What did NOT change is the rule underneath, and the test below it is the
 * control that proves so: four countries with no verified line still get
 * nothing. A table that answers for everybody would pass this test and fail the
 * product.
 */
test("🔴 an Egyptian number gets 105, and the menu choices that reach the service", () => {
  const line = lineForNumber("+201001234567");
  assert.equal(line?.tel, "105");
  assert.equal(line?.label, "105");
  assert.equal(countryForNumber("+201001234567"), "EG");

  /* The number alone is not the answer: 105 opens a menu two choices deep. */
  assert.ok(line?.steps?.en.includes("1"), "the English route must name what to press");
  assert.ok(line?.steps?.ar.includes("١"), "and the Arabic route in Arabic digits");
});

test("🔴 …and a United States number still gets 988, with no menu", () => {
  assert.deepEqual(lineForNumber("+15551234567"), { label: "988", tel: "988" });
  assert.equal(countryForNumber("+15551234567"), "US");

  /* Steps are absent, not empty: 988 answers directly and inventing a menu for
     it would be the same failure as inventing a number. */
  assert.equal(lineForNumber("+15551234567")?.steps, undefined);
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

test("the old by-country lookup answers for both verified countries and nobody else", () => {
  assert.deepEqual(crisisLine("US"), { label: "988", tel: "988" });
  assert.equal(crisisLine("EG")?.tel, "105");
  assert.equal(crisisLine("GB"), null, "no verified line, so no number");
  assert.equal(crisisLine(null), null);
});

test("🔴 a line an operator configured wins, and carries no menu it was not given", () => {
  /* `country_settings` has a label and a number and no third column, so a
     configured line has no steps. Falling back to the table's menu for a
     number an operator has REPLACED would print the route through one phone
     system beside a different phone system's number. */
  const configured = crisisLine("EG", { label: "16000", tel: "16000" });
  assert.equal(configured?.tel, "16000");
  assert.equal(configured?.steps, undefined);
});

/* ---------------------------------------------- W1-09 every reader, a number */

/*
 * 🔴 W1-09: the SOS sheet printed nothing for an English reader with no phone,
 * because the only country signals were a `+20`/`+1` number and an Arabic
 * locale, and only the two built-in lines existed. Operators can configure a
 * line per country; the sheet now uses them, and when it cannot tell where the
 * reader is it shows every enabled country's line beside "your local emergency
 * number" rather than nothing.
 */
const COUNTRIES = [
  { code: "EG", name: "Egypt", enabled: true, crisisLineLabel: null, crisisLineTel: null },
  { code: "AE", name: "United Arab Emirates", enabled: true, crisisLineLabel: "800 4673", crisisLineTel: "8004673" },
  { code: "US", name: "United States", enabled: false, crisisLineLabel: null, crisisLineTel: null },
  { code: "GB", name: "United Kingdom", enabled: true, crisisLineLabel: null, crisisLineTel: null },
];
/* Monday 12:00 UTC is mid afternoon in Cairo whatever the clock change. */
const MONDAY_NOON = new Date("2026-09-21T12:00:00Z");
/* Friday: 105 is not staffed, per RESEARCH-2 section 1 (Ahram Online). */
const FRIDAY_NOON = new Date("2026-09-25T12:00:00Z");

test("🔴 W1-09 a reader we cannot place gets every enabled country's line, not nothing", async () => {
  const { sosLinesFor } = await import("../lib/crisis/sos");
  const tels = sosLinesFor({ phone: null, country: null, countries: COUNTRIES, now: MONDAY_NOON }).map(
    (entry) => entry.line.tel,
  );
  for (const tel of ["105", "123", "112", "8004673"]) assert.ok(tels.includes(tel), `${tel} should be offered`);
  assert.ok(!tels.includes("988"), "a country that is switched off is not offered");
});

test("🔴 W1-09 a configured line reaches its own country, by page country or by phone", async () => {
  const { sosLinesFor } = await import("../lib/crisis/sos");
  const byCountry = sosLinesFor({ country: "AE", countries: COUNTRIES, now: MONDAY_NOON });
  assert.deepEqual(byCountry.map((entry) => entry.line.tel), ["8004673"]);
  const byPhone = sosLinesFor({ phone: "+971501234567", country: "EG", countries: COUNTRIES, now: MONDAY_NOON });
  assert.deepEqual(byPhone.map((entry) => entry.line.tel), ["8004673"], "their own number beats the page");
});

test("🔴 W1-09 Egypt never gets 105 alone, and outside its hours the always-open numbers lead", async () => {
  const { sosLinesFor } = await import("../lib/crisis/sos");
  const open = sosLinesFor({ country: "EG", countries: COUNTRIES, now: MONDAY_NOON });
  assert.deepEqual(open.map((entry) => entry.line.tel).sort(), ["105", "112", "123"]);
  assert.equal(open[0]!.line.tel, "105");
  assert.equal(open[0]!.open, true);

  const closed = sosLinesFor({ country: "EG", countries: COUNTRIES, now: FRIDAY_NOON });
  assert.notEqual(closed[0]!.line.tel, "105", "a line that is likely closed is not the first button");
  assert.equal(closed[0]!.open, true);
  assert.equal(closed.find((entry) => entry.line.tel === "105")?.open, false);
});

test("W1-09 a line with unknown hours is not labelled open or closed", async () => {
  const { sosLinesFor } = await import("../lib/crisis/sos");
  const [ae] = sosLinesFor({ country: "AE", countries: COUNTRIES, now: FRIDAY_NOON });
  assert.equal(ae!.open, null);
});

test("W1-09 with no settings loaded, the verified table is the fallback, never silence", async () => {
  const { sosLinesFor } = await import("../lib/crisis/sos");
  const tels = sosLinesFor({ now: MONDAY_NOON }).map((entry) => entry.line.tel);
  for (const tel of ["988", "105", "123", "112"]) assert.ok(tels.includes(tel), `${tel} should be offered`);
});

test("W1-09 control: a country we can place and hold no line for gets the sentence, not a stranger's number", async () => {
  const { sosLinesFor } = await import("../lib/crisis/sos");
  assert.deepEqual(sosLinesFor({ country: "GB", countries: COUNTRIES, now: MONDAY_NOON }), []);
  assert.deepEqual(sosLinesFor({ phone: "+447700900000", countries: COUNTRIES, now: MONDAY_NOON }), []);
});
