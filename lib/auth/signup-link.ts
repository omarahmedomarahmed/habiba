/*
 * 🔴 30.1: the CONTROL PLANE, like the rest of signing in.
 */
import "server-only";

import { createHash } from "node:crypto";
import { and, eq, gt, isNull } from "drizzle-orm";

import { audit } from "@/lib/audit";
import { controlDb as db } from "@/lib/db";
import { authTokens, users } from "@/lib/db/schema";

import { createSession } from "./session";

/**
 * F14: the link in the welcome email. Single use, a day long, and it signs the
 * new clinician in and carries on to verification, which is where signing up
 * used to land them directly.
 *
 * Deliberately not in `lib/auth/actions.ts`: every export of a "use server"
 * module is a server action a browser can call, and this is reached only by
 * the link (`app/(auth)/signup/confirm/route.ts`).
 *
 * The token is claimed and spent in one conditional UPDATE, so two clicks of
 * the same link cannot both sign somebody in.
 */
export async function consumeSignupLink(token: string): Promise<string | null> {
  if (!token) return null;
  const tokenHash = createHash("sha256").update(token).digest("hex");

  const [row] = await db
    .update(authTokens)
    .set({ usedAt: new Date() })
    .where(
      and(
        eq(authTokens.tokenHash, tokenHash),
        eq(authTokens.purpose, "signup_confirm"),
        isNull(authTokens.usedAt),
        gt(authTokens.expiresAt, new Date()),
      ),
    )
    .returning({ userId: authTokens.userId });

  if (!row) return null;

  const [user] = await db
    .select({ id: users.id, status: users.status })
    .from(users)
    .where(and(eq(users.id, row.userId), isNull(users.deletedAt)))
    .limit(1);
  if (!user || user.status !== "active") return null;

  await createSession(user.id);
  await audit({
    actor: null,
    category: "auth",
    action: "signin",
    resourceType: "user",
    resourceId: user.id,
  });
  return user.id;
}
