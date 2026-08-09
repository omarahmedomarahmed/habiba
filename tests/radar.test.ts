import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { eq, inArray } from "drizzle-orm";

import { db } from "../lib/db";
import { organizations, rateLimits, sessions, therapistRadar, users } from "../lib/db/schema";
import {
  consume,
  refund,
  releaseHold,
  subjectKey,
  takeHold,
} from "../lib/rate-limit";
import {
  CLAIM_MINUTES,
  claimTherapist,
  listRadar,
  releaseClaim,
  markInSession,
  sweepRadar,
} from "../lib/data/radar";
import { createRadarSession } from "../lib/data/sessions";

/**
 * The Crisis Radar concurrency test.
 *
 * This runs against a real Postgres because the invariant it checks — two
 * patients can never book the same clinician — is enforced by the database, not
 * by any JavaScript in this repository. A mock would be testing the mock.
 *
 *   DATABASE_URL='postgres://…' node --import tsx --conditions=react-server \
 *     --test tests/radar.test.ts
 */

const stamp = Date.now().toString(36);
let organizationId: string;
let therapistId: string;
const sessionIds: string[] = [];
const limiterKeys: string[] = [];

before(async () => {
  const [org] = await db
    .insert(organizations)
    .values({ name: `Radar test ${stamp}`, slug: `radar-test-${stamp}` })
    .returning({ id: organizations.id });
  organizationId = org!.id;

  const [user] = await db
    .insert(users)
    .values({
      organizationId,
      email: `radar-${stamp}@example.test`,
      passwordHash: "scrypt$16384$8$1$00$00",
      firstName: "Radar",
      lastName: "Tester",
      sessionRateCents: 0,
    })
    .returning({ id: users.id });
  therapistId = user!.id;

  await db
    .insert(therapistRadar)
    .values({ userId: therapistId, organizationId, status: "online", lastSeenAt: new Date() });
});

after(async () => {
  if (limiterKeys.length > 0) {
    await db.delete(rateLimits).where(inArray(rateLimits.key, limiterKeys));
  }
  if (sessionIds.length > 0) {
    await db.delete(sessions).where(inArray(sessions.id, sessionIds));
  }
  if (therapistId) await db.delete(users).where(eq(users.id, therapistId));
  if (organizationId) await db.delete(organizations).where(eq(organizations.id, organizationId));
});

async function newSession() {
  const session = await createRadarSession({
    organizationId,
    therapistId,
    guestName: "Test patient",
    guestEmail: null,
    priceCents: 0,
  });
  sessionIds.push(session.id);
  return session.id;
}

async function setStatus(patch: {
  status?: "offline" | "online" | "pending" | "in_session";
  pendingUntil?: Date | null;
  pendingSessionId?: string | null;
  lastSeenAt?: Date | null;
}) {
  await db.update(therapistRadar).set(patch).where(eq(therapistRadar.userId, therapistId));
}

async function currentStatus() {
  const [row] = await db
    .select({ status: therapistRadar.status, pendingSessionId: therapistRadar.pendingSessionId })
    .from(therapistRadar)
    .where(eq(therapistRadar.userId, therapistId))
    .limit(1);
  return row!;
}

/**
 * The one that matters. Two bookings fired at the same instant; the database
 * decides, and exactly one of them may win.
 */
test("two simultaneous bookings cannot both claim the same clinician", async () => {
  await setStatus({ status: "online", pendingSessionId: null, pendingUntil: null, lastSeenAt: new Date() });

  const [first, second] = await Promise.all([newSession(), newSession()]);

  const results = await Promise.all([
    claimTherapist({ therapistUserId: therapistId, sessionId: first }),
    claimTherapist({ therapistUserId: therapistId, sessionId: second }),
  ]);

  assert.equal(
    results.filter(Boolean).length,
    1,
    "exactly one of two concurrent claims may succeed",
  );

  const state = await currentStatus();
  assert.equal(state.status, "pending");
  assert.ok(
    state.pendingSessionId === first || state.pendingSessionId === second,
    "the winning claim owns the row",
  );
});

test("a clinician who is already pending cannot be claimed again", async () => {
  const third = await newSession();
  assert.equal(await claimTherapist({ therapistUserId: therapistId, sessionId: third }), false);
});

/** An abandoned checkout must not take someone off the radar for ten minutes. */
test("an expired claim is claimable again without any sweep having run", async () => {
  await setStatus({ pendingUntil: new Date(Date.now() - 1000) });

  const fresh = await newSession();
  assert.equal(await claimTherapist({ therapistUserId: therapistId, sessionId: fresh }), true);

  const state = await currentStatus();
  assert.equal(state.pendingSessionId, fresh);
});

/**
 * The classic distributed-lock bug: a late release from a booking that already
 * lapsed cancels the *next* patient's claim. Scoping the release to the
 * claiming session id is what prevents it.
 */
test("releasing a stale claim does not release someone else's", async () => {
  const stale = sessionIds[0]!;
  const current = (await currentStatus()).pendingSessionId;
  assert.notEqual(current, stale, "precondition: a different session holds the claim");

  await releaseClaim(stale);

  const state = await currentStatus();
  assert.equal(state.status, "pending", "the live claim survives");
  assert.equal(state.pendingSessionId, current);
});

test("payment moves the clinician into session, and ending releases them", async () => {
  const held = (await currentStatus()).pendingSessionId!;

  await markInSession(held);
  assert.equal((await currentStatus()).status, "in_session");

  await releaseClaim(held);
  const state = await currentStatus();
  assert.equal(state.status, "online");
  assert.equal(state.pendingSessionId, null);
});

test("a clinician whose heartbeat stopped is not bookable and is swept offline", async () => {
  await setStatus({ status: "online", lastSeenAt: new Date(Date.now() - 10 * 60_000) });

  const late = await newSession();
  assert.equal(
    await claimTherapist({ therapistUserId: therapistId, sessionId: late }),
    false,
    "a stale heartbeat must fail the claim, not just hide the row",
  );

  await sweepRadar();
  assert.equal((await currentStatus()).status, "offline");

  const visible = await listRadar();
  assert.equal(
    visible.some((row) => row.userId === therapistId),
    false,
    "an offline clinician is not on the public radar",
  );
});

test("the claim window is long enough to type a card number", () => {
  assert.ok(CLAIM_MINUTES >= 5, "a shorter window would drop patients mid-checkout");
});

/* ---------------------------------------------------------- rate limiting -- */

/**
 * The limiter has to hold under concurrency for the same reason the claim does:
 * the attack is a loop, and a loop does not politely serialise itself. An
 * in-memory counter passes a sequential test and fails this one on any real
 * deployment, which is why this runs against Postgres.
 */
test("a burst of concurrent requests cannot exceed the limit", async () => {
  const key = `test:burst:${stamp}`;
  limiterKeys.push(key);

  const verdicts = await Promise.all(
    Array.from({ length: 20 }, () => consume(key, 5, 60)),
  );

  assert.equal(
    verdicts.filter((v) => v.allowed).length,
    5,
    "exactly the limit may pass, however they interleave",
  );
  assert.ok(
    verdicts.filter((v) => !v.allowed).every((v) => v.retryAfter > 0),
    "a rejection must say when to come back",
  );
});

test("the window rolls over and the budget comes back", async () => {
  const key = `test:window:${stamp}`;
  limiterKeys.push(key);

  // A one-second window, then wait it out.
  assert.equal((await consume(key, 1, 1)).allowed, true);
  assert.equal((await consume(key, 1, 1)).allowed, false);

  await new Promise((resolve) => setTimeout(resolve, 1300));
  assert.equal((await consume(key, 1, 1)).allowed, true, "a new window starts fresh");
});

test("a refunded attempt does not count against the caller", async () => {
  const key = `test:refund:${stamp}`;
  limiterKeys.push(key);

  await consume(key, 2, 60);
  await consume(key, 2, 60);
  assert.equal((await consume(key, 2, 60)).allowed, false);

  await refund(key);
  await refund(key);
  assert.equal((await consume(key, 2, 60)).allowed, true, "losing a race is not abuse");
});

/**
 * The hold is what bounds an attacker to one clinician at a time. Taking a new
 * one has to hand back the old one, or a script can accumulate claims simply by
 * asking for them one after another.
 */
test("taking a hold surrenders the previous one", async () => {
  const key = `test:hold:${stamp}`;
  limiterKeys.push(key);

  assert.equal((await takeHold(key, "session-a", 60)).previous, null);
  assert.equal(
    (await takeHold(key, "session-b", 60)).previous,
    "session-a",
    "the caller's earlier claim comes back so it can be released",
  );

  await releaseHold(key);
  assert.equal((await takeHold(key, "session-c", 60)).previous, null);
});

test("subject keys never contain the raw address", () => {
  const key = subjectKey("radar:book", "203.0.113.42");
  assert.ok(!key.includes("203.0.113.42"), "an IP is personal data and must not be stored");
  assert.equal(key, subjectKey("radar:book", "203.0.113.42"), "and must be stable");
  assert.notEqual(
    key,
    subjectKey("radar:read", "203.0.113.42"),
    "the same address in a different scope is a different bucket",
  );
});
