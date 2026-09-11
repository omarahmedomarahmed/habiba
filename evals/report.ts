import { readFileSync, writeFileSync } from "node:fs";

import { pct } from "./metrics";

/**
 * What a run produces, and what makes a run fail. PLAN.md 32.1, 32.2.
 *
 * ## 🔴 A number nobody compares is a number nobody reads
 *
 * The first version of this printed a table and exited zero. That is a
 * dashboard, and a dashboard is what you have instead of a gate: everybody
 * looks at it for two sprints and then nobody does. So every measurement is
 * compared against a **committed** figure in `baseline.json` and a run FAILS
 * when a number has moved the wrong way by more than its tolerance.
 *
 * It is the same shape as the region-pin ratchet (C157) for the same reason:
 * debt and quality both drift quietly, and the only mechanism that has ever
 * worked in this repository is a checked-in number that has to be edited on
 * purpose.
 *
 * ## The tolerance is not a fudge factor, it is the sampling error
 *
 * These numbers come from a model at temperature 0 to 0.2, which is *nearly*
 * deterministic and not actually deterministic, over a handful of cases. Two
 * identical runs differ. A tolerance of zero would make the gate red on noise,
 * which is the fastest way to teach everybody to ignore it — the exact failure
 * C90 wrote the skip mechanism for. So each metric carries the band its own
 * suite thinks is noise, stated in the baseline where it can be argued with,
 * and **a move outside the band fails**.
 *
 * A tolerance that has to keep growing is itself the finding.
 */

export type Direction = "up" | "down";

export type Measurement = {
  /** Stable key. This is what the baseline is keyed on, so it may not drift. */
  key: string;
  label: string;
  value: number;
  /** "up" when higher is better. Sensitivity is up; error rate is down. */
  direction: Direction;
  /** How the value is printed: a rate becomes a percentage. */
  unit: "rate" | "count" | "seconds";
  /** How far it may move the wrong way before the gate goes red. */
  tolerance: number;
  /** Anything a reader needs beside the number. Misses go here, by name. */
  detail?: string;
};

/**
 * 🔴 The shape of the case set a baseline was measured on. 35R.
 *
 * Without this, widening the case set silently invalidates every number in the
 * file: a run over fifteen sessions compares itself against a figure taken
 * over five, and the diff is reported as a regression or an improvement when
 * it is neither. A metric is only comparable to itself over the same cases,
 * and that is a fact about the baseline rather than something a reader is
 * expected to remember.
 */
export type CaseShape = Record<string, number>;

export type Baseline = {
  comment: string;
  recordedOn: string;
  cases?: CaseShape;
  metrics: Record<
    string,
    {
      value: number;
      direction: Direction;
      tolerance: number;
      /**
       * 🔴 How far this metric moved between takes of unchanged code, when the
       * baseline was recorded.
       *
       * Recorded because a metric whose spread exceeds its tolerance cannot
       * tell a regression from its own noise, and a single-take run against a
       * three-take mean will fail it sooner or later for nothing. Storing the
       * number lets the runner say **which** of those two a red line is,
       * without ever turning it green. See `compare`.
       */
      spread?: number;
    }
  >;
};

const BASELINE_PATH = new URL("./baseline.json", import.meta.url).pathname;

export function readBaseline(): Baseline | null {
  try {
    return JSON.parse(readFileSync(BASELINE_PATH, "utf8")) as Baseline;
  } catch {
    return null;
  }
}

export function writeBaseline(
  measurements: Measurement[],
  comment: string,
  spreads: Map<string, number> = new Map(),
  cases: CaseShape = {},
): void {
  const metrics: Baseline["metrics"] = {};
  for (const m of [...measurements].sort((a, b) => a.key.localeCompare(b.key))) {
    metrics[m.key] = {
      value: m.value,
      direction: m.direction,
      tolerance: m.tolerance,
      ...(spreads.has(m.key) ? { spread: Number(spreads.get(m.key)!.toFixed(3)) } : {}),
    };
  }

  const baseline: Baseline = {
    comment,
    recordedOn: new Date().toISOString().slice(0, 10),
    cases,
    metrics,
  };
  writeFileSync(BASELINE_PATH, `${JSON.stringify(baseline, null, 2)}\n`);
}

export function format(m: Pick<Measurement, "value" | "unit">): string {
  if (m.unit === "rate") return pct(m.value);
  if (m.unit === "seconds") return `${m.value.toFixed(1)}s`;
  return String(m.value);
}

export type Verdict = {
  measurement: Measurement;
  status: "new" | "same" | "better" | "WORSE";
  was: number | null;
  moved: number;
  /**
   * 🔴 The move is worse than the tolerance AND smaller than this metric's own
   * recorded noise, so the two cannot be told apart from this run.
   *
   * The run still FAILS. A red line that might be noise is not a green line:
   * the only honest thing to change is the sentence beside it, which asks for
   * `--repeat 3` rather than pretending the number means something it does not.
   * Widening the band to make this pass is the thing C160 forbids.
   */
  indeterminate: boolean;
};

/**
 * 🔴 Has the case set changed since the baseline was taken?
 *
 * Returns the differences. A non-empty answer means **no metric in this run is
 * comparable to the file**, and the honest response is to say so and refuse,
 * not to print a diff of two different measurements.
 */
export function caseSetChanged(baseline: Baseline | null, now: CaseShape): string[] {
  const was = baseline?.cases;
  if (!was || Object.keys(was).length === 0) return [];

  return Object.keys(now)
    .filter((key) => was[key] !== undefined && was[key] !== now[key])
    .map((key) => `${key} ${was[key]} -> ${now[key]}`);
}

/** Did it move the wrong way by more than its own tolerance? */
export function compare(measurements: Measurement[], baseline: Baseline | null): Verdict[] {
  return measurements.map((measurement) => {
    const previous = baseline?.metrics[measurement.key];
    if (!previous) {
      return { measurement, status: "new" as const, was: null, moved: 0, indeterminate: false };
    }

    const moved = measurement.value - previous.value;
    const worse = measurement.direction === "up" ? -moved : moved;

    const status =
      worse > measurement.tolerance ? "WORSE" : worse > 0 ? "same" : moved === 0 ? "same" : "better";

    const noise = previous.spread ?? 0;
    const indeterminate = status === "WORSE" && noise > measurement.tolerance && worse <= noise;

    return { measurement, status, was: previous.value, moved, indeterminate };
  });
}

export function printTable(verdicts: Verdict[]): void {
  const width = Math.max(...verdicts.map((v) => v.measurement.label.length), 10);

  for (const verdict of verdicts) {
    const { measurement: m } = verdict;
    const value = format(m).padStart(7);
    const was =
      verdict.was === null
        ? "   (new)"
        : `was ${format({ value: verdict.was, unit: m.unit })}`.padStart(12);
    const flag =
      verdict.status === "WORSE" ? (verdict.indeterminate ? " 🔴 WORSE?" : " 🔴 WORSE") : "";
    console.log(`  ${m.label.padEnd(width)}  ${value}  ${was}${flag}`);
    if (m.detail) console.log(`  ${" ".repeat(width)}  ${m.detail}`);
  }
}
