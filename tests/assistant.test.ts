import assert from "node:assert/strict";
import { test } from "node:test";

import { linkRoster, mentionsIn, type RosterEntry } from "../lib/assistant/roster";

/**
 * 10.3, as arithmetic.
 *
 * > Patient names as links, **validated server-side against the real roster**
 * > so a hallucinated name can never become one.
 *
 * The rule under test is one sentence: **a link exists only where the text
 * matches a roster entry the server supplied.** Everything else here is the
 * ways that rule can be got wrong — a substring lighting up inside a longer
 * word, a short name winning over the longer one that contains it, or an
 * Arabic name matching mid-word because `\b` is ASCII-only.
 */

const roster: RosterEntry[] = [
  { patientId: "p-sara", name: "Sara" },
  { patientId: "p-sara-m", name: "Sara Mahmoud" },
  { patientId: "p-omar", name: "Omar Abdelgawad" },
  { patientId: "p-habiba", name: "حبيبة" },
];

const textOf = (spans: ReturnType<typeof linkRoster>) => spans.map((s) => s.text).join("");
const links = (spans: ReturnType<typeof linkRoster>) =>
  spans.filter((s) => s.kind === "link").map((s) => ({ text: s.text, id: s.patientId }));

/* ------------------------------------------------------------ the guarantee -- */

test("🔴 a name that is not on the roster never becomes a link", () => {
  // The failure this whole design exists to prevent. The model invents a
  // patient; the worst it can do is put plain text on the screen.
  const spans = linkRoster("You should follow up with Layla Hassan this week.", roster);
  assert.deepEqual(links(spans), []);
  assert.equal(textOf(spans), "You should follow up with Layla Hassan this week.");
});

test("a roster name becomes a link, pointing at that patient", () => {
  const spans = linkRoster("Omar Abdelgawad has two notes waiting.", roster);
  assert.deepEqual(links(spans), [{ text: "Omar Abdelgawad", id: "p-omar" }]);
});

test("the rendered text is never rewritten", () => {
  // A link that silently corrects what the sentence said is a link that makes
  // the sentence untrue.
  const spans = linkRoster("omar abdelgawad is overdue.", roster);
  assert.equal(textOf(spans), "omar abdelgawad is overdue.");
  assert.deepEqual(links(spans), [{ text: "omar abdelgawad", id: "p-omar" }]);
});

/* ----------------------------------------------------------------- overlaps -- */

test("🔴 the longer name wins — 'Sara Mahmoud' is not 'Sara' plus a surname", () => {
  const spans = linkRoster("Sara Mahmoud cancelled.", roster);
  assert.deepEqual(links(spans), [{ text: "Sara Mahmoud", id: "p-sara-m" }]);
  assert.equal(textOf(spans), "Sara Mahmoud cancelled.");
});

test("…and the shorter one still links when it stands alone", () => {
  const spans = linkRoster("Sara cancelled.", roster);
  assert.deepEqual(links(spans), [{ text: "Sara", id: "p-sara" }]);
});

test("🔴 a name does not light up inside a longer word", () => {
  // "Sara" inside "Sarah" or "Sarafina" is a link to the wrong human being.
  assert.deepEqual(links(linkRoster("Sarah is not on your list.", roster)), []);
  assert.deepEqual(links(linkRoster("Consarated nonsense.", roster)), []);
});

test("Arabic names match on their own boundaries, not ASCII ones", () => {
  // `\b` in JavaScript is defined against [A-Za-z0-9_], so every Arabic letter
  // reads as a boundary and a name would match mid-word. This checks the
  // Unicode-aware path both ways.
  assert.deepEqual(links(linkRoster("حبيبة لم تحضر.", roster)), [
    { text: "حبيبة", id: "p-habiba" },
  ]);
  assert.deepEqual(links(linkRoster("الحبيبةالكبيرة", roster)), []);
});

test("several names in one answer all resolve, in order", () => {
  const spans = linkRoster("Sara and Omar Abdelgawad are both overdue.", roster);
  assert.deepEqual(links(spans), [
    { text: "Sara", id: "p-sara" },
    { text: "Omar Abdelgawad", id: "p-omar" },
  ]);
  assert.equal(textOf(spans), "Sara and Omar Abdelgawad are both overdue.");
});

test("a repeated name links every time it appears", () => {
  const spans = linkRoster("Sara, then Sara again.", roster);
  assert.equal(links(spans).length, 2);
});

/* -------------------------------------------------------------- edge cases -- */

test("an empty roster leaves the text alone", () => {
  const spans = linkRoster("Nobody at all.", []);
  assert.deepEqual(links(spans), []);
  assert.equal(textOf(spans), "Nobody at all.");
});

test("a very short roster name is ignored rather than matching everywhere", () => {
  // A patient recorded as "A" would otherwise turn every letter A in every
  // answer into a link to them.
  const spans = linkRoster("A patient asked about an appointment.", [
    { patientId: "p-a", name: "A" },
  ]);
  assert.deepEqual(links(spans), []);
});

test("an empty answer produces no spans at all", () => {
  assert.deepEqual(linkRoster("", roster), []);
});

test("the text always round-trips, whatever matched", () => {
  // The property that stops a rendering bug eating half an answer.
  for (const answer of [
    "Sara Mahmoud and Sara and حبيبة.",
    "No names here.",
    "Omar Abdelgawad.",
    "",
  ]) {
    assert.equal(textOf(linkRoster(answer, roster)), answer);
  }
});

/* --------------------------------------------------------------- mentions -- */

test("mentions are deduplicated, and only ever roster entries", () => {
  const found = mentionsIn("Sara, Sara again, and Layla who is not real.", roster);
  assert.deepEqual(found, [{ patientId: "p-sara", name: "Sara" }]);
});

test("🔴 rendering from stored mentions cannot resurrect a name that was not matched", () => {
  // This is how the component renders: `linkRoster(text, message.mentions)`.
  // The mentions were resolved against the real roster when the answer was
  // written, so a name outside them is inert forever after — including on a
  // re-render months later, and including if the roster changes.
  const stored = mentionsIn("Sara has two notes.", roster);
  const spans = linkRoster("Sara and Omar Abdelgawad both do.", stored);
  assert.deepEqual(links(spans), [{ text: "Sara", id: "p-sara" }]);
});
