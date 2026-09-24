import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { test } from "node:test";

import { PATIENT_OPEN_ROUTES, routeDecision } from "../lib/routing";

/**
 * Wave 2, the patient's dead ends (W2-P01 to W2-P16).
 *
 * Each test here was written against the code as it stood and seen to fail
 * before the fix. The ones that need rows live in `scripts/verify-w2p.ts`.
 */

const patientCookie = { patient: true, expired: false };

/** A source file with its comments removed, so a sentence about a defect cannot pass for code (C205). */
function code(file: string): string {
  return readFileSync(file, "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:"'`])\/\/.*$/gm, "$1");
}

/* ----------------------------------------------------------------- W2-P01 -- */

test("W2-P01 a patient whose session died is signed out, not looped", async () => {
  const { patientBounce } = await import("../lib/routing");

  /*
   * The loop: `requirePatient` sent a stale cookie to `/patient/login`, and
   * middleware sends a cookie holder at their door back to `/patient`.
   */
  const stale = patientBounce(true, "/patient/sessions");
  assert.equal(stale, "/patient/session-expired?next=%2Fpatient%2Fsessions");
  assert.deepEqual(
    routeDecision("/patient/session-expired", patientCookie),
    { kind: "pass" },
    "the escape route must not bounce the cookie it is there to clear",
  );
  assert.ok(PATIENT_OPEN_ROUTES.includes("/patient/session-expired"));
  assert.deepEqual(
    routeDecision("/patient/login", { ...patientCookie, expired: true }),
    { kind: "pass" },
  );

  /* No cookie, no loop: straight to the door with the way back. */
  assert.equal(patientBounce(false, "/patient/journal"), "/patient/login?next=%2Fpatient%2Fjournal");
  /* An absolute URL is never carried. */
  assert.equal(patientBounce(true, "//evil.example.com"), "/patient/session-expired");

  const route = "app/(patient)/patient/session-expired/route.ts";
  assert.ok(existsSync(route), "a route handler, because only one can delete a cookie");
  const handler = code(route);
  assert.match(handler, /destroyPatientSession\(/);
  assert.match(handler, /expired/);
  assert.match(code("lib/patient-auth/guard.ts"), /patientBounce\(/);
});

/* ----------------------------------------------------------------- W2-P02 -- */

test("W2-P02 sign-in returns a patient to where they were going, on both forms", async () => {
  const { patientLanding, bounceNext } = await import("../lib/routing");

  assert.equal(patientLanding("/patient/invite/abc123"), "/patient/invite/abc123");
  assert.equal(patientLanding("/patient/benefit?code=ABCD1234"), "/patient/benefit?code=ABCD1234");
  assert.equal(patientLanding("/join/tok"), "/join/tok");
  /* Never off the origin, never back to a door, never into a clinician's page. */
  assert.equal(patientLanding("//evil.example.com"), "/patient");
  assert.equal(patientLanding("https://evil.example.com"), "/patient");
  assert.equal(patientLanding("/\\evil.example.com"), "/patient");
  assert.equal(patientLanding("/patient/login"), "/patient");
  assert.equal(patientLanding("/patient/session-expired?next=/patient"), "/patient");
  assert.equal(patientLanding("/dashboard"), "/patient");
  assert.equal(patientLanding(null), "/patient");

  /* The sponsor QR is `/patient/benefit?code=`, and the bounce kept only the path. */
  assert.equal(bounceNext("/patient/benefit", "?code=ABCD1234"), "/patient/benefit?code=ABCD1234");
  assert.equal(bounceNext("/patient", ""), "/patient");
  assert.match(code("middleware.ts"), /bounceNext\(/);

  const signIn = code("lib/patient-auth/actions.ts");
  const start = signIn.indexOf("export async function patientSignIn(");
  const body = signIn.slice(start, signIn.indexOf("export async function patientSignOut("));
  assert.match(body, /redirect\(patientLanding\(/, "the password form lands on Home whatever next says");
  assert.doesNotMatch(body, /redirect\("\/patient"\)/);

  assert.match(code("lib/patient-auth/code-signin.ts"), /patientLanding\(/, "the code form ignores next");
  assert.doesNotMatch(code("components/patient/code-signin-form.tsx"), /router\.replace\("\/patient"\)/);
  assert.match(code("app/(patient)/patient/login/page.tsx"), /next=\{/);
});

/* ----------------------------------------------------------------- W2-P03 -- */

test("W2-P03 signup and the account both take an address, and a record only goes to a proved one", async () => {
  const { emailProblem } = await import("../lib/patient-auth/email");
  assert.equal(emailProblem("laila@example.com"), null);
  assert.ok(emailProblem("not an address"));

  assert.match(code("components/patient/auth-form.tsx"), /name="email"/, "signup never asked for one");
  assert.match(code("app/(patient)/patient/account/page.tsx"), /<EmailEditor/, "the account had no way to add one");
  assert.match(code("app/(patient)/patient/account/actions.ts"), /confirmEmailCode\(/);
  assert.match(code("app/(patient)/patient/record/actions.ts"), /emailVerified \? actor\.email : null/);
});

/* ----------------------------------------------------------------- W2-P05 -- */

test("W2-P05 what a patient is sent about their booking opens their own session, not a clinician's page", async () => {
  const { patientSessionUrl, patientSessionLink } = await import("../lib/sessions/patient-link");
  assert.equal(patientSessionUrl("https://app.example.com", "tok"), "https://app.example.com/join/tok");
  assert.equal(patientSessionLink("https://app.example.com", null), null, "no token, no dead link");

  /* The three messages that reach a patient about a booked hour. */
  for (const file of [
    "app/(public)/t/[id]/book/actions.ts",
    "app/(app)/bookings/actions.ts",
    "app/api/cron/[job]/route.ts",
  ]) {
    const source = code(file);
    assert.doesNotMatch(source, /"Open your session", url: `\$\{env\.appUrl\}\/sessions\//, file);
    assert.match(source, /patientSessionLink\(env\.appUrl, \w+\.joinToken\)/, file);
  }
});

/* ------------------------------------------------------ W2-P06 and W2-P14 -- */

test("W2-P06 a session card opens what it is waiting on: join, pay, the transfer, the summary", async () => {
  const { doorFor } = await import("../lib/sessions/doors");
  const now = Date.parse("2026-09-24T10:00:00Z");
  const base = {
    status: "scheduled",
    endedAt: null,
    joinToken: "tok",
    joinTokenExpiresAt: new Date(now + 3_600_000),
    priceCents: 0,
    paymentStatus: "not_required",
    transferSubmitted: false,
    summarySigned: false,
    now,
  };

  assert.deepEqual(doorFor(base), { kind: "join", href: "/join/tok" });
  assert.deepEqual(doorFor({ ...base, priceCents: 2000, paymentStatus: "pending" }), {
    kind: "pay",
    href: "/pay/tok",
  });
  assert.deepEqual(
    doorFor({ ...base, priceCents: 2000, paymentStatus: "pending", transferSubmitted: true }),
    { kind: "checking", href: "/pay/tok" },
  );
  assert.deepEqual(doorFor({ ...base, priceCents: 2000, paymentStatus: "paid" }), {
    kind: "join",
    href: "/join/tok",
  });
  assert.deepEqual(
    doorFor({ ...base, status: "completed", endedAt: new Date(now - 1), summarySigned: true }),
    { kind: "summary", href: "/patient/summary" },
  );
  /* No dead doors: a cancelled session, an expired link, an unsigned summary. */
  assert.equal(doorFor({ ...base, status: "cancelled", summarySigned: true }), null);
  assert.equal(doorFor({ ...base, joinTokenExpiresAt: new Date(now - 1) }), null);
  assert.equal(doorFor({ ...base, status: "completed", endedAt: new Date(now - 1) }), null);

  assert.match(code("components/patient/session-list.tsx"), /doors\[session\.id\]/);
  assert.match(code("app/(patient)/patient/sessions/page.tsx"), /sessionDoors\(/);
});

test("W2-P14 billing lists what is still open, not only what was paid", () => {
  const billing = code("app/(patient)/patient/billing/page.tsx");
  assert.match(billing, /sessionDoors\(/);
  assert.match(billing, /kind === "pay" \|\| row\.door\?\.kind === "checking"/);
  assert.match(billing, /patientOwesFor\(/, "the amount is what they owe after their benefit");
});

/* ----------------------------------------------------------------- W2-P07 -- */

test("W2-P07 the code sent to a new number has a screen, and it finishes only the patient's own change", () => {
  const actions = code("app/(patient)/patient/account/actions.ts");
  assert.match(actions, /completeOwnChange\(\{\s*accountId: actor\.accountId/);
  assert.doesNotMatch(actions, /formData\.get\("requestId"\)/, "never an id the client chooses");
  assert.match(code("components/patient/change-number.tsx"), /finishNumberChange/);
  assert.match(code("app/(patient)/patient/account/page.tsx"), /awaitingCode=\{await awaitingChangeCode\(/);
});

/* ----------------------------------------------------------------- W2-P08 -- */

test("W2-P08 the benefit page reads the QR's code, and a paused benefit has a field to answer", () => {
  const page = code("app/(patient)/patient/benefit/page.tsx");
  assert.match(page, /searchParams/);
  assert.match(page, /initialCode=\{/);
  const form = code("components/patient/benefit-form.tsx");
  assert.match(form, /useState\(initialCode/);
  assert.match(form, /reconfirmBenefit\(/, "the paused card asked for an address with nowhere to type it");
  assert.match(code("app/(patient)/patient/benefit/actions.ts"), /personId: actor\.personId, enrolmentId, identifier/);
});

/* ----------------------------------------------------------------- W2-P04 -- */

test("W2-P04 every self-booking door hands the signed-in person to the data layer", () => {
  const radar = code("app/(public)/radar/actions.ts");
  assert.match(radar, /optionalPatient\(\)/);
  assert.match(radar, /patientRowForPerson\(/, "radar sessions belonged to a new stranger");
  assert.match(code("app/(public)/t/[id]/book/actions.ts"), /personId: signedIn\?\.personId/);
  assert.match(
    code("app/join/[token]/actions.ts"),
    /joinByToken\(token, name, \(await optionalPatient\(\)\)\?\.personId/,
  );
  /* From the cookie, never from the form: no door reads a person id a caller typed. */
  for (const file of [
    "app/(public)/radar/actions.ts",
    "app/(public)/t/[id]/book/actions.ts",
    "app/join/[token]/actions.ts",
  ]) {
    assert.doesNotMatch(code(file), /formData\.get\("personId"\)|input\.personId/);
  }
});
