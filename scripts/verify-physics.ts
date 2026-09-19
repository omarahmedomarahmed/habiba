/**
 * 🔴 76.60 — THE COST EXTRAPOLATION, AND THE CONTROL IT HAD NO CHECK AGAINST.
 *
 *     npm run verify:physics
 *
 * ## The hole this fills, which was found by somebody asking a question
 *
 * The six month run produces one headline number: **what a fifty minute
 * session costs.** It cannot measure it directly, because the run's own
 * sessions are three and eight minutes long and a fifty minute one would spend
 * most of a ten dollar budget. So it FITS `cost = FIXED + VARIABLE x minutes`
 * over its own rows and evaluates the line at fifty.
 *
 * That is a reach of more than six times beyond the data, and the only thing
 * standing behind it was a sentence in `08-THE-NUMBERS.md` telling a person to
 * compare the result against `evals/physics.json` by eye and decide whether the
 * difference was "material".
 *
 * 🔴 **A comparison a human is asked to make by eye is a comparison nobody
 * makes.** That is H20 one step earlier than usual: not a check that fails and
 * gets explained away, but a check that was only ever prose.
 *
 * ## 🔴 WHY EYEBALLING WOULD HAVE BEEN WRONG EVEN IF SOMEBODY DID IT
 *
 * The two numbers are not built the same way and neither file says so.
 *
 * The run's fit groups `ai_request_logs` by session, so **four copilot turns in
 * one session are a single aggregated sample** and a profile rebuild counts
 * exactly when it fired. The benchmark measured each prompt ONCE against the
 * live API, so composing a session out of it means multiplying the copilot by
 * an assumed turn count and weighting the rebuild by an assumed share.
 *
 * Reading `sessionUsd.fifty` out of the benchmark file and holding it next to
 * `npm run physics -- --at 50` compares a composed figure with an aggregated
 * one and calls the difference physics. `benchmarkCostAt` composes it properly,
 * at today's rate table rather than the one hard-coded the day it ran.
 *
 * ## What this gate can and cannot do
 *
 * It runs on dev, where there is no six month run to fit, so it **cannot**
 * check that this run agrees with the benchmark. That happens inside
 * `npm run physics`, which now exits non-zero when they diverge.
 *
 * What it checks is that the instrument works before the run needs it:
 *
 *   - the benchmark file recomposes to its own stored answer, so a corrupted or
 *     hand-edited fit is caught rather than trusted;
 *   - the stored transcription price still matches the shipped rate table;
 *   - the benchmark actually contains a long session, because a control that
 *     only measured short ones controls nothing;
 *   - the divergence detector flags a planted offender and passes a plausible
 *     one, in both directions;
 *   - a zero or missing benchmark reads as DISAGREEMENT rather than as
 *     agreement, which is the arithmetic trap that would make this pass by
 *     measuring nothing;
 *   - and `fit()` still refuses a single duration cluster.
 *
 * It only reads, and it reads a JSON file and the settings table.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

import {
  BENCHMARK_TOLERANCE,
  agreement,
  benchmarkCostAt,
  fit,
  type Benchmark,
  type Rates,
  type SessionSample,
} from "../lib/finance/physics";
import { reporter } from "./_verify";
import { connect } from "./db";

const { check, finish } = reporter();

const BENCHMARK_PATH = "evals/physics.json";

/** The model the product transcribes with, and whose price the benchmark quotes. */
const TRANSCRIBE_MODEL = "gpt-4o-mini-transcribe";

async function main() {
  /*
   * 🔴 `readFileSync` AND NOT `readSource`. C205 strips comments before a scan
   * of SOURCE, because a constant named in a comment must never be read as the
   * constant. This is a data file with no comments in it, and parsing it as
   * JSON is the whole point: stripping anything first would corrupt it.
   */
  const raw = readFileSync(join(process.cwd(), BENCHMARK_PATH), "utf8");
  const b = JSON.parse(raw) as Benchmark;

  const { pool, db } = connect();

  try {
    const { getSettings } = await import("../lib/settings");
    const settings = await getSettings();
    const rateFor = (model: string): Rates => ({
      inPerMTok: settings.aiRates.tokens.find((t) => t.model === model)?.inPerMTok ?? 0,
      outPerMTok: settings.aiRates.tokens.find((t) => t.model === model)?.outPerMTok ?? 0,
      perAudioMinute: settings.aiRates.audio.find((a) => a.model === model)?.perAudioMinute ?? 0,
    });

    /* ------------------------------------------- the file answers for itself -- */

    /*
     * 🔴 THE RECOMPOSITION IS THE CONTROL ON THE COMPOSER.
     *
     * `benchmarkCostAt` is a second implementation of arithmetic that
     * `scripts/benchmark-ai.ts` already did once, against the live API, and
     * wrote down. If the two agree to a hundredth of a cent then the composer
     * is faithful and the stored fits have not been edited since. If they do
     * not, one of those two things is false and the run must not lean on
     * either.
     */
    const recomposed = benchmarkCostAt(b, 50, rateFor);
    const stored = Math.round(b.sessionUsd.fifty * 100 * 1000);
    const gap = Math.abs(recomposed - stored);

    check(
      "🔴 the benchmark file recomposes to its own stored fifty minute answer",
      gap <= 1000,
      `composed $${(recomposed / 100_000).toFixed(5)} against stored $${(stored / 100_000).toFixed(5)}, ` +
        `${gap <= 1000 ? "the same to a hundredth of a cent" : `APART BY ${String(gap)} microcents`}`,
    );

    check(
      "🔴 CONTROL …and the composer is not returning the stored number by reading it",
      benchmarkCostAt(b, 3, rateFor) < recomposed && benchmarkCostAt(b, 3, rateFor) > 0,
      `three minutes composes to $${(benchmarkCostAt(b, 3, rateFor) / 100_000).toFixed(5)}, ` +
        "which is smaller than fifty and not zero, so the minutes argument reaches the arithmetic",
    );

    /*
     * 🔴 THE PRICE IN THE BENCHMARK AND THE PRICE IN THE PRODUCT.
     *
     * `transcribePerMinuteUsd` was hard-coded into `benchmark-ai.ts` and stored
     * beside the fits. The product charges itself from `settings.aiRates`.
     * Nothing connected the two, so a reprice would have moved what the product
     * bills and left the benchmark quoting last year's price, and the
     * comparison would then report a drift that was a stale constant.
     */
    const shippedPerMinuteUsd = rateFor(TRANSCRIBE_MODEL).perAudioMinute / 100;
    check(
      "🔴 the benchmark's transcription price is still the shipped one",
      Math.abs(shippedPerMinuteUsd - b.transcribePerMinuteUsd) < 1e-9,
      `benchmark $${b.transcribePerMinuteUsd.toFixed(4)}/min against settings ` +
        `$${shippedPerMinuteUsd.toFixed(4)}/min for ${TRANSCRIBE_MODEL}`,
    );

    /*
     * 🔴 A CONTROL THAT ONLY SAW SHORT SESSIONS CONTROLS NOTHING.
     *
     * The entire reason the benchmark can check the run is that it MEASURED a
     * fifty minute session while the run can only extrapolate to one. A
     * benchmark re-recorded on short durations alone would still produce a
     * `sessionUsd.fifty`, by the same extrapolation the run does, and the
     * comparison would then be a fit checked against itself.
     */
    const longest = Math.max(...b.durations);
    check(
      "🔴 the benchmark MEASURED a session at least as long as the one it certifies",
      longest >= 50,
      `durations ${b.durations.join(", ")} minutes, longest ${String(longest)}. ` +
        (longest >= 50
          ? "So the fifty minute figure is measured rather than extrapolated"
          : "🔴 NOTHING HERE WAS MEASURED AT FIFTY. The control is a fit checked against a fit"),
    );

    /* ------------------------------------------------- the detector itself -- */

    /*
     * 🔴 PLANTED OFFENDERS, BOTH WAYS. A detector that always says "agrees" and
     * one that always says "diverges" are equally useless and only one of them
     * is visible in a green run. So both cases are constructed.
     */
    const base = 100_000;
    const plausible = agreement(Math.round(base * 1.08), base, 50);
    const offender = agreement(Math.round(base * 1.4), base, 50);
    const under = agreement(Math.round(base * 0.55), base, 50);

    check(
      "🔴 a run 8% away from the benchmark is reported as agreement",
      plausible.agrees && Math.abs(plausible.drift - 0.08) < 0.001,
      `drift ${(plausible.drift * 100).toFixed(1)}% against a tolerance of ${(BENCHMARK_TOLERANCE * 100).toFixed(0)}%`,
    );

    check(
      "🔴 CONTROL …and a run 40% ABOVE the benchmark is not",
      !offender.agrees,
      `drift +${(offender.drift * 100).toFixed(0)}%, flagged`,
    );

    check(
      "🔴 CONTROL …and 45% BELOW is not either, because cheap is a finding too",
      !under.agrees,
      `drift ${(under.drift * 100).toFixed(0)}%, flagged. An extrapolation that comes out far ` +
        "under a measured figure is the same defect pointing the other way",
    );

    /*
     * 🔴 THE ARITHMETIC TRAP, PLANTED. `(run - 0) / 0` is Infinity, and with a
     * missing benchmark it is NaN. NaN fails every comparison it appears in,
     * including `>`, so a detector written as `drift > tolerance` would read a
     * broken benchmark file as perfect agreement and this gate would be green
     * about a comparison that never happened.
     */
    const broken = agreement(base, 0, 50);
    check(
      "🔴 CONTROL …and a benchmark of zero reads as DISAGREEMENT, never as agreement",
      !broken.agrees,
      "a missing or zero benchmark divides to NaN, and NaN fails every comparison including the " +
        "one that would have called it agreement",
    );

    /* ------------------------------------------ the refusal the run depends on */

    /*
     * 🔴 The whole extrapolation rests on `fit()` refusing one duration
     * cluster, and `01-THE-CAST.md` splits the run into two lengths for exactly
     * that reason. If that refusal ever stopped working, a run whose sessions
     * all came out the same length would produce a confident slope drawn
     * through noise and nothing would say so.
     */
    const flat: SessionSample[] = Array.from({ length: 12 }, (_, i) => ({
      sessionId: `flat-${String(i)}`,
      minutes: 3,
      inputTokens: 1600 + i,
      outputTokens: 600,
      audioSeconds: 180,
      microcents: 1000,
    }));
    const spread: SessionSample[] = flat.map((s, i) => ({
      ...s,
      minutes: i % 2 === 0 ? 3 : 8,
      audioSeconds: i % 2 === 0 ? 180 : 480,
    }));

    check(
      "🔴 a fit through one duration cluster is still refused",
      fit(flat).fitted === false,
      fit(flat).fitted === false
        ? `refused: ${(fit(flat) as { reason: string }).reason}`
        : "🔴 FITTED TWELVE IDENTICAL SESSIONS. The slope is noise and nothing says so",
    );

    check(
      "🔴 CONTROL …and the same twelve sessions at two lengths DO fit",
      fit(spread).fitted === true,
      fit(spread).fitted === true
        ? "two clusters, three and eight minutes, fitted. So the refusal is about spread rather " +
            "than about refusing everything"
        : "refused a sample that has the spread the run produces",
    );
  } finally {
    await pool.end();
  }

  finish("sprint 76 physics");
}

main();
