import { revalidateTag } from "next/cache";
import { NextResponse } from "next/server";

import { CMS_TAG } from "@/lib/content/service";
import { env } from "@/lib/env";
import { log } from "@/lib/logger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Refresh the public site's cached content.
 *
 * The admin editor calls `revalidateTag` directly — it runs inside the app and
 * does not need this. `scripts/republish.ts` does: it is a CLI that writes to
 * the database from a laptop, so the running deployment has no idea anything
 * changed and would go on serving cached pages indefinitely, since nothing
 * expires on a timer any more.
 *
 * That is the trade this endpoint pays for. Removing the one-hour revalidation
 * took the database out of the request path, and the cost is that every writer
 * now has to say when it wrote. A script that edits content and forgets to
 * call this leaves the site stale forever rather than for an hour, which is a
 * sharper failure — so it is worth stating plainly rather than discovering.
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

  return NextResponse.json({ revalidated: CMS_TAG, at: new Date().toISOString() });
}
