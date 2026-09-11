import type { RiskLevel } from "@/lib/db/schema";

/**
 * What level of risk this session is recorded at. PLAN.md 35.3.
 *
 * ## 🔴 The model does not decide this. Nothing a model returns is read here.
 *
 * 35.3 says *the AI flags and structures, it never adjudicates risk*, and the
 * only way to mean that is to make the adjudication a place a model cannot
 * reach. So the classifier returns **indicators with quotes** and nothing else
 * — there is no `level` field in its schema to fill in — and this function,
 * which is pure, deterministic and unit-tested, turns those indicators into
 * the level that is written to the record and paged to a clinician.
 *
 * Three things follow from that and all three matter:
 *
 *   1. **It is auditable.** "Why was this elevated?" has an answer made of
 *      rules somebody can read, rather than a number a model produced.
 *   2. **It is stable.** The same indicators produce the same level today and
 *      in March, across a model upgrade, at temperature whatever.
 *   3. **It can be argued with.** A clinician who thinks the ladder is wrong
 *      is arguing with a table in a file, not with a black box.
 *
 * ## The keyword floor, and why it is a floor rather than an input
 *
 * 35.2 keeps the phrase list always on. It is not averaged with the model and
 * it is not overruled by it: a keyword hit sets a **minimum** level, and the
 * model can only ever raise it. The failure this forecloses is the one that
 * would matter most — a classifier returning "no indicators" on a session
 * where somebody said "أتمنى أن أموت", and the alert that the old, dumber
 * system would have raised never being raised at all. A model outage, a
 * parsing failure or a bad day cannot lower the floor, because the floor is
 * computed before the model's output is looked at.
 */

/**
 * What the classifier is allowed to report. PLAN.md 35.1.
 *
 * Deliberately the clinical decomposition rather than a severity scale:
 * ideation, intent, plan, means and timeframe are separate questions with
 * separate answers, and it is the *combination* that a clinician acts on. A
 * model asked for "risk: high" gives you one number with everything collapsed
 * into it; asked for these, it gives you the parts, and the parts are what the
 * ladder below reads.
 */
export const RISK_INDICATORS = [
  "ideation",
  "intent",
  "plan",
  "means",
  "timeframe",
  "previous_attempt",
  "self_harm",
  "homicidal_ideation",
  "psychosis",
  "abuse",
  /*
   * 🔴 Protective factors are an indicator like the others, and they NEVER
   * lower the level.
   *
   * They are recorded because a clinician making a safety plan needs them, and
   * because "she has a dog she gets up for at seven" is exactly the sort of
   * thing that gets lost between sessions. What they must not do is subtract:
   * a person with a supportive family and a plan for Friday is not at less
   * risk than a person with a plan for Friday. The ladder below never reads
   * this one.
   */
  "protective_factor",
] as const;

export type RiskIndicator = (typeof RISK_INDICATORS)[number];

export type Finding = {
  indicator: RiskIndicator;
  /** 🔴 The sentence. A finding that cannot quote the transcript is dropped. */
  quote: string;
  /** The model's own number, recorded and never adjudicated on. */
  confidence: number;
};

/** The level the phrase list alone would raise, with no model involved. */
export function keywordFloor(hits: string[]): RiskLevel {
  return hits.length > 0 ? "elevated" : "none";
}

const ORDER: RiskLevel[] = ["none", "low", "moderate", "elevated", "high", "critical"];

export function atLeast(a: RiskLevel, b: RiskLevel): RiskLevel {
  return ORDER.indexOf(a) >= ORDER.indexOf(b) ? a : b;
}

/**
 * 🔴 The ladder. Read it as a clinician would.
 *
 * Ideation alone is not the same as ideation with a plan, and ideation with a
 * plan and the means to carry it out this week is a different clinical event
 * again. That progression is the whole of suicide risk assessment as it is
 * actually taught, and it is written here as arithmetic rather than asked of a
 * model.
 *
 * Homicidal ideation and psychosis sit at the top on their own because both
 * carry a duty that does not depend on anything else being present.
 */
export function levelFor(findings: Finding[], keywordHits: string[] = []): RiskLevel {
  const has = (indicator: RiskIndicator) => findings.some((f) => f.indicator === indicator);

  const floor = keywordFloor(keywordHits);

  if (has("homicidal_ideation") || has("psychosis")) return atLeast("critical", floor);

  const ideation = has("ideation");
  const intent = has("intent");
  const plan = has("plan");
  const means = has("means");
  const timeframe = has("timeframe");

  if (ideation && plan && (means || timeframe)) return atLeast("critical", floor);
  if (ideation && (plan || intent)) return atLeast("high", floor);
  if (ideation && (means || timeframe)) return atLeast("high", floor);
  if (ideation) return atLeast("elevated", floor);

  /*
   * 🔴 A plan with no stated ideation is still a plan.
   *
   * The first version of this ladder required `ideation` before `plan`,
   * `intent` or `means` counted for anything, and the eval found the case that
   * breaks: *"I have written letters to my mum and my brother and put them in
   * the drawer. I have sorted everything out."* The classifier labelled it
   * `plan`, correctly and twice. The ladder returned **none**, because nobody
   * in that sentence says they want to die.
   *
   * Putting your affairs in order is one of the most recognised warning signs
   * there is, and it is precisely the shape that never says the words. It is
   * also the single case the phrase list cannot reach, which is the reason
   * sprint 35 exists. Requiring the words back would have thrown away the only
   * thing the classifier adds over the list it replaces.
   */
  if (plan || intent) return atLeast("elevated", floor);

  if (has("self_harm")) return atLeast("elevated", floor);
  if (has("abuse")) return atLeast("elevated", floor);
  /*
   * A previous attempt on its own is history, not an emergency. It is the
   * single strongest predictor there is, so it raises the floor to moderate
   * and appears on the clinician's screen; it does not page anybody at 3am for
   * something that happened in 2019.
   */
  if (has("previous_attempt")) return atLeast("moderate", floor);

  return floor;
}

/**
 * What the clinician is told to do, in words, derived from the same ladder.
 *
 * Not generated. A recommended action that varies with a model's phrasing is a
 * recommended action a clinician cannot learn to read at a glance.
 */
export function recommendedAction(level: RiskLevel, locale = "en"): string | null {
  const arabic = locale === "ar";

  switch (level) {
    case "critical":
      return arabic
        ? "تواصل مع المريض اليوم. راجع الاقتباسات المرفقة قبل الاتصال."
        : "Contact this patient today. Read the quoted lines before you call.";
    case "high":
      return arabic
        ? "راجع الجلسة اليوم وقرر إن كان التواصل المباشر مطلوبًا."
        : "Review this session today and decide whether to make contact.";
    case "elevated":
      return arabic
        ? "راجع الاقتباسات قبل الجلسة القادمة."
        : "Read the quoted lines before the next session.";
    case "moderate":
      return arabic
        ? "معلومة للسياق. لا حاجة لإجراء فوري."
        : "For context. No immediate action.";
    default:
      return null;
  }
}

/**
 * Is this worth waking somebody for?
 *
 * The alert pipeline (dedup, notification, the sweeper cron) is untouched by
 * sprint 35 — 35.3 — so this is only the gate on whether to enter it at all.
 */
export function shouldAlert(level: RiskLevel): boolean {
  return ORDER.indexOf(level) >= ORDER.indexOf("elevated");
}
