import { NextResponse } from "next/server";

import { redeemLaunch } from "@/lib/partner/launch";
import { callerKey, consume } from "@/lib/rate-limit";
import { env } from "@/lib/env";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * 🔴 42.3 / 55.9 — GET /api/partner/launch?token=…
 *
 * The clinician's own browser navigation, and the ONLY place a launch cookie can be set.
 *
 * ## 🔴 IT IS NOT UNDER `/v1/`, AND THAT IS NOT AN OVERSIGHT
 *
 * Everything under `app/api/partner/v1/` is called by a partner's SERVER with a key. This is
 * called by a clinician's browser with a URL, takes no key, and returns a redirect rather than
 * JSON. Versioning it alongside the data plane would say it is part of a contract a partner
 * codes against; what a partner codes against is `POST /v1/launch`, which hands them this URL
 * to open. They never construct it.
 *
 * ## 🔴 A GET THAT CHANGES STATE, DELIBERATELY, AND IT IS SAFE BECAUSE THE TOKEN IS THE ONLY
 *   THING IT WILL ACT ON
 *
 * A browser navigating to a URL issues a GET, and a redirect chain is the whole mechanism. The
 * usual objection to a state-changing GET is CSRF: an attacker causing somebody's browser to
 * make it. Here that objection does not apply, because the state change is "consume this
 * single-use token and sign in the clinician it names". An attacker who has the token already
 * has everything; one who does not gets a refusal. There is no ambient credential this reads,
 * so there is nothing for a forged request to ride on.
 *
 * 🔴 It IS rate limited per caller, because without that a stolen or guessed URL space could be
 * swept. The tokens are 32 random bytes, so the sweep would not succeed; the limit is there so
 * it is not free to attempt.
 *
 * ## 🔴 `api/` IS EXCLUDED FROM THE MIDDLEWARE MATCHER, which is what makes this reachable
 *
 * A clinician arriving here has no session cookie yet, by definition. Were this a page under
 * `/dashboard` or any other clinician prefix, `routeDecision` would bounce it to `/login`
 * before the handler ran, and the launch would land on a sign-in form. Being under `api/` is
 * load-bearing rather than a filing choice.
 *
 * ## 🔴 A FAILURE GOES TO THE ORDINARY SIGN-IN, NOT TO AN ERROR PAGE
 *
 * The person reading it is a clinician whose launch link expired inside somebody else's
 * product. The useful thing to show them is the door they already know, not a JSON body.
 */
export async function GET(request: Request) {
  const throttle = await consume(await callerKey("partner-launch-redeem"), 20, 60);
  if (!throttle.allowed) {
    return NextResponse.redirect(`${env.appUrl}/login?launch=throttled`, 303);
  }

  const token = new URL(request.url).searchParams.get("token") ?? "";

  const result = await redeemLaunch(token);
  if ("error" in result) {
    /* 🔴 The reason does not travel in the URL. It is one of three states and telling them
       apart would make this a token oracle; the sign-in page says what to do either way. */
    return NextResponse.redirect(`${env.appUrl}/login?launch=expired`, 303);
  }

  /*
   * 🔴 303, so the browser follows with a GET, and an absolute URL built from `env.appUrl`
   * rather than from the request: a `Host` header is a caller's string, and a redirect target
   * assembled from one is an open redirect with extra steps.
   */
  return NextResponse.redirect(`${env.appUrl}${result.redirectTo}`, 303);
}
