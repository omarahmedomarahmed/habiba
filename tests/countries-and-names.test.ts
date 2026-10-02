import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

import { NOT_IN_PICKERS, SMALL_COUNTRIES, countryOptions, countryPoint, project } from "../lib/geo";
import { REGULATORS, regulatorNameFor } from "../lib/regulators";
import { languageLabel, specialtyLabel } from "../lib/i18n/taxonomy-label";
import { ar, type en } from "../lib/i18n/messages";

/* DD-2: the country picker, the Egyptian regulators, and the radar on the Arabic site. */

test("the picker offers the small states the 110m map leaves out, and no Antarctica", () => {
  const codes = new Set(countryOptions("en").map((c) => c.code));
  for (const code of ["BH", "SG", "MT", "KM", "QA", "KW", "LB", "PS", "AE", "EG"]) {
    assert.ok(codes.has(code), code);
  }
  assert.ok(!codes.has("AQ"), "Antarctica");
  for (const code of NOT_IN_PICKERS) assert.ok(!codes.has(code), code);
  assert.ok(!codes.has("IL"), "ruling N36");
  assert.ok(!("IL" in SMALL_COUNTRIES), "ruling N36");
  /* A small state has a dot of its own, not the fallback point in the Atlantic. */
  assert.notDeepEqual(countryPoint("BH"), project(-30, 20));
  /* Named by ICU in Arabic, like every other country. */
  const bahrain = countryOptions("ar").find((c) => c.code === "BH");
  assert.match(bahrain?.name ?? "", /[؀-ۿ]/);
});

test("نقابة المهن الاجتماعية is the Social Professions Syndicate, and an old label reads corrected", () => {
  const egypt = REGULATORS.EG!.join(" | ");
  assert.match(egypt, /Social Professions Syndicate \(نقابة المهن الاجتماعية\)/);
  assert.doesNotMatch(egypt, /Psychologists/);
  assert.equal(
    regulatorNameFor("Egyptian Syndicate of Psychologists and Sociologists (نقابة المهن الاجتماعية)", "en"),
    "Social Professions Syndicate (نقابة المهن الاجتماعية)",
  );
  assert.equal(
    regulatorNameFor("Egyptian Syndicate of Psychologists and Sociologists (نقابة المهن الاجتماعية)", "ar"),
    "نقابة المهن الاجتماعية",
  );
  assert.match(regulatorNameFor(REGULATORS.EG![1]!, "ar") ?? "", /الأمانة العامة للصحة النفسية وعلاج الإدمان/);
});

test("radar language and specialty chips are in the reader's language", () => {
  const tAr = (key: keyof typeof en) => ar[key];
  assert.equal(languageLabel("Arabic", tAr), "العربية");
  assert.equal(specialtyLabel("Anxiety", tAr), "القلق");
  assert.equal(languageLabel("Klingon", tAr), "Klingon", "an untranslated value is shown as stored");
  const filters = readFileSync("components/radar/filters.tsx", "utf8");
  assert.match(filters, /languageLabel\(language\.value, t\)/);
  assert.match(filters, /specialtyLabel\(specialty\.value, t\)/);
  assert.doesNotMatch(filters, /\{language\.value\}\s*<\/|\{specialty\.value\}\s*<\//);
  assert.match(readFileSync("components/radar/radar-list.tsx", "utf8"), /languageLabel\(language, t\)/);
});

test("radar times are in the reader's zone, Cairo until the browser says, never the server's UTC", () => {
  for (const file of ["components/radar/radar-list.tsx", "components/radar/radar-console.tsx", "components/radar/offline-card.tsx"]) {
    const source = readFileSync(file, "utf8");
    assert.match(source, /useReaderZone\(DEFAULT_READER_ZONE\)/, file);
    assert.doesNotMatch(source, /useReaderZone\(\)/, file);
  }
  assert.match(readFileSync("lib/scheduling/tz.ts", "utf8"), /export const DEFAULT_READER_ZONE = "Africa\/Cairo";/);
});
