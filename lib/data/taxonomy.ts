/*
 * 🔴 30.1 — the CONTROL PLANE. One copy, read by every region.
 *
 * This module reads facts about the PRODUCT rather than about a person:
 * settings, content, taxonomy, language, the operator console. There is one
 * of each and Cairo reads the same rows as Virginia. The compiler would not
 * let this file compile without making that choice explicitly.
 */
import "server-only";

import { cache } from "react";
import { and, eq } from "drizzle-orm";

import { controlDb as db } from "@/lib/db";
import { taxonomyEntries, type TaxonomyKind } from "@/lib/db/schema";
import {
  countryOptions,
  RADAR_LANGUAGES,
  RADAR_SPECIALTIES,
  countryFlag,
  languageFlag,
} from "@/lib/geo";
import { getI18n } from "@/lib/i18n/server";
import { en as ENGLISH, type MessageKey } from "@/lib/i18n/messages";
import type { Translate } from "@/lib/i18n/server";
import type { Locale } from "@/lib/i18n/config";

/**
 * What the radar is allowed to offer, and who decides.
 *
 * The built-in lists are the universe. This module folds an admin override on
 * top of them: switched off, renamed, reordered, or — for specialties — added.
 * A code with no row is enabled, which is what makes an untouched deployment a
 * working product rather than an empty one.
 */

export type TaxonomyOption = {
  /** Stable identifier. ISO code for a country; the label for the rest. */
  code: string;
  label: string;
  flag: string;
  enabled: boolean;
  custom: boolean;
  sortOrder: number;
};

/**
 * The built-in universe, before overrides.
 *
 * Countries carry a real code because a dot has to be placed on a map from it.
 * Languages and specialties are their own labels: they are matched against
 * strings a clinician picked from the same list, and inventing a parallel code
 * space for them buys nothing but a mapping to get wrong.
 */
/**
 * The dictionary key for a taxonomy value, or null when there is not one. 37L.2.
 *
 * The stored value IS the English label for languages and specialties — that
 * is the decision above, and it is not changed here: the allowlist, the
 * database rows and the matching all still use the English string. What
 * changes is what a reader is shown. A code with no key (an admin's custom
 * specialty) falls back to its own value, which is the honest answer: nobody
 * has translated it.
 */
function taxonomyKey(kind: TaxonomyKind, code: string): MessageKey | null {
  if (kind === "country") return null;
  const prefix = kind === "language" ? "lang" : "spec";
  const slug = code
    .split(/[^A-Za-z0-9]+/)
    .filter(Boolean)
    .map((word, index) =>
      index === 0
        ? word[0]!.toLowerCase() + word.slice(1)
        : word[0]!.toUpperCase() + word.slice(1),
    )
    .join("");
  const key = `${prefix}.${slug}`;
  return key in ENGLISH ? (key as MessageKey) : null;
}

function builtIn(
  kind: TaxonomyKind,
  t: Translate,
  locale: Locale,
): { code: string; label: string; flag: string }[] {
  if (kind === "country") {
    // 45.6 — named and collated in the reader's language, by ICU.
    return countryOptions(locale).map((c) => ({ code: c.code, label: c.name, flag: c.flag }));
  }
  if (kind === "language") {
    return RADAR_LANGUAGES.map((l) => ({
      code: l,
      label: taxonomyKey("language", l) ? t(taxonomyKey("language", l)!) : l,
      flag: languageFlag(l),
    }));
  }
  return RADAR_SPECIALTIES.map((s) => ({
    code: s,
    label: taxonomyKey("specialty", s) ? t(taxonomyKey("specialty", s)!) : s,
    flag: "",
  }));
}

/**
 * Overrides for one kind, keyed by code.
 *
 * `cache()` deduplicates within a single render — the radar page asks for
 * countries and languages, the filter bar asks again, and a page render should
 * still be one query per kind.
 */
const overrides = cache(async (kind: TaxonomyKind) => {
  const rows = await db.select().from(taxonomyEntries).where(eq(taxonomyEntries.kind, kind));
  return new Map(rows.map((row) => [row.code, row]));
});

/** Everything in this kind, enabled or not — the admin view. */
export async function taxonomy(kind: TaxonomyKind): Promise<TaxonomyOption[]> {
  const map = await overrides(kind);
  const { t, locale } = await getI18n();
  const seen = new Set<string>();

  const merged: TaxonomyOption[] = builtIn(kind, t, locale).map((entry) => {
    seen.add(entry.code);
    const row = map.get(entry.code);
    return {
      code: entry.code,
      label: row?.label ?? entry.label,
      flag: entry.flag,
      enabled: row?.enabled ?? true,
      custom: false,
      sortOrder: row?.sortOrder ?? 0,
    };
  });

  for (const [code, row] of map) {
    if (seen.has(code)) continue;
    merged.push({
      code,
      label: row.label ?? code,
      flag: kind === "country" ? countryFlag(code) : kind === "language" ? languageFlag(code) : "",
      enabled: row.enabled,
      custom: true,
      sortOrder: row.sortOrder,
    });
  }

  /*
   * 45.6 — collated in the reader's language. `localeCompare` with no locale
   * sorts Arabic by code point, which is not alphabetical in any language.
   */
  return merged.sort(
    (a, b) => a.sortOrder - b.sortOrder || a.label.localeCompare(b.label, locale),
  );
}

/** Only what a patient or a clinician should be offered. */
export async function activeTaxonomy(kind: TaxonomyKind): Promise<TaxonomyOption[]> {
  return (await taxonomy(kind)).filter((entry) => entry.enabled);
}

/**
 * 🔴 50.1 — the VISIBILITY switch, as a set of codes that are closed.
 *
 * There are two switches per country and each is named for its question,
 * because C218 and C219 were both written believing there was one.
 *
 *   - **`country_settings.enabled` is the MONEY switch.** It answers "can we
 *     take a payment here", and it has two live consumers on the payment path
 *     (`lib/billing/connect.ts`, `app/pay/[token]/actions.ts`) that refuse a
 *     charge with a sentence when it is false. C219 first ordered this column
 *     deleted, on a measurement that said nothing read it. Deleting it would
 *     have left the rail open in a country we had just closed.
 *   - **The taxonomy entry is the VISIBILITY switch.** It answers "do we show
 *     anybody here", and until 50.1b nothing on the radar asked it.
 *
 * One admin action sets both, and the screen says which is which. Two switches
 * that an operator sets together is not the same defect as two switches that
 * disagree because nobody wired one up.
 *
 * Returns the **closed** codes rather than the open ones on purpose: a country
 * with no row is open, so a set of what is open would be wrong for every
 * country nobody has ever configured, which is most of them.
 */
export async function closedCodes(kind: TaxonomyKind): Promise<Set<string>> {
  const map = await overrides(kind);
  const closed = new Set<string>();
  for (const [code, row] of map) if (!row.enabled) closed.add(code);
  return closed;
}

/**
 * Is this value still on the list?
 *
 * Used when rendering a clinician who chose a language that has since been
 * switched off. The answer is used to *hide the filter chip*, never to hide the
 * clinician — someone who is online and can help should not vanish because an
 * admin tidied a list.
 */
export async function isActive(kind: TaxonomyKind, code: string): Promise<boolean> {
  const map = await overrides(kind);
  return map.get(code)?.enabled ?? true;
}

/**
 * Validate what a form sent against what is on offer.
 *
 * `keep` is the values the clinician already had saved. Without it, an admin
 * switching a language off would silently strip it from every profile carrying
 * it the next time that clinician pressed Save on something unrelated — a
 * curation decision quietly becoming a data-loss one. They keep what they had;
 * they just cannot add more of it.
 *
 * These strings are rendered on a public page to anonymous visitors, so
 * "whatever the form sent" was never an option.
 */
export async function validateSelections(
  kind: TaxonomyKind,
  values: string[],
  keep: string[] = [],
): Promise<string[]> {
  const allowed = new Set((await activeTaxonomy(kind)).map((entry) => entry.code));
  for (const value of keep) allowed.add(value);
  return [...new Set(values.filter((value) => allowed.has(value)))].slice(0, 40);
}

/* ------------------------------------------------------------- mutations -- */

/**
 * 🔴 50.1c / C254 — every write here drops the radar board.
 *
 * The board is a two-second per-instance TTL cache (`lib/data/radar.ts:201`),
 * invalidated only by `invalidateRadarBoard()`. Without this call the operator
 * closes a country, reloads the radar, and sees it exactly where it was, which
 * is the *original symptom of C218* reproduced by a cache instead of by a
 * missing query. A fix whose failure mode is indistinguishable from the bug is
 * not a fix.
 *
 * Per instance, so this clears the one the admin's own request landed on and
 * the rest expire within two seconds. That is the right trade for a curation
 * change and it is worth saying out loud rather than discovering.
 *
 * The import is dynamic because `lib/data/radar.ts` imports this module for
 * `closedCodes`, and a static pair would be a cycle.
 */
async function dropRadarBoard(): Promise<void> {
  try {
    const { invalidateRadarBoard } = await import("@/lib/data/radar");
    invalidateRadarBoard();
  } catch {
    // A curation write must not fail because a cache could not be cleared.
  }
}

export async function setTaxonomyEnabled(
  kind: TaxonomyKind,
  code: string,
  enabled: boolean,
  userId: string,
): Promise<void> {
  await db
    .insert(taxonomyEntries)
    .values({ kind, code, enabled, updatedBy: userId })
    .onConflictDoUpdate({
      target: [taxonomyEntries.kind, taxonomyEntries.code],
      set: { enabled, updatedBy: userId, updatedAt: new Date() },
    });

  await dropRadarBoard();
}

/**
 * Add something the built-in list does not have.
 *
 * Countries are refused: a country needs a centroid to be drawn on the globe
 * and a code to be matched, and inventing one from a text field produces a dot
 * in the middle of the Atlantic. Extending the map is a code change, honestly.
 */
export async function addTaxonomyEntry(
  kind: TaxonomyKind,
  label: string,
  userId: string,
): Promise<{ error?: string; ok?: boolean }> {
  const trimmed = label.trim().replace(/\s+/g, " ");
  if (trimmed.length < 2) return { error: "Too short." };
  if (trimmed.length > 48) return { error: "Keep it under 48 characters." };
  if (kind === "country") {
    return { error: "Countries come from the map itself, ask us to add one." };
  }

  const existing = await taxonomy(kind);
  if (existing.some((entry) => entry.code.toLowerCase() === trimmed.toLowerCase())) {
    return { error: "That is already on the list." };
  }

  await db
    .insert(taxonomyEntries)
    .values({ kind, code: trimmed, label: trimmed, custom: true, updatedBy: userId })
    .onConflictDoNothing();

  await dropRadarBoard();
  return { ok: true };
}

/**
 * Remove a custom entry outright.
 *
 * Only custom ones: deleting the row for a built-in entry would restore it
 * rather than remove it, which is the opposite of what the button says. Those
 * get switched off instead.
 */
export async function removeTaxonomyEntry(kind: TaxonomyKind, code: string): Promise<void> {
  await db
    .delete(taxonomyEntries)
    .where(
      and(
        eq(taxonomyEntries.kind, kind),
        eq(taxonomyEntries.code, code),
        eq(taxonomyEntries.custom, true),
      ),
    );

  await dropRadarBoard();
}
