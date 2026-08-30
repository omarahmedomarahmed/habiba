import "server-only";

import { createHash } from "node:crypto";
import { cookies } from "next/headers";
import { and, eq, isNull } from "drizzle-orm";

import { audit } from "@/lib/audit";
import { hashPassword, validatePassword, verifyPassword } from "@/lib/auth/password";
import { requireRole } from "@/lib/auth/guard";
import { SESSION_COOKIE, type Actor } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { authSessions, consoleKeys } from "@/lib/db/schema";
import { callerKey, consume } from "@/lib/rate-limit";

/** How long a grant lasts. Re-checked on every read. */
const GRANT_MINUTES = 20;

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

async function currentSessionId(): Promise<string | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const [row] = await db
    .select({ id: authSessions.id })
    .from(authSessions)
    .where(and(eq(authSessions.tokenHash, hashToken(token)), isNull(authSessions.revokedAt)))
    .limit(1);
  return row?.id ?? null;
}

export type KeyState = { a: boolean; b: boolean };

/** Which slots are populated. Never returns hashes. */
export async function keyState(): Promise<KeyState> {
  const rows = await db.select({ slot: consoleKeys.slot }).from(consoleKeys);
  const slots = new Set(rows.map((r) => r.slot));
  return { a: slots.has("a"), b: slots.has("b") };
}

/**
 * Write a slot.
 *
 * Slot `b` is refused once populated: after that it changes only with direct
 * database access. Slot `a` may be rotated.
 */
export async function setKey(
  actor: Actor,
  slot: "a" | "b",
  value: string,
): Promise<{ ok?: boolean; error?: string }> {
  const problem = validatePassword(value);
  if (problem) return { error: problem };

  const state = await keyState();
  if (slot === "b" && state.b) {
    return { error: "That slot is sealed and cannot be changed from here." };
  }

  const hash = await hashPassword(value);
  await db
    .insert(consoleKeys)
    .values({ slot, hash, updatedBy: actor.userId })
    .onConflictDoUpdate({
      target: consoleKeys.slot,
      set: { hash, updatedBy: actor.userId, updatedAt: new Date() },
    });

  await audit({
    actor,
    category: "admin",
    action: "console.key.set",
    resourceType: "console_key",
    reason: `slot ${slot}`,
  });
  return { ok: true };
}

/**
 * Exchange both values for a grant on the current session.
 *
 * Both are compared with `verifyPassword` regardless of whether the first
 * matched, so a wrong first value and a wrong second value take the same time.
 */
export async function unlock(
  actor: Actor,
  a: string,
  b: string,
): Promise<{ ok?: boolean; error?: string }> {
  const attempt = await consume(await callerKey("console-unlock"), 5, 3600);
  if (!attempt.allowed) return { error: "Too many attempts. Try again later." };

  const rows = await db.select().from(consoleKeys);
  const stored = new Map(rows.map((r) => [r.slot, r.hash]));
  if (!stored.has("a") || !stored.has("b")) return { error: "Not configured." };

  const okA = await verifyPassword(a, stored.get("a")!);
  const okB = await verifyPassword(b, stored.get("b")!);

  if (!okA || !okB) {
    await audit({
      actor,
      category: "admin",
      action: "console.unlock.denied",
      resourceType: "console_key",
    });
    return { error: "Rejected." };
  }

  const sessionId = await currentSessionId();
  if (!sessionId) return { error: "Sign in again." };

  await db
    .update(authSessions)
    .set({ elevatedUntil: new Date(Date.now() + GRANT_MINUTES * 60_000) })
    .where(eq(authSessions.id, sessionId));

  await audit({
    actor,
    category: "admin",
    action: "console.unlock",
    resourceType: "console_key",
  });
  return { ok: true };
}

/** Drop the grant. */
export async function relock(): Promise<void> {
  const sessionId = await currentSessionId();
  if (!sessionId) return;
  await db
    .update(authSessions)
    .set({ elevatedUntil: null })
    .where(eq(authSessions.id, sessionId));
}

export type Elevated = { actor: Actor; until: Date };

/** Null when the caller is not elevated, rather than throwing. */
export async function elevated(): Promise<Elevated | null> {
  const actor = await requireRole("super_admin");
  const sessionId = await currentSessionId();
  if (!sessionId) return null;

  const [row] = await db
    .select({ until: authSessions.elevatedUntil })
    .from(authSessions)
    .where(eq(authSessions.id, sessionId))
    .limit(1);

  if (!row?.until || row.until.getTime() <= Date.now()) return null;
  return { actor, until: row.until };
}

/** Throws for a caller without a live grant. */
export async function requireElevated(): Promise<Elevated> {
  const state = await elevated();
  if (!state) throw new Error("not_elevated");
  return state;
}
