import assert from "node:assert/strict";
import { test } from "node:test";

import {
  claimScore,
  diarisationError,
  noteText,
  normaliseWords,
  pct,
  riskScore,
  sectionCoverage,
  wordErrorRate,
} from "../evals/metrics";

/**
 * The scorers, checked against numbers computed by hand. PLAN.md 32.1.
 *
 * 🔴 This file exists because every figure sprint 32 produces is `metrics.ts`'s
 * opinion. A broken edit distance does not give a weaker measurement, it gives
 * a confident wrong one — and a confident wrong number in a sprint report is
 * precisely what C157 had to retract. An eval suite with untested scorers is
 * worse than no eval suite, because it converts "we do not know" into a figure
 * somebody will quote.
 */

/* ------------------------------------------------------------ normalising -- */

test("punctuation and case are not transcription errors", () => {
  assert.deepEqual(normaliseWords("It's fine, really."), ["its", "fine", "really"]);
});

test("🔴 Arabic diacritics and alef forms are folded, and the letters survive", () => {
  // The same sentence typed by two people, one of them vowelling it.
  assert.deepEqual(normaliseWords("أنا مُتعَب"), normaliseWords("انا متعب"));
  assert.deepEqual(normaliseWords("مدرسة"), normaliseWords("مدرسه"));

  /*
   * 🔴 The second half of each assertion, and the reason it is here.
   *
   * The first version of the diacritic class was written with literal
   * characters and its ranges swallowed the Arabic **letters** as well, so
   * every Arabic string normalised to nothing — and this test passed, because
   * two empty arrays are deeply equal. A vacuous pass, in the file whose whole
   * job is to stop vacuous numbers. It was caught by the crisis scanner
   * matching every English sentence in the eval set, since an empty needle is
   * `includes`-true for everything. C90's rule, in a new costume: assert that
   * the thing survived, not only that two sides agree.
   */
  assert.deepEqual(normaliseWords("أنا مُتعَب"), ["انا", "متعب"]);
  assert.equal(normaliseWords("مدرسة").length, 1);
});

/* --------------------------------------------------------------- the WER -- */

test("an identical transcription is zero", () => {
  const result = wordErrorRate("I could not sleep at all", "I could not sleep at all");
  assert.equal(result.wer, 0);
  assert.equal(result.referenceWords, 6);
});

test("one substitution in six words is one sixth", () => {
  const result = wordErrorRate("I could not sleep at all", "I could not sleep at night");
  assert.equal(result.substitutions, 1);
  assert.equal(result.deletions, 0);
  assert.equal(result.insertions, 0);
  assert.equal(result.wer, 1 / 6);
});

test("a dropped word is a deletion and an added word is an insertion", () => {
  const dropped = wordErrorRate("I could not sleep at all", "I could not sleep all");
  assert.equal(dropped.deletions, 1);
  assert.equal(dropped.insertions, 0);

  const added = wordErrorRate("I could not sleep", "I really could not sleep");
  assert.equal(added.insertions, 1);
  assert.equal(added.deletions, 0);
});

test("🔴 a transcription of nothing loses the whole reference", () => {
  // The failure that matters most and scores 100%: the record is empty and
  // nothing else about the pipeline looks wrong.
  const result = wordErrorRate("I have not been sleeping", "");
  assert.equal(result.wer, 1);
  assert.equal(result.deletions, 5);
});

/* --------------------------------------------------------------- the DER -- */

test("a refusal is not an error, and is counted separately", () => {
  const gold = ["therapist", "patient", "patient"] as const;
  const result = diarisationError([...gold], ["therapist", "unknown", "patient"]);

  assert.equal(result.wrong, 0);
  assert.equal(result.refused, 1);
  assert.equal(result.correct, 2);
  // Over the lines it chose to answer, not over every line.
  assert.equal(result.der, 0);
});

test("🔴 labelling a line the fixture marks ambiguous is an error", () => {
  // The rule at the top of the diarisation prompt: a line with two speakers in
  // it is "unknown", and guessing to be tidy is the failure.
  const result = diarisationError(["unknown", "patient"], ["therapist", "patient"]);
  assert.equal(result.wrong, 1);
  assert.equal(result.ambiguous, 1);
});

test("a system that answers everything wrongly scores 1", () => {
  const result = diarisationError(["therapist", "patient"], ["patient", "therapist"]);
  assert.equal(result.der, 1);
  assert.equal(result.refused, 0);
});

/* ------------------------------------------------------------- the claims -- */

test("a note that names a medication nobody mentioned is caught", () => {
  const result = claimScore("The patient reported taking sertraline daily.", {
    neverSaid: ["sertraline", "bipolar"],
    stated: ["sleep"],
  });
  assert.deepEqual(result.unsupported, ["sertraline"]);
  assert.equal(result.unsupportedRate, 0.5);
  assert.deepEqual(result.missing, ["sleep"]);
  assert.equal(result.coverage, 0);
});

test("the scan reads through punctuation and casing", () => {
  const result = claimScore("Sleep, disturbed.", { neverSaid: [], stated: ["sleep disturbed"] });
  assert.equal(result.coverage, 1);
});

test("noteText reaches nested fields and arrays", () => {
  const text = noteText({ soap: { subjective: "tired" }, steps: ["walk", "write"] });
  assert.ok(text.includes("tired") && text.includes("walk") && text.includes("write"));
});

/* ------------------------------------------------------------- the shape -- */

test("an empty string is as missing as a missing key", () => {
  const result = sectionCoverage({ soap: { subjective: "x", objective: "" } }, [
    "soap.subjective",
    "soap.objective",
    "soap.plan",
  ]);
  assert.deepEqual(result.covered, ["soap.subjective"]);
  assert.deepEqual(result.empty, ["soap.objective", "soap.plan"]);
  assert.equal(result.coverage, 1 / 3);
});

test("an empty array does not count as a filled section", () => {
  assert.equal(sectionCoverage({ steps: [] }, ["steps"]).coverage, 0);
  assert.equal(sectionCoverage({ steps: ["one"] }, ["steps"]).coverage, 1);
});

/* -------------------------------------------------------------- the print -- */

test("a rate prints as a percentage with one decimal", () => {
  // Not cosmetic: 0.846 read as "0.8" in a report would be quoted as a
  // sensitivity of under one per cent.
  assert.equal(pct(0.846), "84.6%");
  assert.equal(pct(0), "0.0%");
  assert.equal(pct(1), "100.0%");
});

/* --------------------------------------------------------------- the risk -- */

test("🔴 neither risk number can be gamed without the other showing it", () => {
  const cases = [
    { id: "a", risk: true },
    { id: "b", risk: true },
    { id: "c", risk: false },
    { id: "d", risk: false },
  ];

  const alertsOnEverything = riskScore(cases, () => true);
  assert.equal(alertsOnEverything.sensitivity, 1);
  assert.equal(alertsOnEverything.specificity, 0);

  const alertsOnNothing = riskScore(cases, () => false);
  assert.equal(alertsOnNothing.sensitivity, 0);
  assert.equal(alertsOnNothing.specificity, 1);
});

test("a miss is reported by name, not as a count", () => {
  const result = riskScore(
    [
      { id: "wants-to-die-ar", risk: true },
      { id: "kill-time", risk: false },
    ],
    (id) => id === "kill-time",
  );
  assert.deepEqual(result.missed, ["wants-to-die-ar"]);
  assert.deepEqual(result.falseAlarms, ["kill-time"]);
});
