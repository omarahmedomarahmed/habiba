"use server";

import { revalidatePath } from "next/cache";

import { audit } from "@/lib/audit";
import { topUpPot } from "@/lib/billing/pot";
import { setCoverage } from "@/lib/data/sponsors";
import { getSettings } from "@/lib/settings";
import { requireSponsorAdmin } from "@/lib/sponsor-auth/guard";

export type TopUpState = { error?: string; ok?: boolean };

/**
 * 53.11 — money in. Admin only, for the obvious reason.
 *
 * 🔴 The amount is in whole units on the form and cents everywhere else, converted
 * once, here. A form that posted cents would let somebody type 5000 meaning dollars
 * and buy fifty of them.
 *
 * 🔴 Every other rule about this — the minimum, the terms, the Egyptian entity
 * gate — is inside `topUpPot`, not here. A rule enforced in a server action is a
 * rule that holds for one button; one enforced in the function that moves the
 * money holds for the next caller too.
 */
export async function addToPot(_prev: TopUpState, formData: FormData): Promise<TopUpState> {
  const actor = await requireSponsorAdmin();

  const units = Number(String(formData.get("amount") ?? "").replace(/[, ]/g, ""));
  if (!Number.isFinite(units) || units <= 0) return { error: "Enter an amount." };

  const result = await topUpPot({
    sponsorId: actor.sponsorId,
    amountCents: Math.round(units * 100),
    bySponsorUserId: actor.sponsorUserId,
  });

  if (result.error) return { error: result.error };

  /*
   * 🔴 0086 — money into a pot is a billing act by a named person at a customer.
   *
   * The ledger already records that the pot grew. It does not record WHO at the
   * organisation pressed the button, which is the question asked when a finance
   * team disputes a top-up.
   */
  await audit({
    /* Explicit, like every other call site: this act has no clinician actor. */
    actor: null,
    sponsorUserId: actor.sponsorUserId,
    category: "billing",
    action: "pot.topped_up",
    resourceType: "sponsor",
    resourceId: actor.sponsorId,
  });

  revalidatePath("/sponsor/pot");
  revalidatePath("/sponsor");
  return { ok: true };
}


export type CoverageState = { error?: string; ok?: boolean; message?: string };

/**
 * 🔴 60.1 to 60.6 / C311 / C344 / C345 — what this employer covers.
 *
 * 🔴 `requireSponsorAdmin`, like every other money door here. Changing the
 * percentage changes what every one of their people is asked to pay, which is
 * the same authority as topping up the pot.
 *
 * 🔴 The asymmetry lives in `setCoverage` rather than here, so it holds for the
 * next caller too: an increase is immediate, a decrease waits out the notice
 * window. A rule enforced in a server action is a rule that holds for one
 * button.
 */
export async function setCoveragePercent(
  _prev: CoverageState,
  formData: FormData,
): Promise<CoverageState> {
  const actor = await requireSponsorAdmin();

  const percent = Number(String(formData.get("percent") ?? ""));
  if (!Number.isFinite(percent)) return { error: "Choose a percentage." };

  const settings = await getSettings();

  const result = await setCoverage({
    sponsorId: actor.sponsorId,
    coverageBps: Math.round(percent * 100),
    noticeDays: settings.sponsor.coverageNoticeDays,
    bySponsorUserId: actor.sponsorUserId,
  });

  if (result.error) return { error: result.error };

  await audit({
    /* Explicit, like every other call site: this act has no clinician actor. */
    actor: null,
    sponsorUserId: actor.sponsorUserId,
    category: "admin",
    action: "coverage.set",
    resourceType: "sponsor",
    resourceId: actor.sponsorId,
    reason: `${percent}%`,
  });

  revalidatePath("/sponsor/pot");

  /*
   * 🔴 The message says WHEN, because a reduction that appears to have saved
   * and changed nothing reads as a bug. It is the notice window doing exactly
   * what it is for.
   */
  const from = result.effectiveFrom;
  const immediate = !from || from.getTime() <= Date.now() + 60_000;
  return {
    ok: true,
    message: immediate
      ? `Your people now pay ${100 - percent}% of a session.`
      : `Saved. This takes effect on ${from.toISOString().slice(0, 10)}, so anybody who has already booked keeps the percentage they agreed to.`,
  };
}
