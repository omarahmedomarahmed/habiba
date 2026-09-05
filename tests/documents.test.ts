import assert from "node:assert/strict";
import { test } from "node:test";

import { verbatimIn, parseRef } from "../lib/ai/diagnoses";
import {
  chunkText,
  formatCitation,
  keepResolvableCitations,
  parseCitations,
  MAX_CHARS,
  MIN_CHARS,
} from "../lib/documents/chunk";
import {
  documentProblem,
  MAX_DOCUMENT_BYTES,
  readabilityOf,
  searchabilityLabel,
} from "../lib/documents/formats";

/**
 * Sprint 8's rules, as arithmetic.
 *
 * Three of them decide whether a clinician is misled:
 *
 *   - **A chunk is findable in the source.** Chunking cuts and never rewrites,
 *     so a citation can be checked by eye.
 *   - **A citation that does not resolve is deleted** (8.5), not shown broken.
 *   - **A diagnosis whose source sentence is not verbatim is discarded** (8.9),
 *     whatever the model claimed.
 */

/* --------------------------------------------------------------- chunking -- */

const paragraph = (n: number) => `${"word ".repeat(n).trim()}.`;

test("short text is one chunk, unchanged", () => {
  const text = "Referred by Dr Nour. Sleeping four hours a night.";
  const chunks = chunkText(text);
  assert.equal(chunks.length, 1);
  assert.equal(chunks[0]!.text, text);
  assert.equal(chunks[0]!.sequence, 1);
});

test("every chunk is present verbatim in the source", () => {
  // The property the whole feature rests on: a citation opens to words the
  // reader can find in the document. Chunking that normalised, corrected or
  // summarised would make a citation unverifiable.
  const source = [paragraph(200), paragraph(200), paragraph(200)].join("\n\n");
  const chunks = chunkText(source);

  assert.ok(chunks.length > 1, "long text should split");
  for (const chunk of chunks) {
    assert.ok(source.includes(chunk.text), `chunk ${chunk.sequence} is not in the source`);
  }
});

test("numbering is 1-based, contiguous and deterministic", () => {
  const source = [paragraph(200), paragraph(200)].join("\n\n");
  const first = chunkText(source);
  const second = chunkText(source);

  assert.deepEqual(first, second, "same text must produce the same chunks forever");
  assert.deepEqual(
    first.map((c) => c.sequence),
    first.map((_, i) => i + 1),
  );
});

test("chunks never exceed the ceiling and never split a word", () => {
  const source = paragraph(600);
  const chunks = chunkText(source);
  assert.ok(chunks.length > 1);

  for (const chunk of chunks) {
    assert.ok(chunk.text.length <= MAX_CHARS, `chunk of ${chunk.text.length} chars`);

    /*
     * A chunk beginning "…orbid ideation" is unreadable and unsearchable. Each
     * chunk is a substring of the source, so the real test is that the
     * characters either side of it in the source are whitespace — i.e. the cut
     * landed on a word boundary, not inside one.
     */
    const at = source.indexOf(chunk.text);
    assert.ok(at >= 0, "chunk must be a substring of the source");
    const before = at === 0 ? " " : source[at - 1]!;
    const after = at + chunk.text.length >= source.length ? " " : source[at + chunk.text.length]!;
    assert.match(before, /\s/, `chunk ${chunk.sequence} starts mid-word`);
    assert.match(after, /\s/, `chunk ${chunk.sequence} ends mid-word`);
  }
});

test("a sentence boundary is preferred to an arbitrary cut", () => {
  // The failure this prevents: "no history of self-harm" cut after "history
  // of" is a citation that says the opposite of the document.
  const sentence = `${"a".repeat(300)}. ${"b".repeat(300)}. ${"c".repeat(900)}.`;
  const chunks = chunkText(sentence);
  assert.ok(chunks.length > 1);
  assert.match(chunks[0]!.text, /\.$/, "first chunk should end at a full stop");
});

test("Arabic sentence endings count as boundaries", () => {
  // The majority language in this product's records. A splitter that only knows
  // ASCII punctuation cuts Arabic at random.
  const arabic = `${"ا".repeat(300)}؟ ${"ب".repeat(300)}؟ ${"ج".repeat(900)}.`;
  const chunks = chunkText(arabic);
  assert.ok(chunks.length > 1);
  assert.ok(chunks[0]!.text.endsWith("؟"), `ends with: ${chunks[0]!.text.slice(-1)}`);
});

test("empty and whitespace-only text produce no chunks, not an empty chunk", () => {
  assert.deepEqual(chunkText(""), []);
  assert.deepEqual(chunkText("   \n\n  "), []);
});

test("MIN_CHARS keeps a cut from producing a two-word citation", () => {
  assert.ok(MIN_CHARS > 0 && MIN_CHARS < MAX_CHARS);
});

/* -------------------------------------------------------------- citations -- */

test("citations are parsed, deduplicated and order-preserving", () => {
  const refs = parseCitations("As in [D7:3] and [D1:2], and again [D7:3].");
  assert.deepEqual(refs, [
    { ordinal: 7, sequence: 3 },
    { ordinal: 1, sequence: 2 },
  ]);
});

test("sloppy model output still parses", () => {
  // The model writes these. It will not be perfectly consistent.
  assert.deepEqual(parseCitations("[d7 : 3]"), [{ ordinal: 7, sequence: 3 }]);
  assert.deepEqual(parseCitations("[ D12:44 ]"), [{ ordinal: 12, sequence: 44 }]);
});

test("8.5 — a citation that does not resolve is removed from the answer", () => {
  const answer = "She reported poor sleep [D7:3] and was discharged in May [D9:1].";
  const { answer: cleaned, refs } = keepResolvableCitations(
    answer,
    (r) => r.ordinal === 7 && r.sequence === 3,
  );

  assert.deepEqual(refs, [{ ordinal: 7, sequence: 3 }]);
  assert.ok(cleaned.includes("[D7:3]"), "the real citation survives");
  assert.ok(!cleaned.includes("[D9:1]"), "the invented one is gone");
  // And the sentence still reads: no stray space before the full stop.
  assert.ok(!cleaned.includes(" ."), cleaned);
  assert.match(cleaned, /discharged in May\./);
});

test("8.5 — an answer with only invented citations keeps its words", () => {
  const { answer, refs } = keepResolvableCitations("She was discharged [D9:1].", () => false);
  assert.deepEqual(refs, []);
  assert.equal(answer, "She was discharged.");
});

test("citations are normalised on the way out", () => {
  const { answer } = keepResolvableCitations("Yes [d7 : 3].", () => true);
  assert.ok(answer.includes(formatCitation({ ordinal: 7, sequence: 3 })));
});

/* ---------------------------------------------------------------- formats -- */

test("8.2 — the cap is raised above a phone photograph of an A4 page", () => {
  // Measured reason: a phone photo of a page is routinely 4-6 MB and a
  // multi-page scan is past eight, which is where the old cap sat.
  assert.ok(MAX_DOCUMENT_BYTES > 8 * 1024 * 1024);
  assert.equal(documentProblem({ size: 9 * 1024 * 1024, type: "image/jpeg" }), null);
  assert.match(
    documentProblem({ size: MAX_DOCUMENT_BYTES + 1, type: "image/jpeg" }) ?? "",
    /over 25 MB/,
  );
});

test("8.2 — scans, PDFs, Word files and text are all accepted", () => {
  for (const type of [
    "image/jpeg",
    "image/heic",
    "image/tiff",
    "application/pdf",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "text/plain",
  ]) {
    assert.equal(documentProblem({ size: 1000, type }), null, type);
  }
  assert.notEqual(documentProblem({ size: 1000, type: "application/x-msdownload" }), null);
});

test("8.4 — an image is stored but never claimed to be searchable", () => {
  assert.equal(readabilityOf("image/png"), "stored_only");

  const label = searchabilityLabel({ extraction: "unsupported", mimeType: "image/png" });
  assert.equal(label.searchable, false);
  // The exact words §3 asks for. A clinician who believes the copilot read a
  // discharge summary will not go and read it themselves.
  assert.match(label.label, /Image — not searchable/);
});

test("8.4 — 'cannot read this format' and 'reading failed' are different screens", () => {
  const unsupported = searchabilityLabel({
    extraction: "unsupported",
    mimeType: "application/pdf",
  });
  const failed = searchabilityLabel({ extraction: "failed", mimeType: "text/plain" });
  assert.notEqual(unsupported.label, failed.label);
  assert.equal(unsupported.searchable, false);
  assert.equal(failed.searchable, false);
});

test("typed text is searchable the moment it is written", () => {
  const label = searchabilityLabel({ extraction: "none", mimeType: null });
  assert.equal(label.searchable, true);
});

/* -------------------------------------------------------------- diagnoses -- */

const passage =
  "Seen in clinic on 3 March. Impression: generalised anxiety disorder, moderate. Sleep is poor and appetite reduced.";

test("8.9 — a verbatim sentence is accepted", () => {
  assert.equal(verbatimIn("Impression: generalised anxiety disorder, moderate.", passage), true);
});

test("8.9 — reflowed whitespace is forgiven; edited words are not", () => {
  // A model that reflows a line break has not fabricated anything.
  assert.equal(
    verbatimIn("Impression: generalised   anxiety\n disorder, moderate.", passage),
    true,
  );

  // A model that "tidied" the sentence may equally have composed it.
  assert.equal(verbatimIn("Impression: Generalised Anxiety Disorder, moderate.", passage), false);
  assert.equal(verbatimIn("Impression: generalised anxiety disorder", passage), true);
});

test("🔴 8.9 — an inferred diagnosis is discarded, because its sentence is not there", () => {
  // The failure the whole mechanism exists to stop: the passage describes
  // symptoms, and the model returns "depression" with a sentence it wrote
  // itself. Not present in the source → dropped, whatever the prompt achieved.
  const symptoms = "He has been low for months, sleeping badly and eating little.";
  assert.equal(verbatimIn("The patient has depression.", symptoms), false);
  assert.equal(verbatimIn("He is depressed.", symptoms), false);
});

test("8.9 — a trivially short 'sentence' is never enough provenance", () => {
  // "the." appears in almost any passage. A matcher that accepted it would
  // accept any diagnosis at all.
  assert.equal(verbatimIn("the", passage), false);
  assert.equal(verbatimIn("Sleep", passage), false);
});

test("8.9 — refs are parsed from what a model actually writes", () => {
  assert.deepEqual(parseRef("[D7:3]"), { ordinal: 7, sequence: 3 });
  assert.deepEqual(parseRef("D7:3"), { ordinal: 7, sequence: 3 });
  assert.equal(parseRef("document seven"), null);
  assert.equal(parseRef(null), null);
});
