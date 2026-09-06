import type { DefaultPage } from "./defaults";
import { DEFAULT_PAGES } from "./defaults";
import { DEFAULT_PAGES_AR } from "./defaults-ar";
import { LOCALES, type Locale } from "@/lib/i18n/config";

/**
 * The shipped content, per language. PLAN.md 19.7, C77.
 *
 * ## 🔴 Nothing here says "two"
 *
 * 19.7 is explicit: sprint 20 adds more languages, and anything that hardcodes
 * a pair has to be rewritten when it does. So the built-in content is a
 * **map keyed by locale**, and every caller iterates it. Adding Spanish is one
 * entry here and one entry in `LOCALES`; no script, no query and no component
 * learns a third name.
 *
 * `republish.ts` used to take an `--ar` boolean, which is the shape this
 * replaces — a flag with two states cannot express a third language, and the
 * moment it has to, every call site changes with it.
 *
 * ## What a missing language means
 *
 * Absent, not empty. A locale with no entry here has **no shipped content**,
 * which the CMS already handles: `getPublicPage` falls back to English and
 * `readNav` keeps the English label. That is the defined behaviour C77 asks
 * for — a page nobody has translated is served in a language the reader can
 * probably read, rather than served blank or hidden.
 */
export const CONTENT_DEFAULTS: Partial<Record<Locale, DefaultPage[]>> = {
  en: DEFAULT_PAGES,
  ar: DEFAULT_PAGES_AR,
};

/** Locales that ship built-in content, in the order `LOCALES` declares them. */
export function localesWithDefaults(): Locale[] {
  return LOCALES.filter((locale) => (CONTENT_DEFAULTS[locale]?.length ?? 0) > 0);
}

/**
 * The pages shipped for one language.
 *
 * 🔴 English is **not** substituted here. A caller asking for the Arabic
 * defaults wants to know what exists in Arabic — republishing English rows
 * under an `ar` locale would create exactly the silent half-translation
 * C77 is about, and it would look like a translated site to every check that
 * counts rows.
 */
export function defaultsFor(locale: string): DefaultPage[] {
  return CONTENT_DEFAULTS[locale as Locale] ?? [];
}

/**
 * Which languages a given page is shipped in.
 *
 * The legal pages are deliberately English-only — see the note at the top of
 * `defaults-ar.ts`. This is how a checker tells "not translated yet" from
 * "translated on purpose in one language", without either being hardcoded as
 * a list of slugs somewhere else.
 */
export function localesForSlug(slug: string): Locale[] {
  return localesWithDefaults().filter((locale) =>
    (CONTENT_DEFAULTS[locale] ?? []).some((page) => page.slug === slug),
  );
}
