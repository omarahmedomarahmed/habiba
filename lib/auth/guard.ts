import "server-only";

import { redirect } from "next/navigation";
import { cookies, headers } from "next/headers";

import type { Role } from "@/lib/db/schema";
import { getActor, SESSION_COOKIE, type Actor } from "./session";
import { env } from "@/lib/env";

export class AuthorizationError extends Error {
  constructor(message = "Not authorized") {
    super(message);
    this.name = "AuthorizationError";
  }
}

/**
 * The authorization boundary. Every page, server action and route handler that
 * touches org data calls this — never middleware.
 *
 * Middleware in Next runs on the edge without database access, so it can check
 * that a cookie *looks* valid but never that the session is still live or the
 * user still active. Treating it as the gate is how you ship a product where
 * forging one cookie value reads other people's charts.
 */
export async function requireUser(): Promise<Actor> {
  const actor = await getActor();
  if (!actor) await bounceToLogin();
  return actor!;
}

/**
 * Send an unauthenticated caller away — via `/session-expired` when they are
 * still carrying a cookie.
 *
 * Redirecting straight to `/login` looks obviously right and is what caused a
 * production outage: middleware bounces anyone holding a cookie from `/login`
 * to `/dashboard`, `/dashboard` bounces them back here, and nothing in that
 * loop is able to delete the cookie, because a Server Component render cannot
 * write one. `/session-expired` is a route handler, so it can — see the
 * comment there.
 *
 * Someone with no cookie at all has no loop to break, so they go straight to
 * the login page and keep the `next` parameter that takes them back afterwards.
 */
async function bounceToLogin(): Promise<never> {
  const store = await cookies();
  const hasCookie = Boolean(store.get(SESSION_COOKIE)?.value);

  const hdrs = await headers();
  const path = hdrs.get("x-pathname") ?? hdrs.get("x-invoke-path") ?? "";
  const next = path.startsWith("/") && !path.startsWith("//") ? path : "";

  const query = next ? `?next=${encodeURIComponent(next)}` : "";
  redirect(hasCookie ? `/session-expired${query}` : `/login${query}`);
}

/**
 * Role checks are an explicit allowlist over a closed union — never a numeric
 * hierarchy. The previous implementation did `ROLE_HIERARCHY[role] || 0`, and
 * because `org_admin` was not a key in that map (while being named on ~28
 * endpoints) the required level fell through to 0 and every authenticated user
 * passed. An unknown role must fail closed, and adding a role to the union
 * without handling it here should be a type error at the call site.
 */
export async function requireRole(...allowed: Role[]): Promise<Actor> {
  const actor = await requireUser();
  if (!allowed.includes(actor.role)) redirect("/dashboard");
  return actor;
}

/** Same checks, but throws instead of redirecting — for route handlers. */
export async function requireUserApi(): Promise<Actor> {
  const actor = await getActor();
  if (!actor) throw new AuthorizationError("Not signed in");
  return actor;
}

export async function requireRoleApi(...allowed: Role[]): Promise<Actor> {
  const actor = await requireUserApi();
  if (!allowed.includes(actor.role)) throw new AuthorizationError("Insufficient role");
  return actor;
}

/**
 * Same-origin check for mutating route handlers.
 *
 * Server Actions get this from Next itself; hand-written POST handlers do not,
 * and `SameSite=Lax` alone does not cover every cross-site POST shape.
 */
export async function assertSameOrigin(): Promise<void> {
  const hdrs = await headers();
  const origin = hdrs.get("origin");
  if (!origin) {
    // A same-origin fetch from our own client always sends Origin. Absent means
    // a non-browser caller; allow it only outside production.
    if (env.isProduction) throw new AuthorizationError("Missing origin");
    return;
  }
  const host = hdrs.get("host");
  let originHost: string;
  try {
    originHost = new URL(origin).host;
  } catch {
    throw new AuthorizationError("Bad origin");
  }
  if (originHost !== host) throw new AuthorizationError("Cross-origin request rejected");
}

export { clientIp, clientUserAgent } from "@/lib/request";
