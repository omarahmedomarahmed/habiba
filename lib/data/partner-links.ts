import "server-only";

import { and, eq, isNull } from "drizzle-orm";

import { controlDb } from "@/lib/db";
import { partnerSubjects, partners } from "@/lib/db/schema";
import { log, ref } from "@/lib/logger";

/**
 * The person's side of a partner link. PLAN.md 55.6, 42.2, C277.
 *
 * ## 🔴 WHY THIS MODULE EXISTS AT ALL
 *
 * C277 reads *"a partner's clinician holds a grant exactly like any other
 * clinician: scoped, revocable, and the patient can claim the record and
 * leave."* The grant half was built. The link half was not: `partner_subjects`
 * had no revocation column, no function and no screen, so a person who revoked
 * every grant and claimed their record was still permanently that partner's
 * "P123".
 *
 * And it was a live capability rather than a stale row. `writeBackSession`
 * resolves the subject and asks about no grant, so a partner could keep writing
 * real sessions into the chart of somebody who had withdrawn everything they
 * were ever asked to consent to.
 *
 * ## 🔴 WHAT A PATIENT IS SHOWN, AND WHAT THEY ARE NOT
 *
 * The partner's NAME and when the link was made. Not the external reference:
 * that is the partner's internal id for this person, it means nothing to them,
 * and putting it on a screen turns a consent decision into a puzzle. Not which
 * clinician arrived through that partner either, which is `/patient/consent`'s
 * own list and a different question.
 *
 * ## 🔴 THIS MODULE HOLDS NO CLINICAL DATA AND CANNOT REACH ANY
 *
 * Two tables, `partner_subjects` and `partners`, and neither can produce a
 * session, a note, a diagnosis or a date of care. That is what lets the same
 * module be read by the patient's own screen without the sprint 58 principals
 * gate having to argue about it.
 */

/**
 * Which platforms can currently identify this person, for their own screen.
 *
 * Live links only. A revoked one is kept in the table because "when did this
 * stop" is a question somebody asks later, and is not shown back to the person
 * as something they can act on, because they already did.
 */
export async function linkedPartners(personId: string) {
  return controlDb
    .select({
      subjectId: partnerSubjects.id,
      partnerName: partners.name,
      linkedAt: partnerSubjects.createdAt,
    })
    .from(partnerSubjects)
    .innerJoin(partners, eq(partners.id, partnerSubjects.partnerId))
    .where(
      and(
        eq(partnerSubjects.personId, personId),
        isNull(partnerSubjects.revokedAt),
      ),
    )
    .orderBy(partnerSubjects.createdAt);
}

/**
 * 🔴 CUT IT. One statement, and the person id is a CONDITION rather than a check.
 *
 * The same construction every patient-initiated write in this product uses: the
 * `personId` comes from the signed-in session and goes into the WHERE clause, so
 * a borrowed subject id unlinks nobody. Checking afterwards would be a window.
 *
 * 🔴 Effective immediately and everywhere, because `resolveSubject` in
 * `lib/partner/api.ts` filters on `revoked_at` and is the one place an external
 * reference becomes a person. Nothing else has to be told.
 */
export async function unlinkPartner(input: {
  personId: string;
  accountId: string;
  subjectId: string;
}): Promise<{ ok?: true; partnerId?: string; error?: string }> {
  const [cut] = await controlDb
    .update(partnerSubjects)
    .set({ revokedAt: new Date(), revokedByAccountId: input.accountId })
    .where(
      and(
        eq(partnerSubjects.id, input.subjectId),
        /* Theirs, from the session. Never from the form. */
        eq(partnerSubjects.personId, input.personId),
        /* Already cut is not an error the person needs to read about. */
        isNull(partnerSubjects.revokedAt),
      ),
    )
    .returning({ partnerId: partnerSubjects.partnerId });

  if (!cut) return { error: "That connection has already ended." };

  log.info("partner link revoked by the patient", { subject: ref(input.subjectId) });
  return { ok: true, partnerId: cut.partnerId };
}
