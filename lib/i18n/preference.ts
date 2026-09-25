import "server-only";

import { and, desc, eq, isNotNull } from "drizzle-orm";

import { controlDb as db } from "@/lib/db";
import { patients, people, users } from "@/lib/db/schema";

import { DEFAULT_LOCALE, isLocale, type Locale } from "./config";

/**
 * 🔴 0169 / RULING 8: THE LANGUAGE A PERSON CHOSE, KEPT WITH THEM.
 *
 * The cookie is how a browser remembers; this is how WE do. A patient or a
 * therapist chooses once in their settings, and a new phone (signing in sets
 * the cookie from it) and every message we send them (`recipientLocale`) use
 * it. Null means they never chose, and the browser decides as before.
 */
export type Who = { personId: string } | { userId: string };

export async function savedLocale(who: Who): Promise<Locale | null> {
  const [row] =
    "personId" in who
      ? await db.select({ locale: people.locale }).from(people).where(eq(people.id, who.personId)).limit(1)
      : await db.select({ locale: users.locale }).from(users).where(eq(users.id, who.userId)).limit(1);
  return isLocale(row?.locale) ? row.locale : null;
}

/**
 * What a message to them is written in: their choice, else what a clinician
 * noted they read (0174, B39), else the default.
 */
export async function recipientLocale(who: Who | null | undefined): Promise<Locale> {
  if (!who) return DEFAULT_LOCALE;
  return (await savedLocale(who)) ?? (await notedLocale(who)) ?? DEFAULT_LOCALE;
}

/**
 * 🔴 B39: the language a clinician wrote on one of this person's charts, the
 * newest first. Only for messages: it never sets their screen, because it is
 * somebody else's note about them rather than their own choice.
 */
export async function notedLocale(who: Who): Promise<Locale | null> {
  if (!("personId" in who)) return null;
  const [row] = await db
    .select({ locale: patients.locale })
    .from(patients)
    .where(and(eq(patients.personId, who.personId), isNotNull(patients.locale)))
    .orderBy(desc(patients.createdAt))
    .limit(1);
  return isLocale(row?.locale) ? row.locale : null;
}

/** Saved with them, and the cookie too, so this browser switches at once. */
export async function saveLocale(who: Who, locale: string): Promise<boolean> {
  if (!isLocale(locale)) return false;
  if ("personId" in who) await db.update(people).set({ locale }).where(eq(people.id, who.personId));
  else await db.update(users).set({ locale }).where(eq(users.id, who.userId));
  const { setLocale } = await import("@/app/actions/locale");
  await setLocale(locale);
  return true;
}

/** On sign-in: the browser takes the language they chose, if they chose one. */
export async function applySavedLocale(who: Who): Promise<void> {
  const locale = await savedLocale(who);
  if (!locale) return;
  const { setLocale } = await import("@/app/actions/locale");
  await setLocale(locale);
}
