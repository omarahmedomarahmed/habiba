/**
 * The scorers. PLAN.md 32.1.
 *
 * ## 🔴 Why these are pure, and unit-tested before anything uses them
 *
 * Every number this sprint produces is this file's opinion. A word-error rate
 * computed by a broken edit distance is not a weaker measurement, it is a
 * confident wrong one, and it would be quoted in a sprint report exactly like
 * the "47 pinned" figure C157 had to retract. So the scorers take plain data,
 * return plain numbers, touch no model and no database, and `tests/evals.test.ts`
 * asserts each of them against hand-computed cases.
 *
 * ## What is deliberately not here
 *
 * There is no model-as-judge. A second model scoring the first one produces a
 * number with no error bar and no way to audit a disagreement, and the moment
 * it is in a sprint report it is treated as a measurement. Everything scored
 * here is decidable by string comparison against a fixture somebody wrote on
 * purpose, which is a narrower claim and a true one. Where that cannot reach —
 * whether a note *reads* like a clinician wrote it — this file reports
 * nothing rather than a number.
 */

/* ------------------------------------------------------------ normalising -- */

/** Arabic diacritics and the tatweel, which carry no lexical content. */
const ARABIC_MARKS = /[ؐ-ًؚ-ٰٟۖ-ۭـ]/g;

/**
 * One string, reduced to the words a reader would say.
 *
 * Case, punctuation and diacritics are removed because a transcription that
 * differs from the reference only in a comma is not an error a clinician would
 * notice, and counting it as one makes every WER in this repository
 * incomparable with every published one.
 *
 * Arabic-specific: alef forms are folded (`أ إ آ` → `ا`) and final `ة` → `ه`,
 * `ى` → `ي`. Those are orthographic variants that transcription systems and
 * human typists disagree about constantly and that change no meaning.
 */
export function normaliseWords(text: string): string[] {
  return text
    .toLowerCase()
    .replace(ARABIC_MARKS, "")
    .replace(/[أإآ]/g, "ا")
    .replace(/ة/g, "ه")
    .replace(/ى/g, "ي")
    /* An apostrophe is removed rather than spaced: "it's" is one word, and
       splitting it invents an error in every contraction a patient says. */
    .replace(/['’‘`]/g, "")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .filter(Boolean);
}

/* -------------------------------------------------------- transcription -- */

export type WerResult = {
  /** Substitutions + deletions + insertions, over reference length. */
  wer: number;
  substitutions: number;
  deletions: number;
  insertions: number;
  referenceWords: number;
};

/**
 * Word error rate, by edit distance with a traceback.
 *
 * The traceback is what makes the three error kinds separable, and they are
 * separable because they mean different things clinically: a **deletion** is a
 * sentence the record lost, an **insertion** is a sentence the record gained,
 * and the second is worse. A single percentage hides which one a change made
 * more common.
 */
export function wordErrorRate(reference: string, hypothesis: string): WerResult {
  const ref = normaliseWords(reference);
  const hyp = normaliseWords(hypothesis);

  /* distance[i][j] = edits turning ref[0..i) into hyp[0..j). */
  const distance: number[][] = Array.from({ length: ref.length + 1 }, (_, i) =>
    Array.from({ length: hyp.length + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0)),
  );

  for (let i = 1; i <= ref.length; i += 1) {
    for (let j = 1; j <= hyp.length; j += 1) {
      const substitute = distance[i - 1]![j - 1]! + (ref[i - 1] === hyp[j - 1] ? 0 : 1);
      const deletion = distance[i - 1]![j]! + 1;
      const insertion = distance[i]![j - 1]! + 1;
      distance[i]![j] = Math.min(substitute, deletion, insertion);
    }
  }

  let substitutions = 0;
  let deletions = 0;
  let insertions = 0;
  let i = ref.length;
  let j = hyp.length;

  while (i > 0 || j > 0) {
    const here = distance[i]![j]!;
    if (i > 0 && j > 0 && here === distance[i - 1]![j - 1]! + (ref[i - 1] === hyp[j - 1] ? 0 : 1)) {
      if (ref[i - 1] !== hyp[j - 1]) substitutions += 1;
      i -= 1;
      j -= 1;
    } else if (i > 0 && here === distance[i - 1]![j]! + 1) {
      deletions += 1;
      i -= 1;
    } else {
      insertions += 1;
      j -= 1;
    }
  }

  return {
    wer: ref.length === 0 ? 0 : (substitutions + deletions + insertions) / ref.length,
    substitutions,
    deletions,
    insertions,
    referenceWords: ref.length,
  };
}

/* ---------------------------------------------------------- attribution -- */

export type Speaker = "therapist" | "patient" | "unknown";

export type DerResult = {
  /** Wrong labels over lines the system was willing to label. */
  der: number;
  correct: number;
  wrong: number;
  /** Lines the system declined to label. Not counted as errors. See below. */
  refused: number;
  /** Lines the gold set itself marks as genuinely ambiguous. */
  ambiguous: number;
  lines: number;
};

/**
 * 🔴 Diarisation error, with refusals counted separately and on purpose.
 *
 * A line the system labels `unknown` is not the same failure as a line it
 * labels *wrong*. The wrong one is written into a clinical record as if it were
 * certain — a disclosure attributed to the clinician, an intervention
 * attributed to the patient — and the product's whole position on this
 * (`diarise.ts`, the rule above the schema) is that a half-correct label is
 * worse than none.
 *
 * So `der` is the rate over lines it **chose** to answer, and `refused` is
 * reported beside it. A change that cuts errors by refusing everything is
 * visible here as a low DER and a high refusal count, which is exactly the
 * trade a reader has to see to judge it.
 *
 * Lines the fixture marks `unknown` as gold — genuine straddles — are excluded
 * from the denominator entirely: refusing them is correct, and labelling them
 * either way is neither right nor wrong, it is the thing the prompt forbids.
 */
export function diarisationError(gold: Speaker[], predicted: Speaker[]): DerResult {
  let correct = 0;
  let wrong = 0;
  let refused = 0;
  let ambiguous = 0;

  for (let i = 0; i < gold.length; i += 1) {
    const truth = gold[i]!;
    const guess = predicted[i] ?? "unknown";

    if (truth === "unknown") {
      ambiguous += 1;
      /* Labelling a known straddle IS an error: the prompt forbids it. */
      if (guess !== "unknown") wrong += 1;
      continue;
    }
    if (guess === "unknown") {
      refused += 1;
      continue;
    }
    if (guess === truth) correct += 1;
    else wrong += 1;
  }

  const answered = correct + wrong;
  return {
    der: answered === 0 ? 0 : wrong / answered,
    correct,
    wrong,
    refused,
    ambiguous,
    lines: gold.length,
  };
}

/* --------------------------------------------------------------- content -- */

/** Every string in a note, flattened, for scanning. */
export function noteText(note: unknown): string {
  if (typeof note === "string") return note;
  if (Array.isArray(note)) return note.map(noteText).join("\n");
  if (note && typeof note === "object") return Object.values(note).map(noteText).join("\n");
  return "";
}

export type ClaimResult = {
  /** Planted facts the note asserted although the transcript never said them. */
  unsupported: string[];
  /** Facts the transcript did state that a competent note should carry. */
  missing: string[];
  unsupportedRate: number;
  coverage: number;
};

/**
 * 🔴 Unsupported claims, measured against planted traps rather than judged.
 *
 * Each case carries two lists written by hand: `neverSaid` — a medication, a
 * diagnosis, a number, a relationship that appears **nowhere** in the
 * transcript — and `stated` — facts the transcript does contain. A note
 * containing a `neverSaid` term invented it. There is no interpretation in
 * that, no judge, and no disagreement to adjudicate.
 *
 * It is a **lower bound** and the report must say so: it catches the
 * fabrications somebody thought to plant, not every fabrication. A narrow true
 * number beats a broad one nobody can check.
 */
export function claimScore(
  text: string,
  trap: { neverSaid: string[]; stated: string[] },
): ClaimResult {
  const haystack = normaliseWords(text).join(" ");
  const has = (needle: string) => haystack.includes(normaliseWords(needle).join(" "));

  /*
   * 🔴 A stated fact may be written several ways, and the note is allowed to
   * pick one.
   *
   * `"أمي|الأم|والدتها"` is one fact with three renderings: the prompt tells
   * the model to write in clinical register and never to use a name, so a note
   * that says "the patient's mother" where the transcript said "my mum" has
   * kept the fact and changed the words. Scoring that as a loss would measure
   * the fixture's phrasing rather than the note's content.
   *
   * The cost is real and stated: a looser match can hide a genuine drop. It is
   * only applied to `stated`. A planted `neverSaid` term stays exact, because
   * the claim it supports — "the note invented this" — has to be literal.
   */
  const hasFact = (fact: string) => fact.split("|").some(has);

  const unsupported = trap.neverSaid.filter(has);
  const missing = trap.stated.filter((fact) => !hasFact(fact));

  return {
    unsupported,
    missing,
    unsupportedRate: trap.neverSaid.length === 0 ? 0 : unsupported.length / trap.neverSaid.length,
    coverage:
      trap.stated.length === 0 ? 1 : (trap.stated.length - missing.length) / trap.stated.length,
  };
}

/**
 * Required sections that actually have content.
 *
 * `sectionCoverage` reads the note's own shape, so an empty string and a
 * missing key score the same: both leave the clinician with a blank box.
 */
export function sectionCoverage(
  note: Record<string, unknown>,
  required: string[],
): { covered: string[]; empty: string[]; coverage: number } {
  const covered: string[] = [];
  const empty: string[] = [];

  for (const path of required) {
    const value = path.split(".").reduce<unknown>((node, key) => {
      if (node && typeof node === "object") return (node as Record<string, unknown>)[key];
      return undefined;
    }, note);

    const filled = Array.isArray(value)
      ? value.length > 0
      : typeof value === "string"
        ? value.trim().length > 0
        : false;
    (filled ? covered : empty).push(path);
  }

  return { covered, empty, coverage: required.length === 0 ? 1 : covered.length / required.length };
}

/* ------------------------------------------------------------------ risk -- */

export type RiskResult = {
  /** True positives over cases that really are risk. Misses are the harm. */
  sensitivity: number;
  /** True negatives over cases that are not. */
  specificity: number;
  missed: string[];
  falseAlarms: string[];
  positives: number;
  negatives: number;
};

/**
 * 🔴 Both numbers, always, and the misses by name.
 *
 * Sensitivity alone is trivially gamed by alerting on everything, and
 * specificity alone by alerting on nothing. Reporting one without the other is
 * how a safety number becomes a marketing one.
 *
 * The misses are listed rather than counted because a miss is a sentence a
 * person actually said, and a maintainer has to be able to read it.
 */
export function riskScore(
  cases: { id: string; risk: boolean }[],
  flagged: (id: string) => boolean,
): RiskResult {
  const positives = cases.filter((c) => c.risk);
  const negatives = cases.filter((c) => !c.risk);

  const missed = positives.filter((c) => !flagged(c.id)).map((c) => c.id);
  const falseAlarms = negatives.filter((c) => flagged(c.id)).map((c) => c.id);

  return {
    sensitivity: positives.length === 0 ? 1 : (positives.length - missed.length) / positives.length,
    specificity:
      negatives.length === 0 ? 1 : (negatives.length - falseAlarms.length) / negatives.length,
    missed,
    falseAlarms,
    positives: positives.length,
    negatives: negatives.length,
  };
}

/* ---------------------------------------------------------------- output -- */

/** A percentage a human reads, from a rate a machine computed. */
export function pct(rate: number): string {
  return `${(rate * 100).toFixed(1)}%`;
}
