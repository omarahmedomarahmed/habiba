/**
 * What a session actually consumes, as a function of how long it is.
 *
 * ## 🔴 The mistake this module exists to stop
 *
 * The simulation runs short sessions to fit a $10 budget. The business runs
 * fifty-minute sessions. The obvious bridge between them is multiplication, and
 * multiplication is wrong by a factor of two.
 *
 * A session's model cost is **two terms**, not one:
 *
 * ```
 *   cost = FIXED + VARIABLE x minutes
 * ```
 *
 * The fixed term is everything that happens once regardless of length: the note
 * writer's system prompt (1,133 tokens, measured), the note it writes (a SOAP
 * note is the same shape after four minutes or fifty), the risk pass's prompt
 * and verdict, the profile rebuild. The variable term is transcription, which
 * is billed by the audio minute, plus the transcript flowing into the note and
 * risk prompts.
 *
 * At four minutes the fixed term is more than half the bill. At fifty minutes
 * it is under a tenth. **So the simulation runs in the regime least suited to
 * linear extrapolation**, and scaling its per-session cost by 12.5 overstates a
 * real session by roughly 105%.
 *
 * | | 4 min | 50 min |
 * |---|---|---|
 * | Two-term | $0.036 | **$0.220** |
 * | Linear x12.5 | $0.036 | **$0.450** |
 *
 * That is not a rounding argument. At a $1 platform fee plus 15%, it is the
 * difference between a business with a gross margin and one without.
 *
 * ## 🔴 It fits TOKENS, not dollars
 *
 * The regression is over `input_tokens`, `output_tokens` and `audio_seconds`,
 * never over `cost_microcents`. Two reasons and the second is the important
 * one:
 *
 *   1. Dollars carry the rate table's noise on top of the model's own. Tokens
 *      are the physical quantity and are what actually scales with a transcript.
 *   2. **A price change must not invalidate a measurement.** Separating the
 *      physics from the prices means the day OpenAI reprices a model, the whole
 *      forecast re-prices itself from the same measurement. A model that fuses
 *      them is obsolete the morning the rate table moves.
 *
 * ## What it refuses to do
 *
 * Fit a line through one cluster. Thirty-five sessions all four minutes long
 * give a slope that is pure noise and an intercept that is the mean, and both
 * look exactly as authoritative as a real fit. `fit()` returns
 * `{ fitted: false }` with the reason when the durations do not spread, and the
 * simulation's seed deliberately produces two clusters so that they do.
 */

/** One session's consumption, as the database records it. */
export type SessionSample = {
  sessionId: string;
  /** Audio minutes, from `sum(audio_seconds) / 60` over the transcribe calls. */
  minutes: number;
  inputTokens: number;
  outputTokens: number;
  audioSeconds: number;
  /** What the product actually charged itself, for the round-trip check. */
  microcents: number;
};

export type Line = {
  /** The value at zero minutes. The part that happens whatever the length. */
  fixed: number;
  /** The slope, per audio minute. */
  perMinute: number;
  /** How much of the variation the line explains. Below 0.5, say so out loud. */
  r2: number;
};

export type Fit =
  | { fitted: false; reason: string; samples: number }
  | {
      fitted: true;
      samples: number;
      /** Shortest and longest session in the sample, so a reader can see the lever. */
      minMinutes: number;
      maxMinutes: number;
      inputTokens: Line;
      outputTokens: Line;
      audioSeconds: Line;
    };

/**
 * Least squares, written out rather than pulled in.
 *
 * Four lines of arithmetic against a dependency is not a trade worth making,
 * and a reader checking a forecast should be able to see the regression rather
 * than trust a package name.
 */
function line(xs: number[], ys: number[]): Line {
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
}

/**
 * 🔴 The spread a fit needs before it means anything.
 *
 * Eight sessions, and a longest at least half again the shortest. Both numbers
 * are judgements rather than statistics, and they are deliberately loose: the
 * point is not to certify significance, it is to refuse the one case that
 * produces a confident wrong answer, which is a sample with no lever in it at
 * all.
 */
export const MIN_SAMPLES = 8;
export const MIN_SPREAD_RATIO = 1.5;

export function fit(samples: SessionSample[]): Fit {
  const usable = samples.filter((s) => s.minutes > 0);

  if (usable.length < MIN_SAMPLES) {
    return {
      fitted: false,
      reason: `only ${usable.length} sessions with audio, and a two-term fit needs at least ${MIN_SAMPLES}`,
      samples: usable.length,
    };
  }

  const minutes = usable.map((s) => s.minutes);
  const lo = Math.min(...minutes);
  const hi = Math.max(...minutes);

  if (lo <= 0 || hi / lo < MIN_SPREAD_RATIO) {
    return {
      /*
       * 🔴 THE REFUSAL THAT MATTERS. Every session the same length gives a
       * slope drawn through noise and an intercept equal to the mean, and the
       * result is indistinguishable from a real fit by looking at it. Saying
       * "cannot" is the only honest output.
       */
      fitted: false,
      reason: `sessions run ${lo.toFixed(1)} to ${hi.toFixed(1)} minutes, which is not enough spread to separate the fixed cost from the variable one. Run some longer sessions`,
      samples: usable.length,
    };
  }

  return {
    fitted: true,
    samples: usable.length,
    minMinutes: lo,
    maxMinutes: hi,
    inputTokens: line(minutes, usable.map((s) => s.inputTokens)),
    outputTokens: line(minutes, usable.map((s) => s.outputTokens)),
    audioSeconds: line(minutes, usable.map((s) => s.audioSeconds)),
  };
}

/** The rates in force, in cents, exactly as `lib/settings` holds them. */
export type Rates = {
  /** Cents per million input tokens, blended across the models in use. */
  inPerMTok: number;
  outPerMTok: number;
  /** Cents per audio minute. */
  perAudioMinute: number;
};

/**
 * What a session of `minutes` costs, in microcents, at these rates.
 *
 * Pure, and the only place physics meets price. Re-run it with tomorrow's rate
 * table and yesterday's measurement still holds.
 */
export function costAt(fit: Fit, minutes: number, rates: Rates): number | null {
  if (!fit.fitted) return null;

  const at = (l: Line) => Math.max(0, l.fixed + l.perMinute * minutes);

  const inCost = (at(fit.inputTokens) / 1_000_000) * rates.inPerMTok;
  const outCost = (at(fit.outputTokens) / 1_000_000) * rates.outPerMTok;
  const audioCost = (at(fit.audioSeconds) / 60) * rates.perAudioMinute;

  return Math.round((inCost + outCost + audioCost) * 1000);
}

/**
 * 🔴 What linear extrapolation would have said, so the difference is printed
 * rather than argued about.
 *
 * `from` is the duration that was actually measured. Scaling its cost by
 * `minutes / from` is the intuitive bridge and it is the one this module
 * exists to refuse.
 */
export function naiveCostAt(
  fit: Fit,
  minutes: number,
  from: number,
  rates: Rates,
): number | null {
  const base = costAt(fit, from, rates);
  return base === null ? null : Math.round(base * (minutes / from));
}

/* ========================================================================== *
 * 🔴 76.60 — THE BENCHMARK, AND WHY THE RUN'S OWN FIT HAS TO BE CHECKED
 *            AGAINST IT BY A MACHINE
 * ========================================================================== */

/**
 * `08-THE-NUMBERS.md` said, in prose: *"The run's own fit should reproduce the
 * two terms above. If `npm run physics` comes back materially different, that
 * is a finding and belongs in the report."*
 *
 * That instruction asked a person to open two files, compose one of them by
 * hand, and judge "materially". It is the single most important number the six
 * month run produces, and the only thing standing behind it was somebody
 * remembering to look. H20 is the rule that a check nobody runs is not a check,
 * and a check nobody has WRITTEN is the same thing earlier.
 *
 * ## 🔴 THE TWO FIGURES ARE NOT BUILT THE SAME WAY, WHICH IS WHY EYEBALLING FAILS
 *
 * The run's fit sums one line per `(kind, model)` over rows already grouped by
 * session, so **four copilot turns in a session are one aggregated sample** and
 * a profile rebuild is present exactly when it happened.
 *
 * The benchmark measured each prompt ONCE, in isolation, against the live API.
 * Turning that into a session costs multiplying the copilot by the turns a
 * session has and weighting the profile rebuild by how often it fires. Those
 * two constants are assumptions, they live in the benchmark file, and they are
 * the likeliest honest cause of a gap.
 *
 * So the comparison composes the benchmark the same way `benchmark-ai.ts` did,
 * at the rate table in force now rather than the one hard-coded when it ran,
 * and the caller reports the run's ACTUAL turns and rebuild share beside the
 * assumed ones. A gap that is explained by those two is a different finding
 * from a gap that is not.
 */
export type BenchmarkLine = { fixed: number; perMinute: number; r2?: number };

export type Benchmark = {
  measuredOn: string;
  durations: number[];
  copilotTurnsPerSession: number;
  profileShare: number;
  transcribePerMinuteUsd: number;
  fits: Record<string, { model: string; inputTokens: BenchmarkLine; outputTokens: BenchmarkLine }>;
  sessionUsd: { three: number; eight: number; fifty: number; naiveFiftyFromThree: number };
};

/**
 * The output tokens a profile rebuild writes, as `benchmark-ai.ts` composed it.
 *
 * 🔴 Named rather than inlined, because it is the one number in this
 * composition that is neither measured nor stored: it is a stand-in for a
 * rebuild's output length, and anybody auditing the benchmark should be able to
 * find it by searching for what it is.
 */
export const PROFILE_REBUILD_OUTPUT_TOKENS = 400;

/**
 * What the API benchmark says a session of `minutes` costs, in microcents,
 * composed exactly as `scripts/benchmark-ai.ts` composed it.
 *
 * `rateFor` supplies today's prices, so a reprice moves the benchmark and the
 * run's fit together and the comparison stays about physics.
 */
export function benchmarkCostAt(
  b: Benchmark,
  minutes: number,
  rateFor: (model: string) => Rates,
): number {
  const tokens = (model: string, inTok: number, outTok: number) => {
    const r = rateFor(model);
    return (inTok / 1_000_000) * r.inPerMTok + (outTok / 1_000_000) * r.outPerMTok;
  };

  /* Transcription is a published price per audio minute, never a fit. */
  let cents = b.transcribePerMinuteUsd * 100 * minutes;

  for (const [kind, f] of Object.entries(b.fits)) {
    const times = kind === "copilot" ? b.copilotTurnsPerSession : 1;
    const inTok = Math.max(0, f.inputTokens.fixed + f.inputTokens.perMinute * minutes);
    const outTok = Math.max(0, f.outputTokens.fixed + f.outputTokens.perMinute * minutes);
    cents += tokens(f.model, inTok, outTok) * times;
  }

  const note = b.fits.note;
  if (note) {
    cents +=
      tokens(note.model, note.inputTokens.fixed, PROFILE_REBUILD_OUTPUT_TOKENS) * b.profileShare;
  }

  return Math.round(cents * 1000);
}

/**
 * 🔴 HOW FAR APART THEY ARE ALLOWED TO BE, AND WHY IT IS THIS WIDE.
 *
 * The benchmark measured four prompts against synthetic transcripts of a fixed
 * words-per-minute. The run measures the same prompts inside the product,
 * against whatever twenty agents actually typed, in two languages, with real
 * copilot use and real profile rebuilds. Those are not the same experiment and
 * they should not be expected to agree to the cent.
 *
 * A quarter is wide enough that ordinary difference does not cry wolf, and
 * narrow enough that the failure this exists to catch cannot hide in it: the
 * run's fit built on three and eight minute sessions, extrapolated more than
 * six times beyond its own data, coming out at half or double a figure that was
 * MEASURED at fifty minutes.
 */
export const BENCHMARK_TOLERANCE = 0.25;

export type Agreement = {
  minutes: number;
  /** Microcents, from this run's own rows. */
  run: number;
  /** Microcents, from the API benchmark, composed at the same rates. */
  benchmark: number;
  /** Signed, as a fraction of the benchmark. Positive means the run cost more. */
  drift: number;
  agrees: boolean;
};

export function agreement(
  run: number,
  benchmark: number,
  minutes: number,
  tolerance: number = BENCHMARK_TOLERANCE,
): Agreement {
  /*
   * 🔴 A BENCHMARK OF ZERO DOES NOT AGREE WITH ANYTHING.
   *
   * Dividing by it would give Infinity or NaN, and NaN fails every comparison
   * including `>`, so a naive `drift > tolerance` would read a broken benchmark
   * file as agreement. That is the §6 family: passing by measuring nothing.
   */
  if (!Number.isFinite(benchmark) || benchmark <= 0) {
    return { minutes, run, benchmark, drift: Number.NaN, agrees: false };
  }
  const drift = (run - benchmark) / benchmark;
  return { minutes, run, benchmark, drift, agrees: Math.abs(drift) <= tolerance };
}
