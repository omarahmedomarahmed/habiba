import assert from "node:assert/strict";
import { test } from "node:test";

import { costAt, fit, naiveCostAt, type SessionSample } from "../lib/finance/physics";

/**
 * The two-term session cost model.
 *
 * 🔴 Every test here is against data whose answer is known by construction,
 * because a regression is exactly the kind of code that returns a plausible
 * number for every input and can therefore be wrong forever without anybody
 * noticing.
 */

/** Sessions built from a line we choose, so the fit has a right answer. */
function synthetic(
  durations: number[],
  opts: { fixedIn: number; inPerMin: number; fixedOut: number; outPerMin: number },
): SessionSample[] {
  return durations.map((minutes, i) => ({
    sessionId: `s${i}`,
    minutes,
    inputTokens: opts.fixedIn + opts.inPerMin * minutes,
    outputTokens: opts.fixedOut + opts.outPerMin * minutes,
    audioSeconds: minutes * 60,
    microcents: 0,
  }));
}

const SHAPE = { fixedIn: 1550, inPerMin: 200, fixedOut: 800, outPerMin: 0 };

/** The shipped rates, in cents, from `lib/settings/defs.ts`. */
const RATES = { inPerMTok: 250, outPerMTok: 1000, perAudioMinute: 0.3 };

test("it recovers the line it was built from", () => {
  const f = fit(synthetic([3, 3, 3, 3, 3, 8, 8, 8, 8, 8], SHAPE));
  assert.equal(f.fitted, true);
  if (!f.fitted) return;

  assert.ok(Math.abs(f.inputTokens.fixed - 1550) < 1, `fixed was ${f.inputTokens.fixed}`);
  assert.ok(Math.abs(f.inputTokens.perMinute - 200) < 1, `slope was ${f.inputTokens.perMinute}`);
  assert.ok(Math.abs(f.outputTokens.fixed - 800) < 1);
  assert.ok(Math.abs(f.outputTokens.perMinute) < 1, "a note is the same length whatever the session");
  assert.ok(f.inputTokens.r2 > 0.99);
});

test("🔴 it REFUSES to fit one cluster, which is the whole point", () => {
  /* Thirty-five sessions, all four minutes. A slope through this is noise. */
  const f = fit(synthetic(Array.from({ length: 35 }, () => 4), SHAPE));
  assert.equal(f.fitted, false);
  if (f.fitted) return;
  assert.match(f.reason, /spread/i);
});

test("🔴 CONTROL …and it accepts the spread the simulation actually produces", () => {
  /* 42 at three minutes, 20 at eight: the six months `01-THE-CAST.md` asks for. */
  const durations = [
    ...Array.from({ length: 42 }, () => 3),
    ...Array.from({ length: 20 }, () => 8),
  ];
  const f = fit(synthetic(durations, SHAPE));
  assert.equal(f.fitted, true, "a refusal that refuses everything proves nothing");
});

test("it refuses too few sessions even when they do spread", () => {
  const f = fit(synthetic([3, 8, 3], SHAPE));
  assert.equal(f.fitted, false);
  if (f.fitted) return;
  assert.match(f.reason, /at least/i);
});

test("🔴 linear extrapolation from four minutes overstates fifty by about double", () => {
  const f = fit(synthetic([3, 3, 3, 3, 3, 8, 8, 8, 8, 8], SHAPE));

  const true50 = costAt(f, 50, RATES)!;
  const naive50 = naiveCostAt(f, 50, 4, RATES)!;

  /*
   * The claim that the whole two-term model exists to support, asserted rather
   * than argued: scaling a four-minute session to fifty roughly doubles it.
   * If a rate change ever makes this false, this test is where it is noticed.
   */
  const ratio = naive50 / true50;
  assert.ok(ratio > 1.7 && ratio < 2.4, `naive/true was ${ratio.toFixed(2)}, expected about 2`);

  /* And the true figure is in the range the budget was written against. */
  assert.ok(true50 > 15_000 && true50 < 30_000, `50 minutes costed ${true50} microcents`);
});

test("the note call alone costs what its own tokens and rate say", () => {
  /*
   * 🔴 SHAPE is ONE CALL, not a session. This assertion was first written as
   * "a four-minute session costs what the budget says" and failed at 2,588
   * microcents against a floor of 3,000, which was the test being right and the
   * label being wrong: a session is six or seven calls across two models, and
   * `SHAPE` is the note writer's share of it.
   *
   * Checked by hand: 1550 + 200x4 = 2,350 input tokens at $2.50/MTok is 0.5875
   * cents, 800 output at $10/MTok is 0.8 cents, four audio minutes at 0.3 cents
   * is 1.2 cents. 2.5875 cents, which is 2,587.5 microcents.
   */
  const f = fit(synthetic([3, 3, 3, 3, 3, 8, 8, 8, 8, 8], SHAPE));
  const four = costAt(f, 4, RATES)!;
  assert.ok(
    Math.abs(four - 2_588) < 5,
    `four minutes of this one call costed ${four} microcents, expected 2,588`,
  );
});

test("🔴 the WHOLE session, composed from every kind, lands where the budget says", () => {
  /*
   * The figure `00-START-HERE.md` and `03-THE-MONEY.md` are both written against,
   * built from the parts rather than asserted: the note writer's measured
   * 1,133-token system prompt, the risk pass, a profile rebuild on four
   * sessions in ten, the diariser, and four capped copilot turns.
   *
   * Two rate tables, because gpt-4o and gpt-4o-mini are priced an order of
   * magnitude apart and blending them into one number is how a cost model
   * quietly becomes wrong on the cheap half.
   */
  const big = { inPerMTok: 250, outPerMTok: 1000, perAudioMinute: 0 };
  const mini = { inPerMTok: 15, outPerMTok: 60, perAudioMinute: 0 };
  const audio = { inPerMTok: 0, outPerMTok: 0, perAudioMinute: 0.3 };

  const durations = [...Array.from({ length: 24 }, () => 3), ...Array.from({ length: 11 }, () => 8)];

  /* note + risk + 0.4 of a profile rebuild, all on gpt-4o */
  const onBig = fit(
    synthetic(durations, { fixedIn: 1550 + 600 + 480, inPerMin: 400, fixedOut: 800 + 300 + 160, outPerMin: 0 }),
  );
  /* the diariser and four copilot turns, all on gpt-4o-mini */
  const onMini = fit(
    synthetic(durations, { fixedIn: 1600, inPerMin: 300, fixedOut: 600, outPerMin: 60 }),
  );
  const onAudio = fit(synthetic(durations, { fixedIn: 0, inPerMin: 0, fixedOut: 0, outPerMin: 0 }));

  const session = (minutes: number) =>
    costAt(onBig, minutes, big)! + costAt(onMini, minutes, mini)! + costAt(onAudio, minutes, audio)!;

  const four = session(4);
  const fifty = session(50);

  /* $0.036 a session is what 35 sessions x $0.036 = $1.26 of budget is built on. */
  assert.ok(
    Math.abs(four / 100_000 - 0.036) < 0.004,
    `four minutes costed $${(four / 100_000).toFixed(4)}, budgeted at $0.036`,
  );

  /* 🔴 And the number every pricing decision downstream depends on. */
  assert.ok(
    Math.abs(fifty / 100_000 - 0.226) < 0.03,
    `fifty minutes costed $${(fifty / 100_000).toFixed(4)}, expected about $0.226`,
  );

  /* 🔴 THE CLAIM, ASSERTED: multiplying the short one overstates by about double. */
  const naive = four * 12.5;
  const ratio = naive / fifty;
  assert.ok(
    ratio > 1.8 && ratio < 2.2,
    `linear extrapolation was ${ratio.toFixed(2)}x the truth, expected about 2x`,
  );
});

test("🔴 a price change re-prices the forecast without touching the measurement", () => {
  const f = fit(synthetic([3, 3, 3, 3, 3, 8, 8, 8, 8, 8], SHAPE));

  const before = costAt(f, 50, RATES)!;
  const after = costAt(f, 50, { ...RATES, inPerMTok: RATES.inPerMTok * 2 })!;

  assert.ok(after > before, "doubling the input rate must cost more");
  /*
   * And it must not double the TOTAL, because output tokens and audio are
   * priced separately. A model that moved in lockstep with one rate would be
   * fusing the physics and the prices, which is the thing this separation is
   * for.
   */
  assert.ok(after < before * 2, "only the input half moved");
});

test("costAt returns null for a fit that refused, rather than a number", () => {
  const f = fit(synthetic([4, 4, 4, 4, 4, 4, 4, 4, 4, 4], SHAPE));
  assert.equal(costAt(f, 50, RATES), null);
  assert.equal(naiveCostAt(f, 50, 4, RATES), null);
});

test("🔴 noise does not break the recovery, it only widens it", () => {
  /* Real transcripts vary. The fit must survive a session that ran quiet. */
  const clean = synthetic([3, 3, 3, 3, 3, 8, 8, 8, 8, 8], SHAPE);
  const noisy = clean.map((s, i) => ({
    ...s,
    inputTokens: s.inputTokens * (i % 2 === 0 ? 0.9 : 1.1),
  }));

  const f = fit(noisy);
  assert.equal(f.fitted, true);
  if (!f.fitted) return;
  assert.ok(Math.abs(f.inputTokens.fixed - 1550) < 400, `fixed drifted to ${f.inputTokens.fixed}`);
  assert.ok(f.inputTokens.r2 > 0.3, "and the fit reports how well it did");
});
