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

export const PROTECTED_PREFIXES = [
  "/dashboard",
  "/sessions",
  "/patients",
  "/notes",
  "/copilot",
  "/on-call",
  "/billing",
  "/settings",
  "/admin",
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
export const PATIENT_OPEN_ROUTES = ["/patient/invite"];

/** 21R.1 / C94 — where an unauthenticated caller at an admin route is sent. */
export const STAFF_SIGN_IN = "/staff/sign-in";

export type RouteDecision =
  /** Carry on, with `x-pathname` set for the server components. */
  | { kind: "pass" }
  /** Send them somewhere else. `keepNext` asks for `?next=<pathname>`. */
  | { kind: "redirect"; to: string; keepNext: boolean };

export function routeDecision(
  pathname: string,
  cookies: { clinician: boolean; patient: boolean; expired: boolean },
): RouteDecision {
  /*
   * Patient paths are decided here and returned from. Nothing below this block
   * may see one — `/patients` is a clinician route and `/patient` is not, and
   * the two differ by a single character.
   */
  if (PATIENT_PREFIXES.some((p) => isUnder(pathname, p))) {
    /* Reachable either way — see PATIENT_OPEN_ROUTES. */
    if (PATIENT_OPEN_ROUTES.some((p) => isUnder(pathname, p))) return { kind: "pass" };

    const isPatientAuthRoute = PATIENT_AUTH_ROUTES.some((p) => isUnder(pathname, p));

    if (!cookies.patient && !isPatientAuthRoute) {
      return { kind: "redirect", to: "/patient/login", keepNext: true };
    }
    // A cookie can outlive its session, and a Server Component cannot delete
    // one — `expired=1` is the escape hatch that stops the redirect loop.
    if (cookies.patient && !cookies.expired && isPatientAuthRoute) {
      return { kind: "redirect", to: "/patient", keepNext: false };
    }
    return { kind: "pass" };
  }

  if (!cookies.clinician && PROTECTED_PREFIXES.some((p) => isUnder(pathname, p))) {
    /*
     * 21R.1 — the admin console has its own door, and the staff form refuses a
     * clinician's credentials. Sending somebody bounced off /admin to /login
     * would send them to a form that will turn them away.
     */
    const to = isUnder(pathname, "/admin") ? STAFF_SIGN_IN : "/login";
    return { kind: "redirect", to, keepNext: true };
  }

  if (cookies.clinician && !cookies.expired && AUTH_ROUTES.includes(pathname)) {
    return { kind: "redirect", to: "/dashboard", keepNext: false };
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
