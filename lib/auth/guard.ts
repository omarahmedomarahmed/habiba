import "server-only";

import { redirect } from "next/navigation";
import { headers } from "next/headers";

import type { Role } from "@/lib/db/schema";
import { getActor, type Actor } from "./session";
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
  if (!actor) redirect("/login");
  return actor;
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
