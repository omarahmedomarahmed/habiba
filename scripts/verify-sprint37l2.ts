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

import { dateTag, intlTag, localeTag } from "../lib/i18n/config";
import { formatCalendarDate, formatDay, formatWeekday, formatWhen } from "../lib/scheduling/tz";
import { formatDate, formatDateTime, formatLongDate } from "../lib/utils";
import { stripComments } from "./_dashes";
import { reporter } from "./_verify";
import { walk } from "./_i18n-coverage";

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

  const en = formatDay(INSTANT, CAIRO, "en");
  const ar = formatDay(INSTANT, CAIRO, "ar");

  check(
    "37L.9 an Arabic reader's date is in Arabic",
    ar !== en && ARABIC_LETTER.test(ar) && !ARABIC_LETTER.test(en),
    `en "${en}" · ar "${ar}"`,
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
    !ARABIC_INDIC_DIGIT.test(ar) &&
      !ARABIC_INDIC_DIGIT.test(arProse) &&
      /12/.test(ar) &&
      /2026/.test(arProse),
    `${ar} · ${arProse}`,
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
    dateTag("en") === "en-GB" && localeTag("en") === "en-US" && /12 September/.test(en),
    `dateTag(en)=${dateTag("en")} localeTag(en)=${localeTag("en")} · "${en}"`,
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

  finish("sprint 37L.2");
}

main();
