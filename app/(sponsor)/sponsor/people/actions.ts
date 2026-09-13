"use server";

import { revalidatePath } from "next/cache";

import { REMOVAL_REASONS, type RemovalReason } from "@/lib/db/schema";
import { removeFromRoster } from "@/lib/data/sponsors";
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

  revalidatePath("/sponsor/people");
  return { ok: true };
}
