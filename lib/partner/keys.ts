import "server-only";

import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

import { and, eq, isNull } from "drizzle-orm";

import { controlDb } from "@/lib/db";
import {
  API_SCOPES,
  partnerApiKeys,
  partners,
  sponsors,
  type ApiEnvironment,
  type ApiScope,
} from "@/lib/db/schema";
import { log, ref } from "@/lib/logger";
import { consume, subjectKey } from "@/lib/rate-limit";

/**
 * API keys, and the four things C265 requires of one. PLAN.md 42.1, 55.2, 55.3, C265.
 *
 * ## 🔴 A THERAPIST NEVER SEES ONE (§7, 55.3)
 *
 * *A therapist holding an API key is a therapist who got lost in our product.* That is
 * kept true by WHO rather than by a permission check: a key belongs to a `partners` row
 * and is minted from the partner portal, which sits behind a cookie a clinician does
 * not have and a principal a clinician cannot become. There is no function in this file
 * that takes an `Actor`.
 *
 * ## 🔴 HASHED, AND THE RAW KEY EXISTS FOR ONE RESPONSE
 *
 * SHA-256, not scrypt, and the difference is deliberate. A password is a low-entropy
 * secret a human chose and needs a slow hash to survive a stolen table; an API key is
 * 32 random bytes, so a fast hash is already unguessable and a slow one would put a
 * key-stretching function on the hot path of every request a partner makes.
 *
 * ## 🔴 VERIFIED IN CONSTANT TIME, and the reason is subtler than it looks
 *
 * The lookup is by hash, so the database index does the finding and a timing difference
 * there leaks only whether a hash exists. The `timingSafeEqual` is on the second
 * comparison, which exists because a unique index on a hash makes "found" and "correct"
 * the same question and leaving it implicit is how somebody later replaces the lookup
 * with a scan.
 *
 * ## 🔴 AND AN ABNORMAL RATE SUSPENDS THE KEY (C265)
 *
 * *An abnormal rate suspends the key rather than alerting somebody to read a chart
 * later.* So the limiter does not merely refuse the call: it writes `suspended_at` and a
 * reason, and every subsequent call fails on the WHERE clause until a human clears it.
 * A rate limit that only slows an attacker down is a rate limit that lets them keep
 * going at the permitted speed, and against an identity oracle that is still an oracle.
 */

/** A prefix a developer can recognise, and an environment they cannot confuse. */
const PREFIX = { sandbox: "24t_sk_test_", live: "24t_sk_live_" } as const;

/** C265's hard limit. Per key, per minute, and crossing it suspends. */
const CALLS_PER_MINUTE = 60;

function hashKey(raw: string): string {
  return createHash("sha256").update(raw).digest("hex");
}

export type MintedKey = {
  /** 🔴 Returned once. Never stored, never retrievable, never logged. */
  raw: string;
  prefix: string;
  id: string;
};

/**
 * 🔴 Mint a key. The scopes are validated and the sponsor scope is enforced twice.
 *
 * Once here, so the message is a sentence, and once in the database, so the rule holds
 * however the row was written. `partner_api_keys_employment_needs_sponsor` is the
 * constraint: a key that can ask "does this person work here" without naming the one
 * organisation it may ask about is exactly the oracle C265 forbids.
 */
export async function mintKey(input: {
  partnerId: string;
  label: string;
  scopes: string[];
  environment: ApiEnvironment;
  sponsorId: string | null;
}): Promise<{ key?: MintedKey; error?: string }> {
  const scopes = input.scopes.filter((scope): scope is ApiScope =>
    (API_SCOPES as readonly string[]).includes(scope),
  );

  if (scopes.length === 0) return { error: "Choose at least one scope." };
  if (scopes.length !== input.scopes.length) return { error: "That is not a scope we have." };

  /*
   * 🔴 THE EMPLOYMENT CHECK MOVED WITH ITS SCOPE, 2026-09-14.
   *
   * It used to refuse an `employment:verify` key with no sponsor, which was
   * C265 in a guard: an identity oracle is safe only while it can answer about
   * exactly one organisation. That scope is no longer a partner scope. The rule
   * did not go away, it went to the sponsor's own integrations page, where the
   * organisation is not a field on a form at all: it is the portal the person
   * is signed into.
   *
   * `partner_api_keys.sponsor_id` and its CHECK stay on the table, because the
   * sponsor's key is still a key and inherits both.
   */

  const raw = `${PREFIX[input.environment]}${randomBytes(24).toString("base64url")}`;

  const [created] = await controlDb
    .insert(partnerApiKeys)
    .values({
      partnerId: input.partnerId,
      label: input.label.trim().slice(0, 80) || "Key",
      keyHash: hashKey(raw),
      /* Enough to tell two keys apart in a list, and useless on its own. */
      prefix: raw.slice(0, PREFIX[input.environment].length + 6),
      scopes,
      environment: input.environment,
      sponsorId: input.sponsorId,
    })
    .returning({ id: partnerApiKeys.id, prefix: partnerApiKeys.prefix });

  if (!created) return { error: "That key could not be created." };

  log.info("api key minted", { partner: ref(input.partnerId), environment: input.environment });
  return { key: { raw, prefix: created.prefix, id: created.id } };
}

export type AuthedKey = {
  keyId: string;
  partnerId: string;
  partnerName: string;
  scopes: ApiScope[];
  environment: ApiEnvironment;
  /** 🔴 C265 — the one sponsor this key may ask about, or none. */
  sponsorId: string | null;
};

export type KeyFailure = { status: 401 | 403 | 429; error: string };

/**
 * 🔴 Authenticate a call, rate-limit it, and suspend the key if the rate is abnormal.
 *
 * Returns a discriminated result rather than throwing, because every caller is a route
 * handler that has to turn this into a status code and a body, and an exception would
 * make the status a guess at the catch site.
 *
 * ## 🔴 The order matters and is not the obvious one
 *
 * The key is resolved BEFORE the rate limit, because the limit is per key and there is
 * no key to limit until one is found. That means an attacker with no key can burn
 * lookups, so the caller also rate-limits per IP: this function's job is to protect the
 * KEY's budget, and `callerKey` protects ours.
 */
export async function authenticateKey(
  header: string | null,
  required: ApiScope,
): Promise<{ key: AuthedKey } | { failure: KeyFailure }> {
  const raw = (header ?? "").replace(/^Bearer\s+/i, "").trim();
  if (!raw) return { failure: { status: 401, error: "No API key." } };

  const hash = hashKey(raw);

  const [row] = await controlDb
    .select({
      keyId: partnerApiKeys.id,
      keyHash: partnerApiKeys.keyHash,
      partnerId: partners.id,
      partnerName: partners.name,
      scopes: partnerApiKeys.scopes,
      environment: partnerApiKeys.environment,
      sponsorId: partnerApiKeys.sponsorId,
    })
    .from(partnerApiKeys)
    .innerJoin(partners, eq(partners.id, partnerApiKeys.partnerId))
    .where(
      and(
        eq(partnerApiKeys.keyHash, hash),
        isNull(partnerApiKeys.revokedAt),
        /* 🔴 C265 — a suspended key is dead in the WHERE clause, not in a branch. */
        isNull(partnerApiKeys.suspendedAt),
        eq(partners.state, "active"),
      ),
    )
    .limit(1);

  if (!row) {
    /*
     * 🔴 One message for unknown, revoked, suspended and a held partner.
     *
     * Which of the four it was is a fact about our customers, and a distinct
     * "suspended" tells somebody probing that they found a real key.
     */
    return { failure: { status: 401, error: "That key is not valid." } };
  }

  /*
   * A second, explicit comparison. The index already found the row by hash, so this can
   * only fail if somebody later replaces the lookup with something looser: it is here so
   * that the day they do, the comparison is already constant-time and already required.
   */
  const a = Buffer.from(row.keyHash, "hex");
  const b = Buffer.from(hash, "hex");
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    return { failure: { status: 401, error: "That key is not valid." } };
  }

  /*
   * 🔴 C265 — THE RATE LIMIT SUSPENDS RATHER THAN REFUSING.
   *
   * Crossing the limit writes `suspended_at` and a reason, so the key is dead until a
   * human clears it. A limiter that only refuses the surplus call lets an attacker
   * continue at the permitted speed for ever, and against an identity oracle that is
   * still an oracle: sixty guesses a minute is thirty-one million a year.
   */
  const throttle = await consume(subjectKey("api-key", row.keyId), CALLS_PER_MINUTE, 60);
  if (!throttle.allowed) {
    await controlDb
      .update(partnerApiKeys)
      .set({
        suspendedAt: new Date(),
        suspendedReason: `More than ${CALLS_PER_MINUTE} calls in a minute. Ask us to re-enable it.`,
      })
      .where(eq(partnerApiKeys.id, row.keyId));

    log.warn("api key suspended for an abnormal rate", { partner: ref(row.partnerId) });
    return {
      failure: {
        status: 429,
        error: "This key has been suspended for an abnormal call rate. Talk to us.",
      },
    };
  }

  const scopes = row.scopes;
  if (!scopes.includes(required)) {
    return { failure: { status: 403, error: `This key does not hold ${required}.` } };
  }

  /* Best effort, and deliberately not awaited into the response's critical path. */
  void controlDb
    .update(partnerApiKeys)
    .set({ lastUsedAt: new Date() })
    .where(eq(partnerApiKeys.id, row.keyId));

  return {
    key: {
      keyId: row.keyId,
      partnerId: row.partnerId,
      partnerName: row.partnerName,
      scopes,
      environment: row.environment,
      sponsorId: row.sponsorId,
    },
  };
}

/**
 * The developer's own list. Prefixes and scopes, never a key.
 *
 * 🔴 The sponsor is joined for its NAME AND NOTHING ELSE, so the row a developer reads can
 * say which organisation the key may ask about (C265). `sponsors` carries a pot balance, a
 * state and an enrolment code; none of those is on this select list, and a partner's screen
 * must not be the place a sponsor's commercial state leaks.
 *
 * A LEFT join, because every key without `employment:verify` has no sponsor and an inner
 * join would silently drop four of the five use cases from this list.
 */
export async function keysFor(partnerId: string) {
  return controlDb
    .select({
      id: partnerApiKeys.id,
      label: partnerApiKeys.label,
      prefix: partnerApiKeys.prefix,
      scopes: partnerApiKeys.scopes,
      environment: partnerApiKeys.environment,
      sponsorId: partnerApiKeys.sponsorId,
      sponsorName: sponsors.name,
      lastUsedAt: partnerApiKeys.lastUsedAt,
      suspendedAt: partnerApiKeys.suspendedAt,
      suspendedReason: partnerApiKeys.suspendedReason,
      revokedAt: partnerApiKeys.revokedAt,
      createdAt: partnerApiKeys.createdAt,
    })
    .from(partnerApiKeys)
    .leftJoin(sponsors, eq(sponsors.id, partnerApiKeys.sponsorId))
    .where(eq(partnerApiKeys.partnerId, partnerId))
    .orderBy(partnerApiKeys.createdAt);
}

/** 🔴 Rotatable, which in practice means revoke and mint. There is no edit. */
export async function revokeKey(partnerId: string, keyId: string): Promise<{ ok: true }> {
  await controlDb
    .update(partnerApiKeys)
    .set({ revokedAt: new Date() })
    .where(
      and(
        eq(partnerApiKeys.id, keyId),
        /* Scoped in the WHERE. A borrowed key id revokes nothing. */
        eq(partnerApiKeys.partnerId, partnerId),
        isNull(partnerApiKeys.revokedAt),
      ),
    );

  return { ok: true };
}
