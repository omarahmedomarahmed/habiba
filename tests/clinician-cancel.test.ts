import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

/**
 * W1-13: a clinician cancelling a booked appointment, or a session, tells the
 * patient why and gives back what they paid.
 *
 * Both doors (`cancel` on the availability editor, `abandonSession` on the
 * session page) used to cancel the row and stop: no reason asked, nobody told,
 * nothing refunded. The patient found out by turning up to a closed room.
 */

function body(file: string, name: string): string {
  const source = readFileSync(file, "utf8");
  const start = source.indexOf(`export async function ${name}(`);
  assert.ok(start >= 0, `${name} not found in ${file}`);
  const next = source.indexOf("\nexport ", start + 1);
  return source.slice(start, next < 0 ? source.length : next);
}

test("both cancel doors take a reason and hand the cancellation on to the patient", () => {
  for (const [file, name] of [
    ["app/(app)/on-call/schedule-actions.ts", "cancel"],
    ["app/(app)/sessions/actions.ts", "abandonSession"],
  ] as const) {
    const code = body(file, name);
    assert.match(code, /reason/, `${name} asks no reason`);
    assert.match(code, /cleanCancelReason\(/, `${name} does not check the reason`);
    assert.match(code, /afterClinicianCancel\(/, `${name} tells nobody and refunds nothing`);
  }
});

test("a reason is required, short, and trimmed", async () => {
  const { cleanCancelReason } = await import("../lib/sessions/cancel-reason");

  assert.equal(cleanCancelReason(""), null);
  assert.equal(cleanCancelReason("   "), null);
  assert.equal(cleanCancelReason("ok"), null, "two letters is not a reason");
  assert.equal(cleanCancelReason(undefined), null);
  assert.equal(cleanCancelReason("  I am unwell today  "), "I am unwell today");
  assert.equal(cleanCancelReason("x".repeat(400))?.length, 300, "capped, not refused");
});
