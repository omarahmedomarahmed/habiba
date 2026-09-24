import assert from "node:assert/strict";
import { test } from "node:test";

import { licenceStanding, licenceValidUntil } from "../lib/licence";

/** 🔴 W1-16: the stored expiry is free text, so the reading of it is tested. */

test("a full date is valid through the end of that day", () => {
  assert.equal(licenceValidUntil("2029-06-30")?.toISOString(), "2029-07-01T00:00:00.000Z");
  assert.equal(licenceValidUntil("30/06/2029")?.toISOString(), "2029-07-01T00:00:00.000Z");
});

test("a month is valid through the end of that month", () => {
  assert.equal(licenceValidUntil("2028-04")?.toISOString(), "2028-05-01T00:00:00.000Z");
  assert.equal(licenceValidUntil("12/2028")?.toISOString(), "2029-01-01T00:00:00.000Z");
});

test("unreadable text is unknown, never expired", () => {
  for (const text of ["", null, "soon", "2028-13", "2029-02-30", "31/31/2029"]) {
    assert.equal(licenceValidUntil(text), null, String(text));
    assert.equal(licenceStanding(text, new Date()), "unknown");
  }
});

test("expired, expiring within thirty days, and valid", () => {
  const now = new Date("2026-09-24T03:00:00Z");
  assert.equal(licenceStanding("2026-09-23", now), "expired");
  assert.equal(licenceStanding("2026-09-24", now), "expiring");
  assert.equal(licenceStanding("2026-10-20", now), "expiring");
  assert.equal(licenceStanding("2027-01", now), "valid");
});
