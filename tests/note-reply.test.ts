import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

/*
 * DD-2: a bad or truncated model reply is a failed note, never an empty
 * draft marked ready. Stubbed replies, no model and no database.
 */
process.env.OPENAI_API_KEY ||= "sk-mock";
const writer = () => import("../lib/ai/note-writer");

const GOOD = {
  language: "en",
  soap: {
    subjective: "The patient described poor sleep for two weeks before a work deadline.",
    objective: "Engaged and reflective throughout.",
    assessment: "Sleep disruption linked to work stress.",
    plan: "Keep a sleep diary until the next session.",
  },
  summary: "A session about sleep and a deadline.",
};
const reply = (finish: string | null, content: unknown) => ({
  finish_reason: finish,
  message: { content: typeof content === "string" ? content : JSON.stringify(content) },
});

test("a reply that finished normally is read", async () => {
  const { readNoteReply, normaliseNote, assertNoteUsable } = await writer();
  const raw = readNoteReply(reply("stop", GOOD), "test");
  assert.doesNotThrow(() => assertNoteUsable(normaliseNote(raw)));
});

test("a reply cut off at the token limit or stopped by the filter is refused", async () => {
  const { readNoteReply, UnusableNoteError } = await writer();
  for (const finish of ["length", "content_filter"]) {
    assert.throws(
      () => readNoteReply(reply(finish, GOOD), "test"),
      (error: unknown) => error instanceof UnusableNoteError && error.reason === finish,
      finish,
    );
  }
});

test("an empty, unparseable or non-object reply is refused, not turned into an empty draft", async () => {
  const { readNoteReply, UnusableNoteError } = await writer();
  const cases: [unknown, string][] = [
    [undefined, "empty"],
    [reply("stop", ""), "empty"],
    [reply("stop", '{"soap": {"subjective": "The pat'), "unparseable"],
    [reply("stop", "[1,2]"), "not_object"],
  ];
  for (const [choice, reason] of cases) {
    assert.throws(
      () => readNoteReply(choice as Parameters<typeof readNoteReply>[0], "test"),
      (error: unknown) => error instanceof UnusableNoteError && error.reason === reason,
      reason,
    );
  }
});

test("an empty or near-empty note is refused", async () => {
  const { normaliseNote, assertNoteUsable, UnusableNoteError } = await writer();
  assert.throws(
    () => assertNoteUsable(normaliseNote({})),
    (error: unknown) => error instanceof UnusableNoteError && error.reason === "empty",
  );
  assert.throws(
    () => assertNoteUsable(normaliseNote({ soap: { subjective: "Tired." }, summary: "Short." })),
    (error: unknown) => error instanceof UnusableNoteError && error.reason === "too_short",
  );
  /* Only the patient's copy filled is still not a clinical note. */
  assert.throws(() => assertNoteUsable(normaliseNote({ patientBrief: "x".repeat(400) })), UnusableNoteError);
});

test("the writer checks before it returns, and a failure marks the session's note failed", () => {
  const source = readFileSync("lib/ai/note-writer.ts", "utf8");
  assert.match(source, /readNoteReply\(completion\.choices\[0\], "note-generation"\)/);
  assert.match(source, /assertNoteUsable\(normalised\)/);
  const notes = readFileSync("lib/ai/notes.ts", "utf8");
  assert.match(notes, /noteStatus: "failed"/, "a throw from the writer lands in the failed state");
  assert.match(notes, /readNoteReply\(completion\.choices\[0\], "note-translation"\)/);
});

test("a translation is shown only while it matches the note it was made from", () => {
  const fresh = readFileSync("lib/notes/fresh-translation.ts", "utf8");
  assert.match(fresh, /content_en_source|contentEnSource/);
  assert.match(fresh, /md5\(\$\{sessionNotes\.content\}::text\)/);
  for (const file of ["lib/data/export.ts", "lib/data/sessions.ts"]) {
    const source = readFileSync(file, "utf8");
    assert.doesNotMatch(source, /:\s*sessionNotes\.contentEn\b/, `${file} reads content_en directly`);
    assert.match(source, /FRESH_CONTENT_EN/, file);
  }
  const actions = readFileSync("app/(app)/sessions/actions.ts", "utf8");
  assert.match(actions, /after\(\(\) => refreshSessionTranslations\(sessionId\)\)/, "signing writes the translation again");
});
