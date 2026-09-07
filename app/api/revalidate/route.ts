import { revalidateTag } from "next/cache";
import { NextResponse } from "next/server";

import { CACHE_VERSION, CMS_TAG } from "@/lib/content/service";
import { env } from "@/lib/env";
import { log } from "@/lib/logger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * What is deployed. 21R.6.
 *
 * Unauthenticated and deliberately tiny: the cache version, which changes only
 * when this file's neighbours do. It exists so a check can tell "the live site
 * is wrong" apart from "the live site has not been redeployed yet" — the
 * difference between a finding and a false alarm, and the reason C90 exists.
 * It names no commit, no environment and no secret.
 */
export async function GET() {
  return NextResponse.json({ cacheVersion: CACHE_VERSION });
}

/**
 * Refresh the public site's cached content.
 *
 * The admin editor calls `revalidateTag` directly — it runs inside the app and
 * does not need this. `scripts/republish.ts` does: it is a CLI that writes to
 * the database from a laptop, so the running deployment has no idea anything
 * changed and would go on serving cached pages indefinitely, since nothing
 * expires on a timer any more.
 *
 * Since 21R/C92 a cached entry also expires on a five-minute timer, so a
 * script that forgets to call this leaves the site stale for minutes rather
 * than for ever — which is what actually happened: the live pricing page
 * served pre-sprint-17 copy for two days, contradicting §3c, while every
 * verifier reading the database passed. This endpoint is still how a publish
 * becomes visible *immediately*; the timer is the floor under it.
 *
 * Same shared secret as the cron endpoints. It is not destructive, but it is
 * free work an anonymous caller could make the platform do repeatedly, and
 * every uncached render after an invalidation is a database wake.
 */
export async function POST(request: Request) {
  const secret = env.cronSecret;
  if (!secret) {
    return NextResponse.json({ error: "not_configured" }, { status: 503 });
  }

  const provided =
    request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ??
    new URL(request.url).searchParams.get("secret") ??
    "";

  // Length-independent comparison is overkill for a shared secret sent in a
  // header, but the cost is one function call and the habit is worth keeping.
  if (provided.length !== secret.length || provided !== secret) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  revalidateTag(CMS_TAG);
  log.info("cms cache invalidated");

  return NextResponse.json({
    revalidated: CMS_TAG,
    at: new Date().toISOString(),
  });
}
