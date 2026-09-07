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

export type ClaimState = {
  error?: string;
  sent?: boolean;
  claimId?: string;
  done?: boolean;
  /**
   * 11R.11 — which channel the code actually went by, and whether that was
   * what they asked for. Carried to the screen, never left in a server log.
   */
  channel?: "email" | "whatsapp" | null;
  fellBack?: boolean;
};

/** Steps 2–4: which records might be theirs, shown redacted. */
export async function mySuggestions(): Promise<ClaimSuggestion[]> {
  const actor = await requirePatient();
  const [account] = await db
    .select({
      email: patientAccounts.email,
      phone: patientAccounts.phone,
      personId: patientAccounts.personId,
    })
    .from(patientAccounts)
    .where(eq(patientAccounts.id, actor.accountId))
    .limit(1);

  if (!account) return [];
  return suggestionsFor({
    email: account.email,
    phone: account.phone,
    /* 22R — never offer somebody their own record as a therapist's. */
    excludePersonId: account.personId,
  });
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

  /*
   * 11R.9 — through `notify()`, not `mailClaimCode`.
   *
   * C68: sprint 11 built a real channel seam and a real Meta Cloud API client,
   * and the claim path — the one place a patient *chooses* a channel — went on
   * calling the mailer directly and writing a server-log warning when they
   * picked WhatsApp. A log line is not a fallback; it is a record that we
   * ignored them.
   */
  const { notify } = await import("@/lib/notify");

  const delivery = await notify(
    {
      email: actor.email,
      phone: actor.phone ?? null,
      // 11R.11 — their choice is honoured where it can be, and reported where
      // it cannot.
      prefers: channel,
    },
    {
      kind: "claim.code",
      subject: "Your 24Therapy verification code",
      /*
       * 🔴 Says nothing about who holds the record, or that a record exists.
       * Somebody who mistyped an address must not learn from this message that
       * a person by that name is in therapy.
       */
      body: `${result.code} is your 24Therapy verification code. It expires in 30 minutes.\n\nIf you did not ask for it, ignore this message.`,
      variables: [result.code],
    },
  );

  /*
   * 11R.11 — the patient is told which channel it actually went to, on screen.
   *
   * Choosing WhatsApp and silently getting an email is the defect. Somebody
   * who then watches WhatsApp for thirty minutes has been failed by a product
   * that knew the answer and kept it in a log file.
   */
  if (!delivery.sent) {
    return {
      error:
        "We could not send your code. Check the email address on your account, or ask your therapist for an invite link instead.",
    };
  }

  return {
    sent: true,
    claimId: result.claimId,
    channel: delivery.channel,
    // True when they asked for one thing and got another, so the screen can
    // say so rather than the server log.
    fellBack: delivery.channel !== channel,
  };
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
