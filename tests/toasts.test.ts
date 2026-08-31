import assert from "node:assert/strict";
import { test } from "node:test";

import { mergeToasts, type Toast } from "../components/session/copilot-toasts";

/**
 * The stacking rule, tested as arithmetic.
 *
 * The bug this replaces was one line — `setSuggestions(data.suggestions)`
 * overwrote — and it cost a clinician every suggestion they had not managed to
 * read inside one copilot cycle. So the replacement's behaviour is worth
 * pinning down rather than eyeballing.
 */

const s = (kind: Toast["kind"], text: string) => ({ kind, text });

test("a new batch adds to the stack instead of replacing it", () => {
  const first = mergeToasts([], [s("explore", "What kept you awake?")]);
  assert.equal(first.length, 1);

  const second = mergeToasts(first, [s("reflect", "Three weeks is a long time.")]);
  assert.equal(second.length, 2, "the first suggestion survives the second batch");
  assert.equal(second[0]!.text, "Three weeks is a long time.", "newest first");
  assert.equal(second[1]!.text, "What kept you awake?");
});

test("a repeat of something already on screen is dropped", () => {
  /*
   * The copilot runs every three segments and frequently produces the same
   * thought twice running — five identical "What emotions are you feeling?"
   * cards were what this test was written against.
   */
  const current = mergeToasts([], [s("explore", "What kept you awake?")]);
  const again = mergeToasts(current, [s("explore", "  what kept you awake?  ")]);
  assert.equal(again.length, 1, "case and whitespace do not make it a new suggestion");

  const punctuated = mergeToasts(current, [s("explore", "What kept you awake")]);
  assert.equal(punctuated.length, 1, "trailing punctuation does not either");
});

test("Arabic punctuation is normalised too", () => {
  const current = mergeToasts([], [s("explore", "ما الذي أبقاك مستيقظًا؟")]);
  const again = mergeToasts(current, [s("explore", "ما الذي أبقاك مستيقظًا")]);
  assert.equal(again.length, 1, "the Arabic question mark is punctuation, not content");
});

test("two different suggestions in one batch both land", () => {
  const both = mergeToasts([], [s("explore", "What kept you awake?"), s("reflect", "That sounds heavy.")]);
  assert.equal(both.length, 2);
});

test("empty text is never stacked", () => {
  assert.equal(mergeToasts([], [s("explore", "   ")]).length, 0);
});

test("the stack is bounded", () => {
  let toasts: Toast[] = [];
  for (let i = 0; i < 20; i++) toasts = mergeToasts(toasts, [s("explore", `suggestion ${i}`)]);
  assert.ok(toasts.length <= 6, `bounded, got ${toasts.length}`);
  // And what survives is the newest, not the oldest.
  assert.equal(toasts[0]!.text, "suggestion 19");
});

test("every card carries its own arrival time", () => {
  const first = mergeToasts([], [s("explore", "one")]);
  const at = first[0]!.at;
  assert.ok(at > 0);
  const second = mergeToasts(first, [s("explore", "two")]);
  // The older card keeps its original timestamp, so it expires on schedule
  // rather than being given a fresh fifteen seconds by a later batch.
  assert.equal(second.find((t) => t.text === "one")!.at, at);
});

test("ids are unique within a batch", () => {
  const batch = mergeToasts([], [s("explore", "a"), s("reflect", "b"), s("observation", "c")]);
  assert.equal(new Set(batch.map((t) => t.id)).size, 3);
});
