/**
 * Where a request should go, as arithmetic.
 *
 * Split out of `middleware.ts` in sprint 6 so the one rule that matters can be
 * tested without an edge runtime: **a patient path is decided by the patient
 * rules and never falls through to the clinician ones.** That fall-through was
 * the real bug — a patient holding both cookies was redirected to a
 * therapist's dashboard.
 *
 * This is still not the authorisation boundary. It knows only which cookies are
 * present, never whether a session is live. `requireUser` / `requirePatient` do
 * the real check on every page.
 */

export const SESSION_COOKIE = "24t_session";
/**
 * The patient's cookie. A different name from the clinician's, on purpose —
 * both can be present at once, in one browser, for two different people.
 */
export const PATIENT_COOKIE = "24t_patient";

/**
 * Every clinician path. `/admin` is NOT here: it is the staff principal's, with
 * its own door.
 *
 * 🔴 Six were missing until sprint 53: `/assistant`, `/bookings`, `/connect`,
 * `/earnings`, `/onboarding` and `/support`. Every one of those pages calls
 * `requireUser`, so there was no authorisation hole — what was lost is that an
 * unauthenticated request ran a Server Component render before being turned
 * away instead of stopping at the edge, and, worse, that this list stopped
 * being a true statement of who owns what. C264's whole argument is that the
 * next portal copies this pattern.
 */
export const PROTECTED_PREFIXES = [
  "/assistant",
  "/billing",
  "/bookings",
  "/connect",
  "/copilot",
  "/dashboard",
  "/earnings",
  "/notes",
  /* 🔴 W2-T06: the clinician's notifications list. */
  "/notifications",
  "/on-call",
  "/onboarding",
  "/patients",
  "/sessions",
  "/settings",
  "/support",
];

export const AUTH_ROUTES = ["/login", "/signup"];

/** Everything a signed-in patient reaches. Guarded properly by `requirePatient`. */
export const PATIENT_PREFIXES = ["/patient"];
/**
 * The patient's own sign-in pages, which a signed-in patient has no use for.
 *
 * 🔴 21R.4 — `/patient/forgot-password` belongs here, and the reason is the
 * whole bug: a person who cannot sign in has no patient cookie, so any patient
 * path that is not on this list bounces them to `/patient/login` — the page
 * they are on because they cannot use it. A reset route missing from this list
 * is a reset route nobody can reach.
 */
export const PATIENT_AUTH_ROUTES = [
  "/patient/login",
  "/patient/signup",
  "/patient/forgot-password",
];

/**
 * 🔴 22R — patient routes that work signed in AND signed out.
 *
 * The invite link is the one a therapist hands over in the room, and for most
 * of this book it is the *only* claim route that can work (§3b: 56 of 66
 * patients have no email). The page itself is written for both cases — it says
 * "create an account or sign in, then open this link again" — and the
 * middleware never let an anonymous person reach it: with no patient cookie,
 * `/patient/invite/<token>` was redirected to `/patient/login`, so a patient
 * opening the link their therapist just gave them met a sign-in form for an
 * account they do not have, with no mention of the invite.
 *
 * Found by opening the link as the patient, in a browser with no cookies. No
 * verifier could have found it: the route exists, the page renders, the token
 * resolves, and every check about all three passes.
 */
export const PATIENT_OPEN_ROUTES = ["/patient/invite", "/patient/session-expired"];

/**
 * 🔴 W2-P01: where `requirePatient` sends somebody it cannot resolve.
 *
 * The clinician's loop, repeated on the patient side: a cookie outlives its
 * session (four hours idle, seven days of `maxAge`), `requirePatient` sent the
 * holder to `/patient/login`, and the rule above sends a cookie holder at their
 * own door back to `/patient`. Nothing in that cycle can delete the cookie,
 * because a Server Component cannot write one.
 *
 * So a cookie holder goes to `/patient/session-expired`, a route handler that
 * can delete it, and it is an open route so the cookie it is there to clear is
 * never bounced away from it. Pure, so the whole chain is a test.
 */
/**
 * 🔴 W2-P02: where a patient goes after signing in, from the `next` they carried.
 *
 * Both sign-in forms went to `/patient` whatever `next` said, so the invite
 * page's promise ("we will bring you straight back here") was false for "Sign
 * in", and the sponsor's QR lost its code. A path on this origin that a patient
 * can use comes back as given; anything else, including an absolute URL, a
 * door, or a clinician's page, is Home.
 */
const PATIENT_LANDINGS = ["/patient", "/join", "/pay", "/feedback", "/j"];

export function patientLanding(next: unknown): string {
  const home = "/patient";
  if (typeof next !== "string" || !next.startsWith("/") || next.startsWith("//")) return home;
  if (next.includes("\\")) return home;
  const path = next.split(/[?#]/)[0]!;
  if (PATIENT_AUTH_ROUTES.includes(path) || isUnder(path, "/patient/session-expired")) return home;
  return PATIENT_LANDINGS.some((prefix) => isUnder(path, prefix)) ? next : home;
}

/**
 * 🔴 W2-P02 / W2-P08: the `next` a bounce carries keeps its query.
 *
 * The sponsor's QR is `/patient/benefit?code=`, and the bounce kept only the
 * path, so the code was gone by the time the person had signed in.
 */
export function bounceNext(pathname: string, search: string): string {
  return search && search !== "?" ? `${pathname}${search}` : pathname;
}

export function patientBounce(hasCookie: boolean, path: string): string {
  const next = path.startsWith("/") && !path.startsWith("//") ? path : "";
  const query = next ? `?next=${encodeURIComponent(next)}` : "";
  return hasCookie ? `/patient/session-expired${query}` : `/patient/login${query}`;
}

/**
 * Where a record export is collected, as a URL path. Here rather than in
 * `lib/data/export.ts` so the admin mail previews can link it without reaching
 * a module that reads clinical data (58.6).
 */
export function recordExportPath(token: string): string {
  return `/records/${token}`;
}

/** 21R.1 / C94 — where an unauthenticated caller at an admin route is sent. */
export const STAFF_SIGN_IN = "/staff/sign-in";

/**
 * 🔴 AE56: the sign-in door for a path somebody was bounced from. One answer
 * for the guard (no cookie) and for /session-expired (a stale one): the
 * practice form refuses a back office account, so an admin path goes to the
 * staff door.
 */
export function signInDoorFor(path: string | null | undefined): string {
  return path?.startsWith("/admin") ? STAFF_SIGN_IN : "/login";
}

/**
 * 🔴 Task 40: where a back office session that has only given its password
 * is sent. Owned by no principal on purpose: it needs the clinician cookie to
 * mean anything, and it is not a door a signed in holder should be bounced
 * away from, which is what an `authRoutes` entry would do. The page resolves
 * the pending session itself and sends everybody else on.
 */
export const STAFF_SECOND_STEP = "/staff/second-step";

/**
 * 🔴 53.4 / C230 — the sponsor's own door and its own paths.
 *
 * A sponsor is never an `Actor` and never inside clinical tenancy, so they do
 * not share a cookie, a prefix or a sign-in with anybody. `/sponsor` rather
 * than `/corporate` because it is what the table is called and one word for
 * one thing is cheaper than two.
 */
export const SPONSOR_COOKIE = "24t_sponsor";
export const SPONSOR_SIGN_IN = "/sponsor/sign-in";
/**
 * 🔴 W2-S05: the way back in, and the way in for an invited colleague. Doors
 * like the sign-in page: open signed out, and a signed-in holder is sent home.
 */
export const SPONSOR_FORGOT = "/sponsor/forgot-password";
export const SPONSOR_SET_PASSWORD = "/sponsor/set-password";
export const SPONSOR_PREFIXES = ["/sponsor"];

/**
 * 🔴 54.2 / 54.3 / C259 / C264 — the clinic's own door and its own paths.
 *
 * A clinic manager is a new kind of user INSIDE an organisation (C259) rather than
 * outside it like a sponsor, and they still get their own cookie, their own prefix
 * and their own sign-in. Sharing the clinician cookie would be the one shortcut that
 * undoes the whole sprint: the clinician principal's routes are the clinical product.
 *
 * `/clinic/apply` is open for the same reason `/sponsor/apply` is — a practice with
 * no account cannot sign in to ask for one. `/clinic/join/[token]` is open because it
 * is the INVITED CLINICIAN's screen, and they are not a clinic manager at all: they
 * are about to become an ordinary clinician (C267), so they must not be bounced to a
 * manager's sign-in on the way to accepting.
 */
export const CLINIC_COOKIE = "24t_clinic";
export const CLINIC_SIGN_IN = "/clinic/sign-in";
export const CLINIC_PREFIXES = ["/clinic"];
export const CLINIC_APPLY = "/clinic/apply";
export const CLINIC_JOIN = "/clinic/join";
/* 🔴 W2-C05 / W2-C04: a reset asked for by email, and the page a link opens. */
export const CLINIC_FORGOT = "/clinic/forgot-password";
export const CLINIC_SET_PASSWORD = "/clinic/set-password";

/**
 * 🔴 W2-C07: the clinic's DOORS, which render inside the site's own header
 * and footer rather than the portal's rail. The sign-in was the only one, so
 * the enquiry and the invited clinician's screen had no logo, no way back and
 * no language switch.
 */
export function isClinicDoor(path: string): boolean {
  return (
    path === CLINIC_SIGN_IN ||
    path === CLINIC_APPLY ||
    path === CLINIC_FORGOT ||
    path === CLINIC_SET_PASSWORD ||
    path.startsWith(`${CLINIC_JOIN}/`)
  );
}

/**
 * 🔴 55.1 / C264 — the sixth principal, and the router is unchanged for it.
 *
 * This is the payoff C264 was written for: sprint 53 rewrote `routeDecision` once for
 * all six, sprint 54 needed one line in middleware, and sprint 55 needs one line and
 * three constants. Nothing in the decision function knows a partner exists.
 *
 * `/partner/apply` is open because a company with no account cannot sign in to ask for
 * one, the same as the sponsor's and the clinic's.
 *
 * 🔴 `/developers` IS NOT HERE, deliberately. 55.12 asks for a PUBLIC page naming the
 * use cases, so it lives in `(public)` with the rest of the marketing site and is not a
 * route any principal owns. A docs page behind a sign-in is a docs page nobody
 * evaluating us can read.
 */
export const PARTNER_COOKIE = "24t_partner";
export const PARTNER_SIGN_IN = "/partner/sign-in";
export const PARTNER_PREFIXES = ["/partner"];
export const PARTNER_APPLY = "/partner/apply";
/** W2-X06: asking for a reset link, and the page a reset or an invitation lands on. */
export const PARTNER_FORGOT = "/partner/forgot";
export const PARTNER_RESET = "/partner/reset";

/**
 * 🔴 53.5 — the one door inside `/sponsor` that is open to a stranger.
 *
 * An organisation that wants to talk to us has no account yet, so the enquiry
 * form cannot sit behind the sign-in it exists to precede. It is listed here as
 * an exception rather than moved outside `/sponsor`, because a corporate door at
 * `/apply` would be a second prefix nobody owns and `ownerOf` would return null
 * for it — which is the shape C264 was rewritten to get rid of.
 *
 * It takes a name, an email, a phone number and a best time to call, and it
 * creates a HELD account. Nothing about it reveals that anybody is enrolled
 * anywhere, so there is nothing behind it to protect.
 */
export const SPONSOR_APPLY = "/sponsor/apply";

/**
 * 🔴 W2-S01: the domain mailbox link, opened by an IT contact with no login.
 *
 * `confirmDomainMailbox` is authorised by the HMAC in the link (C318), and the
 * page carries no guard for that reason. Until this was listed the router sent
 * that contact to the sponsor sign-in, so the proof could only be completed by
 * somebody who already had a portal login. Only the confirm path is open.
 */
export const SPONSOR_DOMAIN_CONFIRM = "/sponsor/domains/confirm";

/**
 * 🔴 C264 — THE SIX PRINCIPALS, AS A TABLE. Rewritten once, in sprint 53.
 *
 * ## Why a table and not five more `if` blocks
 *
 * `routeDecision` was a pure function of two booleans, and three more
 * principals were about to arrive: a sponsor (53), a clinic manager (54) and a
 * partner developer (55), each with its own portal, its own sign-in and its own
 * idea of what a bounce means. *Bolted on one at a time, this becomes the
 * function nobody can reason about and every new portal breaks a redirect for
 * an existing one.* Sprint 53 pays for work 54 and 55 benefit from.
 *
 * Every principal answers the same four questions, so they are four columns
 * rather than four branches:
 *
 *   - which paths do I own
 *   - which of my paths work signed OUT as well as in
 *   - which of my paths are my own door
 *   - where does a signed-in holder of my cookie land instead of that door
 *
 * ## 🔴 Order is NOT what keeps `/patient` and `/patients` apart
 *
 * The first draft of this comment said it was, and that was wrong. `isUnder`
 * matches on SEGMENT boundaries, so `/patient` is not under `/patients` and
 * `/patients` is not under `/patient` — neither direction, in either order.
 * That is what sprint 6 actually fixed, and it is why this rewrite could
 * reorder the table freely without any test noticing.
 *
 * I found that by reintroducing the sprint 6 bug on purpose and watching
 * twenty-one tests pass. The claim was the defect, not the code.
 *
 * The real invariant is stronger and is now a test: **no two principals own
 * overlapping prefixes.** With that held, `ownerOf` returning the first match
 * is unambiguous whatever the order, and a table that acquires an overlap
 * fails loudly instead of resolving to whichever row happens to be higher.
 *
 * Staff still sits first for readability — `/admin` beside its own door — but
 * nothing depends on it.
 *
 * ## 🔴 Two principals share the clinician cookie, deliberately
 *
 * Staff sign in at `/staff/sign-in` and carry the same session cookie as a
 * clinician; what differs is the door they are bounced to, because the staff
 * form refuses a therapist's credentials (21R.1, C94). So `cookie` and
 * `signIn` are separate columns. Sponsors, clinic managers and partners have
 * their own cookies, because C230 and C259 are that none of them is ever an
 * `Actor` and a shared cookie is the first step to becoming one.
 *
 * ## This is still not the authorisation boundary
 *
 * It knows which cookies are present, never whether a session is live.
 * `requireUser`, `requirePatient` and `requireSponsor` do the real check on
 * every page.
 */
export type PrincipalCookie = "clinician" | "patient" | "sponsor" | "clinic" | "partner";

/**
 * 🔴 Board 249 / 327 / 330: the clinic, company and partner doors had the loop
 * the clinician (`/session-expired`) and patient (W2-P01) doors lost long ago.
 *
 * A cookie outlives its session (aged out, or revoked by a password reset),
 * the guard sent the holder to the sign-in page, and middleware sends a cookie
 * holder at their own door home again, forever. A Server Component cannot
 * delete a cookie, so each portal now has a route handler that can, and it is
 * an open route so the cookie it exists to clear is never bounced away from it.
 */
export const CLINIC_EXPIRED = "/clinic/session-expired";
export const SPONSOR_EXPIRED = "/sponsor/session-expired";
export const PARTNER_EXPIRED = "/partner/session-expired";

export type OrgPortal = "clinic" | "sponsor" | "partner";

const ORG_DOORS: Record<OrgPortal, { signIn: string; expired: string }> = {
  clinic: { signIn: CLINIC_SIGN_IN, expired: CLINIC_EXPIRED },
  sponsor: { signIn: SPONSOR_SIGN_IN, expired: SPONSOR_EXPIRED },
  partner: { signIn: PARTNER_SIGN_IN, expired: PARTNER_EXPIRED },
};

/** Where an org guard sends somebody it cannot resolve. Pure, so the chain is a test. */
export function orgBounce(portal: OrgPortal, hasCookie: boolean): string {
  const door = ORG_DOORS[portal];
  return hasCookie ? door.expired : door.signIn;
}

/** Where an org portal's session-expired handler lands, after the cookie is gone. */
export function orgExpiredLanding(portal: OrgPortal): string {
  return `${ORG_DOORS[portal].signIn}?expired=1`;
}

/**
 * 🔴 Board 651: THE COOKIE MIDDLEWARE CLEARS ON THE WAY THROUGH A LANDING.
 *
 * A stale clinic cookie took five navigations and ten seconds to reach the
 * sign-in form: the page's guard redirected from inside a streamed response
 * (after the loading screen had flushed), the browser followed it on the
 * client, then the route handler that deletes the cookie redirected again.
 * Middleware can set cookies, so the landing itself clears the portal's
 * cookie, and the layout sends a stale holder straight there: one redirect.
 */
export function orgCookieToClear(pathname: string, expired: boolean): string | null {
  if (!expired) return null;
  if (pathname === CLINIC_SIGN_IN) return CLINIC_COOKIE;
  if (pathname === SPONSOR_SIGN_IN) return SPONSOR_COOKIE;
  if (pathname === PARTNER_SIGN_IN) return PARTNER_COOKIE;
  return null;
}

export type Principal = {
  /** For the tests and for a failure message somebody has to read. */
  name: string;
  /** Which cookie proves it. Staff shares the clinician's. */
  cookie: PrincipalCookie;
  /** The paths this principal owns. Matched in order, first owner wins. */
  prefixes: string[];
  /** Its own sign-in, and where a bounce goes. */
  signIn: string;
  /** Where a signed-in holder goes instead of their own door. */
  home: string;
  /** Paths of its own that work signed out too. */
  openRoutes?: string[];
  /** Exact paths that are this principal's door. */
  authRoutes?: string[];
};

export const PRINCIPALS: Principal[] = [
  /*
   * Staff first for readability: `/admin` beside its own door. Nothing depends
   * on the position — see the header, and `ownerOf` is unambiguous because no
   * two principals own overlapping prefixes, which is a test.
   */
  {
    name: "staff",
    cookie: "clinician",
    prefixes: ["/admin"],
    signIn: STAFF_SIGN_IN,
    home: "/admin",
    authRoutes: [STAFF_SIGN_IN],
  },
  /*
   * `/patient` and `/patients` belong to different people and differ by one
   * character. `isUnder` matches segment boundaries, so neither is under the
   * other and the order of these two rows is irrelevant. That is what sprint 6
   * fixed; a comment in this file claimed it was the ORDER until sprint 53
   * proved otherwise by reversing them and watching every test still pass.
   */
  {
    name: "patient",
    cookie: "patient",
    prefixes: PATIENT_PREFIXES,
    signIn: "/patient/login",
    home: "/patient",
    openRoutes: PATIENT_OPEN_ROUTES,
    authRoutes: PATIENT_AUTH_ROUTES,
  },
  {
    name: "clinician",
    cookie: "clinician",
    prefixes: PROTECTED_PREFIXES,
    signIn: "/login",
    home: "/dashboard",
    /*
     * 🔴 `/support/<token>` is a PUBLIC page reached from an email, and
     * `/support` is a clinician screen. Both exist, which is why `/support`
     * was quietly missing from the prefix list rather than exempted.
     *
     * An open route says so instead. Leaving it off the list made the list
     * false about what it covered, and the next portal would have copied an
     * incomplete pattern — which is the whole failure C264 is about.
     */
    openRoutes: ["/support"],
    authRoutes: AUTH_ROUTES,
  },
  /*
   * 🔴 Sponsor (53), clinic manager (54), partner (55).
   *
   * Written now, all three, because that is the ruling: rewritten ONCE for six
   * rather than once per portal. The clinic and partner rows carry no routes
   * yet and are not dead code — they are the statement that those portals do
   * not share a cookie or a door with anybody, made before somebody is under
   * pressure to ship one.
   *
   * C230 / C259: a sponsor is never an `Actor` and never inside clinical
   * tenancy, and a separate cookie is the first thing that keeps that true.
   */
  {
    name: "sponsor",
    cookie: "sponsor",
    prefixes: SPONSOR_PREFIXES,
    signIn: SPONSOR_SIGN_IN,
    home: "/sponsor",
    authRoutes: [SPONSOR_SIGN_IN, SPONSOR_FORGOT, SPONSOR_SET_PASSWORD],
    /* 53.5 — the enquiry form, which cannot sit behind the sign-in it precedes. */
    openRoutes: [SPONSOR_APPLY, SPONSOR_DOMAIN_CONFIRM, SPONSOR_EXPIRED],
  },
  {
    name: "clinic",
    cookie: "clinic",
    prefixes: CLINIC_PREFIXES,
    signIn: CLINIC_SIGN_IN,
    home: "/clinic",
    authRoutes: [CLINIC_SIGN_IN],
    /*
     * 54.3 — the enquiry, and 54.5 — the INVITED CLINICIAN's own screen.
     *
     * The second one matters more than it looks. Somebody opening an invitation link
     * is not a clinic manager and never will be: they are about to become an ordinary
     * clinician who verifies themselves (C267). Bouncing them to a manager's sign-in
     * would be the product telling an invited therapist to log in as their employer.
     */
    /*
     * 🔴 W2-C05 / W2-C04: and the two password doors. Somebody who cannot sign
     * in has no cookie, so a reset route behind the sign-in is a reset nobody
     * can reach (the 21R.4 lesson, for this principal).
     */
    openRoutes: [CLINIC_APPLY, CLINIC_JOIN, CLINIC_FORGOT, CLINIC_SET_PASSWORD, CLINIC_EXPIRED],
  },
  {
    name: "partner",
    cookie: "partner",
    prefixes: PARTNER_PREFIXES,
    signIn: PARTNER_SIGN_IN,
    home: "/partner",
    authRoutes: [PARTNER_SIGN_IN],
    /* 55.2 — the enquiry, which cannot sit behind the sign-in it precedes. */
    /* W2-X06: and the two password pages, which a locked-out person must reach. */
    openRoutes: [PARTNER_APPLY, PARTNER_FORGOT, PARTNER_RESET, PARTNER_EXPIRED],
  },
];

export type RouteDecision =
  /** Carry on, with `x-pathname` set for the server components. */
  | { kind: "pass" }
  /** Send them somewhere else. `keepNext` asks for `?next=<pathname>`. */
  | { kind: "redirect"; to: string; keepNext: boolean };

/**
 * Which cookies the caller found.
 *
 * 🔴 PARTIAL, and it FAILS SAFE. A cookie the caller does not mention reads as
 * absent, so the principal that needs it bounces everybody to its own sign-in.
 * The alternative — requiring all five — would force `middleware.ts` and every
 * test to pass flags for portals that do not exist yet, and the noise is how a
 * real omission stops being visible.
 *
 * The keys are typed, so a misspelled cookie is a compile error rather than a
 * silent false.
 */
export type PrincipalCookies = Partial<Record<PrincipalCookie, boolean>> & {
  expired: boolean;
};

/**
 * Which principal owns this path, or none. First match wins.
 *
 * 🔴 "First match" is only unambiguous because no two principals own
 * overlapping prefixes, which `tests/routing.test.ts` asserts directly rather
 * than leaving to the order of this array.
 *
 * Exported so the tests can assert ownership per principal. A test on the
 * router's OUTPUT would only catch a mis-assignment for the paths somebody
 * thought to try.
 */
export function ownerOf(pathname: string): Principal | null {
  for (const principal of PRINCIPALS) {
    if (principal.prefixes.some((prefix) => isUnder(pathname, prefix))) return principal;
    if (principal.authRoutes?.includes(pathname)) return principal;
  }
  return null;
}

export function routeDecision(pathname: string, cookies: PrincipalCookies): RouteDecision {
  const principal = ownerOf(pathname);
  if (!principal) return { kind: "pass" };

  /* Reachable either way. The invite link, and the public support page. */
  if (principal.openRoutes?.some((prefix) => isUnder(pathname, prefix))) {
    return { kind: "pass" };
  }

  const signedIn = cookies[principal.cookie] ?? false;
  const atTheirDoor = principal.authRoutes?.includes(pathname) ?? false;

  if (!signedIn && !atTheirDoor) {
    return { kind: "redirect", to: principal.signIn, keepNext: true };
  }

  /*
   * A cookie can outlive its session, and a Server Component cannot delete
   * one — `expired=1` is the escape hatch that stops the redirect loop.
   */
  if (signedIn && !cookies.expired && atTheirDoor) {
    return { kind: "redirect", to: principal.home, keepNext: false };
  }

  return { kind: "pass" };
}

/**
 * Prefix matching on path *segments*.
 *
 * `startsWith` alone would put `/patientsomething` under `/patient`, and — the
 * one that would actually hurt — a future `/patients-export` under the
 * clinician prefix `/patients`. Matching a segment boundary costs nothing.
 */
function isUnder(pathname: string, prefix: string): boolean {
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}
