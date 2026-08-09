import "server-only";

import { createHash } from "node:crypto";
import { eq, lt, sql } from "drizzle-orm";

import { db } from "@/lib/db";
import { rateLimits } from "@/lib/db/schema";
import { env } from "@/lib/env";
import { log } from "@/lib/logger";
import { clientIp } from "@/lib/request";

/**
 * Rate limiting.
 *
 * A fixed window in one atomic UPSERT. Fixed windows allow a burst across a
 * boundary — up to 2× the limit if the caller times it perfectly — and that is
 * an accepted trade here: the alternative (a sliding log) means storing a row
 * per request, and the limits below are set low enough that 2× is still far
 * inside what the system can absorb.
 *
 * What it is *not*: an in-memory counter. This runs on serverless, so a
 * per-instance map resets whenever a lambda is recycled and gives an attacker a
 * fresh budget with every cold start.
 */

export type Verdict = {
  allowed: boolean;
  /** Seconds until the window rolls over. Zero when allowed. */
  retryAfter: number;
  used: number;
  limit: number;
};

/**
 * Subjects are hashed before they are stored.
 *
 * An IP address is personal data, and this is a table of "who tried to reach a
 * crisis service and when". A salted digest is enough to count against, and
 * cannot be read back into an address if the database is ever exposed.
 */
export function subjectKey(scope: string, subject: string): string {
  const digest = createHash("sha256")
    .update(`${env.authSecret}:${scope}:${subject}`)
    .digest("base64url")
    .slice(0, 32);
  return `${scope}:${digest}`;
}

/**
 * Count one request against a key.
 *
 * The whole decision is a single statement: the window reset and the increment
 * happen inside the same UPDATE, so two concurrent requests cannot both read
 * "count = limit - 1" and both proceed.
 */
export async function consume(
  key: string,
  limit: number,
  windowSeconds: number,
): Promise<Verdict> {
  const windowInterval = sql.raw(`interval '${Math.max(1, Math.floor(windowSeconds))} seconds'`);

  const [row] = await db
    .insert(rateLimits)
    .values({
      key,
      count: 1,
      windowStart: new Date(),
      expiresAt: new Date(Date.now() + windowSeconds * 1000),
    })
    .onConflictDoUpdate({
      target: rateLimits.key,
      set: {
        count: sql`CASE
          WHEN ${rateLimits.windowStart} < now() - ${windowInterval} THEN 1
          ELSE ${rateLimits.count} + 1
        END`,
        windowStart: sql`CASE
          WHEN ${rateLimits.windowStart} < now() - ${windowInterval} THEN now()
          ELSE ${rateLimits.windowStart}
        END`,
        expiresAt: sql`now() + ${windowInterval}`,
      },
    })
    .returning({ count: rateLimits.count, windowStart: rateLimits.windowStart });

  const used = row?.count ?? 1;
  const windowStart = row?.windowStart ?? new Date();
  const elapsed = (Date.now() - windowStart.getTime()) / 1000;

  return {
    allowed: used <= limit,
    retryAfter: used <= limit ? 0 : Math.max(1, Math.ceil(windowSeconds - elapsed)),
    used,
    limit,
  };
}

/** Undo one unit — for a request that was rejected downstream for other reasons. */
export async function refund(key: string): Promise<void> {
  await db
    .update(rateLimits)
    .set({ count: sql`GREATEST(0, ${rateLimits.count} - 1)` })
    .where(eq(rateLimits.key, key));
}

/* --------------------------------------------------------------- holds -- */

/**
 * A hold is a limit of one, with a payload and an explicit release.
 *
 * Used for "this address already has a radar booking in flight". A pure counter
 * cannot express that: setting the limit to 1 per ten minutes would also block
 * the legitimate patient who abandoned a checkout and immediately tried again,
 * which is precisely the person we most want to let through.
 */
export async function takeHold(
  key: string,
  payload: string,
  ttlSeconds: number,
): Promise<{ previous: string | null }> {
  /*
   * Read-then-write, knowingly.
   *
   * The two statements are not atomic, so two requests from the same address
   * arriving together could both read the same previous hold. That is fine
   * here and would not be fine for the booking claim itself: this is a
   * courtesy release of *the same caller's own* earlier attempt, and if it is
   * missed the claim still lapses on its own timer. The thing that actually
   * prevents double-booking is the conditional UPDATE in `claimTherapist`,
   * which is atomic — this is only about not making a patient wait ten minutes
   * to retry their own abandoned checkout.
   */
  const [existing] = await db
    .select({ note: rateLimits.note, expiresAt: rateLimits.expiresAt })
    .from(rateLimits)
    .where(eq(rateLimits.key, key))
    .limit(1);

  const previous =
    existing && existing.expiresAt > new Date() ? (existing.note ?? null) : null;

  await db
    .insert(rateLimits)
    .values({
      key,
      count: 1,
      note: payload,
      windowStart: new Date(),
      expiresAt: new Date(Date.now() + ttlSeconds * 1000),
    })
    .onConflictDoUpdate({
      target: rateLimits.key,
      set: {
        note: payload,
        windowStart: new Date(),
        expiresAt: new Date(Date.now() + ttlSeconds * 1000),
      },
    });

  return { previous };
}

export async function releaseHold(key: string): Promise<void> {
  await db.delete(rateLimits).where(eq(rateLimits.key, key));
}

/* -------------------------------------------------------------- helpers -- */

/**
 * The caller's address, or a stable stand-in.
 *
 * When there is no forwarded address at all we fall back to one shared bucket
 * rather than to "unlimited". Behind a proxy that strips headers, everyone
 * shares a limit — annoying, and much better than the limiter quietly doing
 * nothing.
 */
export async function callerKey(scope: string): Promise<string> {
  const ip = await clientIp();
  return subjectKey(scope, ip ?? "unknown");
}

/** Sweeper for the cron. Rows are self-invalidating; this just stops growth. */
export async function purgeExpiredLimits(): Promise<number> {
  const rows = await db
    .delete(rateLimits)
    .where(lt(rateLimits.expiresAt, new Date()))
    .returning({ key: rateLimits.key });
  return rows.length;
}

/**
 * A platform-wide circuit breaker.
 *
 * Per-address limits do nothing against a botnet. This is a blunt ceiling on
 * how much of a given action the whole platform will accept per minute — if it
 * trips we are either under attack or unexpectedly popular, and both are things
 * an operator needs to be told about rather than discover in a Stripe bill.
 */
export async function globalCeiling(
  scope: string,
  limit: number,
  windowSeconds = 60,
): Promise<Verdict> {
  const verdict = await consume(`global:${scope}`, limit, windowSeconds);
  if (!verdict.allowed) {
    log.warn("global rate ceiling tripped", { scope, used: verdict.used, limit });
  }
  return verdict;
}
