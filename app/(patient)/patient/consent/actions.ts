"use server";

import { revalidatePath } from "next/cache";

import { isRejectionReason } from "@/lib/access/state";
import { decideGrant, revokeGrant } from "@/lib/data/grants";
import { askForHistory, createInvite, revokeInviteCode } from "@/lib/data/portability";
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

/* ------------------------------------------------- 27.2 · C102b · inviting */

export type InviteState = { error?: string; code?: string; expiresOn?: string };

/**
 * The patient makes a code for their next therapist. PLAN.md 27.2, C102b.
 *
 * 🔴 The word for this is **invite**, everywhere, and never "send your
 * record". Nothing moves when this is pressed: it mints six characters. A
 * clinician redeeming them creates a *request*, which this same person then
 * approves in one tap, knowing who is asking. There is no path from a code to
 * access that does not go through the patient a second time, which is C107's
 * ruling built into the shape of the flow rather than warned about.
 */
export async function inviteMyTherapist(): Promise<InviteState> {
  const actor = await requirePatient();

  const result = await createInvite({ personId: actor.personId, accountId: actor.accountId });
  if (!result.ok) return { error: result.error };

  revalidatePath("/patient/consent");
  return {
    code: result.invite.code,
    expiresOn: result.invite.expiresAt.toISOString().slice(0, 10),
  };
}

/** Cancel a code that is out in the world. */
export async function cancelInvite(inviteId: string): Promise<ConsentState> {
  const actor = await requirePatient();

  const done = await revokeInviteCode({ personId: actor.personId, inviteId });
  if (!done.ok) return { error: "That code has already been used or cancelled." };

  revalidatePath("/patient/consent");
  return { ok: true };
}

/* ------------------------------------------------ 27.7 · C108 · asking back */

/**
 * "Ask my previous therapist to add my history."
 *
 * 🔴 The copy says **ask**, never "get". We cannot promise cooperation: they
 * may have left, may want paying, may simply say no. What the product promises
 * is that the patient finds out, because C108's ruling is that a silent
 * request is worse than a refusal.
 */
export async function askPreviousTherapist(
  therapistUserId: string,
  note: string,
): Promise<ConsentState> {
  const actor = await requirePatient();

  const result = await askForHistory({
    personId: actor.personId,
    accountId: actor.accountId,
    therapistUserId,
    note,
  });

  if (!result.ok) return { error: result.error };

  revalidatePath("/patient/consent");
  return { ok: true };
}
