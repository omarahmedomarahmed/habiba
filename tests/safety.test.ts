import assert from "node:assert/strict";
import { test } from "node:test";

import { __costing } from "../lib/ai/client";
import { patientFacingCrisisMessage, scanForCrisisLanguage } from "../lib/ai/crisis";
import { resolveCitations } from "../lib/ai/patient-copilot";
import { isNoteEmpty, normaliseNote } from "../lib/ai/notes";
import { cleanTranscript } from "../lib/ai/transcribe";
import { hashPassword, validatePassword, verifyPassword } from "../lib/auth/password";
import { priceProblem } from "../lib/billing/connect";
import { quoteForQuantity, tierByKey, tierForQuantity } from "../lib/billing/plans";
import {
  parseGroup,
  platformFeeOn,
  sessionMoney,
  SETTINGS_DEFAULTS,
  settingsProblem,
  vatOn,
} from "../lib/settings/defs";
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

const TIERS = SETTINGS_DEFAULTS.pricing.tiers;
const BOUNDS = SETTINGS_DEFAULTS.session;

test("the seeded schedule is the one §3 asks for", () => {
  assert.deepEqual(
    TIERS.map((t) => [t.key, t.rateCents, t.minimumSessions]),
    [
      ["payg", 400, 0],
      ["starter", 300, 10],
      ["growth", 200, 30],
    ],
  );
  assert.equal(BOUNDS.platformFeeBps, 1500, "the platform cut is 15%");
  assert.equal(BOUNDS.maxPriceCents, 50_000, "the price cap is $500");
  assert.equal(settingsProblem(SETTINGS_DEFAULTS), null);
});

test("a quantity gets the best rate its size has earned, and never a better one", () => {
  assert.equal(tierForQuantity(TIERS, 0).key, "payg");
  assert.equal(tierForQuantity(TIERS, 9).key, "payg");
  assert.equal(tierForQuantity(TIERS, 10).key, "starter");
  assert.equal(tierForQuantity(TIERS, 29).key, "starter");
  assert.equal(tierForQuantity(TIERS, 30).key, "growth");
  // Above a minimum they buy as many as they like at the same rate — a slider,
  // not a fixed pack.
  assert.equal(tierForQuantity(TIERS, 500).key, "growth");
});

test("an unknown tier key fails closed to the most expensive rate", () => {
  // The mirror of the old "unknown plan must not grant unlimited": a typo in a
  // stored key must never hand somebody the cheapest rate.
  assert.equal(tierByKey(TIERS, "enterprise").key, "payg");
  assert.equal(tierByKey(TIERS, null).key, "payg");
  assert.equal(tierByKey(TIERS, undefined).key, "payg");
  assert.equal(tierByKey(TIERS, "growth").key, "growth");
});

test("a quote is the tier rate times the quantity, and refuses nonsense", () => {
  assert.equal(quoteForQuantity(TIERS, 10).totalCents, 3000);
  assert.equal(quoteForQuantity(TIERS, 30).totalCents, 6000);
  assert.equal(quoteForQuantity(TIERS, 1).totalCents, 400);
  assert.equal(quoteForQuantity(TIERS, 0).totalCents, 0);
  assert.equal(quoteForQuantity(TIERS, -5).quantity, 0);
  assert.equal(quoteForQuantity(TIERS, 10.7).quantity, 10, "a fraction of a session is not a thing");
});

/* ------------------------------------------------------- settings integrity */

/**
 * The fallback exists so that a missing or mangled row degrades to a known
 * price rather than to `undefined` — which in a billing path is a charge of
 * `NaN` cents and in a cap is no cap at all.
 */
test("a corrupt settings row falls back field by field, not group by group", () => {
  const parsed = parseGroup("session", {
    platformFeeBps: "fifteen percent",
    minPriceCents: 250,
    maxPriceCents: 1e21,
  });
  assert.equal(parsed.platformFeeBps, BOUNDS.platformFeeBps, "a bad field falls back");
  assert.equal(parsed.minPriceCents, 250, "a good field beside it survives");
  assert.equal(parsed.maxPriceCents, BOUNDS.maxPriceCents, "an out-of-range field falls back");
});

test("settings that cannot be true are refused rather than applied", () => {
  const inverted = { ...SETTINGS_DEFAULTS, session: { ...BOUNDS, maxPriceCents: 100 } };
  assert.ok(settingsProblem(inverted), "a cap below the floor makes every price invalid");

  const noBase = {
    ...SETTINGS_DEFAULTS,
    pricing: { ...SETTINGS_DEFAULTS.pricing, tiers: TIERS.filter((t) => t.minimumSessions > 0) },
  };
  assert.ok(settingsProblem(noBase), "somebody who has bought nothing must still have a rate");
});

test("a fee of the whole payment is not a configuration", () => {
  // 9_000 bps is the ceiling. Above it the therapist receives nothing, which is
  // a bug wearing a settings row.
  assert.equal(parseGroup("session", { platformFeeBps: 10_000 }).platformFeeBps, BOUNDS.platformFeeBps);
  assert.equal(parseGroup("session", { platformFeeBps: 9_000 }).platformFeeBps, 9_000);
});

test("an empty or unusable tier list falls back rather than leaving nobody a rate", () => {
  assert.deepEqual(parseGroup("pricing", { tiers: [] }).tiers, TIERS);
  assert.deepEqual(parseGroup("pricing", { tiers: [{ name: "no key" }] }).tiers, TIERS);
  assert.deepEqual(parseGroup("pricing", { tiers: "growth" }).tiers, TIERS);
});

/* --------------------------------------------------------- connect payouts */

test("the platform cut is rounded in the therapist's favour and never exceeds the gross", () => {
  const bps = BOUNDS.platformFeeBps;
  // 15% of $60.05 is 900.75 cents; the therapist must not be short the fraction.
  assert.equal(platformFeeOn(6005, bps), 900);

  for (const gross of [0, 1, 499, 500, 6000, 12_345, 50_000]) {
    const fee = platformFeeOn(gross, bps);
    assert.ok(fee >= 0 && fee <= gross, `fee out of range for ${gross}`);
    const money = sessionMoney({ grossCents: gross, feeBps: bps, vatBps: 0 });
    assert.equal(
      money.platformCutCents + money.therapistNetCents,
      gross,
      `cut + net must equal gross for ${gross}`,
    );
  }
});

test("a negative or nonsense gross cannot produce a negative fee", () => {
  assert.equal(platformFeeOn(-5000, BOUNDS.platformFeeBps), 0);
  assert.equal(sessionMoney({ grossCents: -5000, feeBps: 1500, vatBps: 1400 }).therapistNetCents, 0);
  assert.equal(sessionMoney({ grossCents: -5000, feeBps: 1500, vatBps: 1400 }).vatCents, 0);
});

/**
 * §3's worked example, as a test.
 *
 * A $30 session in Egypt: the patient pays $34.20, of which $4.20 is VAT; our
 * cut is $4.50 and $25.50 reaches the therapist. The two roundings deliberately
 * go opposite ways — VAT up toward the authority, our fee down toward the
 * clinician — so both errors are at most a cent and both land on us.
 */
test("the worked example in §3 comes out to the cent", () => {
  const money = sessionMoney({ grossCents: 3000, feeBps: 1500, vatBps: 1400 });
  assert.equal(money.vatCents, 420);
  assert.equal(money.patientTotalCents, 3420);
  assert.equal(money.platformCutCents, 450);
  assert.equal(money.therapistNetCents, 2550);
});

test("VAT is charged on top of the price, never taken out of it", () => {
  // The distinction that decides who is out of pocket. The therapist's net is
  // the same whether or not the patient's country charges VAT.
  const noVat = sessionMoney({ grossCents: 3000, feeBps: 1500, vatBps: 0 });
  const egypt = sessionMoney({ grossCents: 3000, feeBps: 1500, vatBps: 1400 });
  assert.equal(noVat.therapistNetCents, egypt.therapistNetCents);
  assert.equal(noVat.platformCutCents, egypt.platformCutCents);
  assert.equal(egypt.patientTotalCents - noVat.patientTotalCents, egypt.vatCents);
});

test("a country with no VAT rate charges no VAT", () => {
  assert.equal(vatOn(3000, 0), 0);
  assert.equal(vatOn(0, 1400), 0);
});

/**
 * The price is the one number a patient sees before their card is charged, so
 * the rules around it are worth pinning down. Zero is allowed — most sessions
 * are free to join because the money changes hands outside the product.
 */
test("session pricing accepts free and refuses amounts we cannot process", () => {
  assert.equal(priceProblem(0, BOUNDS), null);
  assert.equal(priceProblem(6000, BOUNDS), null);
  assert.equal(priceProblem(BOUNDS.minPriceCents, BOUNDS), null);
  assert.equal(priceProblem(BOUNDS.maxPriceCents, BOUNDS), null);

  assert.ok(priceProblem(1, BOUNDS));
  assert.ok(priceProblem(BOUNDS.minPriceCents - 1, BOUNDS));
  assert.ok(priceProblem(BOUNDS.maxPriceCents + 1, BOUNDS));
  assert.ok(priceProblem(12.5, BOUNDS));
  assert.ok(priceProblem(Number.NaN, BOUNDS));
});

test("the price cap is enforced against the settings, not a constant", () => {
  // H4: the old cap was $1,000 and the new one is $500. A price that was legal
  // last week must be refused now, and the check must follow the settings if an
  // admin moves them again.
  assert.ok(priceProblem(60_000, BOUNDS), "$600 is above the $500 cap");
  const raised = { minPriceCents: 500, maxPriceCents: 100_000 };
  assert.equal(priceProblem(60_000, raised), null, "and legal again if an admin raises the cap");
});

/* ------------------------------------------------------------- model costs */

/**
 * H12: the transcribe branch costed every call at a hardcoded rate and ignored
 * `input.model`. These tests exist so that a second provider cannot be added
 * without the ledger noticing.
 */
test("a transcription is costed at the rate of the model that actually ran", () => {
  const { estimateCostMicrocents } = __costing;
  const sixtySeconds = { kind: "transcribe" as const, audioSeconds: 60 };

  const mini = estimateCostMicrocents({ ...sixtySeconds, model: "gpt-4o-mini-transcribe" });
  const whisper = estimateCostMicrocents({ ...sixtySeconds, model: "whisper-1" });

  assert.equal(mini, 300, "0.3 cents a minute, in thousandths of a cent");
  assert.notEqual(mini, whisper, "two rates must not collapse into one");
  assert.equal(whisper, 600);
});

test("an unpriced model overstates rather than understates", () => {
  const { estimateCostMicrocents, AUDIO_RATES, TOKEN_RATES } = __costing;

  const unknownAudio = estimateCostMicrocents({
    kind: "transcribe",
    model: "some-future-model",
    audioSeconds: 60,
  });
  const dearestAudio = Math.max(...Object.values(AUDIO_RATES).map((r) => r.perAudioMinute));
  assert.equal(unknownAudio, Math.round(dearestAudio * 1000));
  assert.ok(unknownAudio > 0, "an unpriced model must never be recorded as free");

  const unknownTokens = estimateCostMicrocents({
    kind: "note",
    model: "some-future-model",
    inputTokens: 1_000_000,
    outputTokens: 0,
  });
  const dearestIn = Math.max(...Object.values(TOKEN_RATES).map((r) => r.inPerMTok));
  assert.equal(unknownTokens, dearestIn * 1000);
});

test("cost is in thousandths of a cent, per H13", () => {
  const { estimateCostMicrocents } = __costing;
  // $1 is 100_000 units. One million gpt-4o input tokens is 250 cents.
  const cost = estimateCostMicrocents({
    kind: "note",
    model: "gpt-4o",
    inputTokens: 1_000_000,
    outputTokens: 0,
  });
  assert.equal(cost, 250_000, "divide by 1e5 for dollars, not 1e8");
  assert.equal(cost / 1e5, 2.5);
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

/**
 * The error recorder's scrubbing.
 *
 * These assertions are the security page's claim, written down as code. It
 * tells readers that identifiers are removed from paths before an error is
 * stored — and the previous version of that page described a reporter that did
 * not exist at all, so the claim deserves a test rather than another promise.
 *
 * The threat is mundane and therefore likely: an admin exports the error table
 * to send to somebody, or leaves it open on a shared screen. Anything that
 * survives scrubbing survives into that moment.
 */
test("identifiers never reach the error log", async () => {
  const { scrubPath } = await import("../lib/observability/errors");

  assert.equal(
    scrubPath("/sessions/58b00bbe-b591-4da1-8b4e-aac8c4a7af99/room"),
    "/sessions/[id]/room",
    "a session uuid in a path is a chart anyone can look up",
  );

  assert.equal(
    scrubPath("/join/UyoBFkMyf8SELXgyyN1g0TAonuCqtTM6"),
    "/join/[token]",
    "a join token is a live credential — it lets the holder into the room",
  );

  assert.equal(
    scrubPath("/records/abc123XYZ_tokenvalue-here999"),
    "/records/[token]",
    "an export token opens a whole medical record",
  );

  assert.equal(scrubPath("/invoices/4821"), "/invoices/[n]");

  // And the routes that carry nothing sensitive must stay legible, or the
  // list becomes a wall of placeholders nobody can debug from.
  assert.equal(scrubPath("/api/cron/crisis"), "/api/cron/crisis");
  assert.equal(scrubPath("/admin/radar"), "/admin/radar");
  assert.equal(scrubPath("/"), "/");
});
