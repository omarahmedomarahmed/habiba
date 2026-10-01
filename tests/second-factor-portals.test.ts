import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { CHALLENGE_LIFETIME_MS, issueChallenge, readChallenge } from "../lib/auth/challenge";
import { needsSecondFactor, secondStepOwed } from "../lib/auth/totp";

/* DD-2 B2.3 and B2.4: who owes the second step, and the portal doors' half-way mark. */

const source = (path: string) => readFileSync(join(__dirname, "..", path), "utf8");
const SECRET = "test-secret-not-real";
const ID = "4f0b5a8e-2c7d-4c55-9a3e-0d6f0f1e2a3b";

test("the back office always owes the step; anybody else once they turn an app on", () => {
  for (const role of ["staff", "manager", "super_admin"] as const) {
    assert.equal(secondStepOwed(role, false), true, role);
    assert.equal(needsSecondFactor(role), true, role);
  }
  assert.equal(secondStepOwed("therapist", false), false);
  assert.equal(secondStepOwed("therapist", true), true);
  assert.equal(secondStepOwed(null, false), false);
});

test("a challenge names one account on one portal, for five minutes, and cannot be forged", () => {
  const now = 1_800_000_000_000;
  const token = issueChallenge(SECRET, "clinic", ID, now);
  assert.equal(readChallenge(SECRET, "clinic", token, now + 1000), ID);
  assert.equal(readChallenge(SECRET, "partner", token, now + 1000), null, "another portal's door");
  assert.equal(readChallenge(SECRET, "clinic", token, now + CHALLENGE_LIFETIME_MS + 1), null, "expired");
  assert.equal(readChallenge("another-secret", "clinic", token, now), null, "another key");

  const [body, mac] = token.split(".");
  const swapped = Buffer.from(JSON.stringify({ p: "clinic", i: "00000000-0000-4000-8000-000000000000", e: now + 60_000 })).toString("base64url");
  assert.equal(readChallenge(SECRET, "clinic", `${swapped}.${mac}`, now), null, "a different account under the same signature");
  assert.equal(readChallenge(SECRET, "clinic", `${body}.${mac}x`, now), null);
  assert.equal(readChallenge(SECRET, "clinic", `${body}.${mac}.extra`, now), null);
  assert.equal(readChallenge(SECRET, "clinic", undefined, now), null);
  assert.equal(readChallenge(SECRET, "clinic", "", now), null);
});

test("the console has no emailed code, and staff without an app are enrolled on the step", () => {
  const factor = source("lib/auth/second-factor.ts");
  assert.doesNotMatch(factor, /export async function emailSecondStepCode/);
  assert.doesNotMatch(factor, /notify\(/, "the second step sends mail again");
  assert.doesNotMatch(source("lib/auth/second-step-actions.ts"), /sendSecondStepCode/);
  assert.doesNotMatch(source("components/auth/second-step-form.tsx"), /secondEmailBody|secondSend/);
  const page = source("app/(auth)/staff/second-step/page.tsx");
  assert.match(page, /<StepEnrolment/);
  assert.match(page, /state\.secondFactorEnrolled/);
});

test("a clinician, a clinic manager and a partner user can add an app, and then it is asked for", () => {
  const session = source("lib/auth/session.ts");
  assert.match(session, /secondStepOwed\(row\.role, row\.appConfirmedAt !== null\)/);
  assert.match(source("lib/auth/actions.ts"), /secondFactorStatus\(user\.id\)\)\.enrolled/);
  for (const portal of ["clinic", "partner"] as const) {
    const actions = source(`app/(${portal})/${portal}/sign-in/actions.ts`);
    assert.match(actions, new RegExp(`challengeAfterPassword\\("${portal}"`));
    assert.match(actions, new RegExp(`passPortalChallenge\\("${portal}"`));
    /* The session is made only after the challenge check, never straight after the password when an app is on. */
    assert.ok(actions.indexOf("if (challenge) return { challenge }") < actions.lastIndexOf("await create"), portal);
  }
  assert.match(source("app/(app)/settings/page.tsx"), /<AuthenticatorCard/);
  assert.match(source("app/(clinic)/clinic/page.tsx"), /<AuthenticatorCard/);
  assert.match(source("app/(partner)/partner/team/page.tsx"), /<AuthenticatorCard/);
});
