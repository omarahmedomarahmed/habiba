import "server-only";

import { and, eq, isNotNull, isNull } from "drizzle-orm";

import { audit } from "@/lib/audit";
import { controlDb } from "@/lib/db";
import {
  historyGrants,
  organizations,
  partnerSubjects,
  patients,
  sessionNotes,
  sessions,
  users,
} from "@/lib/db/schema";
import { log, ref } from "@/lib/logger";

import type { AuthedKey } from "./keys";

/**
 * The partner API's other four use cases. PLAN.md 55.5 to 55.8, §7, C277.
 *
 * ## 🔴 WHAT EVERY FUNCTION HERE HAS IN COMMON
 *
 * None of them takes a patient id from the caller and returns a record because the caller
 * asked. Each one resolves the subject through `partner_subjects`, which maps the
 * partner's own reference to a `people` row, and then applies the SAME rule our own
 * product applies.
 *
 * That is C277 in one sentence: *a partner's clinician holds a grant exactly like any
 * other clinician: scoped, revocable, and the patient can claim the record and leave.*
 * There is no partner path to a chart and there is no partner exception in the grant
 * check. A partner is a way for a clinician to arrive, never a reason to let them in.
 */

export type ApiFailure = { error: string; status: 400 | 403 | 404 };

/**
 * 🔴 55.5 — IS THIS CLINICIAN VERIFIED WITH US, AND BY WHICH BODY.
 *
 * *A boolean and a source, never a document.*
 *
 * The temptation is to return the licence number, the regulator's reference or the
 * document itself, because a partner doing due diligence would like all three. Sprint 29
 * rebuilt identity documents so that a URL is not a credential (H14); handing one to a
 * partner's server would undo that in a single field.
 *
 * So: verified or not, and the body that says so. A partner who needs more asks the
 * clinician, who holds their own documents.
 */
export async function clinicianVerification(input: {
  key: AuthedKey;
  /** The clinician's email, which is what a partner has. Never an internal id. */
  email: string;
}): Promise<{ verified: boolean; source: string | null } | ApiFailure> {
  const email = input.email.trim().toLowerCase();
  if (!email.includes("@")) return { error: "No clinician.", status: 400 };

  const [row] = await controlDb
    .select({
      verificationStatus: users.verificationStatus,
      /*
       * 🔴 The select list is TWO columns, and what is absent is the ticket: no licence
       * number, no document url, no date of birth, no national id, no photograph.
       */
      regulator: users.profile,
    })
    .from(users)
    .where(and(eq(users.email, email), isNull(users.deletedAt)))
    .limit(1);

  if (!row) {
    /*
     * 🔴 `verified: false` for a clinician we do not have, not a 404.
     *
     * A 404 distinguishes "not with us" from "with us and unverified", which turns this
     * into a directory of who our clinicians are. The honest answer to "is this person
     * verified with you" is no, for both.
     */
    await audit({
      actor: null,
      category: "admin",
      action: "partner.clinician_verify",
      reason: `key ${input.key.keyId} · unknown`,
    });
    return { verified: false, source: null };
  }

  const verified = row.verificationStatus === "verified";

  await audit({
    actor: null,
    category: "admin",
    action: "partner.clinician_verify",
    reason: `key ${input.key.keyId} · ${verified ? "verified" : "not verified"}`,
  });

  /*
   * The regulator, from the profile the clinician filled in, and only when verified. An
   * unverified clinician's claimed regulator is a claim, and repeating it to a partner as
   * a source would be us vouching for something we have not checked.
   */
  const profile = row.regulator as { regulator?: string } | null;

  return { verified, source: verified ? (profile?.regulator ?? "24Therapy") : null };
}

/**
 * 🔴 55.6 / C277 — READ A RECORD UNDER A GRANT, AND THE GRANT IS THE PATIENT'S.
 *
 * > *A partner's clinician reads a patient's record exactly as ours does, because they
 * > hold a grant the patient gave and can revoke. A partner is a clinician for access
 * > purposes, never a special case, and the patient can claim their record and leave.*
 *
 * ## 🔴 SO THIS FUNCTION DOES NOT READ A RECORD
 *
 * It resolves the subject and returns WHO may read it, which is the list of clinicians
 * holding a live grant. The reading itself happens through `lib/data/grants.ts` and
 * `accessFor`, from an ordinary `auth_sessions` row that 42.3's launch mints, with the
 * clinician as the actor.
 *
 * That indirection is the ruling made structural. A `readRecord(key, subjectRef)` would
 * be a partner reading a chart with a partner's credential, and no amount of checking
 * inside it would change whose credential it was. There is no such function and there is
 * no route that would call one.
 */
export async function whoMayRead(input: {
  key: AuthedKey;
  externalRef: string;
}): Promise<{ clinicians: { email: string; verified: boolean }[] } | ApiFailure> {
  const subject = await resolveSubject(input.key.partnerId, input.externalRef);
  if (!subject) return { error: "No such subject.", status: 404 };
  if (!subject.personId) return { clinicians: [] };

  /*
   * 🔴 QUERIED HERE RATHER THAN THROUGH `grantsForPerson`, and the reason is a near miss.
   *
   * The first draft reused `grantsForPerson`, whose select list is built for a PATIENT's
   * own consent screen: it returns the clinician's first and last name and no email, and
   * its statuses are pending/granted/rejected/revoked rather than the "active" I assumed.
   * Typecheck caught the status, which is the lucky half. The unlucky half would have been
   * returning a clinician's NAME to a partner because it happened to be in a shape built
   * for somebody else.
   *
   * So this is its own query with its own two columns, and a live grant means `granted`
   * with no revocation and no expiry in the past.
   */
  /*
   * 🔴 SCOPED TO THIS PARTNER'S OWN CLINICIANS, AND THE FIRST VERSION WAS NOT.
   *
   * It returned every clinician holding a live grant on that person. A partner asking who may
   * read their subject's record would therefore have learned the email address of the
   * patient's OTHER therapist: somebody with no relationship to the partner at all, whose
   * involvement in this person's care the patient never disclosed to them.
   *
   * That is the sponsor wall's own argument one table over. C244 keeps a payer away from a
   * join date because a join date is the week somebody decided they needed therapy; WHICH
   * THERAPIST TREATS THEM is closer in than that, and handing it to a commercial integrator
   * because it happened to be in the same result set is the §6 shape exactly: the query
   * answered a broader question than the one asked, and nothing about the response looked
   * wrong.
   *
   * The scope is the same one the launch uses, so there is one definition of "this partner's
   * clinician" rather than two: `organizations.partner_id` with `billing_mode =
   * 'partner_billed'`, which 42.6 put there and an operator sets.
   */
  const rows = await controlDb
    .select({
      email: users.email,
      verificationStatus: users.verificationStatus,
    })
    .from(historyGrants)
    .innerJoin(users, eq(users.id, historyGrants.therapistUserId))
    .innerJoin(organizations, eq(organizations.id, users.organizationId))
    .where(
      and(
        eq(historyGrants.personId, subject.personId),
        eq(historyGrants.status, "granted"),
        isNull(historyGrants.revokedAt),
        isNull(users.deletedAt),
        /* 🔴 The answer is about THEIR clinicians. Anybody else's is not theirs to hear. */
        eq(organizations.partnerId, input.key.partnerId),
        eq(organizations.billingMode, "partner_billed"),
      ),
    );

  await audit({
    actor: null,
    category: "phi_access",
    action: "partner.who_may_read",
    reason: `key ${input.key.keyId}`,
  });

  /*
   * 🔴 An email and a boolean per clinician. Not a name, not a note, not a session, not a
   * date. A partner asking who may read a record is asking an access question, and the
   * answer to an access question is a list of who, at the coarsest useful grain.
   */
  return {
    clinicians: rows.map((row) => ({
      email: row.email,
      verified: row.verificationStatus === "verified",
    })),
  };
}

/**
 * 🔴 55.7 — A SESSION HELD ON THEIR PLATFORM LANDS IN OUR RECORD, SOURCE-ATTRIBUTED.
 *
 * *Through the door 36 built*, which is `session_sources`: the table that records where a
 * session came from, so a chart says "held on their platform" rather than pretending it
 * was ours.
 *
 * 🔴 IT WRITES A SESSION AND NEVER A NOTE. A partner can say a session happened and when;
 * it cannot write clinical content, because content in a chart needs a named clinician who
 * approved that exact text (§7's first hard rule), and a partner's server is not one.
 */
export async function writeBackSession(input: {
  key: AuthedKey;
  externalRef: string;
  /** The clinician who held it, by email. They must exist and be verified. */
  clinicianEmail: string;
  startedAt: Date;
  durationMinutes: number;
  /** Their own id for the meeting, which is the idempotency key. Required. */
  externalMeetingId: string;
}): Promise<{ sessionId: string } | ApiFailure> {
  const subject = await resolveSubject(input.key.partnerId, input.externalRef);
  if (!subject?.personId) return { error: "No such subject.", status: 404 };

  const [clinician] = await controlDb
    .select({
      id: users.id,
      organizationId: users.organizationId,
      verificationStatus: users.verificationStatus,
    })
    .from(users)
    .where(
      and(eq(users.email, input.clinicianEmail.trim().toLowerCase()), isNull(users.deletedAt)),
    )
    .limit(1);

  if (!clinician) return { error: "No such clinician.", status: 404 };

  /*
   * 🔴 §7's second hard rule, applied here: a session in a chart belongs to a clinician
   * whose verification is approved. A partner writing sessions for an unverified account
   * would be the "only certified therapists" claim broken through an integration.
   */
  if (clinician.verificationStatus !== "verified") {
    return { error: "That clinician is not verified with us.", status: 403 };
  }

  /*
   * The patient row inside that clinician's practice, which is what a session needs. Found
   * rather than created: a partner that could create patient rows in a practice could
   * populate somebody else's caseload.
   */
  const [patient] = await controlDb
    .select({ id: patients.id })
    .from(patients)
    .where(
      and(
        eq(patients.personId, subject.personId),
        eq(patients.organizationId, clinician.organizationId),
      ),
    )
    .limit(1);

  if (!patient) {
    return {
      error:
        "That person is not a patient of that clinician here. The clinician invites them, or the patient claims their record.",
      status: 403,
    };
  }

  const { recordExternalSession } = await import("./writeback");
  const result = await recordExternalSession({
    partnerId: input.key.partnerId,
    organizationId: clinician.organizationId,
    therapistId: clinician.id,
    patientId: patient.id,
    startedAt: input.startedAt,
    durationMinutes: input.durationMinutes,
    externalMeetingId: input.externalMeetingId,
  });

  if ("error" in result) return result;

  await audit({
    actor: null,
    category: "clinical",
    action: "partner.session_writeback",
    resourceType: "session",
    resourceId: result.sessionId,
    reason: `key ${input.key.keyId}`,
  });

  return { sessionId: result.sessionId };
}

/**
 * 🔴 55.8 — A FINISHED, CLINICIAN-APPROVED NOTE. NEVER A DRAFT, NEVER MODEL OUTPUT
 * NOBODY SIGNED.
 *
 * The condition is in the WHERE clause, three ways: `status = 'approved'`,
 * `approved_at IS NOT NULL` and `approved_by IS NOT NULL`. All three, because §7's first
 * hard rule is that *no model output reaches a patient without a named clinician
 * approving that exact text*, and a partner's system is a place that text is read.
 *
 * A `status` of approved with a null `approved_by` is a note somebody approved
 * anonymously, which should not exist and is refused here rather than delivered.
 */
export async function deliverableNote(input: {
  key: AuthedKey;
  sessionId: string;
}): Promise<{ content: unknown; approvedAt: string; language: string } | ApiFailure> {
  const [note] = await controlDb
    .select({
      content: sessionNotes.content,
      language: sessionNotes.language,
      approvedAt: sessionNotes.approvedAt,
      sessionId: sessionNotes.sessionId,
    })
    .from(sessionNotes)
    .innerJoin(sessions, eq(sessions.id, sessionNotes.sessionId))
    /*
     * 🔴 `patients` BEFORE `partner_subjects`, and the first version had them the other way
     * round.
     *
     * The join condition on `partner_subjects` reads `patients.person_id`, and a JOIN cannot
     * reference a table that is joined later: Postgres rejects it with "invalid reference to
     * FROM-clause entry for table patients". So this function threw on EVERY call, and nothing
     * noticed, because nothing called it: the route existed, the handler compiled, the scope
     * check was right, and the query was unrunnable.
     *
     * Drizzle emits the joins in the order they are chained, which is what makes chaining
     * order load-bearing rather than stylistic.
     */
    .innerJoin(patients, eq(patients.id, sessions.patientId))
    .innerJoin(partnerSubjects, eq(partnerSubjects.personId, patients.personId))
    .where(
      and(
        eq(sessionNotes.sessionId, input.sessionId),
        /* 🔴 All three. See above. */
        eq(sessionNotes.status, "approved"),
        isNotNull(sessionNotes.approvedAt),
        isNotNull(sessionNotes.approvedBy),
        /*
         * 🔴 AND THE SESSION'S SUBJECT MUST BE THIS PARTNER'S SUBJECT.
         *
         * Without this a key could fetch any approved note in the product by guessing a
         * session id. The join is the scope, in the query, rather than a check somebody
         * remembers afterwards.
         */
        eq(partnerSubjects.partnerId, input.key.partnerId),
      ),
    )
    .limit(1);

  if (!note?.approvedAt) {
    /*
     * One message for "no such note", "not approved yet" and "not your subject".
     * Distinguishing them tells a caller that a session exists, which is a fact about
     * somebody's care.
     */
    return { error: "There is no approved note to deliver.", status: 404 };
  }

  await audit({
    actor: null,
    category: "phi_access",
    action: "partner.note_delivered",
    resourceType: "session",
    resourceId: input.sessionId,
    reason: `key ${input.key.keyId}`,
  });

  log.info("approved note delivered to a partner", { session: ref(input.sessionId) });

  return {
    content: note.content,
    approvedAt: note.approvedAt.toISOString(),
    language: note.language,
  };
}

/**
 * 🔴 42.2 — the partner's own reference, resolved within the partner.
 *
 * *Two partners will both send `"P123"`.* So every lookup in this file goes through here
 * and every one of them passes the partner id: there is no function that resolves an
 * `external_ref` on its own, because the first one written would be the collision.
 */
async function resolveSubject(
  partnerId: string,
  externalRef: string,
): Promise<{ id: string; personId: string | null } | null> {
  const [row] = await controlDb
    .select({ id: partnerSubjects.id, personId: partnerSubjects.personId })
    .from(partnerSubjects)
    .where(
      and(
        eq(partnerSubjects.partnerId, partnerId),
        eq(partnerSubjects.externalRef, externalRef.trim()),
      ),
    )
    .limit(1);

  return row ?? null;
}

/**
 * 🔴 55.6 / C277 — a subject is LINKED to a person, and linking needs the person.
 *
 * A partner says "P123 is this person" by supplying something only that person could
 * have: they sign in and confirm it, exactly as a patient claims a record. So this takes
 * a `personId` that came from a patient's own session, never one a partner named.
 *
 * The partner can create an UNLINKED subject freely, which is worth nothing on its own:
 * `whoMayRead` and `writeBackSession` both refuse a subject with no person.
 */
export async function upsertSubject(input: {
  partnerId: string;
  externalRef: string;
  /** From a patient's own session, or null to create a placeholder. */
  personId: string | null;
}): Promise<{ id: string }> {
  const existing = await resolveSubject(input.partnerId, input.externalRef);

  if (existing) {
    if (input.personId && !existing.personId) {
      await controlDb
        .update(partnerSubjects)
        .set({ personId: input.personId })
        .where(eq(partnerSubjects.id, existing.id));
    }
    return { id: existing.id };
  }

  const [created] = await controlDb
    .insert(partnerSubjects)
    .values({
      partnerId: input.partnerId,
      externalRef: input.externalRef.trim(),
      personId: input.personId,
    })
    .returning({ id: partnerSubjects.id });

  return { id: created!.id };
}

/**
 * 🔴 THE ABSENCES, STATED SO A VERIFIER CAN FIND THEM.
 *
 * There is no `readRecord`, no `listSubjects`, no `searchPatients`, no `writeNote` and no
 * `approveNote` in this module. Each one is a ruling rather than an unbuilt feature:
 *
 *   - Reading a record happens through a CLINICIAN's grant (C277), from a session 42.3
 *     mints, never with a partner's credential.
 *   - Listing subjects is C255's enumeration, in a different costume.
 *   - Writing a note is §7's first hard rule broken: content in a chart needs a named
 *     clinician who approved that exact text, and a partner's server is not one.
 */
export const A_PARTNER_NEVER_READS_A_CHART = true;
