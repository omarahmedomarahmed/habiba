"use server";

import { revalidatePath } from "next/cache";

import { audit } from "@/lib/audit";
import { REMOVAL_REASONS, type RemovalReason } from "@/lib/db/schema";
import { pauseBenefit, removeFromRoster, resumeBenefit } from "@/lib/data/sponsors";
import { requireSponsorAdmin } from "@/lib/sponsor-auth/guard";

export type RemoveState = { error?: string; ok?: boolean };

/**
 * 🔴 C234 / 53.17b — THE SPONSOR'S ONE AND ONLY INDIVIDUAL-LEVEL POWER.
 *
 * *"The sponsor never sees an enrolment, a rejection or a join date, and performs
 * no act about any individual. Their only individual-level power is removal."*
 *
 * So this file has one action in it, and there is nothing else in the whole
 * portal that names a person and writes. No approve, no reject, no pause, no
 * note, no export. Anything that arrives later wanting one of those has to add it
 * here, in front of this paragraph.
 *
 * 🔴 `requireSponsorAdmin`, not `requireSponsor`. An HR analyst reading spend
 * figures must not be able to end somebody's therapy funding by mis-tapping.
 *
 * 🔴 The reason is one of four fixed values and it is validated here as well as
 * in the database. A sponsor typing a reason is a sponsor writing a sentence
 * about an individual into our database, which is the one act C227 says they
 * never perform.
 */
export async function endBenefit(enrolmentId: string, reason: string): Promise<RemoveState> {
  const actor = await requireSponsorAdmin();

  if (!REMOVAL_REASONS.includes(reason as RemovalReason)) {
    return { error: "Pick one of the reasons." };
  }

  const result = await removeFromRoster({
    sponsorId: actor.sponsorId,
    enrolmentId,
    reason: reason as RemovalReason,
    bySponsorUserId: actor.sponsorUserId,
  });

  if (result.error) return { error: result.error };

  /*
   * 🔴 C234 / 0086 — THE PAYER'S ACT, WRITTEN DOWN.
   *
   * `removeFromRoster` has taken `bySponsorUserId` since sprint 53 with the
   * comment "for `audit`" and passed it to nothing, so ending somebody's
   * funding was the one individual-level power a sponsor has and the one act
   * in the product nobody could attribute afterwards.
   *
   * 🔴 The row names the ENROLMENT and the reason, and no patient. C227 keeps
   * the payer away from the person; this keeps the person's id out of a row
   * about what the payer did. "Which of our people did you remove" is
   * answerable from the enrolment, by us, and is not a question a payer asks
   * an audit log.
   */
  await audit({
    /* Explicit, like every other call site: this act has no clinician actor. */
    actor: null,
    sponsorUserId: actor.sponsorUserId,
    category: "admin",
    action: "benefit.ended",
    resourceType: "enrolment",
    resourceId: enrolmentId,
    reason,
  });

  revalidatePath("/sponsor/people");
  return { ok: true };
}

/**
 * 🔴 W2-S11 / D1 — PAUSE AND RESUME, beside END.
 *
 * The founder's decision widened the paragraph above: a company controls its
 * employees' benefit (end, pause, resume) and still performs no act that reads
 * anything about their use of it. Admin only, audited against the enrolment,
 * and the person is told in the app with no employer and no reason (C231).
 */
export async function pauseTheirBenefit(enrolmentId: string): Promise<RemoveState> {
  const actor = await requireSponsorAdmin();
  const result = await pauseBenefit({ sponsorId: actor.sponsorId, enrolmentId });
  if (result.error) return { error: result.error };

  await audit({
    actor: null,
    sponsorUserId: actor.sponsorUserId,
    category: "admin",
    action: "benefit.paused",
    resourceType: "enrolment",
    resourceId: enrolmentId,
  });

  revalidatePath("/sponsor/people");
  return { ok: true };
}

export async function resumeTheirBenefit(enrolmentId: string): Promise<RemoveState> {
  const actor = await requireSponsorAdmin();
  const result = await resumeBenefit({ sponsorId: actor.sponsorId, enrolmentId });
  if (result.error) return { error: result.error };

  await audit({
    actor: null,
    sponsorUserId: actor.sponsorUserId,
    category: "admin",
    action: "benefit.resumed",
    resourceType: "enrolment",
    resourceId: enrolmentId,
  });

  revalidatePath("/sponsor/people");
  return { ok: true };
}
