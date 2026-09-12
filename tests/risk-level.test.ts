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
import { scanForCrisisLanguage } from "../lib/crisis/alerts";
import { PAST, PRESENT, RESOLVED, THIRD_PARTY, stillCounts } from "../lib/crisis/context";
import { contains, fold, foldsToNothing } from "../lib/crisis/fold";

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

/* ------------------------------------------ 35R · the context guard, both ways -- */

/**
 * 🔴 The only thing in this product that makes an alert LESS likely.
 *
 * Every test here is paired: a sentence it must suppress and a sentence that
 * looks suppressible and must still fire. A guard proved only by what it
 * silences is C165's locked door nobody opened, and the cost of this one being
 * wrong is the cost that cannot be undone.
 */

test("🔴 C173 no marker folds away to nothing, in any list", () => {
  // This is the bug twice over. C161 in sprint 32, and again in 35R in a new
  // file: a marker that normalises to "" matches EVERY string, which turned
  // "is this about the present?" into "yes, always" and silently disabled the
  // whole guard. The lists are data, so the check is over the data.
  for (const [name, list] of [
    ["THIRD_PARTY", THIRD_PARTY],
    ["PAST", PAST],
    ["RESOLVED", RESOLVED],
    ["PRESENT", PRESENT],
  ] as const) {
    assert.deepEqual(foldsToNothing(list), [], `${name} has a marker that folds to nothing`);
  }
});

test("🔴 C173 an empty needle contains nothing", () => {
  assert.equal(contains("any English sentence at all", ""), false);
  assert.equal(contains("any English sentence at all", "   "), false);
  assert.equal(fold("الان").length > 0, true, "Arabic must survive folding");
});

test("a story about somebody else does not alert", () => {
  assert.deepEqual(scanForCrisisLanguage("My brother took an overdose in 2019."), []);
  assert.deepEqual(scanForCrisisLanguage("أخي انتحر من سنتين."), []);
});

test("🔴 …but the patient's own disclosure in the next sentence does", () => {
  assert.ok(
    scanForCrisisLanguage(
      "My brother took an overdose in 2019. Since then I have thought about an overdose myself.",
    ).length > 0,
  );
  assert.ok(scanForCrisisLanguage("أخي انتحر من سنتين. وأنا بقيت أفكر أنهي حياتي زيه.").length > 0);
});

test("🔴 …and a relative in the same sentence does not silence the speaker", () => {
  assert.ok(
    scanForCrisisLanguage("My brother worries about me and I have been thinking I want to die.")
      .length > 0,
    "'I' before the phrase means the speaker put themselves in it",
  );
});

test("something said to be over does not alert", () => {
  assert.deepEqual(
    scanForCrisisLanguage(
      "When I was nineteen I used to cut myself. That is over and it has not come back.",
    ),
    [],
  );
  assert.deepEqual(
    scanForCrisisLanguage("زمان كنت أجرح نفسي، لكن ذلك انتهى ولم أعد أفعله."),
    [],
  );
});

test("🔴 …but the present beats the past, ANYWHERE in the text", () => {
  // The widened case set caught this within an hour of the guard being
  // written: the correction that matters was in the next sentence, where
  // nothing was looking, and the alert was silently lost.
  assert.ok(
    scanForCrisisLanguage(
      "Years ago I felt suicidal and it passed. It is back now, worse than it was.",
    ).length > 0,
  );
  assert.ok(
    scanForCrisisLanguage("قبل سنوات كنت أفكر في إيذاء نفسي وانتهى ذلك. رجع تاني من شهر.").length >
      0,
  );
  assert.ok(
    scanForCrisisLanguage("I used to want to die when I was twenty. I still do, most mornings.")
      .length > 0,
  );
});

test("🔴 a past tense ALONE never suppresses: only an explicit ending does", () => {
  assert.ok(scanForCrisisLanguage("I tried to kill myself last year.").length > 0);
  assert.ok(scanForCrisisLanguage("حاولت أنهي حياتي السنة الماضية.").length > 0);
});

test("a plain disclosure is untouched by any of this", () => {
  assert.ok(scanForCrisisLanguage("I want to die.").length > 0);
  assert.ok(scanForCrisisLanguage("أتمنى أن أموت.").length > 0);
  assert.equal(stillCounts("I want to die.", "want to die"), true);
});

test("a phrase that is not in the text is not suppressed into existence", () => {
  assert.equal(stillCounts("We talked about the weather.", "want to die"), true);
  assert.deepEqual(scanForCrisisLanguage("We talked about the weather."), []);
});
