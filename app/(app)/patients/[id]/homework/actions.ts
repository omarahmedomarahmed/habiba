"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";

import { requireUser } from "@/lib/auth/guard";
import { accessFor } from "@/lib/data/grants";
import { assignStep, withdrawStep } from "@/lib/data/homework";
import { getPatient } from "@/lib/data/patients";
import { ensurePersonForPatient } from "@/lib/data/people";
import { tellPatientOfWork } from "@/lib/notify/patient-work";

export type HomeworkActionState = { error?: string; ok?: boolean };

/**
 * Setting homework. PLAN.md 9.5.
 *
 * Gated on the same consent state as everything else, and here it matters
 * most: homework is the one surface that *reaches out* to a patient rather
 * than waiting to be read. A clinician whose access has ended must not be able
 * to put tasks on somebody's screen.
 */
async function gate(patientId: string) {
  const actor = await requireUser();

  const patient = await getPatient(actor, patientId);
  if (!patient) return { error: "That patient is not in your practice." } as const;

  const access = await accessFor(actor, patientId);
  if (access.state === "revoked") {
    return {
      error: "This person has not granted you access, so you cannot set them homework.",
    } as const;
  }

  const personId = await ensurePersonForPatient(patientId);
  if (!personId) return { error: "That patient no longer exists." } as const;

  return { actor, personId } as const;
}

export async function setStep(
  patientId: string,
  input: { title: string; detail?: string; sessionId?: string; fromDraft?: boolean },
): Promise<HomeworkActionState> {
  const g = await gate(patientId);
  if ("error" in g) return { error: g.error };

  /* A session named by the browser must be this patient's, or it is dropped. */
  let sessionId: string | null = null;
  if (input.sessionId) {
    const { personForSession } = await import("@/lib/data/homework");
    if ((await personForSession(input.sessionId)) === g.personId) sessionId = input.sessionId;
  }

  const result = await assignStep({
    actor: g.actor,
    personId: g.personId,
    sessionId,
    title: input.title,
    detail: input.detail ?? null,
    // A step promoted from the note's draft is recorded as `drafted`, so a
    // patient asking "did you actually mean me to do this?" gets a true answer.
    source: input.fromDraft ? "drafted" : "therapist",
  });

  if (!result.ok) return { error: result.error };

  /*
   * 🔴 K18: the patient is told; the row alone reached nobody.
   * 🔴 Board 501 / 518: after the response, and only for a step that is new. It
   * was awaited here, so the clinician's page waited on an email before it
   * showed the step, and a clinician who saw nothing change pressed again.
   */
  if (!result.already) {
    const personId = g.personId;
    const therapistUserId = g.actor.userId;
    after(() => tellPatientOfWork({ personId, therapistUserId, what: "homework" }));
  }

  revalidateBothSides(patientId);
  return { ok: true };
}

/*
 * 🔴 K18: the pages that show homework, which is where a revalidation has to
 * land. `/patients/<id>/homework` has no page (the list lives on the documents
 * page), so revalidating it refreshed nothing.
 */
function revalidateBothSides(patientId: string) {
  revalidatePath(`/patients/${patientId}/documents`);
  revalidatePath("/patient/homework");
  revalidatePath("/patient");
}

/**
 * Withdraw a step nobody has answered yet.
 *
 * Once a person has said "done" or "I could not", the answer is theirs and it
 * stays — `withdrawStep` refuses anything that is not still open, so a
 * clinician cannot tidy an inconvenient skip out of the record.
 */
export async function removeStep(patientId: string, itemId: string): Promise<HomeworkActionState> {
  const g = await gate(patientId);
  if ("error" in g) return { error: g.error };

  const removed = await withdrawStep({ actor: g.actor, itemId, personId: g.personId });
  if (!removed) {
    return { error: "That step has already been answered, so it stays on the record." };
  }

  revalidateBothSides(patientId);
  return { ok: true };
}
