import assert from "node:assert/strict";
import { test } from "node:test";

/**
 * The two questions, as arithmetic. PLAN.md 13.5–13.8, §3b.
 *
 * The database half — a second account cannot take a claimed number, a "no" is
 * remembered, three wrong names lock the record — is asserted against the real
 * database in `scripts/verify-sprint13.ts`, because those are constraints and a
 * constraint that is never exercised is a constraint nobody has proved.
 *
 * What is tested here is the part that decides whether a person reaches their
 * own record: the name comparison. It is pure, it runs in two alphabets, and
 * getting it wrong in either direction is a real harm — too strict and a person
 * cannot claim their own history, too loose and somebody claims a stranger's.
 */

import { nameMatches, normaliseName } from "../lib/data/name-match";

test("a person typing their own name on a phone is not punished for it", () => {
  // The realistic near-misses: a trailing space from autocomplete, a capital
  // from the keyboard's autoshift, a double space from a thumb.
  assert.equal(normaliseName("Sara"), normaliseName("sara"));
  assert.equal(normaliseName("Sara"), normaliseName(" Sara "));
  assert.equal(normaliseName("Sara Mahmoud"), normaliseName("Sara  Mahmoud"));
  assert.equal(normaliseName("SARA"), normaliseName("Sara"));
});

test("accents do not decide whether somebody reaches their own record", () => {
  assert.equal(normaliseName("José"), normaliseName("Jose"));
  assert.equal(normaliseName("Zoë"), normaliseName("Zoe"));
});

test("🔴 Arabic diacritics are stripped, and the letters underneath are not", () => {
  // A therapist typing a name with harakat and a patient typing it without are
  // the same person. This is the case an English-only comparison gets wrong,
  // and it is most of this product's caseload.
  assert.equal(normaliseName("مُحَمَّد"), normaliseName("محمد"));
  assert.equal(normaliseName("سَارَة"), normaliseName("سارة"));

  // …but two genuinely different Arabic names still differ.
  assert.notEqual(normaliseName("محمد"), normaliseName("محمود"));
});

test("🔴 a different name is a different name", () => {
  // The direction that matters more: loose enough to be kind, never loose
  // enough to hand somebody a stranger's clinical history.
  assert.notEqual(normaliseName("Sara"), normaliseName("Sarah"));
  assert.notEqual(normaliseName("Ali"), normaliseName("Aly"));
  assert.notEqual(normaliseName("Mona"), normaliseName("Mena"));
});

test("🔴 empty is never a match, even against an empty record", () => {
  // A name nobody typed is not a name that was confirmed.
  assert.equal(nameMatches("", ""), false);
  assert.equal(nameMatches("   ", null), false);
  assert.equal(nameMatches(null, "Sara"), false);
  assert.equal(nameMatches("Sara", null), false);
});

test("nameMatches is the whole comparison, and it is the kind one", () => {
  assert.equal(nameMatches(" sara ", "Sara"), true);
  assert.equal(nameMatches("مُحَمَّد", "محمد"), true);
  assert.equal(nameMatches("Sarah", "Sara"), false);
});
