/*
 * 🔴 30.1 — the CONTROL PLANE. One copy, read by every region.
 *
 * This module reads facts about the PRODUCT rather than about a person:
 * settings, content, taxonomy, language, the operator console. There is one
 * of each and Cairo reads the same rows as Virginia. The compiler would not
 * let this file compile without making that choice explicitly.
 */
import "server-only";

import { unstable_cache } from "next/cache";
import { and, eq } from "drizzle-orm";

import { controlDb as db } from "@/lib/db";
import { locales as localesTable, uiStrings } from "@/lib/db/schema";
import { log } from "@/lib/logger";

import { DICTIONARIES, en, type MessageKey } from "./messages";
import { DEFAULT_LOCALE, LOCALES, type Locale } from "./config";

/**
 * Interface strings, as data. PLAN.md 21.1–21.8, 21.11, 21.12.
 *
 * ## The dictionary is the default; a row is an override
 *
 * `messages.ts` still ships every string and still makes a missing Arabic one
 * a **type error** (19.2/19.6) — that guarantee is worth more than anything
 * this module adds and is not weakened by it. What a row does is override one
 * `(key, locale)` at runtime, so a wording change is an edit rather than a
 * deploy.
 *
 * Three rules follow from that, and each of them is a decision:
 *
 *   - **21.5** Clearing an override *restores the shipped wording*. It never
 *     blanks a button. "No override" is the absence of a row, which is a state
 *     the editor cannot get wrong.
 *   - **21.6** A key with no row and no dictionary entry renders the **English
 *     default** and reports itself. Never a raw key on screen, never blank —
 *     a user should not be shown `join.consent.question`.
 *   - **21.12** Completeness gates a language's **launch, not its life**. Add
 *     a button tomorrow and Spanish does not go dark: the new string falls
 *     back, the language stays up, and it is raised as an untranslated-string
 *     alarm. Otherwise adding copy to the homepage silently pulls a language
 *     down and nobody ever finds out why.
 */

/**
 * 🔴 21.7 — the strings where being wrong is not a typo.
 *
 * Crisis copy, the recording notice, consent wording. They are **rewordable
 * and never removable**: an override can change them, clearing an override
 * restores the shipped text, and no bulk action can publish a machine draft of
 * one (21.18). A prefix list rather than an enumeration because the dictionary
 * grows, and a new consent string should be protected the day it is added
 * rather than the day somebody remembers to add it here.
 */
export const SAFETY_PREFIXES = ["crisis.", "consent.", "recording.", "risk."] as const;

export function isSafetyKey(key: string): boolean {
  return SAFETY_PREFIXES.some((prefix) => key.startsWith(prefix));
}

/** Every key the product ships, in declaration order. */
export function shippedKeys(): MessageKey[] {
  return Object.keys(en) as MessageKey[];
}

const CACHE_TAG = "ui-strings";

/**
 * Published overrides for one language.
 *
 * Cached by tag rather than by timer, like the CMS: a save invalidates it, and
 * nothing serves stale copy for an hour because a clock had not ticked (21.4).
 */
async function fetchOverrides(locale: string): Promise<Record<string, string>> {
  try {
    const rows = await db
      .select({ key: uiStrings.key, value: uiStrings.value })
      .from(uiStrings)
      .where(and(eq(uiStrings.locale, locale), eq(uiStrings.status, "published")));

    return Object.fromEntries(rows.map((row) => [row.key, row.value]));
  } catch (error) {
    /*
     * The interface never fails because the override table is unreachable.
     * Same rule as the CMS: the shipped dictionary is a complete answer, and a
     * product that goes blank when a query fails is worse than one that shows
     * last month's wording.
     */
    log.error("ui string overrides unavailable", { locale, error: String(error) });
    return {};
  }
}

const cachedOverrides = unstable_cache(fetchOverrides, ["ui-strings"], { tags: [CACHE_TAG] });

/**
 * Cached inside a request, direct outside one.
 *
 * `unstable_cache` needs Next's incremental cache, which does not exist in a
 * verifier, a seed script or the render check — and a translator that throws
 * outside a request is a translator no script can exercise, which is how a
 * string bug reaches production unmeasured. Same lesson as `getLocale()` in
 * 19.0a: the accessors must work where there is no request.
 */
async function readOverrides(locale: string): Promise<Record<string, string>> {
  try {
    return await cachedOverrides(locale);
  } catch {
    return fetchOverrides(locale);
  }
}

/**
 * 🔴 45.3 — the overridden keys, and only those, for the client provider.
 *
 * The server has resolved overrides since sprint 21 (`stringsFor`, below).
 * **The client has not.** `I18nProvider` read `DICTIONARIES[locale]` straight
 * out of the bundle, so roughly seventy client components — the whole patient
 * app's interactive surface, the room, the booking sheet, every form — ignored
 * every admin edit while the server-rendered ones honoured it. An admin
 * changed a button's words, watched half the product change, and had no way to
 * find out why the other half had not.
 *
 * This returns the **overrides alone**, never the merged dictionary, and that
 * is the whole design. Serialising a resolved dictionary would put 1,536 rows
 * into the RSC payload of every layout and defeat the tree-shaking trade
 * `client.tsx` made deliberately. What crosses the wire is proportional to
 * what an admin actually changed, which on almost every request is nothing.
 *
 * The static dictionary stays underneath as the floor, so a failed query is an
 * interface in its shipped wording rather than an interface in keys.
 */
export async function overridesFor(locale: Locale | string): Promise<Record<string, string>> {
  return readOverrides(locale);
}

export async function invalidateStrings(): Promise<void> {
  try {
    const { revalidateTag } = await import("next/cache");
    revalidateTag(CACHE_TAG);
  } catch {
    // No cache to invalidate outside a request. Nothing to do, and not a fault.
  }
}

/**
 * A translator for one language: overrides first, dictionary second, English
 * last.
 *
 * The three-step fallback is 21.6 and 21.12 in one expression. A language that
 * is live and missing one new string shows the English for that string and
 * stays live; it does not disappear, and it does not show a key.
 */
export async function stringsFor(locale: Locale | string): Promise<{
  t: (key: MessageKey, values?: Record<string, string | number>) => string;
  missing: () => string[];
}> {
  const overrides = await readOverrides(locale);
  const dictionary = (DICTIONARIES as Record<string, Record<string, string>>)[locale] ?? {};
  const reported = new Set<string>();

  const t = (key: MessageKey, values?: Record<string, string | number>) => {
    const template = overrides[key] ?? dictionary[key] ?? en[key];

    if (overrides[key] === undefined && dictionary[key] === undefined) {
      // 21.6 / 21.12 — falls back and *reports*, rather than failing.
      if (!reported.has(key)) {
        reported.add(key);
        log.warn("untranslated string", { key, locale });
      }
    }

    if (!template) return en[key] ?? "";
    if (!values) return template;
    return template.replace(/\{(\w+)\}/g, (whole, name: string) =>
      name in values ? String(values[name]) : whole,
    );
  };

  return { t, missing: () => [...reported] };
}

/* ------------------------------------------------------- 21.9 · languages -- */

export type LanguageRow = {
  code: string;
  name: string;
  nativeName: string;
  direction: "ltr" | "rtl";
  authoringEnabled: boolean;
  publicEnabled: boolean;
};

/**
 * Every language the product knows about, from the database, with the shipped
 * two as the floor.
 *
 * 🔴 The floor is not a formality. `LOCALES` is the compile-time key set that
 * makes a missing Arabic string a type error, and an empty `locales` table
 * must not switch that off or turn the site monolingual because somebody
 * deleted a row.
 */
export async function languages(): Promise<LanguageRow[]> {
  const shipped: LanguageRow[] = LOCALES.map((code) => ({
    code,
    name: code === "ar" ? "Arabic" : "English",
    nativeName: code === "ar" ? "العربية" : "English",
    direction: code === "ar" ? "rtl" : "ltr",
    authoringEnabled: true,
    publicEnabled: true,
  }));

  try {
    const rows = await db.select().from(localesTable);
    if (rows.length === 0) return shipped;

    const byCode = new Map(shipped.map((row) => [row.code, row]));
    for (const row of rows) {
      byCode.set(row.code, {
        code: row.code,
        name: row.name,
        nativeName: row.nativeName,
        direction: row.direction,
        authoringEnabled: row.authoringEnabled,
        /*
         * A shipped language stays public even if a row says otherwise —
         * turning English off would leave the fallback chain with nowhere to
         * land, and 21.15's "must not 404 anybody" starts here.
         */
        publicEnabled: row.code === DEFAULT_LOCALE ? true : row.publicEnabled,
      });
    }
    return [...byCode.values()];
  } catch {
    return shipped;
  }
}

/** 🔴 21.13 — what a *reader* is offered. The bigger of the two switches. */
export async function publicLanguages(): Promise<LanguageRow[]> {
  return (await languages()).filter((row) => row.publicEnabled);
}

/* ---------------------------------------------------- 21.11 · completeness -- */

export type Completeness = {
  locale: string;
  total: number;
  /** Published human or approved rows. A machine draft does NOT count (21.17). */
  done: number;
  /** Awaiting a person. Counted separately so the number is honest. */
  drafts: number;
  /**
   * 45.5 — of those drafts, how many a model wrote.
   *
   * A human's unpublished draft and a machine's are both invisible to readers
   * and are not the same fact about a language. Since 45.5 a person's own save
   * is a draft too, so a single `drafts` count would have made the sentence in
   * `saveLanguage` ("machine drafts nobody has approved") untrue the first
   * time an admin saved a row and went to lunch.
   */
  machineDrafts: number;
  missingKeys: string[];
  percent: number;
};

/**
 * How far a language is from being publishable. 21.11, 21.17.
 *
 * 🔴 A machine draft counts as **missing**. That is the whole of 21.17: a
 * language whose completeness is made of machine output is a language that
 * went live on nobody's judgement, in a product where a mistranslated sentence
 * can be a clinical instruction.
 *
 * The shipped dictionary counts as done for a shipped language — Arabic is not
 * "0% translated" because nobody has re-typed it into a table.
 */
export async function completeness(locale: string): Promise<Completeness> {
  const keys = shippedKeys();
  const dictionary = (DICTIONARIES as Record<string, Record<string, string>>)[locale] ?? {};

  const rows = await db
    .select({ key: uiStrings.key, status: uiStrings.status, source: uiStrings.source })
    .from(uiStrings)
    .where(eq(uiStrings.locale, locale));

  const published = new Set(rows.filter((r) => r.status === "published").map((r) => r.key));
  const draftRows = rows.filter((r) => r.status === "draft" && !published.has(r.key));

  const missingKeys = keys.filter((key) => !published.has(key) && dictionary[key] === undefined);
  const done = keys.length - missingKeys.length;

  return {
    locale,
    total: keys.length,
    done,
    drafts: draftRows.length,
    machineDrafts: draftRows.filter((r) => r.source === "machine").length,
    missingKeys,
    percent: keys.length === 0 ? 100 : Math.round((done / keys.length) * 100),
  };
}
