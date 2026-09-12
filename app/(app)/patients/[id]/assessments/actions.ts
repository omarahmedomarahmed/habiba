"use server";

import { revalidatePath } from "next/cache";

import { requireUser } from "@/lib/auth/guard";
import {
  answerTimings,
  assignInstrument,
  assignmentProgress,
  bandFor,
  instrumentByKey,
} from "@/lib/data/assessments";
import { accessFor } from "@/lib/data/grants";
import { getPatient } from "@/lib/data/patients";

export type AssessmentActionState = { error?: string; ok?: boolean };

/**
 * Sending somebody a questionnaire. PLAN.md 56.4, 56.6.
 *
 * The same gate as homework, for the same reason and with more force. An
 * assessment is the other surface that REACHES OUT to a patient rather than
 * waiting to be read, and the thing it puts on their screen includes "thoughts
 * that you would be better off dead". A clinician whose access has ended must
 * not be able to ask somebody that.
 */
async function gate(patientId: string) {
  const actor = await requireUser();

  const patient = await getPatient(actor, patientId);
  if (!patient) return { error: "That patient is not in your practice." } as const;

  const access = await accessFor(actor, patientId);
  if (access.state === "revoked") {
    return {
      error: "This person has not granted you access, so you cannot send them questions.",
    } as const;
  }

  return { actor } as const;
}

/**
 * 56.4 / 56.6 — one assignment, two doors.
 *
 * `mode: "room"` with a session id is the questionnaire shared into a live
 * call and watched while it is answered; `mode: "homework"` is the same thing
 * left for them to do in their own time. Nothing below this line differs
 * between the two except whether a session is named.
 */
export async function sendAssessment(
  patientId: string,
  input: { instrumentKey: string; mode: "room" | "homework"; sessionId?: string },
): Promise<AssessmentActionState> {
  const g = await gate(patientId);
  if ("error" in g) return { error: g.error };

  const result = await assignInstrument({
    actor: g.actor,
    patientId,
    instrumentKey: input.instrumentKey,
    mode: input.mode,
    sessionId: input.sessionId ?? null,
  });

  if (result.error) return { error: result.error };

  revalidatePath(`/patients/${patientId}/assessments`);
  return { ok: true };
}

/**
 * 56.5 — what the clinician watches while it is being answered.
 *
 * 🔴 Answered COUNT and status, and a band only once it is finished.
 *
 * A band computed from a half-finished questionnaire is a number that will
 * change, rendered as a clinical word that will not be re-read. Watching
 * "4 of 9" is watching somebody work; watching a severity label tick upwards
 * question by question is something else, and it would also leak into the room
 * a reading the patient's own screen is forbidden to show (56.9, C113).
 */
export async function pollAssessment(
  patientId: string,
  assignmentId: string,
): Promise<{
  error?: string;
  status?: string;
  answered?: number;
  total?: number;
  score?: number | null;
  band?: string | null;
}> {
  const g = await gate(patientId);
  if ("error" in g) return { error: g.error };

  const progress = await assignmentProgress(assignmentId, patientId);
  if (!progress) return { error: "That assessment is not available." };

  let band: string | null = null;
  if (progress.status === "completed" && progress.score !== null) {
    const instrument = await instrumentByKey(progress.instrumentKey);
    band = instrument ? bandFor(instrument, progress.score) : null;
  }

  return {
    status: progress.status,
    answered: progress.answered,
    total: progress.total,
    score: progress.status === "completed" ? progress.score : null,
    band,
  };
}

/**
 * 56.7 — how long each answer took, with the question it belongs to.
 *
 * 🔴 The reason this sprint exists. A total of 19 says nothing about the
 * ninety seconds somebody spent on item 9, and that pause is clinical
 * information no transcript reliably carries.
 *
 * Returned only for the clinician, only on their own patient, and behind the
 * same access gate as everything else here: a timing on item 9 is as sensitive
 * as the answer to item 9.
 */
export async function timingsFor(
  patientId: string,
  assignmentId: string,
): Promise<{
  error?: string;
  answers?: { questionKey: string; text: string; value: number; answerMs: number | null }[];
}> {
  const g = await gate(patientId);
  if ("error" in g) return { error: g.error };

  const progress = await assignmentProgress(assignmentId, patientId);
  if (!progress) return { error: "That assessment is not available." };

  const [timings, instrument] = await Promise.all([
    answerTimings(assignmentId, patientId),
    instrumentByKey(progress.instrumentKey),
  ]);

  const questions = new Map(
    (instrument?.questions ?? []).map((question) => [question.key, question]),
  );

  return {
    answers: timings.map((row) => ({
      questionKey: row.questionKey,
      /*
       * The instrument's own wording, verbatim. A clinician reading "90s on
       * item 9" needs to see which question item 9 is, and paraphrasing a
       * validated instrument on the way to their screen is how a clinician
       * ends up certain about a question that was never asked.
       */
      text: questions.get(row.questionKey)?.text.en ?? row.questionKey,
      value: row.value,
      answerMs: row.answerMs,
    })),
  };
}
