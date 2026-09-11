import assert from "node:assert/strict";
import { test } from "node:test";

import {
  DIARISATION_FIXTURES,
  IDENTITIES,
  fixture,
  goldMatches,
  measuredMap,
} from "../evals/cases/diarisation";
import { alignSegments, summarise } from "../lib/diarisation/align";
import { crosstalk, normaliseTurns, speakingTime, speechCoverage, voiceOrder } from "../lib/diarisation/turns";
import {
  bindVoices,
  displayFor,
  resolveVoices,
  rosterFor,
  speakerFor,
  tallyEvidence,
} from "../lib/diarisation/voices";

/**
 * The offline half of sprint 37. PLAN.md 37.1, 37.2, 37.3.
 *
 * 🔴 Every refusal is paired with the acceptance it must not swallow (C165).
 * An aligner that refuses everything has a perfect error rate and produces a
 * transcript with no speakers in it, and only one of those two facts shows up
 * in a summary line.
 */

/* --------------------------------------------------------- the arithmetic -- */

test("a provider's mess comes back usable, and the discards are counted", () => {
  const result = normaliseTurns([
    { label: "B", startMs: 5000, endMs: 9000 },
    { label: "A", startMs: 0, endMs: 4000 },
    { label: "A", startMs: 4000, endMs: 3000 },
    { label: "", startMs: 10000, endMs: 11000 },
    { label: "A", startMs: -100, endMs: 500 },
  ]);

  assert.equal(result.discarded, 3, "zero-length, empty label and negative start");
  assert.deepEqual(
    result.turns.map((turn) => turn.label),
    ["A", "B"],
  );
  assert.equal(result.turns[0]!.startMs, 0, "sorted by start");
});

test("a breath is not a turn change, and another voice in between is", () => {
  const merged = normaliseTurns([
    { label: "A", startMs: 0, endMs: 1000 },
    { label: "A", startMs: 1100, endMs: 2000 },
  ]);
  assert.equal(merged.turns.length, 1);
  assert.equal(merged.merged, 1);
  assert.equal(merged.turns[0]!.endMs, 2000);

  const interrupted = normaliseTurns([
    { label: "A", startMs: 0, endMs: 1000 },
    { label: "B", startMs: 1050, endMs: 1150 },
    { label: "A", startMs: 1200, endMs: 2000 },
  ]);
  assert.equal(interrupted.turns.length, 3, "a voice between two fragments keeps them apart");
  assert.equal(interrupted.merged, 0);
});

test("🔴 two voices at once stay two turns", () => {
  const both = [
    { label: "A", startMs: 0, endMs: 8000 },
    { label: "B", startMs: 1000, endMs: 7000 },
  ];
  const result = normaliseTurns(both);
  assert.equal(result.turns.length, 2, "crosstalk is evidence, not noise to resolve");
  assert.deepEqual(crosstalk(result.turns), [{ startMs: 1000, endMs: 7000 }]);
});

test("speaking time counts overlap for both, coverage counts it once", () => {
  const turns = [
    { label: "A", startMs: 0, endMs: 8000 },
    { label: "B", startMs: 4000, endMs: 8000 },
  ];
  assert.equal(speakingTime(turns).get("A"), 8000);
  assert.equal(speakingTime(turns).get("B"), 4000);
  assert.equal(speechCoverage(turns, 16000), 0.5, "eight seconds of audio, not twelve");
});

test("the voice order is the order they are first heard", () => {
  assert.deepEqual(
    voiceOrder([
      { label: "B", startMs: 0, endMs: 1 },
      { label: "A", startMs: 2, endMs: 3 },
      { label: "B", startMs: 4, endMs: 5 },
    ]),
    ["B", "A"],
  );
});

/* ---------------------------------------------------------- the alignment -- */

test("🔴 every fixture aligns exactly as its construction says it should", () => {
  for (const item of DIARISATION_FIXTURES) {
    const alignments = alignSegments(item.segments, normaliseTurns(item.turns).turns);
    assert.equal(alignments.length, item.segments.length, `${item.id}: one answer per chunk`);
    const wrong = goldMatches(item.gold, alignments);
    assert.deepEqual(wrong, [], `${item.id}: ${wrong.join(" · ")}`);
  }
});

test("🔴 …and the clean fixtures refuse NOTHING", () => {
  /* The other half of C165: a change that refuses everything passes the test
     above only if this one is here. */
  for (const id of ["clean-two", "track-dropout", "group-five"]) {
    const item = fixture(id);
    const summary = summarise(alignSegments(item.segments, item.turns));
    assert.equal(summary.attributed, 1, `${id} attributed ${summary.attributed}`);
    assert.equal(summary.contested + summary.silence, 0);
  }
});

test("a chunk with no window is refused rather than divided by zero", () => {
  const [only] = alignSegments([{ index: 0, startMs: 5000, endMs: 5000 }], [
    { label: "A", startMs: 0, endMs: 10000 },
  ]);
  assert.equal(only!.reason, "no_window");
  assert.equal(only!.label, null);
});

test("a chunk with no turns at all is silence, not an error", () => {
  const [only] = alignSegments([{ index: 0, startMs: 0, endMs: 8000 }], []);
  assert.deepEqual({ label: only!.label, reason: only!.reason }, { label: null, reason: "silence" });
});

test("the share floor is a floor, on both sides of itself", () => {
  const segment = [{ index: 0, startMs: 0, endMs: 8000 }];
  /* 6000 of 8000 is exactly 0.75: held. */
  const held = alignSegments(segment, [
    { label: "A", startMs: 0, endMs: 6000 },
    { label: "B", startMs: 6000, endMs: 8000 },
  ]);
  assert.equal(held[0]!.label, "A");

  /* 5900 of 8000 is under it: nobody. */
  const contested = alignSegments(segment, [
    { label: "A", startMs: 0, endMs: 5900 },
    { label: "B", startMs: 5900, endMs: 8000 },
  ]);
  assert.equal(contested[0]!.label, null);
  assert.equal(contested[0]!.reason, "contested");
});

test("alignment is order-preserving and total, which is H11's descendant", () => {
  const segments = Array.from({ length: 250 }, (_, i) => ({
    index: i,
    startMs: i * 8000,
    endMs: (i + 1) * 8000,
  }));
  const alignments = alignSegments(segments, [{ label: "A", startMs: 0, endMs: 250 * 8000 }]);
  assert.equal(alignments.length, 250);
  assert.deepEqual(
    alignments.map((a) => a.index),
    segments.map((s) => s.index),
  );
  assert.equal(alignments.every((a) => a.label === "A"), true, "no chunk went unlooked at");
});

/* ------------------------------------------------------------ the voices -- */

test("a roster is every voice, numbered from one, and nobody", () => {
  const roster = rosterFor(fixture("group-five").turns);
  assert.equal(roster.length, 5);
  assert.deepEqual(roster.map((v) => v.ordinal), [1, 2, 3, 4, 5]);
  assert.equal(roster.every((v) => v.role === null && v.boundBy === null), true);
});

test("🔴 every fixture binds exactly the voices its evidence proves", () => {
  for (const item of DIARISATION_FIXTURES) {
    const turns = normaliseTurns(item.turns).turns;
    const alignments = alignSegments(item.segments, turns);
    const { voices } = resolveVoices({ turns, alignments, measured: measuredMap(item) });

    assert.equal(voices.length, item.expect.voices, `${item.id}: voice count`);
    for (const voice of voices) {
      assert.equal(
        voice.role,
        item.expect.bound[voice.label] ?? null,
        `${item.id}: voice ${voice.label} bound to ${voice.role}`,
      );
    }
    assert.deepEqual(
      voices.map((voice) => displayFor(voice, IDENTITIES)),
      item.expect.display,
      `${item.id}: what the transcript shows`,
    );
  }
});

test("🔴 no elimination: the other voice in a two-voice room is not the patient", () => {
  const item = fixture("couples-third-voice");
  const turns = normaliseTurns(item.turns).turns;
  const { voices } = resolveVoices({
    turns,
    alignments: alignSegments(item.segments, turns),
    measured: measuredMap(item),
  });

  const [a, b, c] = voices;
  assert.equal(a!.role, "therapist", "the clinician is proved by their own track");
  assert.equal(b!.role, null, "B is Speaker 2, not 'the one who is not the therapist'");
  assert.equal(c!.role, null);
  assert.equal(displayFor(b!, IDENTITIES), "Speaker 2");
  assert.equal(displayFor(c!, IDENTITIES), "Speaker 3");
});

test("🔴 …and the same voice IS bound the moment it has evidence of its own", () => {
  /* The C165 pairing for the rule above: the refusal is about missing
     evidence, not about a binder that never binds. */
  const item = fixture("couples-third-voice");
  /* B speaks chunks 1 and 3, so a third proof needs a third chunk of B. */
  const turns = normaliseTurns([
    ...item.turns,
    { label: "B", startMs: 59000, endMs: 67000 },
  ]).turns;
  const segments = [...item.segments, { index: 7, startMs: 58800, endMs: 67200 }];
  const measured = measuredMap(item);
  for (const index of [1, 3, 7]) measured.set(index, "patient");

  const { voices } = resolveVoices({
    turns,
    alignments: alignSegments(segments, turns),
    measured,
  });
  assert.equal(voices.find((v) => v.label === "B")?.role, "patient");
  assert.equal(voices.find((v) => v.label === "C")?.role, null, "C still has nothing");
});

test("two proofs are not enough, three are", () => {
  const roster = rosterFor([{ label: "A", startMs: 0, endMs: 1 }]);
  const align = (n: number) =>
    Array.from({ length: n }, (_, i) => ({
      index: i,
      label: "A",
      reason: "assigned" as const,
      share: 1,
      coverage: 1,
      voices: 1,
    }));

  const two = new Map<number, "therapist" | "patient">([[0, "therapist"], [1, "therapist"]]);
  assert.equal(tallyEvidence(roster, align(2), two)[0]!.refusal, "too_little");
  assert.equal(bindVoices(roster, tallyEvidence(roster, align(2), two))[0]!.role, null);

  const three = new Map(two).set(2, "therapist");
  assert.equal(tallyEvidence(roster, align(3), three)[0]!.candidate, "therapist");
  assert.equal(bindVoices(roster, tallyEvidence(roster, align(3), three))[0]!.role, "therapist");
});

test("🔴 a tie for one role is nobody, in both directions", () => {
  const turns = [
    { label: "A", startMs: 0, endMs: 1000 },
    { label: "B", startMs: 2000, endMs: 3000 },
  ];
  const roster = rosterFor(turns);
  const alignments = [0, 1, 2, 3, 4, 5].map((i) => ({
    index: i,
    label: i < 3 ? "A" : "B",
    reason: "assigned" as const,
    share: 1,
    coverage: 1,
    voices: 1,
  }));
  const measured = new Map<number, "therapist" | "patient">([
    [0, "therapist"],
    [1, "therapist"],
    [2, "therapist"],
    [3, "therapist"],
    [4, "therapist"],
    [5, "therapist"],
  ]);

  const tied = bindVoices(roster, tallyEvidence(roster, alignments, measured));
  assert.deepEqual(tied.map((v) => v.role), [null, null], "three each: nobody is the clinician");

  /* Break the tie by one chunk and the stronger claim takes it, alone. */
  const broken = bindVoices(
    roster,
    tallyEvidence(roster, [...alignments, { index: 6, label: "A", reason: "assigned" as const, share: 1, coverage: 1, voices: 1 }], new Map(measured).set(6, "therapist")),
  );
  assert.deepEqual(broken.map((v) => v.role), ["therapist", null]);
});

test("🔴 an unrecognised voice writes 'unknown' into the speaker column", () => {
  const roster = rosterFor([{ label: "A", startMs: 0, endMs: 1 }]);
  assert.equal(speakerFor(roster[0]), "unknown");
  assert.equal(speakerFor(null), "unknown");
  assert.equal(speakerFor({ ...roster[0]!, role: "patient", boundBy: "track" }), "patient");
});

test("🔴 a patient voice in a session with no patient record is still not named", () => {
  const voice = { label: "A", ordinal: 2, role: "patient" as const, boundBy: "track" as const };
  assert.equal(displayFor(voice, { therapist: "Dr Habiba", patient: null }), "Speaker 2");
});

test("the speaker number is the voice's place among ALL voices", () => {
  /* Speaker 3 is the third voice in the room, whether or not one and two were
     identified. Any other numbering misleads the person reading it. */
  const item = fixture("couples-third-voice");
  const turns = normaliseTurns(item.turns).turns;
  const { voices } = resolveVoices({
    turns,
    alignments: alignSegments(item.segments, turns),
    measured: measuredMap(item),
  });
  assert.equal(displayFor(voices[2]!, IDENTITIES), "Speaker 3");
});

test("resolveVoices counts what it could not name", () => {
  const item = fixture("group-five");
  const turns = normaliseTurns(item.turns).turns;
  const report = resolveVoices({
    turns,
    alignments: alignSegments(item.segments, turns),
    measured: new Map(),
  });
  assert.equal(report.unnamed, 5);
});
