import assert from "node:assert/strict";
import { test } from "node:test";

import { MalformedModelOutputError, parseJsonStrict } from "../lib/ai/client";
import { readProfileOutput } from "../lib/ai/profile";
import { readRiskOutput, traceable } from "../lib/ai/risk";
import { PROCESSORS, TERMS_VERSION, signupConsentProblem } from "../lib/consent/terms";
import { aiPausedFrom } from "../lib/data/ai-consent";
import { TICKET_TOPICS } from "../lib/db/schema";
import { __shared, localiseShared } from "../lib/i18n/errors";
import { ar, en, type MessageKey } from "../lib/i18n/messages";
import { translator } from "../lib/i18n/server";
import { specialtyLabel, taxonomyKey } from "../lib/i18n/taxonomy-label";
import { RADAR_SPECIALTIES } from "../lib/geo";
import { resolveVisitorZone } from "../lib/scheduling/tz";
import { countryFromGeoHeader } from "../lib/visitor-country";

/*
 * The independent due diligence findings F3, F11, F13, F14, F18 and F21, each held
 * by the smallest test that would fail if the fix were undone.
 */

const form = (fields: Record<string, string>) => ({ get: (name: string) => fields[name] ?? null });

/* ------------------------------------------------------------ F3 and F11 -- */

test("F3/F11 signup refuses an unticked notice, and a patient who does not confirm 18 or older", () => {
  assert.equal(signupConsentProblem(form({}), { needsAdult: false }), "terms");
  assert.equal(signupConsentProblem(form({ terms: "on" }), { needsAdult: false }), null);
  assert.equal(signupConsentProblem(form({ terms: "on" }), { needsAdult: true }), "adult");
  assert.equal(signupConsentProblem(form({ adult: "on" }), { needsAdult: true }), "terms");
  assert.equal(signupConsentProblem(form({ adult: "on", terms: "on" }), { needsAdult: true }), null);
  /* Anything but a ticked box is not a tick. */
  assert.equal(signupConsentProblem(form({ adult: "off", terms: "on" }), { needsAdult: true }), "adult");
  assert.match(TERMS_VERSION, /^\d{4}-\d{2}-\d{2}$/);
});

test("F3 the signup notice names every processor, in both languages", () => {
  const english = ["openai", "daily", "resend", "hosting"]
    .map((k) => en[`signupConsent.${k}` as MessageKey])
    .join(" ");
  const arabic = ["openai", "daily", "resend", "hosting"]
    .map((k) => ar[`signupConsent.${k}` as MessageKey])
    .join(" ");
  for (const processor of PROCESSORS) {
    assert.ok(english.includes(processor.name), `${processor.name} missing in English`);
    assert.ok(arabic.includes(processor.name), `${processor.name} missing in Arabic`);
  }
  assert.match(english, /United States/);
  assert.match(arabic, /الولايات المتحدة/);
  /* The under-18 refusal points somewhere, in both languages. */
  assert.match(en["signupConsent.under18"], /18/);
  assert.match(en["signupConsent.under18"], /emergency/);
  assert.match(ar["signupConsent.under18"], /الطوارئ/);
});

test("F3 the recording consent says an AI provider transcribes it, and where", () => {
  for (const key of ["consent.point.notes", "jconsent.recordDetail"] as const) {
    assert.match(en[key], /OpenAI/, key);
    assert.match(en[key], /United States/, key);
    assert.match(ar[key], /OpenAI/, key);
    assert.match(ar[key], /الولايات المتحدة/, key);
  }
});

test("F3 a withdrawn consent pauses AI, agreeing again resumes it, never asked is not paused", () => {
  const day = (n: number) => new Date(Date.UTC(2026, 9, n));
  assert.equal(aiPausedFrom([]), false);
  assert.equal(aiPausedFrom([{ agreedAt: day(1), withdrawnAt: null }]), false);
  assert.equal(aiPausedFrom([{ agreedAt: day(1), withdrawnAt: day(2) }]), true);
  assert.equal(
    aiPausedFrom([
      { agreedAt: day(1), withdrawnAt: day(2) },
      { agreedAt: day(3), withdrawnAt: null },
    ]),
    false,
  );
  /* Order of the rows does not matter; the newest agreement decides. */
  assert.equal(
    aiPausedFrom([
      { agreedAt: day(3), withdrawnAt: day(4) },
      { agreedAt: day(1), withdrawnAt: null },
    ]),
    true,
  );
});

/* ------------------------------------------------------------------- F13 -- */

test("F13 malformed risk output is a failure, never an empty list of findings", () => {
  for (const bad of [null, "", "not json", "```json\n{oops}\n```", "[]", '"a string"', "{}", '{"findings":"none"}']) {
    assert.throws(() => readRiskOutput(bad), MalformedModelOutputError, String(bad));
  }
  /* An empty array the model actually sent is a real answer. */
  assert.deepEqual(readRiskOutput('{"findings":[]}'), []);
  /* A fenced, well-formed answer still reads. */
  const fenced = readRiskOutput('```json\n{"findings":[{"indicator":"ideation","quote":"I want it to stop","confidence":0.8}]}\n```');
  assert.equal(fenced.length, 1);
  const { kept } = traceable(fenced, "Patient: some days I want it to stop.");
  assert.equal(kept[0]?.indicator, "ideation");
});

test("F13 malformed profile output is null, so the stored profile and timeline are kept", () => {
  for (const bad of [null, "", "nope", "[]", "{}", '{"sections":"Presenting problem"}']) {
    assert.equal(readProfileOutput(bad), null, String(bad));
  }
  const good = readProfileOutput('{"sections":[],"conflicts":[]}');
  assert.ok(good);
  /* No observations array in a good reply: the timeline must not be replaced. */
  assert.equal(Array.isArray(good.observations), false);
  assert.ok(Array.isArray(readProfileOutput('{"sections":[],"observations":[]}')?.observations));
});

test("F13 the strict parse says why it failed", () => {
  assert.deepEqual(parseJsonStrict(null, "t"), { ok: false, reason: "empty" });
  assert.deepEqual(parseJsonStrict("{", "t"), { ok: false, reason: "unparseable" });
  assert.deepEqual(parseJsonStrict("[1]", "t"), { ok: false, reason: "not_object" });
  assert.deepEqual(parseJsonStrict('{"a":1}', "t"), { ok: true, value: { a: 1 } });
});

/* ------------------------------------------------------------- F11 radar -- */

test("F11 the radar says the licence document was reviewed, not checked with a regulator", () => {
  for (const key of ["radar.verifiedWith", "radar.verifiedPlain"] as const) {
    assert.match(en[key], /Licence document/, key);
    assert.match(en[key], /reviewed by 24Therapy/, key);
    assert.doesNotMatch(en[key], /checked with/i, key);
    assert.match(ar[key], /مستند الرخصة/, key);
  }
  assert.doesNotMatch(ar["radar.verifiedWith"], /موثّقة لدى/);
});

/* ------------------------------------------------------------------- F18 -- */

test("F18 every contact topic has a label in both languages", () => {
  for (const topic of TICKET_TOPICS) {
    const key = `contact.topic.${topic}` as MessageKey;
    assert.ok(en[key], key);
    assert.match(ar[key], /[؀-ۿ]/, key);
  }
});

test("F18 every radar specialty has an Arabic label the cards can show", () => {
  const t = translator("ar");
  for (const specialty of RADAR_SPECIALTIES) {
    assert.ok(taxonomyKey("specialty", specialty), specialty);
    assert.match(specialtyLabel(specialty, t), /[؀-ۿ]/, specialty);
  }
  /* A custom specialty nobody translated is shown as it was stored. */
  assert.equal(specialtyLabel("Equine therapy", t), "Equine therapy");
});

test("F18 shared English refusals map to keys with the same English and real Arabic", () => {
  for (const [sentence, key] of Object.entries(__shared)) {
    assert.equal(en[key], sentence, key);
    assert.match(ar[key], /[؀-ۿ]/, key);
    assert.equal(localiseShared(sentence, translator("ar")), ar[key]);
  }
  assert.equal(localiseShared("Not a known sentence.", translator("ar")), "Not a known sentence.");
});

test("F18 every patient error key has Arabic", () => {
  for (const key of Object.keys(en).filter((k) => k.startsWith("perr."))) {
    assert.match(ar[key as MessageKey], /[؀-ۿ]/, key);
  }
});

/* ------------------------------------------------------------------- F21 -- */

test("F21 a missing or unsupported geo country is Egypt, never somewhere we do not serve", () => {
  assert.deepEqual(countryFromGeoHeader(null), { code: "EG", known: false });
  assert.deepEqual(countryFromGeoHeader(""), { code: "EG", known: false });
  assert.deepEqual(countryFromGeoHeader("GA"), { code: "EG", known: false });
  assert.deepEqual(countryFromGeoHeader("xx-1"), { code: "EG", known: false });
  assert.deepEqual(countryFromGeoHeader("eg"), { code: "EG", known: true });
  assert.deepEqual(countryFromGeoHeader("SA"), { code: "SA", known: true });
});

test("F21 a signed-out visitor in Egypt or unknown sees Cairo time, not UTC", () => {
  assert.equal(resolveVisitorZone(null, null, "EG").name, "Africa/Cairo");
  assert.equal(resolveVisitorZone(null, null, null).name, "Africa/Cairo");
  /* A browser that only says UTC (every headless one) tells us nothing. */
  assert.equal(resolveVisitorZone("UTC", null, "EG").name, "Africa/Cairo");
  assert.equal(resolveVisitorZone("Etc/UTC", "Asia/Dubai", "EG").name, "Africa/Cairo");
  /* A real browser zone is the reader's own clock and wins. */
  const london = resolveVisitorZone("Europe/London", null, "EG");
  assert.deepEqual(london, { name: "Europe/London", source: "reader" });
  /* Elsewhere, the clinician's zone, then UTC, as before. */
  assert.equal(resolveVisitorZone(null, "Asia/Dubai", "AE").name, "Asia/Dubai");
  assert.equal(resolveVisitorZone(null, null, "US").name, "UTC");
});
