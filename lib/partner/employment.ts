import "server-only";

import { and, eq, gt, isNull } from "drizzle-orm";

import { audit } from "@/lib/audit";
import { controlDb } from "@/lib/db";
import { enrolmentAttestations, enrolments, sponsors } from "@/lib/db/schema";
import { hashIdentifier } from "@/lib/data/enrolment";
import { log, ref } from "@/lib/logger";

import type { AuthedKey } from "./keys";

/**
 * 🔴 EMPLOYMENT VERIFICATION. PLAN.md 55.4, C255, C265.
 *
 * This is the most dangerous endpoint in the product and the file is arranged around
 * why.
 *
 * ## 🔴 C255 — IT ANSWERS ABOUT ONE PERSON AND NEVER ENUMERATES
 *
 * > *Every HR platform worth integrating (Workday, SuccessFactors, BambooHR, Oracle
 * > HCM, Personio, Zoho People) and every aggregator over them (Merge, Finch) is built
 * > around PROVISIONING: pull the directory, sync it, keep it. SCIM, the actual standard
 * > here, is a directory push. Build any of that and we hold a complete staff list for
 * > every client, which is exactly what C227's third design exists to avoid.*
 * >
 * > **Ruling: the integration answers a question about one person we already hold, and
 * > never enumerates.** No directory read, no sync, no store, no list endpoint, ever.
 *
 * So this module exports ONE function, it takes ONE identifier, and it returns ONE
 * boolean and ONE timestamp. There is no `listEnrolled`, no `search`, no `since`
 * parameter and no pagination, and the absence of those is the ticket rather than an
 * unfinished feature. Where an HR API only offers a full listing we do not integrate in
 * v1 rather than accepting the dump.
 *
 * ## 🔴 C265 — AND IT IS NOT A LOOKUP API, IT IS A STEP INSIDE ONE FLOW
 *
 * > *An API key that can ask "does this person work here" is an identity oracle, and it
 * > is pointed at our own patients. Give that key to a partner, or leak it, and somebody
 * > can test addresses and IDs against a company's directory at machine speed, using our
 * > infrastructure.*
 * >
 * > **Ruling: scoped to one sponsor, rate-limited hard, and only ever answers about an
 * > identifier a person has themselves submitted through enrolment in the last few
 * > minutes.**
 *
 * Four defences, and it is worth being explicit that only the last one is unusual:
 *
 *   1. **Scoped to one sponsor**, in `partner_api_keys.sponsor_id`, enforced by a
 *      database CHECK so a key holding `employment:verify` cannot exist without one.
 *   2. **Rate-limited hard**, and crossing the limit SUSPENDS the key rather than
 *      refusing the call, because a limiter that only refuses the surplus lets an
 *      attacker continue at the permitted speed for ever.
 *   3. **Every call audited** with the sponsor, the key and the outcome.
 *   4. 🔴 **AN ATTESTATION MUST EXIST.** The identifier has to have been offered, by the
 *      person themselves, through enrolment, within minutes, and not yet asked about.
 *      This is the one that turns an oracle into a step: without a row, there is no
 *      answer, whatever the key holds and however slowly it asks.
 *
 * ## 🔴 WHY THE ANSWER IS NOT WHAT A CALLER WOULD EXPECT
 *
 * A partner asking "is this identifier currently active" would like `false` to mean "not
 * an employee". It does not, and cannot: `false` here means "we are not currently funding
 * this person under this organisation", which is also what it says when somebody's
 * benefit is paused, when they never enrolled, and when the attestation expired thirty
 * seconds ago.
 *
 * That ambiguity is deliberate and is the point. A `false` that distinguished "no such
 * person" from "person, not funded" would be the enumeration oracle C255 forbids,
 * rebuilt out of the difference between two negatives.
 */

export type VerifyResult =
  | {
      /** 🔴 One boolean and one timestamp. C255's whole permitted answer. */
      active: boolean;
      asOf: string;
    }
  | { error: string; status: 400 | 403 | 404 };

/**
 * 🔴 ONE PERSON, ONE QUESTION, ONE BOOLEAN, ONE TIMESTAMP.
 *
 * The key comes from `authenticateKey`, which has already checked the scope, the
 * suspension and the rate. What is left here is C265's fourth defence and the audit.
 */
export async function verifyEmployment(input: {
  key: AuthedKey;
  identifier: string;
}): Promise<VerifyResult> {
  const identifier = input.identifier.trim();
  if (!identifier) return { error: "No identifier.", status: 400 };

  /*
   * 🔴 The key's OWN sponsor, never one the caller named.
   *
   * There is no `sponsorId` parameter on this function and there is no route that could
   * supply one. A caller who could name the organisation could walk every organisation
   * we have with one key, which is C265's opening sentence.
   */
  const sponsorId = input.key.sponsorId;
  if (!sponsorId) {
    /*
     * Unreachable through a stored key, because the database refuses an
     * `employment:verify` key with no sponsor. Checked anyway: the constraint protects
     * the table and this protects the function, and the day somebody adds a second way
     * to build an `AuthedKey` this is what stops it answering for everybody.
     */
    return { error: "This key is not scoped to an organisation.", status: 403 };
  }

  const [sponsor] = await controlDb
    .select({ id: sponsors.id })
    .from(sponsors)
    .where(and(eq(sponsors.id, sponsorId), eq(sponsors.state, "active")))
    .limit(1);

  if (!sponsor) return { error: "That organisation is not active.", status: 403 };

  const identifierHash = hashIdentifier(sponsorId, identifier);

  /*
   * 🔴 C265's FOURTH DEFENCE, AND IT IS A CLAIM ON A ROW.
   *
   * *Only ever answers about an identifier a person has themselves submitted through
   * enrolment in the last few minutes.*
   *
   * Claimed with a conditional UPDATE rather than read-then-write, so two calls racing
   * on one attestation cannot both be answered: the second matches nothing. That is the
   * same construction C283 required of the couples consent write, for the same reason.
   */
  const [attestation] = await controlDb
    .update(enrolmentAttestations)
    .set({ answeredAt: new Date(), answeredByKeyId: input.key.keyId })
    .where(
      and(
        eq(enrolmentAttestations.sponsorId, sponsorId),
        eq(enrolmentAttestations.identifierHash, identifierHash),
        isNull(enrolmentAttestations.answeredAt),
        gt(enrolmentAttestations.expiresAt, new Date()),
      ),
    )
    .returning({ id: enrolmentAttestations.id });

  if (!attestation) {
    /*
     * 🔴 404 AND ONE SENTENCE, for every reason.
     *
     * Nobody offered it, the offering expired, the offering was already asked about, or
     * the identifier is invented. Distinguishing those four would rebuild the oracle out
     * of error codes: "expired" tells a caller the value is real, which is the single
     * most useful thing they could learn.
     */
    await audit({
      actor: null,
      category: "admin",
      action: "partner.employment_verify.refused",
      resourceType: "sponsor",
      resourceId: sponsorId,
      reason: "no live attestation",
    });

    log.info("employment verify refused, no live attestation", { sponsor: ref(sponsorId) });
    return {
      error:
        "There is no live enrolment attempt to answer about. This endpoint answers a question inside an enrolment, not a lookup.",
      status: 404,
    };
  }

  /*
   * 🔴 The answer. A live, verified, unpaused enrolment under THIS sponsor.
   *
   * Every condition is in the WHERE clause, so there is no branch to forget and the
   * result is a boolean rather than a shape somebody could read more out of.
   */
  const [live] = await controlDb
    .select({ id: enrolments.id })
    .from(enrolments)
    .where(
      and(
        eq(enrolments.sponsorId, sponsorId),
        eq(enrolments.identifierHash, identifierHash),
        eq(enrolments.state, "active"),
        isNull(enrolments.removedAt),
        isNull(enrolments.pausedAt),
      ),
    )
    .limit(1);

  const active = live !== undefined;

  /*
   * 🔴 C265 — *every call audited with the sponsor, the key and the outcome.*
   *
   * `actor: null`, because a partner's server is not an `Actor` and never will be. The
   * partner and the key live in the reason rather than in a column, which is the honest
   * shape: `audit_log.partner_id` names the partner, and the key id is the detail that
   * answers "which of their three keys asked".
   */
  await audit({
    actor: null,
    category: "admin",
    action: "partner.employment_verify",
    resourceType: "sponsor",
    resourceId: sponsorId,
    reason: `key ${input.key.keyId} · ${active ? "active" : "not active"}`,
  });

  log.info("employment verified", { sponsor: ref(sponsorId), active });

  return { active, asOf: new Date().toISOString() };
}

/**
 * 🔴 THE ABSENCE THAT IS THE TICKET, STATED SO A VERIFIER CAN FIND IT.
 *
 * There is no `listEnrolled`, no `searchIdentifiers`, no `syncDirectory`, no
 * `changedSince` and no pagination in this module, and there never will be. C255 is a
 * rule enforced by the absence of code, which is invisible to a reader and to a verifier
 * unless something says so out loud.
 *
 * The same construction as `ATTENDANCE_IS_NEVER_CONFIRMED` in the sponsor wall and
 * `CLINIC_SEES_NO_CLINICAL_CONTENT` in the clinic's.
 */
export const THE_DIRECTORY_IS_NEVER_READ = true;
