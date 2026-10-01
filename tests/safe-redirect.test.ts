import { test } from "node:test";
import assert from "node:assert/strict";

import { isSafeNext, safeNext } from "../lib/auth/safe-redirect";
import { patientBounce, patientLanding } from "../lib/routing";
import { landingFor, staffDestination } from "../lib/admin/access";

/* DD-2 B2.1: the shared check for every `next` a sign-in or bounce follows. */

const NASTY = [
  "/\\evil.com",
  "/\\/evil.com",
  "\\\\evil.com",
  "//evil.com",
  "///evil.com",
  "https://evil.com",
  "http:evil.com",
  "javascript:alert(1)",
  "evil.com",
  "",
  " /dashboard",
  "/\tevil.com",
  "/\t/evil.com",
  "/\n/evil.com",
  "/\r\n//evil.com",
  "/dash\u0000board",
  "/\u2028evil",
  "/x\\y",
  "/" + "a".repeat(5000),
];

test("every nasty next is refused", () => {
  for (const next of NASTY) assert.equal(isSafeNext(next), false, JSON.stringify(next));
  for (const next of [null, undefined, 42, {}, ["/dashboard"]]) assert.equal(isSafeNext(next), false);
});

test("an ordinary path, with its query and fragment, is kept", () => {
  for (const next of ["/dashboard", "/patients/abc?tab=notes", "/admin/transfers#top", "/", "/javascript:alert(1)", "/a//b"]) {
    assert.equal(isSafeNext(next), true, next);
    assert.equal(safeNext(next, "/home"), next);
  }
  assert.equal(safeNext("/\\evil.com", "/home"), "/home");
});

test("every portal's next goes through it", () => {
  assert.equal(patientLanding("/\\evil.com"), "/patient");
  assert.equal(patientLanding("/patient/benefit?code=X"), "/patient/benefit?code=X");
  assert.equal(patientBounce(false, "/\\evil.com"), "/patient/login");
  assert.equal(staffDestination("super_admin", "/\\evil.com"), landingFor("super_admin"));
  assert.equal(staffDestination("super_admin", "/administrator"), landingFor("super_admin"));
  assert.equal(staffDestination("super_admin", "/admin/transfers"), "/admin/transfers");
});
