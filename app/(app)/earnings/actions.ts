"use server";

import { revalidatePath } from "next/cache";

import { audit } from "@/lib/audit";
import { requireUser } from "@/lib/auth/guard";
import {
  requestPayout as requestManualPayout,
  savePayoutMethod,
} from "@/lib/billing/payouts";
import { PAYOUT_METHODS, type PayoutMethod } from "@/lib/db/schema";

export type EarningsState = { error?: string; ok?: boolean };

/**
 * Where a clinician's money goes on the manual rail. PLAN.md 16.2.
 *
 * The full name is asked for **as it appears on that account**, and the field
 * says so, because a transfer to a name the bank does not match is a transfer
 * that bounces after a person has already done the work at three in the
 * morning.
 */
export async function savePayoutDestination(
  _prev: EarningsState,
  formData: FormData,
): Promise<EarningsState> {
  const actor = await requireUser();

  const method = String(formData.get("method") ?? "").trim();
  if (!PAYOUT_METHODS.includes(method as PayoutMethod)) {
    return { error: "Choose how you would like to be paid." };
  }

  const result = await savePayoutMethod({
    therapistId: actor.userId,
    organizationId: actor.organizationId,
    method: method as PayoutMethod,
    identifier: String(formData.get("identifier") ?? ""),
    accountName: String(formData.get("accountName") ?? ""),
    /*
     * 🔴 C74 — stamped even when the clinician edits their own details. The
     * rule is about who last touched the destination, and "it was their own
     * account" is exactly the case the second signature is protecting.
     */
    editedByUserId: actor.userId,
  });

  if (result.error) return { error: result.error };

  await audit({
    actor,
    category: "billing",
    action: "payout.method.saved",
    resourceType: "user",
    resourceId: actor.userId,
  });

  revalidatePath("/earnings");
  return { ok: true };
}

/** A clinician asks for money we are holding. 16.2. */
export async function requestWithdrawal(
  _prev: EarningsState,
  formData: FormData,
): Promise<EarningsState> {
  const actor = await requireUser();

  const dollars = Number(String(formData.get("amountDollars") ?? "").trim() || "0");
  const result = await requestManualPayout({
    therapistId: actor.userId,
    organizationId: actor.organizationId,
    amountCents: Math.round(dollars * 100),
  });

  if (result.error) return { error: result.error };

  await audit({
    actor,
    category: "billing",
    action: "payout.requested",
    resourceType: "payout_request",
    resourceId: result.id ?? actor.userId,
  });

  revalidatePath("/earnings");
  return { ok: true };
}
