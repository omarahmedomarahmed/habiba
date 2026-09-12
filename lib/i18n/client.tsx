"use client";

import { createContext, useContext, useMemo } from "react";

import { DEFAULT_LOCALE, type Locale } from "./config";
import { DICTIONARIES, type MessageKey } from "./messages";

/**
 * The same `t` on the client, from the same dictionary — and now from the same
 * overrides.
 *
 * The whole dictionary is handed to the client rather than only the keys a
 * page uses. That is a deliberate few-kilobytes-for-simplicity trade: a
 * per-route subset needs build-time extraction to stay correct, and the
 * failure mode when it drifts is a missing string in production — in Arabic,
 * on the page a patient is looking at. Both dictionaries gzip to very little
 * next to the video call this app is built around.
 *
 * ## 🔴 45.3 — what was wrong, and what crosses the wire now
 *
 * That trade was sound and it hid a defect for four sprints. The dictionary
 * was the *only* thing the client read, so `ui_strings` — the admin's override
 * layer, resolved on the server since sprint 21 — reached no client component
 * at all. Roughly seventy of them: the room, the booking sheet, the patient
 * app's whole interactive surface, every form. An admin published a change,
 * saw it on the server-rendered half of a page and not the other half, and got
 * no error and no warning in either place.
 *
 * The fix keeps the original trade instead of reversing it. **Only the keys an
 * admin actually overrode are serialised**, layered over the bundled
 * dictionary here. On almost every request that object is empty, and it is
 * never larger than the number of strings somebody edited — proportional to
 * the admin's work rather than to the size of the product. The dictionary
 * stays underneath as the floor, so an unreachable override table is an
 * interface in its shipped wording rather than an interface in raw keys.
 */

type Ctx = { locale: Locale; t: (key: MessageKey, values?: Record<string, string | number>) => string };

const I18nContext = createContext<Ctx | null>(null);

function format(template: string, values?: Record<string, string | number>): string {
  if (!values) return template;
  return template.replace(/\{(\w+)\}/g, (whole, key: string) =>
    key in values ? String(values[key]) : whole,
  );
}

export function I18nProvider({
  locale,
  overrides,
  children,
}: {
  locale: Locale;
  /**
   * 45.3 — the admin's published overrides for this language, and nothing
   * else. Optional so that a test, a story or a stray render outside the root
   * layout still gets a working translator rather than a crash.
   */
  overrides?: Record<string, string>;
  children: React.ReactNode;
}) {
  /*
   * Keyed on the identity of `overrides` as well as the locale. A new object
   * arrives only when the layout re-renders, which is when an admin has
   * published — so this memo is stable for the life of a page and still lets a
   * publish take effect without a reload of the tab.
   */
  const value = useMemo<Ctx>(() => {
    const dictionary = DICTIONARIES[locale] ?? DICTIONARIES[DEFAULT_LOCALE];
    const edited = overrides ?? {};
    return {
      locale,
      /*
       * The same three-step fallback as `stringsFor` on the server: override,
       * then the shipped dictionary, then English. Written in the same order
       * and for the same reason, so the two resolvers cannot drift into
       * disagreeing about which layer wins.
       */
      t: (key, values) => format(edited[key] ?? dictionary[key] ?? DICTIONARIES.en[key], values),
    };
  }, [locale, overrides]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

/**
 * Falls back to English rather than throwing.
 *
 * A client component rendered outside the provider is a developer mistake, but
 * the place it would surface is a patient's screen — and a missing provider
 * should cost them an untranslated label, not a blank page inside a crisis
 * session. The mistake is still visible: English text in an Arabic interface
 * is not subtle.
 */
export function useT() {
  const context = useContext(I18nContext);
  if (context) return context.t;
  const dictionary = DICTIONARIES[DEFAULT_LOCALE];
  return (key: MessageKey, values?: Record<string, string | number>) =>
    format(dictionary[key], values);
}

export function useLocale(): Locale {
  return useContext(I18nContext)?.locale ?? DEFAULT_LOCALE;
}
