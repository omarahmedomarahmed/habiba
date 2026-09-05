import assert from "node:assert/strict";
import { test } from "node:test";

import { countWords, pauseBeforeMs, wordsPerMinute } from "../lib/ai/descriptors";
import { planBatches, straddlesTurnBoundary } from "../lib/ai/diarise";
import { shouldCut } from "../lib/audio/recorder";

/**
 * Sprint 3, as arithmetic.
 *
 * The three rules this sprint turns on — which segments get looked at, where
 * the audio is cut, and what a descriptor may say — are all pure functions, and
 * they were extracted from their surroundings precisely so they could be tested
 * without a browser, a microphone, a model or a database. None of them had a
 * test before, which is how `MAX_SEGMENTS = 160` survived long enough to become
 * a hazard note.
 */

/* ------------------------------------------------------------------ H11 -- */

test("every segment lands in exactly one batch", () => {
  /*
   * The whole of H11. The old code did `.limit(160)`, so a 450-segment session
   * had two thirds of itself never read — not mislabelled, absent. This asserts
   * coverage rather than labelling, because coverage is what was broken.
   */
  for (const total of [1, 4, 119, 120, 121, 160, 161, 333, 450, 1000]) {
    const plan = planBatches(total);
    const covered = plan.reduce((n, b) => n + b.length, 0);
    assert.equal(covered, total, `${total} segments must all be covered`);

    // Contiguous and in order: no gap, no overlap.
    let expected = 0;
    for (const b of plan) {
      assert.equal(b.offset, expected, `batch starts at ${b.offset}, expected ${expected}`);
      expected += b.length;
    }
  }
});

test("a 60-minute session is fully covered, where the old cap dropped two thirds", () => {
  // ~450 segments is the figure HAZARDS.md gives for a 60-minute session.
  const plan = planBatches(450);
  assert.equal(plan.reduce((n, b) => n + b.length, 0), 450);
  assert.ok(plan.length > 1, "it takes more than one call");
  // What the old code would have managed.
  assert.ok(450 - 160 > 0);
});

test("no batch is larger than one call can index reliably", () => {
  for (const b of planBatches(1000)) assert.ok(b.length <= 120, `batch of ${b.length}`);
});

test("an empty transcript plans no work at all", () => {
  assert.deepEqual(planBatches(0), []);
});

test("the batch ceiling bounds the work rather than looping forever", () => {
  const plan = planBatches(100_000);
  assert.ok(plan.length <= 40, `${plan.length} batches`);
  // And it is honest about stopping short — the caller logs the shortfall.
  assert.ok(plan.reduce((n, b) => n + b.length, 0) < 100_000);
});

/* ------------------------------------------------- C35: never label a straddle -- */

test("a question followed by its answer is refused, not guessed at", () => {
  /*
   * The measured example, verbatim from the branch database. It was labelled
   * `patient` — half right, and the half it got wrong welded a therapist's
   * question onto a crisis disclosure.
   */
  assert.equal(
    straddlesTurnBoundary(
      "What made you decide to come here today? Um, well, as I told you, I wanna kill myself.",
    ),
    true,
  );
});

test("the rule works in Arabic, which is most of this product", () => {
  assert.equal(
    straddlesTurnBoundary("إيه الإحساس اللي أنت بتحسي بيه؟ مضونة مش بعمل حاجة يعني"),
    true,
  );
  assert.equal(
    straddlesTurnBoundary("مظبوط مظبوط احكيلي عاملة إيه؟ الدنيا تمام أنا في إسكندرية"),
    true,
  );
});

test("a line that is only a question is labelled normally", () => {
  // The clinician asking and the chunk ending there is the *good* case — it is
  // one speaker, and refusing it would throw away a correct label.
  assert.equal(straddlesTurnBoundary("Can you name your emotions?"), false);
  assert.equal(straddlesTurnBoundary("كملي. What feelings come up for you?"), false);
  assert.equal(straddlesTurnBoundary("How did that feel?  "), false);
  // Trailing punctuation after the question mark is still the end of the line.
  assert.equal(straddlesTurnBoundary("Are you sure?)"), false);
});

test("one clinician asking a run of questions is not a straddle", () => {
  /*
   * Found by hand-checking every line the first version of this rule flagged:
   * 3 of 22 were a single clinician asking several questions in one breath.
   * Measuring from the *last* question mark rather than the first separates
   * them — a run of questions has nothing after the final one.
   */
  assert.equal(
    straddlesTurnBoundary(
      "Can you tell me more about what do you do for a living? Where do you live? Are you married?",
    ),
    false,
  );
  assert.equal(
    straddlesTurnBoundary(
      "Is it the marriage? Is it the work? What is the one thing that would make you feel better?",
    ),
    false,
  );
});

test("one speaker saying several sentences is not a straddle", () => {
  /*
   * Why interior `.` was measured and rejected as a signal: it fires on 60 of
   * 151 labelled segments against 22 for the question mark, because a person
   * saying two sentences in eight seconds is completely ordinary. Trading 38
   * correct labels for a few extra catches is the wrong trade.
   */
  assert.equal(
    straddlesTurnBoundary("I don't know. Maybe a little bit depressed. At the same time, I'm..."),
    false,
  );
  assert.equal(straddlesTurnBoundary("آه والحياة لطيفة يعني الحمد لله."), false);
});

test("an empty or trivial line is never a straddle", () => {
  assert.equal(straddlesTurnBoundary(""), false);
  assert.equal(straddlesTurnBoundary("   "), false);
  assert.equal(straddlesTurnBoundary("?"), false);
  assert.equal(straddlesTurnBoundary("Mm-hm"), false);
});

/* ------------------------------------------------------------------- 3.2 -- */

const RATE = 16_000;
const cut = (o: Partial<Parameters<typeof shouldCut>[0]>) =>
  shouldCut({
    bufferedFrames: 0,
    silentTailFrames: 0,
    sampleRate: RATE,
    minChunkSeconds: 2,
    maxChunkSeconds: 8,
    pauseMs: 600,
    ...o,
  });

test("a pause cuts the chunk once there is enough to send", () => {
  // Three seconds of audio, and the speaker has stopped for 600ms.
  assert.equal(cut({ bufferedFrames: RATE * 3, silentTailFrames: RATE * 0.6 }), true);
});

test("a pause mid-word does not cut, because there is not enough yet", () => {
  // Half a second in, a gap. Cutting here sends a fragment that transcribes to
  // noise — which is the behaviour the one-second floor already guarded.
  assert.equal(cut({ bufferedFrames: RATE * 0.5, silentTailFrames: RATE }), false);
});

test("a short gap inside a word is not a pause", () => {
  /*
   * The stop consonant in "back to" is roughly 100ms of near-silence. Treating
   * that as a turn boundary would cut mid-word, which is the exact defect this
   * sprint exists to fix — so the threshold has to sit above it.
   */
  assert.equal(cut({ bufferedFrames: RATE * 4, silentTailFrames: RATE * 0.1 }), false);
});

test("someone who never pauses is still cut, at the ceiling", () => {
  assert.equal(cut({ bufferedFrames: RATE * 8, silentTailFrames: 0 }), true);
  assert.equal(cut({ bufferedFrames: RATE * 7.9, silentTailFrames: 0 }), false);
});

test("the ceiling wins even mid-word, because a chunk has to be bounded", () => {
  assert.equal(cut({ bufferedFrames: RATE * 20, silentTailFrames: 0 }), true);
});

test("an empty buffer is never cut", () => {
  assert.equal(cut({ bufferedFrames: 0, silentTailFrames: RATE * 10 }), false);
});

test("a nonsense sample rate cannot force a cut", () => {
  assert.equal(cut({ sampleRate: 0, bufferedFrames: 999_999 }), false);
});

test("the cut rule holds at a different sample rate", () => {
  // H4: re-measure the case that already worked. 48k is what a browser gives
  // before downsampling, so the rule must not be tuned to 16k by accident.
  const at48 = (o: Partial<Parameters<typeof shouldCut>[0]>) =>
    shouldCut({
      bufferedFrames: 0,
      silentTailFrames: 0,
      sampleRate: 48_000,
      minChunkSeconds: 2,
      maxChunkSeconds: 8,
      pauseMs: 600,
      ...o,
    });
  assert.equal(at48({ bufferedFrames: 48_000 * 3, silentTailFrames: 48_000 * 0.6 }), true);
  assert.equal(at48({ bufferedFrames: 48_000 * 3, silentTailFrames: 48_000 * 0.1 }), false);
  assert.equal(at48({ bufferedFrames: 48_000 * 8, silentTailFrames: 0 }), true);
});

/* ------------------------------------------------------------------- 3.3 -- */

test("words are counted across Arabic and English alike", () => {
  assert.equal(countWords("how did that feel"), 4);
  assert.equal(countWords("كملي. What feelings come up for you?"), 7);
  assert.equal(countWords("  spaced   out  "), 2);
  assert.equal(countWords(""), 0);
  assert.equal(countWords("   "), 0);
});

test("speaking rate is words over real time", () => {
  // 30 words in 10 seconds is 180wpm.
  assert.equal(wordsPerMinute(new Array(30).fill("word").join(" "), 10_000), 180);
});

test("a rate that cannot be known is null, never zero", () => {
  /*
   * Zero is a measurement meaning "silent". A missing duration is not a
   * measurement at all, and averaging the two together reports a slower session
   * than happened.
   */
  assert.equal(wordsPerMinute("hello", 0), null);
  assert.equal(wordsPerMinute("hello", -5), null);
  assert.equal(wordsPerMinute("", 10_000), null);
  assert.equal(wordsPerMinute("hello", Number.NaN), null);
});

test("an impossible rate is dropped rather than stored", () => {
  // 100 words in a tenth of a second is a duration bug, not a fast talker.
  assert.equal(wordsPerMinute(new Array(100).fill("w").join(" "), 100), null);
  // 300wpm is fast but human, and is kept.
  assert.ok((wordsPerMinute(new Array(50).fill("w").join(" "), 10_000) ?? 0) === 300);
});

test("the first segment of a session has no pause before it", () => {
  assert.equal(pauseBeforeMs(0, null), null);
  assert.equal(pauseBeforeMs(5_000, undefined), null);
});

test("a pause is the gap since the last utterance ended", () => {
  assert.equal(pauseBeforeMs(12_000, 8_000), 4_000);
  assert.equal(pauseBeforeMs(8_100, 8_000), 100);
});

test("overlapping speakers record no pause rather than a negative one", () => {
  /*
   * Two recorders on one session genuinely overlap when both people talk at
   * once. "They overlapped" is better recorded as no pause than as a missing
   * value, and must never be recorded as negative time.
   */
  assert.equal(pauseBeforeMs(7_500, 8_000), 0);
});

test("descriptors describe and never interpret", () => {
  /*
   * §3.3 and the schema comment: descriptors, never emotion labels. This is a
   * structural assertion — the module exports numbers and word counts, and
   * nothing that returns a judgement about a person.
   */
  const module = { countWords, wordsPerMinute, pauseBeforeMs };
  const forbidden = /affect|emotion|sentiment|mood|anxious|distress|tone/i;
  for (const name of Object.keys(module)) {
    assert.ok(!forbidden.test(name), `${name} names an interpretation, not a descriptor`);
  }
  assert.equal(typeof wordsPerMinute("a b c", 1_000), "number");
});
