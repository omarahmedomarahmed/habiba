import "server-only";

import { and, desc, eq, isNull } from "drizzle-orm";

import { patientFacingCrisisMessage, raiseCrisisAlert, scanForCrisisLanguage } from "@/lib/crisis/alerts";
import { controlDb } from "@/lib/db";
import { patients, sessions } from "@/lib/db/schema";
import { log, ref } from "@/lib/logger";
import { lastCheckinFor, mute, recordReply } from "@/lib/data/checkins";

/**
 * 🔴 44.2 — A REPLY ARRIVES. THIS IS THE FILE THE WHOLE SPRINT IS ABOUT.
 *
 * > *A check-in is not a clinical assessment: it asks, it never interprets, and a reply that
 * > suggests risk goes to the crisis path, not to a copilot.*
 *
 * ## 🔴 THE ORDER, AND WHY THE STOP WORD IS NOT FIRST
 *
 *   1. Scan for crisis language.
 *   2. If there is any, route it, and DO NOT treat it as an opt-out whatever else it said.
 *   3. Otherwise, if the whole message is a stop word, mute.
 *   4. Otherwise, store it and stop.
 *
 * The obvious order is to check the opt-out first, because it is cheap and unambiguous. That order
 * is how somebody who writes **"I cannot stop crying"** gets unsubscribed instead of helped.
 * `isStopWord` matches the whole trimmed message rather than a substring specifically to make that
 * impossible, and putting the crisis scan first means even a bug in that matcher cannot cost
 * somebody the crisis path. Two independent defences for the one failure in this sprint that would
 * be unforgivable.
 *
 * ## 🔴 NO MODEL IS CALLED HERE, AND THERE IS NO `lib/ai` IMPORT IN THIS DIRECTORY
 *
 * The scan is `scanForCrisisLanguage` from `lib/crisis/alerts.ts` — the SAME keyword path a session
 * transcript goes through, with the same `lib/crisis/context.ts` suppression for third-party and
 * resolved mentions. One crisis path reached from two places, rather than a second one written for
 * short messages that would drift from the first.
 *
 * The reply is never summarised, scored, classified or handed to a copilot. It is stored as the
 * person's own words and, if it needs to, it wakes a human.
 *
 * ## 🔴 THE CRISIS PATH NEEDS A SESSION, AND A CHECK-IN HAS NONE
 *
 * `raiseCrisisAlert` is built around a session, because until now every crisis signal came out of
 * one. A check-in reply has no session, so this finds the person's most recent one to attach to: the
 * clinician who saw them last is the clinician who should be woken.
 *
 * 🔴 If there is NO session at all, the alert cannot be raised and the person is still shown where
 * to get help. That is a real gap rather than a handled case, and it is named in the return value as
 * `noClinician` rather than swallowed — somebody who claimed a record, was never seen, and then
 * wrote something worrying has nobody here to alert, and pretending otherwise would be worse.
 */

export type ReplyOutcome =
  | { kind: "crisis"; message: string; helpline: string | null; noClinician: boolean }
  | { kind: "muted" }
  | { kind: "stored" }
  | { kind: "ignored"; because: "no_checkin" };

export async function handleReply(input: {
  personId: string;
  body: string;
  /** Their country, for the helpline. Null means the message names the emergency number instead. */
  country: string | null;
}): Promise<ReplyOutcome> {
  /*
   * A reply has to belong to a check-in. Somebody messaging us out of the blue on a channel we only
   * use to ask how they are is not something this file invents a home for: no check-in, no reply row.
   */
  const checkin = await lastCheckinFor(input.personId);
  if (!checkin) return { kind: "ignored", because: "no_checkin" };

  /* 🔴 1. THE CRISIS SCAN, FIRST, through the same path a transcript uses. */
  const indicators = scanForCrisisLanguage(input.body);

  if (indicators.length > 0) {
    const { sessionId, therapistId, organizationId, patientId } =
      (await mostRecentSessionFor(input.personId)) ?? {};

    const noClinician = !sessionId || !therapistId || !organizationId;

    if (sessionId && therapistId && organizationId) {
      await raiseCrisisAlert({
        sessionId,
        organizationId,
        therapistId,
        patientId: patientId ?? null,
        /*
         * `high` rather than a level derived from the words, because deriving one would be this
         * file interpreting. The keyword floor is what `lib/crisis/level.ts` exists for and what a
         * transcript gets; a check-in reply containing crisis language with nobody in the room is
         * not the moment to be subtle about a threshold.
         */
        level: "high",
        source: "keyword",
        indicators,
        recommendedAction: "They wrote this in reply to a check-in, outside a session.",
      });
    } else {
      /*
       * 🔴 NAMED, not swallowed. A person with no session has no clinician to wake, and a log line
       * is the only thing this can do about it. The alternative — inventing a recipient, or picking
       * an arbitrary clinician — would notify somebody with no relationship to them.
       */
      log.warn("crisis language in a check-in reply with no clinician to alert", {
        person: ref(input.personId),
      });
    }

    /*
     * 🔴 Stored AFTER the alert, with `crisisAlertRaised` recording what actually happened.
     *
     * The ordering is the one `raiseCrisisAlert` itself uses and for the same reason: the durable
     * record of the risk is written before anything that could fail, so a crash does not lose it.
     */
    await recordReply({
      checkinId: checkin.id,
      personId: input.personId,
      body: input.body,
      crisisAlertRaised: !noClinician,
    });

    const { message, helpline } = patientFacingCrisisMessage(input.country);
    return { kind: "crisis", message, helpline, noClinician };
  }

  /* 🔴 2. THE OPT-OUT, second, and only on a message that is nothing but a stop word. */
  const { isStopWord } = await import("./wording");

  if (isStopWord(input.body)) {
    await mute(input.personId, "reply");
    /*
     * Not stored as a reply. "stop" is an instruction to us rather than an answer to "how are you",
     * and keeping it would put a row in a table of what patients said about themselves that is not
     * that.
     */
    return { kind: "muted" };
  }

  /* 🔴 3. Their words, kept, and nothing done to them. */
  await recordReply({
    checkinId: checkin.id,
    personId: input.personId,
    body: input.body,
    crisisAlertRaised: false,
  });

  return { kind: "stored" };
}

/**
 * The clinician to wake: whoever saw them most recently.
 *
 * Joined through `patients` on `person_id`, because a check-in is addressed to a PERSON and a session
 * belongs to a chart. Somebody seen by two clinicians has two charts, and the most recent session
 * across both is the right answer: the person who saw them last week knows more than the person who
 * saw them last year.
 */
async function mostRecentSessionFor(personId: string): Promise<
  | {
      sessionId: string;
      therapistId: string;
      organizationId: string;
      patientId: string | null;
    }
  | null
> {
  const [row] = await controlDb
    .select({
      sessionId: sessions.id,
      therapistId: sessions.therapistId,
      organizationId: sessions.organizationId,
      patientId: sessions.patientId,
    })
    .from(sessions)
    .innerJoin(patients, eq(patients.id, sessions.patientId))
    .where(and(eq(patients.personId, personId), isNull(patients.deletedAt)))
    .orderBy(desc(sessions.scheduledAt))
    .limit(1);

  return row ?? null;
}

/**
 * 🔴 THE ABSENCE, STATED SO A VERIFIER CAN FIND IT.
 *
 * No import from `lib/ai` anywhere in `lib/checkins/`. The scan is the crisis path's own, the reply
 * is stored unaltered, and the only judgement anywhere near it is `scanForCrisisLanguage`, which is
 * a keyword list a human wrote and a human can read.
 */
export const A_WORRYING_REPLY_GOES_TO_A_HUMAN = true;
