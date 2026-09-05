import { NextResponse, type NextRequest } from "next/server";

import { PATIENT_COOKIE, routeDecision, SESSION_COOKIE } from "@/lib/routing";

/**
 * Middleware is a redirect optimiser. It is NOT the authorisation boundary.
 *
 * It runs on the edge with no database access, so the most it can know is that
 * a cookie is present — not that the session is live, not that the user is
 * still active, not what role they hold. Every page and route handler calls
 * `requireUser()` / `requirePatient()` for the real check.
 *
 * This distinction is the single most important thing to get right in the move
 * to one app. The previous codebase gated its portal on a `tt_auth=1` cookie
 * written by client JavaScript — anyone could set it. That was survivable only
 * because a separate API still demanded a bearer token. Here, server components
 * read the database directly, so trusting middleware would turn a forged cookie
 * into someone else's chart.
 *
 * The decision itself lives in `lib/routing.ts` as a pure function, so the rule
 * that a patient path never falls through to the clinician rules is covered by
 * tests rather than by reading.
 */
export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const decision = routeDecision(pathname, {
    clinician: Boolean(request.cookies.get(SESSION_COOKIE)?.value),
    patient: Boolean(request.cookies.get(PATIENT_COOKIE)?.value),
    expired: request.nextUrl.searchParams.get("expired") === "1",
  });

  if (decision.kind === "redirect") {
    const url = request.nextUrl.clone();
    url.pathname = decision.to;
    url.search = "";
    if (decision.keepNext) url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  // Server Components cannot see the request path. The guard needs it so that
  // an expired session returns you to the page you were actually on.
  const forwarded = new Headers(request.headers);
  forwarded.set("x-pathname", pathname);
  return NextResponse.next({ request: { headers: forwarded } });
}

export const config = {
  matcher: [
    // Everything except static assets, the Stripe webhook and the transcribe
    // endpoint (both authenticate themselves and must not be redirected).
    "/((?!_next/static|_next/image|favicon.ico|api/|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
