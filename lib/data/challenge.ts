import "server-only";

import { and, eq, isNull, ne, sql } from "drizzle-orm";

import { db } from "@/lib/db";
import { patientAccounts, patients, people, personClaims, users } from "@/lib/db/schema";
import { log, ref } from "@/lib/logger";

import { nameMatches } from "./name-match";

/**
 * Proving the number is not proving the person. PLAN.md 13.5–13.8, §3b.
 *
 * ## The thing this module exists to prevent
 *
 * 🔴 **A mis-claim, not an attacker.** §3b is explicit: the failure to design
 * against is a mother and daughter sharing a handset, a number recycled by the
 * network, a therapist who mistyped a digit. In every one of those the person
 * holding the phone is honest, the code arrives, and the record they are about
 * to be handed is somebody else's clinical history.
 *
 * So a verified code buys exactly one thing: *this number is yours.* It buys
 * nothing about which records are yours, and this module is the gap between
 * the two.
 *
 * ## Two questions, in this order, per record
 *
 * | | |
 * |---|---|
 * | 1 | *"Have you seen this therapist before?"* — yes or no |
 * | 2 | Only on yes: *"What name did you give them?"* |
 *
 * The order is the security property. Asking the name first turns the screen
 * into an oracle: type a number, get shown a name, and you have learned who
 * that number belongs to in a therapy service's records. Asking about the
 * *therapist* first reveals only something the person already had to know.
 *
 * A **no** is final and remembered (`status = 'rejected'`), so nobody is asked
 * about that record twice — and a person who says no cannot later be shown it
 * by a different route.
 *
 * ## What is never shown before the challenge is passed
 *
 * The therapist's name and nothing else. Not the record's name — not even
 * redacted. Sprint 6 showed `H••••• A•••••` at this point and that was one
 * question too generous: initials plus a phone number is enough to confirm a
 * guess. `redactName` still exists for the invite route, where a clinician has
 * already done the identifying face to face.
 */

/** How many names may be offered against one record before it locks. */
export const MAX_NAME_ATTEMPTS = 3;

export type Challenge = {
  claimId: string;
  patientId: string;
  /** The only thing shown before the challenge is passed. */
  therapistName: string;
  /** `seen` — question one. `name` — question two. */
  stage: "seen" | "name";
  attemptsLeft: number;
};

/**
 * The records this account has yet to answer for. 13.7.
 *
 * Keyed on the account's **verified** number, because an unverified one is a
 * string somebody typed. Two therapists holding that number produce two rows
 * here, and each is answered on its own.
 *
 * Rejected and verified claims are absent: the first because a no is
 * remembered, the second because it is done.
 */
export async function openChallenges(accountId: string): Promise<Challenge[]> {
  const [account] = await db
    .select({
      phone: patientAccounts.phone,
      phoneVerifiedAt: patientAccounts.phoneVerifiedAt,
      email: patientAccounts.email,
      emailVerifiedAt: patientAccounts.emailVerifiedAt,
      personId: patientAccounts.personId,
    })
    .from(patientAccounts)
    .where(and(eq(patientAccounts.id, accountId), isNull(patientAccounts.deletedAt)))
    .limit(1);

  if (!account) return [];

  /*
   * 🔴 Nothing is offered on an unproved contact detail.
   *
   * Both halves matter. The phone must be verified for §3b's flow, and email
   * is a complete fallback (13.9) — but an *unverified* address would let
   * anybody type a stranger's and be shown which therapist they see.
   */
  const phone = account.phoneVerifiedAt ? account.phone : null;
  const email = account.emailVerifiedAt ? account.email : null;
  if (!phone && !email) return [];

  const rows = await db
    .select({
      patientId: patients.id,
      personId: patients.personId,
      therapistFirst: users.firstName,
      therapistLast: users.lastName,
      claimId: personClaims.id,
      seenTherapist: personClaims.seenTherapist,
      nameAttempts: personClaims.nameAttempts,
      claimStatus: personClaims.status,
    })
    .from(patients)
    .innerJoin(people, eq(people.id, patients.personId))
    .innerJoin(users, eq(users.id, patients.therapistId))
    .leftJoin(
      personClaims,
      and(
        eq(personClaims.patientId, patients.id),
        eq(personClaims.patientAccountId, accountId),
      ),
    )
    .where(
      and(
        isNull(patients.deletedAt),
        // Somebody else's record with an owner is not a suggestion, it is a
        // collision. Offering it would invite a stranger to try.
        isNull(people.claimedAt),
        sql`(${phone ? sql`${people.phone} = ${phone}` : sql`false`} OR ${
          email ? sql`${people.email} = ${email}` : sql`false`
        })`,
      ),
    )
    .limit(20);

  const out: Challenge[] = [];

  for (const row of rows) {
    // A no is remembered; a yes that finished is done. Neither is asked again.
    if (row.claimStatus === "rejected" || row.claimStatus === "verified") continue;
    if (row.nameAttempts !== null && row.nameAttempts >= MAX_NAME_ATTEMPTS) continue;

    out.push({
      claimId: row.claimId ?? "",
      patientId: row.patientId,
      therapistName: [row.therapistFirst, row.therapistLast].filter(Boolean).join(" "),
      stage: row.seenTherapist === true ? "name" : "seen",
      attemptsLeft: MAX_NAME_ATTEMPTS - (row.nameAttempts ?? 0),
    });
  }

  return out;
}

export type AnswerResult =
  | { ok: true; stage: "name" }
  | { ok: true; stage: "done"; personId: string }
  | { ok: false; error: string; locked?: boolean };

/**
 * Question one: *have you seen this therapist before?* 13.6.
 *
 * A **no** closes that record permanently for this account. Not a soft
 * dismissal — the row goes to `rejected`, `openChallenges` filters it out, and
 * there is no path back. Somebody who has just been asked about a stranger's
 * therapist should never see that question again, and a "maybe later" state
 * would guarantee they do.
 */
export async function answerSeen(input: {
  accountId: string;
  patientId: string;
  seen: boolean;
}): Promise<AnswerResult> {
  const now = new Date();

  const [target] = await db
    .select({ personId: patients.personId })
    .from(patients)
    .innerJoin(people, eq(people.id, patients.personId))
    .where(
      and(
        eq(patients.id, input.patientId),
        isNull(patients.deletedAt),
        isNull(people.claimedAt),
      ),
    )
    .limit(1);

  if (!target?.personId) return { ok: false, error: "That record is no longer available." };

  /*
   * The claim row is created here rather than at match time, so that a person
   * who never answers leaves no trace of having been offered somebody else's
   * record.
   */
  const [claim] = await db
    .insert(personClaims)
    .values({
      personId: target.personId,
      patientAccountId: input.accountId,
      patientId: input.patientId,
      route: "match",
      status: input.seen ? "pending" : "rejected",
      seenTherapist: input.seen,
      challengedAt: now,
    })
    .onConflictDoUpdate({
      target: [personClaims.patientAccountId, personClaims.personId, personClaims.patientId],
      targetWhere: sql`status = 'pending'`,
      set: {
        seenTherapist: input.seen,
        status: input.seen ? "pending" : "rejected",
        challengedAt: now,
      },
    })
    .returning({ id: personClaims.id });

  if (!claim) return { ok: false, error: "That record is no longer available." };

  if (!input.seen) {
    log.info("claim declined at question one", { patient: ref(input.patientId) });
    return { ok: false, error: "" };
  }

  return { ok: true, stage: "name" };
}

/**
 * Question two: *what name did you give them?* 13.6 / 13.8.
 *
 * ## Why the comparison is loose and the failure is not
 *
 * Compared case-insensitively, on the **first name only**, with whitespace
 * collapsed — because somebody typing their own name into a phone should not
 * fail on "Sara " or "sara". Arabic is normalised the same way: this compares
 * strings, it does not assume an alphabet.
 *
 * 🔴 What it never does is tell you *how close* you were. One message for a
 * wrong name, an expired claim and a record that is not there — three attempts
 * and it locks. A "not quite" would turn three guesses into a search, and the
 * thing being searched for is a real person's first name in a therapy
 * service's records.
 */
export async function answerName(input: {
  accountId: string;
  patientId: string;
  name: string;
}): Promise<AnswerResult> {
  const [row] = await db
    .select({
      claimId: personClaims.id,
      personId: personClaims.personId,
      attempts: personClaims.nameAttempts,
      seen: personClaims.seenTherapist,
      firstName: patients.firstName,
      personFirstName: people.firstName,
    })
    .from(personClaims)
    .innerJoin(patients, eq(patients.id, personClaims.patientId))
    .innerJoin(people, eq(people.id, personClaims.personId))
    .where(
      and(
        eq(personClaims.patientAccountId, input.accountId),
        eq(personClaims.patientId, input.patientId),
        eq(personClaims.status, "pending"),
        eq(personClaims.seenTherapist, true),
        isNull(people.claimedAt),
      ),
    )
    .limit(1);

  /*
   * Deliberately one message for "no such claim", "you did not say yes yet"
   * and "somebody else already owns that record". Distinguishing them would
   * answer questions about records the caller has not earned.
   */
  if (!row) return { ok: false, error: GENERIC };

  if ((row.attempts ?? 0) >= MAX_NAME_ATTEMPTS) {
    return { ok: false, error: LOCKED, locked: true };
  }

  /*
   * Either name on the record. `patients.firstName` is what this clinician
   * wrote down; `people.firstName` is the person layer above it. They are
   * usually the same string and occasionally are not — a therapist who wrote
   * "Sara" for somebody the person row calls "Sara Mahmoud" — and failing
   * somebody for the difference between two of *our* records is not a
   * challenge, it is a bug.
   */
  const matches =
    nameMatches(input.name, row.firstName) || nameMatches(input.name, row.personFirstName);

  if (!matches) {
    /*
     * Counted in the database, atomically, before the answer goes back. A
     * counter incremented after a successful response is a counter two
     * concurrent guesses share.
     */
    const [after] = await db
      .update(personClaims)
      .set({ nameAttempts: sql`${personClaims.nameAttempts} + 1` })
      .where(eq(personClaims.id, row.claimId))
      .returning({ attempts: personClaims.nameAttempts });

    const spent = after?.attempts ?? MAX_NAME_ATTEMPTS;
    if (spent >= MAX_NAME_ATTEMPTS) {
      // Locked, and the claim is closed rather than left dangling — a pending
      // row with no attempts left is a state every reader has to special-case.
      await db
        .update(personClaims)
        .set({ status: "expired", tokenHash: null })
        .where(eq(personClaims.id, row.claimId));
      log.warn("claim locked after name attempts", { patient: ref(input.patientId) });
      return { ok: false, error: LOCKED, locked: true };
    }

    return { ok: false, error: GENERIC };
  }

  return { ok: true, stage: "done", personId: row.personId };
}

/**
 * Has this account passed both questions on this record?
 *
 * 🔴 The gate every screen consults before rendering anything about a record.
 * 13.8: *no screen displays a record's contents before the challenge is
 * passed.* Computed from the claim row rather than trusted from a session
 * flag — a flag is something a client can be persuaded to send.
 */
export async function challengePassed(accountId: string, patientId: string): Promise<boolean> {
  const [row] = await db
    .select({ id: personClaims.id })
    .from(personClaims)
    .where(
      and(
        eq(personClaims.patientAccountId, accountId),
        eq(personClaims.patientId, patientId),
        eq(personClaims.seenTherapist, true),
        ne(personClaims.status, "rejected"),
      ),
    )
    .limit(1);

  return Boolean(row);
}

const GENERIC = "That does not match the record. Check with your therapist if you are unsure.";
const LOCKED =
  "We cannot confirm this record from here. Ask your therapist to send you an invite link.";
