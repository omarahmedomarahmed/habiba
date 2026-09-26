import "server-only";

import { and, desc, eq } from "drizzle-orm";

import { controlDb } from "@/lib/db";
import { partnerConsents } from "@/lib/db/schema";
import { log } from "@/lib/logger";

/**
 * Consent on somebody else's platform. PLAN.md 68.1, 68.2.
 *
 * ## 🔴 THE SENTENCE THIS MODULE EXISTS FOR
 *
 * > *Their patient sees our consent question on THEIR interface before the session;
 * > the answer reaches us; without it we record nothing.*
 *
 * Everything else in sprint 68 is downstream of this file. There is no transcript
 * route, no note route and no summary route that does not first ask `recordingFrom`
 * and get a number, and the number is null until somebody said yes.
 *
 * ## 🔴 WHY MID-SESSION CONSENT IS THE WHOLE DESIGN
 *
 * Somebody can say yes ten minutes in. We start then, the note covers from then, and
 * the record says the session was PARTLY recorded and when it began.
 *
 * A boolean would make "consented" and "consented from the start" the same fact, and
 * the note that came out of it would imply we heard the first ten minutes. That is
 * not a rendering bug: it is a clinical document claiming to be evidence of something
 * nobody recorded. So consent is an append-only LOG, and the boundary is the offset
 * of the event that turned it on.
 */

export type ConsentEvent = {
  state: "given" | "withdrawn";
  answeredAt: Date;
  offsetSeconds: number;
};

/**
 * 🔴 68.1 / 68.2 — RECORD AN ANSWER. APPEND ONLY, AND NOTHING IS UPDATED.
 *
 * A withdrawal is a new row, not an edit of the old one, for the reason C57 gives
 * about the patient's own consent: stopping consent stops any new reading and does
 * not erase what was already read. An UPDATE would lose the fact that there WAS a
 * consented period, which is the fact the note's coverage sentence is built from.
 *
 * 🔴 `answeredAt` is when the PATIENT answered, as their platform reports it, and it
 * is clamped rather than trusted: a partner's clock reporting tomorrow would give a
 * boundary in the future and a note covering a session that has not happened.
 */
export async function recordConsent(input: {
  partnerId: string;
  externalSessionRef: string;
  externalSubjectRef: string;
  state: "given" | "withdrawn";
  answeredAt: Date;
  offsetSeconds: number;
}): Promise<{ ok?: true; error?: string }> {
  const now = Date.now();
  const answered = input.answeredAt.getTime();

  if (!Number.isFinite(answered)) return { error: "answeredAt is not a time." };

  /*
   * 🔴 A CLOCK AHEAD OF OURS IS CLAMPED, NOT REFUSED.
   *
   * A minute of skew between two servers is normal and refusing it would make an
   * integration fail intermittently for a reason nobody can reproduce. An hour of
   * skew is a different claim, and taking `now` for it is the safe direction: the
   * boundary moves later, so LESS is treated as recorded rather than more.
   */
  const answeredAt = new Date(Math.min(answered, now));

  const offsetSeconds = Math.max(0, Math.min(86_400, Math.floor(input.offsetSeconds)));

  await controlDb.insert(partnerConsents).values({
    partnerId: input.partnerId,
    externalSessionRef: input.externalSessionRef.slice(0, 200),
    externalSubjectRef: input.externalSubjectRef.slice(0, 200),
    state: input.state,
    answeredAt,
    offsetSeconds,
  });

  log.info("partner consent recorded", { state: input.state });
  return { ok: true };
}

/**
 * 🔴 THE BOUNDARY, AND IT IS THE ONE FUNCTION EVERY OTHER ROUTE ASKS.
 *
 * Returns the offset in seconds from which this session may be recorded, or null for
 * "not at all". Null is the answer for a session nobody consented to AND for one
 * where consent was withdrawn, and the two are deliberately the same answer to the
 * caller: neither permits any new reading.
 *
 * 🔴 THE LAST EVENT WINS, BY `answeredAt` AND NOT BY `createdAt`. Two answers
 * arriving out of order over a network must resolve to what the PERSON did last,
 * not to what reached our queue last.
 */
export async function recordingFrom(input: {
  partnerId: string;
  externalSessionRef: string;
}): Promise<number | null> {
  const [latest] = await controlDb
    .select({
      state: partnerConsents.state,
      offsetSeconds: partnerConsents.offsetSeconds,
    })
    .from(partnerConsents)
    .where(
      and(
        eq(partnerConsents.partnerId, input.partnerId),
        eq(partnerConsents.externalSessionRef, input.externalSessionRef),
      ),
    )
    .orderBy(desc(partnerConsents.answeredAt), desc(partnerConsents.createdAt))
    .limit(1);

  if (!latest || latest.state !== "given") return null;
  return latest.offsetSeconds;
}

/**
 * 🔴 68.2 — WHAT THE RECORD SAYS ABOUT COVERAGE, in words, from the boundary.
 *
 * Pure and exported, so the sentence can be asserted without a database and so the
 * three surfaces that need it (the note, the partner's API response, and the
 * patient's own summary) say the same thing rather than three similar things.
 *
 * 🔴 THE "PARTLY" CASE NAMES THE MINUTE, because "partly recorded" on its own is
 * exactly as misleading as no sentence: somebody reading a note has to know whether
 * the part they are looking for is in it.
 */
export function coverageSentence(fromSeconds: number | null): string {
  if (fromSeconds === null) {
    return "This session was not recorded. Nothing here was written from audio.";
  }
  if (fromSeconds === 0) {
    return "This session was recorded from the start.";
  }

  return `Recording started ${howFarIn(fromSeconds)} into this session. Nothing before that was recorded, and nothing here was written from it.`;
}

/**
 * 🔴 Board 606: WHAT A WITHDRAWAL DOES TO THE BOUNDARY, AS A RULE AND NOT A QUERY.
 *
 * A withdrawal stops any new reading and does not erase what was already read. So:
 *
 * - While the session runs, a withdrawal ends the consented period and takes back
 *   what it produced (W1-17): the boundary becomes null and the material is purged.
 * - After the session ended, everything was already read, noted and perhaps approved
 *   and delivered. The boundary stays where it was, so the transcript, the note and
 *   the delivered summary still answer with the true coverage sentence, and only
 *   new work (drafting, a new summary, the copilot) is refused.
 *
 * `consented` is what the log says now, `previous` the boundary the session held.
 */
export function boundaryAfterAnswer(input: {
  consented: number | null;
  previous: number | null;
  ended: boolean;
}): number | null {
  if (input.consented !== null) return input.consented;
  return input.ended ? input.previous : null;
}

/** The sentence a content route gives when it refuses new work after a withdrawal. */
export const WITHDRAWN_NO_NEW_WORK =
  "The patient withdrew consent after this session ended. What was already read, approved or delivered stays, and nothing new is written from it.";

/**
 * 🔴 Board 605: the offset in words, exactly. Rounding to minutes said "0 minutes"
 * for a yes 20 seconds in, and "1 minute" for 90 seconds would claim 30 seconds of
 * recording that never happened, so the seconds are said when there are any.
 */
export function howFarIn(seconds: number): string {
  const whole = Math.max(0, Math.floor(seconds));
  const minutes = Math.floor(whole / 60);
  const rest = whole % 60;
  const m = `${minutes} ${minutes === 1 ? "minute" : "minutes"}`;
  const s = `${rest} ${rest === 1 ? "second" : "seconds"}`;
  if (minutes === 0) return s;
  return rest === 0 ? m : `${m} and ${s}`;
}

/** Every answer for a session, oldest first, for a partner's own audit screen. */
export async function consentHistory(input: {
  partnerId: string;
  externalSessionRef: string;
}): Promise<ConsentEvent[]> {
  const rows = await controlDb
    .select({
      state: partnerConsents.state,
      answeredAt: partnerConsents.answeredAt,
      offsetSeconds: partnerConsents.offsetSeconds,
    })
    .from(partnerConsents)
    .where(
      and(
        eq(partnerConsents.partnerId, input.partnerId),
        eq(partnerConsents.externalSessionRef, input.externalSessionRef),
      ),
    )
    .orderBy(partnerConsents.answeredAt)
    .limit(100);

  return rows;
}
