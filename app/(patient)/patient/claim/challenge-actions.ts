"use server";

import { revalidatePath } from "next/cache";

import { answerName, answerSeen, type AnswerResult } from "@/lib/data/challenge";
import { audit } from "@/lib/audit";
import { requirePatient } from "@/lib/patient-auth/guard";
import { callerKey, consume } from "@/lib/rate-limit";

/**
 * The two questions. PLAN.md 13.6, §3b steps 5–6.
 *
 * Both actions re-read the account from the session rather than trusting an id
 * from the client — the whole point of the challenge is that the caller has not
 * proved anything yet, and an `accountId` in a form body is not proof of
 * anything at all.
 */

/** *Have you seen this therapist before?* */
export async function saySeen(patientId: string, seen: boolean): Promise<AnswerResult> {
  const actor = await requirePatient();

  const result = await answerSeen({ accountId: actor.accountId, patientId, seen });

  await audit({
    actor: null,
    patientAccountId: actor.accountId,
    category: "phi_access",
    action: seen ? "claim.challenge.seen" : "claim.challenge.declined",
    resourceType: "patient",
    resourceId: patientId,
  });

  revalidatePath("/patient/claim");
  return result;
}

/**
 * *What name did you give them?*
 *
 * 🔴 Throttled on the caller **as well as** counted on the claim.
 *
 * `answerName` counts attempts per claim, which is what stops somebody
 * grinding one record's name from a hundred addresses. This limit is the other
 * axis: one caller working through many records three guesses at a time. The
 * two together mean neither a fresh IP nor a fresh record buys a fresh budget.
 */
export async function sayName(patientId: string, name: string): Promise<AnswerResult> {
  const actor = await requirePatient();

  const throttle = await consume(await callerKey("claim:name"), 12, 60 * 60);
  if (!throttle.allowed) {
    return {
      ok: false,
      error: "Too many attempts. Try again later, or ask your therapist for an invite link.",
    };
  }

  const result = await answerName({ accountId: actor.accountId, patientId, name });

  await audit({
    actor: null,
    patientAccountId: actor.accountId,
    category: "phi_access",
    action: result.ok ? "claim.challenge.passed" : "claim.challenge.failed",
    resourceType: "patient",
    resourceId: patientId,
  });

  revalidatePath("/patient/claim");
  return result;
}
