"use server";

import { revalidatePath } from "next/cache";

import { requireRole } from "@/lib/auth/guard";
import {
  approveDrafts,
  clearString,
  draftTranslations,
  saveLanguage,
  saveString,
} from "@/lib/i18n/authoring";

export type StringsState = { error?: string; ok?: string };

/**
 * The translation workspace's actions. PLAN.md 21.3, 21.5, 21.9–21.19.
 *
 * `super_admin` throughout: these edit what every reader of the product sees,
 * including the crisis instructions. That is not staff work, and 20.8's split
 * exists so it does not have to be.
 */

export async function saveOne(_prev: StringsState, formData: FormData): Promise<StringsState> {
  const actor = await requireRole("super_admin");
  const result = await saveString({
    key: String(formData.get("key") ?? ""),
    locale: String(formData.get("locale") ?? ""),
    value: String(formData.get("value") ?? ""),
    actor,
  });
  if (result.error) return { error: result.error };

  revalidatePath("/admin/strings");
  return { ok: "Saved." };
}

/** 21.5 — restore the shipped wording. Never a blank. */
export async function clearOne(_prev: StringsState, formData: FormData): Promise<StringsState> {
  const actor = await requireRole("super_admin");
  const result = await clearString({
    key: String(formData.get("key") ?? ""),
    locale: String(formData.get("locale") ?? ""),
    actor,
  });
  if (result.error) return { error: result.error };

  revalidatePath("/admin/strings");
  return { ok: "Cleared, the shipped wording is back." };
}

export async function machineTranslate(
  _prev: StringsState,
  formData: FormData,
): Promise<StringsState> {
  const actor = await requireRole("super_admin");
  const result = await draftTranslations({
    locale: String(formData.get("locale") ?? ""),
    actor,
  });
  if (result.error) return { error: result.error };

  revalidatePath("/admin/strings");
  return {
    ok: `${result.count ?? 0} drafts written. They count as missing until somebody approves them. Nothing is live yet.`,
  };
}

export async function approve(_prev: StringsState, formData: FormData): Promise<StringsState> {
  const actor = await requireRole("super_admin");
  const keys = String(formData.get("keys") ?? "").split(",").filter(Boolean);

  const result = await approveDrafts({
    locale: String(formData.get("locale") ?? ""),
    keys,
    actor,
  });
  if (result.error) return { error: result.error };

  revalidatePath("/admin/strings");
  return { ok: `${result.count ?? 0} published.` };
}

export async function saveLocale(_prev: StringsState, formData: FormData): Promise<StringsState> {
  const actor = await requireRole("super_admin");
  const result = await saveLanguage({
    code: String(formData.get("code") ?? ""),
    name: String(formData.get("name") ?? ""),
    nativeName: String(formData.get("nativeName") ?? ""),
    direction: String(formData.get("direction") ?? "ltr") === "rtl" ? "rtl" : "ltr",
    authoringEnabled: formData.get("authoring") === "on",
    publicEnabled: formData.get("public") === "on",
    actor,
  });
  if (result.error) return { error: result.error };

  revalidatePath("/admin/strings");
  return { ok: "Saved." };
}
