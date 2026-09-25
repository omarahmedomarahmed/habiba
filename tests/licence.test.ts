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

/*
 * 🔴 TE21: the room is its own route group with no clearance gate, so a
 * clinician sent back to review could open a booked session's room and start
 * it. Both doors now ask `isCleared` before a start; a session already under
 * way may still be finished. Read from source: the gate is a shape of the code.
 */
test("🔴 TE21 a clinician who may not practise cannot start a session in the room", async () => {
  const { readFileSync } = await import("node:fs");
  const strip = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, "");
  const room = strip(readFileSync("app/(room)/sessions/[id]/room/page.tsx", "utf8"));
  assert.match(
    room,
    /if \(row\.session\.status !== "in_progress"\) \{[\s\S]*?isCleared\(actor,[\s\S]*?redirect\("\/onboarding"\)/,
    "the room opens a booked session for an uncleared clinician",
  );

  const actions = strip(readFileSync("app/(app)/sessions/actions.ts", "utf8"));
  const goLive = actions.slice(actions.indexOf("export async function goLive("));
  const body = goLive.slice(0, goLive.indexOf("\nexport "));
  const gate = body.indexOf("isCleared(");
  const start = body.indexOf("startSession(");
  assert.ok(gate > 0 && gate < start, "goLive starts a session before asking whether the clinician is cleared");
  assert.match(body, /status !== "in_progress"[\s\S]*?tlic\.mayNotStart/, "a live session must still be finishable");
  // TE12: the start is audited only when this call made it.
  assert.match(body, /if \(startedNow\) await audit\(/);
});
