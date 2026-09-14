"use server";

import { revalidatePath } from "next/cache";

import { audit } from "@/lib/audit";
import { requireRole } from "@/lib/auth/guard";
import {
  parseCountry,
  settingsProblem,
  type CountrySettings,
  type PricingTier,
} from "@/lib/settings/defs";
import { getSettings, writeCountrySettings, writeSettingsGroup } from "@/lib/settings";

export type SettingsFormState = { error?: string; ok?: string };

/**
 * Every figure in the product, edited by a person. PLAN.md 20.1–20.5.
 *
 * ## 🔴 Why this validates twice, and refuses on the second
 *
 * `writeSettingsGroup` already parses field by field — a bad value falls back
 * to a known one rather than to `undefined`, because `undefined` in a billing
 * path is a charge of `NaN` cents. That is the right behaviour for a *read*
 * and the wrong behaviour for a *save*: silently storing 400 when somebody
 * typed "4oo" tells them their edit worked.
 *
 * So the form checks first and refuses, and `settingsProblem` runs on the
 * whole prospective settings object — a price cap below the floor makes every
 * price invalid and neither figure is wrong on its own, which is exactly the
 * kind of error a per-field check cannot see.
 */
export async function savePricing(
  _prev: SettingsFormState,
  formData: FormData,
): Promise<SettingsFormState> {
  const actor = await requireRole("super_admin");

  const current = await getSettings();

  /*
   * 🔴 Sprint 57 / C290 — the key list is READ, never typed.
   *
   * This loop said `["payg", "starter", "growth"]`. Sprint 57 renamed two of
   * those tiers, and a hard-coded list does not fail when it goes stale: the
   * form posts `practiceMonthly`, the loop asks for `starterMonthly`, gets
   * nothing, and SAVES A COMPLETE PRICING TABLE BUILT FROM DEFAULTS — silently
   * resetting every figure an admin had ever edited, with a success toast.
   *
   * Reading the keys from what is stored also means a tier an admin adds later
   * is edited rather than deleted by the next save.
   */
  const keys = current.pricing.tiers.map((t) => t.key);

  const tiers: PricingTier[] = [];
  for (const key of keys) {
    // 46.3 — an AI rate and a spend threshold. Never a session count.
    const rate = Number(String(formData.get(`${key}Rate`) ?? ""));
    const unlock = Number(String(formData.get(`${key}Unlock`) ?? ""));
    const name = String(formData.get(`${key}Name`) ?? "").trim();
    // 🔴 Sprint 57 — the monthly price. Zero means this tier is credit-based
    // (pay as you go); anything above zero means unlimited, and a session then
    // raises both invoice lines at zero. See `sessionLines`.
    const monthly = Number(String(formData.get(`${key}Monthly`) ?? "0"));

    if (!Number.isFinite(rate) || rate < 0) return { error: `${key}: that rate is not a number.` };
    if (!Number.isFinite(unlock) || unlock < 0) {
      return { error: `${key}: that threshold is not a number.` };
    }
    if (!Number.isFinite(monthly) || monthly < 0) {
      return { error: `${key}: that monthly price is not a number.` };
    }
    tiers.push({
      key,
      name: name || key,
      aiRateCents: Math.round(rate * 100),
      unlockCents: Math.round(unlock * 100),
      monthlyCents: Math.round(monthly * 100),
    });
  }

  const creditExpiryMonths = Number(String(formData.get("creditExpiryMonths") ?? ""));
  if (!Number.isInteger(creditExpiryMonths) || creditExpiryMonths < 1) {
    return { error: "Credits have to last at least a month." };
  }

  /*
   * 🔴 62.1 — the seat ladder is carried through unchanged by this form.
   *
   * It has its own editor and its own validation, and merging it in here from
   * the current settings rather than defaulting it is the difference between
   * "this form does not edit seats" and "saving the tier table wipes the seat
   * prices", which is the shape a spread with a missing key produces silently.
   */
  const seatBands = current.pricing.seatBands;

  const problem = settingsProblem({
    ...current,
    pricing: { tiers, creditExpiryMonths, seatBands },
  });
  if (problem) return { error: problem };

  await writeSettingsGroup({
    group: "pricing",
    value: { tiers, creditExpiryMonths, seatBands },
    updatedBy: actor.userId,
  });

  await audit({
    actor,
    category: "admin",
    action: "settings.pricing",
    resourceType: "platform_settings",
    resourceId: "pricing",
    reason: tiers
      .map((t) => `${t.key}=${t.aiRateCents}@${t.unlockCents}/mo${t.monthlyCents}`)
      .join(" "),
  });

  revalidatePath("/admin/settings");
  revalidatePath("/pricing");
  return { ok: "Saved. Every page reading these figures changes on its next request." };
}

export async function saveSession(
  _prev: SettingsFormState,
  formData: FormData,
): Promise<SettingsFormState> {
  const actor = await requireRole("super_admin");

  const feePercent = Number(String(formData.get("platformFeePercent") ?? ""));
  const min = Number(String(formData.get("minPrice") ?? ""));
  const max = Number(String(formData.get("maxPrice") ?? ""));

  if (!Number.isFinite(feePercent) || feePercent < 0 || feePercent > 90) {
    return { error: "The cut has to be between 0 and 90 per cent." };
  }
  if (!Number.isFinite(min) || !Number.isFinite(max)) return { error: "Those prices are not numbers." };

  // 46.2 — the platform fee, charged on every session. settingsProblem
  // refuses zero, because zero is the giveaway half of C209.
  const platformFee = Number(String(formData.get("platformFee") ?? ""));
  if (!Number.isFinite(platformFee) || platformFee <= 0) {
    return { error: "The platform fee is what makes the AI fee safe to make conditional." };
  }

  const value = {
    platformFeeBps: Math.round(feePercent * 100),
    platformFeeCents: Math.round(platformFee * 100),
    minPriceCents: Math.round(min * 100),
    maxPriceCents: Math.round(max * 100),
  };

  const current = await getSettings();
  const problem = settingsProblem({ ...current, session: value });
  if (problem) return { error: problem };

  await writeSettingsGroup({ group: "session", value, updatedBy: actor.userId });
  await audit({
    actor,
    category: "admin",
    action: "settings.session",
    resourceType: "platform_settings",
    resourceId: "session",
    reason: `${value.platformFeeBps}bps ${value.minPriceCents}-${value.maxPriceCents}`,
  });

  revalidatePath("/admin/settings");
  return { ok: "Saved." };
}

export async function saveCopilot(
  _prev: SettingsFormState,
  formData: FormData,
): Promise<SettingsFormState> {
  const actor = await requireRole("super_admin");

  const value = {
    messagesPerPatientPerSession: Number(String(formData.get("perSession") ?? "")),
    unclaimedPatientCredits: Number(String(formData.get("unclaimed") ?? "")),
    generalMessagesPerMonth: Number(String(formData.get("general") ?? "")),
  };

  if (Object.values(value).some((n) => !Number.isInteger(n) || n < 0)) {
    return { error: "Allowances are whole numbers, and never negative." };
  }

  await writeSettingsGroup({ group: "copilot", value, updatedBy: actor.userId });
  await audit({
    actor,
    category: "admin",
    action: "settings.copilot",
    resourceType: "platform_settings",
    resourceId: "copilot",
  });

  revalidatePath("/admin/settings");
  return { ok: "Saved." };
}

/** 16.1 / 20.3 — the payout rails, which §3c said must be configuration. */
export async function savePayouts(
  _prev: SettingsFormState,
  formData: FormData,
): Promise<SettingsFormState> {
  const actor = await requireRole("super_admin");

  const value = {
    egyptCollectionProvider: String(formData.get("provider") ?? "").trim(),
    egyptPayoutMethods: String(formData.get("methods") ?? "")
      .split(",")
      .map((m) => m.trim())
      .filter(Boolean),
    twoPersonThresholdCents: Math.round(Number(String(formData.get("threshold") ?? "")) * 100),
    alertAfterHours: Number(String(formData.get("alertHours") ?? "")),
    netFeeFromHeldEarnings: formData.get("netting") === "on",
    egpSpreadBps: Math.round(Number(String(formData.get("spreadPercent") ?? "")) * 100),
  };

  if (!value.egyptCollectionProvider) return { error: "Name the collection provider." };
  if (value.egyptPayoutMethods.length === 0) return { error: "Name at least one payout method." };
  if (!Number.isFinite(value.twoPersonThresholdCents) || value.twoPersonThresholdCents < 0) {
    return { error: "That threshold is not a number." };
  }
  if (!Number.isInteger(value.alertAfterHours) || value.alertAfterHours < 1) {
    return { error: "The ageing alert has to be at least an hour." };
  }
  if (!Number.isFinite(value.egpSpreadBps) || value.egpSpreadBps < 0 || value.egpSpreadBps > 1000) {
    return { error: "The spread is between 0 and 10 per cent, anything more is a hidden margin." };
  }

  await writeSettingsGroup({ group: "payouts", value, updatedBy: actor.userId });
  await audit({
    actor,
    category: "admin",
    action: "settings.payouts",
    resourceType: "platform_settings",
    resourceId: "payouts",
    reason: `netting=${value.netFeeFromHeldEarnings} spread=${value.egpSpreadBps}bps`,
  });

  revalidatePath("/admin/settings");
  return { ok: "Saved." };
}

/**
 * One country. 20.2–20.5.
 *
 * 🔴 A country row is what stands between a patient and being charged a tax
 * that does not exist in their jurisdiction, so the save refuses rather than
 * rounds: an unparseable VAT is an error, not a silent 0%.
 */
export async function saveCountry(
  _prev: SettingsFormState,
  formData: FormData,
): Promise<SettingsFormState> {
  const actor = await requireRole("super_admin");

  const code = String(formData.get("code") ?? "").trim().toUpperCase();
  if (!/^[A-Z]{2}$/.test(code)) return { error: "A country code is two letters." };

  const vatPercent = Number(String(formData.get("vatPercent") ?? ""));
  if (!Number.isFinite(vatPercent) || vatPercent < 0 || vatPercent > 50) {
    return { error: "VAT is a percentage between 0 and 50. Leave it at 0 if there is none." };
  }

  const list = (name: string) =>
    String(formData.get(name) ?? "")
      .split(",")
      .map((v) => v.trim())
      .filter(Boolean);

  /*
   * 🔴 21R.8 / C98 — the crisis line, validated here and not only by the CHECK.
   *
   * Both or neither, and the tel is digits. A constraint violation surfaces to
   * an operator as a failed save with a constraint name; this is the sentence
   * that tells them which half they left out, at the moment they are holding
   * the phone they just dialled.
   */
  const crisisLabel = String(formData.get("crisisLineLabel") ?? "").trim();
  const crisisTel = String(formData.get("crisisLineTel") ?? "").trim();

  if (Boolean(crisisLabel) !== Boolean(crisisTel)) {
    return {
      error:
        "A crisis line needs both: what the reader sees, and what the dialler dials. Leave both blank until somebody has checked the number.",
    };
  }
  if (crisisTel && !/^\+?[0-9]{3,15}$/.test(crisisTel)) {
    return { error: "The dialled number is digits, optionally with a leading +." };
  }

  const country: CountrySettings = parseCountry({
    code,
    name: String(formData.get("name") ?? "").trim() || code,
    vatBps: Math.round(vatPercent * 100),
    currency: String(formData.get("currency") ?? "usd").trim().toLowerCase(),
    paymentMethods: list("paymentMethods"),
    collectionProvider: String(formData.get("collectionProvider") ?? "").trim() || null,
    payoutMethods: list("payoutMethods"),
    entity: String(formData.get("entity") ?? "us"),
    regulators: String(formData.get("regulators") ?? "")
      .split("\n")
      .map((v) => v.trim())
      .filter(Boolean),
    idLabelFront: String(formData.get("idLabelFront") ?? "").trim() || null,
    idLabelBack: String(formData.get("idLabelBack") ?? "").trim() || null,
    licenceLabel: String(formData.get("licenceLabel") ?? "").trim() || null,
    sampleImageUrl: String(formData.get("sampleImageUrl") ?? "").trim() || null,
    crisisLineLabel: crisisLabel || null,
    crisisLineTel: crisisTel || null,
    enabled: formData.get("enabled") === "on",
  });

  await writeCountrySettings({ country, updatedBy: actor.userId });
  await audit({
    actor,
    category: "admin",
    action: "settings.country",
    resourceType: "country_settings",
    resourceId: code,
    /*
     * 🔴 The crisis line is IN THE AUDIT REASON, because "who put that number
     * there and when" is the question asked after somebody dials it and gets
     * nothing. The column carries the verifier and the date; this carries the
     * change.
     */
    reason: `vat=${country.vatBps}bps currency=${country.currency} enabled=${country.enabled} crisis=${country.crisisLineTel ?? "none"}`,
  });

  revalidatePath("/admin/settings");
  return { ok: `${country.name} saved.` };
}
