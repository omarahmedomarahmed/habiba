import "server-only";

import { createHash } from "node:crypto";

import { and, eq, isNull, sql } from "drizzle-orm";

import { controlDb } from "@/lib/db";
import {
  enrolments,
  patientNotifications,
  sponsorCodes,
  sponsorIdentifierFields,
  sponsors,
  type IdentifierKind,
} from "@/lib/db/schema";
import { env } from "@/lib/env";
import { log } from "@/lib/logger";
import { callerKey, consume, subjectKey } from "@/lib/rate-limit";

/**
 * Joining a benefit. PLAN.md 53.17 to 53.19d, C227, C237, C246 to C250.
 *
 * ## 🔴 There is no approval queue and there is no roster (C227)
 *
 * Both were tried and both failed, and the reasons are worth keeping because
 * both are the obvious build:
 *
 *   - **An approval queue fails on the rejection path.** Rejections are
 *     surfaced individually, and who fails an identifier match is
 *     disproportionately contractors, recent name changes and people on leave.
 *     HR gets a short sharp list of exactly the people least able to absorb
 *     being on it, and no mass enrolment drive dilutes it.
 *   - **A bulk roster fixes that and creates a worse problem**: a complete
 *     staff list for every client sitting in our database.
 *
 * So a person enrols themselves with a code, and matching is automatic **against
 * a shape and a domain, never against a list of people.**
 *
 * ## 🔴 53.2 — enrolment is ELIGIBILITY, never therapy
 *
 * *The words are "activate your benefit". Nothing on any enrolment screen,
 * email or poster implies the person needs help.* A poster on a staff-room wall
 * saying "get help with your mental health" is an outing risk for whoever is
 * seen reading it. Every string this module produces is a benefit string.
 */

/** 🔴 53.19 — attempts per code, because a shape is guessable (C246). */
const ATTEMPTS_PER_WINDOW = 8;
const ATTEMPT_WINDOW_SECONDS = 15 * 60;

/**
 * 🔴 53.19 — the SPIKE COUNTER, which is a different thing from the limiter.
 *
 * *A spike alerting admin and the sponsor as a NUMBER, never names.*
 *
 * The limiter above is keyed on the caller AND the code, because the attack is one
 * person guessing and the remedy is to slow that person down. A spike is the
 * opposite shape: many callers against one code, which no per-caller key can see.
 *
 * So this is a second counter keyed on the CODE ALONE, with a limit high enough
 * that it never refuses anything. It exists to be read, not to gate: the sponsor's
 * own screen shows the number and admin sees it beside the account, and neither
 * ever sees an identifier that was tried. A list of attempted employee numbers is
 * a list of people who tried.
 */
const SPIKE_WINDOW_SECONDS = 7 * 24 * 60 * 60;
const SPIKE_NEVER_REFUSES = 1_000_000;

/**
 * 🔴 The identifier is stored HASHED, and this is the only place it is hashed.
 *
 * 53.18b: *the identifier is a gate and nothing else.* A work email used to
 * cross it is never used for communication unless the person signed up with it,
 * is never returned to the sponsor, and is never a destination for anything we
 * send except the one verification code.
 *
 * A hash makes all three structural. It cannot be returned, cannot be emailed,
 * and cannot be read off a screenshot by a support agent. It still
 * de-duplicates, which is C246's "one identifier used once, ever".
 *
 * Salted with `AUTH_SECRET` rather than bare, so a stolen table cannot be
 * matched against a guessed list of employee numbers offline. An unsalted
 * SHA-256 of "20215544" is a lookup, not a hash.
 */
function hashIdentifier(sponsorId: string, value: string): string {
  return createHash("sha256")
    .update(`${env.authSecret}${sponsorId}${value.trim().toLowerCase()}`)
    .digest("hex");
}

export type CodeLookup =
  | {
      ok: true;
      sponsorId: string;
      sponsorName: string;
      kind: "company" | "university";
      fields: {
        id: string;
        kind: IdentifierKind;
        domain: string | null;
        /** 🔴 C248 — a description of the shape, never a specimen value. */
        shapeHint: string | null;
      }[];
    }
  | { ok: false; error: string };

/**
 * 🔴 53.9 / C237 / C120 — look up a printed code.
 *
 * *The printed QR on an office wall is public, exactly as C120's clinic poster
 * was. Anybody can photograph it.* So this returns the sponsor's identity and
 * the shape of what they require, and nothing else: no entitlement, no person,
 * no balance.
 *
 * 🔴 A dead code is answered with a SENTENCE rather than a 404, because
 * somebody is standing in a corridor reading a poster.
 */
export async function lookupCode(code: string): Promise<CodeLookup> {
  const trimmed = code.trim().toUpperCase();
  if (!trimmed) return { ok: false, error: "Enter the code from your organisation." };

  const [row] = await controlDb
    .select({
      sponsorId: sponsors.id,
      sponsorName: sponsors.name,
      kind: sponsors.kind,
      state: sponsors.state,
    })
    .from(sponsorCodes)
    .innerJoin(sponsors, eq(sponsors.id, sponsorCodes.sponsorId))
    .where(and(eq(sponsorCodes.code, trimmed), isNull(sponsorCodes.revokedAt)))
    .limit(1);

  if (!row || row.state !== "active") {
    /*
     * 🔴 One sentence for every failure, and it names nothing.
     *
     * A revoked code, an unknown code and a suspended sponsor read identically.
     * Telling somebody "that organisation's account is suspended" hands a
     * stranger in a corridor a fact about a company's billing.
     */
    return {
      ok: false,
      error:
        "That code is not active. Ask whoever put the poster up for a current one, or carry on without it: nothing about using 24Therapy depends on this.",
    };
  }

  const fields = await controlDb
    .select({
      id: sponsorIdentifierFields.id,
      kind: sponsorIdentifierFields.kind,
      domain: sponsorIdentifierFields.domain,
      shapeHint: sponsorIdentifierFields.shapeHint,
    })
    .from(sponsorIdentifierFields)
    .where(eq(sponsorIdentifierFields.sponsorId, row.sponsorId));

  return {
    ok: true,
    sponsorId: row.sponsorId,
    sponsorName: row.sponsorName,
    kind: row.kind,
    fields,
  };
}

/**
 * 🔴 Does this identifier cross the gate? A SHAPE AND A DOMAIN, never a list.
 *
 * Pure, so the rule can be tested without a database, and exported so
 * `verify:sprint53` can assert the weak gate is weak in the way the sponsor was
 * told it is.
 *
 * C246: *prefer an identifier we can prove over one we can only pattern-match.*
 * A `domain_email` is real proof of control once the code sent to it is
 * answered; an `id_number` matched by shape is a weak gate, permitted, and the
 * sponsor is told in plain words that it is guessable and that they carry the
 * risk.
 */
export function matchesGate(
  field: { kind: IdentifierKind; domain: string | null; pattern: string | null },
  value: string,
): boolean {
  const trimmed = value.trim().toLowerCase();
  if (!trimmed) return false;

  if (field.kind === "domain_email") {
    if (!field.domain) return false;
    /*
     * Exactly one @, and the domain matched whole. `endsWith` alone would let
     * `me@notuniversity.edu` through a gate for `university.edu`.
     */
    const parts = trimmed.split("@");
    if (parts.length !== 2 || !parts[0]) return false;
    return parts[1] === field.domain.trim().toLowerCase();
  }

  if (!field.pattern) return false;
  try {
    /* Anchored both ends, so a pattern for six digits cannot match sixty. */
    return new RegExp(`^(?:${field.pattern})$`).test(trimmed);
  } catch {
    // A pattern an admin typed wrongly refuses everybody rather than admitting
    // everybody, which is the safe direction for a gate.
    return false;
  }
}

export type EnrolResult =
  | { ok: true; needsVerification: boolean }
  | { ok: false; error: string };

/**
 * 🔴 Enrol, or refuse. 53.18, 53.19, 53.19d, C246, C249, C250.
 *
 * ## What the sponsor learns from this call
 *
 * Nothing. Not that it happened, not that it failed, not when. C227: *the
 * sponsor never sees an enrolment event, never sees a rejection, never sees a
 * join date, and performs no act about any individual.* There is no write to a
 * sponsor-visible table here and no notification to them.
 *
 * ## 🔴 C250 — funding is FORWARD ONLY
 *
 * *A person already in paid therapy who then enrols would, on the obvious
 * build, either see past sessions refunded, or see their therapist's paid
 * history change, or both.* The enrolment row's `created_at` is the boundary and
 * nothing here touches a session that already exists.
 */
export async function enrol(input: {
  personId: string;
  code: string;
  identifier: string;
}): Promise<EnrolResult> {
  /*
   * 🔴 53.19 — rate limited per CODE, not per person.
   *
   * The attack C246 names is somebody who walks past a poster and invents a
   * plausible ID. Limiting per person would let one attacker try eight, sign up
   * again, and try eight more; the code is the thing being attacked.
   */
  const throttle = await consume(
    await callerKey(`enrol:${input.code.trim().toUpperCase()}`),
    ATTEMPTS_PER_WINDOW,
    ATTEMPT_WINDOW_SECONDS,
  );
  if (!throttle.allowed) {
    /*
     * 🔴 53.19 — a spike alerts admin AND the sponsor as a NUMBER, never names.
     *
     * Logged as a count here; the sponsor's own screen shows "attempts on your
     * code are unusually high this week" and no identifier, because a list of
     * attempted employee numbers is a list of people who tried.
     */
    log.warn("enrolment attempts throttled", { code: "[redacted]" });
    return {
      ok: false,
      error: "Too many attempts on that code. Wait a few minutes and try again.",
    };
  }

  const lookup = await lookupCode(input.code);
  if (!lookup.ok) return { ok: false, error: lookup.error };

  /*
   * 🔴 Counted here, after the code resolves, and deliberately not before.
   *
   * A spike on a LIVE code is a fact about that organisation's poster, which is what
   * the sponsor needs to see. Invented codes that resolve to nothing are a fact
   * about us and belong in the limiter above, not on a customer's screen.
   */
  await consume(
    subjectKey("enrol-code", input.code.trim().toUpperCase()),
    SPIKE_NEVER_REFUSES,
    SPIKE_WINDOW_SECONDS,
  );

  const fields = await controlDb
    .select({
      kind: sponsorIdentifierFields.kind,
      domain: sponsorIdentifierFields.domain,
      pattern: sponsorIdentifierFields.pattern,
    })
    .from(sponsorIdentifierFields)
    .where(eq(sponsorIdentifierFields.sponsorId, lookup.sponsorId));

  const crossed = fields.find((field) => matchesGate(field, input.identifier));
  if (!crossed) {
    /*
     * 🔴 The refusal says what shape was expected and NOT what was wrong with
     * what they typed.
     *
     * "That is not a valid employee number" from a product a colleague can see
     * over their shoulder is an outing risk; and telling somebody which part
     * failed is a hint to whoever is guessing.
     */
    return {
      ok: false,
      error:
        "That does not match what your organisation asks for. Check with whoever shared the code. You can use 24Therapy either way.",
    };
  }

  const identifierHash = hashIdentifier(lookup.sponsorId, input.identifier);

  /*
   * 🔴 C249 — is this their FIRST enrolment? Then it is primary.
   *
   * Read before the insert only to choose the flag, never to decide whether the
   * insert is allowed: `enrolments_one_primary` and
   * `enrolments_identifier_unique` are what make this safe under a race, and
   * the insert below is allowed to fail.
   */
  const [existing] = await controlDb
    .select({ id: enrolments.id })
    .from(enrolments)
    .where(and(eq(enrolments.personId, input.personId), isNull(enrolments.removedAt)))
    .limit(1);

  let enrolmentId: string | null = null;

  try {
    const [created] = await controlDb
      .insert(enrolments)
      .values({
        sponsorId: lookup.sponsorId,
        personId: input.personId,
        identifierHash,
        identifierKind: crossed.kind,
        isPrimary: !existing,
        /*
         * 🔴 A `domain_email` is not verified until the code sent to it is
         * answered, so `last_verified_at` stays null and the funding does not
         * start. An `id_number` has nothing to verify (C247), so it is live at
         * once and the sponsor was told that is a weaker gate.
         *
         * 🔴 "The funding does not start" is a claim about `payFromPot`, and this
         * sentence was true of the comment and false of the code for one commit.
         * `payFromPot` now has `last_verified_at IS NOT NULL` in its WHERE clause
         * alongside the pause and the removal, so an unverified enrolment funds
         * nothing. A comment asserting a wiring the code does not have is the
         * second most common defect in this repository; this was one.
         */
        lastVerifiedAt: crossed.kind === "id_number" ? new Date() : null,
      })
      .returning({ id: enrolments.id });

    enrolmentId = created?.id ?? null;
  } catch {
    /*
     * 🔴 One message for every database refusal, and it names nothing.
     *
     * A duplicate identifier, a second primary and a repeat enrolment all read
     * the same. "That identifier is already in use" tells somebody guessing
     * that they guessed a real one, which is the single most useful thing we
     * could hand them.
     */
    return {
      ok: false,
      error: "That could not be activated. Check with whoever shared the code.",
    };
  }

  /*
   * 🔴 C231 — the person's own log, with no employer named.
   *
   * A started benefit is a fact about them. The sponsor's act, when there is
   * one, lives in `audit`.
   */
  await controlDb.insert(patientNotifications).values({
    personId: input.personId,
    kind: "benefit_started",
    messageKey: "pnotice.benefitStarted",
  });

  /*
   * 🔴 53.19 / 53.18b — THE ONE AND ONLY MOMENT A WORK ADDRESS IS EVER USED.
   *
   * The plaintext identifier exists in this function's arguments and in no column
   * anywhere, because `identifier_hash` is all that is stored. So the code has to
   * go out HERE or never, and "never a destination for anything we send except the
   * one verification code" is enforced by the shape of the data rather than by
   * anybody's restraint.
   *
   * Best effort on the send: a mail provider that is down must not roll back an
   * enrolment. The person is told the code is coming and can ask again, and
   * `last_verified_at` is null meanwhile, so a failed send is a benefit that has
   * not started rather than a benefit funded without proof.
   */
  if (crossed.kind === "domain_email" && enrolmentId) {
    const { sendEnrolmentCode } = await import("./enrolment-verify");
    await sendEnrolmentCode(enrolmentId, input.identifier);
  }

  log.info("enrolment activated", { kind: crossed.kind });
  return { ok: true, needsVerification: crossed.kind === "domain_email" };
}

/**
 * 🔴 C249 / 53.19d — the patient chooses which pot pays.
 *
 * One statement, so two rows can never both be primary: clear every one of
 * theirs and set the chosen one, in a single UPDATE whose `CASE` does both.
 * The partial unique index would refuse a two-statement version mid-flight and
 * leave them with no primary at all.
 */
export async function setPrimarySponsor(
  personId: string,
  enrolmentId: string,
): Promise<{ ok?: boolean; error?: string }> {
  const updated = await controlDb
    .update(enrolments)
    .set({
      isPrimary: sql`(${enrolments.id} = ${enrolmentId})`,
      updatedAt: new Date(),
    })
    .where(and(eq(enrolments.personId, personId), isNull(enrolments.removedAt)))
    .returning({ id: enrolments.id });

  if (updated.length === 0) return { error: "You have no benefit to choose between." };
  return { ok: true };
}

/**
 * What this person's benefit is, for their own screens.
 *
 * 🔴 Their own, so it may say everything: which organisations, which is
 * primary, whether it is paused. The sponsor's view of the same rows is
 * `lib/data/sponsors.ts` and is deliberately narrower.
 */
export async function myBenefits(personId: string) {
  return controlDb
    .select({
      enrolmentId: enrolments.id,
      sponsorName: sponsors.name,
      kind: sponsors.kind,
      isPrimary: enrolments.isPrimary,
      pausedAt: enrolments.pausedAt,
      lastVerifiedAt: enrolments.lastVerifiedAt,
    })
    .from(enrolments)
    .innerJoin(sponsors, eq(sponsors.id, enrolments.sponsorId))
    .where(and(eq(enrolments.personId, personId), isNull(enrolments.removedAt)))
    .orderBy(sql`${enrolments.isPrimary} DESC`);
}
