import assert from "node:assert/strict";
import { test } from "node:test";

import { toE164, isE164, countryFromLocale, e164Problem } from "../lib/phone/e164";
import {
  byDayIn,
  dayKey,
  formatCalendarDate,
  formatDay,
  formatTime,
  formatWhen,
  formatWhenWithCaveat,
  hourIn,
  isQuietHour,
  parseDayKey,
  resolveZone,
  zonedHourToUtc,
  zoneLabel,
} from "../lib/scheduling/tz";

/**
 * Sprint 11R's arithmetic. C61–C65.
 *
 * The defect being removed: one instant rendered two ways. A Cairo patient
 * picked "22:00" on the calendar and the confirmation said "19:00 UTC", and
 * they had to work out which to trust at the moment they were deciding when to
 * leave the house.
 *
 * Egypt is the interesting zone and not an arbitrary example — it reintroduced
 * DST in 2023, so it is +2 in winter and +3 in summer, and every "just add
 * three hours" shortcut is wrong for half the year.
 */

/* --------------------------------------------- 11R.5 one instant, three readers */

/** 19:00 UTC on a September Saturday. Egypt is on DST, so Cairo is +3. */
const instant = new Date("2026-09-12T19:00:00.000Z");

test("🔴 one instant renders differently for three readers, and each is right", () => {
  assert.equal(formatTime(instant, "Africa/Cairo"), "22:00");
  assert.equal(formatTime(instant, "Asia/Dubai"), "23:00");
  assert.equal(formatTime(instant, "America/New_York"), "15:00");
  assert.equal(formatTime(instant, "UTC"), "19:00");
});

test("the zone is always named, so nobody has to guess", () => {
  const cairo = formatWhen(instant, { name: "Africa/Cairo", source: "reader" }, "en");
  assert.match(cairo, /22:00/);
  assert.match(cairo, /\(Cairo\)/);
  assert.match(cairo, /Saturday 12 September/);
});

test("a fallback says it is a fallback", () => {
  const theirs = formatWhenWithCaveat(instant, { name: "Africa/Cairo", source: "reader" }, "en");
  const clinician = formatWhenWithCaveat(instant, { name: "Africa/Cairo", source: "clinician" }, "en");
  const utc = formatWhenWithCaveat(instant, { name: "UTC", source: "utc" }, "en");

  // Their own zone needs no caveat.
  assert.doesNotMatch(theirs, /therapist|do not have/);
  // Somebody else's does. Printing a time in another person's zone with an
  // authoritative-looking city name is worse than admitting the gap.
  assert.match(clinician, /therapist's time zone/);
  assert.match(utc, /do not have your time zone/);
});

test("🔴 Egypt's DST is handled, because Intl knows and we do not", () => {
  // Same wall-clock hour, six months apart, two different UTC instants.
  const summer = zonedHourToUtc({ year: 2026, month: 9, date: 12 }, 18, "Africa/Cairo");
  const winter = zonedHourToUtc({ year: 2026, month: 1, date: 15 }, 18, "Africa/Cairo");

  assert.equal(summer?.toISOString(), "2026-09-12T15:00:00.000Z", "September is +3");
  assert.equal(winter?.toISOString(), "2026-01-15T16:00:00.000Z", "January is +2");

  // And the round trip reads back as the hour the clinician chose.
  assert.equal(formatTime(summer!, "Africa/Cairo"), "18:00");
  assert.equal(formatTime(winter!, "Africa/Cairo"), "18:00");
});

/* ----------------------------------------------- 11R.2 publishing in a zone -- */

test("a clinician's chosen hour becomes the right UTC instant", () => {
  const utc = zonedHourToUtc({ year: 2026, month: 9, date: 12 }, 18, "America/New_York");
  // New York is UTC-4 in September.
  assert.equal(utc?.toISOString(), "2026-09-12T22:00:00.000Z");
});

test("UTC in means UTC out", () => {
  const utc = zonedHourToUtc({ year: 2026, month: 9, date: 12 }, 18, "UTC");
  assert.equal(utc?.toISOString(), "2026-09-12T18:00:00.000Z");
});

test("an hour that does not exist is refused rather than shifted", () => {
  // The spring-forward gap. 02:00 on that morning is not a time anybody can be
  // seen at, and silently returning 03:00 would publish an hour the clinician
  // did not choose.
  const gap = zonedHourToUtc({ year: 2026, month: 3, date: 8 }, 2, "America/New_York");
  assert.equal(gap, null);
});

test("nonsense in is null out, never a wrong instant", () => {
  assert.equal(zonedHourToUtc({ year: 2026, month: 9, date: 12 }, 24, "UTC"), null);
  assert.equal(zonedHourToUtc({ year: 2026, month: 9, date: 12 }, -1, "UTC"), null);
  assert.equal(zonedHourToUtc({ year: 2026, month: 9, date: 12 }, 18.5, "UTC"), null);
  assert.equal(zonedHourToUtc({ year: 2026, month: 9, date: 12 }, 18, "Mars/Olympus"), null);
});

/* ------------------------------------------------- 11R.4 buckets by the reader */

test("🔴 a late slot sits under the day the reader sees, not the UTC one", () => {
  // 23:00Z on the 12th is 02:00 on the 13th in Cairo. Bucketing on the UTC
  // date put it under the 12th and then rendered the heading "Sunday" — a
  // calendar disagreeing with its own headings.
  const late = new Date("2026-09-12T23:00:00.000Z");
  assert.equal(dayKey(late, "UTC"), "2026-09-12");
  assert.equal(dayKey(late, "Africa/Cairo"), "2026-09-13");

  const grouped = byDayIn([{ startsAt: late }], "Africa/Cairo", "en");
  assert.equal(grouped[0]!.key, "2026-09-13");
  assert.match(grouped[0]!.label, /Sunday 13 September/);
});

test("grouping is ordered and its label matches its contents", () => {
  const grouped = byDayIn(
    [
      { startsAt: new Date("2026-09-13T16:00:00Z") },
      { startsAt: new Date("2026-09-12T15:00:00Z") },
      { startsAt: new Date("2026-09-12T17:00:00Z") },
    ],
    "Africa/Cairo",
    "en",
  );

  assert.deepEqual(
    grouped.map((g) => g.key),
    ["2026-09-12", "2026-09-13"],
  );
  assert.equal(grouped[0]!.slots.length, 2);
  assert.match(grouped[0]!.label, /12 September/);
});

/* --------------------------------------------------------------- zone choice -- */

test("the reader's zone wins, then the clinician's, then UTC", () => {
  assert.deepEqual(resolveZone("Africa/Cairo", "Europe/London"), {
    name: "Africa/Cairo",
    source: "reader",
  });
  assert.deepEqual(resolveZone(null, "Europe/London"), {
    name: "Europe/London",
    source: "clinician",
  });
  assert.deepEqual(resolveZone(null, null), { name: "UTC", source: "utc" });
});

test("a zone this runtime does not know is treated as absent", () => {
  // A typo in a profile must degrade to the next fallback, not throw on a
  // confirmation email.
  assert.equal(resolveZone("Mars/Olympus", "Africa/Cairo").name, "Africa/Cairo");
  assert.equal(resolveZone("Mars/Olympus", null).source, "utc");
});

test("the label is a city, not an offset", () => {
  // "+03" is correct, unreadable, and changes under DST while the city does not.
  assert.equal(zoneLabel("Africa/Cairo"), "Cairo");
  assert.equal(zoneLabel("America/New_York"), "New York");
  assert.equal(zoneLabel("UTC"), "UTC");
});

/* ------------------------------------------------ 11R.16 the quiet window -- */

test("nothing is sent between 22:00 and 07:00 where the reader is", () => {
  // 03:20 UTC — the old reminder slot — is 06:20 in Cairo. Quiet.
  const dawn = new Date("2026-09-12T03:20:00Z");
  assert.equal(hourIn(dawn, "Africa/Cairo"), 6);
  assert.equal(isQuietHour(dawn, "Africa/Cairo"), true);

  // Mid-morning is fine.
  assert.equal(isQuietHour(new Date("2026-09-12T07:00:00Z"), "Africa/Cairo"), false);
  // And late evening is not.
  assert.equal(isQuietHour(new Date("2026-09-12T19:30:00Z"), "Africa/Cairo"), true);
});

test("the same instant is quiet in one zone and not another", () => {
  // 20:30 UTC is 23:30 in Cairo — too late to message somebody — and 16:30 in
  // New York, which is the middle of the afternoon. The window is the
  // recipient's, which is the whole point of 11R.16.
  const at = new Date("2026-09-12T20:30:00Z");
  assert.equal(hourIn(at, "Africa/Cairo"), 23);
  assert.equal(isQuietHour(at, "Africa/Cairo"), true);
  assert.equal(hourIn(at, "America/New_York"), 16);
  assert.equal(isQuietHour(at, "America/New_York"), false);
});

/* ---------------------------------------------------- 11R.12–14 phone numbers */

test("🔴 an Egyptian local number expands only when a country is given", () => {
  assert.deepEqual(toE164("0100 123 4567", "EG"), { ok: true, e164: "+201001234567" });
  assert.deepEqual(toE164("100 123 4567", "EG"), { ok: true, e164: "+201001234567" });

  // The same digits with no country: refused, never guessed. 01001234567 is a
  // real mobile in Egypt, Italy and Kenya, and a different human in each.
  assert.deepEqual(toE164("0100 123 4567"), { ok: false, reason: "no_country" });
  assert.deepEqual(toE164("0100 123 4567", null), { ok: false, reason: "no_country" });
});

test("numbers already written internationally are cleaned, not re-expanded", () => {
  assert.deepEqual(toE164("+20 100 123 4567", "EG"), { ok: true, e164: "+201001234567" });
  assert.deepEqual(toE164("0020 100 123 4567", "EG"), { ok: true, e164: "+201001234567" });
  // Even with the *wrong* country selected — a plus means they told us already.
  assert.deepEqual(toE164("+201001234567", "US"), { ok: true, e164: "+201001234567" });
});

test("a country code typed without a plus is not doubled", () => {
  // `20100…` with Egypt selected must not become `+2020100…`.
  assert.deepEqual(toE164("201001234567", "EG"), { ok: true, e164: "+201001234567" });
});

test("length is checked, and the refusal explains itself", () => {
  assert.deepEqual(toE164("123", "EG"), { ok: false, reason: "too_short" });
  assert.deepEqual(toE164("1234567890123456789", "EG"), { ok: false, reason: "too_long" });
  assert.deepEqual(toE164("", "EG"), { ok: false, reason: "empty" });
  assert.deepEqual(toE164("0100 123 4567", "ZZ"), { ok: false, reason: "unknown_country" });

  // Never the word "invalid" on its own, which explains nothing.
  assert.match(e164Problem(toE164("0100 123 4567")) ?? "", /Choose the country/);
  assert.equal(e164Problem(toE164("0100 123 4567", "EG")), null);
});

test("isE164 accepts what Meta accepts and refuses what it bounces", () => {
  assert.equal(isE164("+201001234567"), true);
  assert.equal(isE164("01001234567"), false);
  assert.equal(isE164("+0201001234567"), false, "no leading zero after the plus");
  assert.equal(isE164(null), false);
});

test("a locale suggests a country but never decides one", () => {
  assert.equal(countryFromLocale("ar-EG"), "EG");
  assert.equal(countryFromLocale("en-GB"), "GB");
  // `ar` alone is overwhelmingly Egypt in this product's traffic — as a
  // *default for the selector*, which is still shown and still changeable.
  assert.equal(countryFromLocale("ar"), "EG");
  assert.equal(countryFromLocale("en"), null);
  assert.equal(countryFromLocale(null), null);
});

/* ------------------------------------------------- 11R.2 publishing hours -- */

test("a day the clinician picked is three numbers, and an impossible one is refused", () => {
  assert.deepEqual(parseDayKey("2026-09-12"), { year: 2026, month: 9, date: 12 });
  assert.equal(parseDayKey("2026-02-31"), null, "31 February is not a date");
  assert.equal(parseDayKey("2026-13-01"), null);
  assert.equal(parseDayKey("12/09/2026"), null);
});

test("🔴 a Cairo evening is a different instant in summer and in winter", () => {
  // The defect this replaces: `hoursOn` built 18:00Z both times, so half the
  // year the clinician's 18:00 appeared to patients at 20:00 Cairo.
  const summer = zonedHourToUtc({ year: 2026, month: 7, date: 15 }, 18, "Africa/Cairo");
  const winter = zonedHourToUtc({ year: 2026, month: 1, date: 15 }, 18, "Africa/Cairo");

  assert.equal(summer?.toISOString(), "2026-07-15T15:00:00.000Z");
  assert.equal(winter?.toISOString(), "2026-01-15T16:00:00.000Z");
});

test("published hours sort and group under the clinician's own days, empty days absent", () => {
  // Replaces the UTC `byDay` test. 21:00 Cairo on the 1st is 18:00Z; 23:00
  // Cairo is 20:00Z the same evening, not the next UTC day.
  const grouped = byDayIn(
    [
      { startsAt: new Date("2026-10-02T18:00:00Z") },
      { startsAt: new Date("2026-10-01T20:00:00Z") },
      { startsAt: new Date("2026-10-01T18:00:00Z") },
    ],
    "Africa/Cairo",
    "en",
  );

  assert.deepEqual(
    grouped.map((g) => g.key),
    ["2026-10-01", "2026-10-02"],
  );
  assert.deepEqual(
    grouped[0]!.slots.map((s) => formatTime(s.startsAt, "Africa/Cairo")),
    ["21:00", "23:00"],
  );
  // 2026-10-03 has nothing in it and does not appear.
  assert.equal(grouped.length, 2);
});

/* ----------------------------------------------------- 37L.9, the language -- */

/**
 * A date is a sentence, and it was the one sentence nothing translated.
 *
 * Every formatter here takes the reader's language as a **required** argument,
 * because the audit was the type error: making it optional is what let nineteen
 * screens render `Friday 11 September` to a reader who had asked for Arabic.
 */
test("🔴 the same instant reads as Arabic for an Arabic reader", () => {
  const en = formatDay(instant, "Africa/Cairo", "en");
  const ar = formatDay(instant, "Africa/Cairo", "ar");

  assert.match(en, /Saturday 12 September/);
  // Not a substring check on a known translation: the point is that it is not
  // English, which is exactly what shipped.
  assert.notEqual(ar, en);
  assert.match(ar, /[\u0600-\u06FF]/);
});

test("🔴 Arabic dates use Western digits", () => {
  // Arabic-Indic digits are banned product-wide (`localeTag`), and a date is
  // the easiest place to lose that rule, because `Intl` defaults to them.
  const ar = formatDay(instant, "Africa/Cairo", "ar");
  assert.match(ar, /12/);
  assert.doesNotMatch(ar, /[\u0660-\u0669]/);

  const prose = formatCalendarDate(instant, "Africa/Cairo", "ar");
  assert.match(prose, /2026/);
  assert.doesNotMatch(prose, /[\u0660-\u0669]/);
});

test("a session language that is not one of the product's two still formats in itself", () => {
  // `lib/mail.ts` sends the session report in the language the session was
  // held in, and it has four. A French sentence with an English date in the
  // middle of it is the defect this argument being a raw tag prevents.
  const fr = formatCalendarDate(instant, "Africa/Cairo", "fr-FR");
  assert.match(fr, /septembre/);
});
