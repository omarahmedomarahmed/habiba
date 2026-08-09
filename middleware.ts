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
  "/copilot",
  "/on-call",
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

  /*
   * Someone holding a session cookie has no use for the sign-in page — unless
   * the cookie is a corpse.
   *
   * Middleware runs on the edge with no database, so "has a cookie" is not
   * "is signed in". Bouncing unconditionally is what produced an infinite
   * /login → /dashboard → /login loop for every therapist who closed their
   * browser and came back after the idle window: the cookie outlives the
   * session, and nothing in the cycle could clear it.
   *
   * `expired=1` is set by /session-expired *after* it has deleted the cookie,
   * so this is belt to that braces — if a stale cookie somehow survives, the
   * marker still lets the login page render and the loop still terminates.
   */
  const expired = request.nextUrl.searchParams.get("expired") === "1";

  if (hasCookie && !expired && AUTH_ROUTES.includes(pathname)) {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    url.search = "";
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
