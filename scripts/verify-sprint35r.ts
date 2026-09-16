/**
 * Sprint 35R acceptance: the case set. PLAN.md 35R.1 to 35R.3.
 *
 *   npm run verify:sprint35r
 *
 * ## What this is for
 *
 * 35R has one deliverable a reader cannot see by reading a diff: **that the
 * set got wider and nothing got easier.** The tempting version of this sprint
 * is to add cases and quietly move a band when the new cases make a number
 * look worse, and the result would be a bigger set that sees less.
 *
 * So the two rules are mechanical:
 *
 *   1. **The case sets may only grow.** A committed high-water mark, the same
 *      shape as the region-pin ratchet (C157).
 *   2. 🔴 **No tolerance may widen.** Every band in every suite is read from
 *      the source and compared against the figure the baseline was recorded
 *      with. A band that grew fails, by name.
 *
 * And the guard that came with it is proved in both directions, because it is
 * the only thing in this product that makes an alert less likely.
 */
import { readdirSync, readFileSync } from "node:fs";

import { RISK_CASES, SESSIONS, SPEECH_CASES } from "../evals/cases";
import { caseSetChanged, readBaseline } from "../evals/report";
import { scanForCrisisLanguage } from "../lib/crisis/alerts";
import { PAST, PRESENT, RESOLVED, THIRD_PARTY } from "../lib/crisis/context";
import { contains, fold, foldsToNothing } from "../lib/crisis/fold";
import { reporter, readSource } from "./_verify";

const { check, finish } = reporter();

const RATCHET = "evals/cases.json";

/** Every `key` / `tolerance` pair, read from the suites rather than run. */
function declaredTolerances(): Map<string, number> {
  const found = new Map<string, number>();

  for (const file of readdirSync("evals/suites")) {
    const source = readSource(`evals/suites/${file}`);
    const pattern = /key:\s*"([^"]+)"[\s\S]{0,2000}?tolerance:\s*([0-9.]+)/g;
    for (let match = pattern.exec(source); match; match = pattern.exec(source)) {
      /* First one wins: the regex is non-greedy, so it is the nearest band. */
      if (!found.has(match[1]!)) found.set(match[1]!, Number(match[2]));
    }
  }
  return found;
}

async function main() {
  console.log("\nSprint 35R, the eval case set\n");

  const mark = JSON.parse(readSource(RATCHET)) as {
    sessions: number;
    riskCases: number;
    speechCases: number;
  };

  const now = {
    sessions: SESSIONS.length,
    riskCases: RISK_CASES.length,
    speechCases: SPEECH_CASES.length,
  };

  /* -------------------------------------------------------- the sets grew */

  check(
    "🔴 35R.1 fifteen sessions, not five",
    now.sessions >= 15,
    `${now.sessions} sessions, ${SESSIONS.filter((s) => s.language === "ar").length} of them Arabic`,
  );

  check(
    "🔴 35R.1 …and the case sets may only ever GROW",
    now.sessions >= mark.sessions &&
      now.riskCases >= mark.riskCases &&
      now.speechCases >= mark.speechCases,
    `sessions ${now.sessions}/${mark.sessions}, risk ${now.riskCases}/${mark.riskCases}, speech ${now.speechCases}/${mark.speechCases}`,
  );

  check(
    "35R.2 the risk set is widened, and still says what it is in both directions",
    RISK_CASES.filter((c) => c.risk).length >= 25 &&
      RISK_CASES.filter((c) => !c.risk).length >= 19,
    `${RISK_CASES.filter((c) => c.risk).length} positives, ${RISK_CASES.filter((c) => !c.risk).length} negatives`,
  );

  check(
    "🔴 35R.1 the metric that could not see a regression now has enough cases to",
    SESSIONS.filter((s) => s.contradiction).length >= 10,
    `${SESSIONS.filter((s) => s.contradiction).length} contradiction cases, so one case is ${(100 / SESSIONS.filter((s) => s.contradiction).length).toFixed(1)} points`,
  );

  /* ------------------------------------------------- 🔴 and nothing got easier */

  const baseline = readBaseline();
  const declared = declaredTolerances();
  const widened: string[] = [];

  for (const [key, tolerance] of declared) {
    const before = baseline?.metrics[key]?.tolerance;
    if (before !== undefined && tolerance > before + 1e-9) {
      widened.push(`${key} ${before} -> ${tolerance}`);
    }
  }

  check(
    "🔴 35R.3 NO tolerance widened in this sprint",
    widened.length === 0,
    widened.length === 0
      ? `${declared.size} bands checked against the baseline, none grew`
      : widened.join(", "),
  );

  check(
    "35R.3 …and the check can see a band at all, so it is not passing on nothing",
    declared.size >= 20 && declared.has("grounding.contradiction"),
    `${declared.size} bands read from the suite sources`,
  );

  /* ------------------------------------- the baseline knows what it measured */

  /*
   * 🔴 76.45 — THESE TWO WERE STALE, AND THEY WERE STALE IN THE WAY THIS FILE
   * IS ABOUT.
   *
   * The first read `caseSetChanged(baseline, now).length > 0` and the second
   * compared against the literal `{ sessions: 5, riskCases: 30 }`. Both passed
   * for one reason: the baseline had genuinely drifted from the case set, and
   * had been drifted since sprint 35R, when the OpenAI account ran out of
   * credits and the model suites were never re-recorded.
   *
   * So a control written to prove "the runner refuses a changed shape" was
   * actually asserting "the shape is currently changed", and the moment
   * somebody re-recorded the baseline, which is the fix, both went red. A check
   * that fails when the thing it guards is put right is measuring the wrong
   * thing, which is the §6 family landing in the instrument for the third time
   * in this repository.
   *
   * Restated as properties. The offender is CONSTRUCTED from the baseline's own
   * recorded shape rather than read off the day's drift, so these hold whether
   * the baseline is current or stale, and a third check says plainly which of
   * those it is.
   */
  const recorded = baseline?.cases ?? { sessions: 0, riskCases: 0, speechCases: 0 };
  const planted = { ...recorded, sessions: (recorded.sessions ?? 0) + 1 };

  check(
    "🔴 35R CONTROL a run over a changed case set is REFUSED rather than compared",
    caseSetChanged(baseline, planted).length > 0,
    caseSetChanged(baseline, planted).join(", ") || "a planted extra session was not noticed",
  );

  check(
    "🔴 35R CONTROL …and a shape identical to the baseline's compares normally",
    caseSetChanged(baseline, recorded).length === 0,
    "otherwise every run would be refused and the gate would be a lid",
  );

  /*
   * 🔴 AND THE ONE THE OTHER TWO WERE STANDING IN FOR: is the baseline
   * CURRENT? This is the product property, it is reported separately from the
   * mechanism, and it is the one that was silently false for forty sprints.
   */
  check(
    "🔴 35R the baseline was recorded on the case set that exists today",
    caseSetChanged(baseline, now).length === 0,
    caseSetChanged(baseline, now).join(", ") ||
      `${now.sessions} sessions, ${now.riskCases} risk cases, ${now.speechCases} speech cases`,
  );

  /* ------------------------------------------------------------- C173, twice */

  for (const [name, list] of [
    ["THIRD_PARTY", THIRD_PARTY],
    ["PAST", PAST],
    ["RESOLVED", RESOLVED],
    ["PRESENT", PRESENT],
  ] as const) {
    check(
      `🔴 C173 every ${name} marker survives folding`,
      foldsToNothing(list).length === 0,
      foldsToNothing(list).join(", ") || `${list.length} markers`,
    );
  }

  check(
    "🔴 C173 an empty needle contains nothing, which is what closes the bug class",
    contains("any English sentence at all", "") === false && fold("الان").length > 0,
  );

  /* ------------------------------------- C171, the guard, proved in both ways */

  const suppressed: [string, string][] = [
    ["somebody else's story", "My brother took an overdose in 2019."],
    ["…in Arabic", "أخي انتحر من سنتين."],
    ["something said to be over", "When I was nineteen I used to cut myself. That is over and it has not come back."],
    ["…in Arabic", "زمان كنت أجرح نفسي، لكن ذلك انتهى ولم أعد أفعله."],
  ];

  for (const [what, text] of suppressed) {
    check(`C171 no alert for ${what}`, scanForCrisisLanguage(text).length === 0, text.slice(0, 48));
  }

  const mustAlert: [string, string][] = [
    ["🔴 the present beats the past, anywhere in the text", "Years ago I felt suicidal and it passed. It is back now, worse than it was."],
    ["🔴 …in Arabic", "قبل سنوات كنت أفكر في إيذاء نفسي وانتهى ذلك. رجع تاني من شهر."],
    ["🔴 a past tense alone never suppresses", "I tried to kill myself last year."],
    ["🔴 the next sentence is the patient's own", "My brother took an overdose in 2019. Since then I have thought about an overdose myself."],
    ["🔴 a relative in the sentence does not silence the speaker", "My brother worries about me and I have been thinking I want to die."],
    ["a plain disclosure is untouched", "I want to die."],
    ["…in Arabic", "أتمنى أن أموت."],
  ];

  for (const [what, text] of mustAlert) {
    check(`C171 ALERT for ${what}`, scanForCrisisLanguage(text).length > 0, text.slice(0, 48));
  }

  finish("Sprint 35R");
}

void main();
