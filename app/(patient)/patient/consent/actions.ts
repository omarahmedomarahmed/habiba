"use server";

import { revalidatePath } from "next/cache";

import { isRejectionReason } from "@/lib/access/state";
import { decideGrant, revokeGrant } from "@/lib/data/grants";
import { requirePatient } from "@/lib/patient-auth/guard";
import type { GrantShape } from "@/lib/db/schema";

export type ConsentState = { error?: string; ok?: boolean };

/**
 * The person answers a request. PLAN.md 7.2 / 7.4.
 *
 * `personId` comes from the signed-in actor, never from the form — the grant
 * id in a request body is untrusted, and `decideGrant` matches on both, so a
 * borrowed id decides nothing.
 */
export async function answerRequest(
  grantId: string,
  decision: "granted" | "rejected",
  options: { shape?: GrantShape; reason?: string } = {},
): Promise<ConsentState> {
  const actor = await requirePatient();

  const result = await decideGrant({
    accountId: actor.accountId,
    personId: actor.personId,
    grantId,
    decision,
    shape: options.shape,
    /*
     * Only a preset reason is stored. §3 offers "silently, or with a preset
     * reason", and free text would put whatever a distressed person typed in
     * front of the clinician they are declining — which is a message they did
     * not choose to send.
     */
    reason: isRejectionReason(options.reason) ? options.reason : null,
  });

  if (!result.ok) return { error: result.error };

  revalidatePath("/patient/consent");
  return { ok: true };
}

/** 7.5 — one tap, effective on the next read. */
export async function revoke(grantId: string): Promise<ConsentState> {
  const actor = await requirePatient();

  const result = await revokeGrant({
    accountId: actor.accountId,
    personId: actor.personId,
    grantId,
  });

  if (!result.ok) return { error: result.error };

  revalidatePath("/patient/consent");
  return { ok: true };
}
