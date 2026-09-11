import assert from "node:assert/strict";
import { test } from "node:test";

import {
  ageLabel,
  currencyOf,
  halfLifeDays,
  maySupersede,
  priorityOf,
} from "../lib/clinical/currency";

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
