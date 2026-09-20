/*
 * 🔴 30.1 — the CONTROL PLANE: rate limiting is per caller and per process, not per jurisdiction.
 */
import "server-only";

import { createHash } from "node:crypto";
import { and, eq, lt, sql } from "drizzle-orm";

import { controlDb as db} from "@/lib/db";
import { rateLimits } from "@/lib/db/schema";
import { SIMULATION_RUNNING } from "@/lib/env";
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
/**
 * 🔴 76.58 — THE SIMULATION SHARES ONE NETWORK, AND THE LIMITER COUNTS NETWORKS.
 *
 * ## What the mini simulation walked into
 *
 * Sign-in is twenty attempts per fifteen minutes, and `callerKey` buckets by
 * the caller's /24. That is the right shape for the public internet, where a
 * large NAT sharing a bucket is a documented and accepted cost.
 *
 * The six month run is **twenty cast agents and eight standing agents behind
 * one egress address**, each signing in as their person at the start of every
 * wave and again whenever `age` moves the clock past a session's idle timeout.
 * Twenty-eight agents against a bucket of twenty is not close: the run would
 * have stalled in wave 1, every agent would have reported "too many attempts"
 * as a product failure, and the finding would have arrived hours in.
 *
 * Four runs of a THREE-flow probe exhausted it, which is how this was found.
 *
 * ## 🔴 Why widening it here is defensible, and what keeps it narrow
 *
 * `SIMULATION_RUNNING=1` is not a debug flag. While it is set, `robots.txt`
 * disallows everything and every page carries a violet strip naming the
 * database, because the product is knowingly not serving the public. Widening
 * a per-network limit during exactly that window is the same decision as the
 * banner, taken for the same reason.
 *
 * What keeps it honest:
 *
 *   - it is a MULTIPLIER on the limit, not a bypass, so a runaway loop still
 *     stops and still says so;
 *   - it never touches `globalCeiling`, which is the platform-wide circuit
 *     breaker and the thing that would notice an actual attack;
 *   - the production default is unchanged, and `SIMULATION_RUNNING` is unset
 *     the day the invented people are deleted;
 *   - it is applied in ONE place, here, so no caller can forget it and none
 *     can widen anything the flag does not cover.
 */
const SIMULATION_LIMIT_MULTIPLIER = 25;

export async function consume(
  key: string,
  limit: number,
  windowSeconds: number,
): Promise<Verdict> {
  /*
   * 🔴 `global:` IS EXEMPT ON PURPOSE. It is the ceiling on what the whole
   * platform will accept per minute, which is the one number that should not
   * move because a simulation is running: if it trips during a run, something
   * is wrong with the run.
   */
  const effectiveLimit =
    SIMULATION_RUNNING && !key.startsWith("global:") ? limit * SIMULATION_LIMIT_MULTIPLIER : limit;
  const windowInterval = sql.raw(`interval '${Math.max(1, Math.floor(windowSeconds))} seconds'`);

  const [row] = await db
    .insert(rateLimits)
    /*
     * 🔴 78.6 — `now()`, NOT `new Date()`, AND THE LIMITER STOPPED LIMITING
     * WITHOUT IT.
     *
     * Every branch below compares `window_start` against Postgres's `now()`.
     * This INSERT wrote it with the Node process's clock, so the two sides of
     * that comparison came from two machines with nothing keeping them in step.
     *
     * The consequence is not a rounding error, it is the limiter switching
     * itself off. A row is born `skew` milliseconds old in Postgres's opinion,
     * so ANY window shorter than the skew is already expired at birth: every
     * request takes the `THEN 1` branch, the count never climbs, and nothing is
     * ever refused. On the branch this was found the database ran 981ms ahead
     * and a row written here measured **1.08 seconds old the instant it landed**,
     * which is how `tests/radar.test.ts` started failing its one-second window
     * every run rather than occasionally.
     *
     * The clock drifted into it. The defect was always here, and a limiter that
     * fails open is the kind that is only noticed by whoever is abusing it.
     */
    .values({
      key,
      count: 1,
      windowStart: sql`now()`,
      expiresAt: sql`now() + ${windowInterval}`,
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
  /*
   * 🔴 The one place the two clocks still meet, and it is a HINT rather than a
   * decision. `windowStart` comes from Postgres and `Date.now()` from here, so
   * a skew makes `elapsed` wrong by that much and `retryAfter` short by the
   * same. Nothing is admitted or refused on this number — the next call is
   * judged by the statement above, entirely in the database — and the floor of
   * one second keeps the advice sane. Left as it is because moving it into SQL
   * would add a round trip to every rejected request to sharpen a courtesy.
   */
  const windowStart = row?.windowStart ?? new Date();
  const elapsed = (Date.now() - windowStart.getTime()) / 1000;

  return {
    allowed: used <= effectiveLimit,
    retryAfter: used <= effectiveLimit ? 0 : Math.max(1, Math.ceil(windowSeconds - elapsed)),
    used,
    /* What was actually enforced, so a caller reporting it is not lying. */
    limit: effectiveLimit,
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
  /*
   * 🔴 78.6 — ONE TABLE, ONE CLOCK.
   *
   * `consume` above judges these rows with Postgres's `now()`. This function
   * wrote them with Node's and then compared its own read against Node's again,
   * which was internally consistent and still wrong: two functions sharing a
   * table were dating it from two machines, so whether a hold had expired
   * depended on which one asked. The skew that switched the limiter off is the
   * same skew, and this half was waiting to be found the same way.
   *
   * Both the liveness test and the write are now the database's, so there is
   * one answer to "has this expired" wherever it is asked from.
   */
  const ttl = sql.raw(`interval '${Math.max(1, Math.floor(ttlSeconds))} seconds'`);

  const [existing] = await db
    .select({ note: rateLimits.note })
    .from(rateLimits)
    .where(and(eq(rateLimits.key, key), sql`${rateLimits.expiresAt} > now()`))
    .limit(1);

  const previous = existing?.note ?? null;

  await db
    .insert(rateLimits)
    .values({
      key,
      count: 1,
      note: payload,
      windowStart: sql`now()`,
      expiresAt: sql`now() + ${ttl}`,
    })
    .onConflictDoUpdate({
      target: rateLimits.key,
      set: {
        note: payload,
        windowStart: sql`now()`,
        expiresAt: sql`now() + ${ttl}`,
      },
    });

  return { previous };
}

export async function releaseHold(key: string): Promise<void> {
  await db.delete(rateLimits).where(eq(rateLimits.key, key));
}

/* -------------------------------------------------------------- helpers -- */

/**
 * Collapse an address to the network it belongs to.
 *
 * Limiting on the exact address is close to useless, which I established the
 * hard way: flooding this app's own endpoint from a sandbox produced no 429s
 * at all, because the sandbox's egress rotates across 160.79.106.128, .129,
 * .135 — three buckets for what is obviously one caller. Any cheap proxy pool
 * does the same, and a single IPv6 allocation hands out /64s containing
 * billions of addresses.
 *
 * So the subject is the /24 for IPv4 and the /64 for IPv6. That is the
 * smallest unit an attacker cannot trivially multiply, and the cost is that a
 * large NAT — an office, a university — shares a bucket. The limits below are
 * set with that in mind.
 */
export function networkOf(ip: string): string {
  if (ip.includes(":")) {
    // IPv6: first four hextets is the /64 that a single customer is handed.
    return ip.split(":").slice(0, 4).join(":") + "::/64";
  }
  const octets = ip.split(".");
  if (octets.length !== 4) return ip;
  return `${octets[0]}.${octets[1]}.${octets[2]}.0/24`;
}

/**
 * The caller's network, or a stable stand-in.
 *
 * When there is no forwarded address at all we fall back to one shared bucket
 * rather than to "unlimited". Behind a proxy that strips headers, everyone
 * shares a limit — annoying, and much better than the limiter quietly doing
 * nothing.
 */
export async function callerKey(scope: string): Promise<string> {
  const ip = await clientIp();
  return subjectKey(scope, ip ? networkOf(ip) : "unknown");
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
