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
import { payoutSettingsChanges } from "@/lib/settings/payout-changes";

export type SettingsFormState = { error?: string; ok?: string };

/**
 * 🔴 Every page that can show a price, a fee or a pound figure, refreshed.
 *
 * The public pages are built once and served from cache (`revalidate = false`),
 * so a save that changes a figure they print leaves the old one on the site
 * until somebody publishes content. Revalidating `/pricing` alone was not
 * enough: the tiers and the fee split also render on `/for-therapists` and on
 * any CMS page carrying a `pricing` block, and the root layout reads the pound
 * rate that every `Money` on every page converts with. So this is the layout
 * at the root, and `/ar/*` is covered because it is the same route rewritten.
 */
function revalidatePublicFigures() {
  revalidatePath("/", "layout");
}

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
  /*
   * 🔴 68.14 — carried through for the same reason, and the reason is worth having
   * twice: a spread with a missing key wipes a price silently, and this one is what
   * a telehealth partner is billed per session.
   */
  const partnerSessionCents = current.pricing.partnerSessionCents;

  const problem = settingsProblem({
    ...current,
    pricing: { tiers, creditExpiryMonths, seatBands, partnerSessionCents },
  });
  if (problem) return { error: problem };

  await writeSettingsGroup({
    group: "pricing",
    value: { tiers, creditExpiryMonths, seatBands, partnerSessionCents },
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
  revalidatePublicFigures();
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
  /* The cut and the per-session fee are printed on the public site. */
  revalidatePublicFigures();
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

  /*
   * 🔴 C366 — READ FIRST, THEN OVERLAY. This form does not own the whole group.
   *
   * `writeSettingsGroup` replaces the row, and this action used to build the
   * object from its six form fields alone. The moment sprint 73 added
   * `transferFields` and `cardsComingSoon` to the same group, an admin saving
   * the netting toggle would have silently deleted the Egyptian bank details
   * that every payer's screen reads — while eleven people were mid-transfer
   * against them.
   *
   * Exactly C364's shape, one file over: a writer built from a fixed list of
   * keys drops everything it was not told about. Same fix, same reason, and the
   * default is now KEEP.
   */
  const existing = await getSettings();

  const value = {
    ...existing.payouts,
    egyptCollectionProvider: String(formData.get("provider") ?? "").trim(),
    egyptPayoutMethods: String(formData.get("methods") ?? "")
      .split(",")
      .map((m) => m.trim())
      .filter(Boolean),
    twoPersonThresholdCents: Math.round(Number(String(formData.get("threshold") ?? "")) * 100),
    alertAfterHours: Number(String(formData.get("alertHours") ?? "")),
    netFeeFromHeldEarnings: formData.get("netting") === "on",
    egpSpreadBps: Math.round(Number(String(formData.get("spreadPercent") ?? "")) * 100),
    /* 🔴 75.4 — pounds per dollar, stored the way `fx.ts` quotes rates. */
    egpRateMicro: Math.round(Number(String(formData.get("egpRate") ?? "")) * 1_000_000),
  };

  /*
   * 🔴 A FLOOR OF ONE POUND TO THE DOLLAR, not of zero. Zero would pass a
   * "positive" check and then quote every Egyptian payer "send 0 EGP", which is
   * a rail that has quietly stopped asking for money. The ceiling is equally
   * arbitrary and equally deliberate: a fat finger turning 50 into 50,000 must
   * not reach a patient's screen.
   */
  if (!Number.isFinite(value.egpRateMicro) || value.egpRateMicro < 1_000_000 || value.egpRateMicro > 1_000_000_000) {
    return { error: "The rate has to be between 1 and 1,000 pounds to the dollar." };
  }

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
  /* 🔴 0149 — prices typed in pounds stay in pounds when the rate moves. */
  const { rederiveEgpRates } = await import("@/lib/billing/egp-rates");
  await rederiveEgpRates(value.egpRateMicro);
  await audit({
    actor,
    category: "admin",
    action: "settings.payouts",
    resourceType: "platform_settings",
    resourceId: "payouts",
    /* 🔴 A14: every field this form changed, old and new, not two of seven. */
    reason: payoutSettingsChanges(existing.payouts, value),
  });

  revalidatePath("/admin/settings");
  /* The rate converts every pound figure on the site; the rest of this form does not reach it. */
  if (
    value.egpRateMicro !== existing.payouts.egpRateMicro ||
    value.egpSpreadBps !== existing.payouts.egpSpreadBps
  ) {
    revalidatePublicFigures();
  }
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

/* ======================================================= the Egyptian rail == */

/**
 * The bank details a payer is shown. 73.11.
 *
 * ## 🔴 THE LOCK, AND IT IS THE POINT OF THIS ACTION
 *
 * An operator who edits the account number while eleven people are mid-transfer
 * has sent eleven real payments into an account we are no longer checking, with
 * nothing tying any of them to anything we can find. There is no processor to
 * ask and no chargeback to raise; the money is simply in a bank account with a
 * reference nobody will look for.
 *
 * So the queue has to be empty. Not a warning, not a confirmation dialog: a
 * refusal, with the number blocking it, so the message is "four people are
 * transferring right now" rather than "you cannot do that".
 *
 * ## 🔴 THE LABELS ARE THE OPERATOR'S OWN WORDS
 *
 * Which rails an Egyptian bank offers this quarter is not something a deploy
 * should be needed to keep up with. They add a field, name it "InstaPay handle"
 * or "Mobile wallet number", put an example underneath, and choose who sees it.
 */
export async function saveTransferFields(
  _prev: SettingsFormState,
  formData: FormData,
): Promise<SettingsFormState> {
  const actor = await requireRole("super_admin");

  const { detailsLockedBy } = await import("@/lib/billing/manual");
  const inFlight = await detailsLockedBy();
  if (inFlight > 0) {
    return {
      error: `${inFlight} payment${inFlight === 1 ? " is" : "s are"} in flight against these details. Clear the transfers queue first, or somebody transfers into an account nobody is checking.`,
    };
  }

  /*
   * The form posts parallel arrays, one entry per row. A row missing a label or
   * a value is dropped by the sanitiser rather than saved half-built: a payment
   * screen showing a labelled blank reads as "we forgot the number", and a payer
   * who cannot tell that from "there is no number" transfers to the wrong place.
   */
  const labels = formData.getAll("fieldLabel").map(String);
  const values = formData.getAll("fieldValue").map(String);
  const hints = formData.getAll("fieldHint").map(String);
  /* 🔴 Board 364: the Arabic reader's words, optional. */
  const labelsAr = formData.getAll("fieldLabelAr").map(String);
  const hintsAr = formData.getAll("fieldHintAr").map(String);
  const audiences = formData.getAll("fieldAudiences").map(String);

  const transferFields = labels.map((label, i) => ({
    key: (formData.getAll("fieldKey").map(String)[i] ?? "").trim(),
    label: label.trim(),
    value: (values[i] ?? "").trim(),
    hint: (hints[i] ?? "").trim(),
    labelAr: (labelsAr[i] ?? "").trim(),
    hintAr: (hintsAr[i] ?? "").trim(),
    position: i,
    audiences: (audiences[i] ?? "")
      .split(",")
      .map((a) => a.trim())
      .filter((a) => ["patient", "therapist", "clinic", "company"].includes(a)) as (
      | "patient"
      | "therapist"
      | "clinic"
      | "company"
    )[],
  }));

  const existing = await getSettings();
  const value = {
    ...existing.payouts,
    transferFields,
    cardsComingSoon: formData.get("cardsComingSoon") === "on",
  };

  await writeSettingsGroup({ group: "payouts", value, updatedBy: actor.userId });
  await audit({
    actor,
    category: "admin",
    action: "settings.transferFields",
    resourceType: "platform_settings",
    resourceId: "payouts",
    /*
     * 🔴 The LABELS in the audit row, never the values. This is an account
     * number, and an audit log is read by more people than the settings screen
     * is. What we need six months from now is which fields changed and when.
     */
    reason: `${transferFields.length} field(s): ${transferFields.map((f) => f.label).join(", ")}`,
  });

  revalidatePath("/admin/settings");
  return { ok: "Saved. This is what a payer sees now." };
}

/*
 * 🔴 75.5 / W2-A06: minting a back office account moved to
 * `app/(admin)/admin/team/actions.ts`, where it invites by link instead of
 * taking a password the owner typed.
 */

/**
 * 🔴 0147: the Egyptian entity as an issuer, for its paper invoices and its
 * ETA ones. Read first, then overlay (C366): the US row and anything this form
 * does not name stay as they were. Saving retries what was waiting on it.
 */
export async function saveEgyptIssuer(
  _prev: SettingsFormState,
  formData: FormData,
): Promise<SettingsFormState> {
  const actor = await requireRole("super_admin");
  const field = (name: string, max: number) => String(formData.get(name) ?? "").trim().slice(0, max);
  const legalName = field("legalName", 200);
  const taxId = field("taxId", 80).replace(/[\s-]/g, "");
  const eta = {
    activityCode: field("activityCode", 10),
    branchId: field("branchId", 10) || "0",
    governate: field("governate", 100),
    regionCity: field("regionCity", 100),
    street: field("street", 200),
    buildingNumber: field("buildingNumber", 100),
    itemCode: field("itemCode", 100),
  };
  if (!legalName) return { error: "Enter the registered name." };
  if (!/^\d{9}$/.test(taxId)) return { error: "The tax registration number is 9 digits." };
  if (!/^\d{4}$/.test(eta.activityCode)) return { error: "The activity code is the 4 digits on the tax card." };
  if (!eta.itemCode) return { error: "Enter the EGS item code registered with ETA." };
  if (!eta.governate || !eta.regionCity || !eta.street || !eta.buildingNumber) {
    return { error: "Fill in every address field." };
  }

  const existing = await getSettings();
  const others = existing.invoice.entities.filter((e) => e.entity !== "eg");
  const eg = existing.invoice.entities.find((e) => e.entity === "eg");
  const value = {
    ...existing.invoice,
    entities: [
      ...others,
      {
        entity: "eg",
        numberPrefix: eg?.numberPrefix ?? "EG",
        legalName,
        taxId,
        address: `${eta.buildingNumber} ${eta.street}, ${eta.regionCity}, ${eta.governate}, Egypt`,
        eta,
      },
    ],
  };
  await writeSettingsGroup({ group: "invoice", value, updatedBy: actor.userId });
  await audit({
    actor,
    category: "admin",
    action: "settings.invoice",
    resourceType: "platform_settings",
    resourceId: "invoice",
    reason: "egypt issuer",
  });
  const { advanceEtaDocuments } = await import("@/lib/billing/eta/issue");
  await advanceEtaDocuments();
  revalidatePath("/admin/settings");
  return { ok: "Saved." };
}

/** 🔴 0147: try every waiting tax document again, now. */
export async function retryEtaDocuments(): Promise<void> {
  const actor = await requireRole("super_admin");
  const { advanceEtaDocuments } = await import("@/lib/billing/eta/issue");
  /* 🔴 C11: a person pressing retry is the review a refused document waits for. */
  const { advanced } = await advanceEtaDocuments({ review: true });
  await audit({
    actor,
    category: "admin",
    action: "eta.retry",
    resourceType: "eta_documents",
    resourceId: "all",
    reason: `advanced=${advanced}`,
  });
  revalidatePath("/admin/settings");
}

/**
 * 🔴 0161 — THE RULES (docs/DECISIONS.md). Every tax, document, provider, timing
 * and approval rule the founder ruled on, one form, one row. Unticked boxes
 * are posted as absent, so each switch is read as "present means on".
 */
export async function saveRules(_prev: SettingsFormState, formData: FormData): Promise<SettingsFormState> {
  const actor = await requireRole("super_admin");
  const { RULES_DEFAULTS, parseGroup } = await import("@/lib/settings/defs");
  const { settingsChanges } = await import("@/lib/settings/changes");
  const current = await getSettings();

  const text = (name: string) => String(formData.get(name) ?? "").trim();
  const on = (name: string) => formData.get(name) === "on";
  const whole = (name: string, min: number, max: number): number | null => {
    const n = Number(text(name));
    return Number.isInteger(n) && n >= min && n <= max ? n : null;
  };

  const withholdingPercent = Number(text("payoutWithholdingPercent"));
  if (!Number.isFinite(withholdingPercent) || withholdingPercent < 0 || withholdingPercent > 50) {
    return { error: "Withholding is a percentage between 0 and 50." };
  }
  /* 🔴 Ruling 12: typed as a percentage and in pounds, stored as basis points and piastres. */
  const cardFeePercent = Number(text("cardFeePercent"));
  const cardFeeFixedPounds = Number(text("cardFeeFixedPounds"));
  if (!Number.isFinite(cardFeePercent) || cardFeePercent < 0 || cardFeePercent > 10) {
    return { error: "The card fee is a percentage between 0 and 10." };
  }
  if (!Number.isFinite(cardFeeFixedPounds) || cardFeeFixedPounds < 0 || cardFeeFixedPounds > 100) {
    return { error: "The fixed card fee is between EGP 0 and EGP 100." };
  }
  const numbers = {
    cooldown: whole("payoutDetailsCooldownHours", 0, 24 * 14),
    sessionLink: whole("sessionLinkHours", 1, 24 * 7),
    radarLink: whole("radarLinkHours", 1, 48),
    bookingLink: whole("bookingLinkHoursAfterStart", 1, 48),
    cancelWindow: whole("patientCancelWindowHours", 0, 24 * 14),
    startSoon: whole("startSoonMinutes", 0, 24 * 60),
    /* Never wider than Starting soon: "Join early" cannot open first. */
    joinEarly: whole("joinEarlyMinutes", 0, Math.min(24 * 60, whole("startSoonMinutes", 0, 24 * 60) ?? 0)),
    potWeekly: whole("potSessionsPerWeek", 0, 14),
    walletExpiry: whole("walletExpiryMonths", 0, 120),
    listGrace: whole("listRemovalGraceDays", 0, 120),
  };
  if (Object.values(numbers).some((n) => n === null)) {
    return { error: "Every hour, count and month has to be a whole number in its range." };
  }

  const value = {
    tax: {
      sellerModel: text("sellerModel"),
      sessionVat: text("sessionVat"),
      topUpVat: text("topUpVat"),
      payoutWithholdingBps: Math.round(withholdingPercent * 100),
      topUpWithholding: on("topUpWithholding"),
    },
    documents: { topUpDocument: text("topUpDocument") },
    approvals: {
      payouts: on("approvePayouts"),
      refunds: on("approveRefunds"),
      potReturns: on("approvePotReturns"),
      verifications: on("approveVerifications"),
      transferWithoutProof: on("approveTransferWithoutProof"),
      ledgerAdjustments: on("approveLedgerAdjustments"),
      payoutDetailsCooldownHours: numbers.cooldown,
    },
    providers: {
      cardGateway: text("cardGateway") || RULES_DEFAULTS.providers.cardGateway,
      payouts: text("payoutsProvider") || RULES_DEFAULTS.providers.payouts,
      etaSigner: text("etaSigner") || RULES_DEFAULTS.providers.etaSigner,
    },
    payments: {
      patientPaysCardFee: on("patientPaysCardFee"),
      cardFeeBps: Math.round(cardFeePercent * 100),
      cardFeeFixedMinor: Math.round(cardFeeFixedPounds * 100),
    },
    links: {
      sessionLinkHours: numbers.sessionLink,
      radarLinkHours: numbers.radarLink,
      bookingLinkHoursAfterStart: numbers.bookingLink,
    },
    start: { soonMinutes: numbers.startSoon, joinEarlyMinutes: numbers.joinEarly },
    refunds: { patientCancelWindowHours: numbers.cancelWindow },
    inPerson: {
      payThroughUs: on("inPersonPayThroughUs"),
      potCover: on("inPersonPotCover"),
      potSessionsPerWeek: numbers.potWeekly,
      priceAboveList: on("inPersonPriceAboveList"),
      refundIfNotStarted: on("inPersonRefundIfNotStarted"),
      refundTo: text("inPersonRefundTo"),
    },
    wallet: { enabled: on("walletEnabled"), expiryMonths: numbers.walletExpiry },
    enrolment: { listRemovalGraceDays: numbers.listGrace },
  };

  /* A choice outside its list is refused, not quietly replaced by a default. */
  const parsed = parseGroup("rules", value);
  const choices: [string, string][] = [
    [value.tax.sellerModel, parsed.tax.sellerModel],
    [value.tax.sessionVat, parsed.tax.sessionVat],
    [value.tax.topUpVat, parsed.tax.topUpVat],
    [value.documents.topUpDocument, parsed.documents.topUpDocument],
    [value.inPerson.refundTo, parsed.inPerson.refundTo],
  ];
  if (choices.some(([asked, got]) => asked !== got)) return { error: "One of the choices is not on its list." };

  const saved = await writeSettingsGroup({ group: "rules", value: parsed, updatedBy: actor.userId });
  const changes = settingsChanges(current.rules, saved);
  await audit({
    actor,
    category: "admin",
    action: "settings.rules",
    resourceType: "platform_settings",
    resourceId: "rules",
    reason: (changes.length > 0 ? changes.join("; ") : "no field changed").slice(0, 900),
  });

  revalidatePath("/admin/settings");
  return { ok: changes.length > 0 ? `Saved. ${changes.length} changed from now on; nothing already charged is rewritten.` : "Nothing changed." };
}
