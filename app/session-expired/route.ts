import { NextResponse } from "next/server";

import { destroyCurrentSession } from "@/lib/auth/session";
import { env } from "@/lib/env";

export const dynamic = "force-dynamic";

/**
 * The graceful end of an expired session.
 *
 * This exists because of a redirect loop that took the whole portal down for
 * anyone who closed their browser and came back:
 *
 *   1. the cookie lives for the absolute cap (hours) but the *session* idles
 *      out much sooner
 *   2. middleware sees a cookie and sends /login → /dashboard
 *   3. /dashboard calls requireUser(), the session is dead, it redirects to
 *      /login
 *   4. middleware still sees the cookie → /dashboard again, forever
 *
 * Nothing in that cycle could clear the cookie, because a Server Component
 * render is not allowed to write one — only a Server Action or a Route Handler
 * is. So the guard redirects here instead, and here we can actually delete it.
 *
 * The result is a real logout rather than a loop: the row is revoked, the
 * cookie is gone, and the login page can render.
 */
export async function GET(request: Request) {
  await destroyCurrentSession();

  const url = new URL(request.url);
  const next = url.searchParams.get("next");

  const target = new URL("/login", env.appUrl);
  target.searchParams.set("expired", "1");
  // Only ever a path on this origin — an absolute URL here would be an open
  // redirect handed to anyone who can craft a link.
  if (next && next.startsWith("/") && !next.startsWith("//")) {
    target.searchParams.set("next", next);
  }

  return NextResponse.redirect(target);
}
