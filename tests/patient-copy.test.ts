import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

import { patientCopyText } from "../lib/clinical/patient-copy";

/**
 * 🔴 The patient's email carries only what was written to them.
 *
 * `releaseBrief` used to fall back to the note's `summary` when the patient's
 * copy was empty. `summary` is the clinician's field, written for the record,
 * and the clinician approving an empty patient copy never saw it as something
 * the patient would read. Empty copy now means nothing is sent.
 */

test("the patient's own copy is what is sent", () => {
  assert.equal(patientCopyText({ patientBrief: "  What we talked about.  ", summary: "Clinical." }), "What we talked about.");
});

test("an empty patient copy sends nothing, never the clinician's summary", () => {
  assert.equal(patientCopyText({ patientBrief: "", summary: "Low mood, passive ideation." }), null);
  assert.equal(patientCopyText({ patientBrief: "   ", summary: "Low mood." }), null);
  assert.equal(patientCopyText({ summary: "Low mood." }), null);
  assert.equal(patientCopyText(null), null);
});

test("the feedback module reads the patient's copy only through patientCopyText", () => {
  // Both the email and the rating page once fell back to `summary`, one with
  // `||` and one with `??`. Neither may come back in any spelling.
  const source = readFileSync(new URL("../lib/data/feedback.ts", import.meta.url), "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\/\/.*$/gm, "");
  assert.doesNotMatch(source, /(?:content|noteContent)\?\.summary/);
});
