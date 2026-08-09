import { NextResponse, type NextRequest } from "next/server";

/**
 * Middleware is a redirect optimiser. It is NOT the authorisation boundary.
 *
 * It runs on the edge with no database access, so the most it can know is that
 * a cookie is present — not that the session is live, not that the user is
 * still active, not what role they hold. Every page and route handler calls
 * `requireUser()` / `requireRole()` for the real check.
 *
 * This distinction is the single most important thing to get right in the move
 * to one app. The previous codebase gated its portal on a `tt_auth=1` cookie
 * written by client JavaScript — anyone could set it. That was survivable only
 * because a separate API still demanded a bearer token. Here, server components
 * read the database directly, so trusting middleware would turn a forged cookie
 * into someone else's chart.
 */

const SESSION_COOKIE = "24t_session";

const PROTECTED_PREFIXES = [
  "/dashboard",
  "/sessions",
  "/patients",
  "/notes",
  "/billing",
  "/settings",
  "/admin",
];

const AUTH_ROUTES = ["/login", "/signup"];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const hasCookie = Boolean(request.cookies.get(SESSION_COOKIE)?.value);

  if (!hasCookie && PROTECTED_PREFIXES.some((p) => pathname.startsWith(p))) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  // Someone holding a session cookie has no use for the sign-in page. If the
  // cookie turns out to be stale, `requireUser()` on /dashboard bounces them
  // straight back — which is the correct place for that decision to be made.
  if (hasCookie && AUTH_ROUTES.includes(pathname)) {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    url.search = "";
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    // Everything except static assets, the Stripe webhook and the transcribe
    // endpoint (both authenticate themselves and must not be redirected).
    "/((?!_next/static|_next/image|favicon.ico|api/|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
