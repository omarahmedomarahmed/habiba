import "server-only";

import { createHash, randomBytes } from "node:crypto";
import { cookies, headers } from "next/headers";
import { and, eq, isNull, lt, or } from "drizzle-orm";

import { db } from "@/lib/db";
import { authSessions, users } from "@/lib/db/schema";
import type { Role } from "@/lib/db/schema";
import { env } from "@/lib/env";

export const SESSION_COOKIE = "24t_session";

/** Sliding idle window. Touching the app resets it. */
const IDLE_MS = 30 * 60 * 1000;
/** Hard ceiling regardless of activity. */
const ABSOLUTE_MS = 8 * 60 * 60 * 1000;
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
      role: users.role,
      email: users.email,
      firstName: users.firstName,
      lastName: users.lastName,
      verificationStatus: users.verificationStatus,
      status: users.status,
      deletedAt: users.deletedAt,
    })
    .from(authSessions)
    .innerJoin(users, eq(users.id, authSessions.userId))
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
