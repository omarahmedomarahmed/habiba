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
/** The patient's own sign-in pages, which a signed-in patient has no use for. */
export const PATIENT_AUTH_ROUTES = ["/patient/login", "/patient/signup"];

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
    return { kind: "redirect", to: "/login", keepNext: true };
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
