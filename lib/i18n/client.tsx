"use client";

import { createContext, useContext, useMemo } from "react";

import { DEFAULT_LOCALE, type Locale } from "./config";
import { DICTIONARIES, type MessageKey } from "./messages";

/**
 * The same `t` on the client, from the same dictionary.
 *
 * The whole dictionary is handed to the client rather than only the keys a
 * page uses. That is a deliberate few-kilobytes-for-simplicity trade: a
 * per-route subset needs build-time extraction to stay correct, and the
 * failure mode when it drifts is a missing string in production — in Arabic,
 * on the page a patient is looking at. Both dictionaries gzip to very little
 * next to the video call this app is built around.
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
  children,
}: {
  locale: Locale;
  children: React.ReactNode;
}) {
  const value = useMemo<Ctx>(() => {
    const dictionary = DICTIONARIES[locale] ?? DICTIONARIES[DEFAULT_LOCALE];
    return { locale, t: (key, values) => format(dictionary[key], values) };
  }, [locale]);

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
