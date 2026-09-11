"use server";

import { revalidatePath } from "next/cache";

import { requireUser } from "@/lib/auth/guard";
import { answerAsk, redeemInvite } from "@/lib/data/portability";

export type ConnectState = {
  error?: string;
  patientName?: string;
  waitingOnVerification?: boolean;
  ok?: boolean;
};

/**
 * A clinician enters the code their patient gave them. PLAN.md 27.2, 27.3.
 *
 * 🔴 This does not produce access and cannot be made to. It creates a pending
 * request, which the patient answers. What comes back is a first name, so the
 * clinician knows they did not mistype, and nothing else about the record.
 *
 * It works before verification is approved (27.3, C131), because a patient who
 * has chosen somebody should not be blocked by our queue. The grant itself
 * cannot activate until we approve them, which the database enforces.
 */
export async function useInviteCode(
  _prev: ConnectState,
  formData: FormData,
): Promise<ConnectState> {
  const actor = await requireUser();

  const result = await redeemInvite(actor, String(formData.get("code") ?? ""));
  if (!result.ok) return { error: result.error };

  revalidatePath("/connect");
  revalidatePath("/patients");
  return {
    ok: true,
    patientName: result.patientName,
    waitingOnVerification: result.waitingOnVerification,
  };
}

/**
 * Answering a request for history. PLAN.md 27.7, C108.
 *
 * A decline needs a reason and the database refuses one without. The patient
 * reads it verbatim, which is the whole ruling: "no" with an explanation is
 * something a person can act on, and silence is not.
 */
export async function answerHistoryAsk(
  _prev: ConnectState,
  formData: FormData,
): Promise<ConnectState> {
  const actor = await requireUser();

  const result = await answerAsk(actor, {
    askId: String(formData.get("askId") ?? ""),
    decision: formData.get("decision") === "added" ? "added" : "declined",
    reason: String(formData.get("reason") ?? ""),
  });

  if (!result.ok) return { error: result.error };

  revalidatePath("/connect");
  return { ok: true };
}
