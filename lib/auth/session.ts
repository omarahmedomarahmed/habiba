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

export const SESSION_COOKIE = "24t_session";

/**
 * Sliding idle window. Touching the app resets it.
 *
 * Two hours, not thirty minutes. Automatic logoff is a HIPAA safeguard against
 * an unattended workstation, and two hours still satisfies that on a device a
 * clinician is sitting at — but thirty minutes logged people out *during a
 * session*, between starting the recording and writing up the note, which is
 * the one moment the product must not interrupt. A safeguard that makes people
 * reach for "remember my password" has made things worse, not better.
 */
const IDLE_MS = 2 * 60 * 60 * 1000;
/** Hard ceiling regardless of activity. */
const ABSOLUTE_MS = 12 * 60 * 60 * 1000;
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

  return token;
}

/**
 * Resolve the current actor, or null.
 *
 * Note this reads the database. That is intentional: it means a suspended user
 * or a revoked session stops working on the very next request. The old JWT
 * design also hit the database on every request (to load the identity) but
 * could not revoke, so it paid the cost without getting the benefit.
 */
export async function getActor(): Promise<Actor | null> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const tokenHash = hashToken(token);
  const now = new Date();

  const rows = await db
    .select({
      sessionId: authSessions.id,
      lastSeenAt: authSessions.lastSeenAt,
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

  return {
    userId: row.userId,
    organizationId: row.organizationId,
    role: row.role,
    email: row.email,
    firstName: row.firstName,
    lastName: row.lastName,
    verificationStatus: row.verificationStatus,
    region: isRegion(row.region) ? row.region : DEFAULT_REGION,
    timezone: row.timezone,
  };
}

async function revokeSessionById(id: string) {
  await db
    .update(authSessions)
    .set({ revokedAt: new Date() })
    .where(eq(authSessions.id, id));
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
