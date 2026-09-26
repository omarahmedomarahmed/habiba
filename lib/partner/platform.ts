import "server-only";

import { and, eq, isNull, sql } from "drizzle-orm";

import { controlDb } from "@/lib/db";
import { partnerClinicians, partnerSessions } from "@/lib/db/schema";
import { log } from "@/lib/logger";

import { boundaryAfterAnswer, coverageSentence, recordingFrom } from "./consent";
import { markStopped, mayRun } from "./usage";

/**
 * A session on somebody else's platform, from start to bill. PLAN.md 68.3 to 68.19.
 *
 * ## 🔴 ONE GATE, AND EVERY PIECE OF WORK GOES THROUGH IT
 *
 * `openSession` is the only function that creates a `partner_sessions` row, and it
 * asks two questions in a fixed order before it does:
 *
 *   1. **May we run at all?** (68.17) Their limit, which they set and we never
 *      exceed. A no here is recorded as a session we did NOT do, and it is never
 *      billed.
 *   2. **Did their patient consent?** (68.1, 68.2) A no here is a session we ran
 *      nothing on, which is different from a session we refused: their patient
 *      declined, which is their right and costs them nothing.
 *
 * Both answers come back as sentences rather than booleans, because 68.18 requires
 * the stop to be explicit on their therapist's screen: *a copilot that vanishes
 * without a word is read as our outage, and their therapist is mid-session.*
 *
 * ## 🔴 WHY THE ORDER IS LIMIT FIRST AND CONSENT SECOND
 *
 * A partner over their limit gets the same answer whether or not the patient
 * consented, and asking about consent first would mean reading a consent log for a
 * session we were never going to touch. More importantly it would let a partner
 * probe, one call at a time, which of their patients had consented, using a limit
 * they had deliberately exhausted. The cheaper question is also the safer one.
 */

export type OpenedSession = {
  id: string;
  /** Seconds into the session from which we may record. Null is not at all. */
  recordingFromSeconds: number | null;
  /** 🔴 68.18 — what their therapist's screen should say. Null means carry on. */
  stoppedReason: string | null;
  /** The sentence about coverage, in the words every surface uses. */
  coverage: string;
};

/**
 * 🔴 A REFERENCE BELONGS TO ONE ENVIRONMENT. A session row is unique on the
 * partner and its reference alone, so a sandbox key naming a live session's
 * reference would otherwise record consent on it, end it, or purge it. Every
 * route that writes by reference asks this first.
 */
export async function otherEnvironment(input: {
  partnerId: string;
  externalSessionRef: string;
  environment: string;
}): Promise<boolean> {
  const [row] = await controlDb
    .select({ environment: partnerSessions.environment })
    .from(partnerSessions)
    .where(
      and(
        eq(partnerSessions.partnerId, input.partnerId),
        eq(partnerSessions.externalSessionRef, input.externalSessionRef.slice(0, 200)),
      ),
    )
    .limit(1);
  return Boolean(row && row.environment !== input.environment);
}

export async function openSession(input: {
  partnerId: string;
  environment: "sandbox" | "live";
  externalSessionRef: string;
  externalSubjectRef: string;
  now?: Date;
}): Promise<OpenedSession> {
  const now = input.now ?? new Date();

  /*
   * 🔴 W2-X05: a session already billed is already paid for. A second consent call
   * on it (68.2, a yes ten minutes in) must not be refused by a limit its own first
   * audio used up, and the CHECK refusing a billed session a stop would throw.
   */
  const [existing] = await controlDb
    .select({
      billable: partnerSessions.billable,
      endedAt: partnerSessions.endedAt,
      recordingFromSeconds: partnerSessions.recordingFromSeconds,
    })
    .from(partnerSessions)
    .where(
      and(
        eq(partnerSessions.partnerId, input.partnerId),
        eq(partnerSessions.externalSessionRef, input.externalSessionRef.slice(0, 200)),
      ),
    )
    .limit(1);

  /* 1 — their own limit. */
  const permitted = existing?.billable
    ? ({ allowed: true } as const)
    : await mayRun({
        partnerId: input.partnerId,
        environment: input.environment,
        now,
      });

  const stoppedReason = permitted.allowed ? null : permitted.reason;
  if (!permitted.allowed) await markStopped(input.partnerId, now);

  /* 2 — their patient's answer. Not asked at all when we are stopped. */
  const consented = stoppedReason
    ? null
    : await recordingFrom({
        partnerId: input.partnerId,
        externalSessionRef: input.externalSessionRef,
      });

  /*
   * 🔴 Board 606: a withdrawal after the session ended keeps the boundary, so what
   * was already read, approved and delivered still answers. See `boundaryAfterAnswer`.
   */
  const fromSeconds = stoppedReason
    ? null
    : boundaryAfterAnswer({
        consented,
        previous: existing?.recordingFromSeconds ?? null,
        ended: Boolean(existing?.endedAt),
      });

  /*
   * 🔴 BILLABLE MEANS WE DID WORK, and opening a session is not work.
   *
   * A session we were stopped on is 68.17 in one column: *we did not do the session,
   * so we do not bill for it.* A session the patient declined is the same arithmetic
   * for a different reason. Charging for a declined session would also put a
   * financial reason behind a consent conversation, which is C209's rule reaching
   * across a commercial boundary.
   *
   * 🔴 W2-X05: and a consented session with no audio is the same case. It was
   * billed here, at consent, so a patient who said yes and then never started cost
   * the partner a session. It is billed at its first audio now (`billFirstAudio`),
   * which is the moment we start doing anything for it.
   */
  const billable = false;

  const [row] = await controlDb
    .insert(partnerSessions)
    .values({
      partnerId: input.partnerId,
      environment: input.environment,
      externalSessionRef: input.externalSessionRef.slice(0, 200),
      externalSubjectRef: input.externalSubjectRef.slice(0, 200),
      /* 🔴 C15: no `startedAt`. It is the first audio's, set by `billFirstAudio`. */
      recordingFromSeconds: fromSeconds,
      stoppedReason,
      billable,
    })
    .onConflictDoUpdate({
      target: [partnerSessions.partnerId, partnerSessions.externalSessionRef],
      /*
       * 🔴 THE CONFLICT PATH DOES NOT RE-BILL, and that is the important half.
       *
       * A partner retrying a request must not produce a second billable unit for one
       * session, and a network that delivered the first attempt after the retry must
       * not either. `billable` is left alone by this update: only the session's
       * first audio sets it (W2-X05).
       *
       * The consent boundary IS updated, because 68.2's case is exactly a second
       * call arriving ten minutes in with a yes on it.
       */
      set: {
        recordingFromSeconds: fromSeconds,
        stoppedReason,
        updatedAt: now,
      },
    })
    .returning({ id: partnerSessions.id, billable: partnerSessions.billable });

  if (stoppedReason) log.warn("partner session refused, their own limit");

  /*
   * 🔴 68.10 — UNCLAIMED PATIENTS ARE ALLOWED, AND THIS IS WHERE ONE COMES INTO BEING.
   *
   * > *A telehealth platform has a caseload before it has our accounts. Everything
   * > C127 and the claim flow already rule applies unchanged: the person can claim it
   * > and leave, including leaving them.*
   *
   * `upsertSubject` with `personId: null` is a placeholder: the partner's own
   * reference, recorded, with nobody behind it. It is what a person later claims, by
   * the same act a patient claims a therapist-created record, and `unlinkPartner`
   * (sprint 59) is how they leave.
   *
   * 🔴 LIVE ONLY, and the reason is 68.22. A sandbox integration's references are
   * test data; a claimable row for one would let somebody claim a subject that was
   * never a person. Nothing in the sandbox flow reads this row, so there is nothing
   * to build against and nothing lost.
   */
  if (input.environment === "live") {
    const { upsertSubject } = await import("./api");
    await upsertSubject({
      partnerId: input.partnerId,
      externalRef: input.externalSubjectRef,
      personId: null,
    });
  }

  return {
    id: row?.id ?? "",
    recordingFromSeconds: fromSeconds,
    stoppedReason,
    coverage: coverageSentence(fromSeconds),
  };
}

/**
 * 🔴 THE SESSION, FOR EVERY OTHER ROUTE THAT NEEDS TO KNOW WHETHER IT MAY ANSWER.
 *
 * The transcript, the note, the summary and the copilot all ask this and all refuse
 * on the same two conditions, in one place, rather than four routes each remembering
 * to check a limit and a consent log.
 */
export type PartnerSessionRow = {
  id: string;
  environment: string;
  recordingFromSeconds: number | null;
  stoppedReason: string | null;
  personId: string | null;
  /** W2-X02: when their platform said the session was over. Null while it runs. */
  endedAt: Date | null;
  /** W2-X05: whether its first audio has been billed. */
  billable: boolean;
};

/*
 * 🔴 NOT EXPORTED. `mayAnswer` is the public surface, and it is the one that applies
 * the two refusals. A function that hands back a session without asking about the
 * limit or the consent log is the function a fifth route would use by accident.
 */
async function sessionFor(input: {
  partnerId: string;
  externalSessionRef: string;
  environment: string;
}): Promise<PartnerSessionRow | null> {
  const [row] = await controlDb
    .select({
      id: partnerSessions.id,
      environment: partnerSessions.environment,
      recordingFromSeconds: partnerSessions.recordingFromSeconds,
      stoppedReason: partnerSessions.stoppedReason,
      personId: partnerSessions.personId,
      endedAt: partnerSessions.endedAt,
      billable: partnerSessions.billable,
    })
    .from(partnerSessions)
    .where(
      and(
        eq(partnerSessions.partnerId, input.partnerId),
        eq(partnerSessions.externalSessionRef, input.externalSessionRef),
        /*
         * 🔴 A key reaches only its own environment's sessions. A sandbox key
         * is self-serve, unlimited and never billed; answering it about a
         * live session gave real notes away free to a developer's laptop.
         */
        eq(partnerSessions.environment, input.environment as "sandbox" | "live"),
      ),
    )
    .limit(1);

  return row ?? null;
}

/**
 * 🔴 68.1 — WHAT EVERY CONTENT ROUTE ASKS BEFORE IT ANSWERS.
 *
 * > *Without it we record nothing.*
 *
 * One function, one refusal sentence per reason, so the transcript route and the note
 * route cannot drift into refusing for different reasons or, worse, one of them
 * forgetting. Returns the session when the answer is yes, so the caller has what it
 * needs and no reason to re-query.
 */
export async function mayAnswer(input: {
  partnerId: string;
  externalSessionRef: string;
  /** The calling key's environment. Required, so no route can forget it. */
  environment: string;
}): Promise<
  | { ok: true; session: PartnerSessionRow }
  | { ok: false; status: 403 | 404 | 409; error: string }
> {
  const session = await sessionFor(input);

  if (!session) {
    return { ok: false, status: 404, error: "We have no session with that reference." };
  }

  if (session.stoppedReason) {
    /*
     * 🔴 409 AND NOT 402 OR 429.
     *
     * 402 says "pay us", which is wrong: they set this limit and we are honouring
     * it. 429 says "slow down and retry", which would make an integration retry
     * forever. 409 says the request conflicts with the state of the account, which
     * is exactly true, and the sentence names the one action that changes it.
     */
    return { ok: false, status: 409, error: session.stoppedReason };
  }

  if (session.recordingFromSeconds === null) {
    return {
      ok: false,
      status: 403,
      error:
        "This patient has not consented to this session being recorded, so we have nothing for it. They can still consent during the session, and we will start from then.",
    };
  }

  return { ok: true, session };
}

/**
 * 🔴 Board 606: MAY THIS SESSION HAVE ANYTHING NEW WRITTEN FROM IT?
 *
 * `mayAnswer` says whether what we hold may be read. After a withdrawal on an ended
 * session it still says yes, because the record stays. New work (a draft, a patient
 * summary, a delivery) also needs the patient's answer to be yes NOW.
 */
export async function mayWriteNew(input: {
  partnerId: string;
  externalSessionRef: string;
}): Promise<boolean> {
  return (await recordingFrom(input)) !== null;
}

/**
 * 🔴 W2-X05: MAY THIS SESSION'S FIRST AUDIO BE BILLED? Asked before it is transcribed.
 *
 * Billing moved from consent to the first audio, so the limit is asked here too: a
 * session opened under the limit whose audio arrives after other sessions used the
 * rest of it would otherwise take the month past the number the partner set. At the
 * limit the session is stopped exactly as `openSession` stops one, with the same
 * sentence, and nothing is transcribed. A session already billed, or a sandbox one,
 * passes without asking.
 */
export async function mayBillFirstAudio(input: {
  partnerId: string;
  session: PartnerSessionRow;
  now?: Date;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  if (input.session.billable || input.session.environment !== "live") return { ok: true };

  const now = input.now ?? new Date();
  const permitted = await mayRun({ partnerId: input.partnerId, environment: "live", now });
  if (permitted.allowed) return { ok: true };

  await markStopped(input.partnerId, now);
  await controlDb
    .update(partnerSessions)
    .set({ stoppedReason: permitted.reason, updatedAt: now })
    .where(and(eq(partnerSessions.id, input.session.id), eq(partnerSessions.billable, false)));
  return { ok: false, error: permitted.reason };
}

/**
 * 🔴 W2-X05: THE SESSION IS BILLED, ONCE, when audio from it has been transcribed.
 *
 * Conditional on `billable = false`, so a second piece of audio, a retry or two
 * pieces racing each other bill it once. Live only and never a stopped session:
 * the two CHECKs on the table say the same, and this WHERE never asks them to.
 *
 * 🔴 C15: and it stamps `startedAt`, in the same UPDATE, so the month a session
 * is billed in is the month it became billable. The bill counted by `createdAt`,
 * so a session opened on the 31st and first heard after that month was billed
 * belonged to a month already closed, and was never billed at all.
 */
export async function billFirstAudio(sessionId: string, now = new Date()): Promise<void> {
  await controlDb
    .update(partnerSessions)
    .set({ billable: true, startedAt: now, updatedAt: now })
    .where(
      and(
        eq(partnerSessions.id, sessionId),
        eq(partnerSessions.billable, false),
        eq(partnerSessions.environment, "live"),
        isNull(partnerSessions.stoppedReason),
      ),
    );
}

/**
 * 🔴 W2-X02: THEIR PLATFORM SAYS THE SESSION IS OVER, AND ONLY THEN IS IT MATERIAL.
 *
 * The copilot and the memory read ENDED sessions (C211's bound: a live transcript
 * is still arriving). Nothing wrote `ended_at`, so both answered "no completed
 * sessions" for every patient on every platform. This is the one writer.
 *
 * Idempotent: a second call keeps the first time, because a retry must not move
 * the moment a session ended. No consent is asked: ending opens nothing, and the
 * readers apply consent and revocation themselves (W1-18). Audio after this is
 * refused, so the material the copilot reads cannot grow behind it.
 */
export async function endSession(input: {
  partnerId: string;
  externalSessionRef: string;
  environment: string;
  now?: Date;
}): Promise<{ endedAt: Date } | null> {
  const now = input.now ?? new Date();

  const [row] = await controlDb
    .update(partnerSessions)
    .set({ endedAt: sql`COALESCE(${partnerSessions.endedAt}, ${now.toISOString()}::timestamptz)`, updatedAt: now })
    .where(
      and(
        eq(partnerSessions.partnerId, input.partnerId),
        eq(partnerSessions.externalSessionRef, input.externalSessionRef),
        eq(partnerSessions.environment, input.environment as "sandbox" | "live"),
      ),
    )
    .returning({ endedAt: partnerSessions.endedAt });

  return row?.endedAt ? { endedAt: row.endedAt } : null;
}

/**
 * 🔴 68.12 / 68.13 — A CLINICIAN ON THEIR PLATFORM TURNS IT ON.
 *
 * *"For therapists only" is a label, not a filter we enforce.* There is no profession
 * here and no check that reads one: a general telehealth platform has GPs and physios
 * on it, and an opt-in that says what it is for lets the right people find it without
 * us deciding who is a therapist.
 *
 * Enabling stamps a time, because 68.13 makes sharing an act with a name rather than
 * a default, and an act with no time on it is one nobody can place.
 */
export async function enableClinician(input: {
  partnerId: string;
  externalClinicianRef: string;
  enabled: boolean;
  now?: Date;
}): Promise<{ ok: true }> {
  const now = input.now ?? new Date();

  await controlDb
    .insert(partnerClinicians)
    .values({
      partnerId: input.partnerId,
      externalClinicianRef: input.externalClinicianRef.slice(0, 200),
      enabledAt: input.enabled ? now : null,
    })
    .onConflictDoUpdate({
      target: [partnerClinicians.partnerId, partnerClinicians.externalClinicianRef],
      set: { enabledAt: input.enabled ? now : null, updatedAt: now },
    });

  return { ok: true };
}

/** Whether this clinician turned it on. Asked by the copilot route. */
export async function clinicianEnabled(input: {
  partnerId: string;
  externalClinicianRef: string;
}): Promise<boolean> {
  const [row] = await controlDb
    .select({ enabledAt: partnerClinicians.enabledAt })
    .from(partnerClinicians)
    .where(
      and(
        eq(partnerClinicians.partnerId, input.partnerId),
        eq(partnerClinicians.externalClinicianRef, input.externalClinicianRef),
      ),
    )
    .limit(1);

  return Boolean(row?.enabledAt);
}
