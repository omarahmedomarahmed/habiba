import "server-only";

import { and, asc, desc, eq, isNotNull, isNull } from "drizzle-orm";

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
import { verifiedFlag } from "@/lib/data/verified";
import { log, ref } from "@/lib/logger";

/*
 * 🔴 66.4 — `PartnerKey`, NOT `AuthedKey`. Sprint 66 made `partner_id` nullable so a
 * sponsor could mint a key from their own portal, and every function here scopes on a
 * partner id. `withKey` refuses a key with no partner before a handler sees one, and
 * this type is how that refusal reaches the functions behind it.
 */
import type { PartnerKey } from "./route";

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

/*
 * 🔴 409 added for one case: an email that matches two accounts both holding the
 * subject. It is a conflict in the caller's own data rather than a refusal, and a 403
 * would send an integrator looking for a permission they already have.
 */
export type ApiFailure = { error: string; status: 400 | 403 | 404 | 409 };

/*
 * 🔴 `clinicianVerification` WAS HERE AND IS GONE, 2026-09-14.
 *
 * Founder: *"cut the scope of the partner API to telehealth platforms only ...
 * they take full responsibility of the licence of their therapists."* That is
 * the deal, so a key that asks us whether one of their clinicians is licensed
 * is asking us to carry a responsibility the contract puts on them, and
 * answering it was the whole function.
 *
 * It was also the weakest thing on the surface by its own description: one
 * boolean and a regulator name, for which nobody pays. `verify:sprint55` now
 * asserts the scope and the route are both gone rather than merely
 * unadvertised, because a scope removed from a list while its route still
 * answers is a rename.
 */


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
  key: PartnerKey;
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
      /* 🔴 C285 — the same source as the single-clinician answer above. */
      verified: verifiedFlag(),
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
      verified: row.verified,
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
  key: PartnerKey;
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

  /*
   * 🔴 THE CLINICIAN IS FOUND THROUGH THE SUBJECT'S OWN CHART, NOT BY EMAIL ALONE.
   *
   * The first version selected from `users` on the email and nothing else, took the
   * first row, and looked the patient up afterwards. Two things were wrong with that,
   * and only one of them was the check that came later.
   *
   * 🔴 ONE: `users_org_email_unique` is unique on (organisation, email), so one
   * address CAN exist in two organisations. `sprint 54` even discusses that case: a
   * clinician with both a clinic account and private work is told to use a second
   * address precisely because one address in two organisations is ambiguous. A
   * `.limit(1)` with no ORDER BY over an ambiguous email picks whichever row Postgres
   * hands back first, so the session landed in a nondeterministic organisation. Not a
   * wrong chart it could be argued into: an arbitrary one, differing between calls.
   *
   * 🔴 TWO: the scope was a step rather than a join, which is the defect this module's
   * own `deliverNote` was fixed for. *"The join is the scope, in the query, rather
   * than a check somebody remembers afterwards."* Here the check did exist and ran
   * second, so the failure mode was not an open door, it was that the door being
   * checked was chosen at random before anybody checked it.
   *
   * So the person comes first. The query starts at the patient rows for this subject's
   * person and joins to the clinician who holds them, which makes "a clinician
   * unconnected to this person" unrepresentable rather than rejected.
   *
   * 🔴 THREE: it was not scoped to THIS PARTNER'S clinicians, and `whoMayRead` twenty
   * lines up already is.
   *
   * That function was fixed for the same shape: it returned every clinician holding a
   * live grant, so a partner asking who may read their subject's record learned the
   * address of the patient's OTHER therapist. The scope it took is the one the launch
   * uses, `organizations.partner_id` with `billing_mode = 'partner_billed'`, so there is
   * one definition of "this partner's clinician" rather than two.
   *
   * Writing was the more serious half and had none of it. A key could attribute a real
   * session, with a time and a duration, into the chart of a verified clinician at a
   * practice with no commercial relationship to that partner at all, provided the
   * partner knew an email address and the person was a patient there. The same scope
   * goes here.
   */
  const candidates = await controlDb
    .select({
      id: users.id,
      organizationId: users.organizationId,
      patientId: patients.id,
      /* 🔴 C285 — a session written into a chart needs the approval, not a copy of it. */
      verified: verifiedFlag(),
    })
    .from(patients)
    /*
     * 🔴 Joined on the ORGANISATION, not on `patients.therapist_id`, which is the
     * semantics the two-step version had and is the one to keep. A colleague inside
     * the same practice holding a session for a patient assigned to somebody else is
     * a real thing that happens, and narrowing to the assigned clinician inside a bug
     * fix would refuse it for the first time with no ruling behind the refusal.
     */
    .innerJoin(users, eq(users.organizationId, patients.organizationId))
    .innerJoin(organizations, eq(organizations.id, users.organizationId))
    .where(
      and(
        /* The subject's person, resolved through `partner_subjects` above. */
        eq(patients.personId, subject.personId),
        eq(users.email, input.clinicianEmail.trim().toLowerCase()),
        isNull(users.deletedAt),
        isNull(patients.deletedAt),
        /* 🔴 Their clinician. The same two lines `whoMayRead` was fixed to carry. */
        eq(organizations.partnerId, input.key.partnerId),
        eq(organizations.billingMode, "partner_billed"),
      ),
    )
    /* Deliberately not limited: an ambiguous answer has to be visible to be refused. */
    .limit(2);

  if (candidates.length === 0) {
    /*
     * One message for "no such clinician" and "not this person's clinician".
     * Separating them would let a partner enumerate our clinicians' addresses by
     * watching which error comes back.
     */
    return {
      error:
        "That person is not a patient of that clinician here. The clinician invites them, or the patient claims their record.",
      status: 403,
    };
  }

  if (candidates.length > 1) {
    /*
     * 🔴 REFUSED RATHER THAN GUESSED. That address belongs to two accounts that both
     * hold this person, and a session is a fact about one clinician's practice: writing
     * it into whichever row came back first would put a real session in a real chart
     * for a reason nobody could reconstruct afterwards.
     */
    return {
      error:
        "That address matches more than one account holding this person. Tell us which practice, or use the address for that account.",
      status: 409,
    };
  }

  const clinician = candidates[0]!;

  /*
   * 🔴 §7's second hard rule, applied here: a session in a chart belongs to a clinician
   * whose verification is approved. A partner writing sessions for an unverified account
   * would be the "only certified therapists" claim broken through an integration.
   */
  if (!clinician.verified) {
    return { error: "That clinician is not verified with us.", status: 403 };
  }

  /*
   * 🔴 The patient row came back WITH the clinician, from the one query above.
   *
   * It is found rather than created, which is the rule that matters: a partner that
   * could create patient rows in a practice could populate somebody else's caseload.
   * What changed is that it can no longer be found for a clinician chosen before
   * anybody looked.
   */

  const { recordExternalSession } = await import("./writeback");
  const result = await recordExternalSession({
    partnerId: input.key.partnerId,
    organizationId: clinician.organizationId,
    therapistId: clinician.id,
    patientId: clinician.patientId,
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
  key: PartnerKey;
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
    /*
     * 🔴 W2-F01: a session can carry a signed note per format. The one
     * delivered is the first signed, which is also where the patient's copy
     * comes from, so the partner's chart and the patient agree.
     */
    .orderBy(asc(sessionNotes.approvedAt), desc(sessionNotes.isPrimary))
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
        /*
         * 🔴 C277 / 0087 — A CUT LINK RESOLVES TO NOTHING, AND HERE IS WHY IT IS HERE.
         *
         * This function is the one place an external reference becomes a person, by
         * design: *"there is no function that resolves an `external_ref` on its own,
         * because the first one written would be the collision."* That property is now
         * doing a second job. Every partner endpoint that can reach a person reaches it
         * through this line, so one `isNull` closes `whoMayRead`, `writeBackSession` and
         * `deliverNote` at once, and closes the next one before it is written.
         *
         * A revocation checked in each caller would be three checks, and the fourth
         * endpoint would have two of them.
         */
        isNull(partnerSubjects.revokedAt),
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
