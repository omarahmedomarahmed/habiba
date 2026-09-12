import assert from "node:assert/strict";
import { test } from "node:test";

import {
  bearerFrom,
  hashIngestToken,
  ingestDecision,
  mintIngestToken,
  sessionIdIn,
} from "../lib/ingest/token";

/**
 * The third door on ingestion. PLAN.md 36.2.
 *
 * 🔴 Every refusal is paired with the acceptance it must not swallow (C165). A
 * door that refuses everything is as useless as one that opens for anybody,
 * and only one of those two failures is visible in production.
 */

const SESSION = "11111111-2222-3333-4444-555555555555";
const OTHER = "99999999-8888-7777-6666-555555555555";
const NOW = new Date("2026-09-14T12:00:00Z");

function sourceFor(token: string, over: Partial<Parameters<typeof ingestDecision>[0]["source"]> = {}) {
  return {
    sessionId: SESSION,
    ingestTokenHash: hashIngestToken(token),
    ingestTokenExpiresAt: new Date(NOW.getTime() + 60 * 60 * 1000),
    ingestTokenRevokedAt: null,
    ...over,
  };
}

/* ---------------------------------------------------------------- minting -- */

test("a minted token carries the session it was minted for", () => {
  const { token } = mintIngestToken(SESSION, 6, NOW);
  assert.equal(sessionIdIn(token), SESSION);
  assert.ok(token.startsWith("si_"), token.slice(0, 8));
});

test("🔴 the stored hash is not the token", () => {
  const { token, hash } = mintIngestToken(SESSION, 6, NOW);
  assert.notEqual(hash, token);
  assert.match(hash, /^[0-9a-f]{64}$/);
  assert.ok(!hash.includes(token.split("_")[2]!), "the secret must not survive into the hash");
});

test("two mints are two different tokens", () => {
  assert.notEqual(mintIngestToken(SESSION).token, mintIngestToken(SESSION).token);
});

test("the expiry is hours, not days", () => {
  const { expiresAt } = mintIngestToken(SESSION, 6, NOW);
  assert.equal(expiresAt.getTime() - NOW.getTime(), 6 * 60 * 60 * 1000);
});

/* ---------------------------------------------------------------- parsing -- */

test("only a bearer that looks like ours is read", () => {
  const { token } = mintIngestToken(SESSION, 6, NOW);
  assert.equal(bearerFrom(`Bearer ${token}`), token);
  assert.equal(bearerFrom(null), null);
  assert.equal(bearerFrom("Bearer sk-not-ours"), null);
  assert.equal(bearerFrom(token), null, "a bare token is not an Authorization header");
  assert.equal(bearerFrom("Basic abc"), null);
});

/* ------------------------------------------------------------- the refusals */

test("no bearer is no token, not an error", () => {
  const decision = ingestDecision({ sessionId: SESSION, header: null, source: null, now: NOW });
  assert.deepEqual(decision, { ok: false, reason: "no_token" });
});

test("🔴 a token minted for another session is refused at this one", () => {
  // The failure the whole design is arranged against, and 41.7 makes a hard
  // stop: a bot in the wrong meeting.
  const other = mintIngestToken(OTHER, 6, NOW);
  const decision = ingestDecision({
    sessionId: SESSION,
    header: `Bearer ${other.token}`,
    /* Even handed THIS session's row, it must refuse. */
    source: sourceFor(other.token),
    now: NOW,
  });
  assert.deepEqual(decision, { ok: false, reason: "wrong_session" });
});

test("🔴 …and a row belonging to another session is refused too", () => {
  const { token } = mintIngestToken(SESSION, 6, NOW);
  const decision = ingestDecision({
    sessionId: SESSION,
    header: `Bearer ${token}`,
    source: sourceFor(token, { sessionId: OTHER }),
    now: NOW,
  });
  assert.deepEqual(decision, { ok: false, reason: "wrong_session" });
});

test("a session with no source has no door at all", () => {
  const { token } = mintIngestToken(SESSION, 6, NOW);
  assert.deepEqual(
    ingestDecision({ sessionId: SESSION, header: `Bearer ${token}`, source: null, now: NOW }),
    { ok: false, reason: "no_source" },
  );
});

test("a source with no token issued refuses a token", () => {
  const { token } = mintIngestToken(SESSION, 6, NOW);
  assert.deepEqual(
    ingestDecision({
      sessionId: SESSION,
      header: `Bearer ${token}`,
      source: sourceFor(token, { ingestTokenHash: null, ingestTokenExpiresAt: null }),
      now: NOW,
    }),
    { ok: false, reason: "not_issued" },
  );
});

test("revoked is refused, and it is checked before the clock", () => {
  const { token } = mintIngestToken(SESSION, 6, NOW);
  assert.deepEqual(
    ingestDecision({
      sessionId: SESSION,
      header: `Bearer ${token}`,
      source: sourceFor(token, { ingestTokenRevokedAt: NOW }),
      now: NOW,
    }),
    { ok: false, reason: "revoked" },
  );
});

test("expired is refused, on the second it expires", () => {
  const { token } = mintIngestToken(SESSION, 6, NOW);
  const expiresAt = new Date(NOW.getTime() + 1000);
  assert.deepEqual(
    ingestDecision({
      sessionId: SESSION,
      header: `Bearer ${token}`,
      source: sourceFor(token, { expiresAt } as never),
      now: NOW,
    }).ok,
    true,
    "still valid a second before",
  );
  assert.deepEqual(
    ingestDecision({
      sessionId: SESSION,
      header: `Bearer ${token}`,
      source: sourceFor(token, { ingestTokenExpiresAt: NOW }),
      now: NOW,
    }),
    { ok: false, reason: "expired" },
  );
});

test("🔴 a token for the right session whose hash does not match is refused", () => {
  // Same session id in the body, different secret: guessing the id is not
  // enough, which is the point of storing a hash at all.
  const real = mintIngestToken(SESSION, 6, NOW);
  const forged = mintIngestToken(SESSION, 6, NOW);
  assert.deepEqual(
    ingestDecision({
      sessionId: SESSION,
      header: `Bearer ${forged.token}`,
      source: sourceFor(real.token),
      now: NOW,
    }),
    { ok: false, reason: "mismatch" },
  );
});

test("a mangled token is refused as malformed, not as a mismatch", () => {
  /*
   * Two shapes of wrong, and they refuse differently on purpose. A header that
   * does not look like one of ours at all is "no_token" — it may be somebody
   * else's bearer and is none of our business. A header that looks like ours
   * and is not well formed is "malformed", which is the one worth a log line.
   */
  assert.deepEqual(
    ingestDecision({ sessionId: SESSION, header: "Bearer si_1111_aaaa", source: null, now: NOW }),
    { ok: false, reason: "malformed" },
  );
  assert.deepEqual(
    ingestDecision({
      sessionId: SESSION,
      header: "Bearer si_not-a-uuid_zzzz",
      source: null,
      now: NOW,
    }),
    { ok: false, reason: "no_token" },
  );
});

/* ------------------------------------------------------------ the opening -- */

test("🔴 and the door OPENS for the token it was minted for", () => {
  const { token } = mintIngestToken(SESSION, 6, NOW);
  assert.deepEqual(
    ingestDecision({
      sessionId: SESSION,
      header: `Bearer ${token}`,
      source: sourceFor(token),
      now: NOW,
    }),
    { ok: true },
  );
});

test("…and keeps opening, because a session is many chunks", () => {
  const { token } = mintIngestToken(SESSION, 6, NOW);
  const source = sourceFor(token);
  for (let chunk = 0; chunk < 5; chunk += 1) {
    assert.equal(
      ingestDecision({ sessionId: SESSION, header: `Bearer ${token}`, source, now: NOW }).ok,
      true,
    );
  }
});

test("the session id is matched case-insensitively, because a URL is not a database", () => {
  const { token } = mintIngestToken(SESSION, 6, NOW);
  assert.equal(
    ingestDecision({
      sessionId: SESSION.toUpperCase(),
      header: `Bearer ${token}`,
      source: sourceFor(token, { sessionId: SESSION.toUpperCase() }),
      now: NOW,
    }).ok,
    true,
  );
});
