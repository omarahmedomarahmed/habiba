import { NextResponse, type NextRequest } from "next/server";

import { DEFAULT_LOCALE, LOCALE_COOKIE } from "@/lib/i18n/config";
import { isLocalisable, LOCALE_HEADER, splitLocale } from "@/lib/i18n/paths";
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
 *
 * ## 31.1 — and it is where `/ar/*` becomes a real URL
 *
 * The language prefix is stripped here and handed to the render on a header,
 * so no route in the app has to know about languages and `lib/routing.ts`
 * keeps deciding on the path it has always decided on. See `lib/i18n/paths.ts`
 * for why this is a rewrite rather than an `app/[locale]/` tree.
 */
export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const { locale, rest } = splitLocale(pathname);
  const prefixed = locale !== DEFAULT_LOCALE;

  /*
   * 🔴 A prefixed path that is not public does not get to exist.
   *
   * `/ar/patient/journal` would be a second URL for somebody's private record,
   * which is the shape C153 ruled against one sprint ago. So it is not served
   * in Arabic at a second address — it is redirected to the one address it has,
   * and the language travels as the preference cookie instead, which is what
   * the signed-in app has always read.
   *
   * `/en/*` is redirected for the plainer reason that English is unprefixed:
   * two URLs for one page, one of them a 404 today, is worth one redirect.
   */
  if (prefixed && !isLocalisable(pathname)) {
    const url = request.nextUrl.clone();
    url.pathname = rest;
    const response = NextResponse.redirect(url);
    response.cookies.set(LOCALE_COOKIE, locale, {
      path: "/",
      maxAge: 60 * 60 * 24 * 365,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
    });
    return response;
  }

  if (/^\/en(?=\/|$)/.test(pathname)) {
    const url = request.nextUrl.clone();
    url.pathname = pathname.slice(3) || "/";
    return NextResponse.redirect(url);
  }

  const decision = routeDecision(rest, {
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
  // an expired session returns you to the page you were actually on, and 31.1
  // needs the prefix still on it so a page can declare its own canonical URL.
  const forwarded = new Headers(request.headers);
  forwarded.set("x-pathname", pathname);

  /*
   * 🔴 Deleted before it is set, on every request.
   *
   * The header is forwarded from the client, so without this line anybody
   * could send `x-locale: ar` to `/pricing` and be served an Arabic page at
   * the URL that declares itself canonical English. Not dangerous — it selects
   * a dictionary — but it is one document at one address rendering two ways,
   * and a crawler that saw it would be right to distrust the rest.
   */
  forwarded.delete(LOCALE_HEADER);

  if (!prefixed) return NextResponse.next({ request: { headers: forwarded } });

  /*
   * 🔴 The URL wins over the cookie, and only for this request.
   *
   * A header rather than a cookie write, because a shared link has to open in
   * the language it was shared in without silently changing what the reader
   * sees everywhere else afterwards. Somebody who reads one Arabic page a
   * colleague sent them has not chosen Arabic for the product.
   */
  forwarded.set(LOCALE_HEADER, locale);
  const url = request.nextUrl.clone();
  url.pathname = rest;
  return NextResponse.rewrite(url, { request: { headers: forwarded } });
}

export const config = {
  matcher: [
    // Everything except static assets, the Stripe webhook and the transcribe
    // endpoint (both authenticate themselves and must not be redirected).
    "/((?!_next/static|_next/image|favicon.ico|api/|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
