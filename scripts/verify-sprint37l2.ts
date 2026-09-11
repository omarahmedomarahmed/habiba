/**
 * Sprint 37L.2 acceptance: the therapist portal, and every date in the product.
 *
 *   npm run verify:sprint37l2
 *
 * ## The date half (37L.9) first, because it is the shared seam
 *
 * 37L translated the patient's nineteen screens and left every **date** on
 * them in English, because dates are not strings anybody types into a page:
 * they come out of `formatDate`, `formatWhen`, `byDayIn`. Nothing in 37L's
 * ratchet could see them — the coverage scanner counts English text nodes, and
 * `{formatWhen(session.at, zone)}` is not an English text node. A patient
 * reading her own session list in Arabic met `Friday 11 September` under an
 * Arabic heading.
 *
 * That is the fourth occurrence of the project's characteristic defect: the
 * capability existed (`localeTag` has pinned Arabic digits since sprint 31)
 * and the call sites did not use it. The fix is the one that worked in
 * `lib/scheduling/tz.ts` for zones: **make the parameter required, and let
 * `tsc` find the call sites.** The type error is the audit.
 *
 * So the checks here are about the shape of the formatters rather than about
 * any one screen. Arity, not memory.
 */
import { readFileSync } from "node:fs";

import { ar, en } from "../lib/i18n/messages";
import { dateTag, intlTag, localeTag } from "../lib/i18n/config";
import { formatCalendarDate, formatDay, formatWeekday, formatWhen } from "../lib/scheduling/tz";
import { formatDate, formatDateTime, formatLongDate } from "../lib/utils";
import { stripComments } from "./_dashes";
import { reporter } from "./_verify";
import { bySurface, scanI18n, walk } from "./_i18n-coverage";

const { check, finish } = reporter();

/** A fixed instant, 22:00 in Cairo, so every assertion below is about one day. */
const INSTANT = new Date("2026-09-12T19:00:00.000Z");
const CAIRO = "Africa/Cairo";

const ARABIC_LETTER = /[؀-ۿ]/;
const ARABIC_INDIC_DIGIT = /[٠-٩]/;

function main() {
  console.log("\nSprint 37L.2, the portal speaks Arabic, and so do its dates\n");

  /* ------------------------------------------- 37L.9 · the shape of the fix */

  /*
   * 🔴 Arity, because a default is a thing to remember.
   *
   * `formatCalendarDate` had `locale = LOCALE`, and the two call sites that
   * remembered to pass one were the two that did not need reminding. A
   * parameter with a default is invisible to `tsc`, which means it is invisible
   * to the audit, which is the entire reason C182 survived fourteen sprints.
   * `Function.length` stops counting at the first parameter with a default, so
   * this asserts the absence of one at runtime rather than by reading the file.
   */
  check(
    "37L.9 every date formatter requires a language (no default to forget)",
    formatDate.length === 3 &&
      formatDateTime.length === 3 &&
      formatLongDate.length === 3 &&
      formatDay.length === 3 &&
      formatWeekday.length === 3 &&
      formatWhen.length === 3 &&
      formatCalendarDate.length === 3,
    "formatDate, formatDateTime, formatLongDate, formatDay, formatWeekday, formatWhen, formatCalendarDate",
  );

  /* ---------------------------------------------------- 37L.9 · the reading */

  const dayEn = formatDay(INSTANT, CAIRO, "en");
  const dayAr = formatDay(INSTANT, CAIRO, "ar");

  check(
    "37L.9 an Arabic reader's date is in Arabic",
    dayAr !== dayEn && ARABIC_LETTER.test(dayAr) && !ARABIC_LETTER.test(dayEn),
    `en "${dayEn}" · ar "${dayAr}"`,
  );

  /*
   * 🔴 Western digits, product-wide. `lib/i18n/config.ts` rules on why: a
   * patient in crisis reading ٩٨٨ for the crisis line is a worse outcome than
   * a small loss of typographic authenticity, and a date is the easiest place
   * to lose the rule because `Intl` reaches for Arabic-Indic digits by default.
   */
  const arProse = formatCalendarDate(INSTANT, CAIRO, "ar");
  check(
    "37L.9 Arabic dates carry Western digits",
    !ARABIC_INDIC_DIGIT.test(dayAr) &&
      !ARABIC_INDIC_DIGIT.test(arProse) &&
      /12/.test(dayAr) &&
      /2026/.test(arProse),
    `${dayAr} · ${arProse}`,
  );

  /*
   * 🔴 The regression this sprint caused and caught in the same commit.
   *
   * Routing dates through `localeTag` to get Arabic flipped every English date
   * in the product from `12 September` to `September 12`, silently, because
   * `localeTag("en")` is `en-US` — right for money, wrong for a date read by
   * anybody outside the United States, which is everybody this product is for.
   * Hence two tags, and this is the check that keeps them apart.
   */
  check(
    "37L.9 English dates stay in day-month order (dateTag is not localeTag)",
    dateTag("en") === "en-GB" && localeTag("en") === "en-US" && /12 September/.test(dayEn),
    `dateTag(en)=${dateTag("en")} localeTag(en)=${localeTag("en")} · "${dayEn}"`,
  );

  check(
    "37L.9 the digits rule survives a language that is not one of ours",
    intlTag("fr-FR") === "fr-FR" &&
      intlTag("ar").includes("-u-nu-latn") &&
      !ARABIC_INDIC_DIGIT.test(formatCalendarDate(INSTANT, CAIRO, "ar-EG")) &&
      /septembre/.test(formatCalendarDate(INSTANT, CAIRO, "fr-FR")),
    "the session report email has four languages; `lib/mail.ts` sends it in the one the session was held in",
  );

  /* --------------------------------- 37L.9 · nothing formats a date locally */

  /*
   * 🔴 The guard, as a negative: a page or component that builds a date itself
   * is a date nothing can translate.
   *
   * `app/(app)/dashboard/page.tsx` greeted a clinician with
   * `toLocaleDateString(undefined, …)` — C84 twice over, because `undefined`
   * asks the runtime for the language and no `timeZone` asks it for the zone.
   * On Vercel the runtime is UTC, so a clinician in Dubai opening the app at
   * 01:00 was greeted with yesterday's date.
   *
   * Comments are stripped first. This is the sixth time a checker would
   * otherwise have matched the sentence describing the defect it hunts.
   */
  const offenders: string[] = [];
  for (const file of walk("app").concat(walk("components"))) {
    if (!/\.tsx?$/.test(file)) continue;
    const source = stripComments(readFileSync(file, "utf8"));
    if (/new Intl\.DateTimeFormat|toLocaleDateString|toLocaleTimeString/.test(source)) {
      offenders.push(file);
    }
  }

  check(
    "37L.9 no page or component formats a date itself",
    offenders.length === 0,
    offenders.length === 0
      ? "every date comes from lib/utils.ts or lib/scheduling/tz.ts, which require a language"
      : offenders.join(", "),
  );

  /*
   * The same check, proved against a planted offender. A guard that has never
   * failed is a guard nobody has read.
   */
  const planted = stripComments(
    `export function Page() {\n  return <p>{new Date().toLocaleDateString(undefined)}</p>;\n}\n`,
  );
  check(
    "37L.9 CONTROL: the guard catches a planted offender",
    /new Intl\.DateTimeFormat|toLocaleDateString|toLocaleTimeString/.test(planted),
    "the scan is a scan, not a spelling of a hope",
  );

  /* ------------------------------------------------ 37L.2 · the portal */

  const surfaces = bySurface(scanI18n());

  /*
   * 🔴 The portal's 105, and what the last one is.
   *
   * Not "fewer than before": a number with a name on it. The one that remains
   * is the brand in the sidebar, which is a name rather than a sentence, and
   * saying so here is what stops the next person reading "1" as "nearly done"
   * when it might have been one more English heading.
   */
  check(
    "37L.2 the therapist portal's pages are translated",
    surfaces.portal <= 1,
    `portal ${surfaces.portal} (was 105); the remainder is the brand name in the sidebar`,
  );

  /*
   * 🔴 The clinical vocabulary, in both languages and actually different.
   *
   * The founder's ruling: clinical Arabic is a different register, and a
   * clinician reading a mistranslated clinical term trusts the product less,
   * not more. An Arabic value identical to its English one is a key somebody
   * skipped, which is the one failure mode a `Record<MessageKey, string>`
   * cannot catch.
   */
  const clinical = Object.keys(en).filter(
    (key) => key.startsWith("spec.") || key.startsWith("lang."),
  );
  const untranslated = clinical.filter(
    (key) => ar[key as keyof typeof ar] === en[key as keyof typeof en],
  );

  check(
    "37L.2 every language and specialty is written in Arabic, not left in English",
    clinical.length >= 40 && untranslated.length === 0,
    untranslated.length === 0
      ? `${clinical.length} clinical terms, all in Arabic`
      : untranslated.join(", "),
  );

  /*
   * 🔴 The defect a translation could have caused, guarded as a negative.
   *
   * The chip groups used one string as the checkbox value, the stored row, the
   * allowlist entry and the words on screen. Translating the words in place
   * would have saved "القلق" as a specialty the allowlist does not contain, and
   * the radar would have stopped matching that clinician to anybody looking
   * for anxiety. A translation that changes what a form submits is worse than
   * no translation.
   */
  const chipFiles = [
    "components/onboarding/verification-form.tsx",
    "components/radar/therapist-console.tsx",
  ];
  const chipOffenders = chipFiles.filter((file) => {
    const source = stripComments(readFileSync(file, "utf8"));
    return /value=\{option\}/.test(source) || /options: readonly string\[\]/.test(source);
  });

  check(
    "37L.2 a taxonomy chip submits its code, never its translated label",
    chipOffenders.length === 0,
    chipOffenders.length === 0
      ? "verification form and radar console both take { code, label }"
      : chipOffenders.join(", "),
  );

  check(
    "37L.2 CONTROL: the chip guard catches a planted offender",
    /value=\{option\}/.test(stripComments('<input name="x" value={option} />')),
    "the scan is a scan",
  );

  finish("sprint 37L.2");
}

main();
