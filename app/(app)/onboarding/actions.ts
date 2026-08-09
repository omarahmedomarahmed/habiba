"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";

import { audit } from "@/lib/audit";
import { requireUser } from "@/lib/auth/guard";
import {
  ensureVerification,
  getVerification,
  missingFrom,
} from "@/lib/data/verification";
import { db } from "@/lib/db";
import { therapistVerifications } from "@/lib/db/schema";
import { RADAR_LANGUAGES, RADAR_SPECIALTIES } from "@/lib/geo";
import { callerKey, consume } from "@/lib/rate-limit";
import { deleteDocument, uploadDocument, type UploadKind } from "@/lib/uploads";

export type OnboardingState = { error?: string; ok?: boolean; message?: string };

const FIELD_TO_COLUMN = {
  idFront: "idFrontUrl",
  idBack: "idBackUrl",
  licenseDoc: "licenseDocUrl",
  headshot: "headshotUrl",
} as const;

type DocumentField = keyof typeof FIELD_TO_COLUMN;

/**
 * Save the text half of the submission.
 *
 * Kept separate from the uploads so a clinician taking photos on a phone does
 * not lose everything they typed when one upload fails. Each part saves on its
 * own; the submit button only checks that the whole is complete.
 */
export async function saveVerificationDetails(
  _prev: OnboardingState,
  formData: FormData,
): Promise<OnboardingState> {
  const actor = await requireUser();
  await ensureVerification(actor);

  const current = await getVerification(actor.userId);
  if (current?.state === "submitted") {
    return { error: "This is already with us for review — you cannot change it right now." };
  }

  const specialties = formData
    .getAll("specialties")
    .map(String)
    .filter((value) => (RADAR_SPECIALTIES as readonly string[]).includes(value));

  const languages = formData
    .getAll("languages")
    .map(String)
    .filter((value) => (RADAR_LANGUAGES as readonly string[]).includes(value));

  await db
    .update(therapistVerifications)
    .set({
      country: String(formData.get("country") ?? "").trim().slice(0, 2).toUpperCase() || null,
      licenseBody: String(formData.get("licenseBody") ?? "").trim().slice(0, 160) || null,
      licenseNumber: String(formData.get("licenseNumber") ?? "").trim().slice(0, 80) || null,
      licenseExpiry: String(formData.get("licenseExpiry") ?? "").trim().slice(0, 20) || null,
      specialties,
      languages,
      // Editing after a rejection puts it back in draft, so the queue does not
      // show a stale "rejected" for someone actively fixing it.
      state: current?.state === "rejected" ? "draft" : (current?.state ?? "draft"),
      updatedAt: new Date(),
    })
    .where(eq(therapistVerifications.userId, actor.userId));

  revalidatePath("/onboarding");
  return { ok: true, message: "Saved" };
}

/**
 * Upload one document.
 *
 * A real upload, not a URL field. Asking a clinician to host their own passport
 * photo somewhere and paste a link is both absurd and a data-protection problem
 * — whoever they used now has their ID too.
 */
export async function uploadVerificationDocument(
  field: string,
  formData: FormData,
): Promise<OnboardingState> {
  const actor = await requireUser();

  if (!(field in FIELD_TO_COLUMN)) return { error: "Unknown document." };
  const column = FIELD_TO_COLUMN[field as DocumentField];

  // Uploads are the most expensive unauthenticated-ish surface we have; a
  // signed-in user still should not be able to fill a bucket in a loop.
  const throttle = await consume(await callerKey("upload"), 30, 10 * 60);
  if (!throttle.allowed) return { error: "Too many uploads just now. Wait a moment." };

  const current = await ensureVerification(actor);
  if (current.state === "submitted") {
    return { error: "This is already with us for review — you cannot change it right now." };
  }

  const file = formData.get("file");
  if (!(file instanceof File)) return { error: "Choose a file." };

  const kind: UploadKind = field === "headshot" ? "headshot" : "credential";
  const result = await uploadDocument({ kind, userId: actor.userId, label: field, file });
  if (result.error || !result.url) return { error: result.error ?? "Upload failed." };

  const previous = current[column];

  await db
    .update(therapistVerifications)
    .set({
      [column]: result.url,
      state: current.state === "rejected" ? "draft" : current.state,
      updatedAt: new Date(),
    })
    .where(eq(therapistVerifications.userId, actor.userId));

  // Replace means replace. Leaving the old ID photo in the bucket forever is
  // a slow data-retention problem nobody would ever notice.
  if (previous) await deleteDocument(previous);

  await audit({
    actor,
    category: "auth",
    action: "verification.document.upload",
    resourceType: "verification",
    resourceId: current.id,
    reason: field,
  });

  revalidatePath("/onboarding");
  return { ok: true, message: "Uploaded" };
}

/** Hand it to an administrator. */
export async function submitForReview(): Promise<OnboardingState> {
  const actor = await requireUser();
  const current = await ensureVerification(actor);

  if (current.state === "submitted") return { ok: true, message: "Already submitted" };
  if (current.state === "approved") return { ok: true, message: "Already approved" };

  const missing = missingFrom(current);
  if (missing.length > 0) {
    return { error: `Still needed: ${missing.join(", ")}.` };
  }

  await db
    .update(therapistVerifications)
    .set({ state: "submitted", submittedAt: new Date(), updatedAt: new Date() })
    .where(eq(therapistVerifications.userId, actor.userId));

  await db
    .update(therapistVerifications)
    .set({ reviewNote: null })
    .where(eq(therapistVerifications.userId, actor.userId));

  await audit({
    actor,
    category: "auth",
    action: "verification.submit",
    resourceType: "verification",
    resourceId: current.id,
  });

  revalidatePath("/onboarding");
  revalidatePath("/admin/verifications");
  return { ok: true, message: "Submitted for review" };
}
