import assert from "node:assert/strict";
import { test } from "node:test";

import { routeDecision } from "../lib/routing";

/**
 * The rule sprint 6 exists to enforce: **a patient is never sent to a
 * clinician's screen.**
 *
 * Before 6.6, `/patient/...` was in no list at all. A patient holding a valid
 * patient cookie fell through to the clinician rules, and the two failures were
 * the two you least want: with only a patient cookie they were bounced to a
 * therapist's `/login`; holding both cookies (one browser, a therapist who is
 * also somebody's patient) they were sent to the therapist dashboard.
 *
 * `routeDecision` is pure so both of those are one assertion each.
 */

const nobody = { clinician: false, patient: false, expired: false };
const patient = { clinician: false, patient: true, expired: false };
const clinician = { clinician: true, patient: false, expired: false };
const both = { clinician: true, patient: true, expired: false };

/* ---------------------------------------------- the fall-through, foreclosed -- */

test("a signed-in patient on a patient page is left alone, both cookies or one", () => {
  assert.deepEqual(routeDecision("/patient", patient), { kind: "pass" });
  assert.deepEqual(routeDecision("/patient/claim", patient), { kind: "pass" });
  // The one that used to land on the therapist dashboard.
  assert.deepEqual(routeDecision("/patient", both), { kind: "pass" });
});

test("a patient with no patient cookie goes to the PATIENT login, not the clinician one", () => {
  const decision = routeDecision("/patient/homework", nobody);
  assert.deepEqual(decision, {
    kind: "redirect",
    to: "/patient/login",
    keepNext: true,
  });
});

test("holding a clinician cookie does not let you into a patient page", () => {
  // A therapist's cookie is not a patient's. The patient block decides, and it
  // only ever looks at the patient cookie.
  assert.deepEqual(routeDecision("/patient", clinician), {
    kind: "redirect",
    to: "/patient/login",
    keepNext: true,
  });
});

/* ------------------------------------------------------- /patient vs /patients -- */

test("/patients is the clinician's route and /patient is not — one character apart", () => {
  // The clinician's patient list, with a clinician cookie: passes.
  assert.deepEqual(routeDecision("/patients", clinician), { kind: "pass" });
  // …and with only a patient cookie it is a protected clinician route.
  assert.deepEqual(routeDecision("/patients", patient), {
    kind: "redirect",
    to: "/login",
    keepNext: true,
  });
});

test("prefixes match on segment boundaries, so /patientsomething is neither", () => {
  // Not under /patient and not under /patients. With no cookies at all it is
  // simply a public path — which is what a marketing page named like that is.
  assert.deepEqual(routeDecision("/patientsomething", nobody), {
    kind: "pass",
  });
});

/* ----------------------------------------------------------- the sign-in pages -- */

test("a signed-in patient standing on the patient sign-in page is moved on", () => {
  assert.deepEqual(routeDecision("/patient/login", patient), {
    kind: "redirect",
    to: "/patient",
    keepNext: false,
  });
  assert.deepEqual(routeDecision("/patient/signup", patient), {
    kind: "redirect",
    to: "/patient",
    keepNext: false,
  });
});

test("a signed-OUT patient may reach the patient sign-in pages", () => {
  assert.deepEqual(routeDecision("/patient/login", nobody), { kind: "pass" });
  assert.deepEqual(routeDecision("/patient/signup", nobody), { kind: "pass" });
});

test("expired=1 lets a stale cookie see the sign-in page, on both sides", () => {
  // Without this the cookie outlives the session and the redirect loops
  // forever — the therapist-side bug, which the patient side would have
  // inherited verbatim.
  assert.deepEqual(routeDecision("/patient/login", { ...patient, expired: true }), {
    kind: "pass",
  });
  assert.deepEqual(routeDecision("/login", { ...clinician, expired: true }), {
    kind: "pass",
  });
});

/* --------------------------------------------------------- the clinician rules -- */

test("the clinician rules still work, and are never reached by a patient path", () => {
  assert.deepEqual(routeDecision("/dashboard", nobody), {
    kind: "redirect",
    to: "/login",
    keepNext: true,
  });
  assert.deepEqual(routeDecision("/login", clinician), {
    kind: "redirect",
    to: "/dashboard",
    keepNext: false,
  });
  assert.deepEqual(routeDecision("/", nobody), { kind: "pass" });
});

test("every patient path returns from the patient block, whatever the cookies", () => {
  // The structural claim, checked exhaustively rather than by reading: no
  // combination of cookies sends a /patient/* path to /login or /dashboard.
  for (const path of ["/patient", "/patient/login", "/patient/claim", "/patient/invite/abc"]) {
    for (const cookies of [nobody, patient, clinician, both]) {
      for (const expired of [false, true]) {
        const decision = routeDecision(path, { ...cookies, expired });
        if (decision.kind === "redirect") {
          assert.ok(
            decision.to.startsWith("/patient"),
            `${path} with ${JSON.stringify({ ...cookies, expired })} → ${decision.to}`,
          );
        }
      }
    }
  }
});
