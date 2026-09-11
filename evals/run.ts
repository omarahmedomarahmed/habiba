/**
 * The eval runner. PLAN.md 32.1, 32.2.
 *
 *   npm run evals                      # every suite, compared to the baseline
 *   npm run evals -- --suite risk      # one suite
 *   npm run evals -- --offline         # only the suites that need no model
 *   npm run evals -- --repeat 3        # average three takes, and print the spread
 *   npm run evals -- --record          # rewrite the baseline (3 takes), on purpose
 *
 * ## 🔴 What this is for
 *
 * Before this sprint there were 21 tests, 31 verifiers and **no measurement of
 * whether the AI was any good**. Every sprint from 33 onward changes model
 * behaviour — a clinical evidence layer, a risk model, a copilot that reads a
 * chart — and without this, each of them would be shipped on the strength of
 * somebody reading the output and finding it reasonable. Reading the output is
 * how you catch the obvious failures and precisely none of the others.
 *
 * ## Why a run costs money, and why that is the right trade
 *
 * Three of the four suites call the real models, with the real prompts, at the
 * real parameters. A mock would make this free and would measure a mock. The
 * risk suite calls nothing at all — the crisis scanner is a phrase list — so
 * the one eval that must never be skipped for cost never is.
 */
import { compare, printTable, readBaseline, writeBaseline, type Measurement } from "./report";
import { unmeasured } from "./coverage";
import { attribution } from "./suites/attribution";
import { notes } from "./suites/notes";
import { risk } from "./suites/risk";
import { speech } from "./suites/speech";

type Suite = {
  name: string;
  needsModel: boolean;
  run: () => Measurement[] | Promise<Measurement[]>;
};

const SUITES: Suite[] = [risk, attribution, notes, speech];


/**
 * One measurement per key, averaged across takes.
 *
 * 🔴 The details are **unioned**, not taken from the last take. A note that
 * invented a medication in one run of three is a fabrication that happened,
 * and printing the last run's "no planted term appeared in any note" beside an
 * average of 1.9% would hide the one thing a reader needs: which term, in
 * which case. An average is where a zero hides (C159), and the same is true in
 * reverse.
 */
function mean(takes: Measurement[][]): Measurement[] {
  const first = takes[0] ?? [];
  return first.map((measurement, index) => {
    const values = takes.map((take) => take[index]?.value ?? measurement.value);
    if (values.length > 1) {
      SPREADS.set(measurement.key, Math.max(...values) - Math.min(...values));
    }

    const details = [
      ...new Set(takes.map((take) => take[index]?.detail).filter(Boolean) as string[]),
    ];

    return {
      ...(takes[takes.length - 1]?.[index] ?? measurement),
      value: values.reduce((a, b) => a + b, 0) / values.length,
      detail: details.length > 1 ? details.map((d, i) => `run ${i + 1}: ${d}`).join(" | ") : details[0],
    };
  });
}

/** How far each metric moved between takes of unchanged code. */
const SPREADS = new Map<string, number>();

async function main() {
  const args = process.argv.slice(2);
  const record = args.includes("--record");
  const offline = args.includes("--offline");
  const only = args.includes("--suite") ? args[args.indexOf("--suite") + 1] : null;

  const hasKey = Boolean(process.env.OPENAI_API_KEY);

  const chosen = SUITES.filter((suite) => {
    if (only && suite.name !== only) return false;
    if ((offline || !hasKey) && suite.needsModel) return false;
    return true;
  });

  if (only && chosen.length === 0 && SUITES.some((s) => s.name === only)) {
    console.error(`\nRefusing to run: the ${only} suite needs a model and OPENAI_API_KEY is unset.`);
    process.exit(1);
  }
  if (chosen.length === 0) {
    console.error(`\nNo suite matched. Suites: ${SUITES.map((s) => s.name).join(", ")}`);
    process.exit(1);
  }

  const skipped = SUITES.filter((suite) => !chosen.includes(suite));

  console.log("\n24Therapy evals");
  console.log(`  suites: ${chosen.map((s) => s.name).join(", ")}`);
  if (skipped.length > 0) {
    console.log(
      `  not run: ${skipped.map((s) => s.name).join(", ")}${hasKey ? "" : " (no OPENAI_API_KEY)"}`,
    );
  }

  /*
   * 🔴 Repeats, because the eval has its own noise and it is measurable.
   *
   * A model at temperature 0.2 over three cases is not deterministic: two runs
   * of unchanged code moved `notes.coverage` by 13 points, which is two facts
   * out of fifteen. A baseline recorded from one run therefore pins the gate to
   * whichever run happened to be lucky, and every honest run afterwards looks
   * like a regression.
   *
   * So a recording run averages several, and the **spread** is printed beside
   * the mean. Where the spread is wider than the metric's own tolerance, the
   * run says so at the bottom: that metric cannot currently see a small real
   * regression, and the fix is more cases rather than a wider band.
   */
  const repeats = args.includes("--repeat")
    ? Math.max(1, Number(args[args.indexOf("--repeat") + 1]))
    : record
      ? 3
      : 1;

  const runs: Measurement[][] = [];
  for (const suite of chosen) {
    console.log(`\n${suite.name}`);
    const started = Date.now();

    const takes: Measurement[][] = [];
    for (let take = 0; take < (suite.needsModel ? repeats : 1); take += 1) {
      takes.push(await suite.run());
    }

    const averaged = mean(takes);
    runs.push(averaged);
    printTable(compare(averaged, readBaseline()));
    if (takes.length > 1) {
      console.log(`  (${takes.length} runs, ${((Date.now() - started) / 1000).toFixed(1)}s)`);
    } else {
      console.log(`  (${((Date.now() - started) / 1000).toFixed(1)}s)`);
    }
  }

  const measurements = runs.flat();

  /*
   * 🔴 The unmeasured surfaces are printed on every run.
   *
   * A quality report that lists only what it measured reads as a clean bill of
   * health. The point of naming these here, under the numbers, is that nobody
   * can quote the table without also seeing what is not in it.
   */
  const open = unmeasured();
  console.log(`\nnot measured: ${open.length} model surfaces`);
  for (const surface of open) console.log(`  --  ${surface.file}: ${surface.reason}`);

  const noisy = measurements.filter(
    (m) => (SPREADS.get(m.key) ?? 0) > m.tolerance + 1e-9,
  );
  if (noisy.length > 0) {
    console.log(`\n🔴 ${noisy.length} metric(s) are noisier than their own tolerance:`);
    for (const m of noisy) {
      console.log(
        `  ${m.key}: spread ${(SPREADS.get(m.key) ?? 0).toFixed(3)} over ${repeats} runs, tolerance ${m.tolerance}. It cannot see a small regression. Widen the case set, not the band.`,
      );
    }
  }

  if (record) {
    /*
     * Recording a baseline from a partial run would silently drop every metric
     * the run did not produce, and the ratchet would then never notice them
     * again — a gate that deletes itself.
     */
    if (only || offline || skipped.length > 0) {
      console.error("\nRefusing to record a baseline from a partial run. Run every suite.");
      process.exit(1);
    }
    writeBaseline(
      measurements,
      "Measured by `npm run evals -- --record`. A metric may only move the wrong way by its own tolerance; past that the run fails. Re-record on purpose, with a reason in PLAN.md.",
    );
    console.log("\nbaseline recorded");
    process.exit(0);
  }

  const verdicts = compare(measurements, readBaseline());
  const worse = verdicts.filter((verdict) => verdict.status === "WORSE");
  const fresh = verdicts.filter((verdict) => verdict.status === "new");

  if (fresh.length > 0) {
    console.log(`\n${fresh.length} metric(s) have no baseline yet`);
  }

  if (worse.length > 0) {
    console.log(`\nevals: ${worse.length} REGRESSED`);
    for (const verdict of worse) {
      console.log(
        `  ${verdict.measurement.key}: moved ${verdict.moved > 0 ? "+" : ""}${verdict.moved.toFixed(3)}, tolerance ${verdict.measurement.tolerance}`,
      );
    }
    process.exit(1);
  }

  console.log(`\nevals: PASS (${measurements.length} metrics, ${open.length} surfaces unmeasured)`);
  process.exit(0);
}

void main();
