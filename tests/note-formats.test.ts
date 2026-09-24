import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { after, test } from "node:test";

import {
  BUILT_IN_FORMATS,
  SOAP,
  builtInFormat,
  canRedraft,
  emptyContent,
  mergeSectionText,
  noteSections,
  noteView,
  parseTemplateSections,
  resolveFormat,
  sectionsText,
  templateFormat,
} from "../lib/notes/formats";
import { startMockOpenAi } from "./mock-openai";

/*
 * The note writer is exercised through its real call, against the stand-in the
 * e2e suite uses, which records what was sent. `lib/env` reads the address
 * once, so it is set before the writer is imported, and nothing above imports it.
 */
const mock = startMockOpenAi(4331);
after(() => mock.server.close());
process.env.OPENAI_BASE_URL = "http://127.0.0.1:4331/v1";
process.env.OPENAI_API_KEY ||= "sk-mock";
const writer = () => import("../lib/ai/note-writer");
const TRANSCRIPT = "Patient: I slept badly again this week and the deadline kept me up until three.";
const systemOf = (index: number): string =>
  (JSON.parse(mock.state.chatRequests[index]!.body) as { messages: { content: string }[] })
    .messages[0]!.content;

/**
 * W2-F01 (D7), W2-T03, W2-T04: note formats as data, and the note area's state.
 *
 * The database half (a second and third format on one session, the invoice
 * lines, the lock, the patient's one copy) is `npm run verify:w2f`.
 */

const dap = builtInFormat("dap")!;

test("every format the founder named is data: a key, a label, ordered sections with a guide", () => {
  assert.deepEqual(
    BUILT_IN_FORMATS.map((f) => f.key),
    ["soap", "dap", "birp", "girp", "pie", "sirp", "narrative"],
  );
  for (const format of BUILT_IN_FORMATS) {
    assert.ok(format.label.length > 0, format.key);
    assert.ok(format.sections.length > 0, format.key);
    for (const section of format.sections) {
      assert.match(section.key, /^[a-z]+$/, `${format.key}.${section.key}`);
      assert.ok(section.label.length > 0 && section.guide.length > 10, `${format.key}.${section.key}`);
    }
  }
  assert.deepEqual(
    SOAP.sections.map((s) => s.key),
    ["subjective", "objective", "assessment", "plan"],
  );
});

test("a clinician's own template is a format like the rest, with no code", () => {
  const sections = parseTemplateSections("Presenting issue: what they came with\n\nWork done: what we did\nNext");
  assert.deepEqual(sections, [
    { key: "s1", label: "Presenting issue", guide: "what they came with" },
    { key: "s2", label: "Work done", guide: "what we did" },
    { key: "s3", label: "Next", guide: "" },
  ]);
  const id = "00000000-0000-4000-8000-000000000001";
  const format = templateFormat({ id, label: "Mine", sections });
  assert.equal(format.key, `tpl:${id}`);
  assert.equal(resolveFormat(format.key, [{ id, label: "Mine", sections }]).label, "Mine");
  // A template that has gone (deleted, or someone else's) is SOAP, never an error.
  assert.equal(resolveFormat(format.key, []).key, "soap");
  assert.equal(resolveFormat("nonsense").key, "soap");
});

test("an existing SOAP note reads exactly as it did: its four fields, from `soap`", () => {
  const legacy = {
    ...emptyContent(SOAP),
    soap: { subjective: "S text", objective: "O text", assessment: "A text", plan: "P text" },
  };
  assert.equal(legacy.sections, undefined, "a SOAP note stores no sections");
  assert.deepEqual(
    noteSections(legacy).map((s) => [s.label, s.text]),
    [
      ["Subjective", "S text"],
      ["Objective", "O text"],
      ["Assessment", "A text"],
      ["Plan", "P text"],
    ],
  );
});

test("the SOAP prompt is the one that ships today; another format swaps the schema and names each guide", async () => {
  const { noteFromTranscript } = await writer();
  const before = mock.state.chatRequests.length;
  const plain = await noteFromTranscript({ context: "", transcript: TRANSCRIPT });
  await noteFromTranscript({ context: "", transcript: TRANSCRIPT, format: SOAP });
  const drafted = await noteFromTranscript({ context: "", transcript: TRANSCRIPT, format: dap });

  const soap = systemOf(before);
  assert.match(soap, /"soap": \{ "subjective": string, "objective": string, "assessment": string, "plan": string \}/);
  assert.doesNotMatch(soap, /"sections"|NOTE FORMAT/);
  assert.equal(systemOf(before + 1), soap, "SOAP asked for by name is the same prompt, byte for byte");
  assert.ok(plain.content.soap.subjective.length > 0);
  assert.equal(plain.content.sections, undefined);

  const prompt = systemOf(before + 2);
  assert.match(prompt, /"sections": \{ "data": string, "assessment": string, "plan": string \}/);
  assert.doesNotMatch(prompt, /"soap":/);
  for (const section of dap.sections) assert.ok(prompt.includes(section.guide), section.key);
  // H2: the overriding rule and the format both come before the schema.
  const schemaAt = prompt.indexOf("Respond with a single JSON object");
  assert.ok(prompt.indexOf("RULE THAT OVERRIDES EVERYTHING BELOW") < schemaAt);
  assert.ok(prompt.indexOf("NOTE FORMAT") < schemaAt);
  // Same language rule for every format.
  assert.match(prompt, /Write the note in the language the session was conducted in/);
  // And what came back is in DAP's sections, in order.
  assert.deepEqual(
    drafted.content.sections?.map((s) => [s.key, s.text.length > 0]),
    [
      ["data", true],
      ["assessment", true],
      ["plan", true],
    ],
  );
});

test("a drafted note in another format lands in its sections, in order, whatever shape came back", async () => {
  const { normaliseNote } = await writer();
  const note = normaliseNote(
    { sections: { plan: " next week ", data: "said and seen", extra: "dropped" }, summary: "s" },
    dap,
  );
  assert.deepEqual(note.sections, [
    { key: "data", label: "Data", text: "said and seen" },
    { key: "assessment", label: "Assessment", text: "" },
    { key: "plan", label: "Plan", text: "next week" },
  ]);
  assert.deepEqual(note.soap, { subjective: "", objective: "", assessment: "", plan: "" });

  // A translation comes back as the array it was sent: the text is taken, the headings are ours.
  const translated = normaliseNote(
    { sections: [{ key: "data", label: "بيانات", text: "translated" }] },
    dap,
  );
  assert.equal(translated.sections?.[0]?.label, "Data");
  assert.equal(translated.sections?.[0]?.text, "translated");

  // SOAP is untouched by the new parameter.
  const soap = normaliseNote({ soap: { subjective: "x" } });
  assert.equal(soap.soap.subjective, "x");
  assert.equal(soap.sections, undefined);
});

test("the chart text, the partner draft and the filing read any format", () => {
  const note = { ...emptyContent(dap), sections: [
    { key: "data", label: "Data", text: "D" },
    { key: "assessment", label: "Assessment", text: "" },
    { key: "plan", label: "Plan", text: "P" },
  ] };
  assert.equal(sectionsText(note), "Data\nD\n\nPlan\nP");
  // An edit changes text, never the headings or the format.
  const merged = mergeSectionText(note.sections!, [{ key: "data", label: "Hacked", text: "D2" }, { key: "x", text: "no" }]);
  assert.deepEqual(merged.map((s) => [s.key, s.label, s.text]), [
    ["data", "Data", "D2"],
    ["assessment", "Assessment", ""],
    ["plan", "Plan", "P"],
  ]);
});

test("W2-F01 the invoice is priced from consent and tier alone: no note format reaches it", () => {
  // The DB half (lines identical after a second and third format) is verify:w2f.
  const source = readFileSync("lib/billing/plans.ts", "utf8");
  const start = source.indexOf("export function sessionLines(");
  const signature = source.slice(start, source.indexOf("{ lines: SessionLine[]", start));
  assert.ok(start >= 0, "sessionLines is where the invoice lines come from");
  assert.doesNotMatch(signature, /note|format/i);
});

/* ---------------------------------------------------------------- W2-T03 -- */

const now = new Date("2026-09-24T12:00:00Z");
const minutesAgo = (m: number) => new Date(now.getTime() - m * 60_000);

test("W2-T03 a cancelled session never says it is writing a note", () => {
  assert.equal(
    noteView({ sessionStatus: "cancelled", noteStatus: "none", hasNote: false, updatedAt: minutesAgo(1), now }),
    "none",
  );
});

test("W2-T03 a job that died stops spinning and offers a way forward", () => {
  assert.equal(
    noteView({ sessionStatus: "completed", noteStatus: "generating", hasNote: false, updatedAt: minutesAgo(40), now }),
    "failed",
  );
  assert.equal(
    noteView({ sessionStatus: "completed", noteStatus: "generating", hasNote: false, updatedAt: minutesAgo(1), now }),
    "writing",
  );
  // A completed session nothing is writing for is a way forward too, never a spinner.
  assert.equal(
    noteView({ sessionStatus: "completed", noteStatus: "none", hasNote: false, updatedAt: minutesAgo(1), now }),
    "failed",
  );
  // A redraft that failed leaves the note it had on screen.
  assert.equal(
    noteView({ sessionStatus: "completed", noteStatus: "failed", hasNote: true, updatedAt: minutesAgo(1), now }),
    "note",
  );
});

test("W2-T03 the session page decides from `noteView`, not the old condition", () => {
  const review = readFileSync("components/session/note-review.tsx", "utf8");
  assert.doesNotMatch(review, /!note && props\.noteStatus !== "failed"/);
  assert.match(review, /props\.view === "writing"/);
});

/* ---------------------------------------------------------------- W2-T04 -- */

test("W2-T04 a draft can be written again from the transcript after corrections", () => {
  assert.equal(canRedraft({ status: "draft", recordingConsent: "granted", hasTranscript: true }), true);
  assert.equal(canRedraft({ status: "approved", recordingConsent: "granted", hasTranscript: true }), false);
  assert.equal(canRedraft({ status: "draft", recordingConsent: "declined", hasTranscript: true }), false);
  assert.equal(canRedraft({ status: "draft", recordingConsent: "granted", hasTranscript: false }), false);

  const review = readFileSync("components/session/note-review.tsx", "utf8");
  assert.match(review, /props\.canRedraft/, "the editor offers it on a draft, not only after a failure");
});
