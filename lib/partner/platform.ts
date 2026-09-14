import "server-only";

import { and, eq } from "drizzle-orm";

import { controlDb } from "@/lib/db";
import { partnerClinicians, partnerSessions } from "@/lib/db/schema";
import { log } from "@/lib/logger";

import { coverageSentence, recordingFrom } from "./consent";
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

export async function openSession(input: {
  partnerId: string;
  environment: "sandbox" | "live";
  externalSessionRef: string;
  externalSubjectRef: string;
  now?: Date;
}): Promise<OpenedSession> {
  const now = input.now ?? new Date();

  /* 1 — their own limit. */
  const permitted = await mayRun({
    partnerId: input.partnerId,
    environment: input.environment,
    now,
  });

  const stoppedReason = permitted.allowed ? null : permitted.reason;
  if (!permitted.allowed) await markStopped(input.partnerId, now);

  /* 2 — their patient's answer. Not asked at all when we are stopped. */
  const fromSeconds = stoppedReason
    ? null
    : await recordingFrom({
        partnerId: input.partnerId,
        externalSessionRef: input.externalSessionRef,
      });

  /*
   * 🔴 BILLABLE MEANS WE DID WORK, and both refusals make it false.
   *
   * A session we were stopped on is 68.17 in one column: *we did not do the session,
   * so we do not bill for it.* A session the patient declined is the same arithmetic
   * for a different reason: there was no transcript, no note and no summary, so
   * there is nothing to charge for. Charging for a declined session would also put a
   * financial reason behind a consent conversation, which is C209's rule reaching
   * across a commercial boundary.
   */
  const billable = input.environment === "live" && !stoppedReason && fromSeconds !== null;

  const [row] = await controlDb
    .insert(partnerSessions)
    .values({
      partnerId: input.partnerId,
      environment: input.environment,
      externalSessionRef: input.externalSessionRef.slice(0, 200),
      externalSubjectRef: input.externalSubjectRef.slice(0, 200),
      startedAt: now,
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
       * not either. `billable` is left alone by this update: whatever the first
       * successful open decided is what the month is charged.
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
};

/*
 * 🔴 NOT EXPORTED. `mayAnswer` is the public surface, and it is the one that applies
 * the two refusals. A function that hands back a session without asking about the
 * limit or the consent log is the function a fifth route would use by accident.
 */
async function sessionFor(input: {
  partnerId: string;
  externalSessionRef: string;
}): Promise<PartnerSessionRow | null> {
  const [row] = await controlDb
    .select({
      id: partnerSessions.id,
      environment: partnerSessions.environment,
      recordingFromSeconds: partnerSessions.recordingFromSeconds,
      stoppedReason: partnerSessions.stoppedReason,
      personId: partnerSessions.personId,
    })
    .from(partnerSessions)
    .where(
      and(
        eq(partnerSessions.partnerId, input.partnerId),
        eq(partnerSessions.externalSessionRef, input.externalSessionRef),
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
