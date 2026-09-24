import "server-only";

import { NextResponse } from "next/server";

import { callerKey, consume } from "@/lib/rate-limit";

import { authenticateKey, CALLS_PER_MINUTE, type AuthedKey } from "./keys";
import type { ApiScope } from "@/lib/db/schema";

/**
 * One door for every partner route. PLAN.md 55.2, C265.
 *
 * Every handler under `app/api/partner/v1` starts by calling `withKey`, so the four
 * things that must happen before anything else happen in one place and cannot be
 * forgotten by the fifth route somebody adds:
 *
 *   1. A per-IP limit, which protects US. `authenticateKey`'s limit is per key and
 *      protects the KEY's budget, so an attacker with no key at all would otherwise burn
 *      unlimited lookups for free.
 *   2. The key, resolved, verified in constant time, and refused if suspended.
 *   3. The per-key rate limit, which answers 429 with `Retry-After` (W2-X01).
 *   4. The scope this route needs.
 *
 * 🔴 And it returns a `NextResponse` for every failure, so a handler cannot accidentally
 * turn a 403 into a 200 by forgetting to check. The success shape is a key, and the
 * failure shape is a response: they are not confusable.
 */

/**
 * 🔴 66.4 — A KEY ON A PARTNER ROUTE HAS A PARTNER, and the type says so.
 *
 * Sprint 66 made `partner_id` nullable, because a sponsor mints a key from their own
 * portal and it has no partner behind it. Every handler here reads `key.partnerId` as
 * the tenancy it works in, so `withKey` narrows it: a key with no partner is refused
 * before a handler sees it.
 *
 * It is unreachable through a stored key, because a sponsor's key carries only
 * `employment:verify` and no route under `v1` asks for that scope. Checked anyway,
 * and the check is what lets every handler below treat the id as a string rather than
 * each of them writing its own null branch and one of them getting it wrong.
 */
export type PartnerKey = AuthedKey & { partnerId: string };

export type Guarded = { key: PartnerKey } | { response: NextResponse };

export async function withKey(
  request: Request,
  scope: ApiScope,
): Promise<Guarded> {
  /*
   * 🔴 Per caller, before the key is even read.
   *
   * 240 a minute is generous for a real integration and ruinous for somebody testing
   * keys: the point is that an unauthenticated caller cannot make us do database work at
   * machine speed, which no per-key limit can prevent because they have no key.
   */
  const throttle = await consume(await callerKey("partner-api"), 240, 60);
  if (!throttle.allowed) {
    return {
      response: NextResponse.json(
        { error: "Too many requests." },
        { status: 429, headers: { "Retry-After": String(throttle.retryAfter) } },
      ),
    };
  }

  const authed = await authenticateKey(request.headers.get("authorization"), scope);

  if ("failure" in authed) {
    /*
     * 🔴 W2-X01 — A 429 SAYS WHEN TO COME BACK. Without `Retry-After` a client can
     * only guess, and the guess a retry loop makes is "immediately".
     */
    const retry = authed.failure.retryAfter;
    return {
      response: NextResponse.json(
        { error: authed.failure.error },
        {
          status: authed.failure.status,
          headers:
            retry !== undefined
              ? { "Retry-After": String(retry), "RateLimit-Policy": `${CALLS_PER_MINUTE};w=60` }
              : undefined,
        },
      ),
    };
  }

  if (!authed.key.partnerId) {
    /*
     * 🔴 The same message every other refusal gives. Which of the reasons it was is a
     * fact about our customers, and "that key belongs to a sponsor" tells somebody
     * probing that they found a real one.
     */
    return {
      response: NextResponse.json({ error: "That key is not valid." }, { status: 401 }),
    };
  }

  return { key: { ...authed.key, partnerId: authed.key.partnerId } };
}

/** A failure, as the same shape every route returns. */
export function fail(error: string, status: number): NextResponse {
  return NextResponse.json({ error }, { status });
}
