"use server";

import { revalidatePath } from "next/cache";

import { explain } from "@/lib/access/state";
import { askPatientCopilot } from "@/lib/ai/patient-copilot";
import { accessFor } from "@/lib/data/grants";
import { requireUser } from "@/lib/auth/guard";
import {
  addGuidance,
  appendMessage,
  checkQuota,
  getOrCreateThread,
  removeGuidanceLine,
  resetCopilotConversation,
  setReplyLanguage,
  auditThreadRead,
} from "@/lib/data/copilot";
import { liveSessionForPatient } from "@/lib/data/sessions";
import type { Citation } from "@/lib/db/schema";
import { log, safeErrorMessage } from "@/lib/logger";

export type AskState = {
  error?: string;
  quotaExhausted?: boolean;
  answer?: { content: string; citations: Citation[] };
  suggestedPrompts?: string[];
  used?: number;
  limit?: number | null;
};

export async function askCopilot(patientId: string, question: string): Promise<AskState> {
  const actor = await requireUser();

  const trimmed = question.trim();
  if (!trimmed) return { error: "Type a question first." };
  if (trimmed.length > 2000) return { error: "That question is too long." };

  // The thread is reached through the patient, and the patient is scoped to
  // this clinician's caseload — so a thread id from a URL can never be used to
  // open someone else's conversation.
  const found = await getOrCreateThread(actor, patientId);
  if (!found) return { error: "Patient not found." };

  /*
   * 7.7 — the four states, checked before anything is spent.
   *
   * Before the quota rather than after: a refusal that has already consumed a
   * credit is a refusal the clinician pays for. `capabilities.copilot` is only
   * false in the "no relationship" state, which `getOrCreateThread` already
   * makes unreachable — so this is the belt to that braces, and the place the
   * next state to lose the copilot will be handled.
   */
  const access = await accessFor(actor, patientId);
  if (!access.capabilities.copilot) {
    return { error: explain(access.state) ?? "You cannot use the copilot for this patient." };
  }

  const quota = await checkQuota(actor, found.thread.id);
  if (!quota.allowed) {
    /*
     * The old wording said "…for this patient this month. Unlimited removes the
     * cap." Both halves were left behind by sprint 1: the allowance is no
     * longer monthly, and there is no Unlimited plan to sell. Telling a
     * clinician to wait for a reset that never comes, or to buy something that
     * does not exist, is worse than the cap itself.
     */
    return {
      quotaExhausted: true,
      used: quota.used,
      limit: quota.limit,
      error: `You have used all ${quota.limit} copilot questions for this patient. Each session you complete with them earns more, and unused ones roll over.`,
    };
  }

  await auditThreadRead(actor, patientId, found.thread.id);

  /*
   * Stamp the live session, when there is one.
   *
   * `copilot_messages.session_id` existed already but was only ever written on
   * `session_note` rows — measured on the sprint database: 97 of 97 notes
   * carry one, 0 of 23 therapist questions do. So "how much copilot did this
   * session use" had no answer, which is exactly what /on-call is asked to
   * show.
   *
   * Null when the clinician is asking between sessions, and that is a real
   * answer rather than a missing one: a question asked on a Tuesday afternoon
   * about a patient seen last week belongs to no session.
   */
  const liveSessionId = await liveSessionForPatient(actor, patientId);
  await appendMessage({
    threadId: found.thread.id,
    role: "therapist",
    content: trimmed,
    sessionId: liveSessionId,
  });

  try {
    const result = await askPatientCopilot({
      threadId: found.thread.id,
      patientId,
      organizationId: actor.organizationId,
      userId: actor.userId,
      question: trimmed,
      guidance: found.thread.guidance,
      replyLanguage: found.thread.replyLanguage,
      /*
       * What this clinician may read, passed down rather than re-derived.
       * The copilot's context is assembled from the database and a second
       * opinion about consent would be a second place for it to be wrong.
       */
      capabilities: access.capabilities,
    });

    await appendMessage({
      threadId: found.thread.id,
      role: "copilot",
      content: result.answer,
      citations: result.citations,
      // The answer belongs to the same session as the question that caused it.
      sessionId: liveSessionId,
    });

    revalidatePath(`/copilot/${patientId}`);
    return {
      answer: { content: result.answer, citations: result.citations },
      suggestedPrompts: result.suggestedPrompts,
      used: quota.used + 1,
      limit: quota.limit,
    };
  } catch (error) {
    log.error("copilot ask failed", { reason: safeErrorMessage(error) });
    return { error: "The copilot could not answer just now. Try again in a moment." };
  }
}

/**
 * Correct the copilot.
 *
 * The correction is appended to standing guidance for this patient's thread, so
 * it changes future behaviour rather than being forgotten at the end of the
 * turn. That is the difference between "you can tell it it's wrong" and "you
 * can teach it".
 */
export async function correctCopilot(
  patientId: string,
  correction: string,
): Promise<{ error?: string; ok?: boolean }> {
  const actor = await requireUser();
  const trimmed = correction.trim();
  if (!trimmed) return { error: "Write what it got wrong." };

  const found = await getOrCreateThread(actor, patientId);
  if (!found) return { error: "Patient not found." };

  await addGuidance(actor, found.thread.id, trimmed);
  revalidatePath(`/copilot/${patientId}`);
  return { ok: true };
}

/**
 * Choose the language the copilot answers this patient's thread in.
 *
 * Per thread rather than per clinician: somebody running a bilingual practice
 * works in Arabic with one person and English with the next, and a global
 * setting would be wrong for half their caseload.
 */
export async function setCopilotLanguage(
  patientId: string,
  language: string,
): Promise<{ error?: string; ok?: boolean }> {
  const actor = await requireUser();
  const found = await getOrCreateThread(actor, patientId);
  if (!found) return { error: "Patient not found." };

  const result = await setReplyLanguage(actor, found.thread.id, language);
  if (result.error) return result;

  revalidatePath(`/copilot/${patientId}`);
  return { ok: true };
}

/** Remove one standing correction, leaving the rest and the chat alone. */
export async function removeCorrection(
  patientId: string,
  line: string,
): Promise<{ error?: string; ok?: boolean }> {
  const actor = await requireUser();
  const found = await getOrCreateThread(actor, patientId);
  if (!found) return { error: "Patient not found." };

  const result = await removeGuidanceLine(actor, found.thread.id, line);
  if (result.error) return result;

  revalidatePath(`/copilot/${patientId}`);
  return { ok: true };
}

/**
 * Start the conversation over.
 *
 * What goes: the therapist's questions, the copilot's answers to them, and the
 * standing corrections that came out of that exchange. What stays: everything
 * the copilot wrote *during* a session, and every transcript — neither is the
 * clinician's to erase, and both are what the copilot rebuilds from.
 *
 * The rebuild needs no work here. The copilot reads the chart on every
 * question, so the very next message already has the full history behind it;
 * only the chat that had gone stale is gone.
 */
export async function resetCopilot(
  patientId: string,
): Promise<{ error?: string; removed?: number; kept?: number }> {
  const actor = await requireUser();

  const result = await resetCopilotConversation(actor, patientId);
  if (!result) return { error: "Patient not found." };

  revalidatePath(`/copilot/${patientId}`);
  revalidatePath("/copilot");
  return result;
}
