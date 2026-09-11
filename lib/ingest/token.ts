import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

/**
 * The third door on ingestion. PLAN.md 36.2.
 *
 * ## 🔴 What is actually being solved
 *
 * `POST /api/sessions/[id]/transcribe` is **already source agnostic**: it takes
 * a multipart file and does not care what recorded it. Nothing about a bot
 * needs a second transcription path, and building one would be two code paths
 * for one job, which is how the old codebase ended up with a Whisper route
 * that never scanned for crisis language (C140's ancestor).
 *
 * What blocks a bot is the two doors on the front:
 *
 *   - `assertSameOrigin()` — a browser fetch from our own page. A bot has no
 *     origin.
 *   - `requireUserApi()` — a signed-in clinician's cookie. A bot is not a
 *     person and must never hold a person's session.
 *
 * Both exist for good reasons and neither is being weakened. This is a **third**
 * door, and it is narrower than either: one session, one purpose, expiring.
 *
 * ## Why the session id is inside the token as well as in the URL
 *
 * The obvious failure is a token minted for session A being presented at
 * session B's URL — a bot in the wrong meeting, which 41.7 makes a hard stop.
 * So the id is carried in the token body **and** the hash is stored on that
 * session's own source row: the two have to agree, and an attacker who learns
 * one token cannot reach any other session even if the route were sloppy.
 *
 * ## What the door does NOT open
 *
 * It appends transcript audio and nothing else. It cannot read a transcript,
 * cannot run the copilot, cannot see a note. That is enforced at the route,
 * and `verify:sprint36` asserts it by reading what the token branch is allowed
 * to reach rather than by trusting this paragraph.
 */

/** `si_<sessionId>_<48 hex>`. The prefix makes it greppable in a log leak. */
const PREFIX = "si";
const SECRET_BYTES = 24;

export type MintedToken = {
  /** Handed out exactly once, never stored. */
  token: string;
  hash: string;
  expiresAt: Date;
};

export function mintIngestToken(sessionId: string, ttlHours = 6, now = new Date()): MintedToken {
  const secret = randomBytes(SECRET_BYTES).toString("hex");
  const token = `${PREFIX}_${sessionId}_${secret}`;

  return {
    token,
    hash: hashIngestToken(token),
    /*
     * Six hours, not six days. A session lasts fifty minutes; the window is
     * generous enough for a meeting that starts late and short enough that a
     * token in a log file is worthless by the time anybody reads it.
     */
    expiresAt: new Date(now.getTime() + ttlHours * 60 * 60 * 1000),
  };
}

export function hashIngestToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/** The session this token claims to be for, or null if it is not one of ours. */
export function sessionIdIn(token: string): string | null {
  const match = /^si_([0-9a-f-]{36})_[0-9a-f]{48}$/i.exec(token.trim());
  return match ? match[1]!.toLowerCase() : null;
}

/** `Authorization: Bearer si_…`, or nothing. */
export function bearerFrom(header: string | null): string | null {
  if (!header) return null;
  const match = /^Bearer\s+(si_[0-9a-fA-F-]+_[0-9a-f]+)$/.exec(header.trim());
  return match ? match[1]! : null;
}

export type IngestRefusal =
  | "no_token"
  | "malformed"
  | "wrong_session"
  | "no_source"
  | "not_issued"
  | "revoked"
  | "expired"
  | "mismatch";

export type IngestDecision =
  | { ok: true }
  | { ok: false; reason: IngestRefusal };

/**
 * 🔴 Every reason a token is refused, in one pure function.
 *
 * Pure so the refusals are unit-testable without a database and without a
 * request, and so the order is readable: the cheap structural checks first,
 * the constant-time comparison last. `verify:sprint36` proves each refusal by
 * attempting it, and proves the one acceptance beside them (C165).
 */
export function ingestDecision(input: {
  /** The id in the URL. */
  sessionId: string;
  /** The raw Authorization header. */
  header: string | null;
  /** The session's own source row, or null when it has none. */
  source: {
    sessionId: string;
    ingestTokenHash: string | null;
    ingestTokenExpiresAt: Date | null;
    ingestTokenRevokedAt: Date | null;
  } | null;
  now?: Date;
}): IngestDecision {
  const now = input.now ?? new Date();

  const token = bearerFrom(input.header);
  if (!token) return { ok: false, reason: "no_token" };

  const claimed = sessionIdIn(token);
  if (!claimed) return { ok: false, reason: "malformed" };

  /*
   * The id inside the token must be the id in the URL. This is the check that
   * makes "session A's token at session B's URL" impossible to express, before
   * any row is even loaded.
   */
  if (claimed !== input.sessionId.toLowerCase()) return { ok: false, reason: "wrong_session" };

  if (!input.source) return { ok: false, reason: "no_source" };
  /* The row we were handed must be the row for this session. */
  if (input.source.sessionId.toLowerCase() !== input.sessionId.toLowerCase()) {
    return { ok: false, reason: "wrong_session" };
  }
  if (!input.source.ingestTokenHash || !input.source.ingestTokenExpiresAt) {
    return { ok: false, reason: "not_issued" };
  }
  if (input.source.ingestTokenRevokedAt) return { ok: false, reason: "revoked" };
  if (input.source.ingestTokenExpiresAt.getTime() <= now.getTime()) {
    return { ok: false, reason: "expired" };
  }

  /*
   * Constant time, because the alternative leaks the hash one byte at a time
   * to anybody willing to send a few million requests. Both sides are 64 hex
   * characters by construction (the column has a CHECK), so the lengths always
   * match and `timingSafeEqual` cannot throw.
   */
  const presented = Buffer.from(hashIngestToken(token), "hex");
  const stored = Buffer.from(input.source.ingestTokenHash, "hex");
  if (presented.length !== stored.length) return { ok: false, reason: "mismatch" };
  if (!timingSafeEqual(presented, stored)) return { ok: false, reason: "mismatch" };

  return { ok: true };
}
