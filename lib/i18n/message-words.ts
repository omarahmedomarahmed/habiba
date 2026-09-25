import "server-only";

import { formatWhen, type Zone } from "@/lib/scheduling/tz";

import { DEFAULT_LOCALE, isLocale, type Locale } from "./config";
import type { MessageKey } from "./messages";
import { recipientLocale, savedLocale, type Who } from "./preference";
import { stringsFor } from "./strings";

/**
 * 🔴 RULING 8: EVERY MESSAGE WE SEND SOMEBODY IS IN THE LANGUAGE THEY CHOSE.
 *
 * A sender asks for the words of one recipient and gets a translator already
 * set to their language: `recipientLocale` for the choice (null falls back to
 * the default), `stringsFor` so an admin's rewording applies to the email and
 * the WhatsApp as it does to the screen. The `locale` travels on the
 * `Recipient` too, so the email is laid out right to left and WhatsApp asks
 * Meta for the template in that language.
 */
export type Words = {
  locale: Locale;
  t: (key: MessageKey, values?: Record<string, string | number>) => string;
};

/**
 * The words for one recipient.
 *
 * `fallback` is for somebody with no saved choice who is choosing right now:
 * a guest booking in Arabic has told us their language by the page they used,
 * and a support ticket carries the language it was written in.
 */
export async function wordsFor(who: Who | null | undefined, fallback?: string | null): Promise<Words> {
  if (!isLocale(fallback)) return wordsIn(await recipientLocale(who));
  const saved = who ? await savedLocale(who) : null;
  return wordsIn(saved ?? fallback);
}

/** The words in one language, when the caller already knows it. */
export async function wordsIn(locale: Locale | string | null | undefined): Promise<Words> {
  const resolved: Locale = isLocale(locale) ? locale : DEFAULT_LOCALE;
  const { t } = await stringsFor(resolved);
  return { locale: resolved, t };
}

/**
 * A time in the reader's language, with the same caveat `formatWhenWithCaveat`
 * adds when the zone is not theirs, said in their language.
 */
export function whenFor(at: Date, zone: Zone, words: Words): string {
  const when = formatWhen(at, zone, words.locale);
  if (zone.source === "reader") return when;
  if (zone.source === "clinician") return words.t("pmsg.when.clinician", { when });
  if (zone.source === "region") return words.t("pmsg.when.region", { when });
  return words.t("pmsg.when.utc", { when });
}
