import "server-only";

import { NextResponse } from "next/server";

import { callerKey, consume } from "@/lib/rate-limit";

import { authenticateKey, type AuthedKey } from "./keys";
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
 *   3. The per-key rate limit, which SUSPENDS on breach rather than refusing (C265).
 *   4. The scope this route needs.
 *
 * 🔴 And it returns a `NextResponse` for every failure, so a handler cannot accidentally
 * turn a 403 into a 200 by forgetting to check. The success shape is a key, and the
 * failure shape is a response: they are not confusable.
 */

export type Guarded = { key: AuthedKey } | { response: NextResponse };

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
      response: NextResponse.json({ error: "Too many requests." }, { status: 429 }),
    };
  }

  const authed = await authenticateKey(request.headers.get("authorization"), scope);

  if ("failure" in authed) {
    return {
      response: NextResponse.json(
        { error: authed.failure.error },
        { status: authed.failure.status },
      ),
    };
  }

  return { key: authed.key };
}

/** A failure, as the same shape every route returns. */
export function fail(error: string, status: number): NextResponse {
  return NextResponse.json({ error }, { status });
}
