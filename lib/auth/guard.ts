import "server-only";

import { redirect } from "next/navigation";
import { cookies, headers } from "next/headers";

import type { Role } from "@/lib/db/schema";
import { admission, getSessionState, SESSION_COOKIE, type Actor } from "./session";
import { env } from "@/lib/env";
import { STAFF_SECOND_STEP } from "@/lib/routing";

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
  const state = await getSessionState();
  const verdict = admission(state);
  if (verdict === "sign_in") await bounceToLogin();
  /*
   * 🔴 TASK 40: the back office's second step, checked HERE and nowhere else.
   *
   * `requireStaff`, `requireManager`, `requireRole` and `requireElevated` all
   * come through this function, as does every clinician screen that widens a
   * query for a `super_admin`, so no admin page, admin action or wider read
   * can skip it by calling a different guard. A password alone gets a back
   * office member exactly one page: the second step.
   */
  if (verdict === "second_step") await toSecondStep();
  return state!.actor;
}

/**
 * A back office session that has given its password and not yet passed the
 * second step, or passed it more than twelve hours ago. Sent to the step,
 * carrying the page it was on so the step can return it there.
 */
async function toSecondStep(): Promise<never> {
  const hdrs = await headers();
  const path = hdrs.get("x-pathname") ?? hdrs.get("x-invoke-path") ?? "";
  const next = path.startsWith("/admin") ? path : "";
  redirect(`${STAFF_SECOND_STEP}${next ? `?next=${encodeURIComponent(next)}` : ""}`);
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

  /*
   * 21R.1 / C94 — somebody bounced off an admin route is sent to the admin
   * door, not the clinician's. Two audiences, two forms (and the staff form
   * refuses a therapist's credentials with a sentence pointing back here), so
   * sending an admin to /login would be sending them somewhere that will turn
   * them away.
   */
  const door = next.startsWith("/admin") ? "/staff/sign-in" : "/login";
  redirect(hasCookie ? `/session-expired${query}` : `${door}${query}`);
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
  if (!allowed.includes(actor.role)) await refuse(actor, allowed);
  return actor;
}

/**
 * 🔴 W2-A01 / A5: "a role is a list, not a rank, and every read is written
 * down", and a refusal is part of that record.
 *
 * This used to be a bare redirect to `/dashboard`, which wrote nothing and,
 * for a back office account, bounced on to `/onboarding`: a staff member who
 * followed a link the nav showed them landed on a clinician's setup screen
 * with no word about why. Now the refusal is an audit row naming the role, the
 * path and the list it was not on, and somebody from the back office is sent
 * to `/admin/not-yours` inside the console, with a way back to their work.
 */
async function refuse(actor: Actor, allowed: Role[]): Promise<never> {
  const hdrs = await headers();
  const path = hdrs.get("x-pathname") ?? hdrs.get("x-invoke-path") ?? "";
  const { audit } = await import("@/lib/audit");
  await audit({
    actor,
    category: "auth",
    action: "access.refused",
    resourceType: "route",
    reason: `${actor.role} at ${path.slice(0, 200) || "an action"}, needs ${allowed.join(" or ")}`,
  });
  const { refusalDestination } = await import("@/lib/admin/access");
  redirect(refusalDestination(actor.role, path));
}

/**
 * A verified clinician, or bounced to onboarding.
 *
 * Call this in the actions that put someone in front of a patient — starting a
 * session, going on the radar, taking money. Browsing the product unverified is
 * fine and even useful; practising through it is not.
 *
 * The redirect in the shell is UX. This is the boundary, and it is a separate
 * function rather than a flag on `requireUser` so that adding a new
 * patient-facing action forces an explicit decision about which one to call.
 */
export async function requireVerified(): Promise<Actor> {
  const actor = await requireUser();

  const { getVerification, isCleared } = await import("@/lib/data/verification");
  const verification = await getVerification(actor.userId);

  if (!isCleared(actor, verification?.state ?? null)) redirect("/onboarding");
  return actor;
}

/** Same checks, but throws instead of redirecting — for route handlers. */
export async function requireUserApi(): Promise<Actor> {
  const state = await getSessionState();
  if (!state) throw new AuthorizationError("Not signed in");
  // 🔴 Task 40: the same second step as `requireUser`, as a 401 rather than a redirect.
  if (state.pendingSecondFactor) throw new AuthorizationError("Second step required");
  return state.actor;
}

export async function requireRoleApi(...allowed: Role[]): Promise<Actor> {
  const actor = await requireUserApi();
  if (!allowed.includes(actor.role)) {
    // W2-A01: on the record like the page refusal above, then a 401 rather than a redirect.
    const { audit } = await import("@/lib/audit");
    await audit({
      actor,
      category: "auth",
      action: "access.refused",
      resourceType: "route",
      reason: `${actor.role} at an API route, needs ${allowed.join(" or ")}`,
    });
    throw new AuthorizationError("Insufficient role");
  }
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

/**
 * The back office. PLAN.md 20.8–20.10, §3d.
 *
 * ## 🔴 Staff see the work, never the patient
 *
 * 20.9: *"No admin impersonation. The rule does not bend for a support
 * ticket."* A staff member helping a patient sees the **ticket**, not the
 * patient's account — and the way that is guaranteed is not a policy, it is
 * that no screen behind this guard queries a clinical table. `requireStaff`
 * marks those screens; the sprint 20 verifier asserts the import graph, the
 * same technique as 10.2, 15.8 and 18R.4.
 */
export async function requireStaff(): Promise<Actor> {
  const { BACK_OFFICE_ROLES } = await import("@/lib/db/schema");
  return requireRole(...BACK_OFFICE_ROLES);
}

/**
 * The performance overview. 20.8.
 *
 * Managers see ticket ages, overdue counts, throughput and who owns what.
 * Staff do not — not because the numbers are secret but because a queue whose
 * workers watch their own throughput all day is a queue that optimises for
 * throughput, and the thing being counted here is people asking for help.
 */
export async function requireManager(): Promise<Actor> {
  const { MANAGER_ROLES } = await import("@/lib/db/schema");
  return requireRole(...MANAGER_ROLES);
}
