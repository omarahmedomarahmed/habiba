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
