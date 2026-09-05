"use server";

import { revalidatePath } from "next/cache";

import {
  appendMessage,
  askAssistant,
  assistantAllowance,
  createThread,
  deleteThread,
  messagesIn,
  saveAssistantPrefs,
  threadFor,
  titleFromFirstQuestion,
} from "@/lib/ai/assistant";
import { requireUser } from "@/lib/auth/guard";
import { log, safeErrorMessage } from "@/lib/logger";

export type AskState = {
  error?: string;
  answer?: { content: string; mentions: { patientId: string; name: string }[] };
  used?: number;
  limit?: number;
  exhausted?: boolean;
};

/**
 * Ask the general copilot. PLAN.md 10.1 / 10.5.
 *
 * The allowance is checked **before** the model call and the question is only
 * stored once it is going to be answered — a clinician who is out of messages
 * should not have spent one to find out.
 */
export async function ask(threadId: string, question: string): Promise<AskState> {
  const actor = await requireUser();

  const trimmed = question.trim();
  if (!trimmed) return { error: "Type a question first." };
  if (trimmed.length > 2000) return { error: "That question is too long." };

  // Scoped by user, so a thread id from a URL opens nothing else.
  const thread = await threadFor(actor.userId, threadId);
  if (!thread) return { error: "That conversation is gone." };

  const allowance = await assistantAllowance(actor.userId);
  if (!allowance.allowed) {
    return {
      exhausted: true,
      used: allowance.used,
      limit: allowance.limit,
      error: `You have used all ${allowance.limit} general questions this month. They reset on the 1st. Questions about a specific patient come out of that patient's own allowance, not this one.`,
    };
  }

  const history = await messagesIn(actor.userId, threadId);

  await appendMessage({
    threadId,
    userId: actor.userId,
    role: "therapist",
    content: trimmed,
  });
  await titleFromFirstQuestion(threadId, trimmed);

  try {
    const result = await askAssistant({
      threadId,
      userId: actor.userId,
      organizationId: actor.organizationId,
      role: actor.role,
      question: trimmed,
      history: history.map((m) => ({ role: m.role, content: m.content })),
    });

    await appendMessage({
      threadId,
      userId: actor.userId,
      role: "assistant",
      content: result.answer,
      /*
       * 10.3 — the mentions the **server** resolved against the real roster,
       * stored on the row. A name the model invented is not in this array, so
       * a re-render months later cannot turn it into a link either.
       */
      mentions: result.mentions,
    });

    revalidatePath("/assistant");
    return {
      answer: { content: result.answer, mentions: result.mentions },
      used: allowance.used + 1,
      limit: allowance.limit,
    };
  } catch (error) {
    log.error("assistant ask failed", { reason: safeErrorMessage(error) });
    return { error: "The assistant could not answer just now. Try again in a moment." };
  }
}

export async function startThread(): Promise<{ id?: string; error?: string }> {
  const actor = await requireUser();
  const id = await createThread(actor);
  if (!id) return { error: "Could not start a conversation." };
  revalidatePath("/assistant");
  return { id };
}

export async function removeThread(threadId: string): Promise<{ error?: string; ok?: boolean }> {
  const actor = await requireUser();
  const deleted = await deleteThread(actor.userId, threadId);
  if (!deleted) return { error: "That conversation is already gone." };
  revalidatePath("/assistant");
  return { ok: true };
}

/** 10.6 — asked once, editable later. */
export async function savePrefs(prefs: {
  language: string;
  voice: "british_female" | "american_male" | "american_female" | "british_male";
  voiceSpeed: number;
}): Promise<{ error?: string; ok?: boolean }> {
  const actor = await requireUser();
  await saveAssistantPrefs(actor.userId, prefs);
  revalidatePath("/assistant");
  return { ok: true };
}
