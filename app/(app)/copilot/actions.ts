"use server";

import { revalidatePath } from "next/cache";

import { askPatientCopilot } from "@/lib/ai/patient-copilot";
import { requireUser } from "@/lib/auth/guard";
import {
  addGuidance,
  appendMessage,
  checkQuota,
  getOrCreateThread,
  resetCopilotConversation,
  auditThreadRead,
} from "@/lib/data/copilot";
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

  const quota = await checkQuota(actor, found.thread.id);
  if (!quota.allowed) {
    return {
      quotaExhausted: true,
      used: quota.used,
      limit: quota.limit,
      error: `You have used all ${quota.limit} copilot messages for this patient this month. Unlimited removes the cap.`,
    };
  }

  await auditThreadRead(actor, patientId, found.thread.id);
  await appendMessage({ threadId: found.thread.id, role: "therapist", content: trimmed });

  try {
    const result = await askPatientCopilot({
      threadId: found.thread.id,
      patientId,
      organizationId: actor.organizationId,
      userId: actor.userId,
      question: trimmed,
      guidance: found.thread.guidance,
    });

    await appendMessage({
      threadId: found.thread.id,
      role: "copilot",
      content: result.answer,
      citations: result.citations,
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
