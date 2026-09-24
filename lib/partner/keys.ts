import "server-only";

import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

import { and, eq, gt, isNull, or, sql } from "drizzle-orm";

import { controlDb } from "@/lib/db";
import {
  API_SCOPES,
  partnerApiKeys,
  partners,
  sponsors,
  type ApiEnvironment,
  type ApiScope,
  type SponsorScope,
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
 * ## 🔴 AN ABNORMAL RATE SUSPENDS A SPONSOR'S KEY (C265), AND THROTTLES A PARTNER'S
 *
 * *An abnormal rate suspends the key rather than alerting somebody to read a chart
 * later.* That is C265's defence for the one identity oracle this table holds, the
 * sponsor's `employment:verify` key: the limiter writes `suspended_at` and a reason, and
 * every subsequent call fails on the WHERE clause until a human clears it. A rate limit
 * that only slows an attacker down lets them keep going at the permitted speed, and
 * against an oracle that is still an oracle.
 *
 * 🔴 W2-X01: a PARTNER's key is not an oracle, and suspending it for a burst stopped
 * transcription in rooms that were open, until an operator noticed. So it gets a 429
 * with `Retry-After` and works again once the caller slows down (RESEARCH-2 section 7:
 * throttle, never suspend; only a human suspends a partner).
 */

/** A prefix a developer can recognise, and an environment they cannot confuse. */
const PREFIX = { sandbox: "24t_sk_test_", live: "24t_sk_live_" } as const;

/** Per key, per minute. Crossing it suspends a sponsor's key (C265), throttles a partner's. */
export const CALLS_PER_MINUTE = 60;

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
  /** W2-X04: who pressed the button, for the audit row. */
  byPartnerUserId?: string | null;
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

  /*
   * 🔴 68.20 / 68.21 / C264 — A SANDBOX KEY IS SELF-SERVE. A LIVE ONE NEEDS A PERSON.
   *
   * *Sign up, get a dev key, integrate the same hour.* That is the whole of 68.20 and
   * it is why nothing above this line asks anybody's permission: a key behind a sales
   * call is a product nobody evaluates.
   *
   * A LIVE key is the other thing entirely. It reaches real people's sessions, so
   * C264's ruling applies unchanged: activating a partner is the owner's act, by a
   * named human, after reading documents and speaking to somebody. `approved_at` is
   * paired with `approved_by_user_id` by a database constraint, so an approval with
   * nobody behind it cannot be written at all.
   *
   * 🔴 CHECKED HERE RATHER THAN ON THE SCREEN, because a screen that hides the live
   * option is a screen somebody reaches with a form post.
   */
  if (input.environment === "live") {
    const [partner] = await controlDb
      .select({ approvedAt: partners.approvedAt })
      .from(partners)
      .where(eq(partners.id, input.partnerId))
      .limit(1);

    if (!partner?.approvedAt) {
      return {
        error:
          "This account is not approved for production yet. Send us your documents and a named contact, and we will speak to somebody before any key of yours reaches a real person's session.",
      };
    }
  }

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
  await auditKey("partner.key.mint", created.id, input.partnerId, input.byPartnerUserId, input.environment);
  return { key: { raw, prefix: created.prefix, id: created.id } };
}

/**
 * 🔴 W2-X04: EVERY MINT, ROLL AND REVOKE LEAVES A ROW. `devs.promise4` says every
 * call is recorded with the key that made it; the key's own life was not.
 *
 * A partner user is not an `Actor` and has no column of their own in `audit_log`,
 * so the row names the key as its resource and the partner and person in the
 * reason (H6: descriptive text goes in `reason`, never in the uuid column).
 */
async function auditKey(
  action: string,
  keyId: string,
  partnerId: string,
  byPartnerUserId: string | null | undefined,
  detail: string,
): Promise<void> {
  const { audit } = await import("@/lib/audit");
  await audit({
    actor: null,
    category: "admin",
    action,
    resourceType: "partner_api_key",
    resourceId: keyId,
    reason: `partner ${partnerId}, ${detail}${byPartnerUserId ? `, by partner user ${byPartnerUserId}` : ""}`,
  });
}

/**
 * 🔴 66.7 — WHEN THIS KEY LAST GOT A REAL ANSWER.
 *
 * *Connected means a call succeeded, not a green dot that means "we saved your
 * settings".*
 *
 * Called past every refusal, on the line that returns an answer. `lastUsedAt` is
 * written by the limiter on every authenticated call including the ones that then
 * fail on a scope or an attestation, so an indicator built on it goes green for a key
 * that has never successfully answered anything.
 */
export async function stampSuccess(keyId: string): Promise<void> {
  await controlDb
    .update(partnerApiKeys)
    .set({ lastSuccessAt: new Date() })
    .where(eq(partnerApiKeys.id, keyId));
}

export type AuthedKey = {
  keyId: string;
  /**
   * 🔴 66.4 — NULL FOR A SPONSOR'S OWN KEY, which has no partner behind it.
   *
   * `partnerName` then names the SPONSOR, because every log line and every error
   * wants "whose key is this" and a null there would read as an anonymous caller.
   */
  partnerId: string | null;
  partnerName: string;
  scopes: (ApiScope | SponsorScope)[];
  environment: ApiEnvironment;
  /** 🔴 C265 — the one sponsor this key may ask about, or none. */
  sponsorId: string | null;
};

export type KeyFailure = {
  status: 401 | 403 | 429;
  error: string;
  /** W2-X01: on a throttle, seconds until the window rolls over, for `Retry-After`. */
  retryAfter?: number;
};

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
  /*
   * 🔴 66.3 — `ApiScope | SponsorScope`, because one key table authenticates both.
   *
   * A sponsor's key carries `employment:verify` and no partner scope; a partner's
   * carries the reverse. The scope check below is the same comparison either way,
   * which is the point of there being one implementation of C265's four defences.
   */
  required: ApiScope | SponsorScope,
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
      sponsorOwnerId: sponsors.id,
      sponsorOwnerName: sponsors.name,
      scopes: partnerApiKeys.scopes,
      environment: partnerApiKeys.environment,
      sponsorId: partnerApiKeys.sponsorId,
      /* The raw column, to tell a sponsor's key from a held partner's. */
      partnerIdColumn: partnerApiKeys.partnerId,
    })
    .from(partnerApiKeys)
    /*
     * 🔴 66.4 — LEFT JOINS, AND THE STATE CHECK MOVED INTO THEM.
     *
     * An inner join on `partners` refused every sponsor key, because a sponsor key has
     * no partner. A left join alone would then admit a key whose partner is held or
     * suspended, so the state condition moves INTO the join rather than sitting in the
     * WHERE, where a null partner would make it null and drop the row.
     *
     * The owner check below is what makes the pair safe: a key must resolve to one
     * live owner, and an inactive partner or sponsor resolves to none.
     */
    .leftJoin(
      partners,
      and(eq(partners.id, partnerApiKeys.partnerId), eq(partners.state, "active")),
    )
    .leftJoin(
      sponsors,
      and(eq(sponsors.id, partnerApiKeys.sponsorId), eq(sponsors.state, "active")),
    )
    .where(
      and(
        eq(partnerApiKeys.keyHash, hash),
        /* 🔴 W2-X04: a rolled key answers until the end of its overlap, then never. */
        or(isNull(partnerApiKeys.revokedAt), gt(partnerApiKeys.revokedAt, sql`now()`)),
        /* 🔴 C265 — a suspended key is dead in the WHERE clause, not in a branch. */
        isNull(partnerApiKeys.suspendedAt),
      ),
    )
    .limit(1);

  /*
   * 🔴 A KEY MUST RESOLVE TO ONE LIVE OWNER.
   *
   * With two left joins a row survives the query when neither owner is active, which
   * is a suspended partner's key answering calls. This is the condition the inner
   * join used to carry, restated where it can see both kinds of owner.
   *
   * 🔴 A SPONSOR'S KEY IS ONE WHOSE `partner_id` IS NULL, so the partner join finding
   * nothing is normal for it and is a refusal for a partner key. Distinguished by
   * which column the ROW has rather than by which join succeeded, because a held
   * partner and a sponsor key both produce a null `partners.id`.
   */
  const ownerLive = row
    ? row.partnerIdColumn
      ? Boolean(row.partnerId)
      : Boolean(row.sponsorOwnerId)
    : false;

  if (!row || !ownerLive) {
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

  const throttle = await consume(subjectKey("api-key", row.keyId), CALLS_PER_MINUTE, 60);

  /*
   * 🔴 W2-X01: A PARTNER'S KEY IS THROTTLED, NEVER SUSPENDED.
   *
   * A burst from a partner is a retry loop or a busy afternoon, not somebody probing
   * an oracle: no partner scope answers "does this person exist". Suspending the key
   * stopped every open room on their platform until an operator cleared it by hand.
   * So the surplus call gets a 429 and the second it may retry, and the key works
   * again once the window rolls over. The warning is the ops alert: a human decides
   * whether a partner is abusing us, and only a human suspends one.
   */
  if (!throttle.allowed && row.partnerIdColumn) {
    /* Never more than the window: `retryAfter` compares two clocks (see `consume`). */
    const wait = Math.min(60, Math.max(1, throttle.retryAfter));
    log.warn("api key throttled", { partner: ref(row.partnerId) });
    return {
      failure: {
        status: 429,
        error: `More than ${CALLS_PER_MINUTE} calls in a minute on this key. Wait ${wait} seconds and retry.`,
        retryAfter: wait,
      },
    };
  }

  /*
   * 🔴 C265: FOR A SPONSOR'S KEY THE RATE LIMIT SUSPENDS RATHER THAN REFUSING.
   *
   * Crossing the limit writes `suspended_at` and a reason, so the key is dead until a
   * human clears it. A limiter that only refuses the surplus call lets an attacker
   * continue at the permitted speed for ever, and against an identity oracle that is
   * still an oracle: sixty guesses a minute is thirty-one million a year.
   */
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
      /*
       * 🔴 66.4 — WHOSE KEY THIS IS, and a sponsor's names the sponsor.
       *
       * Every log line and every error wants to say whose key it was. A null here for
       * a sponsor's key would read as an anonymous caller, which is the one thing this
       * field exists to prevent.
       */
      partnerName: row.partnerName ?? row.sponsorOwnerName ?? "",
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
      /*
       * 🔴 W2-X04: STOPPED, by the database's clock, which is the clock
       * `authenticateKey` asks. A rolled key has a `revokedAt` in the future and is
       * still working until then.
       */
      stopped: sql<boolean>`(${partnerApiKeys.revokedAt} IS NOT NULL AND ${partnerApiKeys.revokedAt} <= now())`,
      createdAt: partnerApiKeys.createdAt,
    })
    .from(partnerApiKeys)
    .leftJoin(sponsors, eq(sponsors.id, partnerApiKeys.sponsorId))
    .where(eq(partnerApiKeys.partnerId, partnerId))
    .orderBy(partnerApiKeys.createdAt);
}

/** A key that still answers: never revoked, or rolled and inside its overlap. */
const stillWorking = () =>
  or(isNull(partnerApiKeys.revokedAt), gt(partnerApiKeys.revokedAt, sql`now()`));

/**
 * Revoke a key: it stops working now, including a rolled key inside its overlap.
 *
 * 🔴 W2-X04: audited, and confirmed on the screen before it is called.
 */
export async function revokeKey(
  partnerId: string,
  keyId: string,
  byPartnerUserId?: string | null,
): Promise<{ ok: boolean }> {
  const revoked = await controlDb
    .update(partnerApiKeys)
    .set({ revokedAt: sql`now()` })
    .where(
      and(
        eq(partnerApiKeys.id, keyId),
        /* Scoped in the WHERE. A borrowed key id revokes nothing. */
        eq(partnerApiKeys.partnerId, partnerId),
        stillWorking(),
      ),
    )
    .returning({ id: partnerApiKeys.id });

  if (revoked.length === 0) return { ok: false };
  await auditKey("partner.key.revoke", keyId, partnerId, byPartnerUserId, "revoked now");
  return { ok: true };
}

/** W2-X04: how long a rolled key keeps working. Stripe's default overlap is seven days. */
export const ROLL_OVERLAP_HOURS = [0, 24, 24 * 7] as const;

/**
 * 🔴 W2-X04: ROLL A KEY: a new one with the same label, scopes and environment, and
 * an end for the old one.
 *
 * "Rotatable" used to mean revoke and mint, which cut every call the old key made at
 * the moment the new one appeared. A roll lets the partner's servers move across:
 * the old key works until the overlap they chose runs out (RESEARCH-2 section 7).
 * The new key goes through `mintKey`, so a live key still needs a live approval.
 */
export async function rotateKey(input: {
  partnerId: string;
  keyId: string;
  overlapHours: number;
  byPartnerUserId?: string | null;
}): Promise<{ key?: MintedKey; error?: string }> {
  const overlap = (ROLL_OVERLAP_HOURS as readonly number[]).includes(input.overlapHours)
    ? input.overlapHours
    : 0;

  const [old] = await controlDb
    .select({
      label: partnerApiKeys.label,
      scopes: partnerApiKeys.scopes,
      environment: partnerApiKeys.environment,
      sponsorId: partnerApiKeys.sponsorId,
    })
    .from(partnerApiKeys)
    .where(
      and(
        eq(partnerApiKeys.id, input.keyId),
        eq(partnerApiKeys.partnerId, input.partnerId),
        stillWorking(),
      ),
    )
    .limit(1);
  if (!old) return { error: "That key has already stopped working." };

  const minted = await mintKey({
    partnerId: input.partnerId,
    label: old.label,
    scopes: old.scopes,
    environment: old.environment,
    sponsorId: old.sponsorId,
    byPartnerUserId: input.byPartnerUserId,
  });
  if (!minted.key) return minted;

  /* The old key's end, never later than an end it already had. */
  await controlDb
    .update(partnerApiKeys)
    .set({
      revokedAt: sql`LEAST(COALESCE(${partnerApiKeys.revokedAt}, 'infinity'::timestamptz), now() + make_interval(hours => ${overlap}::int))`,
    })
    .where(and(eq(partnerApiKeys.id, input.keyId), eq(partnerApiKeys.partnerId, input.partnerId)));

  await auditKey(
    "partner.key.rotate",
    input.keyId,
    input.partnerId,
    input.byPartnerUserId,
    `replaced by ${minted.key.id}, old key works ${overlap} more hours`,
  );
  return minted;
}
