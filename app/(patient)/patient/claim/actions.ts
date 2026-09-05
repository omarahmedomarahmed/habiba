"use server";

import { revalidatePath } from "next/cache";

import { requirePatient } from "@/lib/patient-auth/guard";
import {
  rejectClaim,
  startClaim,
  suggestionsFor,
  verifyClaim,
  type ClaimSuggestion,
} from "@/lib/data/claims";
import { db } from "@/lib/db";
import { patientAccounts } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { sendClaimCode as mailClaimCode } from "@/lib/mail";
import { log } from "@/lib/logger";

export type ClaimState = { error?: string; sent?: boolean; claimId?: string; done?: boolean };

/** Steps 2–4: which records might be theirs, shown redacted. */
export async function mySuggestions(): Promise<ClaimSuggestion[]> {
  const actor = await requirePatient();
  const [account] = await db
    .select({ email: patientAccounts.email, phone: patientAccounts.phone })
    .from(patientAccounts)
    .where(eq(patientAccounts.id, actor.accountId))
    .limit(1);

  if (!account) return [];
  return suggestionsFor({ email: account.email, phone: account.phone });
}

/**
 * Step 5: send the code.
 *
 * The code is generated in `lib/data/claims.ts` and sent here, because a data
 * module that sends messages is a data module you cannot test. WhatsApp is not
 * wired up — the ticket asks for it and there is no provider — so choosing it
 * falls back to email and says so rather than silently sending nothing. See
 * C43.
 */
export async function sendClaimCode(
  personId: string,
  channel: "email" | "whatsapp",
): Promise<ClaimState> {
  const actor = await requirePatient();

  const result = await startClaim({ personId, accountId: actor.accountId, channel });
  if (!result.ok) return { error: result.error };

  if (channel === "whatsapp") {
    log.warn("whatsapp verification requested but no provider is configured");
  }

  await mailClaimCode({ to: actor.email, code: result.code });

  return { sent: true, claimId: result.claimId };
}

/** Steps 6–8. `therapistKeepsAccess` is passed explicitly; there is no default. */
export async function confirmClaim(input: {
  claimId: string;
  code: string;
  therapistKeepsAccess: boolean;
}): Promise<ClaimState> {
  const actor = await requirePatient();

  const result = await verifyClaim({
    claimId: input.claimId,
    accountId: actor.accountId,
    code: input.code,
    therapistKeepsAccess: input.therapistKeepsAccess,
  });

  if (!result.ok) return { error: result.error };
  revalidatePath("/patient");
  return { done: true };
}

/** §3: they say no. Recorded, so nobody is asked the same thing twice. */
export async function declineClaim(claimId: string): Promise<ClaimState> {
  const actor = await requirePatient();
  await rejectClaim({ claimId, accountId: actor.accountId });
  return { done: true };
}

/** 6.10: redeem an invite a therapist handed over. */
export async function acceptInvite(input: {
  token: string;
  therapistKeepsAccess: boolean;
}): Promise<ClaimState> {
  const actor = await requirePatient();
  const { redeemInvite } = await import("@/lib/data/claims");

  const result = await redeemInvite({
    token: input.token,
    accountId: actor.accountId,
    therapistKeepsAccess: input.therapistKeepsAccess,
  });

  if (!result.ok) return { error: result.error };
  revalidatePath("/patient");
  return { done: true };
}
