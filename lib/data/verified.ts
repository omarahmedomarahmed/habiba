import { sql, type SQL } from "drizzle-orm";

import { users } from "@/lib/db/schema";

/**
 * 🔴 C285 — IS THIS CLINICIAN VERIFIED, ASKED OF THE COLUMN THE DATABASE ENFORCES.
 *
 * ## Why this file exists when `users.verification_status` is already correct
 *
 * 0083 makes `users.verification_status` a derived column: a trigger on `therapist_verifications`
 * pushes every change onto it, and a second trigger forces it to the derived value on every insert
 * and update, so no code path can set it and none can diverge. Twenty files read that column and
 * all twenty are right again.
 *
 * That is enough for a screen. It is not enough for an ASSERTION TO SOMEBODY ELSE.
 *
 * 🔴 55.5 answers a partner's question "have you verified this clinician" over an HTTP API, under
 * a commercial agreement, about a person who will then conduct therapy. "Only certified therapists"
 * is the claim this product rests on, and for thirteen sprints that answer came from a column
 * nothing enforced. Having fixed the column, answering from it would still mean the external claim
 * depends on a cache being correct — and the reason this defect existed is that a cache was not.
 *
 * So the partner surfaces, and the public radar a patient chooses from, ask the source directly.
 * The cost is a subquery. The thing bought is that the sentence "we have verified them" is true
 * because of the row that makes it true, not because of a copy of it.
 *
 * ## One definition, not one per call site
 *
 * `approved` is the whole rule: a `therapist_verifications` row for this user in state `approved`.
 * The same expression backs the predicate and the boolean, so a WHERE clause and a SELECT list can
 * never mean different things — which is the shape of the defect two tables over that 0079 and 0082
 * each had to fix.
 */
const APPROVED = sql`EXISTS (
  SELECT 1 FROM therapist_verifications v
   WHERE v.user_id = ${users.id}
     AND v.state = 'approved'
)`;

/** For a WHERE clause: only clinicians a human has actually approved. */
export function isVerifiedClinician(): SQL {
  return sql`${APPROVED}`;
}

/** For a SELECT list: the boolean a partner or a patient is shown. */
export function verifiedFlag(): SQL<boolean> {
  return sql<boolean>`${APPROVED}`;
}

/**
 * 🔴 WHAT WE CHECKED AND WHEN, FOR A PAGE A STRANGER READS.
 *
 * ## The two sentences these keep apart
 *
 * `/verify` already draws this line for a record extract: "24Therapy produced
 * this document" is something we can say, and "the diagnosis in it is correct"
 * is not. A clinician's public page needs the same cut. We can say a named
 * regulator was checked and a human approved it on a date. We cannot say this
 * person is good at their job, and a badge that says only "Verified" is read as
 * the second sentence while being defensible as the first.
 *
 * ## What is deliberately NOT here
 *
 * The **licence number** and every document URL. `/t/:id` is indexed by search
 * engines by design, and the number is not ours to publish on a clinician's
 * behalf. The document URLs are worse: `therapist_verifications` says in as
 * many words that the unguessable path IS the credential, so those columns
 * never reach a select a patient can read. If a licence number should ever be
 * public, that is a founder's decision and a separate change, not a field
 * somebody adds to a helper.
 *
 * Both read the approved row directly for the reason the rest of this file
 * exists: an assertion made to a stranger should rest on the row that makes it
 * true, not on a copy of it.
 */
export function verifiedByBody(): SQL<string | null> {
  return sql<string | null>`(
    SELECT v.license_body FROM therapist_verifications v
     WHERE v.user_id = ${users.id} AND v.state = 'approved'
     LIMIT 1
  )`;
}

/** The date a human approved it. Rendered as a month and a year, never a day. */
export function verifiedOn(): SQL<Date | null> {
  return sql<Date | null>`(
    SELECT v.reviewed_at FROM therapist_verifications v
     WHERE v.user_id = ${users.id} AND v.state = 'approved'
     LIMIT 1
  )`;
}
