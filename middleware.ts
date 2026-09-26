import { NextResponse, type NextRequest } from "next/server";

import { contentSecurityPolicy, cspHeaderName, isVideoRoom } from "@/lib/security/csp";
import { DEFAULT_LOCALE, LOCALE_COOKIE } from "@/lib/i18n/config";
import { englishOnly, isLocalisable, LOCALE_HEADER, splitLocale } from "@/lib/i18n/paths";
import {
  bounceNext,
  CLINIC_COOKIE,
  orgCookieToClear,
  PARTNER_COOKIE,
  PATIENT_COOKIE,
  routeDecision,
  SESSION_COOKIE,
  SPONSOR_COOKIE,
} from "@/lib/routing";

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

  /*
   * 🔴 C264 — one cookie per principal, read here and decided in one table.
   *
   * 🔴 ALL SIX NOW EXIST, and this is what C264 bought.
   *
   * Sprint 53 rewrote `routeDecision` once for all six principals rather than bolting
   * one on per portal. Sprint 54 cost one line here. Sprint 55 cost one line here. The
   * decision function has not been touched since the day it was written, and the test
   * suite that iterates `PRINCIPALS` covered each new portal before it existed.
   *
   * The staff principal shares the clinician cookie and is the one exception, for the
   * reason stated in `lib/routing.ts`: the same cookie proves the same thing and only
   * the door differs.
   */
  const decision = routeDecision(rest, {
    clinician: Boolean(request.cookies.get(SESSION_COOKIE)?.value),
    patient: Boolean(request.cookies.get(PATIENT_COOKIE)?.value),
    sponsor: Boolean(request.cookies.get(SPONSOR_COOKIE)?.value),
    clinic: Boolean(request.cookies.get(CLINIC_COOKIE)?.value),
    partner: Boolean(request.cookies.get(PARTNER_COOKIE)?.value),
    expired: request.nextUrl.searchParams.get("expired") === "1",
  });

  if (decision.kind === "redirect") {
    const url = request.nextUrl.clone();
    url.pathname = decision.to;
    url.search = "";
    // W2-P02: the query travels too, or the sponsor QR's `?code=` is lost.
    if (decision.keepNext) url.searchParams.set("next", bounceNext(pathname, request.nextUrl.search));
    return NextResponse.redirect(url);
  }

  // Server Components cannot see the request path. The guard needs it so that
  // an expired session returns you to the page you were actually on, and 31.1
  // needs the prefix still on it so a page can declare its own canonical URL.
  const forwarded = new Headers(request.headers);
  forwarded.set("x-pathname", pathname);

  /*
   * 🔴 THE CSP NONCE, MINTED HERE BECAUSE THIS IS THE ONLY PLACE THAT RUNS
   * ONCE PER REQUEST BEFORE ANYTHING IS RENDERED.
   *
   * The policy itself is `lib/security/csp.ts`, which carries the argument for
   * each directive. Two mechanics matter here and both are easy to get subtly
   * wrong:
   *
   *   - The nonce goes on the REQUEST headers as well as the response. Next
   *     reads the policy off the incoming request and stamps the same nonce
   *     onto its own bootstrap and chunk-loading scripts. Set it only on the
   *     response and every one of those scripts is blocked, which is a white
   *     page rather than a subtle failure.
   *
   *   - It is minted per request and never reused. A nonce that repeats is an
   *     allow-list entry an attacker can read off the last page they were
   *     served, which is the same as having no `script-src` at all.
   *
   * `crypto.randomUUID()` rather than `Math.random()`, and this is edge
   * runtime, where the Web Crypto API is the one that exists.
   */
  const nonce = btoa(crypto.randomUUID());
  /*
   * 🔴 The clinician's room gets ONE extra source expression, and `rest` is
   * the path with any locale prefix already stripped, so `/ar/sessions/x/room`
   * is the same route as `/sessions/x/room` rather than a way round the match.
   */
  const policy = contentSecurityPolicy({ nonce, videoRoom: isVideoRoom(rest) });
  const header = cspHeaderName();
  forwarded.set("x-nonce", nonce);
  forwarded.set(header, policy);

  /**
   * Applied to both responses that RENDER A DOCUMENT, which is why it is a
   * function rather than two copies.
   *
   * The three redirects above this line deliberately do not get one. A
   * redirect has no body for a policy to govern, and the response it sends the
   * browser to passes through here and gets its own. What matters is the
   * property underneath: every HTML document this product serves comes through
   * this function, because the matcher excludes only `api/`, `_next` and image
   * extensions, and none of those is a page.
   */
  /* 🔴 Board 651: a stale org cookie is cleared at its own landing, in the same response. */
  const staleCookie = orgCookieToClear(rest, request.nextUrl.searchParams.get("expired") === "1");
  const withPolicy = <T extends NextResponse>(response: T): T => {
    response.headers.set(header, policy);
    if (staleCookie && request.cookies.get(staleCookie)) response.cookies.delete(staleCookie);
    return response;
  };

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
  /* 🔴 N17 / board 921: the console reads in English whatever the cookie says. */
  if (englishOnly(rest)) forwarded.set(LOCALE_HEADER, "en");

  if (!prefixed) {
    return withPolicy(NextResponse.next({ request: { headers: forwarded } }));
  }

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
  return withPolicy(NextResponse.rewrite(url, { request: { headers: forwarded } }));
}

export const config = {
  matcher: [
    // Everything except static assets, the Stripe webhook and the transcribe
    // endpoint (both authenticate themselves and must not be redirected).
    "/((?!_next/static|_next/image|favicon.ico|api/|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
