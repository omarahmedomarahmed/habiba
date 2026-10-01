import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { accountSubject, guessOutcome, minutesToWait } from "../lib/auth/attempts";
import { handleSubject } from "../lib/patient-auth/handle-subject";

/* DD-2 B2.2: guesses are counted per account, and a code's guesses atomically. */

const source = (path: string) => readFileSync(join(__dirname, "..", path), "utf8");

test("one account is one bucket, however it is typed", () => {
  assert.equal(accountSubject("  Omar@Clinic.Example.com "), "omar@clinic.example.com");
  assert.equal(accountSubject("ＯＭＡＲ@example.com"), "omar@example.com");
  assert.equal(handleSubject("Omar@Example.com", null), "omar@example.com");
  assert.equal(handleSubject("01012345678", "EG"), handleSubject("+201012345678", null));
});

test("the wait is whole minutes and never zero", () => {
  assert.equal(minutesToWait(0), 1);
  assert.equal(minutesToWait(61), 2);
  assert.equal(minutesToWait(900), 15);
});

test("a code takes five guesses, counted before they are compared", () => {
  const limit = 5;
  assert.equal(guessOutcome({ attemptsAfter: 1, matched: true, limit }), "match");
  assert.equal(guessOutcome({ attemptsAfter: 1, matched: false, limit }), "wrong");
  assert.equal(guessOutcome({ attemptsAfter: 4, matched: false, limit }), "wrong");
  assert.equal(guessOutcome({ attemptsAfter: 5, matched: true, limit }), "match");
  assert.equal(guessOutcome({ attemptsAfter: 5, matched: false, limit }), "exhausted");
  /* No row came back: spent, expired, or out of guesses. Even the right code is refused. */
  assert.equal(guessOutcome({ attemptsAfter: null, matched: true, limit }), "exhausted");
  assert.equal(guessOutcome({ attemptsAfter: 6, matched: true, limit }), "exhausted");

  /* Parallel guesses each get their own count from the UPDATE, so at most five are ever compared. */
  const counts = Array.from({ length: 20 }, (_, i) => (i < limit ? i + 1 : null));
  const compared = counts.filter((n) => guessOutcome({ attemptsAfter: n, matched: true, limit }) === "match");
  assert.equal(compared.length, limit);
});

test("the code checks count in the database and the reset token is spent by one statement", () => {
  const spend = source("lib/patient-auth/code-attempts.ts");
  assert.match(spend, /attempts: sql`\$\{patientAuthTokens\.attempts\} \+ 1`/);
  assert.match(spend, /lt\(patientAuthTokens\.attempts, RESET_CODE_ATTEMPTS\)/);
  assert.match(spend, /isNull\(patientAuthTokens\.usedAt\)\)\)\s*\.returning/);
  for (const path of ["lib/patient-auth/code-signin.ts", "lib/patient-auth/reset.ts", "lib/patient-auth/handle.ts", "lib/patient-auth/email.ts"]) {
    const text = source(path);
    assert.match(text, /spendCodeGuess\(/, path);
    assert.doesNotMatch(text, /row\.attempts \+ 1/, `${path} counts a guess in Node again`);
  }
  for (const path of ["lib/patient-auth/code-signin.ts", "lib/patient-auth/reset.ts"]) {
    assert.match(source(path), /accountAttempt\(/, `${path} has no per-account limit`);
    assert.doesNotMatch(source(path), /perr\.tooManyWrongCodes/, `${path} tells a stranger the account exists`);
  }

  const actions = source("lib/auth/actions.ts");
  const reset = actions.slice(actions.indexOf("export async function resetPassword"));
  assert.match(reset, /\.update\(authTokens\)[\s\S]*isNull\(authTokens\.usedAt\)[\s\S]*\.returning\(/);
  assert.doesNotMatch(reset, /\.select\(\)\s*\.from\(authTokens\)/);
});

test("every password door has a per-account lockout that unknown addresses share", () => {
  for (const path of [
    "lib/auth/actions.ts",
    "lib/patient-auth/actions.ts",
    "app/(sponsor)/sponsor/sign-in/actions.ts",
    "app/(clinic)/clinic/sign-in/actions.ts",
    "app/(partner)/partner/sign-in/actions.ts",
  ]) {
    const text = source(path);
    const attempt = text.indexOf("accountAttempt(");
    assert.ok(attempt > 0, `${path} has no per-account lockout`);
    assert.ok(text.indexOf("accountSignedIn(") > attempt, `${path} never clears it`);
    assert.match(text, /auth\.tooManyForSignIn/, path);
  }
  /* The clinician door no longer says "locked" only for addresses that exist. */
  assert.doesNotMatch(source("lib/auth/actions.ts"), /user\.lockedUntil && user\.lockedUntil > new Date\(\)/);
});
