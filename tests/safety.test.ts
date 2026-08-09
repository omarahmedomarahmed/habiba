import assert from "node:assert/strict";
import { test } from "node:test";

import { patientFacingCrisisMessage, scanForCrisisLanguage } from "../lib/ai/crisis";
import { isNoteEmpty, normaliseNote } from "../lib/ai/notes";
import { cleanTranscript } from "../lib/ai/transcribe";
import { hashPassword, validatePassword, verifyPassword } from "../lib/auth/password";
import { getPlan, PLANS } from "../lib/billing/plans";
import { inspectEnv } from "../lib/env";
import { log, ref } from "../lib/logger";

/* ------------------------------------------------------------ crisis safety */

test("crisis scan matches risk language regardless of case and surrounding text", () => {
  assert.deepEqual(scanForCrisisLanguage("I want to die"), ["want to die"]);
  assert.deepEqual(scanForCrisisLanguage("I WANT TO DIE."), ["want to die"]);
  assert.ok(scanForCrisisLanguage("sometimes I think about killing myself").length > 0);
  assert.ok(scanForCrisisLanguage("I've been self-harming again").length > 0);
});

test("crisis scan does not fire on ordinary clinical talk", () => {
  assert.deepEqual(scanForCrisisLanguage("I've been feeling low but I'm managing"), []);
  assert.deepEqual(scanForCrisisLanguage("Work has been killing my motivation"), []);
  assert.deepEqual(scanForCrisisLanguage(""), []);
});

/**
 * Product safety invariant: a patient on a join link is never told their risk
 * level or which words triggered an alert. This test exists so the payload
 * cannot quietly grow a `level` or `indicators` field later.
 */
test("patient-facing crisis message exposes no clinical detail", () => {
  const message = patientFacingCrisisMessage();

  assert.deepEqual(Object.keys(message).sort(), ["helpline", "message"]);
  assert.equal(message.helpline, "988");

  const serialised = JSON.stringify(message).toLowerCase();
  for (const forbidden of ["risk", "level", "indicator", "critical", "high", "assessment"]) {
    assert.ok(
      !serialised.includes(forbidden),
      `patient message must not mention "${forbidden}"`,
    );
  }
});

/* ------------------------------------------------------------ note handling */

test("note normalisation survives a model returning the wrong shapes", () => {
  const note = normaliseNote({
    soap: { subjective: "  Reported low mood  ", assessment: 42 as unknown as string },
    // Model returned a string where an array was requested.
    talkingPoints: "Sleep" as unknown as string[],
    recommendations: null as unknown as string[],
    summary: "  A summary  ",
  });

  assert.equal(note.soap.subjective, "Reported low mood");
  assert.equal(note.soap.assessment, "");
  assert.equal(note.soap.plan, "");
  assert.deepEqual(note.talkingPoints, ["Sleep"]);
  assert.deepEqual(note.recommendations, []);
  assert.equal(note.summary, "A summary");
});

test("an entirely empty model response is detected rather than stored as a note", () => {
  assert.equal(isNoteEmpty(normaliseNote({})), true);
  assert.equal(isNoteEmpty(normaliseNote({ summary: "Something happened" })), false);
});

test("stock transcription artefacts are dropped", () => {
  assert.equal(cleanTranscript("Thank you."), "");
  assert.equal(cleanTranscript("  [silence] "), "");
  assert.equal(cleanTranscript("Thanks for watching!"), "");
  assert.equal(cleanTranscript("I slept badly."), "I slept badly.");
});

/* -------------------------------------------------------------------- auth */

test("passwords hash and verify, and a wrong password fails", async () => {
  const hash = await hashPassword("correct horse battery");
  assert.ok(hash.startsWith("scrypt$"));
  assert.equal(await verifyPassword("correct horse battery", hash), true);
  assert.equal(await verifyPassword("wrong horse battery", hash), false);
});

test("password verification fails closed on a malformed stored value", async () => {
  assert.equal(await verifyPassword("anything", ""), false);
  assert.equal(await verifyPassword("anything", "bcrypt$12$whatever"), false);
  assert.equal(await verifyPassword("anything", "scrypt$notanumber$8$1$aa$bb"), false);
});

test("password policy rejects short and whitespace-padded values", () => {
  assert.ok(validatePassword("short"));
  assert.ok(validatePassword(" leadingspace123"));
  assert.equal(validatePassword("a-perfectly-fine-password"), null);
});

/* ---------------------------------------------------------------- env guard */

test("production env guard rejects missing and weak secrets", () => {
  const problems = inspectEnv({
    NODE_ENV: "production",
    DATABASE_URL: "postgres://x",
    OPENAI_API_KEY: "sk-x",
    STRIPE_WEBHOOK_SECRET: "whsec_x",
    APP_URL: "https://x",
    AUTH_SECRET: "change-me-in-production",
  } as NodeJS.ProcessEnv);

  assert.ok(problems.some((p) => p.level === "error" && /placeholder/i.test(p.message)));
});

test("production env guard rejects a short secret and accepts a strong one", () => {
  const base = {
    NODE_ENV: "production",
    DATABASE_URL: "postgres://x",
    OPENAI_API_KEY: "sk-x",
    STRIPE_WEBHOOK_SECRET: "whsec_x",
    APP_URL: "https://x",
  };

  assert.ok(
    inspectEnv({ ...base, AUTH_SECRET: "tooshort" } as NodeJS.ProcessEnv).some(
      (p) => p.level === "error",
    ),
  );
  assert.equal(
    inspectEnv({ ...base, AUTH_SECRET: "a".repeat(48) } as NodeJS.ProcessEnv).filter(
      (p) => p.level === "error",
    ).length,
    0,
  );
});

test("development is not gated by the production requirements", () => {
  assert.equal(inspectEnv({ NODE_ENV: "development" } as NodeJS.ProcessEnv).length, 0);
});

/* ------------------------------------------------------------------ billing */

test("an unknown plan key fails closed to the metered plan", () => {
  assert.equal(getPlan("enterprise").key, "payg");
  assert.equal(getPlan(null).key, "payg");
  assert.equal(getPlan(undefined).key, "payg");
  assert.equal(getPlan("unlimited").key, "unlimited");
});

/**
 * A BAA is a legal obligation the moment we process a customer's patient data,
 * so it cannot be a paid tier. This test stops it being turned into one.
 */
test("every plan advertises a HIPAA BAA", () => {
  for (const plan of Object.values(PLANS)) {
    assert.ok(
      plan.features.some((f) => /HIPAA BAA/i.test(f)),
      `${plan.key} must include a BAA`,
    );
  }
});

/* ------------------------------------------------------------------ logging */

test("identifier references are truncated, never full identifiers", () => {
  const id = "d9832fbd-da84-46cd-a23a-7aab8dfeac4c";
  assert.equal(ref(id), "d9832fbd…");
  assert.ok(!ref(id).includes("7aab8dfeac4c"));
  assert.equal(ref(null), "none");
});

test("log output scrubs any identifier that slips into a message", () => {
  const captured: string[] = [];
  const original = console.warn;
  console.warn = (line: string) => captured.push(line);
  try {
    log.warn("touched session d9832fbd-da84-46cd-a23a-7aab8dfeac4c");
  } finally {
    console.warn = original;
  }

  assert.equal(captured.length, 1);
  assert.ok(!captured[0]!.includes("d9832fbd-da84-46cd-a23a-7aab8dfeac4c"));
  assert.ok(captured[0]!.includes("d9832fbd…"));
});
