"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";

import { requireUser } from "@/lib/auth/guard";
import {
  addTextDocument,
  addUploadedDocument,
  extractPending,
  raiseFlag,
} from "@/lib/data/documents";
import { accessFor } from "@/lib/data/grants";
import { getPatient } from "@/lib/data/patients";
import { ensurePersonForPatient } from "@/lib/data/people";
import type { FlagReason } from "@/lib/db/schema";

export type DocumentActionState = { error?: string; ok?: boolean };

/**
 * A clinician adding to a person's profile. PLAN.md 8.1.
 *
 * Two checks before anything is written, and they are different questions:
 *
 *   `getPatient` — is this patient on your caseload at all?
 *   `accessFor`  — may you write to the *person* behind them right now?
 *
 * A revoked clinician may not add to a profile they cannot read. Adding would
 * be a way to put material in front of a person who has declined to share
 * theirs, which is the wrong direction but the same boundary.
 */
async function writable(patientId: string) {
  const actor = await requireUser();

  const patient = await getPatient(actor, patientId);
  if (!patient) return { error: "That patient is not in your practice." } as const;

  const access = await accessFor(actor, patientId);
  if (access.state === "revoked") {
    return {
      error:
        "This person has not granted you access to their profile, so you cannot add to it. Your own session notes are unaffected.",
    } as const;
  }

  const personId = await ensurePersonForPatient(patientId);
  if (!personId) return { error: "That patient no longer exists." } as const;

  return { actor, personId } as const;
}

export async function addNote(
  patientId: string,
  input: { title: string; body: string; dictated?: boolean },
): Promise<DocumentActionState> {
  const gate = await writable(patientId);
  if ("error" in gate) return { error: gate.error };

  const result = await addTextDocument({
    personId: gate.personId,
    // Dictation arrives here as text — the browser's own speech recognition
    // does the transcribing. Recorded as `dictated` rather than `typed`
    // because provenance matters (8.7): dictated text carries transcription
    // errors that typed text does not, and a reader should know which it is.
    source: input.dictated ? "dictated" : "typed",
    title: input.title,
    body: input.body,
    byUserId: gate.actor.userId,
    organizationId: gate.actor.organizationId,
  });

  if (!result.ok) return { error: result.error };

  revalidatePath(`/patients/${patientId}/documents`);
  return { ok: true };
}

export async function uploadDocumentFile(
  patientId: string,
  formData: FormData,
): Promise<DocumentActionState> {
  const gate = await writable(patientId);
  if ("error" in gate) return { error: gate.error };

  const file = formData.get("file");
  if (!(file instanceof File)) return { error: "Choose a file." };

  const result = await addUploadedDocument({
    personId: gate.personId,
    title: String(formData.get("title") ?? "").trim() || file.name,
    file,
    byUserId: gate.actor.userId,
    organizationId: gate.actor.organizationId,
  });

  if (!result.ok) return { error: result.error };

  /*
   * A nudge, not the mechanism. H9's rule is that the *guarantee* is the cron
   * — this is bounded to a single document and runs after the response is
   * sent, so the common case (one small text file) is searchable immediately
   * instead of tomorrow morning. If it times out or never runs, the queue is
   * unchanged and `extract` picks it up.
   */
  after(async () => {
    await extractPending(1);
  });

  revalidatePath(`/patients/${patientId}/documents`);
  return { ok: true };
}

/** 8.8 — a clinician marking something outdated or wrong. */
export async function flagContent(
  patientId: string,
  input: {
    targetType: "document" | "chunk" | "diagnosis";
    targetId: string;
    reason: FlagReason;
    note?: string;
  },
): Promise<DocumentActionState> {
  const gate = await writable(patientId);
  if ("error" in gate) return { error: gate.error };

  const result = await raiseFlag({
    personId: gate.personId,
    targetType: input.targetType,
    targetId: input.targetId,
    reason: input.reason,
    note: input.note ?? null,
    byUserId: gate.actor.userId,
  });

  if (!result.ok) return { error: result.error };

  revalidatePath(`/patients/${patientId}/documents`);
  return { ok: true };
}

/**
 * 8.9 — read the documents and propose diagnoses. Nothing is confirmed here.
 *
 * Explicitly triggered rather than automatic: extracting a diagnosis costs a
 * model call and, more importantly, produces something a clinician then has to
 * review. Doing it silently on every upload would fill the review queue with
 * work nobody asked for.
 */
export async function proposeFromDocuments(patientId: string): Promise<DocumentActionState> {
  const gate = await writable(patientId);
  if ("error" in gate) return { error: gate.error };

  const { proposeDiagnoses } = await import("@/lib/ai/diagnoses");
  await proposeDiagnoses({
    personId: gate.personId,
    organizationId: gate.actor.organizationId,
    userId: gate.actor.userId,
  });

  revalidatePath(`/patients/${patientId}/documents`);
  return { ok: true };
}

/** 8.9 — a human moves a proposal. Only a human ever does. */
export async function decideDiagnosis(
  patientId: string,
  diagnosisId: string,
  decision: "confirmed" | "rejected",
): Promise<DocumentActionState> {
  const gate = await writable(patientId);
  if ("error" in gate) return { error: gate.error };

  const { confirmDiagnosis } = await import("@/lib/data/diagnoses");
  const ok = await confirmDiagnosis({
    diagnosisId,
    personId: gate.personId,
    decision,
    userId: gate.actor.userId,
  });

  if (!ok) return { error: "That has already been decided." };

  revalidatePath(`/patients/${patientId}/documents`);
  return { ok: true };
}
