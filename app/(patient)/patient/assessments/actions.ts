"use server";

import { revalidatePath } from "next/cache";

import { completeAssignment, recordAnswer } from "@/lib/data/assessments";
import { requirePatient } from "@/lib/patient-auth/guard";

export type AnswerState = { error?: string; ok?: boolean };

/**
 * The person answers one question. PLAN.md 56.3, 56.7.
 *
 * 🔴 The person id comes from the SESSION, never from the form.
 *
 * Everything else here does come from the client — the assignment id, the
 * question, the value, and the milliseconds — and every one of them is checked
 * against the instrument and against this person's own `patients` rows inside
 * `recordAnswer`. An assignment id posted by somebody who is not its owner is
 * the difference between a questionnaire and a stranger reading item 9 of a
 * PHQ-9 that was never theirs.
 */
export async function answerQuestion(
  assignmentId: string,
  questionKey: string,
  value: number,
  answerMs: number | null,
): Promise<AnswerState> {
  const actor = await requirePatient();

  const result = await recordAnswer({
    assignmentId,
    personId: actor.personId,
    questionKey,
    value,
    answerMs,
  });

  if (result.error) return { error: result.error };
  return { ok: true };
}

/**
 * They reach the end. 56.3.
 *
 * 🔴 Returns nothing. Not the score, not a band, not a word about what the
 * answers mean — `completeAssignment` computes and freezes the number, and
 * this action deliberately drops it on the floor rather than handing it to the
 * screen the person is looking at (56.9, C113).
 */
export async function finishAssessment(assignmentId: string): Promise<AnswerState> {
  const actor = await requirePatient();

  const score = await completeAssignment(assignmentId, actor.personId);
  if (score === null) return { error: "That assessment could not be finished." };

  revalidatePath("/patient/assessments");
  revalidatePath("/patient");
  return { ok: true };
}
