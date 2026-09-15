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
import { writeFileSync } from "node:fs";

import { sql } from "drizzle-orm";

import { costAt, fit, naiveCostAt, type Rates, type SessionSample } from "../lib/finance/physics";
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
            perKind: report,
          },
          null,
          2,
        ),
      );
      console.log(`  Written to ${opts.json}\n`);
    }
  } finally {
    await pool.end();
  }
}

main();
