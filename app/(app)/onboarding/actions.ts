"use server";

import { revalidatePath } from "next/cache";
import { and, eq, isNull } from "drizzle-orm";

import { audit } from "@/lib/audit";
import { requireUser } from "@/lib/auth/guard";
import {
  ensureVerification,
  getVerification,
  missingFrom,
} from "@/lib/data/verification";
import { dbFor} from "@/lib/db";
import { pinnedToDefaultRegion } from "@/lib/db/region";
import { therapistVerifications, users } from "@/lib/db/schema";
import { validateSelections } from "@/lib/data/taxonomy";
import { callerKey, consume } from "@/lib/rate-limit";
import { deleteDocument, uploadDocument, type UploadKind } from "@/lib/uploads";

/*
 * ⚠️ 30.1 — NOT ROUTED YET, and counted rather than hidden.
 *
 * `pinnedToDefaultRegion` returns the default region and registers this
 * module so `verify:sprint30` can print it. The alternative, `dbFor("us")`
 * with a comment, compiles and is indistinguishable from a decision, which
 * is the "seam by convention" this sprint exists to prevent.
 */
const db = dbFor(pinnedToDefaultRegion("app/(app)/onboarding/actions.ts", "not routed yet: this call site has no entity in hand, so 30.x threads one"));


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
  // 🔴 W1-16: an expired licence is back in review, and the renewal goes here.
  if (current?.state === "submitted" && !current.licenseExpiredAt) {
    return { error: "This is already with us for review, you cannot change it right now." };
  }

  // What they already picked is always still valid — a list an admin retired
  // must not silently empty a submission that was already half-written.
  const specialties = await validateSelections(
    "specialty",
    formData.getAll("specialties").map(String),
    current?.specialties ?? [],
  );

  const languages = await validateSelections(
    "language",
    formData.getAll("languages").map(String),
    current?.languages ?? [],
  );

  /*
   * 🔴 W1-23: after approval this wrote straight over the licence an operator
   * had checked. `writeVerificationDetails` holds a changed licence field as a
   * request for review instead, and the clinician stays cleared meanwhile.
   */
  const { writeVerificationDetails } = await import("@/lib/data/licence-change");
  const written = await writeVerificationDetails(actor, {
    country: String(formData.get("country") ?? "").trim().slice(0, 2).toUpperCase() || null,
    licenseBody: String(formData.get("licenseBody") ?? "").trim().slice(0, 160) || null,
    licenseNumber: String(formData.get("licenseNumber") ?? "").trim().slice(0, 80) || null,
    licenseExpiry: String(formData.get("licenseExpiry") ?? "").trim().slice(0, 20) || null,
    specialties,
    languages,
  });
  if (!written.ok) {
    return { error: "This is already with us for review, you cannot change it right now." };
  }

  revalidatePath("/onboarding");
  return { ok: true, message: "Saved" };
}

/** W1-23: licence details change through review, in the reader's language. */
async function lockedHint(): Promise<string> {
  const { getI18n } = await import("@/lib/i18n/server");
  const { t } = await getI18n();
  return t("tlic.lockedHint");
}

/**
 * 🔴 W1-23: an approved clinician asks to change their licence details.
 *
 * Held beside the approval for an operator to check; nothing a patient reads
 * changes until then, and the clinician stays cleared.
 */
export async function askLicenceChange(
  _prev: OnboardingState,
  formData: FormData,
): Promise<OnboardingState> {
  const actor = await requireUser();
  const current = await getVerification(actor.userId);
  if (current?.state !== "approved") return { error: await lockedHint() };

  const { requestLicenceChange } = await import("@/lib/data/licence-change");
  const [me] = await db
    .select({ profile: users.profile })
    .from(users)
    .where(eq(users.id, actor.userId))
    .limit(1);

  const now = {
    licenseBody: current.licenseBody,
    licenseNumber: current.licenseNumber,
    licenseExpiry: current.licenseExpiry,
    credentials: me?.profile?.credentials ?? null,
    licenseType: me?.profile?.licenseType ?? null,
    licenseState: me?.profile?.licenseState ?? null,
  };
  const change: Record<string, string | null> = {};
  for (const key of Object.keys(now) as (keyof typeof now)[]) {
    const sent = String(formData.get(key) ?? "").trim() || null;
    if (sent !== (now[key] ?? null)) change[key] = sent;
  }

  const asked = await requestLicenceChange(actor, change);
  if (!asked.ok) return asked.reason === "no_change" ? { ok: true } : { error: await lockedHint() };

  revalidatePath("/onboarding");
  revalidatePath("/admin/verifications");
  return { ok: true };
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
  if (current.state === "submitted" && !current.licenseExpiredAt) {
    return { error: "This is already with us for review, you cannot change it right now." };
  }
  // 🔴 W1-23: an approved clinician's documents are what was checked.
  if (current.state === "approved") {
    return { error: await lockedHint() };
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

  const { getI18n } = await import("@/lib/i18n/server");
  const { locale, t } = await getI18n();

  /*
   * 🔴 B13 — a rejection is answered by a change, not by pressing Submit again.
   *
   * This checked only that every field was present, so the same blurred licence
   * went straight back to the queue. Replacing a document or changing a detail
   * moves the row to draft (TH2.6); until then it stays rejected and refuses.
   */
  if (current.state === "rejected") return { error: t("tver.changeFirst") };

  const missing = missingFrom(current);
  if (missing.length > 0) {
    const list = missing.map((item) => t(`tver.missing.${item}`)).join(locale === "ar" ? "، " : ", ");
    /*
     * 🔴 C351 — WHY THE SLOTS ARE EMPTY, NOT JUST THAT THEY ARE.
     *
     * After a second rejection we delete the documents, so this branch is
     * reached by two people whose situations have nothing in common: somebody
     * who has not finished the form, and somebody whose files we removed. The
     * bare list reads to the second person as though the product lost their
     * upload, which is the support ticket `reviewNote` was written to avoid,
     * one step further along.
     */
    if (current.documentsClearedAt) {
      return { error: t("tver.clearedStillNeeded", { list }) };
    }
    return { error: t("tver.stillNeeded", { list }) };
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

/**
 * 🔴 W2-T02: take a submission back to change it, before anybody has looked.
 *
 * The under-review screen was a spinner with no way to fix a typo noticed an
 * hour after pressing Submit. This returns it to draft. The guard is in the
 * WHERE, and `decideVerification` has the mirror image in its own: a decision
 * needs `submitted`, a withdrawal needs `submitted`, so whichever lands first
 * wins and the other matches nothing.
 *
 * Never a renewal (`licenseExpiredAt` set): that form is already open for
 * editing, and pulling an expired licence out of review would hide it from
 * the operator who has to clear it.
 */
export async function withdrawFromReview(): Promise<void> {
  const actor = await requireUser();

  const [row] = await db
    .update(therapistVerifications)
    .set({ state: "draft", updatedAt: new Date() })
    .where(
      and(
        eq(therapistVerifications.userId, actor.userId),
        eq(therapistVerifications.state, "submitted"),
        isNull(therapistVerifications.licenseExpiredAt),
      ),
    )
    .returning({ id: therapistVerifications.id });

  if (row) {
    await audit({
      actor,
      category: "auth",
      action: "verification.withdraw",
      resourceType: "verification",
      resourceId: row.id,
    });
  }

  revalidatePath("/onboarding");
  revalidatePath("/admin/verifications");
}
