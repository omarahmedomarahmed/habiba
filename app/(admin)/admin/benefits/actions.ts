"use server";

import { revalidatePath } from "next/cache";

import { audit } from "@/lib/audit";
import { requireRole } from "@/lib/auth/guard";
import { unpause } from "@/lib/data/enrolment-verify";

export type LiftPauseState = { error?: string; ok?: boolean };

/**
 * 🔴 C247 — "the pause must be reversible by us in one step", and this is the step.
 *
 * ## Why this action exists at all
 *
 * `unpause` was written when C247 was ruled and then sat with no caller through
 * four sprints. `verify:reachable` named it in `MUST_WIRE` for that reason: a
 * safety function written for a named ruling and reachable from nothing is the
 * ruling not shipped. The promise was in the comment and the button was nowhere.
 *
 * ## 🔴 `super_admin`, and not `requireStaff`
 *
 * Lifting a pause restarts somebody's employer funding without the proof the
 * cycle exists to collect. That is the same authority as opening a pot, not the
 * same as answering a ticket, and it is the one act in this flow that can be
 * wrong in the expensive direction.
 *
 * ## 🔴 AUDITED, with a real actor
 *
 * The whole point of the re-verification cycle is that funding tracks proof
 * (C247). An operator overriding that is a decision somebody may have to account
 * for later, so it leaves a row naming who did it and which enrolment.
 *
 * 🔴 The audit row carries the ENROLMENT id and no sponsor. C244: nothing joins
 * a payer to a named person on a surface a payer can reach, and an audit row
 * reading "lifted Ahmed's pause at Acme" is that join written down.
 */
export async function liftPause(enrolmentId: string): Promise<LiftPauseState> {
  const actor = await requireRole("super_admin");

  if (!enrolmentId) return { error: "No benefit chosen." };

  await unpause(enrolmentId);

  await audit({
    actor,
    category: "admin",
    action: "benefit.pause_lifted",
    resourceType: "enrolment",
    resourceId: enrolmentId,
  });

  revalidatePath("/admin/benefits");
  return { ok: true };
}
