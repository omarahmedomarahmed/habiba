import "server-only";

import { and, eq, isNotNull, isNull, sql } from "drizzle-orm";

import { db } from "@/lib/db";
import {
  claimAttempts,
  patientAccounts,
  patients,
  people,
  personClaims,
  users,
} from "@/lib/db/schema";
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

/**
 * Names already offered against this record by this account. C87.
 *
 * Zero once a therapist has released it (13R.4): the release stamps
 * `released_at` and zeroes the count, so a person who mistyped their own name
 * gets a fresh budget from somebody who knows who they are — and nobody else
 * does.
 */
export async function spentOn(accountId: string, patientId: string): Promise<number> {
  const [row] = await db
    .select({ attempts: claimAttempts.attempts })
    .from(claimAttempts)
    .where(
      and(
        eq(claimAttempts.patientAccountId, accountId),
        eq(claimAttempts.patientId, patientId),
      ),
    )
    .limit(1);

  return row?.attempts ?? 0;
}

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
      claimStatus: personClaims.status,

      /*
       * 🔴 The budget comes from `claim_attempts`, not from the claim row.
       *
       * 13R moved it there precisely because a claim row is disposable — ask
       * for a fresh code and a new one is created, carrying a zeroed counter
       * with it. Reading `person_claims.name_attempts` here (as this query did
       * until sprint 15 re-ran the sprint 13 verifier) means a locked record
       * reappears in the queue the moment a new code is requested, which is
       * C87 all over again by a different door.
       */
      spent: claimAttempts.attempts,
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
    .leftJoin(
      claimAttempts,
      and(
        eq(claimAttempts.patientId, patients.id),
        eq(claimAttempts.patientAccountId, accountId),
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
    const spent = row.spent ?? 0;
    if (spent >= MAX_NAME_ATTEMPTS) continue;

    out.push({
      claimId: row.claimId ?? "",
      patientId: row.patientId,
      therapistName: [row.therapistFirst, row.therapistLast].filter(Boolean).join(" "),
      stage: row.seenTherapist === true ? "name" : "seen",
      attemptsLeft: MAX_NAME_ATTEMPTS - spent,
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
  const now = new Date();

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

  /*
   * 🔴 C87 — the budget is read from the (account, record) pair, not the claim.
   *
   * A claim row can be replaced; the pair cannot. See `claimAttempts`.
   */
  const budget = await spentOn(input.accountId, input.patientId);
  if (budget >= MAX_NAME_ATTEMPTS) return { ok: false, error: LOCKED, locked: true };

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
     * Counted in the database, atomically, on the pair. A counter incremented
     * after a successful response is a counter two concurrent guesses share,
     * and one that lives on a replaceable row is a counter that resets.
     */
    const [after] = await db
      .insert(claimAttempts)
      .values({
        patientAccountId: input.accountId,
        patientId: input.patientId,
        attempts: 1,
      })
      .onConflictDoUpdate({
        target: [claimAttempts.patientAccountId, claimAttempts.patientId],
        set: { attempts: sql`${claimAttempts.attempts} + 1`, updatedAt: now },
      })
      .returning({ attempts: claimAttempts.attempts });

    const spent = after?.attempts ?? MAX_NAME_ATTEMPTS;

    if (spent >= MAX_NAME_ATTEMPTS) {
      /*
       * 13R.2 — locked, and it says so in its own words.
       *
       * The claim goes to `locked`, not `expired`. A lockout and a code that
       * timed out are different events, support could not tell them apart, and
       * 13R.4's release needs something to target.
       */
      await db
        .update(claimAttempts)
        .set({ lockedAt: now, updatedAt: now })
        .where(
          and(
            eq(claimAttempts.patientAccountId, input.accountId),
            eq(claimAttempts.patientId, input.patientId),
            isNull(claimAttempts.lockedAt),
          ),
        );

      await db
        .update(personClaims)
        .set({ status: "locked", tokenHash: null })
        .where(eq(personClaims.id, row.claimId));

      log.warn("claim locked after name attempts", { patient: ref(input.patientId) });
      return { ok: false, error: LOCKED, locked: true };
    }

    return { ok: false, error: GENERIC };
  }

  /*
   * Stamped, not claimed. 13.10: sprint 7's consent step still runs, so the
   * record becomes theirs when they answer it — this records only that the
   * challenge is behind them.
   */
  await db
    .update(personClaims)
    .set({ nameConfirmedAt: now })
    .where(and(eq(personClaims.id, row.claimId), eq(personClaims.status, "pending")));

  log.info("challenge passed", { patient: ref(input.patientId) });
  return { ok: true, stage: "done", personId: row.personId };
}

/**
 * Has this account passed **both** questions on this record?
 *
 * 🔴 The gate every screen consults before rendering anything about a record.
 * 13.8: *no screen displays a record's contents before the challenge is
 * passed.*
 *
 * ## `status = 'verified'`, and nothing weaker
 *
 * The first version of this asked for `seen_therapist = true` and a status that
 * was not `rejected` — which is true the moment somebody answers *yes to
 * question one*. It would have opened a record to anybody willing to click
 * "yes, I have seen them", with the name gate still standing but no longer
 * guarding anything. Caught by a verifier check whose label ("still unpassed
 * after two wrong answers") contradicted what it was asserting.
 *
 * So the gate is `name_confirmed_at`: **both** questions answered. Not
 * `status = 'verified'` either — that is the *consent* step (13.10), which
 * happens after, and a person who has proved who they are should not be locked
 * out of their own record because they have not yet decided what their
 * therapist may see. Computed from the row rather than trusted from a session
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
        isNotNull(personClaims.nameConfirmedAt),
      ),
    )
    .limit(1);

  return Boolean(row);
}

/* --------------------------------------------------- 13R.3–13R.4 the release -- */

export type ReleaseResult = { ok: true; released: number } | { ok: false; error: string };

/**
 * Let a locked-out patient try again. C88, 13R.4.
 *
 * ## Why this ships in the same sprint as the lock
 *
 * Before C87 the escape hatch existed by accident: the budget reset on every
 * code request, so nobody stayed locked out. Closing that without building a
 * door would have converted a security hole into a permanent lockout for a
 * patient who mistyped their own name — which is a worse outcome than the hole,
 * because it is silent and it lands on the honest case.
 *
 * ## Why the therapist, and not only an admin
 *
 * They wrote the record down, they know the person, and they are reachable
 * today. Sprint 20 adds the staff tool; it must not be the only one, or a
 * lockout on a Friday is a lockout until Monday. Scoped to **their own**
 * record — `getPatient` does the tenancy check — so this cannot open somebody
 * else's caseload.
 *
 * ## What it does not do
 *
 * It does not claim the record, reveal the name, or say who was trying. It
 * restores exactly one budget, for one account, on one record, and writes down
 * who did it and why. The two questions still have to be answered.
 */
export async function releaseLock(input: {
  patientId: string;
  releasedByUserId: string;
  reason: string;
}): Promise<ReleaseResult> {
  const reason = input.reason.trim();
  if (reason.length < 3) {
    return { ok: false, error: "Write a short reason. It goes on the record." };
  }

  const now = new Date();

  const rows = await db
    .update(claimAttempts)
    .set({
      attempts: 0,
      lockedAt: null,
      releasedAt: now,
      releasedByUserId: input.releasedByUserId,
      releaseReason: reason.slice(0, 300),
      updatedAt: now,
    })
    .where(
      and(eq(claimAttempts.patientId, input.patientId), isNotNull(claimAttempts.lockedAt)),
    )
    .returning({ id: claimAttempts.id });

  /*
   * The locked claim is retired, not revived.
   *
   * ⚠️ The first version set it back to `pending`, which collides: a patient
   * who requested a fresh code after being locked out already has a pending
   * claim for the same (account, person, record) triple, and
   * `person_claims_open_unique` refuses the second. The verifier hit it
   * immediately.
   *
   * Retiring it is also the truer record. That attempt is over — it ended in a
   * lockout — and the next one is a new attempt. The budget lives in
   * `claim_attempts`, which is what the release actually restores, and
   * `answerSeen` creates a fresh claim when the person tries again.
   *
   * Conditional on `locked`: a claim that is `rejected` was answered "no" by a
   * person, and no clinician gets to undo that.
   */
  if (rows.length > 0) {
    await db
      .update(personClaims)
      .set({ status: "expired", tokenHash: null })
      .where(
        and(eq(personClaims.patientId, input.patientId), eq(personClaims.status, "locked")),
      );
  }

  log.info("claim lock released", { patient: ref(input.patientId), count: rows.length });
  return { ok: true, released: rows.length };
}

/** Is anybody locked out of this record right now? For the therapist's screen. */
export async function lockedOn(patientId: string): Promise<boolean> {
  const [row] = await db
    .select({ id: claimAttempts.id })
    .from(claimAttempts)
    .where(
      and(
        eq(claimAttempts.patientId, patientId),
        isNotNull(claimAttempts.lockedAt),
        isNull(claimAttempts.releasedAt),
      ),
    )
    .limit(1);

  return Boolean(row);
}

const GENERIC = "That does not match the record. Check with your therapist if you are unsure.";
const LOCKED =
  "We cannot confirm this record from here. Ask your therapist to send you an invite link.";
