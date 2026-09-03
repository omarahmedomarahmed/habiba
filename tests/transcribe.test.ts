import assert from "node:assert/strict";
import { test } from "node:test";

import { chunkPrompt, cleanTranscript, normaliseLanguage } from "../lib/ai/transcribe";

/**
 * The language of a transcript, tested as arithmetic.
 *
 * The bug these replace was one line — `language: "en"`, hardcoded into every
 * transcription request — and it meant every Arabic session on the platform was
 * decoded by a model that had been told the audio was English. It survived for
 * months because nothing anywhere could observe it: the request succeeded, text
 * came back, a note was written from it, and only a clinician who actually
 * speaks Arabic could tell that the words were wrong.
 *
 * So the rule is pinned here rather than trusted: an unknown language must
 * produce no language key at all, and a known one must survive intact.
 */

test("a language we do not know becomes null, so the API detects one", () => {
  assert.equal(normaliseLanguage(null), null);
  assert.equal(normaliseLanguage(undefined), null);
  assert.equal(normaliseLanguage(""), null);
  assert.equal(normaliseLanguage("   "), null);
});

test("'auto' is not a language, it is the absence of one", () => {
  // The API rejects "auto" as a language code. It is our word for "omit the
  // key", and it must never reach the request body.
  assert.equal(normaliseLanguage("auto"), null);
  assert.equal(normaliseLanguage("AUTO"), null);
});

test("a language we do know survives", () => {
  assert.equal(normaliseLanguage("ar"), "ar");
  assert.equal(normaliseLanguage("en"), "en");
  assert.equal(normaliseLanguage("tr"), "tr");
});

test("region tags are dropped rather than passed through", () => {
  // "ar-EG" is one language to the transcription API, and sending the full tag
  // fails the request outright. Egyptian Arabic is the house dialect, so this
  // is the exact value most likely to arrive here.
  assert.equal(normaliseLanguage("ar-EG"), "ar");
  assert.equal(normaliseLanguage("ar_SA"), "ar");
  assert.equal(normaliseLanguage("en-GB"), "en");
  assert.equal(normaliseLanguage("PT-br"), "pt");
});

test("a code we cannot support becomes null, never a bad request", () => {
  // A rejected language tag fails the whole chunk and loses the audio. An
  // omitted one just means "work it out", so unknown input degrades to the
  // safe behaviour rather than the loud one.
  assert.equal(normaliseLanguage("klingon"), null);
  assert.equal(normaliseLanguage("zz"), null);
  assert.equal(normaliseLanguage("!!"), null);
});

test("the decoding hint follows the language, not the codebase", () => {
  // An English prompt on Arabic audio is a pull toward English output on
  // exactly the ambiguous chunks where it does most damage — the same bias the
  // hardcoded tag caused, through a different door.
  const arabic = chunkPrompt("ar");
  assert.notEqual(arabic, chunkPrompt("en"));
  assert.match(arabic, /[؀-ۿ]/, "the Arabic prompt is written in Arabic");
});

test("an unlisted language falls back to English rather than breaking", () => {
  assert.equal(chunkPrompt("ja"), chunkPrompt("en"));
  assert.equal(chunkPrompt(null), chunkPrompt("en"));
});

test("Arabic silence artefacts are dropped", () => {
  // These only became reachable once the language was no longer forced to
  // English. With "en" hardcoded, Arabic silence hallucinated as the English
  // artefacts; now it produces the Arabic subtitle-credit phrases instead, and
  // none of the English entries match them.
  assert.equal(cleanTranscript("شكرا لمشاهدتكم"), "");
  assert.equal(cleanTranscript("اشتركوا في القناة"), "");
  assert.equal(cleanTranscript("  [موسيقى]  "), "");
});

test("real Arabic speech is never dropped as an artefact", () => {
  /*
   * "الحمد لله" appears in subtitle training data often enough to look like an
   * artefact, and it is also one of the most ordinary things an Arabic-speaking
   * patient says out loud. Filtering it would delete real clinical content from
   * a chart to save one line of noise.
   */
  assert.equal(cleanTranscript("الحمد لله"), "الحمد لله");
  assert.equal(cleanTranscript("أنا تعبان من أسبوعين"), "أنا تعبان من أسبوعين");
});

test("English artefacts still go, and real English stays", () => {
  assert.equal(cleanTranscript("Thank you."), "");
  assert.equal(cleanTranscript("thanks for watching!"), "");
  assert.equal(cleanTranscript("Thank you for seeing me today."), "Thank you for seeing me today.");
});
