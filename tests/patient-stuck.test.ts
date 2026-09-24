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

/* ----------------------------------------------------------------- W2-P09 -- */

test("W2-P09 notices, messages, residency and benefit are reachable, and the bell counts", () => {
  const layout = code("app/(patient)/layout.tsx");
  assert.match(layout, /undismissedCount\(actor\.personId\)/, "the unread count was called by nothing");
  assert.match(layout, /<NoticeBell/);
  assert.match(code("components/patient/notice-bell.tsx"), /href="\/patient\/notices"/);

  const you = code("app/(patient)/patient/account/page.tsx");
  for (const page of ["/patient/notices", "/patient/messages", "/patient/residency", "/patient/benefit"]) {
    assert.match(you, new RegExp(`"${page}"`), `${page} is linked from nowhere`);
  }
});

/* ----------------------------------------------------------------- W2-P10 -- */

test("W2-P10 the summary is on the page before any rating, and a rating needs no address", async () => {
  const { ratingReady } = await import("../lib/feedback-options");
  const rated = { therapistStars: 4, sessionStars: 5, serviceStars: 0, ratedApp: true, email: "" };
  assert.equal(ratingReady(rated), true, "an address was the price of sending a rating");
  assert.equal(ratingReady({ ...rated, email: "not an address" }), false);
  assert.equal(ratingReady({ ...rated, therapistStars: 0 }), false, "the rating itself is unchanged");

  const form = code("components/feedback/rating-form.tsx");
  const formBranch = form.slice(form.indexOf("const ready = "));
  assert.ok(
    formBranch.indexOf("{summary}") >= 0 && formBranch.indexOf("{summary}") < formBranch.indexOf("<Stars"),
    "the summary must render above the rating, not after it",
  );
  assert.match(code("app/feedback/[token]/actions.ts"), /input\.email\.trim\(\) \? await releaseBrief/);
});

/* ----------------------------------------------------------------- W2-P11 -- */

test("W2-P11 no-show recovery keeps counting, asks again, and is inside the room", async () => {
  const { minutesWaiting, shouldAsk, RECHECK_MS } = await import("../lib/sessions/waiting");
  const booked = "2026-09-24T10:00:00Z";
  const at = (minutes: number) => Date.parse(booked) + minutes * 60_000;

  /* Opened at minute three: the old component was told "3" and never heard otherwise. */
  assert.equal(minutesWaiting(booked, at(3)), 3);
  assert.equal(minutesWaiting(booked, at(6)), 6, "the clock has to keep counting in the browser");

  const waiting = { started: false, state: "waiting" as const, lastAskedAt: null };
  assert.equal(shouldAsk({ ...waiting, waited: 3, now: at(3) }), false);
  assert.equal(shouldAsk({ ...waiting, waited: 5, now: at(5) }), true);
  /* Nobody free at five: asked again later, not never. */
  const none = { waited: 8, started: false, state: "none" as const, lastAskedAt: at(5) };
  assert.equal(shouldAsk({ ...none, now: at(5) + RECHECK_MS - 1 }), false);
  assert.equal(shouldAsk({ ...none, now: at(5) + RECHECK_MS }), true);
  assert.equal(shouldAsk({ ...none, started: true, now: at(20) }), false, "the clinician came");
  assert.equal(shouldAsk({ ...none, state: "done", now: at(20) }), false);

  assert.match(code("components/join/patient-room.tsx"), /\{!live \? recovery : null\}/);
  assert.match(code("components/join/join-flow.tsx"), /recovery=\{/);
  assert.doesNotMatch(code("components/session/no-show-recovery.tsx"), /waitMinutes: number/);
});

/* ----------------------------------------------------------------- W2-P12 -- */

test("W2-P12 a radar with nobody on it offers the first bookable hours", () => {
  const consoleSource = code("components/radar/radar-console.tsx");
  assert.match(consoleSource, /onlineCount === 0 \? \(\s*<FirstHours/, "an empty board offered only 'Show everyone'");
  for (const page of ["app/(public)/radar/page.tsx", "app/(patient)/patient/radar/page.tsx"]) {
    assert.match(code(page), /firstHours=\{firstHours\}/, page);
  }
});

/* ----------------------------------------------------------------- W2-P13 -- */

test("W2-P13 the wall code reaches signup, and a signed-in reader can act on it", () => {
  const page = code("app/j/[code]/page.tsx");
  assert.match(page, /<PatientAuthForm mode="signup" wallCode=\{code\} \/>/, "the code was never passed to signup");
  assert.match(page, /action=\{connectToTherapist\}/, "a signed-in reader was told to create an account");
  assert.match(code("lib/patient-auth/actions.ts"), /connectByCode\(wallCode, created\.personId\)/);
  assert.match(code("app/j/[code]/actions.ts"), /connectByCode\(String\(formData\.get\("code"\) \?\? ""\), actor\.personId\)/);
});

/* ----------------------------------------------------------------- W2-P15 -- */

test("W2-P15 E5: the pay and join screens say who to ask when the benefit did not pay", () => {
  const pay = code("app/pay/[token]/page.tsx");
  assert.match(pay, /benefitShortfall\(session\.id\)/);
  assert.equal((pay.match(/<BenefitNote shortfall=\{shortfall\} \/>/g) ?? []).length, 2, "both rails");
  assert.match(code("app/join/[token]/page.tsx"), /benefitNote=\{<BenefitNote shortfall=\{await benefitShortfall\(session\.id\)\} \/>\}/);
  assert.match(code("components/join/join-flow.tsx"), /\{owes \? benefitNote : null\}/);
  assert.match(code("components/patient/benefit-note.tsx"), /t\("pay\.askBenefit", \{ name: shortfall\.sponsorName \}\)/);
});

/* ----------------------------------------------------------------- W2-P16 -- */

test("W2-P16 the dead ends have a way back", () => {
  const invite = code("app/(patient)/patient/invite/[token]/page.tsx");
  const invalid = invite.slice(invite.indexOf("if (!invite)"), invite.indexOf("if (!patient)"));
  assert.match(invalid, /<Link/, "an invalid invite link was a card with nothing on it");

  const records = code("app/records/[token]/route.ts");
  assert.doesNotMatch(records, /Ask your therapist to send it again/, "the patient can ask for it themselves");
  assert.match(records, /href="\/patient\/record"/);

  const join = code("app/join/[token]/page.tsx");
  const dead = join.slice(join.indexOf("room.linkDead"), join.indexOf("room.linkDead") + 1200);
  assert.match(dead, /href="\/radar"/);

  assert.match(code("app/feedback/[token]/page.tsx"), /href="\/patient\/summary"/);
  assert.match(code("components/assessments/patient-questionnaire.tsx"), /href="\/patient"/);
  for (const flow of ["components/patient/invite-flow.tsx", "components/patient/claim-flow.tsx"]) {
    assert.match(
      code(flow),
      /href="\/patient\/sessions"[^]*?pclaim\.goToSessions/,
      `${flow}: "Go to my sessions" went Home`,
    );
  }
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
