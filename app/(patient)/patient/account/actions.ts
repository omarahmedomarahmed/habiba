"use server";

import { revalidatePath } from "next/cache";

import { eq } from "drizzle-orm";

import { dbFor} from "@/lib/db";
import { pinnedToDefaultRegion } from "@/lib/db/region";
import { people } from "@/lib/db/schema";
import { completeOwnChange, requestPhoneChange } from "@/lib/data/phone-change";
import { confirmEmailCode, issueEmailCode } from "@/lib/patient-auth/email";
import { requirePatient } from "@/lib/patient-auth/guard";
import { callerKey, consume } from "@/lib/rate-limit";
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

/**
 * 🔴 W2-P07: the code sent to the new number, which nothing could take.
 * Rate limited because the code is six digits and the request lives a day.
 */
export async function finishNumberChange(
  _prev: AccountState,
  formData: FormData,
): Promise<AccountState> {
  const actor = await requirePatient();

  const verdict = await consume(await callerKey("patient:number-code"), 5, 15 * 60);
  if (!verdict.allowed) return { error: "Too many attempts. Try again in a few minutes." };

  const result = await completeOwnChange({
    accountId: actor.accountId,
    code: String(formData.get("code") ?? ""),
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

/* ------------------------------------------------ W2-P03 · an email address */

export type EmailState = { error?: string; sentTo?: string; added?: string };

/**
 * 🔴 W2-P03: a code to the address they typed. Nothing is written until it
 * comes back (`lib/patient-auth/email.ts` says why).
 */
export async function askForEmailCode(_prev: EmailState, formData: FormData): Promise<EmailState> {
  const actor = await requirePatient();

  const verdict = await consume(await callerKey("patient:email-code"), 5, 15 * 60);
  if (!verdict.allowed) return { error: "Too many codes asked for. Try again in a few minutes." };

  const email = String(formData.get("email") ?? "");
  const issued = await issueEmailCode(actor.accountId, email);
  if (!issued.ok) return { error: issued.error };
  return { sentTo: email.trim().toLowerCase() };
}

export async function confirmEmail(_prev: EmailState, formData: FormData): Promise<EmailState> {
  const actor = await requirePatient();

  const verdict = await consume(await callerKey("patient:email-confirm"), 10, 15 * 60);
  if (!verdict.allowed) return { error: "Too many attempts. Try again in a few minutes." };

  const email = String(formData.get("email") ?? "");
  const done = await confirmEmailCode(actor.accountId, email, String(formData.get("code") ?? ""));
  if (!done.ok) return { error: done.error, sentTo: email };

  revalidatePath("/patient/account");
  revalidatePath("/patient/record");
  return { added: done.email };
}

/** 🔴 0169 / ruling 8: the language they read in, and every message we send them. */
export async function savePatientLanguage(formData: FormData): Promise<void> {
  const actor = await requirePatient();
  const { saveLocale } = await import("@/lib/i18n/preference");
  await saveLocale({ personId: actor.personId }, String(formData.get("locale") ?? ""));
  revalidatePath("/patient", "layout");
}

/* ------------------------------------------------- K24 · closing the account */

export type CloseState = { error?: string };

/**
 * 🔴 K24 — "Delete my account". The typed word is the confirm step; either
 * language's word is accepted, whichever the screen showed. The work is
 * `closePatientAccount`; this signs the browser out and leaves.
 */
export async function closeMyAccount(_prev: CloseState, formData: FormData): Promise<CloseState> {
  const actor = await requirePatient();
  const { getI18n } = await import("@/lib/i18n/server");
  const { t } = await getI18n();

  const typed = String(formData.get("word") ?? "").trim().toLowerCase();
  const { en, ar } = await import("@/lib/i18n/messages");
  const accepted = [en["pclose.word"], ar["pclose.word"], t("pclose.word")].map((word) => word.toLowerCase());
  if (!accepted.includes(typed)) return { error: t("pclose.wrongWord", { word: t("pclose.word") }) };

  const { closePatientAccount } = await import("@/lib/data/account-closure");
  const result = await closePatientAccount({ accountId: actor.accountId, personId: actor.personId });
  if (!result.ok) return { error: t("pclose.already") };

  const { destroyPatientSession } = await import("@/lib/patient-auth/session");
  await destroyPatientSession();
  const { redirect } = await import("next/navigation");
  redirect("/patient/login?closed=1");
  return {};
}
