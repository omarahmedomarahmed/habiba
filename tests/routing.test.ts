import assert from "node:assert/strict";
import { test } from "node:test";

import { readFileSync } from "node:fs";

import {
  orgBounce,
  orgExpiredLanding,
  ownerOf,
  patientBounce,
  PRINCIPALS,
  routeDecision,
  signInDoorFor,
  type OrgPortal,
} from "../lib/routing";

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

test("/patients is the clinician's route and /patient is not, one character apart", () => {
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

/**
 * 🔴 21R.4 / C94 — the reset page a locked-out patient can actually reach.
 *
 * Somebody who cannot sign in has no patient cookie. If `/patient/
 * forgot-password` is not an auth route, the middleware bounces them to
 * `/patient/login` — the page they are on because they cannot use it. This is
 * the check that the door is not locked from the inside.
 */
test("a patient with no cookie can reach the reset page", () => {
  assert.deepEqual(routeDecision("/patient/forgot-password", nobody), { kind: "pass" });
});

test("…and a signed-in patient is sent to their own pages instead", () => {
  assert.deepEqual(routeDecision("/patient/forgot-password", patient), {
    kind: "redirect",
    to: "/patient",
    keepNext: false,
  });
});

/** 21R.1 — an unauthenticated caller at an admin route gets the admin door. */
test("the admin console bounces to the staff sign-in, not the clinician's", () => {
  assert.deepEqual(routeDecision("/admin/payouts", nobody), {
    kind: "redirect",
    to: "/staff/sign-in",
    keepNext: true,
  });
  assert.deepEqual(routeDecision("/sessions", nobody), {
    kind: "redirect",
    to: "/login",
    keepNext: true,
  });
});

/**
 * 🔴 22R — the invite link works before there is an account.
 *
 * Found by opening it as the patient: with no cookie the middleware sent
 * `/patient/invite/<token>` to `/patient/login`, so somebody handed a link in
 * the room met a sign-in form for an account they do not have. The page is
 * written for both cases; the router was not. It must pass either way — a
 * signed-in patient opening the same link is how the claim completes.
 */
test("the invite link is reachable with and without a patient cookie", () => {
  for (const cookies of [nobody, patient, clinician, both]) {
    assert.deepEqual(
      routeDecision("/patient/invite/abc123", { ...cookies, expired: false }),
      { kind: "pass" },
      JSON.stringify(cookies),
    );
  }
});

/* ======================================================================== */
/*  🔴 C264 — A CASE PER PRINCIPAL, NOT A BOOLEAN PER PRINCIPAL             */
/* ======================================================================== */

/**
 * The ruling's own words: *the existing suite extended to a case per principal
 * rather than a boolean per principal.*
 *
 * The distinction is the whole point. The fourteen tests above are hand-written
 * cases about two principals, and they are good tests — every one of them
 * encodes a bug somebody actually hit. What they cannot do is grow: adding a
 * sponsor as a third boolean would mean writing four more by hand, adding a
 * clinic a fifth, and the combination nobody writes is the one that breaks.
 *
 * So these iterate the TABLE. Every principal, every rule, whatever is added
 * later. A seventh portal gets its cases for free and a wrong one fails here
 * rather than in production.
 */

const ALL_COOKIES = ["clinician", "patient", "sponsor", "clinic", "partner"] as const;

/** Signed in as exactly one principal and nobody else. */
function only(cookie: (typeof ALL_COOKIES)[number]) {
  return Object.fromEntries([
    ...ALL_COOKIES.map((c) => [c, c === cookie]),
    ["expired", false],
  ]) as Parameters<typeof routeDecision>[1];
}

const NO_COOKIES = only("clinician" as never);

/** Only the principals that actually own paths today can be exercised. */
const live = PRINCIPALS.filter((p) => p.prefixes.length > 0);

test("C264 every live principal owns its own prefixes and nobody else's", () => {
  for (const principal of live) {
    for (const prefix of principal.prefixes) {
      assert.equal(
        ownerOf(prefix)?.name,
        principal.name,
        `${prefix} should belong to ${principal.name}`,
      );
      assert.equal(
        ownerOf(`${prefix}/something/deep`)?.name,
        principal.name,
        `${prefix}/something/deep should belong to ${principal.name}`,
      );
    }
  }
});

test("C264 an anonymous caller at any principal's path goes to THAT principal's door", () => {
  for (const principal of live) {
    for (const prefix of principal.prefixes) {
      // Open routes are reachable signed out by design, so skip those.
      if (principal.openRoutes?.some((open) => prefix === open)) continue;

      const decision = routeDecision(`${prefix}/deep`, {
        ...NO_COOKIES,
        clinician: false,
        expired: false,
      });

      assert.deepEqual(
        decision,
        { kind: "redirect", to: principal.signIn, keepNext: true },
        `${prefix}/deep should bounce to ${principal.signIn}`,
      );
    }
  }
});

test("C264 a signed-in principal at their own door is sent to their own home", () => {
  for (const principal of live) {
    for (const route of principal.authRoutes ?? []) {
      assert.deepEqual(
        routeDecision(route, only(principal.cookie)),
        { kind: "redirect", to: principal.home, keepNext: false },
        `${route} should send a signed-in ${principal.name} to ${principal.home}`,
      );
    }
  }
});

/**
 * 🔴 The one that matters most, generalised.
 *
 * A patient holding both cookies routed to a therapist's dashboard is the
 * original bug. The general form is: holding SOMEBODY ELSE'S cookie must never
 * admit you, and must never change where you are sent.
 */
test("C264 another principal's cookie never admits you and never changes your door", () => {
  for (const principal of live) {
    const prefix = principal.prefixes.find(
      (p) => !principal.openRoutes?.some((open) => p === open),
    );
    if (!prefix) continue;

    for (const cookie of ALL_COOKIES) {
      if (cookie === principal.cookie) continue;

      assert.deepEqual(
        routeDecision(`${prefix}/deep`, only(cookie)),
        { kind: "redirect", to: principal.signIn, keepNext: true },
        `a ${cookie} cookie must not admit anybody to ${prefix}`,
      );
    }
  }
});

/**
 * 🔴 An unbuilt portal bounces everybody rather than admitting anybody.
 *
 * `PrincipalCookies` is partial and fails safe. The clinic and partner rows
 * carry no prefixes yet, so nothing routes to them at all — but the moment
 * sprint 54 adds `/clinic` and forgets to read the cookie in `middleware.ts`,
 * the read comes back undefined and every visitor is bounced to the clinic
 * door. That is the safe direction, and this pins it.
 */
test("C264 a cookie the caller never read is treated as absent, not as present", () => {
  const sponsor = PRINCIPALS.find((p) => p.name === "sponsor")!;
  const prefix = sponsor.prefixes[0]!;

  // Deliberately omitting `sponsor` entirely, as middleware.ts did before 53.
  assert.deepEqual(
    routeDecision(`${prefix}/reports`, { clinician: true, patient: true, expired: false }),
    { kind: "redirect", to: sponsor.signIn, keepNext: true },
    "an unread cookie must never read as signed in",
  );
});

/**
 * 🔴 C230 / C259 — a sponsor's cookie opens nothing clinical.
 *
 * The seam both rulings rest on, asserted at the router as well as in the
 * guard: a sponsor is never an `Actor`, and the first step to becoming one
 * would be a cookie that reaches a clinical path.
 */
test("C230 a sponsor cookie reaches no clinician, staff or patient path", () => {
  for (const path of ["/dashboard", "/patients/abc", "/admin/vault", "/patient", "/notes"]) {
    const decision = routeDecision(path, only("sponsor"));
    assert.equal(decision.kind, "redirect", `${path} must not pass for a sponsor`);
    assert.notEqual(
      decision.kind === "redirect" ? decision.to : "",
      "/sponsor",
      `${path} must not send a sponsor into the sponsor portal either`,
    );
  }
});

/**
 * 🔴 The six exist, and the two unbuilt ones are named rather than implied.
 *
 * C264 is that the router is rewritten once FOR ALL SIX, before the second new
 * portal is built. A table with four rows and a comment promising two more is
 * the thing the ruling forbids.
 */
test("C264 all six principals are in the table, each with its own door", () => {
  assert.equal(PRINCIPALS.length, 6);

  const names = PRINCIPALS.map((p) => p.name).sort();
  assert.deepEqual(names, [
    "clinic",
    "clinician",
    "partner",
    "patient",
    "sponsor",
    "staff",
  ]);

  // No two principals share a door, or a bounce sends somebody to a form that
  // will turn them away — which is exactly what 21R.1 / C94 fixed for staff.
  const doors = PRINCIPALS.map((p) => p.signIn);
  assert.equal(new Set(doors).size, doors.length, "two principals share a sign-in");
});

/**
 * 🔴 THE INVARIANT THAT ACTUALLY PROTECTS `ownerOf`, and the one the first
 * draft of this rewrite got wrong.
 *
 * That draft's comment said order was load-bearing and that `/patient` had to
 * precede `/patients`. It is not, and it does not: `isUnder` matches on segment
 * boundaries, so neither path is under the other in either direction. Sprint 53
 * proved it by reintroducing the sprint 6 bug on purpose — moving the patient
 * row below the clinician row — and watching all twenty-one tests pass.
 *
 * So the claim was the defect. The real property is that NO TWO PRINCIPALS OWN
 * OVERLAPPING PREFIXES, which makes "first match wins" unambiguous whatever the
 * order, and which is checkable rather than remembered.
 *
 * This is the test that would have caught `/admin` staying in
 * `PROTECTED_PREFIXES` while also being the staff principal's — a real overlap
 * that the rewrite had to remove and that no output test would have shown.
 */
test("C264 no two principals own overlapping prefixes, so first-match is unambiguous", () => {
  const isUnder = (path: string, prefix: string) =>
    path === prefix || path.startsWith(`${prefix}/`);

  const clashes: string[] = [];
  for (const a of PRINCIPALS) {
    for (const b of PRINCIPALS) {
      if (a === b) continue;
      for (const x of a.prefixes) {
        for (const y of b.prefixes) {
          if (isUnder(x, y) || isUnder(y, x)) {
            clashes.push(`${a.name}:${x} overlaps ${b.name}:${y}`);
          }
        }
      }
    }
  }

  assert.deepEqual(clashes, [], clashes.join("; "));
});

/**
 * 🔴 CONTROL — and the overlap check can SEE an overlap.
 *
 * An empty-array assertion over a table that happens to be clean is
 * indistinguishable from one whose loop never runs. Fed a table with a real
 * overlap, the same predicate must report it.
 */
test("C264 CONTROL the overlap check catches a planted overlap", () => {
  const isUnder = (path: string, prefix: string) =>
    path === prefix || path.startsWith(`${prefix}/`);

  const planted = [
    { name: "clinician", prefixes: ["/admin"] },
    { name: "staff", prefixes: ["/admin"] },
  ];

  const clashes: string[] = [];
  for (const a of planted) {
    for (const b of planted) {
      if (a === b) continue;
      for (const x of a.prefixes) {
        for (const y of b.prefixes) {
          if (isUnder(x, y) || isUnder(y, x)) clashes.push(`${a.name} overlaps ${b.name}`);
        }
      }
    }
  }

  assert.equal(clashes.length, 2, "the check must see an overlap that exists");
});

/**
 * 🔴 W2-S01: the domain mailbox link opens for the IT contact it was mailed to.
 *
 * `confirmDomainMailbox` is authorised by the HMAC in the link, and the page says
 * it has no guard on purpose. The router still bounced a stranger to the sponsor
 * sign-in, so the one person the email was for could never press the button.
 * Only the confirm path opens: the domains page itself stays behind the door.
 */
/**
 * 🔴 W2-S05: a company user who cannot sign in can still reach the two pages
 * that let them: asking for a reset link, and setting a password from one.
 */
test("W2-S05 forgot password and set password are reachable signed out", () => {
  const stranger = { clinician: false, patient: false, expired: false };
  assert.deepEqual(routeDecision("/sponsor/forgot-password", stranger), { kind: "pass" });
  assert.deepEqual(routeDecision("/sponsor/set-password", stranger), { kind: "pass" });
  assert.equal(routeDecision("/sponsor/team", stranger).kind, "redirect");
});

test("W2-S01 the domain mailbox confirm link opens without a portal login", () => {
  const stranger = { clinician: false, patient: false, expired: false };
  assert.deepEqual(routeDecision("/sponsor/domains/confirm/abc", stranger), { kind: "pass" });
  assert.deepEqual(routeDecision("/sponsor/domains", stranger), {
    kind: "redirect",
    to: "/sponsor/sign-in",
    keepNext: true,
  });
});

/* ------------------------------------------- board 249 / 327 / 330: every door -- */

/**
 * 🔴 A cookie that outlives its session must end at a sign-in FORM at every one
 * of the six doors. Walks the real chain: the guard's bounce for a cookie
 * holder, the middleware decision on that bounce (cookie still present), then
 * the landing the handler redirects to (cookie now gone, `expired=1`). A
 * redirect back to the principal's home at any step is the loop the clinic and
 * company portals shipped with.
 */
function guardBounce(name: string, path: string): string {
  if (name === "patient") return patientBounce(true, path);
  if (name === "staff" || name === "clinician") return "/session-expired";
  return orgBounce(name as OrgPortal, true);
}

function handlerLanding(name: string, path: string): string {
  if (name === "patient") return "/patient/login?expired=1";
  if (name === "staff" || name === "clinician") return `${signInDoorFor(path)}?expired=1`;
  return orgExpiredLanding(name as OrgPortal);
}

test("a stale cookie at every portal ends at that portal's sign-in form, never in a loop", () => {
  for (const principal of PRINCIPALS) {
    const withCookie = { [principal.cookie]: true, expired: false };
    const bounce = guardBounce(principal.name, principal.home).split("?")[0]!;
    assert.deepEqual(
      routeDecision(bounce, withCookie),
      { kind: "pass" },
      `${principal.name}: the guard's bounce ${bounce} must be reachable while the stale cookie is held`,
    );
    assert.notEqual(bounce, principal.signIn, `${principal.name}: a cookie holder sent straight to the door loops`);

    const landing = handlerLanding(principal.name, principal.home);
    const [landingPath, landingQuery = ""] = landing.split("?");
    assert.equal(landingPath, principal.signIn, `${principal.name}: the handler lands on its own sign-in`);
    assert.deepEqual(
      routeDecision(landingPath!, { ...withCookie, expired: new URLSearchParams(landingQuery).get("expired") === "1" }),
      { kind: "pass" },
      `${principal.name}: the sign-in form renders after the handler`,
    );
  }
});

test("no org guard redirects a cookie holder straight to its sign-in page", () => {
  for (const portal of ["clinic", "sponsor", "partner"] as const) {
    const source = readFileSync(`lib/${portal}-auth/guard.ts`, "utf8");
    assert.match(source, new RegExp(`orgBounce\\("${portal}"`), `${portal} guard must use orgBounce`);
    assert.doesNotMatch(source, /redirect\([A-Z]+_SIGN_IN\)/, `${portal} guard redirects straight to the door`);
    const handler = readFileSync(`app/(${portal})/${portal}/session-expired/route.ts`, "utf8");
    assert.match(handler, /revoke\w+Session\(\)/, `${portal} handler must clear the cookie`);
  }
});

test("board 651: a stale clinic cookie reaches the sign-in form in one redirect, and the landing clears it", async () => {
  const { orgCookieToClear, CLINIC_COOKIE, SPONSOR_COOKIE, PARTNER_COOKIE } = await import("../lib/routing");
  /* The landing clears its own portal's cookie, and only with `expired=1`. */
  assert.equal(orgCookieToClear("/clinic/sign-in", true), CLINIC_COOKIE);
  assert.equal(orgCookieToClear("/sponsor/sign-in", true), SPONSOR_COOKIE);
  assert.equal(orgCookieToClear("/partner/sign-in", true), PARTNER_COOKIE);
  assert.equal(orgCookieToClear("/clinic/sign-in", false), null, "a plain visit to the door signs nobody out");
  assert.equal(orgCookieToClear("/clinic", true), null);

  /* The layout, above the loading boundary, sends a stale holder straight to the landing. */
  const layout = readFileSync("app/(clinic)/layout.tsx", "utf8");
  assert.match(layout, /redirect\(orgExpiredLanding\("clinic"\)\)/, "the clinic layout must redirect a stale cookie itself");
  assert.match(layout, /!door/, "and never on a door, which the layout also wraps");
  const middleware = readFileSync("middleware.ts", "utf8");
  assert.match(middleware, /orgCookieToClear\(/, "middleware must clear the stale cookie at the landing");
  assert.match(middleware, /response\.cookies\.delete\(staleCookie\)/);
});
