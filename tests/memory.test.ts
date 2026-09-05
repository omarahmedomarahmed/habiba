import assert from "node:assert/strict";
import { test } from "node:test";

import {
  keepCitedConflicts,
  keepCitedSections,
  keepDatedObservations,
  normaliseRef,
} from "../lib/ai/profile";
import { isStale } from "../lib/data/memory";

/**
 * Sprint 9's filters, as arithmetic.
 *
 * The profile is written by a model and read by a clinician before a session,
 * so the question every test here asks is the same one: **can this sentence be
 * checked?** Three refusals answer it:
 *
 *   - a section whose refs are not all real is dropped, not trimmed (9.1)
 *   - a "conflict" with one side is not a conflict (9.4)
 *   - an observation that cannot be dated is not a timeline entry (9.2)
 */

const known = new Set(["S1:1", "S2:14", "D3:2", "D7:3"]);

/* ------------------------------------------------------------- 9.1 cited -- */

test("a fully cited section survives", () => {
  const kept = keepCitedSections(
    [{ heading: "Presenting problem", body: "Panic at work.", refs: ["S2:14"] }],
    known,
  );
  assert.equal(kept.length, 1);
  assert.deepEqual(kept[0]!.refs, ["S2:14"]);
});

test("🔴 a section with an invented ref is DROPPED, not trimmed", () => {
  // Trimming would leave the claim standing with fewer citations than it
  // needs — a profile sentence supported by a reference that does not exist is
  // worse than a missing section.
  const kept = keepCitedSections(
    [{ heading: "History", body: "Two admissions.", refs: ["D3:2", "D99:9"] }],
    known,
  );
  assert.deepEqual(kept, []);
});

test("a section with no refs at all is dropped", () => {
  assert.deepEqual(
    keepCitedSections([{ heading: "Watch for", body: "Risk.", refs: [] }], known),
    [],
  );
});

test("an empty heading or body is dropped", () => {
  assert.deepEqual(keepCitedSections([{ heading: "", body: "x", refs: ["S1:1"] }], known), []);
  assert.deepEqual(keepCitedSections([{ heading: "x", body: "  ", refs: ["S1:1"] }], known), []);
});

test("junk from the model does not throw", () => {
  assert.deepEqual(keepCitedSections(null, known), []);
  assert.deepEqual(keepCitedSections("sections", known), []);
  assert.deepEqual(keepCitedSections([null, 3, "x"], known), []);
});

test("refs are normalised before they are checked", () => {
  // The model writes these and will not be consistent. `[s2 : 14]` is the same
  // reference as `S2:14`, and rejecting it would drop a section for a
  // whitespace difference.
  const kept = keepCitedSections(
    [{ heading: "Presenting problem", body: "x", refs: ["[s2 : 14]"] }],
    known,
  );
  assert.deepEqual(kept[0]?.refs, ["S2:14"]);
});

test("normaliseRef handles the shapes a model actually produces", () => {
  assert.equal(normaliseRef("[S2:14]"), "S2:14");
  assert.equal(normaliseRef("s2 : 14"), "S2:14");
  assert.equal(normaliseRef("D7:3"), "D7:3");
  assert.equal(normaliseRef("nonsense"), "nonsense");
});

/* ---------------------------------------------------------- 9.4 conflicts -- */

test("🔴 a conflict needs both sides, and both must be real", () => {
  const good = keepCitedConflicts(
    [{ text: "The letter says X [D3:2]; in session she said Y [S2:14].", refs: ["D3:2", "S2:14"] }],
    known,
  );
  assert.equal(good.length, 1);

  // One reference is a claim in the wrong field, not a contradiction. Requiring
  // two is what stops the model using this box as a second summary.
  const oneSided = keepCitedConflicts([{ text: "She was admitted.", refs: ["D3:2"] }], known);
  assert.deepEqual(oneSided, []);

  // And an invented second side is not a second side.
  const invented = keepCitedConflicts([{ text: "X vs Y", refs: ["D3:2", "S9:99"] }], known);
  assert.deepEqual(invented, []);
});

/* -------------------------------------------------------- 9.2 observations -- */

const material = { refs: known, dates: new Map<string, Date>() };
const now = new Date("2026-09-05T00:00:00Z");

test("a dated, cited observation survives", () => {
  const kept = keepDatedObservations(
    [{ date: "2019-04-02", text: "Admitted for a week.", ref: "D3:2" }],
    material,
    now,
  );
  assert.equal(kept.length, 1);
  assert.equal(kept[0]!.observedAt.toISOString().slice(0, 10), "2019-04-02");
});

test("🔴 an undated observation is discarded, never dated to today", () => {
  // A timeline is a claim about *when*. Silently placing an undated entry at
  // "now" puts a 2019 admission in this week and the reader cannot tell.
  assert.deepEqual(keepDatedObservations([{ text: "Admitted.", ref: "D3:2" }], material, now), []);
  assert.deepEqual(
    keepDatedObservations(
      [{ date: "sometime last spring", text: "x", ref: "D3:2" }],
      material,
      now,
    ),
    [],
  );
});

test("an observation citing nothing real is discarded", () => {
  assert.deepEqual(
    keepDatedObservations([{ date: "2019-04-02", text: "x", ref: "D9:9" }], material, now),
    [],
  );
});

test("absurd dates are model mis-parses, not facts", () => {
  const tooOld = keepDatedObservations(
    [{ date: "1631-04-02", text: "x", ref: "D3:2" }],
    material,
    now,
  );
  const tooNew = keepDatedObservations(
    [{ date: "2031-04-02", text: "x", ref: "D3:2" }],
    material,
    now,
  );
  assert.deepEqual(tooOld, []);
  assert.deepEqual(tooNew, []);
});

test("a date inside the next year is allowed — a planned discharge is real", () => {
  const soon = keepDatedObservations(
    [{ date: "2026-11-01", text: "Discharge planned.", ref: "S2:14" }],
    material,
    now,
  );
  assert.equal(soon.length, 1);
});

test("the timeline comes back in date order, oldest first", () => {
  const kept = keepDatedObservations(
    [
      { date: "2024-01-01", text: "later", ref: "S1:1" },
      { date: "2019-04-02", text: "earlier", ref: "D3:2" },
    ],
    material,
    now,
  );
  assert.deepEqual(
    kept.map((k) => k.text),
    ["earlier", "later"],
  );
});

/* --------------------------------------------------------------- staleness -- */

test("a profile behind its sources is marked, not silently trusted", () => {
  const profile = { sessionCount: 2, documentCount: 1 } as never;
  assert.equal(isStale(profile, { sessions: 3, documents: 1 }), true);
  assert.equal(isStale(profile, { sessions: 2, documents: 2 }), true);
  assert.equal(isStale(profile, { sessions: 2, documents: 1 }), false);
  // No profile is not a stale profile — it is an empty state with its own copy.
  assert.equal(isStale(null, { sessions: 3, documents: 3 }), false);
});
