import { NextResponse } from "next/server";

import { consentHistory, recordConsent } from "@/lib/partner/consent";
import { openSession } from "@/lib/partner/platform";
import { fail, withKey } from "@/lib/partner/route";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * 🔴 68.1 / 68.2 — POST /api/partner/v1/consent
 *
 * *Their patient sees our consent question on THEIR interface before the session; the
 * answer reaches us; without it we record nothing.*
 *
 * ## 🔴 THIS IS THE FIRST ENDPOINT AN INTEGRATION CALLS, AND THE ONLY MANDATORY ONE
 *
 * Every other route in this API asks `mayAnswer`, which asks the consent log, which is
 * empty until this is called. So an integration that skips this gets 403s from
 * everything with a sentence explaining why, rather than silently producing notes from
 * audio nobody agreed to.
 *
 * ## 🔴 MID-SESSION IS THE SAME ENDPOINT, WITH AN OFFSET
 *
 * Somebody can say yes ten minutes in. `offset_seconds` is how far into the session
 * they answered, the note covers from then, and the record says the session was PARTLY
 * recorded. There is no second endpoint for it and no flag: the offset IS the
 * difference, so an integration that handles the before-session case correctly handles
 * the mid-session one by sending a different number.
 *
 * ## 🔴 AND A WITHDRAWAL IS THE SAME ENDPOINT AGAIN
 *
 * `state: "withdrawn"` appends a row, it does not delete one. Stopping consent stops
 * any NEW reading and does not erase what was already read, which is C57's ruling on
 * our own side, unchanged by a commercial boundary. The partner's own therapist keeps
 * whatever note was already approved; nothing further is produced.
 *
 * ### Request
 *
 * ```json
 * {
 *   "session": "their-session-id",
 *   "subject": "their-patient-id",
 *   "state": "given",
 *   "answered_at": "2026-09-14T10:30:00Z",
 *   "offset_seconds": 0
 * }
 * ```
 *
 * ### Response
 *
 * ```json
 * {
 *   "recording_from_seconds": 0,
 *   "coverage": "This session was recorded from the start.",
 *   "stopped_reason": null
 * }
 * ```
 *
 * 🔴 `coverage` is a SENTENCE the partner can put on a screen, in our words, because
 * three surfaces have to say the same thing about what was recorded and a partner
 * writing their own version of it is three versions.
 */
export async function POST(request: Request) {
  const guard = await withKey(request, "consent:write");
  if ("response" in guard) return guard.response;

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return fail("Send JSON.", 400);
  }

  const session = body.session;
  const subject = body.subject;
  const state = body.state;
  const answeredAt = body.answered_at;
  const offset = body.offset_seconds ?? 0;

  if (typeof session !== "string" || typeof subject !== "string") {
    return fail("Send session and subject.", 400);
  }

  if (state !== "given" && state !== "withdrawn") {
    /*
     * 🔴 TWO STATES, AND "PENDING" IS NOT ONE OF THEM.
     *
     * The absence of a row is pending. Accepting a third value would let an
     * integration write "pending" over a "given" and lose a consent somebody gave,
     * which is the one direction this log must never move in.
     */
    return fail('state must be "given" or "withdrawn".', 400);
  }

  if (typeof answeredAt !== "string") return fail("Send answered_at as an ISO time.", 400);
  if (typeof offset !== "number" || !Number.isFinite(offset)) {
    return fail("offset_seconds must be a number of seconds from the session's start.", 400);
  }

  const answered = new Date(answeredAt);
  if (Number.isNaN(answered.getTime())) return fail("answered_at is not a time.", 400);

  const recorded = await recordConsent({
    partnerId: guard.key.partnerId,
    externalSessionRef: session,
    externalSubjectRef: subject,
    state,
    answeredAt: answered,
    offsetSeconds: offset,
  });

  if (recorded.error) return fail(recorded.error, 400);

  /*
   * 🔴 OPENING THE SESSION HERE IS WHAT MAKES THE ANSWER USEFUL.
   *
   * The partner needs to know two things from this call and neither is "ok": whether
   * we will record, and whether their own limit has stopped us. `openSession` asks
   * the limit, reads the consent they just wrote, and returns both, so an integration
   * has one round trip between "the patient tapped yes" and "put this on the
   * therapist's screen".
   */
  const opened = await openSession({
    partnerId: guard.key.partnerId,
    environment: guard.key.environment,
    externalSessionRef: session,
    externalSubjectRef: subject,
  });

  /*
   * 🔴 W1-17: a withdrawal purges what the consent produced. It used to stop new
   * reading and keep the transcript, the draft and the summary for ever.
   */
  if (state === "withdrawn") {
    const { purgeSessionMaterial } = await import("@/lib/partner/media");
    await purgeSessionMaterial({ partnerId: guard.key.partnerId, externalSessionRef: session });
  }

  return NextResponse.json({
    recording_from_seconds: opened.recordingFromSeconds,
    coverage: opened.coverage,
    /* 🔴 68.18 — the sentence their therapist's screen shows, or null to carry on. */
    stopped_reason: opened.stoppedReason,
  });
}

/**
 * GET /api/partner/v1/consent?session=...
 *
 * Every answer for a session, oldest first. A partner auditing their own integration
 * needs this, and so does a support conversation about a note whose coverage sentence
 * somebody is querying.
 */
export async function GET(request: Request) {
  const guard = await withKey(request, "consent:write");
  if ("response" in guard) return guard.response;

  const session = new URL(request.url).searchParams.get("session");
  if (!session) return fail("Send ?session=", 400);

  const history = await consentHistory({
    partnerId: guard.key.partnerId,
    externalSessionRef: session,
  });

  return NextResponse.json({
    session,
    events: history.map((event) => ({
      state: event.state,
      answered_at: event.answeredAt.toISOString(),
      offset_seconds: event.offsetSeconds,
    })),
  });
}
