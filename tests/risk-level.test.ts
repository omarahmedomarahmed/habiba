import assert from "node:assert/strict";
import { test } from "node:test";

import {
  atLeast,
  keywordFloor,
  levelFor,
  recommendedAction,
  shouldAlert,
  type Finding,
} from "../lib/crisis/level";
import { traceable } from "../lib/ai/risk";

/**
 * The adjudication, which no model touches. PLAN.md 35.3.
 *
 * 🔴 This is the most safety-critical pure function in the repository. It
 * decides whether a clinician is paged about a person who said they had
 * written letters to their family, and it decides it the same way every time,
 * which is the entire argument for it being arithmetic rather than a model's
 * opinion. So it is tested the way arithmetic is tested.
 */

const finding = (indicator: string, quote = "a line from the transcript"): Finding =>
  ({ indicator, quote, confidence: 0.8 }) as Finding;

/* -------------------------------------------------------------- the floor -- */

test("🔴 the keyword floor cannot be lowered by anything the model returns", () => {
  // The failure this forecloses: a classifier returning nothing on a session
  // where somebody said "أتمنى أن أموت", and the alert the old, dumber system
  // would have raised never being raised at all.
  assert.equal(levelFor([], ["اتمني ان اموت"]), "elevated");
  assert.equal(levelFor([finding("protective_factor")], ["want to die"]), "elevated");
  assert.equal(keywordFloor(["want to die"]), "elevated");
  assert.equal(keywordFloor([]), "none");
});

test("…and the model can always raise it", () => {
  assert.equal(levelFor([finding("ideation"), finding("plan")], ["want to die"]), "high");
  assert.equal(
    levelFor([finding("ideation"), finding("plan"), finding("means")], ["want to die"]),
    "critical",
  );
});

test("a model outage leaves exactly the old behaviour", () => {
  // `assessSessionRisk` catches the error and passes no findings.
  assert.equal(levelFor([], ["cut myself"]), "elevated");
  assert.equal(levelFor([], []), "none");
});

/* -------------------------------------------------------------- the ladder -- */

test("ideation alone is elevated; with a plan it is high; with means it is critical", () => {
  assert.equal(levelFor([finding("ideation")]), "elevated");
  assert.equal(levelFor([finding("ideation"), finding("plan")]), "high");
  assert.equal(levelFor([finding("ideation"), finding("intent")]), "high");
  assert.equal(levelFor([finding("ideation"), finding("plan"), finding("means")]), "critical");
  assert.equal(levelFor([finding("ideation"), finding("plan"), finding("timeframe")]), "critical");
});

test("🔴 a plan with no stated ideation is still a plan", () => {
  // "I have written letters and put them in the drawer. I have sorted
  // everything out." Nobody says they want to die, and it is the one case the
  // phrase list cannot reach.
  assert.equal(levelFor([finding("plan")]), "elevated");
  assert.equal(levelFor([finding("intent")]), "elevated");
});

test("homicidal ideation and psychosis stand on their own", () => {
  assert.equal(levelFor([finding("homicidal_ideation")]), "critical");
  assert.equal(levelFor([finding("psychosis")]), "critical");
});

test("a previous attempt is history: it is recorded, it does not page anybody", () => {
  assert.equal(levelFor([finding("previous_attempt")]), "moderate");
  assert.equal(shouldAlert("moderate"), false);
  assert.equal(shouldAlert("elevated"), true);
});

test("🔴 protective factors never subtract", () => {
  // A person with a supportive family and a plan for Friday is not at less
  // risk than a person with a plan for Friday.
  const withPlan = levelFor([finding("ideation"), finding("plan")]);
  const withPlanAndDog = levelFor([
    finding("ideation"),
    finding("plan"),
    finding("protective_factor"),
  ]);
  assert.equal(withPlanAndDog, withPlan);

  // And on their own they raise nothing.
  assert.equal(levelFor([finding("protective_factor")]), "none");
});

test("nothing found is nothing said", () => {
  assert.equal(levelFor([]), "none");
  assert.equal(shouldAlert("none"), false);
});

test("atLeast takes the higher of two levels, never the average", () => {
  assert.equal(atLeast("low", "critical"), "critical");
  assert.equal(atLeast("critical", "low"), "critical");
  assert.equal(atLeast("none", "none"), "none");
});

test("the recommended action is derived, not generated, and takes its locale", () => {
  assert.ok(recommendedAction("critical", "en")!.includes("today"));
  assert.ok(recommendedAction("critical", "ar")!.includes("اليوم"));
  assert.equal(recommendedAction("none"), null);
});

/* ------------------------------------------------------- no quote, no finding -- */

const transcript = "Patient: I have not slept since Tuesday. I keep waking at four.";

test("🔴 a finding that cannot quote the transcript is dropped", () => {
  const { kept, dropped } = traceable(
    [
      { indicator: "ideation", quote: "he seemed hopeless throughout", confidence: 0.9 },
      { indicator: "ideation", quote: "I keep waking at four", confidence: 0.4 },
    ],
    transcript,
  );

  assert.equal(dropped, 1);
  assert.equal(kept.length, 1);
  assert.equal(kept[0]!.quote, "I keep waking at four");
});

test("…and the quote survives being re-punctuated, because a model re-types it", () => {
  const { kept } = traceable(
    [{ indicator: "ideation", quote: "I have not slept, since Tuesday!", confidence: 0.5 }],
    transcript,
  );
  assert.equal(kept.length, 1);
});

test("an indicator that is not on the list is dropped", () => {
  const { kept, dropped } = traceable(
    [{ indicator: "severe_risk", quote: "I keep waking at four", confidence: 1 }],
    transcript,
  );
  assert.equal(kept.length, 0);
  assert.equal(dropped, 1);
});

test("confidence is clamped, never trusted outside 0..1", () => {
  const { kept } = traceable(
    [{ indicator: "ideation", quote: "I keep waking at four", confidence: 7 }],
    transcript,
  );
  assert.equal(kept[0]!.confidence, 1);
});

test("🔴 an Arabic quote is matched through diacritics and alef forms", () => {
  const arabic = "Patient: أتمنى أن أموت وأرتاح من كل هذا.";
  const { kept } = traceable(
    [{ indicator: "ideation", quote: "اتمنى ان اموت", confidence: 0.9 }],
    arabic,
  );
  assert.equal(kept.length, 1, "a re-typed Arabic quote must still match");
});
