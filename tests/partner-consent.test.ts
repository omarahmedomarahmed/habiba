import assert from "node:assert/strict";
import { test } from "node:test";

import { boundaryAfterAnswer, coverageSentence, howFarIn } from "../lib/partner/consent";

/** 🔴 Board 605: a yes 20 seconds in said "Recording started 0 minutes into this session". */
test("the coverage sentence names seconds rather than rounding them away", () => {
  assert.equal(howFarIn(20), "20 seconds");
  assert.equal(howFarIn(1), "1 second");
  assert.equal(howFarIn(60), "1 minute");
  assert.equal(howFarIn(90), "1 minute and 30 seconds");
  assert.equal(howFarIn(600), "10 minutes");
  assert.match(coverageSentence(20), /^Recording started 20 seconds into this session\./);
  assert.doesNotMatch(coverageSentence(20), /\b0 minutes\b/);
  assert.equal(coverageSentence(0), "This session was recorded from the start.");
});

/** 🔴 Board 606: a withdrawal after the session ended erased the approved note, transcript and summary. */
test("a withdrawal after the session ended keeps the boundary, so what was read still answers", () => {
  assert.equal(boundaryAfterAnswer({ consented: null, previous: 70, ended: true }), 70);
  assert.equal(boundaryAfterAnswer({ consented: null, previous: 0, ended: true }), 0);
});

test("a withdrawal while the session runs ends the consented period", () => {
  assert.equal(boundaryAfterAnswer({ consented: null, previous: 0, ended: false }), null);
});

test("an ended session nobody consented to stays unrecorded", () => {
  assert.equal(boundaryAfterAnswer({ consented: null, previous: null, ended: true }), null);
});

test("a yes always sets the boundary to its own offset", () => {
  assert.equal(boundaryAfterAnswer({ consented: 20, previous: null, ended: false }), 20);
  assert.equal(boundaryAfterAnswer({ consented: 20, previous: 0, ended: true }), 20);
});
