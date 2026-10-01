import "server-only";

import { createHash, randomBytes } from "node:crypto";
import { cookies, headers } from "next/headers";
import { and, eq, isNull, lt, or } from "drizzle-orm";

/*
 * 🔴 30.1 — the CONTROL PLANE, and this one is worth stating.
 *
 * `auth_sessions` and `users` are platform infrastructure: a person signs in
 * once, and the cookie has to resolve before anything knows which jurisdiction
 * they belong to. Putting the session table behind the region seam would be
 * circular. What this read DOES is resolve the region, once, onto the actor,
 * so that every clinical call downstream has it without asking.
 */
import { controlDb as db } from "@/lib/db";
import { authSessions, organizations, users } from "@/lib/db/schema";
import { isRegion, DEFAULT_REGION, type Region } from "@/lib/db/region";
import type { Role } from "@/lib/db/schema";
import { env } from "@/lib/env";
import { needsSecondFactor, secondFactorCurrent } from "./totp";

export const SESSION_COOKIE = "24t_session";

/**
 * Sliding idle window. Touching the app resets it.
 *
 * 🔴 Thirty minutes, which is what /hipaa says, and it no longer interrupts a
 * session. It was two hours because thirty logged people out *during a
 * session*, between starting the recording and writing up the note. That
 * reason is gone: the room polls `/api/sessions/[id]/state` every five seconds
 * for as long as it is open, and uploads audio every eight while it records,
 * both through `requireUserApi`, which touches `last_seen_at`. A clinician in
 * a session is never idle in this sense. Thirty minutes now only ends a sign
 * in on a screen nobody is touching, the unattended workstation the safeguard
 * is for.
 */
const IDLE_MS = 30 * 60 * 1000;
/** Hard ceiling regardless of activity: eight hours from sign in. */
const ABSOLUTE_MS = 8 * 60 * 60 * 1000;
/**
 * 🔴 THE ONE EXCEPTION TO THE CEILING: A SESSION ALREADY STARTED FINISHES.
 *
 * A clinician who signed in at nine and starts a session at half past four
 * would otherwise be signed out at five, mid sentence, by a clock that knows
 * nothing about the patient in the room. Starting a session pushes the ceiling
 * to two hours after the start (a session is fifty minutes, and the note is
 * read after it), and never past two hours beyond the original eight, so
 * starting session after session cannot keep one sign in alive for ever.
 */
const LIVE_SESSION_GRACE_MS = 2 * 60 * 60 * 1000;
/** Don't write to the database on every single request just to bump lastSeen. */
const TOUCH_THROTTLE_MS = 60 * 1000;

export type Actor = {
  userId: string;
  organizationId: string;
  role: Role;
  email: string;
  firstName: string;
  lastName: string;
  verificationStatus: "unverified" | "pending" | "verified" | "rejected";
  /**
   * 🔴 The practice's jurisdiction. PLAN.md 30.1, C118.
   *
   * Required and carried, for the same reason the timezone is (C84) and the
   * locale now is (C150): a value the runtime supplies is correct on the
   * machine it was written on and wrong for the person it is about. Resolved
   * once, here, from the organisation, so no data module has to ask.
   *
   * ⚠️ It is the PRACTICE's region, and a clinician's caseload can span more
   * than one, because a patient's region is their own (C154). Use it for rows
   * that belong to the practice: sessions, settings, payouts. For a chart, ask
   * the directory about the patient.
   */
  region: Region;
  /**
   * IANA, or null. 12.3 / C70.
   *
   * Carried on the actor so that every server-rendered screen can name the
   * zone it is printing a timestamp in without a second query. Set in Settings
   * (11R.2); null until the clinician has chosen one, which the formatters
   * report as UTC rather than quietly using the server's clock.
   */
  timezone: string | null;
  /**
   * 🔴 F6: set only on a session a PARTNER opened (`created_via =
   * 'partner_launch'`). Such a session is restricted: fifteen minutes, read
   * only, and only the landing page and the charts of that partner's own
   * patients (`lib/partner/launch-scope.ts`, enforced in `requireUser`).
   * `getActor` returns null for it, so any surface that does not go through
   * the guard treats it as signed out.
   */
  partnerScope?: { partnerId: string };
};

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export async function createSession(userId: string): Promise<string> {
  const token = randomBytes(32).toString("base64url");
  const hdrs = await headers();

  await db.insert(authSessions).values({
    userId,
    tokenHash: hashToken(token),
    absoluteExpiresAt: new Date(Date.now() + ABSOLUTE_MS),
    userAgent: hdrs.get("user-agent")?.slice(0, 300) ?? null,
  });

  const store = await cookies();
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: env.isProduction,
    sameSite: "lax",
    path: "/",
    // Cookie lifetime matches the absolute cap; the idle window is enforced
    // server-side, because a cookie max-age is a client-side suggestion.
    maxAge: Math.floor(ABSOLUTE_MS / 1000),
  });

  /* 🔴 0169 / ruling 8: a new device reads in the language they chose. Never blocks signing in. */
  try {
    const { applySavedLocale } = await import("@/lib/i18n/preference");
    await applySavedLocale({ userId });
  } catch {
    /* The language is a preference; the sign-in is not. */
  }

  return token;
}

/**
 * Resolve the current actor, or null.
 *
 * Note this reads the database. That is intentional: it means a suspended user
 * or a revoked session stops working on the very next request. The old JWT
 * design also hit the database on every request (to load the identity) but
 * could not revoke, so it paid the cost without getting the benefit.
 *
 * 🔴 Null, too, for a back office session still owing its second step. See
 * `SessionState`.
 */
export async function getActor(): Promise<Actor | null> {
  const state = await getSessionState();
  /* 🔴 F6: a partner-opened session only exists through `requireUser`'s scope check. */
  if (state?.actor.partnerScope) return null;
  return state && !state.pendingSecondFactor ? state.actor : null;
}

/**
 * 🔴 TASK 40: a session, with what the second step needs to know about it.
 *
 * `pendingSecondFactor` is true for a back office session that has given its
 * password and not yet passed the second step (or passed it more than twelve
 * hours ago). Such a session is NOT signed in for anything but the second
 * step itself: `getActor` returns null for it, and `requireUser` sends it to
 * `/staff/second-step`. That is why the check lives here rather than in the
 * admin guards. `requireStaff`, `requireRole` and `requireElevated` all pass
 * through it, and so do the routes that read documents and uploads with
 * `getActor()` and the clinician screens that widen a query for a
 * `super_admin`, none of which call an admin guard at all.
 */
export type SessionState = {
  actor: Actor;
  sessionId: string;
  secondFactorAt: Date | null;
  pendingSecondFactor: boolean;
};

export type Admission = "admit" | "sign_in" | "second_step" | "refuse";

/**
 * The decision `requireUser` makes (and `requireRole`, with its list), with
 * no request in hand. Here rather than in `guard.ts` because that file pulls
 * in `next/navigation`, which a script cannot load, and the point is that
 * `scripts/verify-staff-2fa.ts` puts a real session from the dev database
 * through THIS function rather than through a copy of it.
 */
export function admission(state: SessionState | null, allowed?: readonly Role[]): Admission {
  if (!state) return "sign_in";
  if (state.pendingSecondFactor) return "second_step";
  if (allowed && !allowed.includes(state.actor.role)) return "refuse";
  return "admit";
}

/**
 * The session behind the cookie, pending or not. Only the guard and the
 * second step's own page and actions may read a pending one; everything else
 * asks `getActor`.
 */
export async function getSessionState(): Promise<SessionState | null> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  return sessionStateForToken(token);
}

/**
 * The same resolution from a raw token, with no request in hand. Split out so
 * `scripts/verify-staff-2fa.ts` proves the rule on the dev database through
 * the very function every request runs, rather than through a copy of it.
 */
export async function sessionStateForToken(token: string): Promise<SessionState | null> {
  const tokenHash = hashToken(token);
  const now = new Date();

  const rows = await db
    .select({
      sessionId: authSessions.id,
      lastSeenAt: authSessions.lastSeenAt,
      secondFactorAt: authSessions.secondFactorAt,
      launchedBy: authSessions.partnerId,
      createdVia: authSessions.createdVia,
      userId: users.id,
      organizationId: users.organizationId,
      region: organizations.region,
      role: users.role,
      email: users.email,
      firstName: users.firstName,
      lastName: users.lastName,
      verificationStatus: users.verificationStatus,
      timezone: users.timezone,
      status: users.status,
      deletedAt: users.deletedAt,
    })
    .from(authSessions)
    .innerJoin(users, eq(users.id, authSessions.userId))
    /* 30.1 — the region comes with the session, so nothing downstream asks. */
    .innerJoin(organizations, eq(organizations.id, users.organizationId))
    .where(
      and(
        eq(authSessions.tokenHash, tokenHash),
        isNull(authSessions.revokedAt),
      ),
    )
    .limit(1);

  const row = rows[0];
  if (!row) return null;

  const idleDeadline = new Date(row.lastSeenAt.getTime() + IDLE_MS);
  if (idleDeadline < now) {
    await revokeSessionById(row.sessionId);
    return null;
  }

  // Absolute cap is checked in the same read to avoid a second round trip.
  const absolute = await db
    .select({ absoluteExpiresAt: authSessions.absoluteExpiresAt })
    .from(authSessions)
    .where(eq(authSessions.id, row.sessionId))
    .limit(1);
  if (!absolute[0] || absolute[0].absoluteExpiresAt < now) {
    await revokeSessionById(row.sessionId);
    return null;
  }

  if (row.status !== "active" || row.deletedAt) return null;

  if (now.getTime() - row.lastSeenAt.getTime() > TOUCH_THROTTLE_MS) {
    await db
      .update(authSessions)
      .set({ lastSeenAt: now })
      .where(eq(authSessions.id, row.sessionId));
  }

  const actor: Actor = {
    userId: row.userId,
    organizationId: row.organizationId,
    role: row.role,
    email: row.email,
    firstName: row.firstName,
    lastName: row.lastName,
    verificationStatus: row.verificationStatus,
    region: isRegion(row.region) ? row.region : DEFAULT_REGION,
    timezone: row.timezone,
    ...(row.createdVia === "partner_launch" && row.launchedBy
      ? { partnerScope: { partnerId: row.launchedBy } }
      : {}),
  };

  return {
    actor,
    sessionId: row.sessionId,
    secondFactorAt: row.secondFactorAt,
    pendingSecondFactor: needsSecondFactor(row.role) && !secondFactorCurrent(row.secondFactorAt, now),
  };
}

async function revokeSessionById(id: string) {
  await db
    .update(authSessions)
    .set({ revokedAt: new Date() })
    .where(eq(authSessions.id, id));
}

/**
 * Called when a clinician starts a session (`goLive`): the absolute ceiling of
 * the sign in they are using moves to at least two hours from now, capped at
 * two hours past the original eight. See `LIVE_SESSION_GRACE_MS`. The cookie's
 * own lifetime moves with it, because a browser drops a cookie at its max-age
 * whatever the server would still have accepted.
 *
 * Never throws: failing to extend leaves a sign in on its usual clock, and that
 * must not stop a session from starting.
 */
export async function keepSignedInThroughSession(): Promise<void> {
  try {
    const store = await cookies();
    const token = store.get(SESSION_COOKIE)?.value;
    if (!token) return;
    const [row] = await db
      .select({
        id: authSessions.id,
        createdAt: authSessions.createdAt,
        absoluteExpiresAt: authSessions.absoluteExpiresAt,
      })
      .from(authSessions)
      .where(and(eq(authSessions.tokenHash, hashToken(token)), isNull(authSessions.revokedAt)))
      .limit(1);
    if (!row) return;
    const now = Date.now();
    const wanted = Math.min(
      now + LIVE_SESSION_GRACE_MS,
      row.createdAt.getTime() + ABSOLUTE_MS + LIVE_SESSION_GRACE_MS,
    );
    if (wanted <= row.absoluteExpiresAt.getTime()) return;
    await db
      .update(authSessions)
      .set({ absoluteExpiresAt: new Date(wanted) })
      .where(eq(authSessions.id, row.id));
    store.set(SESSION_COOKIE, token, {
      httpOnly: true,
      secure: env.isProduction,
      sameSite: "lax",
      path: "/",
      maxAge: Math.max(1, Math.floor((wanted - now) / 1000)),
    });
  } catch {
    /* The ordinary ceiling still applies; the session itself starts regardless. */
  }
}

export async function destroyCurrentSession(): Promise<void> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (token) {
    await db
      .update(authSessions)
      .set({ revokedAt: new Date() })
      .where(eq(authSessions.tokenHash, hashToken(token)));
  }
  store.delete(SESSION_COOKIE);
}

/**
 * Used on password reset and password change. The old implementation reset the
 * password but left every existing refresh token alive, so an attacker's
 * session survived the victim locking them out.
 */
export async function revokeAllSessionsForUser(userId: string): Promise<void> {
  await db
    .update(authSessions)
    .set({ revokedAt: new Date() })
    .where(and(eq(authSessions.userId, userId), isNull(authSessions.revokedAt)));
}

export async function purgeExpiredSessions(): Promise<number> {
  const now = new Date();
  const result = await db
    .delete(authSessions)
    .where(
      or(
        lt(authSessions.absoluteExpiresAt, now),
        lt(authSessions.lastSeenAt, new Date(now.getTime() - IDLE_MS)),
      ),
    )
    .returning({ id: authSessions.id });
  return result.length;
}
