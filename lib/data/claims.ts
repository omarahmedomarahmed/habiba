import "server-only";

import { createHash, randomBytes, randomInt } from "node:crypto";
import { and, desc, eq, gt, isNull, sql } from "drizzle-orm";

import { db } from "@/lib/db";
import { patients, people, personClaims, personInvites } from "@/lib/db/schema";
import { log, ref } from "@/lib/logger";

import { findMatches, redactName } from "./people";

/**
 * Claiming a record — §3's eight steps, and C19's third route.
 *
 * ## The shape of the thing
 *
 * A therapist writes somebody down. That file is theirs, and it stays theirs
 * unless the person it describes takes ownership of it. Taking ownership is
 * this module.
 *
 * Two ways in, and they differ only in how the person got here:
 *
 *   **match**   they signed up with an email or phone we already hold, and we
 *               ask "have you ever seen Dr X?" then show a redacted name.
 *   **invite**  their therapist handed them a link bound to that exact record.
 *               No name confirmation — the clinician already did the
 *               identifying, in person.
 *
 * The invite route is not a convenience. Measured on this database, 56 of 66
 * patients have no email and none has a phone number, so for most of the book
 * matching finds nothing and an invite is the *only* way a record can ever be
 * claimed.
 *
 * ## What never happens here
 *
 * No merging. A claim links one account to one person; it does not fold two
 * people together. §3 forbids the latter and `lib/data/people.ts` has no
 * function for it.
 */

const CODE_TTL_MS = 30 * 60 * 1000;
const INVITE_TTL_MS = 30 * 24 * 60 * 60 * 1000;

function hash(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

/** Six digits. Read aloud over WhatsApp, typed on a phone. */
function verificationCode(): string {
  return String(randomInt(0, 1_000_000)).padStart(6, "0");
}

/* ------------------------------------------------------ steps 2-4: matching -- */

export type ClaimSuggestion = {
  personId: string;
  /** `H••••• A•••••` — §3 step 4. Never the real name. */
  redactedName: string;
  matchedOn: "email" | "phone";
};

/**
 * Records this account might own. Steps 2–4.
 *
 * Returns redacted names only, and never says which clinician holds the
 * record. §3 asks "have you ever seen Dr X?" at step 3 — that question is put
 * by the *screen*, to somebody who already matched on their own contact
 * details, and answering it wrongly reveals nothing they did not supply.
 *
 * Already-claimed people are filtered out. A record somebody else owns is not
 * a suggestion, it is a collision, and offering it would invite a stranger to
 * try to claim it.
 */
export async function suggestionsFor(input: {
  email?: string | null;
  phone?: string | null;
}): Promise<ClaimSuggestion[]> {
  const candidates = await findMatches(input);

  const unclaimed = candidates.filter((c) => !c.claimed);
  return unclaimed.map((c) => ({
    personId: c.personId,
    redactedName: redactName(c.firstName, c.lastName),
    matchedOn: c.matchedOn,
  }));
}

/* ------------------------------------------------- step 5: send a code -- */

export type StartResult =
  | { ok: true; claimId: string; channel: "email" | "whatsapp"; code: string }
  | { ok: false; error: string };

/**
 * Begin a claim and issue a verification code. Step 5.
 *
 * The code is returned to the caller so the *action* can send it — this module
 * does not know about email or WhatsApp, and a data module that sends messages
 * is a data module you cannot test. The raw code is never stored; only its
 * hash, for the same reason a session token is hashed.
 *
 * Refuses a person somebody has already claimed. That check is here rather than
 * only in the UI because it is the whole security property: a claimed record
 * belongs to its person, and a second account must not be able to start a
 * claim on it at all.
 */
export async function startClaim(input: {
  personId: string;
  accountId: string;
  channel: "email" | "whatsapp";
  route?: "match" | "invite";
}): Promise<StartResult> {
  const [person] = await db
    .select({ id: people.id, claimedAt: people.claimedAt })
    .from(people)
    .where(eq(people.id, input.personId))
    .limit(1);

  if (!person) return { ok: false, error: "That record no longer exists." };
  if (person.claimedAt !== null) {
    log.warn("claim refused: already claimed", { person: ref(input.personId) });
    return { ok: false, error: "That record has already been claimed." };
  }

  const code = verificationCode();
  const expiresAt = new Date(Date.now() + CODE_TTL_MS);

  /*
   * One live attempt per (person, account) — the partial unique index enforces
   * it. A second press of "send me a code" updates the existing row rather than
   * stacking attempts, so an old code stops working the moment a new one is
   * issued.
   */
  const [claim] = await db
    .insert(personClaims)
    .values({
      personId: input.personId,
      patientAccountId: input.accountId,
      route: input.route ?? "match",
      status: "pending",
      tokenHash: hash(code),
      channel: input.channel,
      expiresAt,
    })
    .onConflictDoUpdate({
      target: [personClaims.personId, personClaims.patientAccountId],
      /*
       * `targetWhere`, not `setWhere`, and the difference is the whole
       * statement working or not.
       *
       * `person_claims_open_unique` is a PARTIAL index — unique on
       * (person, account) only `WHERE status = 'pending'`. Postgres will only
       * pick a partial index as the ON CONFLICT arbiter when the clause
       * repeats the index predicate; without it the statement does not fall
       * back to something weaker, it fails outright with "no unique or
       * exclusion constraint matching the ON CONFLICT specification". This was
       * `setWhere` — a filter on the UPDATE, which is a different clause — and
       * every second press of "send me a code" threw a 500.
       */
      targetWhere: sql`status = 'pending'`,
      set: { tokenHash: hash(code), channel: input.channel, expiresAt },
    })
    .returning({ id: personClaims.id });

  if (!claim) return { ok: false, error: "Could not start the claim. Try again." };
  return { ok: true, claimId: claim.id, channel: input.channel, code };
}

/* --------------------------------------- steps 6-8: verify and take ownership -- */

export type VerifyResult =
  { ok: true; personId: string; patientsMoved: number } | { ok: false; error: string };

/**
 * Confirm the code, and take ownership. Steps 6–8.
 *
 * ## The transaction, and what is inside it
 *
 * Marking the claim verified, stamping `people.claimed_at`, and recording
 * whether the therapist keeps access are one atomic act. A half-applied claim
 * — verified but unclaimed, or claimed with nobody recorded as owner — is a
 * record in a state no screen knows how to render and no rule knows how to
 * guard.
 *
 * ## Step 7, and why the default is off
 *
 * §3: "We ask whether the therapist keeps access. **Default is OFF.** The
 * patient chooses." `therapistKeepsAccess` is passed in explicitly and there is
 * no default in this signature — a caller that forgets it is a type error
 * rather than a silent grant.
 *
 * When they say no, the clinician keeps what they uploaded themselves and loses
 * the live profile. That is sprint 7's grants; what this records is the
 * *decision*, so sprint 7 has something to honour.
 */
export async function verifyClaim(input: {
  claimId: string;
  accountId: string;
  code: string;
  therapistKeepsAccess: boolean;
}): Promise<VerifyResult> {
  const now = new Date();

  const [claim] = await db
    .select({
      id: personClaims.id,
      personId: personClaims.personId,
      accountId: personClaims.patientAccountId,
    })
    .from(personClaims)
    .where(
      and(
        eq(personClaims.id, input.claimId),
        eq(personClaims.patientAccountId, input.accountId),
        eq(personClaims.status, "pending"),
        eq(personClaims.tokenHash, hash(input.code.trim())),
        gt(personClaims.expiresAt, now),
      ),
    )
    .limit(1);

  if (!claim) {
    // Deliberately one message for wrong-code, expired and not-yours. Telling
    // them which would let somebody probe for live claims.
    return {
      ok: false,
      error: "That code is wrong or has expired. Ask for a new one.",
    };
  }

  let patientsMoved = 0;

  await db.transaction(async (tx) => {
    /*
     * The claim, conditionally. If another request verified this in the
     * meantime the UPDATE matches nothing and the transaction does nothing
     * else — the same conditional-UPDATE discipline as `claimTherapist`.
     */
    const [taken] = await tx
      .update(personClaims)
      .set({
        status: "verified",
        verifiedAt: now,
        therapistKeepsAccess: input.therapistKeepsAccess,
        tokenHash: null,
      })
      .where(and(eq(personClaims.id, claim.id), eq(personClaims.status, "pending")))
      .returning({ id: personClaims.id });

    if (!taken) return;

    // Guarded on `claimed_at IS NULL`: two accounts racing to claim one person
    // must not both succeed.
    await tx
      .update(people)
      .set({
        claimedAt: now,
        claimedByAccountId: claim.accountId,
        updatedAt: now,
      })
      .where(and(eq(people.id, claim.personId), isNull(people.claimedAt)));

    const moved = await tx
      .select({ n: sql<number>`COUNT(*)::int` })
      .from(patients)
      .where(eq(patients.personId, claim.personId));
    patientsMoved = moved[0]?.n ?? 0;

    // Every other pending attempt on this person is now moot.
    await tx
      .update(personClaims)
      .set({ status: "expired", tokenHash: null })
      .where(and(eq(personClaims.personId, claim.personId), eq(personClaims.status, "pending")));
  });

  log.info("person claimed", { person: ref(claim.personId) });
  return { ok: true, personId: claim.personId, patientsMoved };
}

/** §3: they say no. Recorded, so nobody is asked the same thing twice. */
export async function rejectClaim(input: { claimId: string; accountId: string }): Promise<void> {
  await db
    .update(personClaims)
    .set({ status: "rejected", tokenHash: null })
    .where(
      and(
        eq(personClaims.id, input.claimId),
        eq(personClaims.patientAccountId, input.accountId),
        eq(personClaims.status, "pending"),
      ),
    );
}

/* --------------------------------------------------- 6.10: the invite route -- */

/**
 * Issue a link bound to one record. C19 / 6.10.
 *
 * The raw token is returned once and never stored. We do not send it: there is
 * no address to send it to, which is the entire situation this route exists
 * for. The clinician hands it over.
 *
 * Refuses an already-claimed person — a record with an owner is not the
 * clinician's to give away.
 */
export async function issueInvite(input: {
  personId: string;
  issuedByUserId: string;
}): Promise<{ token: string; expiresAt: Date } | { error: string }> {
  const [person] = await db
    .select({ claimedAt: people.claimedAt })
    .from(people)
    .where(eq(people.id, input.personId))
    .limit(1);

  if (!person) return { error: "That record no longer exists." };
  if (person.claimedAt !== null) {
    return { error: "This record already belongs to the person it describes." };
  }

  const token = randomBytes(24).toString("base64url");
  const expiresAt = new Date(Date.now() + INVITE_TTL_MS);

  await db.insert(personInvites).values({
    personId: input.personId,
    issuedByUserId: input.issuedByUserId,
    tokenHash: hash(token),
    expiresAt,
  });

  return { token, expiresAt };
}

/**
 * What an invite points at, if it is still good.
 *
 * Returns the *redacted* name even here. The link identifies the record, and
 * whoever is holding it has not proved they are the person yet — showing a full
 * name to anybody who found the link in a WhatsApp thread is a leak the
 * redaction costs nothing to avoid.
 */
export async function resolveInvite(token: string): Promise<{
  personId: string;
  redactedName: string;
  inviteId: string;
} | null> {
  const [row] = await db
    .select({
      id: personInvites.id,
      personId: personInvites.personId,
      firstName: people.firstName,
      lastName: people.lastName,
      claimedAt: people.claimedAt,
    })
    .from(personInvites)
    .innerJoin(people, eq(people.id, personInvites.personId))
    .where(
      and(
        eq(personInvites.tokenHash, hash(token)),
        isNull(personInvites.usedAt),
        isNull(personInvites.revokedAt),
        gt(personInvites.expiresAt, new Date()),
        isNull(people.claimedAt),
      ),
    )
    .limit(1);

  if (!row) return null;
  return {
    personId: row.personId,
    inviteId: row.id,
    redactedName: redactName(row.firstName, row.lastName),
  };
}

/**
 * Spend the invite and hand the record over.
 *
 * The invite *is* the verification — the clinician identified this person in
 * the room, which is stronger evidence than a code sent to an address. So there
 * is no second factor here, and the claim is created already verified.
 *
 * Single use, enforced by a conditional UPDATE rather than a read: two people
 * opening the same forwarded link must not both claim the record.
 */
export async function redeemInvite(input: {
  token: string;
  accountId: string;
  therapistKeepsAccess: boolean;
}): Promise<VerifyResult> {
  const now = new Date();
  const resolved = await resolveInvite(input.token);
  if (!resolved)
    return {
      ok: false,
      error: "That link has expired or has already been used.",
    };

  let patientsMoved = 0;
  let claimed = false;

  await db.transaction(async (tx) => {
    const [spent] = await tx
      .update(personInvites)
      .set({ usedAt: now, usedByAccountId: input.accountId })
      .where(and(eq(personInvites.id, resolved.inviteId), isNull(personInvites.usedAt)))
      .returning({ id: personInvites.id });

    if (!spent) return;

    const [took] = await tx
      .update(people)
      .set({
        claimedAt: now,
        claimedByAccountId: input.accountId,
        updatedAt: now,
      })
      .where(and(eq(people.id, resolved.personId), isNull(people.claimedAt)))
      .returning({ id: people.id });

    if (!took) return;
    claimed = true;

    await tx.insert(personClaims).values({
      personId: resolved.personId,
      patientAccountId: input.accountId,
      route: "invite",
      status: "verified",
      verifiedAt: now,
      therapistKeepsAccess: input.therapistKeepsAccess,
    });

    const moved = await tx
      .select({ n: sql<number>`COUNT(*)::int` })
      .from(patients)
      .where(eq(patients.personId, resolved.personId));
    patientsMoved = moved[0]?.n ?? 0;
  });

  if (!claimed) return { ok: false, error: "That link has already been used." };
  log.info("person claimed by invite", { person: ref(resolved.personId) });
  return { ok: true, personId: resolved.personId, patientsMoved };
}

/**
 * What the clinician's own page needs to show about a record's ownership.
 *
 * Deliberately thin: whether the person has taken the record over, and whether
 * there is an unspent invite outstanding. It does **not** return a token —
 * the raw token exists for exactly one response, at `issueInvite`, and a
 * function that could hand it back later would mean we had stored it.
 */
export type RecordAccess = {
  claimed: boolean;
  claimedAt: Date | null;
  /** Set only while an invite is live. Revocable, not re-readable. */
  openInvite: { id: string; expiresAt: Date; issuedAt: Date } | null;
};

export async function recordAccess(personId: string, userId: string): Promise<RecordAccess | null> {
  const [person] = await db
    .select({ claimedAt: people.claimedAt })
    .from(people)
    .where(eq(people.id, personId))
    .limit(1);

  if (!person) return null;
  if (person.claimedAt !== null) {
    return { claimed: true, claimedAt: person.claimedAt, openInvite: null };
  }

  /*
   * Only invites this clinician issued. Another clinician in another practice
   * may hold the same person, and their outstanding invite is not this one's
   * to see or to revoke.
   */
  const [invite] = await db
    .select({
      id: personInvites.id,
      expiresAt: personInvites.expiresAt,
      issuedAt: personInvites.createdAt,
    })
    .from(personInvites)
    .where(
      and(
        eq(personInvites.personId, personId),
        eq(personInvites.issuedByUserId, userId),
        isNull(personInvites.usedAt),
        isNull(personInvites.revokedAt),
        gt(personInvites.expiresAt, new Date()),
      ),
    )
    .orderBy(desc(personInvites.createdAt))
    .limit(1);

  return {
    claimed: false,
    claimedAt: null,
    openInvite: invite ? { ...invite, issuedAt: invite.issuedAt } : null,
  };
}

/** A clinician taking an invite back. */
export async function revokeInvite(inviteId: string, userId: string): Promise<boolean> {
  const revoked = await db
    .update(personInvites)
    .set({ revokedAt: new Date() })
    .where(
      and(
        eq(personInvites.id, inviteId),
        eq(personInvites.issuedByUserId, userId),
        isNull(personInvites.usedAt),
        isNull(personInvites.revokedAt),
      ),
    )
    .returning({ id: personInvites.id });
  return revoked.length > 0;
}
