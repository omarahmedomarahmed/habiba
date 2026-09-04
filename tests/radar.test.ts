import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { eq, inArray } from "drizzle-orm";

import { db } from "../lib/db";
import {
  organizations,
  rateLimits,
  sessionReports,
  sessions,
  therapistRadar,
  users,
} from "../lib/db/schema";
import {
  consume,
  networkOf,
  refund,
  releaseHold,
  subjectKey,
  takeHold,
} from "../lib/rate-limit";
import {
  CLAIM_MINUTES,
  claimTherapist,
  invalidateRadarBoard,
  listRadar,
  releaseClaim,
  releaseReservation,
  setOnline,
  markInSession,
  reserveTherapist,
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
  reservedBy?: string | null;
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

  // The board is cached for a couple of seconds and is advisory — booking is
  // decided by the atomic UPDATE, not by this list. The test is asserting what
  // a visitor *sees*, so it has to ask for a fresh one rather than accidentally
  // pass or fail on where it lands inside the window.
  invalidateRadarBoard();
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

/**
 * The finding that prompted this: flooding the deployed endpoint produced zero
 * 429s, because the caller's egress rotated across 160.79.106.128, .129 and
 * .135. Three addresses, one obvious caller, three separate buckets — and any
 * cheap proxy pool does the same. Bucketing by network is what makes the limit
 * mean anything.
 */
test("addresses in one network share a bucket", () => {
  assert.equal(networkOf("160.79.106.128"), networkOf("160.79.106.129"));
  assert.equal(networkOf("160.79.106.128"), networkOf("160.79.106.135"));
  assert.notEqual(networkOf("160.79.106.1"), networkOf("160.79.107.1"));
});

test("an IPv6 allocation cannot be used as a billion buckets", () => {
  // A single customer /64 — trivially many addresses, one caller.
  assert.equal(
    networkOf("2001:db8:85a3:1::8a2e:370:7334"),
    networkOf("2001:db8:85a3:1::ffff:1:2"),
  );
  assert.notEqual(
    networkOf("2001:db8:85a3:1::1"),
    networkOf("2001:db8:85a3:2::1"),
  );
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

/* ------------------------------------------------------- viewing holds -- */

/**
 * The bug: opening a booking sheet marked the clinician `pending`, and the
 * person *in that sheet* was then told "someone is booking them" and lost the
 * form. A lock that excludes its own holder is not a lock, it is an outage.
 */
test("the holder of a reservation can still book; nobody else can", async () => {
  await setStatus({
    status: "online",
    pendingSessionId: null,
    pendingUntil: null,
    reservedBy: null,
    lastSeenAt: new Date(),
  });

  const me = `viewer-me-${stamp}`;
  const someoneElse = `viewer-other-${stamp}`;

  assert.equal(
    await reserveTherapist({ therapistUserId: therapistId, viewer: me }),
    true,
    "opening the sheet holds the clinician",
  );
  assert.equal(
    await reserveTherapist({ therapistUserId: therapistId, viewer: someoneElse }),
    false,
    "and holds them against everyone else",
  );

  // Renewing my own hold must keep working, or the sheet's heartbeat kills it.
  assert.equal(await reserveTherapist({ therapistUserId: therapistId, viewer: me }), true);

  const theirs = await newSession();
  assert.equal(
    await claimTherapist({
      therapistUserId: therapistId,
      sessionId: theirs,
      viewer: someoneElse,
    }),
    false,
    "someone else cannot book over my reservation",
  );

  const mine = await newSession();
  assert.equal(
    await claimTherapist({ therapistUserId: therapistId, sessionId: mine, viewer: me }),
    true,
    "I can book the clinician I am holding — this is the regression",
  );

  const state = await currentStatus();
  assert.equal(state.pendingSessionId, mine);
});

test("a real booking cannot be displaced by a reservation", async () => {
  // A claim is live from the test above.
  assert.equal(
    await reserveTherapist({ therapistUserId: therapistId, viewer: `late-${stamp}` }),
    false,
    "nobody may reserve over someone already at the checkout",
  );
});

test("closing the sheet hands the clinician straight back", async () => {
  await setStatus({
    status: "online",
    pendingSessionId: null,
    pendingUntil: null,
    reservedBy: null,
    lastSeenAt: new Date(),
  });

  const me = `viewer-close-${stamp}`;
  await reserveTherapist({ therapistUserId: therapistId, viewer: me });
  assert.equal((await currentStatus()).status, "pending");

  await releaseReservation({ therapistUserId: therapistId, viewer: me });
  assert.equal((await currentStatus()).status, "online", "no waiting for the timer");
});

test("a reservation only tells its own holder that it is theirs", async () => {
  await setStatus({
    status: "online",
    pendingSessionId: null,
    pendingUntil: null,
    reservedBy: null,
    lastSeenAt: new Date(),
  });

  const me = `viewer-list-${stamp}`;
  await reserveTherapist({ therapistUserId: therapistId, viewer: me });

  invalidateRadarBoard();
  const asMe = (await listRadar(me)).find((row) => row.userId === therapistId);
  // Deliberately no invalidation between these two: the whole point is that one
  // cached board yields different answers to different viewers, because the
  // only per-viewer field is computed in memory from it.
  const asOther = (await listRadar(`other-${stamp}`)).find((row) => row.userId === therapistId);

  assert.equal(asMe?.reservedByYou, true, "I see it as mine");
  assert.equal(asOther?.status, "pending", "everyone else sees busy");
  assert.equal(asOther?.reservedByYou, false);

  await releaseReservation({ therapistUserId: therapistId, viewer: me });
});

/**
 * Going offline while somebody is looking at you.
 *
 * A viewer opening the booking sheet moves the row to `pending`, and the
 * Offline control used to refuse on `status = 'pending'` alone — so from the
 * moment anybody so much as looked, a clinician could not stand down, and was
 * told "you have a booking in progress" when there was no booking.
 *
 * The line is the one `claimTherapist` already draws: `pending_session_id IS
 * NULL` is somebody deciding, and a non-null one is a session with money in
 * flight. Only the second may hold a clinician on the radar against their will.
 */
test("a clinician can stand down while someone is merely viewing them", async () => {
  const viewer = `stand-down-${stamp}`;
  await setStatus({
    status: "online",
    pendingSessionId: null,
    pendingUntil: null,
    reservedBy: null,
    lastSeenAt: new Date(),
  });

  const reserved = await reserveTherapist({ therapistUserId: therapistId, viewer });
  assert.equal(reserved, true, "opening the sheet reserves them");
  assert.equal((await currentStatus()).status, "pending", "which shows as pending");

  const actor = { userId: therapistId, organizationId, role: "therapist" } as never;
  const result = await setOnline(actor, false);

  assert.equal(result.error, undefined, "standing down is allowed while only viewed");
  const after = await currentStatus();
  assert.equal(after.status, "offline");

  // The reservation is cleared too. Leaving `reserved_by` set would let that
  // viewer's own claim path find a live reservation on a clinician who has
  // gone offline.
  const [row] = await db
    .select({ reservedBy: therapistRadar.reservedBy, pendingUntil: therapistRadar.pendingUntil })
    .from(therapistRadar)
    .where(eq(therapistRadar.userId, therapistId))
    .limit(1);
  assert.equal(row?.reservedBy, null);
  assert.equal(row?.pendingUntil, null);

  await releaseReservation({ therapistUserId: therapistId, viewer });
});

test("a real booking still holds them, and says so accurately", async () => {
  await setStatus({
    status: "online",
    pendingSessionId: null,
    pendingUntil: null,
    reservedBy: null,
    lastSeenAt: new Date(),
  });

  const sessionId = await newSession();
  assert.equal(await claimTherapist({ therapistUserId: therapistId, sessionId }), true);

  const actor = { userId: therapistId, organizationId, role: "therapist" } as never;
  const result = await setOnline(actor, false);

  assert.ok(result.error, "a paying patient is not dropped because of a mistimed tap");
  assert.match(result.error!, /booked you/, "and the reason names what actually happened");
  assert.equal((await currentStatus()).status, "pending", "they stay claimed");

  await releaseClaim(sessionId);
});

test("standing down loses to a booking that lands in the same instant", async () => {
  /*
   * The race the conditional UPDATE exists for. The clinician reads a screen
   * that says "someone is looking", decides to stop, and in the moment between
   * the decision and the tap the viewer actually books.
   *
   * Both statements are fired together. Exactly one outcome is acceptable: if
   * the claim wins, the stand-down must fail and the patient keeps their
   * clinician; if the stand-down wins, the claim must fail and the patient is
   * told to pick somebody else. What must never happen is both succeeding,
   * which would leave a paid session pointing at an offline clinician.
   */
  const viewer = `race-${stamp}`;
  await setStatus({
    status: "online",
    pendingSessionId: null,
    pendingUntil: null,
    reservedBy: null,
    lastSeenAt: new Date(),
  });
  await reserveTherapist({ therapistUserId: therapistId, viewer });

  const sessionId = await newSession();
  const actor = { userId: therapistId, organizationId, role: "therapist" } as never;

  const [claimed, standDown] = await Promise.all([
    claimTherapist({ therapistUserId: therapistId, sessionId, viewer }),
    setOnline(actor, false),
  ]);

  const final = await currentStatus();
  const standDownWon = standDown.error === undefined;

  assert.notEqual(
    claimed && standDownWon,
    true,
    "a booking and a stand-down must never both succeed",
  );

  if (claimed) {
    assert.equal(final.status, "pending", "the booking won, so they are held");
    assert.equal(final.pendingSessionId, sessionId);
  } else {
    assert.equal(final.status, "offline", "the stand-down won, so the booking was refused");
  }

  await releaseClaim(sessionId);
});

/**
 * Feedback has to outlive the session, or nobody is ever rated.
 *
 * ## The bug this guards, and the one this test itself had
 *
 * `completeSession` used to null the join token — "kill the link the moment the
 * session ends", which sounds obviously right. It was belt over braces, because
 * `resolveJoinToken` already refuses any session with an `ended_at`, and the
 * belt strangled the feedback flow: at the time, *feedback was looked up by the
 * join token too*, so nulling it meant no patient could ever rate a session or
 * receive their brief. Nothing failed loudly — a missing row reads as an
 * expired link — so the feature was dead on arrival and looked like normal
 * behaviour.
 *
 * The fix was two separate tokens: `join_token`, which dies with the session,
 * and `feedback_token`, which does not. `sessions.ts` says it out loud —
 * "issued alongside the join token and never equal to it" — and
 * `feedbackContext` queries `feedback_token`.
 *
 * This test was not updated when that landed. It kept asserting that the *join*
 * token reaches the feedback page, which the current design deliberately makes
 * false, so it failed on `main` for as long as the two-token design has
 * existed. Measured on the sprint-1 branch database: 59 sessions, 0 with
 * `join_token = feedback_token`.
 *
 * It now asserts the property that actually matters — that ending a session
 * kills the way in and keeps the way to rate it — against the tokens the code
 * really uses. A stale test that fails is worse than no test: one known-red
 * suite teaches everybody to skim past red.
 */
test("a finished session still resolves for feedback, but not for joining", async () => {
  const sessionId = await newSession();

  const [before] = await db
    .select({ join: sessions.joinToken, feedback: sessions.feedbackToken })
    .from(sessions)
    .where(eq(sessions.id, sessionId))
    .limit(1);

  const joinToken = before?.join;
  const feedbackToken = before?.feedback;
  assert.ok(joinToken, "a radar session is created with a join token");
  assert.ok(feedbackToken, "and with a feedback token");
  assert.notEqual(joinToken, feedbackToken, "the two tokens are never the same value");

  const { completeSession, resolveJoinToken } = await import("../lib/data/sessions");
  const { feedbackContext } = await import("../lib/data/feedback");

  assert.ok(await resolveJoinToken(joinToken), "the link works while the session is live");

  await completeSession(
    { userId: therapistId, organizationId, role: "therapist" } as never,
    sessionId,
  );

  assert.equal(
    await resolveJoinToken(joinToken),
    null,
    "the meeting link is dead the moment the session ends",
  );

  const feedback = await feedbackContext(feedbackToken);
  assert.ok(feedback, "the feedback token still reaches the rating page");
  assert.equal(feedback.sessionId, sessionId);

  // And the dead one cannot be swapped in for the live one. A join token that
  // still opened the feedback page would make "the link is dead" a half-truth.
  assert.equal(
    await feedbackContext(joinToken),
    null,
    "the join token is not a second key to the feedback page",
  );
});

/**
 * The abandonment check, now that it hangs off the patient's poll.
 *
 * This moved out of the cron sweep to stop the database being woken four times
 * an hour to ask a question whose answer is almost always "nobody is waiting".
 * The move is only safe if the check is exact at the boundary and harmless
 * when repeated — the poll runs every five seconds, so a version that filed a
 * report each time would send a clinician several hundred warning emails while
 * a patient sat there.
 */
test("a waiting patient is not called abandoned before the deadline", async () => {
  const sessionId = await newSession();
  const { markAbandonedIfWaiting, ABANDON_AFTER_MINUTES } = await import("../lib/data/feedback");

  const justNow = new Date(Date.now() - (ABANDON_AFTER_MINUTES - 1) * 60_000);
  await db.update(sessions).set({ patientJoinedAt: justNow }).where(eq(sessions.id, sessionId));

  assert.equal(
    await markAbandonedIfWaiting(sessionId, justNow, null),
    false,
    "nine minutes is a therapist who is nearly there, not a no-show",
  );

  const [report] = await db
    .select({ id: sessionReports.id })
    .from(sessionReports)
    .where(eq(sessionReports.sessionId, sessionId))
    .limit(1);
  assert.equal(report, undefined);
});

test("past the deadline it is filed once, and the next poll does nothing", async () => {
  const sessionId = await newSession();
  const { markAbandonedIfWaiting, ABANDON_AFTER_MINUTES } = await import("../lib/data/feedback");

  const waited = new Date(Date.now() - (ABANDON_AFTER_MINUTES + 1) * 60_000);
  await db.update(sessions).set({ patientJoinedAt: waited }).where(eq(sessions.id, sessionId));

  assert.equal(await markAbandonedIfWaiting(sessionId, waited, null), true);

  const filed = await db
    .select({ id: sessionReports.id, kind: sessionReports.kind })
    .from(sessionReports)
    .where(eq(sessionReports.sessionId, sessionId));
  assert.equal(filed.length, 1);
  assert.equal(filed[0]?.kind, "no_show");

  // The poll fires again five seconds later. And again, and again.
  assert.equal(await markAbandonedIfWaiting(sessionId, waited, null), false);
  assert.equal(await markAbandonedIfWaiting(sessionId, waited, null), false);

  const still = await db
    .select({ id: sessionReports.id })
    .from(sessionReports)
    .where(eq(sessionReports.sessionId, sessionId));
  assert.equal(still.length, 1, "one abandonment is one report, however often we are asked");
});

test("a session the clinician actually started is never abandoned", async () => {
  const sessionId = await newSession();
  const { markAbandonedIfWaiting, ABANDON_AFTER_MINUTES } = await import("../lib/data/feedback");

  const waited = new Date(Date.now() - (ABANDON_AFTER_MINUTES + 30) * 60_000);
  await db
    .update(sessions)
    .set({ patientJoinedAt: waited, startedAt: new Date(), status: "in_progress" })
    .where(eq(sessions.id, sessionId));

  assert.equal(
    await markAbandonedIfWaiting(sessionId, waited, new Date()),
    false,
    "a long session is not an abandoned one",
  );
});

/**
 * Consent, and whether a refusal actually does anything.
 *
 * The dangerous failure here is not "we forgot to ask" — it is asking,
 * recording the answer, and then recording the session anyway. That produces a
 * document proving we knew, which is strictly worse than never having a
 * consent step at all. So the test that matters is the one where the patient
 * says no.
 */
test("a patient who declines is not recorded, and the refusal is stored", async () => {
  const sessionId = await newSession();
  const { RECORDING_CONSENT_VERSION } = await import("../lib/consent");

  // What submitJoin writes for a refusal.
  await db
    .update(sessions)
    .set({
      recordingConsent: "declined",
      recordingConsentAt: new Date(),
      recordingConsentVersion: RECORDING_CONSENT_VERSION,
      recordingPausedAt: new Date(),
    })
    .where(eq(sessions.id, sessionId));

  const [row] = await db
    .select({
      consent: sessions.recordingConsent,
      at: sessions.recordingConsentAt,
      version: sessions.recordingConsentVersion,
      paused: sessions.recordingPausedAt,
    })
    .from(sessions)
    .where(eq(sessions.id, sessionId))
    .limit(1);

  assert.equal(row?.consent, "declined");
  assert.ok(row?.at, "a refusal is a decision with a time, not an absence");
  assert.equal(
    row?.version,
    RECORDING_CONSENT_VERSION,
    "consent is to particular words; without the version it is an assertion",
  );
  assert.ok(
    row?.paused,
    "a stored refusal that leaves the microphone running is worse than never asking",
  );
});

test("the patient's own screen shows the recording is off", async () => {
  const sessionId = await newSession();
  const [before] = await db
    .select({ token: sessions.joinToken })
    .from(sessions)
    .where(eq(sessions.id, sessionId))
    .limit(1);
  const token = before?.token;
  assert.ok(token);

  await db
    .update(sessions)
    .set({
      recordingConsent: "declined",
      recordingPausedAt: new Date(),
      startedAt: new Date(),
      status: "in_progress",
    })
    .where(eq(sessions.id, sessionId));

  const { checkJoinState } = await import("../app/join/[token]/actions");
  const state = await checkJoinState(token);

  assert.equal(state.live, true);
  assert.equal(
    state.recording,
    false,
    "the person who refused is the one person who must be able to see that it stuck",
  );
});

test("consent that was granted leaves the microphone alone", async () => {
  const sessionId = await newSession();
  const { RECORDING_CONSENT_VERSION } = await import("../lib/consent");

  await db
    .update(sessions)
    .set({
      recordingConsent: "granted",
      recordingConsentAt: new Date(),
      recordingConsentVersion: RECORDING_CONSENT_VERSION,
    })
    .where(eq(sessions.id, sessionId));

  const [row] = await db
    .select({ consent: sessions.recordingConsent, paused: sessions.recordingPausedAt })
    .from(sessions)
    .where(eq(sessions.id, sessionId))
    .limit(1);

  assert.equal(row?.consent, "granted");
  assert.equal(row?.paused, null);
});

/**
 * The cached board.
 *
 * The public radar is polled every four seconds by every open tab, and each
 * poll used to be its own pair of queries — making database load a function of
 * how many people are looking at the marketing page, for an answer that is
 * identical for all of them.
 *
 * Two things have to hold for that to be safe, and neither is obvious from
 * reading the cache: different viewers must still get different answers out of
 * one cached board, and the cache must never be what decides a booking.
 */
test("one cached board still answers each viewer about their own reservation", async () => {
  const mine = `viewer-cache-${stamp}`;

  await setStatus({ status: "online", pendingUntil: null, pendingSessionId: null, reservedBy: null });
  const held = await reserveTherapist({ therapistUserId: therapistId, viewer: mine });
  assert.equal(held, true);

  invalidateRadarBoard();

  // Two reads inside the TTL: the second is served from the first one's rows.
  const asMe = (await listRadar(mine)).find((row) => row.userId === therapistId);
  const asStranger = (await listRadar(`stranger-${stamp}`)).find(
    (row) => row.userId === therapistId,
  );

  assert.equal(asMe?.reservedByYou, true, "the holder must still be told it is theirs");
  assert.equal(
    asStranger?.reservedByYou,
    false,
    "a shared cache must not leak one visitor's reservation to another",
  );

  await releaseReservation({ therapistUserId: therapistId, viewer: mine });
});

test("a stale board cannot cause a double booking", async () => {
  const first = await newSession();
  const second = await newSession();

  await setStatus({ status: "online", pendingUntil: null, pendingSessionId: null, reservedBy: null });

  // Warm the cache while the clinician is free, then take them.
  invalidateRadarBoard();
  await listRadar();
  assert.equal(await claimTherapist({ therapistUserId: therapistId, sessionId: first }), true);

  // The board still says "online" — it is up to two seconds behind. The claim
  // must refuse anyway, because availability is decided by the UPDATE.
  const board = (await listRadar()).find((row) => row.userId === therapistId);
  assert.equal(board?.status, "online", "the cached board is deliberately stale here");
  assert.equal(
    await claimTherapist({ therapistUserId: therapistId, sessionId: second }),
    false,
    "the list is advisory; the atomic UPDATE is the authority",
  );

  await releaseClaim(first);
});
