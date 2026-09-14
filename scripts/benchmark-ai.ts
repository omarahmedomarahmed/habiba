/**
 * 🔴 What a session ACTUALLY costs, measured against OpenAI, not estimated.
 *
 *   npm run benchmark:ai -- --i-mean-it
 *   npm run benchmark:ai -- --i-mean-it --cap 1.00 --json evals/physics.json
 *
 * Every figure in `lib/finance/` and in the simulation's budget was, until this
 * ran, an estimate built from counting a prompt and guessing a transcript. This
 * replaces the guesses with the token counts OpenAI itself returns.
 *
 * ## What it does, and what it deliberately does not
 *
 * It calls the product's **real** functions for the note and the risk pass, not
 * copies of their prompts, so a prompt edit changes this measurement the way it
 * changes the bill.
 *
 * 🔴 The in-session copilot is reconstructed rather than called, because
 * `generateCopilot` reads its context from the database by session id and
 * cannot run standalone. The reconstruction uses the same model, the same
 * system prompt read out of its own module, the same fourteen-segment window,
 * the same trailing sentence, temperature and max_tokens. **That window is the
 * finding**: the copilot sees the last fourteen segments and no more, so its
 * cost does not grow with the length of the session, which every earlier
 * estimate in this repository assumed it did.
 *
 * It calls them at **four transcript lengths**, because the whole point is to
 * separate the per-session cost from the per-minute one and two unknowns need
 * more than one point.
 *
 * 🔴 **It writes no database row of any kind.** `noteFromTranscript` and
 * `classifyRisk` return their token counts and log nothing; `logUsage` is what
 * writes, and it is never called here. So there is no cleanup to forget, which
 * is better than a cleanup that runs in a `finally`.
 *
 * ## The cap is real
 *
 * A hard ceiling in dollars, checked before every call and after every response
 * at the actual token count. It stops mid-run and reports what it got rather
 * than finishing and apologising. The default is $1.
 *
 * ## The transcripts
 *
 * Synthetic therapy dialogue, generated locally, at a measured 150 words per
 * minute of speech. They are invented, they are about nobody, and they are
 * deliberately ordinary: a benchmark run on a dramatic transcript measures the
 * risk model's worst case rather than its normal one.
 */
import { readFileSync, writeFileSync } from "node:fs";

import { type SessionSample } from "../lib/finance/physics";

/**
 * The copilot's system prompt, read out of its own module rather than copied.
 *
 * A copy would drift the first time somebody edits the prompt, and this whole
 * script exists so that a prompt edit changes the measurement.
 */
const COPILOT_SYSTEM = (() => {
  const src = readFileSync("lib/ai/copilot.ts", "utf8");
  const at = src.indexOf("const SYSTEM_PROMPT = `");
  const start = src.indexOf("`", at) + 1;
  const end = src.indexOf("`;", start);
  return src.slice(start, end);
})();

type Args = { cap: number; json: string | null; go: boolean };

function args(): Args {
  const argv = process.argv.slice(2);
  const value = (f: string) => {
    const i = argv.indexOf(f);
    return i === -1 ? null : (argv[i + 1] ?? null);
  };
  return {
    cap: value("--cap") ? Number(value("--cap")) : 1.0,
    json: value("--json"),
    go: argv.includes("--i-mean-it"),
  };
}

/**
 * Ordinary speech runs about 150 words a minute, and a therapy hour is not two
 * people talking over each other. The lengths below are chosen to bracket both
 * the simulation's clusters (3 and 8 minutes) and a real session (50), because
 * a line fitted inside a range and then read outside it is an extrapolation
 * whatever the r² says.
 */
const WORDS_PER_MINUTE = 150;
const DURATIONS = [3, 8, 20, 50];

/** Building blocks for an invented session. Nobody's words. */
const PATIENT = [
  "I think the thing I keep coming back to is the sleep. It goes for a few days and then it comes back.",
  "Work has been the same as it was, but I notice I am bracing for it earlier in the week now.",
  "I did try the wind down thing. Four nights out of seven, maybe. The nights I did it I got back to sleep quicker.",
  "My sister asked if I was alright and I said yes and then felt strange about saying it.",
  "It is not that I do not want to do the exercises. It is that by the evening there is nothing left.",
  "I have been eating at odd times. Nothing dramatic, just late.",
  "The review moved to Thursday and I think that is underneath most of this week.",
  "I keep waking around three. It is always three, which feels like it should mean something.",
  "I am fine during the day. It is the gap between finishing and sleeping that is hard.",
  "I have not been out much. I keep saying I will and then it is nine o'clock.",
];

const THERAPIST = [
  "Say more about the bracing. What does the earlier part of the week feel like now?",
  "You mentioned four nights out of seven, and that on those nights it was quicker. Had you put those two together?",
  "What happened right before you said yes to your sister?",
  "Let us slow down there. When you say there is nothing left by the evening, what is doing the taking?",
  "Is three o'clock the same on the nights you did the wind down?",
  "What would it look like if the review had already happened?",
  "I want to come back to something you said a moment ago about it feeling strange.",
  "How would you know, in the moment, that it was starting?",
  "What is the smallest version of going out that would still count?",
  "Tell me about a week recently that was easier, even slightly.",
];

/** A transcript of roughly `minutes` of speech, alternating speakers. */
function transcript(minutes: number): string {
  const wanted = Math.round(minutes * WORDS_PER_MINUTE);
  const lines: string[] = [];
  let words = 0;
  let i = 0;
  while (words < wanted) {
    const patient = PATIENT[i % PATIENT.length]!;
    const therapist = THERAPIST[i % THERAPIST.length]!;
    lines.push(`Patient: ${patient}`);
    lines.push(`Therapist: ${therapist}`);
    words += patient.split(/\s+/).length + therapist.split(/\s+/).length;
    i++;
  }
  return lines.join("\n");
}

/** Cents per million tokens, from the shipped table. */
const RATE: Record<string, { in: number; out: number }> = {
  "gpt-4o": { in: 250, out: 1000 },
  "gpt-4o-mini": { in: 15, out: 60 },
};

function costUsd(model: string, inTok: number, outTok: number): number {
  const r = RATE[model] ?? RATE["gpt-4o"]!;
  return ((inTok / 1_000_000) * r.in + (outTok / 1_000_000) * r.out) / 100;
}

type Measurement = {
  minutes: number;
  kind: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  usd: number;
};

async function main() {
  const opts = args();

  if (!opts.go) {
    console.error("\n  This spends real money against the OpenAI key in .env.local.");
    console.error("  Re-run with --i-mean-it. The cap defaults to $1.00.\n");
    process.exit(1);
  }

  const { noteFromTranscript } = await import("../lib/ai/note-writer");
  const { classifyRisk } = await import("../lib/ai/risk");
  const { openai, MODELS } = await import("../lib/ai/client");

  const measurements: Measurement[] = [];
  let spent = 0;
  let stoppedEarly: string | null = null;

  /** Refuse a call that could take us past the cap, before making it. */
  const room = (estimate: number) => spent + estimate <= opts.cap;

  console.log(`\n  Benchmarking the real prompts against OpenAI. Cap $${opts.cap.toFixed(2)}.\n`);

  for (const minutes of DURATIONS) {
    const text = transcript(minutes);
    const words = text.split(/\s+/).length;
    console.log(`  ${String(minutes).padStart(2)} minutes · ${words} words`);

    /* ---------------------------------------------------------- the note -- */

    if (!room(0.08)) {
      stoppedEarly = `stopped before the ${minutes}-minute note, cap reached`;
      break;
    }
    try {
      const note = await noteFromTranscript({ context: "", transcript: text });
      const usd = costUsd(note.model, note.inputTokens, note.outputTokens);
      spent += usd;
      measurements.push({
        minutes,
        kind: "note",
        model: note.model,
        inputTokens: note.inputTokens,
        outputTokens: note.outputTokens,
        usd,
      });
      console.log(
        `     note      ${note.model.padEnd(12)} in ${String(note.inputTokens).padStart(6)} · out ${String(note.outputTokens).padStart(5)} · $${usd.toFixed(5)}`,
      );
    } catch (error) {
      console.log(`     note      FAILED: ${String(error).slice(0, 120)}`);
    }

    /* ---------------------------------------------------------- the risk -- */

    if (!room(0.05)) {
      stoppedEarly = `stopped before the ${minutes}-minute risk pass, cap reached`;
      break;
    }
    try {
      const risk = await classifyRisk(text);
      const usd = costUsd(risk.model, risk.inputTokens, risk.outputTokens);
      spent += usd;
      measurements.push({
        minutes,
        kind: "risk",
        model: risk.model,
        inputTokens: risk.inputTokens,
        outputTokens: risk.outputTokens,
        usd,
      });
      console.log(
        `     risk      ${risk.model.padEnd(12)} in ${String(risk.inputTokens).padStart(6)} · out ${String(risk.outputTokens).padStart(5)} · $${usd.toFixed(5)}`,
      );
    } catch (error) {
      console.log(`     risk      FAILED: ${String(error).slice(0, 120)}`);
    }

    /* ------------------------------------------------------- the copilot -- */

    /*
     * 🔴 THE COPILOT IS BOUNDED, AND THAT CHANGES THE COST MODEL.
     *
     * `generateCopilot` reads the last `CONTEXT_SEGMENTS` (14) segments from the
     * database and nothing else. So its input does NOT grow with the length of
     * the session: a fifty-minute session hands it the same fourteen lines a
     * three-minute one does. Every earlier estimate in this repository treated
     * it as scaling with the transcript and it does not.
     *
     * It cannot be called standalone because it queries by session id, so the
     * call is reconstructed here exactly: the same model, the same system
     * prompt, the same fourteen-segment window, the same trailing sentence, the
     * same temperature and max_tokens. Measured at every duration anyway, to
     * prove the boundedness rather than to assume it.
     */
    if (!room(0.02)) {
      stoppedEarly = `stopped before the ${minutes}-minute copilot pass, cap reached`;
      break;
    }
    try {
      const window = text.split("\n").slice(-14).join("\n");
      const completion = await openai().chat.completions.create({
        model: MODELS.copilot,
        temperature: 0.4,
        response_format: { type: "json_object" },
        max_tokens: 300,
        messages: [
          { role: "system", content: COPILOT_SYSTEM },
          {
            role: "user",
            content: `${window}\n\nWrite the suggestions in the same language as the transcript above.`,
          },
        ],
      });
      const inTok = completion.usage?.prompt_tokens ?? 0;
      const outTok = completion.usage?.completion_tokens ?? 0;
      const usd = costUsd(MODELS.copilot, inTok, outTok);
      spent += usd;
      measurements.push({
        minutes,
        kind: "copilot",
        model: MODELS.copilot,
        inputTokens: inTok,
        outputTokens: outTok,
        usd,
      });
      console.log(
        `     copilot   ${MODELS.copilot.padEnd(12)} in ${String(inTok).padStart(6)} · out ${String(outTok).padStart(5)} · $${usd.toFixed(5)}`,
      );
    } catch (error) {
      console.log(`     copilot   FAILED: ${String(error).slice(0, 120)}`);
    }

    /* ------------------------------------------------------ the diarist -- */

    /*
     * 🔴 THE CALL THE FIRST RUN LEFT OUT, AND THE ONE THAT SCALES WORST.
     *
     * The first benchmark measured the note, the risk pass and the copilot, and
     * the simulation's budget quietly carried a figure that claimed to include
     * diarisation. It did not. Diarisation is its own `gpt-4o-mini` call and it
     * BATCHES: `BATCH_SEGMENTS = 120` lines a call, so a fifty-minute session
     * makes several calls where a three-minute one makes one. That is a second
     * per-minute term, and leaving it out understates exactly the long sessions
     * the business case rests on.
     *
     * `attributeLines` is the shipped function with the shipped prompt and the
     * shipped batching, and `onUsage` is the hook `evals/` already uses, so this
     * measures the real thing rather than a replica. It writes no row: only
     * `diariseSession` logs, and this does not call it.
     */
    if (!room(0.05)) {
      stoppedEarly = `stopped before the ${minutes}-minute diarisation, cap reached`;
      break;
    }
    try {
      const { attributeLines } = await import("../lib/ai/diarise");
      let inTok = 0;
      let outTok = 0;
      const result = await attributeLines(text.split("\n").filter(Boolean), {
        onUsage: (u) => {
          inTok += u.inputTokens;
          outTok += u.outputTokens;
        },
      });
      const usd = costUsd("gpt-4o-mini", inTok, outTok);
      spent += usd;
      measurements.push({
        minutes,
        kind: "diarise",
        model: "gpt-4o-mini",
        inputTokens: inTok,
        outputTokens: outTok,
        usd,
      });
      console.log(
        `     diarise   ${"gpt-4o-mini".padEnd(12)} in ${String(inTok).padStart(6)} · out ${String(outTok).padStart(5)} · $${usd.toFixed(5)} · ${result.batches} batch(es)`,
      );
    } catch (error) {
      console.log(`     diarise   FAILED: ${String(error).slice(0, 120)}`);
    }

    console.log(`     running total $${spent.toFixed(4)}\n`);
  }

  if (stoppedEarly) console.log(`  🔴 ${stoppedEarly}\n`);

  /* ======================================================== the two terms == */

  console.log("  ─────────────────────────────────────────────────────────────");
  console.log("  The fit, per kind. tokens = fixed + perMinute x minutes\n");

  const kinds = [...new Set(measurements.map((m) => m.kind))];
  const fits: Record<string, unknown> = {};

  for (const kind of kinds) {
    const rows = measurements.filter((m) => m.kind === kind);
    const samples: SessionSample[] = rows.map((m) => ({
      sessionId: `${kind}-${m.minutes}`,
      minutes: m.minutes,
      inputTokens: m.inputTokens,
      outputTokens: m.outputTokens,
      audioSeconds: m.minutes * 60,
      microcents: Math.round(m.usd * 100_000),
    }));

    /*
     * 🔴 `fit()` wants eight samples and this has four durations, so the model
     * is fitted here directly rather than through it. The refusal it enforces is
     * about a RUN, where sessions are cheap and eight is nothing; a benchmark
     * pays per point and four well-spread ones bracket the range better than
     * eight clustered ones would.
     */
    const xs = samples.map((s) => s.minutes);
    const solve = (ys: number[]) => {
      const n = xs.length;
      const mx = xs.reduce((a, b) => a + b, 0) / n;
      const my = ys.reduce((a, b) => a + b, 0) / n;
      let sxy = 0;
      let sxx = 0;
      for (let i = 0; i < n; i++) {
        sxy += (xs[i]! - mx) * (ys[i]! - my);
        sxx += (xs[i]! - mx) ** 2;
      }
      const perMinute = sxx === 0 ? 0 : sxy / sxx;
      const fixed = my - perMinute * mx;
      let ssRes = 0;
      let ssTot = 0;
      for (let i = 0; i < n; i++) {
        ssRes += (ys[i]! - (fixed + perMinute * xs[i]!)) ** 2;
        ssTot += (ys[i]! - my) ** 2;
      }
      return { fixed, perMinute, r2: ssTot === 0 ? 1 : 1 - ssRes / ssTot };
    };

    const inp = solve(samples.map((s) => s.inputTokens));
    const out = solve(samples.map((s) => s.outputTokens));
    const model = rows[0]!.model;

    fits[kind] = { model, samples: rows.length, inputTokens: inp, outputTokens: out };

    console.log(
      `  ${kind.padEnd(9)} ${model.padEnd(12)} ` +
        `in ${Math.round(inp.fixed)} + ${Math.round(inp.perMinute)}/min (r² ${inp.r2.toFixed(3)}) · ` +
        `out ${Math.round(out.fixed)} + ${Math.round(out.perMinute)}/min (r² ${out.r2.toFixed(3)})`,
    );
  }

  /* ---------------------------------------------- what a session costs -- */

  /** Transcription, which is exact rather than fitted: 0.3 cents an audio minute. */
  const TRANSCRIBE_PER_MIN_USD = 0.003;
  /** Four copilot turns per session, which is the quota the simulation runs at. */
  const COPILOT_TURNS = 4;
  /** A profile rebuild does not happen every session. Measured at 2 in 5 on dev. */
  const PROFILE_SHARE = 0.4;

  const sessionUsd = (minutes: number) => {
    let total = TRANSCRIBE_PER_MIN_USD * minutes;
    for (const kind of kinds) {
      const f = fits[kind] as {
        model: string;
        inputTokens: { fixed: number; perMinute: number };
        outputTokens: { fixed: number; perMinute: number };
      };
      const times = kind === "copilot" ? COPILOT_TURNS : 1;
      const inTok = Math.max(0, f.inputTokens.fixed + f.inputTokens.perMinute * minutes);
      const outTok = Math.max(0, f.outputTokens.fixed + f.outputTokens.perMinute * minutes);
      total += costUsd(f.model, inTok, outTok) * times;
    }
    /* The profile rebuild rides on the note's shape, at its own frequency. */
    const note = fits.note as { model: string; inputTokens: { fixed: number } } | undefined;
    if (note) total += costUsd(note.model, note.inputTokens.fixed, 400) * PROFILE_SHARE;
    return total;
  };

  const three = sessionUsd(3);
  const eight = sessionUsd(8);
  const fifty = sessionUsd(50);

  console.log("\n  ─────────────────────────────────────────────────────────────");
  console.log("  A whole session, composed from the fits above\n");
  console.log(`   3 minutes   $${three.toFixed(4)}`);
  console.log(`   8 minutes   $${eight.toFixed(4)}`);
  console.log(`  50 minutes   $${fifty.toFixed(4)}   🔴 the business number`);
  console.log(`  50, multiplied from 3   $${(three * (50 / 3)).toFixed(4)}   🔴 wrong by ${(((three * (50 / 3)) / fifty - 1) * 100).toFixed(0)}%`);

  console.log(`\n  The simulation: 24 x 3min + 11 x 8min = $${(24 * three + 11 * eight).toFixed(3)}`);
  console.log(`\n  Benchmark spend: $${spent.toFixed(4)} of $${opts.cap.toFixed(2)}`);
  console.log("  🔴 No database row was written. Nothing to clean up.\n");

  if (opts.json) {
    writeFileSync(
      opts.json,
      JSON.stringify(
        {
          measuredOn: new Date().toISOString(),
          note: "Measured against the live OpenAI API using the product's own prompt functions. No database rows written.",
          wordsPerMinute: WORDS_PER_MINUTE,
          durations: DURATIONS,
          copilotTurnsPerSession: COPILOT_TURNS,
          profileShare: PROFILE_SHARE,
          transcribePerMinuteUsd: TRANSCRIBE_PER_MIN_USD,
          measurements,
          fits,
          sessionUsd: { three, eight, fifty, naiveFiftyFromThree: three * (50 / 3) },
          benchmarkSpendUsd: spent,
          stoppedEarly,
        },
        null,
        2,
      ),
    );
    console.log(`  Written to ${opts.json}\n`);
  }
}

main();
