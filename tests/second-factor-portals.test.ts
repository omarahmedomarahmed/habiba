import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { CHALLENGE_LIFETIME_MS, issueChallenge, readChallenge } from "../lib/auth/challenge";
import { FACTOR_RESET_TARGETS, isFactorResetTarget, mayResetAccountFactor } from "../lib/auth/factor-reset";
import {
  ENROL_PROOF_MINUTES,
  enrolProofCurrent,
  hashEnrolCode,
  needsSecondFactor,
  newEnrolCode,
  PENDING_ENROLMENT_MINUTES,
  pendingEnrolmentCurrent,
  secondStepOwed,
} from "../lib/auth/totp";

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

/* Review fix: a lost app has a way back for everybody, and every way is audited. */

test("an owner or a manager resets a clinician's, clinic manager's or partner user's app; staff cannot", () => {
  assert.equal(mayResetAccountFactor("super_admin"), true);
  assert.equal(mayResetAccountFactor("manager"), true);
  for (const role of ["staff", "therapist", null, undefined]) assert.equal(mayResetAccountFactor(role), false, String(role));
  assert.deepEqual([...FACTOR_RESET_TARGETS], ["clinician", "clinic", "partner"]);
  assert.equal(isFactorResetTarget("partner"), true);
  assert.equal(isFactorResetTarget("staff"), false);

  const factor = source("lib/auth/second-factor.ts");
  const reset = factor.slice(factor.indexOf("export async function resetAccountFactor"));
  assert.match(reset, /if \(!mayResetAccountFactor\(actor\.role\)\)/);
  /* A back office member is never reset here: theirs is required and Team resets it. */
  assert.match(reset, /!\(BACK_OFFICE_ROLES as readonly string\[\]\)\.includes\(row\.role\)/);
  assert.match(reset, /action: "second_factor\.reset_refused"/);
  assert.match(reset, /action: "second_factor\.reset",/);
  const actions = source("app/(admin)/admin/security/actions.ts");
  assert.match(actions, /requireRole\("super_admin", "manager"\)[\s\S]{0,400}resetAccountFactor\(actor, target/);
});

test("a sole super_admin has an audited break glass, behind the production confirmation", () => {
  const script = source("scripts/reset-second-factor.ts");
  assert.match(script, /writesTo\(\{ productionIsAllowed: true \}\)/);
  assert.match(script, /inArray\(users\.role, \[\.\.\.BACK_OFFICE_ROLES\]\)/);
  assert.match(script, /tx\.insert\(auditLog\)/);
  assert.match(script, /const DRY = process\.argv\.includes\("--dry"\)/);
  assert.match(source("package.json"), /"factor:reset": "node --env-file-if-exists=\.env\.local --import tsx scripts\/reset-second-factor\.ts"/);
  const onProduction = source("scripts/on-production.ts");
  assert.match(onProduction, /"factor:reset": \{\s*writes: true,[\s\S]{0,200}destroys: \{ unless: \["--dry"\] \}/);
  assert.match(source("scripts/verify-sprint57.ts"), /"scripts\/reset-second-factor\.ts",/);
});

/* Review fix: a password alone never enrols an app. */

test("the emailed enrolment proof and a pending app both run out, and a future time fails closed", () => {
  const now = new Date("2026-10-01T12:00:00Z");
  const ago = (minutes: number) => new Date(now.getTime() - minutes * 60_000);
  assert.equal(enrolProofCurrent(null, now), false);
  assert.equal(enrolProofCurrent(ago(ENROL_PROOF_MINUTES - 1), now), true);
  assert.equal(enrolProofCurrent(ago(ENROL_PROOF_MINUTES + 1), now), false);
  assert.equal(enrolProofCurrent(ago(-5), now), false);
  assert.equal(pendingEnrolmentCurrent(ago(PENDING_ENROLMENT_MINUTES - 1), now), true);
  assert.equal(pendingEnrolmentCurrent(ago(PENDING_ENROLMENT_MINUTES + 1), now), false);
  assert.match(newEnrolCode(), /^\d{6}$/);
  assert.equal(hashEnrolCode("123 456"), hashEnrolCode("123456"));
  assert.notEqual(hashEnrolCode("123456"), hashEnrolCode("123457"));
});

test("a back office member's first app needs the emailed code; the others type their password again", () => {
  const factor = source("lib/auth/second-factor.ts");
  /* Start, show and confirm all ask for the proof on a back office role. */
  for (const fn of ["beginEnrolment", "pendingEnrolment", "confirmEnrolment"]) {
    const body = factor.slice(factor.indexOf(`export async function ${fn}`));
    assert.match(body.slice(0, 400), /proofMissing\(who, sessionId\)/, fn);
  }
  assert.match(factor, /pendingEnrolmentCurrent\(row\.updatedAt\)/);
  const steps = source("lib/auth/second-step-actions.ts");
  const start = steps.slice(steps.indexOf("export async function startStepEnrolment"));
  assert.ok(start.indexOf("proveEnrolmentCode(") < start.indexOf("beginEnrolment("), "proof before the secret");
  assert.match(source("app/(auth)/staff/second-step/page.tsx"), /pendingEnrolment\(state\.actor, state\.sessionId\)/);
  /* The emailed code is spent once, for this session only, and never passes the step itself. */
  const proof = source("lib/auth/enrolment-proof.ts");
  assert.match(proof, /eq\(staffEmailCodes\.sessionId, sessionId\)/);
  assert.match(proof, /isNull\(staffEmailCodes\.usedAt\)/);
  const pass = factor.slice(factor.indexOf("export async function passSecondStep"));
  assert.doesNotMatch(pass.slice(0, pass.indexOf("\n}\n")), /staffEmailCodes|enrolment-proof|proofMissing/);
  for (const [file, owner] of [
    ["app/(app)/settings/authenticator-actions.ts", "user"],
    ["app/(clinic)/clinic/authenticator-actions.ts", "clinic"],
    ["app/(partner)/partner/team/authenticator-actions.ts", "partner"],
  ] as const) {
    const actions = source(file);
    const startAction = actions.slice(actions.indexOf("export async function start"));
    assert.match(startAction.slice(0, 900), new RegExp(`passwordConfirmed\\(\\{ kind: "${owner}"`), file);
  }
  assert.match(source("components/auth/authenticator-card.tsx"), /name="password" type="password"/);
});
