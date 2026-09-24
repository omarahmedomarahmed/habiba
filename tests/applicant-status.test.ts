import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

/**
 * W2-T02: an applicant can see what is with us, change it before we look,
 * and (since W1-23) update a renewed licence after approval.
 *
 * The under-review screen was a spinner and one sentence: nothing said what
 * had been sent, nothing let somebody fix a typo they noticed an hour later,
 * and nothing led anywhere.
 */

const form = readFileSync("components/onboarding/verification-form.tsx", "utf8");
const card = form.slice(form.indexOf('if (state === "submitted" && !renewing)'), form.indexOf("return (\n    <div className=\"space-y-4\">"));

test("the review screen lists what we are reviewing", () => {
  for (const field of ["initial.licenseNumber", "initial.licenseBody", "initial.licenseExpiry"]) {
    assert.ok(card.includes(field), `${field} is not shown while it is under review`);
  }
  assert.match(card, /documents/, "the documents sent are not listed");
});

test("an applicant can take it back to change something before we look", () => {
  assert.match(card, /withdrawFromReview/, "no way to change a submission");

  const actions = readFileSync("app/(app)/onboarding/actions.ts", "utf8");
  const body = actions.slice(actions.indexOf("export async function withdrawFromReview"));
  assert.ok(body.length > 0 && actions.includes("export async function withdrawFromReview"));
  // Only a submission nobody has decided yet, and never a renewal in review:
  // the guard is in the WHERE, so an operator's decision and the withdrawal
  // cannot both land.
  assert.match(body.slice(0, 2500), /eq\(therapistVerifications\.state, "submitted"\)/);
  assert.match(body.slice(0, 2500), /isNull\(therapistVerifications\.licenseExpiredAt\)/);
});

test("CONTROL: an approved clinician updates a renewed licence through review (W1-23)", () => {
  const page = readFileSync("app/(app)/onboarding/page.tsx", "utf8");
  assert.match(page, /<LicenceChangeForm/);
});
