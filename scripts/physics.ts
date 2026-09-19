/**
 * Fit the two-term session cost model to what actually happened.
 *
 *   npm run physics
 *   npm run physics -- --at 50        what a fifty-minute session would cost
 *   npm run physics -- --json docs/simulation-run/PHYSICS.json
 *
 * This is the bridge between the simulation and the financial model. The
 * simulation runs short sessions because the budget is $10; the business runs
 * fifty-minute ones. `lib/finance/physics.ts` explains at length why
 * multiplying one to get the other is wrong by roughly a factor of two, and
 * this is the script that does it properly, from rows.
 *
 * ## 🔴 It fits per KIND, and that is not tidiness
 *
 * Transcription is billed per audio minute and is purely variable. A note's
 * system prompt is 1,133 tokens whatever happened, and the note it writes is
 * about the same length after four minutes or fifty. Risk scales with the
 * transcript; the profile rebuild does not. Those five shapes averaged into one
 * line give a number that is right for no session at all.
 *
 * They are also priced an order of magnitude apart: gpt-4o costs $2.50 per
 * million input tokens and gpt-4o-mini $0.15. Fitting dollars across both,
 * rather than tokens within each, hides the cheap half.
 *
 * ## What it refuses
 *
 * A fit through sessions that are all the same length. `01-THE-CAST.md` deliberately
 * splits the run into two duration clusters so this can answer; if it says it
 * cannot, the run did not produce them and the extrapolation must not be made.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { sql } from "drizzle-orm";

import {
  BENCHMARK_TOLERANCE,
  agreement,
  benchmarkCostAt,
  costAt,
  fit,
  naiveCostAt,
  type Benchmark,
  type Rates,
  type SessionSample,
} from "../lib/finance/physics";
import { connect } from "./db";

type Args = { at: number; json: string | null };

function args(): Args {
  const argv = process.argv.slice(2);
  const value = (flag: string) => {
    const i = argv.indexOf(flag);
    return i === -1 ? null : (argv[i + 1] ?? null);
  };
  return { at: value("--at") ? Number(value("--at")) : 50, json: value("--json") };
}

const usd = (microcents: number) => `$${(microcents / 100_000).toFixed(4)}`;

async function main() {
  const opts = args();
  const { pool, db } = connect();

  try {
    /*
     * 🔴 The x axis is the AUDIO, not the calendar.
     *
     * `sessions.ended_at - started_at` is how long the room was open, which
     * includes the two minutes before anybody spoke and the time somebody spent
     * finding their headphones. What the models were paid for is the audio that
     * reached them, and `audio_seconds` on the transcription rows is that
     * exactly.
     */
    const rows = await db.execute<{
      session_id: string;
      kind: string;
      model: string;
      minutes: string;
      input_tokens: string;
      output_tokens: string;
      audio_seconds: string;
      microcents: string;
    }>(sql`
      WITH duration AS (
        SELECT session_id, SUM(audio_seconds) / 60.0 AS minutes
          FROM ai_request_logs
         WHERE session_id IS NOT NULL AND kind = 'transcribe'
         GROUP BY session_id
      )
      SELECT l.session_id::text                AS session_id,
             l.kind                            AS kind,
             l.model                           AS model,
             d.minutes::text                   AS minutes,
             SUM(l.input_tokens)::text         AS input_tokens,
             SUM(l.output_tokens)::text        AS output_tokens,
             SUM(l.audio_seconds)::text        AS audio_seconds,
             SUM(l.cost_microcents)::text      AS microcents
        FROM ai_request_logs l
        JOIN duration d ON d.session_id = l.session_id
       WHERE l.status = 'success'
       GROUP BY l.session_id, l.kind, l.model, d.minutes
       ORDER BY 1, 2`);

    if (rows.rows.length === 0) {
      console.log("\n  No session has any AI calls against it yet. Nothing to fit.\n");
      return;
    }

    /* Group into one sample list per (kind, model). */
    const byKind = new Map<string, SessionSample[]>();
    for (const r of rows.rows) {
      const key = `${r.kind}|${r.model}`;
      const list = byKind.get(key) ?? [];
      list.push({
        sessionId: r.session_id,
        minutes: Number(r.minutes),
        inputTokens: Number(r.input_tokens),
        outputTokens: Number(r.output_tokens),
        audioSeconds: Number(r.audio_seconds),
        microcents: Number(r.microcents),
      });
      byKind.set(key, list);
    }

    /* The rates in force, from settings, so a reprice is a settings edit. */
    const { getSettings } = await import("../lib/settings");
    const settings = await getSettings();
    const rateFor = (model: string): Rates => ({
      inPerMTok: settings.aiRates.tokens.find((t) => t.model === model)?.inPerMTok ?? 0,
      outPerMTok: settings.aiRates.tokens.find((t) => t.model === model)?.outPerMTok ?? 0,
      perAudioMinute: settings.aiRates.audio.find((a) => a.model === model)?.perAudioMinute ?? 0,
    });

    const durations = [...new Set(rows.rows.map((r) => Number(Number(r.minutes).toFixed(1))))].sort(
      (a, b) => a - b,
    );

    console.log(`\nSession physics, from ${byKind.size} kind-and-model combinations\n`);
    console.log(`  Session lengths seen: ${durations.map((d) => `${d}m`).join(", ")}\n`);

    let totalAt = 0;
    let totalAtShort = 0;
    let anyRefused = false;
    const shortest = Math.min(...rows.rows.map((r) => Number(r.minutes)));
    const report: Record<string, unknown> = {};

    for (const [key, samples] of [...byKind.entries()].sort()) {
      const [kind, model] = key.split("|") as [string, string];
      const f = fit(samples);
      const rates = rateFor(model);

      if (!f.fitted) {
        anyRefused = true;
        console.log(`  ${kind.padEnd(16)} ${model.padEnd(24)} 🔴 cannot fit: ${f.reason}`);
        report[key] = { fitted: false, reason: f.reason, samples: f.samples };
        continue;
      }

      const at = costAt(f, opts.at, rates)!;
      const short = costAt(f, shortest, rates)!;
      totalAt += at;
      totalAtShort += short;

      console.log(
        `  ${kind.padEnd(16)} ${model.padEnd(24)} ` +
          `in ${Math.round(f.inputTokens.fixed)} + ${Math.round(f.inputTokens.perMinute)}/min · ` +
          `out ${Math.round(f.outputTokens.fixed)} + ${Math.round(f.outputTokens.perMinute)}/min · ` +
          `r² ${f.inputTokens.r2.toFixed(2)} · ${f.samples} sessions`,
      );

      report[key] = {
        fitted: true,
        samples: f.samples,
        minMinutes: f.minMinutes,
        maxMinutes: f.maxMinutes,
        inputTokens: f.inputTokens,
        outputTokens: f.outputTokens,
        audioSeconds: f.audioSeconds,
        rates,
        costAtMicrocents: at,
      };
    }

    if (anyRefused) {
      console.log(
        "\n  🔴 At least one kind could not be fitted, so the extrapolation below is incomplete.",
      );
      console.log(
        "     The run needs sessions of at least two different lengths. `01-THE-CAST.md` asks for",
      );
      console.log("     24 at three minutes and 11 at eight, which is exactly why.\n");
    }

    /* ------------------------------------------------------ the two numbers */

    const naive = Math.round(totalAtShort * (opts.at / shortest));

    console.log("\n  ─────────────────────────────────────────────────────────────");
    console.log(`  A ${shortest.toFixed(1)}-minute session, measured   ${usd(totalAtShort)}`);
    console.log(`  A ${opts.at}-minute session, two-term fit   ${usd(totalAt)}`);
    console.log(`  A ${opts.at}-minute session, multiplied     ${usd(naive)}   🔴 wrong`);

    if (totalAt > 0) {
      const ratio = naive / totalAt;
      console.log(
        `\n  Multiplying overstates by ${((ratio - 1) * 100).toFixed(0)}%. ` +
          `That is the fixed cost being counted ${(opts.at / shortest).toFixed(1)} times`,
      );
      console.log("  instead of once: a system prompt, a note and a risk verdict happen per");
      console.log("  SESSION, not per minute.\n");
    }

    /* ------------------------------------ and the control it is checked against */

    /*
     * 🔴 76.60 — THE RUN'S FIT, AGAINST A FIGURE THAT WAS MEASURED.
     *
     * Everything above is an extrapolation. The run's sessions are three and
     * eight minutes and this evaluates the line at fifty, which is more than a
     * six-fold reach beyond the data. `evals/physics.json` holds four durations
     * measured against the live OpenAI API, INCLUDING fifty, so there is a real
     * number to check the reach against.
     *
     * Until now the check was a sentence in `08-THE-NUMBERS.md` asking a person
     * to do it by eye. It is arithmetic and it belongs here.
     */
    const bench = loadBenchmark();
    let verdict: ReturnType<typeof agreement> | null = null;

    if (!bench) {
      console.log(`  🔴 ${BENCHMARK_PATH} is missing or unreadable, so this fit is unchecked.`);
      console.log("     The extrapolation above stands on nothing but itself.\n");
    } else if (totalAt === 0) {
      /*
       * 🔴 AN EMPTY FIT IS NOT A DISAGREEMENT, AND THE FIRST VERSION OF THIS
       * SAID IT WAS.
       *
       * Run against a database with five short sessions on it, every kind
       * refused, `totalAt` stayed at zero, and the comparison below reported
       * *"-100%, outside 25%"* and then offered three confident explanations
       * about copilot turns and transcript density. All of them were wrong: the
       * cause was that nothing had been fitted at all, which the lines above
       * had already said.
       *
       * That is the §6 family with a diagnosis attached, which is worse than a
       * bare wrong answer because somebody would have gone looking for the
       * cause it named. A comparison whose left-hand side does not exist has to
       * say so and stop.
       */
      console.log("  ─────────────────────────────────────────────────────────────");
      console.log(
        `  The API benchmark, composed at the same rates  ${usd(benchmarkCostAt(bench, opts.at, rateFor))}`,
      );
      console.log("  This run's own fit                             🔴 none, see above\n");
      console.log("  🔴 NOTHING TO COMPARE. Not one kind fitted, so the benchmark cannot");
      console.log("     confirm or contradict anything. Do not read the missing comparison as");
      console.log("     agreement, and do not quote a fifty minute figure from this run.\n");
      process.exitCode = 1;
    } else {
      const composed = benchmarkCostAt(bench, opts.at, rateFor);
      verdict = agreement(totalAt, composed, opts.at);

      console.log("  ─────────────────────────────────────────────────────────────");
      console.log(`  The API benchmark, composed at the same rates  ${usd(composed)}`);
      console.log(
        `  This run's own fit                             ${usd(totalAt)}   ` +
          `${verdict.drift >= 0 ? "+" : ""}${(verdict.drift * 100).toFixed(0)}%`,
      );

      /*
       * 🔴 A PARTIAL FIT IS STILL COMPARED, AND IS SAID TO BE PARTIAL.
       *
       * The first version suppressed the whole comparison the moment any one
       * kind refused, and a planted run showed how wrong that is: `profile`
       * fires on about two sessions in five, so it reaches `MIN_SAMPLES` last,
       * and one rare kind worth 3% of the bill was hiding a comparison of the
       * other 97% that came out 0.7% apart.
       *
       * Suppressing is not the safe choice it looks like. It throws away a good
       * measurement to avoid a caveat, and the run then has no check at all.
       * The right move is to compare and to label: the run's side is missing
       * whatever refused, so its figure is a FLOOR, and a reader has to know
       * which way the incompleteness pushes.
       */
      if (anyRefused) {
        console.log(
          "\n  ⚠️  The run's figure is INCOMPLETE: the kinds listed above as unfitted are\n" +
            "     missing from it, so it is a floor rather than a total, and the drift\n" +
            "     understates. A negative drift here may be the gap rather than the physics.",
        );
      }

      /*
       * 🔴 THE TWO ASSUMPTIONS MOST LIKELY TO EXPLAIN A GAP, MEASURED.
       *
       * The benchmark measured each prompt once and composed a session by
       * multiplying the copilot by an assumed turn count and weighting the
       * profile rebuild by an assumed share. The run's rows carry the real
       * ones. A gap explained by these is a different finding from a gap that
       * is not, and printing them here is what makes the difference legible
       * rather than arguable.
       */
      const real = await perSessionCounts(db);
      console.log(
        `\n  copilot turns per session   benchmark assumed ${String(bench.copilotTurnsPerSession)} · ` +
          `this run ${real.copilotTurns.toFixed(1)}`,
      );
      console.log(
        `  profile rebuilds per session  benchmark assumed ${bench.profileShare.toFixed(2)} · ` +
          `this run ${real.profileShare.toFixed(2)}`,
      );

      if (verdict.agrees) {
        console.log(
          `\n  ✅ Within ${(BENCHMARK_TOLERANCE * 100).toFixed(0)}%. The extrapolation is doing what a ` +
            "session measured at\n     fifty minutes says it should.\n",
        );
      } else {
        console.log(
          `\n  🔴 OUTSIDE ${(BENCHMARK_TOLERANCE * 100).toFixed(0)}%. THIS IS A FINDING TO RECORD, NOT A BUILD TO FIX.`,
        );
        console.log("     Put BOTH numbers in the report with the two counts above beside them.");
        console.log("     The likeliest honest causes, in order: the run used the copilot more or");
        console.log("     less than four times a session; the profile rebuilt at a different rate;");
        console.log("     real transcripts are denser than the benchmark's synthetic ones. The");
        console.log("     likeliest dishonest one is that three and eight minutes cannot reach");
        console.log("     fifty, in which case the benchmark is the number to quote.\n");
      }
    }

    if (opts.json) {
      writeFileSync(
        opts.json,
        JSON.stringify(
          {
            measuredOn: new Date().toISOString(),
            durationsSeen: durations,
            shortestMinutes: shortest,
            extrapolatedTo: opts.at,
            twoTermMicrocents: totalAt,
            naiveMicrocents: naive,
            benchmark: verdict
              ? {
                  microcents: verdict.benchmark,
                  drift: verdict.drift,
                  agrees: verdict.agrees,
                  tolerance: BENCHMARK_TOLERANCE,
                }
              : null,
            perKind: report,
          },
          null,
          2,
        ),
      );
      console.log(`  Written to ${opts.json}\n`);
    }

    /*
     * 🔴 A DISAGREEMENT EXITS NON-ZERO, and the message above says it is a
     * finding rather than a fault. The run's operator needs it to stop and be
     * written down; making it a warning on stdout would put it in a scrollback
     * nobody reads, which is how this check came to be prose in the first
     * place.
     */
    if (verdict && !verdict.agrees) process.exitCode = 1;
    if (!bench) process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

main();

const BENCHMARK_PATH = "evals/physics.json";

/**
 * The API benchmark, or null when it cannot be read.
 *
 * 🔴 Null rather than a throw. A missing benchmark must not stop the fit from
 * printing: the fit is the run's own measurement and is worth having even
 * unchecked. What it must do is say so and exit non-zero, which the caller
 * does, so "unchecked" never passes for "checked".
 */
function loadBenchmark(): Benchmark | null {
  try {
    return JSON.parse(readFileSync(join(process.cwd(), BENCHMARK_PATH), "utf8")) as Benchmark;
  } catch {
    return null;
  }
}

/**
 * What the run actually did per session, for the two assumptions the benchmark
 * had to guess at.
 *
 * 🔴 Per SESSION THAT HAS AI CALLS, not per session in the table. A session
 * nobody recorded has no copilot turns and no rebuild, and including it would
 * divide real usage by a denominator containing sessions that could not have
 * contributed, which reads as the copilot being used less than it was.
 */
async function perSessionCounts(
  db: ReturnType<typeof connect>["db"],
): Promise<{ copilotTurns: number; profileShare: number }> {
  const rows = await db.execute<{ sessions: string; copilot: string; profile: string }>(sql`
    WITH scoped AS (
      SELECT DISTINCT session_id FROM ai_request_logs WHERE session_id IS NOT NULL
    )
    SELECT (SELECT COUNT(*) FROM scoped)::text AS sessions,
           (SELECT COUNT(*) FROM ai_request_logs
             WHERE session_id IS NOT NULL AND kind = 'copilot')::text AS copilot,
           (SELECT COUNT(*) FROM ai_request_logs
             WHERE session_id IS NOT NULL AND kind = 'profile')::text AS profile`);

  const r = rows.rows[0];
  const sessions = Number(r?.sessions ?? 0);
  if (sessions === 0) return { copilotTurns: 0, profileShare: 0 };
  return {
    copilotTurns: Number(r?.copilot ?? 0) / sessions,
    profileShare: Number(r?.profile ?? 0) / sessions,
  };
}
