import "server-only";

import { cache } from "react";
import { and, eq } from "drizzle-orm";

import { db } from "@/lib/db";
import { taxonomyEntries, type TaxonomyKind } from "@/lib/db/schema";
import {
  COUNTRY_OPTIONS,
  RADAR_LANGUAGES,
  RADAR_SPECIALTIES,
  countryFlag,
  languageFlag,
} from "@/lib/geo";

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
function builtIn(kind: TaxonomyKind): { code: string; label: string; flag: string }[] {
  if (kind === "country") {
    return COUNTRY_OPTIONS.map((c) => ({ code: c.code, label: c.name, flag: c.flag }));
  }
  if (kind === "language") {
    return RADAR_LANGUAGES.map((l) => ({ code: l, label: l, flag: languageFlag(l) }));
  }
  return RADAR_SPECIALTIES.map((s) => ({ code: s, label: s, flag: "" }));
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
  const seen = new Set<string>();

  const merged: TaxonomyOption[] = builtIn(kind).map((entry) => {
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

  return merged.sort(
    (a, b) => a.sortOrder - b.sortOrder || a.label.localeCompare(b.label),
  );
}

/** Only what a patient or a clinician should be offered. */
export async function activeTaxonomy(kind: TaxonomyKind): Promise<TaxonomyOption[]> {
  return (await taxonomy(kind)).filter((entry) => entry.enabled);
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
    return { error: "Countries come from the map itself — ask us to add one." };
  }

  const existing = await taxonomy(kind);
  if (existing.some((entry) => entry.code.toLowerCase() === trimmed.toLowerCase())) {
    return { error: "That is already on the list." };
  }

  await db
    .insert(taxonomyEntries)
    .values({ kind, code: trimmed, label: trimmed, custom: true, updatedBy: userId })
    .onConflictDoNothing();

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
}
