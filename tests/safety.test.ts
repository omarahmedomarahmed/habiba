import assert from "node:assert/strict";
import { test } from "node:test";

import { patientFacingCrisisMessage, scanForCrisisLanguage } from "../lib/ai/crisis";
import { resolveCitations } from "../lib/ai/patient-copilot";
import { isNoteEmpty, normaliseNote } from "../lib/ai/notes";
import { cleanTranscript } from "../lib/ai/transcribe";
import { hashPassword, validatePassword, verifyPassword } from "../lib/auth/password";
import {
  MAX_SESSION_PRICE_CENTS,
  MIN_SESSION_PRICE_CENTS,
  platformFee,
  priceProblem,
  therapistNet,
} from "../lib/billing/connect";
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

test("crisis scan covers the phrasings patients actually use", () => {
  // Each of these was reported from a real session or is a near neighbour of
  // one. "harm myself" in particular was missing while "hurt myself" was not.
  for (const phrase of [
    "sometimes I want to harm myself",
    "I have been harming myself",
    "it is not worth living",
    "I just want to end it all",
    "I want it to end",
  ]) {
    assert.ok(scanForCrisisLanguage(phrase).length > 0, `should match: "${phrase}"`);
  }
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

/* --------------------------------------------------------- connect payouts */

test("the platform cut is rounded in the therapist's favour and never exceeds the gross", () => {
  // 10% of $60.05 is 600.5 cents; the therapist must not be short the half cent.
  assert.equal(platformFee(6005), 600);
  assert.equal(platformFee(6005) + therapistNet(6005), 6005);

  for (const gross of [0, 1, 499, 500, 6000, 12_345, 100_000]) {
    const fee = platformFee(gross);
    assert.ok(fee >= 0 && fee <= gross, `fee out of range for ${gross}`);
    assert.equal(fee + therapistNet(gross), gross, `fee + net must equal gross for ${gross}`);
  }
});

test("a negative or nonsense gross cannot produce a negative fee", () => {
  assert.equal(platformFee(-5000), 0);
  assert.equal(therapistNet(-5000), 0);
});

/**
 * The price is the one number a patient sees before their card is charged, so
 * the rules around it are worth pinning down. Zero is allowed — most sessions
 * are free to join because the money changes hands outside the product.
 */
test("session pricing accepts free and refuses amounts Stripe cannot process", () => {
  assert.equal(priceProblem(0), null);
  assert.equal(priceProblem(6000), null);
  assert.equal(priceProblem(MIN_SESSION_PRICE_CENTS), null);

  assert.ok(priceProblem(1));
  assert.ok(priceProblem(MIN_SESSION_PRICE_CENTS - 1));
  assert.ok(priceProblem(MAX_SESSION_PRICE_CENTS + 1));
  assert.ok(priceProblem(12.5));
  assert.ok(priceProblem(Number.NaN));
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


/* ------------------------------------------------------- copilot citations */

/**
 * The product promise is that every copilot claim traces to a real transcript
 * line. That only holds if a reference the model invented is discarded rather
 * than displayed, so this is the test that keeps the promise honest.
 */
test("a citation the model invented is dropped, not shown", () => {
  const index = new Map<string, never>([
    [
      "S1:4",
      {
        refKey: "S1:4",
        sessionId: "11111111-1111-1111-1111-111111111111",
        sessionDate: new Date("2026-01-05T10:00:00Z"),
        sequence: 4,
        speaker: "patient",
        text: "I have not been sleeping.",
        startMs: 32_000,
      },
    ],
  ] as never);

  const resolved = resolveCitations(
    [
      { ref: "S1:4", why: "reported insomnia" },
      { ref: "S9:99", why: "a session that does not exist" },
      { ref: "not-a-ref", why: "nonsense" },
    ],
    index,
  );

  assert.equal(resolved.length, 1, "only the resolvable reference survives");
  assert.equal(resolved[0]!.sequence, 4);
  assert.equal(resolved[0]!.speaker, "patient");
  assert.equal(resolved[0]!.quote, "I have not been sleeping.");
  assert.equal(resolved[0]!.atSeconds, 32);
});

test("citations are de-duplicated and a non-array is handled", () => {
  const index = new Map<string, never>([
    [
      "S1:1",
      {
        refKey: "S1:1",
        sessionId: "22222222-2222-2222-2222-222222222222",
        sessionDate: new Date("2026-02-01T10:00:00Z"),
        sequence: 1,
        speaker: "therapist",
        text: "How was the week?",
        startMs: 0,
      },
    ],
  ] as never);

  assert.equal(resolveCitations([{ ref: "S1:1" }, { ref: "s1:1" }], index).length, 1);
  assert.deepEqual(resolveCitations(null, index), []);
  assert.deepEqual(resolveCitations("S1:1", index), []);
});
