"use server";

import { cookies } from "next/headers";

import { LOCALE_COOKIE, isLocale, type Locale } from "@/lib/i18n/config";

/**
 * Remember which language somebody chose.
 *
 * A year, because a language preference does not expire — and `httpOnly` is
 * deliberately *off*, unlike every other cookie this product sets. This one
 * carries no authority: it selects a dictionary. Making it unreadable to
 * script would buy nothing and would stop the client knowing its own locale
 * without a round trip.
 *
 * Unauthenticated on purpose. The people most likely to need Arabic are
 * patients, and patients here never have an account.
 */
export async function setLocale(locale: Locale): Promise<void> {
  if (!isLocale(locale)) return;

  (await cookies()).set(LOCALE_COOKIE, locale, {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });
}
