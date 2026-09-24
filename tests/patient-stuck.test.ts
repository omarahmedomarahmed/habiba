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
