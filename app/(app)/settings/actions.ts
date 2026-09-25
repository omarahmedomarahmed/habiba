"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, eq } from "drizzle-orm";

import { audit } from "@/lib/audit";
import { requireUser } from "@/lib/auth/guard";
import {
  dashboardLink,
  priceProblem,
  requestPayout,
  startOnboarding,
} from "@/lib/billing/connect";
import { egpRateMicro } from "@/lib/billing/manual";
import { dbFor} from "@/lib/db";
import { isRegion, pinnedToDefaultRegion } from "@/lib/db/region";
import { writeTimezone } from "@/lib/data/timezone";
import { getSettings } from "@/lib/settings";
import { organizations, users, type TherapistProfile } from "@/lib/db/schema";

/*
 * ⚠️ 30.1 — NOT ROUTED YET, and counted rather than hidden.
 *
 * `pinnedToDefaultRegion` returns the default region and registers this
 * module so `verify:sprint30` can print it. The alternative, `dbFor("us")`
 * with a comment, compiles and is indistinguishable from a decision, which
 * is the "seam by convention" this sprint exists to prevent.
 */
const db = dbFor(pinnedToDefaultRegion("app/(app)/settings/actions.ts", "not routed yet: this call site has no entity in hand, so 30.x threads one"));


export type SettingsState = { error?: string; ok?: boolean };

export async function updateProfile(
  _prev: SettingsState,
  formData: FormData,
): Promise<SettingsState> {
  const actor = await requireUser();

  const firstName = String(formData.get("firstName") ?? "").trim();
  if (!firstName) return { error: "First name is required." };

  // Explicit field list, merged over what is already there. The old settings
  // handler wrote whatever the form sent straight into the row, which is how
  // the string "3-5 years" ended up going into an integer column — and because
  // the resulting error aborted the whole UPDATE, both onboarding and settings
  // silently saved nothing. Merging matters too: this form does not carry the
  // copilot voice preference, and replacing the object outright would erase it.
  //
  // 🔴 W1-23: once verification is submitted or approved, the four licence
  // fields are not written here at all; a change goes through review.
  const { writeProfile } = await import("@/lib/data/licence-change");
  await writeProfile(actor, {
    firstName,
    lastName: String(formData.get("lastName") ?? ""),
    credentials: String(formData.get("credentials") ?? ""),
    licenseType: String(formData.get("licenseType") ?? ""),
    licenseNumber: String(formData.get("licenseNumber") ?? ""),
    licenseState: String(formData.get("licenseState") ?? ""),
  });

  await audit({
    actor,
    category: "auth",
    action: "profile.update",
    resourceType: "user",
    resourceId: actor.userId,
  });

  revalidatePath("/settings");
  return { ok: true };
}

/**
 * Persist the copilot read-aloud voice.
 *
 * Read-modify-write on the same jsonb column as the profile form above, for the
 * same reason: two forms writing one document must both merge or one of them
 * silently deletes the other's fields.
 */
export async function saveVoicePreference(
  voice: string,
  speed: number,
): Promise<{ ok: boolean }> {
  const actor = await requireUser();

  const allowed = ["british_female", "british_male", "american_female", "american_male"] as const;
  if (!(allowed as readonly string[]).includes(voice)) return { ok: false };

  const [existing] = await db
    .select({ profile: users.profile })
    .from(users)
    .where(eq(users.id, actor.userId))
    .limit(1);

  await db
    .update(users)
    .set({
      profile: {
        ...(existing?.profile ?? {}),
        voice: voice as TherapistProfile["voice"],
        voiceSpeed: Math.min(2, Math.max(0.5, Number(speed) || 1)),
      },
      updatedAt: new Date(),
    })
    .where(eq(users.id, actor.userId));

  return { ok: true };
}

/**
 * Where the clinician is. 11R.2.
 *
 * This is the zone their published hours are read in and the zone the reminder
 * cron checks before messaging anybody at five in the morning, so it is a
 * deliberate setting rather than a browser reading — see `lib/data/timezone.ts`.
 */
export async function saveTimezone(zone: string): Promise<SettingsState> {
  const actor = await requireUser();

  const saved = await writeTimezone(actor.userId, zone.trim());
  if (!saved) return { error: "We do not recognise that time zone." };

  await audit({
    actor,
    category: "auth",
    action: "profile.timezone",
    resourceType: "user",
    resourceId: actor.userId,
  });

  revalidatePath("/settings");
  revalidatePath("/on-call");
  return { ok: true };
}

/* ------------------------------------------------ W2-F01 · note formats -- */

/**
 * 🔴 W2-F01 / D7: the format this clinician's notes are drafted in. Every new
 * session's note and every "write it yourself" opens in it.
 */
export async function saveNoteFormat(key: string): Promise<SettingsState> {
  const actor = await requireUser();
  const { setDefaultFormat } = await import("@/lib/data/note-formats");
  if (!(await setDefaultFormat(actor, key))) {
    const { getI18n } = await import("@/lib/i18n/server");
    return { error: (await getI18n()).t("common.somethingWrong") };
  }
  revalidatePath("/settings");
  return { ok: true };
}

/** A clinician's own format: named sections, each with a guide the draft follows. */
export async function addNoteTemplate(label: string, sections: string): Promise<SettingsState> {
  const actor = await requireUser();
  const { createTemplate } = await import("@/lib/data/note-formats");
  const created = await createTemplate(actor, { label, sections });
  if (!created.ok) {
    const { getI18n } = await import("@/lib/i18n/server");
    return { error: (await getI18n()).t("tnf.needs") };
  }
  revalidatePath("/settings");
  return { ok: true };
}

export async function removeNoteTemplate(id: string): Promise<SettingsState> {
  const actor = await requireUser();
  const { archiveTemplate } = await import("@/lib/data/note-formats");
  await archiveTemplate(actor, id);
  revalidatePath("/settings");
  return { ok: true };
}

/* ------------------------------------------------------- payouts (Connect) -- */

/** Send the therapist to Stripe to onboard, or back to finish what they left. */
export async function connectPayouts(): Promise<SettingsState> {
  const actor = await requireUser();
  const result = await startOnboarding({
    userId: actor.userId,
    email: actor.email,
    organizationId: actor.organizationId,
  });
  if (result.error || !result.url) return { error: result.error ?? "Could not reach Stripe." };

  await audit({
    actor,
    category: "billing",
    action: "connect.onboarding.start",
    resourceType: "user",
    resourceId: actor.userId,
  });

  redirect(result.url);
}

export async function openPayoutDashboard(): Promise<SettingsState> {
  const actor = await requireUser();
  const result = await dashboardLink(actor.userId);
  if (result.error || !result.url) return { error: result.error ?? "Could not reach Stripe." };
  redirect(result.url);
}

export async function payOutNow(): Promise<SettingsState> {
  const actor = await requireUser();
  const result = await requestPayout(actor.userId);
  if (result.error) return { error: result.error };

  await audit({
    actor,
    category: "billing",
    action: "connect.payout.request",
    resourceType: "user",
    resourceId: actor.userId,
  });

  revalidatePath("/billing");
  revalidatePath("/settings");
  return { ok: true };
}

/**
 * The therapist's own price per session, and whether we may take their 24Therapy
 * bill out of the fee on their next patient payment.
 */
export async function updatePaymentSettings(
  _prev: SettingsState,
  formData: FormData,
): Promise<SettingsState> {
  const actor = await requireUser();

  const dollars = Number(String(formData.get("rateDollars") ?? "0").trim() || "0");
  const cents = Math.round(dollars * 100);

  /*
   * 16.5 — a therapist prices in **either** currency, and the number they typed
   * is stored in the currency they typed it in.
   *
   * The platform's floor and cap are USD figures (`platform_settings`), so an
   * EGP price is converted to dollars **for the check only**. Converting the
   * stored number instead would freeze today's rate into a price that is meant
   * to stay 1,500 EGP whatever the market does — and would silently change
   * what their patients see the next time the rate moved.
   */
  const currency = String(formData.get("rateCurrency") ?? "usd").trim().toLowerCase();
  if (currency !== "usd" && currency !== "egp") return { error: "Choose a currency." };

  /*
   * 🔴 76.46 — THE OPERATOR'S RATE, AND THIS USED TO BE A HARD BLOCK.
   *
   * It called `quoteFor(currency, "usd")` and refused when that returned
   * nothing. C37 makes `quoteFor` refuse a static rate in production and there
   * is no rate provider configured, so **in production an Egyptian therapist
   * could not set their price in pounds at all** and was told "try again
   * shortly", which was never going to become true.
   *
   * The rate is used here for the FLOOR AND CAP CHECK ONLY. The comment above
   * is the reason that matters: the number stored stays the number they typed,
   * in the currency they typed it in, so nothing settles on this conversion and
   * a rate that moves tomorrow does not rewrite their price. A bounds check is
   * exactly the case `egpRateMicro()` exists for, and it is the same rate every
   * payment screen in the product already shows them.
   *
   * 🔴 DIVIDE, BECAUSE THE RATE POINTS THE OTHER WAY. `egpRateMicro` is pounds
   * per dollar; `quoteFor(egp, usd)` was dollars per pound. Multiplying by the
   * wrong direction here would make a 1,500 EGP price read as $75,000 and pass
   * the cap by being absurd rather than by being right.
   */
  let usdEquivalent = cents;
  if (currency !== "usd" && cents > 0) {
    const rateMicro = await egpRateMicro();
    if (!rateMicro || rateMicro <= 0) {
      return { error: "No exchange rate is set yet, so a price in pounds cannot be checked." };
    }
    usdEquivalent = Math.round((cents * 1_000_000) / rateMicro);
  }

  const problem = priceProblem(usdEquivalent, (await getSettings()).session, await egpRateMicro());
  if (problem) return { error: problem };

  /*
   * 🔴 K22 / TE30 — the region is VALIDATED before anything is written. It was
   * checked after the rate had been saved, so a clinician on a clinic seat was
   * told the save failed while half of it had landed. Only a solo practice
   * may move its region (below); a clinic seat asking to is refused whole.
   */
  const region = String(formData.get("practiceRegion") ?? "").trim();
  if (region) {
    const { getI18n } = await import("@/lib/i18n/server");
    const { t } = await getI18n();
    if (!isRegion(region)) return { error: t("tpay.regionChoose") };
    const [own] = await db
      .select({ kind: organizations.kind })
      .from(organizations)
      .where(eq(organizations.id, actor.organizationId))
      .limit(1);
    if (own?.kind !== "solo") return { error: t("tpay.regionClinic") };
  }

  /*
   * 🔴 0149 — dollars in `session_rate_cents` always, because every path that
   * charges, splits and pays out reads it as dollars; the pounds they typed
   * are kept as typed and the dollars re-derived when the operator's rate moves.
   */
  await db
    .update(users)
    .set({
      sessionRateCents: usdEquivalent,
      rateEgpMinor: currency === "egp" ? cents : null,
      rateCurrency: currency,
      autoSettleFromEarnings: formData.get("autoSettle") === "on",
      updatedAt: new Date(),
    })
    .where(eq(users.id, actor.userId));

  /*
   * 🔴 74.6 — WHERE THEY PRACTISE, WHICH DECIDES HOW THEY PAY US AND HOW THEIR
   * PATIENTS PAY THEM.
   *
   * ⚠️ `organizations.region` has existed since C118 and **nothing anywhere ever
   * wrote it.** Every practice in the product has been `us` since the column was
   * added, which meant `organizationNeedsTransfer` was false for everybody and
   * the entire Egyptian rail — two sprints of it — was reachable by nobody.
   * A door built at both ends with no handle in the middle.
   *
   * 🔴 IT IS A SEPARATE ANSWER FROM THE CURRENCY BESIDE IT, deliberately. A
   * therapist in Cairo may well price in dollars, and deriving one from the
   * other would be two opinions about one fact. The form asks both.
   *
   * 🔴 AND ONLY A SOLO PRACTICE CAN BE CHANGED HERE. A clinic's jurisdiction is
   * the clinic's, and one clinician on the roster must not be able to move which
   * of our companies bills their colleagues. `/admin/clinics` is where that one
   * is answered, by somebody who has seen the paperwork.
   */
  if (region && isRegion(region)) {
    await db
      .update(organizations)
      .set({ region, updatedAt: new Date() })
      .where(and(eq(organizations.id, actor.organizationId), eq(organizations.kind, "solo")));
  }

  revalidatePath("/settings");
  revalidatePath("/billing");
  return { ok: true };
}

/** 🔴 0169 / ruling 8: the language they work in, and every message we send them. */
export async function saveMyLanguage(formData: FormData): Promise<void> {
  const actor = await requireUser();
  const { saveLocale } = await import("@/lib/i18n/preference");
  await saveLocale({ userId: actor.userId }, String(formData.get("locale") ?? ""));
  revalidatePath("/", "layout");
}
