import assert from "node:assert/strict";
import { test } from "node:test";

import {
  ageLabel,
  currencyOf,
  halfLifeDays,
  maySupersede,
  priorityOf,
  rankFacts,
} from "../lib/clinical/currency";
import { factsForPrompt, factsPrompt } from "../lib/clinical/context";

/**
 * The temporal and priority rules of the evidence layer. PLAN.md 33.2, 33.3.
 *
 * Pure, so "ideation eight months ago is not ideation now" is an assertion
 * rather than a sentence in a design document. `now` is a parameter to every
 * function here, which is C84's rule: a value read from the runtime is a value
 * nobody can test, and this one decides whether a clinician sees a red flag.
 */

const DAY = 24 * 60 * 60 * 1000;
const NOW = new Date("2026-09-13T12:00:00Z");
const daysAgo = (days: number) => new Date(NOW.getTime() - days * DAY);

/* ------------------------------------------------------------- the ageing -- */

test("🔴 ideation eight months ago is not ideation now", () => {
  const fact = { domain: "risk", effectiveAt: daysAgo(240) };
  const currency = currencyOf(fact, NOW);

  assert.equal(currency.ageDays, 240);
  assert.equal(currency.current, false);
  assert.ok(currency.label.includes("not current"), currency.label);
});

test("…and ideation last week is", () => {
  const currency = currencyOf({ domain: "risk", effectiveAt: daysAgo(7) }, NOW);
  assert.equal(currency.current, true);
  assert.equal(currency.label, "7 days ago");
});

test("🔴 a diagnosis does not expire on a timer", () => {
  // The clinician who has not seen this patient for a year is exactly the
  // person who most needs the standing diagnosis to still be on the chart.
  const currency = currencyOf({ domain: "diagnosis", effectiveAt: daysAgo(700) }, NOW);
  assert.equal(halfLifeDays("diagnosis"), null);
  assert.equal(currency.current, true);
});

test("a domain nobody has thought about gets a default rather than immortality", () => {
  assert.equal(halfLifeDays("something-new"), 180);
  assert.equal(currencyOf({ domain: "something-new", effectiveAt: daysAgo(200) }, NOW).current, false);
});

test("🔴 age is measured from when it was TRUE, not from when it was written", () => {
  // A session in November describing "last spring" produces a fact that is
  // eight months old the moment it is recorded. Ageing from the write would
  // show it as today's news, which is the whole failure this sprint kills.
  const described = currencyOf({ domain: "risk", effectiveAt: daysAgo(240) }, NOW);
  const recorded = currencyOf({ domain: "risk", effectiveAt: NOW }, NOW);

  assert.equal(described.current, false);
  assert.equal(recorded.current, true);
});

test("a date in the future is zero days old, not a negative number", () => {
  const currency = currencyOf({ domain: "risk", effectiveAt: new Date(NOW.getTime() + DAY) }, NOW);
  assert.equal(currency.ageDays, 0);
  assert.equal(currency.label, "today");
});

test("an ISO string is read the same as a Date", () => {
  const asDate = currencyOf({ domain: "risk", effectiveAt: daysAgo(10) }, NOW);
  const asString = currencyOf({ domain: "risk", effectiveAt: daysAgo(10).toISOString() }, NOW);
  assert.deepEqual(asDate, asString);
});

/* -------------------------------------------------------------- the words -- */

test("the age label takes its locale as a parameter (C150)", () => {
  assert.equal(ageLabel(0, true, "en"), "today");
  assert.equal(ageLabel(0, true, "ar"), "اليوم");
  assert.ok(ageLabel(240, false, "ar").includes("غير محدَّث"), ageLabel(240, false, "ar"));
});

test("a stale fact says so in the label, in both languages", () => {
  assert.ok(ageLabel(240, false, "en").includes("not current"));
  assert.ok(!ageLabel(240, true, "en").includes("not current"));
});

/* ----------------------------------------------------------- the priority -- */

test("🔴 a model cannot overrule a human, at any confidence", () => {
  assert.equal(maySupersede("ai", "clinician"), false);
  assert.equal(maySupersede("ai", "document"), false);
  assert.equal(maySupersede("ai", "patient"), false);
  assert.equal(maySupersede("ai", "ai"), true);
});

test("🔴 the patient outranks the model, which is where this differs from the plan", () => {
  // The commonest conflict this product will ever have: a person saying "I
  // stopped taking that in June" against an inference from a transcript that
  // predates June. Resolving it in the model's favour would be wrong every
  // time. See C164.
  assert.ok(priorityOf("patient") < priorityOf("ai"));
  assert.equal(maySupersede("patient", "ai"), true);
});

test("a clinician outranks everything, and a document outranks the patient's recall", () => {
  assert.ok(priorityOf("clinician") < priorityOf("document"));
  assert.ok(priorityOf("document") < priorityOf("patient"));
  assert.equal(maySupersede("clinician", "patient"), true);
  assert.equal(maySupersede("document", "clinician"), false);
});

/* ------------------------------------------------------- C166, the ranking -- */

test("🔴 C166 a stale fact loses its rank to a current one, whatever its source", () => {
  // The founder's case: an old patient remark against a new document.
  const remark = { domain: "presentation", effectiveAt: daysAgo(730), sourcePriority: 3 };
  const letter = { domain: "presentation", effectiveAt: daysAgo(7), sourcePriority: 2 };

  assert.deepEqual(rankFacts([remark, letter], NOW), [letter, remark]);
});

test("…and among current facts the ladder still decides", () => {
  const patient = { domain: "presentation", effectiveAt: daysAgo(2), sourcePriority: 3 };
  const clinician = { domain: "presentation", effectiveAt: daysAgo(20), sourcePriority: 1 };

  assert.deepEqual(rankFacts([patient, clinician], NOW), [clinician, patient]);
});

test("🔴 a clinician's DIAGNOSIS is never demoted by age, because it never goes stale", () => {
  // The cost named in C166 is bounded by this: nothing a clinician diagnosed
  // is ever outranked by a fresher model inference.
  const diagnosis = { domain: "diagnosis", effectiveAt: daysAgo(900), sourcePriority: 1 };
  const inference = { domain: "diagnosis", effectiveAt: daysAgo(1), sourcePriority: 4 };

  assert.deepEqual(rankFacts([inference, diagnosis], NOW), [diagnosis, inference]);
});

test("equally current and equally ranked, the more recent wins", () => {
  const older = { domain: "presentation", effectiveAt: daysAgo(30), sourcePriority: 2 };
  const newer = { domain: "presentation", effectiveAt: daysAgo(3), sourcePriority: 2 };

  assert.deepEqual(rankFacts([older, newer], NOW), [newer, older]);
});

/* --------------------------------------------------- 34.1, what a model sees -- */

const fact = (over: Partial<Parameters<typeof factsPrompt>[0][number]> = {}) => ({
  /* `social` is a domain a session does not re-measure, so C170 sends it. */
  domain: "social",
  field: "housing",
  value: "lives with a flatmate",
  sourceType: "clinician" as const,
  status: "active",
  verifiedAt: null,
  effectiveAt: daysAgo(10),
  ...over,
});

test("🔴 C167 an unverified model guess never enters another model's context", () => {
  const guess = fact({ sourceType: "ai" });
  const confirmed = fact({ sourceType: "ai", verifiedAt: NOW, value: "lives alone now" });

  assert.equal(factsForPrompt([guess], NOW).length, 0);
  assert.equal(factsForPrompt([confirmed], NOW).length, 1);
});

test("🔴 C168 no diagnosis is sent to the note generator at all", () => {
  assert.equal(factsForPrompt([fact({ domain: "diagnosis" })], NOW).length, 0);
  assert.equal(factsForPrompt([fact({ domain: "medication" })], NOW).length, 1);
});

test("🔴 C170 nothing a session re-measures is sent, because the model cannot arbitrate", () => {
  // Measured: when a prior fact disagreed with the transcript, the note
  // followed the PRIOR FACT 93% of the time. Sleep, work and risk are exactly
  // what the session is about to report on, so a stored value is a rival
  // account rather than background.
  for (const domain of ["presentation", "function", "risk"]) {
    assert.equal(factsForPrompt([fact({ domain })], NOW).length, 0, domain);
  }
  for (const domain of ["history", "social", "goal", "medication"]) {
    assert.equal(factsForPrompt([fact({ domain })], NOW).length, 1, domain);
  }
});

test("a disputed fact is never sent: disagreeing has to mean something", () => {
  assert.equal(factsForPrompt([fact({ status: "disputed" })], NOW).length, 0);
  assert.equal(factsForPrompt([fact({ status: "unsupported" })], NOW).length, 0);
  assert.equal(factsForPrompt([fact({ status: "historical" })], NOW).length, 0);
});

test("a stale fact is never sent either", () => {
  assert.equal(factsForPrompt([fact({ effectiveAt: daysAgo(400) })], NOW).length, 0);
});

test("nothing to say produces no block at all, so an ungrounded note is unchanged", () => {
  assert.equal(factsPrompt([], NOW), "");
  assert.equal(factsPrompt([fact({ sourceType: "ai" })], NOW), "");
});

test("🔴 the rules are stated ABOVE the facts, never below them (H2)", () => {
  const block = factsPrompt([fact()], NOW);
  const rulesAt = block.indexOf("Nothing here may go in the note");
  const factAt = block.indexOf("lives with a flatmate");

  assert.ok(rulesAt >= 0 && factAt >= 0);
  assert.ok(rulesAt < factAt, "an instruction placed after the content loses to it");
});

test("every line carries its age and its source, in words", () => {
  const block = factsPrompt([fact()], NOW);
  assert.ok(block.includes("10 days ago"), block);
  assert.ok(block.includes("recorded by the clinician"), block);
});
