import assert from "node:assert/strict";
import { test } from "node:test";

import {
  assertClaimed,
  isClaimed,
  normaliseEmail,
  normalisePhone,
  redactName,
  UnclaimedError,
} from "../lib/data/people";

/**
 * The person layer's rules, as arithmetic.
 *
 * The one that matters is 5.5 — an unclaimed record may not be shared, granted
 * or merged, because there is nobody to ask. §6 calls that a hard rule, so it
 * gets a test rather than a comment.
 */

const unclaimed = { id: "11111111-1111-1111-1111-111111111111", claimedAt: null };
const claimed = { id: "22222222-2222-2222-2222-222222222222", claimedAt: new Date() };

/* --------------------------------------------------------------- the rule -- */

test("an unclaimed record cannot be shared, and the refusal is not ignorable", () => {
  // Throws rather than returning false: every caller's correct behaviour is
  // identical — stop — and a boolean is a thing somebody forgets to check.
  assert.throws(() => assertClaimed(unclaimed, "shared"), UnclaimedError);
  assert.throws(() => assertClaimed(unclaimed, "merged"), UnclaimedError);
  assert.throws(() => assertClaimed(unclaimed, "granted to another therapist"), UnclaimedError);
});

test("the refusal says why, in words a clinician can repeat to a patient", () => {
  try {
    assertClaimed(unclaimed, "shared");
    assert.fail("should have thrown");
  } catch (error) {
    const message = (error as Error).message;
    assert.match(message, /has not been claimed/);
    assert.match(message, /Only they can agree/);
    // Never leaks the id into a message somebody might show.
    assert.ok(!message.includes(unclaimed.id));
  }
});

test("a claimed record passes", () => {
  assert.doesNotThrow(() => assertClaimed(claimed, "shared"));
  assert.equal(isClaimed(claimed), true);
  assert.equal(isClaimed(unclaimed), false);
});

test("claimed is a timestamp, not a flag — an epoch date still counts", () => {
  // Guards against anyone "simplifying" the check to a truthiness test: the
  // Unix epoch is a real Date and is falsy in no sensible reading, but a
  // `claimedAt.getTime()` check would treat 1970 as unclaimed.
  assert.equal(isClaimed({ claimedAt: new Date(0) }), true);
});

/* ------------------------------------------------------------ normalising -- */

test("emails match across the spellings people actually type", () => {
  assert.equal(normaliseEmail("  Omar@Example.COM "), "omar@example.com");
  assert.equal(normaliseEmail(""), null);
  assert.equal(normaliseEmail("   "), null);
  assert.equal(normaliseEmail(null), null);
  assert.equal(normaliseEmail(undefined), null);
});

test("phone numbers strip formatting and keep the country prefix", () => {
  assert.equal(normalisePhone("+20 100 123 4567"), "+201001234567");
  assert.equal(normalisePhone("(020) 7123-4567"), "02071234567");
  assert.equal(normalisePhone("+20-100-123-4567"), "+201001234567");
  // Two spellings of one number must match.
  assert.equal(normalisePhone("+20 100 1234567"), normalisePhone("+201001234567"));
});

test("a fragment that is not a phone number is not treated as one", () => {
  /*
   * The matcher keys on this, so a too-short value must be null rather than a
   * string that could collide with somebody else's. "123" matching "123" would
   * suggest two strangers are the same person.
   */
  assert.equal(normalisePhone("123"), null);
  assert.equal(normalisePhone("n/a"), null);
  assert.equal(normalisePhone(""), null);
  assert.equal(normalisePhone(null), null);
});

/* -------------------------------------------------------------- redaction -- */

test("a name is shown as initials, so confirming it proves something", () => {
  // §3 step 4: "H••••• A•••••". The person has not proved anything yet, so a
  // full name would tell whoever typed an address who it belongs to.
  assert.equal(redactName("Habiba", "Ahmed"), "H••••• A••••");
  assert.equal(redactName("Sam", null), "S••");
});

test("redaction works in Arabic, which is most of this product", () => {
  // Counts characters rather than assuming an alphabet.
  assert.equal(redactName("حبيبة", "أحمد"), "ح•••• أ•••");
});

test("a one-letter name is still masked", () => {
  // Never returns the name itself: "A" -> "A•" rather than "A".
  assert.equal(redactName("A", null), "A•");
  assert.equal(redactName("", null), "");
});

test("redaction never reveals the length exactly by accident", () => {
  // It does encode length, which is accepted: the person confirming knows their
  // own name. What it must never do is emit the name.
  const redacted = redactName("Habiba", "Ahmed");
  assert.ok(!redacted.includes("abiba"));
  assert.ok(!redacted.includes("hmed"));
});
