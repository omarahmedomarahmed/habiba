import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

import { BOOKED_HOUR_MS, missedBooking } from "../lib/sessions/doors";

/*
 * DD-2: a booking nobody started reads "did not take place" to the patient
 * and, now, to the therapist, with no room to open, and is not earned.
 */

const booked = new Date("2026-09-28T08:00:00Z");

test("a booked hour that passed with nobody starting it is missed; a started one never is", () => {
  const row = { status: "scheduled", scheduledAt: booked, startedAt: null };
  assert.equal(missedBooking(row, booked.getTime() + BOOKED_HOUR_MS - 1), false);
  assert.equal(missedBooking(row, booked.getTime() + BOOKED_HOUR_MS), true);
  assert.equal(missedBooking(row, booked.getTime() + 3 * 24 * 3_600_000), true, "three days later");
  assert.equal(missedBooking({ ...row, startedAt: booked }, booked.getTime() + 5 * BOOKED_HOUR_MS), false);
  assert.equal(missedBooking({ ...row, status: "completed" }, booked.getTime() + 5 * BOOKED_HOUR_MS), false);
});

test("the therapist's session page shows the missed state before the room, and no Open room for it", () => {
  const page = readFileSync("app/(app)/sessions/[id]/page.tsx", "utf8");
  assert.match(page, /const missed = missedBooking\(/);
  const missedAt = page.indexOf("{missed ? (");
  const liveAt = page.indexOf(") : live ? (");
  assert.ok(missedAt > 0 && liveAt > missedAt, "the missed card is chosen before the live card");
  assert.doesNotMatch(page.slice(missedAt, liveAt), /\/room|openRoom/, "the missed card offers no room");
  assert.match(page, /<SessionBadge status=\{row\.session\.status\} missed=\{missed\} \/>/);
  const badge = readFileSync("components/sessions/status-badge.tsx", "utf8");
  assert.match(badge, /if \(missed\) return <Badge tone="slate">\{t\("portal\.status\.missed"\)\}<\/Badge>/);
});

test("earnings do not count a session that did not take place", () => {
  const connect = readFileSync("lib/billing/connect.ts", "utf8");
  const summary = connect.slice(connect.indexOf("export async function earningsSummary"));
  assert.match(summary.slice(0, 2000), /sessionMayHaveTakenPlaceSql\(\)/);
  const predicate = connect.slice(connect.indexOf("export function sessionMayHaveTakenPlaceSql"));
  assert.match(predicate.slice(0, 800), /'cancelled'/);
  assert.match(predicate.slice(0, 800), /startedAt\} IS NULL/);
  assert.match(predicate.slice(0, 800), /BOOKED_HOUR_MS/);
});
