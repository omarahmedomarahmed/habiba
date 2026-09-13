"use server";

import { revalidatePath } from "next/cache";

import { topUpPot } from "@/lib/billing/pot";
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

  revalidatePath("/sponsor/pot");
  revalidatePath("/sponsor");
  return { ok: true };
}
