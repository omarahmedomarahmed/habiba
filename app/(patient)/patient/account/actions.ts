"use server";

import { revalidatePath } from "next/cache";

import { eq } from "drizzle-orm";

import { dbFor} from "@/lib/db";
import { pinnedToDefaultRegion } from "@/lib/db/region";
import { people } from "@/lib/db/schema";
import { requestPhoneChange } from "@/lib/data/phone-change";
import { requirePatient } from "@/lib/patient-auth/guard";
import { avatarUploadProblem, deleteDocument, uploadDocument } from "@/lib/uploads";

/*
 * ⚠️ 30.1 — NOT ROUTED YET, and counted rather than hidden.
 *
 * `pinnedToDefaultRegion` returns the default region and registers this
 * module so `verify:sprint30` can print it. The alternative, `dbFor("us")`
 * with a comment, compiles and is indistinguishable from a decision, which
 * is the "seam by convention" this sprint exists to prevent.
 */
const db = dbFor(pinnedToDefaultRegion("app/(patient)/patient/account/actions.ts", "not routed yet: this call site has no entity in hand, so 30.x threads one"));


export type AccountState = { error?: string; ok?: boolean };

/**
 * Ask to change the number. PLAN.md 20.13.
 *
 * Not a settings field — a request, in their own words, with their permission
 * to be called on the new number. §3b makes the phone the identity, and an
 * identity that can be edited from a form is not one.
 */
export async function askToChangeNumber(
  _prev: AccountState,
  formData: FormData,
): Promise<AccountState> {
  const actor = await requirePatient();

  const result = await requestPhoneChange({
    accountId: actor.accountId,
    newPhone: String(formData.get("newPhone") ?? ""),
    country: String(formData.get("country") ?? "") || null,
    reason: String(formData.get("reason") ?? ""),
    contactConsent: formData.get("consent") === "on",
  });

  if (result.error) return { error: result.error };

  revalidatePath("/patient/account");
  return { ok: true };
}

/* --------------------------------------------------- 25.7 · name and photo */

/**
 * Their own name. PLAN.md 25.7.
 *
 * ## 🔴 The thing this action must not become
 *
 * `people.firstName` is now editable by the person it describes, which is
 * correct and also the exact attack C114 names: fail the claim challenge, edit
 * your profile to the name you guessed, try again. That attack is closed in
 * `lib/data/challenge.ts`, which compares against the **clinician's** record
 * and never this column. This action is safe only because that one is, so
 * neither may be changed without the other. `verify:sprint25` performs the
 * attack rather than reading the code.
 *
 * It edits `people` and never `patients`. A clinician's file about a person is
 * the clinician's record of their own work; a patient renaming themselves does
 * not rewrite what somebody else wrote down.
 */
export async function saveOwnName(
  _prev: AccountState,
  formData: FormData,
): Promise<AccountState> {
  const actor = await requirePatient();

  const firstName = String(formData.get("firstName") ?? "").trim();
  const lastName = String(formData.get("lastName") ?? "").trim();

  if (firstName.length < 1) return { error: "Tell us what to call you." };
  if (firstName.length > 80 || lastName.length > 80) return { error: "That is too long." };

  await db
    .update(people)
    .set({ firstName, lastName: lastName || null, updatedAt: new Date() })
    .where(eq(people.id, actor.personId));

  revalidatePath("/patient/account");
  revalidatePath("/patient");
  return { ok: true };
}

/**
 * Their own picture. PLAN.md 25.7, C115.
 *
 * Images only and 2 MB, both enforced in `lib/uploads.ts` rather than here, so
 * the same ceiling applies to every caller. The stored path goes in a column
 * nothing renders: the only reader is the authenticated route.
 */
export async function saveOwnPhoto(formData: FormData): Promise<AccountState> {
  const actor = await requirePatient();

  const file = formData.get("photo");
  if (!(file instanceof File)) return { error: "Choose a photo." };

  const problem = avatarUploadProblem(file);
  if (problem) return { error: problem };

  const [current] = await db
    .select({ avatarUrl: people.avatarUrl })
    .from(people)
    .where(eq(people.id, actor.personId))
    .limit(1);

  const stored = await uploadDocument({
    kind: "avatar",
    userId: actor.personId,
    label: "photo",
    file,
  });
  if (stored.error || !stored.url) return { error: stored.error ?? "That did not upload." };

  await db
    .update(people)
    .set({ avatarUrl: stored.url, avatarUpdatedAt: new Date(), updatedAt: new Date() })
    .where(eq(people.id, actor.personId));

  // Only once the new one is safely the row's value. Deleting first would lose
  // a photo to a failed upload.
  await deleteDocument(current?.avatarUrl);

  revalidatePath("/patient/account");
  revalidatePath("/patient");
  return { ok: true };
}

/** Taking it down. The bytes go too, not just the reference. */
export async function removeOwnPhoto(): Promise<AccountState> {
  const actor = await requirePatient();

  const [current] = await db
    .select({ avatarUrl: people.avatarUrl })
    .from(people)
    .where(eq(people.id, actor.personId))
    .limit(1);

  await db
    .update(people)
    .set({ avatarUrl: null, avatarUpdatedAt: new Date(), updatedAt: new Date() })
    .where(eq(people.id, actor.personId));

  await deleteDocument(current?.avatarUrl);

  revalidatePath("/patient/account");
  revalidatePath("/patient");
  return { ok: true };
}
