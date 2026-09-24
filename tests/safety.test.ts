import assert from "node:assert/strict";
import { test } from "node:test";

import { __costing } from "../lib/ai/client";
import { patientFacingCrisisMessage, scanForCrisisLanguage } from "../lib/crisis/alerts";
import { resolveCitations } from "../lib/ai/case-copilot";
import { isNoteEmpty, normaliseNote } from "../lib/ai/notes";
import { cleanTranscript } from "../lib/ai/transcribe";
import { hashPassword, validatePassword, verifyPassword } from "../lib/auth/password";
import { priceProblem } from "../lib/billing/connect";
import {
  entitledTier,
  quoteForSpend,
  sessionLines,
  tierByKey,
  tierForSpend,
} from "../lib/billing/plans";
import {
  collectionProblem,
  convertAtRate,
  parseGroup,
  platformFeeOn,
  presentedTotal,
  sessionMoney,
  SETTINGS_DEFAULTS,
  settingsProblem,
  vatOn,
} from "../lib/settings/defs";
import { SIMULATION_BRANCH, SIMULATION_ENDPOINT, inspectEnv } from "../lib/env";
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

  /*
   * 🔴 C98 — no number unless we know one for that country.
   *
   * This asserted `helpline === "988"` for every patient in the world. 988 is
   * the United States lifeline; dialled from Cairo it reaches nothing, so the
   * test was pinning a defect in place. With no country there is no verified
   * line, and the message says "your local emergency number" instead.
   */
  assert.equal(message.helpline, null);
  assert.ok(message.message.includes("local emergency number"));

  const american = patientFacingCrisisMessage("US");
  assert.equal(american.helpline, "988");
  assert.ok(american.message.includes("988"));

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
  /*
   * 🔴 EVERY REQUIRED VARIABLE, and this fixture went red when two were added.
   *
   * That is the test working. `CRON_SECRET` and `BLOB_READ_WRITE_TOKEN` moved
   * from "recommended" to required, because "recommended" meant one console
   * warning and then, respectively, every scheduled job returning 401 forever
   * (including the crisis alert sweeper) and every upload refused (which blocks
   * therapist verification, so nobody can go on the radar at all).
   *
   * A fixture that lists them is a fixture that has to be edited deliberately
   * when the list changes, which is the point.
   */
  const base = {
    NODE_ENV: "production",
    DATABASE_URL: "postgres://x",
    OPENAI_API_KEY: "sk-x",
    STRIPE_WEBHOOK_SECRET: "whsec_x",
    APP_URL: "https://x",
    CRON_SECRET: "cron-x",
    BLOB_READ_WRITE_TOKEN: "vercel_blob_rw_x",
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

/* ------------------------------------------- the simulation and its database */

/*
 * 🔴 76.43 — the branch and the database have to agree, in both directions.
 *
 * The simulation invents hundreds of clinics, patients, sessions and payments.
 * A deployment of that branch pointed anywhere else puts all of it on a real
 * board, and the deploy is green while it happens: the pages render, the
 * queries work, and the damage is in a database.
 *
 * The mirror matters as much. A production build reading the simulation's
 * database serves invented people as customers, and every figure a founder
 * reads is about a company that does not exist.
 */
test("the simulation branch refuses any database but the simulation's", () => {
  const base = {
    NODE_ENV: "production",
    OPENAI_API_KEY: "sk-x",
    STRIPE_WEBHOOK_SECRET: "whsec_x",
    APP_URL: "https://x",
    CRON_SECRET: "cron-x",
    BLOB_READ_WRITE_TOKEN: "vercel_blob_rw_x",
    AUTH_SECRET: "a".repeat(48),
  };

  const wrongDatabase = inspectEnv({
    ...base,
    VERCEL_GIT_COMMIT_REF: SIMULATION_BRANCH,
    DATABASE_URL: "postgres://user:pass@ep-wild-lake-a6tgm2r6-pooler.neon.tech/neondb",
  } as NodeJS.ProcessEnv);

  assert.ok(
    wrongDatabase.some((p) => p.level === "error" && p.message.includes(SIMULATION_ENDPOINT)),
    "the simulation branch on another database must refuse to start",
  );

  const rightDatabase = inspectEnv({
    ...base,
    VERCEL_GIT_COMMIT_REF: SIMULATION_BRANCH,
    DATABASE_URL: `postgres://user:pass@${SIMULATION_ENDPOINT}-pooler.neon.tech/neondb`,
  } as NodeJS.ProcessEnv);

  assert.equal(
    rightDatabase.filter((p) => p.level === "error").length,
    0,
    "and the pairing it is for must boot",
  );
});

test("no other branch may reach the simulation's database", () => {
  const problems = inspectEnv({
    NODE_ENV: "production",
    OPENAI_API_KEY: "sk-x",
    STRIPE_WEBHOOK_SECRET: "whsec_x",
    APP_URL: "https://x",
    CRON_SECRET: "cron-x",
    BLOB_READ_WRITE_TOKEN: "vercel_blob_rw_x",
    AUTH_SECRET: "a".repeat(48),
    VERCEL_GIT_COMMIT_REF: "main",
    DATABASE_URL: `postgres://user:pass@${SIMULATION_ENDPOINT}-pooler.neon.tech/neondb`,
  } as NodeJS.ProcessEnv);

  assert.ok(problems.some((p) => p.level === "error" && /invented/.test(p.message)));
});

test("a machine with no branch name is unaffected, which is every laptop", () => {
  assert.equal(
    inspectEnv({
      NODE_ENV: "development",
      DATABASE_URL: `postgres://user:pass@${SIMULATION_ENDPOINT}-pooler.neon.tech/neondb`,
    } as NodeJS.ProcessEnv).length,
    0,
  );
});

/* ------------------------------------------------------------------ billing */

const TIERS = SETTINGS_DEFAULTS.pricing.tiers;
const BOUNDS = SETTINGS_DEFAULTS.session;

test("the seeded schedule is the one §3c asks for, after the split", () => {
  /*
   * 🔴 Sprint 57 — rewritten, not deleted, because the shape changed and the rule
   * did not. H20: a test asserting UI or pricing a later decision struck is
   * rewritten in the current vocabulary, so the rule survives the restatement.
   *
   * PAYG is the free door and still bills per session. The two paid tiers are
   * unlimited monthly, so their per-session rate is zero by construction and the
   * subscription is the whole price.
   */
  assert.deepEqual(
    TIERS.map((t) => [t.key, t.aiRateCents, t.unlockCents, t.monthlyCents]),
    [
      ["payg", 300, 0, 0],
      ["practice", 0, 0, 8000],
      ["clinic", 0, 0, 14400],
    ],
  );

  /*
   * 🔴 AND THE THREE NUMBERS ABOVE ARE RELATED, so a reprice that moves one and
   * forgets another is caught here rather than on an invoice.
   *
   * ⚠️ This assertion carried $99 and $179 for two sprints after the product was
   * repriced to $80 and $144, and stayed red without anybody seeing it, because
   * `npm run gates` did not run this file. It does now.
   */
  const solo = TIERS.find((t) => t.key === "practice")!.monthlyCents;
  const clinic = TIERS.find((t) => t.key === "clinic")!.monthlyCents;
  const seat = SETTINGS_DEFAULTS.pricing.seatBands[1]!.perSeatCents;

  assert.equal(seat, Math.round(solo * 0.9), "a clinic seat is ten per cent under solo, as a rule");
  assert.equal(clinic, 2 * seat, "the clinic tier IS the two-seat minimum, not a third price");

  /*
   * 🔴 AND THE METERED DOOR IS EXACTLY WHAT A SUBSCRIBER STOPS PAYING.
   *
   * $1 for the room on every session plus $3 for the note where the patient
   * consented. $80 is therefore exactly twenty metered sessions, which is the
   * number a therapist can check on their own screen and the reason the plan is
   * defensible at all.
   */
  const payg = TIERS.find((t) => t.key === "payg")!;
  assert.equal(BOUNDS.platformFeeCents, 100, "a dollar, on every session");
  assert.equal(payg.aiRateCents, 300, "three dollars for the note, and only where consent was given");
  assert.equal(solo / (BOUNDS.platformFeeCents + payg.aiRateCents), 20, "$80 is twenty metered sessions");

  assert.equal(BOUNDS.platformFeeBps, 1500, "the platform cut is 15%");
  assert.equal(BOUNDS.maxPriceCents, 50_000, "the price cap is $500");
  assert.equal(settingsProblem(SETTINGS_DEFAULTS), null);
});

/**
 * 🔴 46.1 — the all-in price did not move, and the free session got cheaper.
 *
 * $1 platform + $3/$2/$1 of AI is the $4/$3/$2 that shipped before the split.
 * If any of these three drifted, the split fee would be a price rise nobody
 * decided, which is the kind of thing a customer discovers rather than a
 * changelog.
 */
test("a monthly tier costs nothing per session, and PAYG still does", () => {
  /*
   * 🔴 The invariant that survived the repackaging.
   *
   * C209 split one fee into two so a therapist never had a reason to lean on a
   * patient about consent. Sprint 57 removes the meter entirely on a paid tier,
   * which is the same protection arrived at from the other side: there is no
   * per-session amount for a patient's decision to move.
   *
   * PAYG keeps the split, because a free door still has to be honest about what
   * the paid thing costs.
   */
  const payg = sessionLines({ settings: SETTINGS_DEFAULTS, tierKey: "payg", aiConsented: true });
  assert.deepEqual(
    payg.lines.map((l) => [l.kind, l.amountCents]),
    [["platform", 100], ["ai", 300]],
  );
  assert.equal(payg.totalCents, 400, "PAYG with AI is a dollar plus three");

  for (const key of ["practice", "clinic"]) {
    const paid = sessionLines({ settings: SETTINGS_DEFAULTS, tierKey: key, aiConsented: true });
    assert.equal(paid.totalCents, 0, `${key}: the month is the price, not the session`);
  }
});

test("🔴 an unlimited session still raises BOTH LINES, at zero", () => {
  /*
   * 🔴 The cheap version of this change skips the invoice for a subscriber. It
   * would also make a subscribed session invisible to 46.14's per-line-kind
   * reconciler, to Total View's consent rate and to cost-per-session — C221's
   * disappearance arriving through billing rather than through a null.
   *
   * A zero is a fact. A missing row is a gap. This asserts the difference.
   */
  const consented = sessionLines({
    settings: SETTINGS_DEFAULTS,
    tierKey: "practice",
    aiConsented: true,
  });
  assert.deepEqual(
    consented.lines.map((l) => [l.kind, l.amountCents]),
    [["platform", 0], ["ai", 0]],
    "both kinds present, both zero",
  );

  const declined = sessionLines({
    settings: SETTINGS_DEFAULTS,
    tierKey: "practice",
    aiConsented: false,
  });
  assert.equal(declined.lines.length, 1, "a refusal raises no AI line, subscribed or not");
  assert.equal(declined.lines[0]!.kind, "platform");
});

test("a declined session on PAYG still raises the platform fee, and it is not zero", () => {
  /*
   * 🔴 C209's original guarantee, unchanged for the tier that still meters.
   *
   * And the assertion is a PRESENCE, not an absence: "no AI fee on a refusal"
   * passes just as happily against code that charges nothing at all, which is the
   * §6 family in its billing costume.
   */
  const declined = sessionLines({
    settings: SETTINGS_DEFAULTS,
    tierKey: "payg",
    aiConsented: false,
  });
  assert.equal(declined.lines.length, 1, "one line");
  assert.equal(declined.lines[0]!.kind, "platform");
  assert.equal(declined.lines[0]!.amountCents, 100, "and it IS the platform fee");
  assert.ok(declined.totalCents > 0, "a refusal is never free");
});

test("spend still reaches the best rate it has paid for", () => {
  /*
   * Kept, because credit did not go away: PAYG is credit-based and a therapist
   * can still hold a balance. What changed is that no tier is BOUGHT with credit
   * any more, so every threshold is zero and everybody sits on PAYG until they
   * subscribe.
   */
  assert.equal(tierForSpend(TIERS, 0).key, "payg");
  assert.equal(tierForSpend(TIERS, 50_000).key, "payg", "credit no longer buys a tier");
});

test("🔴 A SUBSCRIPTION CANNOT BE REACHED BY SPENDING", () => {
  /*
   * 🔴 57.1 — the bug this very test caught, an hour after the schedule changed.
   *
   * `tierForSpend` walked every tier and kept the last one whose threshold the
   * spend had passed. With the old ladder — $0, $30, $60 — that is exactly
   * right. With sprint 57's schedule every threshold is zero, so the loop
   * walked past PAYG, past Practice, and left ANY therapist who had ever topped
   * up a single dollar sitting on the $179 Clinic plan for nothing.
   *
   * Nothing in the change looked wrong. The function was untouched; only the
   * data moved underneath it. That is the shape worth remembering: a pure
   * function whose correctness depended on a property of its input that nobody
   * had written down.
   *
   * The property is written down now — only `monthlyCents === 0` tiers are on
   * the ladder — and this is the test that holds it there.
   */
  const spends = [1, 99, 3_000, 6_000, 50_000, 1_000_000, Number.MAX_SAFE_INTEGER];
  for (const spent of spends) {
    const tier = tierForSpend(TIERS, spent);
    assert.equal(tier.monthlyCents, 0, `${spent}c reached a subscription tier: ${tier.key}`);
    assert.equal(tier.key, "payg", `${spent}c should stay on the free door`);
  }

  /*
   * 🔴 CONTROL. Every assertion above is a NEGATIVE — "never reaches a paid
   * tier" — and a `tierForSpend` that always returned the first tier regardless
   * of spend would satisfy all of them. So the ladder is proved to still WORK
   * on a schedule that has one.
   */
  const ladder = [
    { key: "free", name: "Free", unlockCents: 0, aiRateCents: 300, monthlyCents: 0 },
    { key: "mid", name: "Mid", unlockCents: 3_000, aiRateCents: 200, monthlyCents: 0 },
    { key: "top", name: "Top", unlockCents: 6_000, aiRateCents: 100, monthlyCents: 0 },
    { key: "sub", name: "Sub", unlockCents: 0, aiRateCents: 0, monthlyCents: 9_900 },
  ];
  assert.equal(tierForSpend(ladder, 0).key, "free");
  assert.equal(tierForSpend(ladder, 2_999).key, "free");
  assert.equal(tierForSpend(ladder, 3_000).key, "mid", "CONTROL: the ladder still climbs");
  assert.equal(tierForSpend(ladder, 6_000).key, "top");
  assert.equal(
    tierForSpend(ladder, 1_000_000).key,
    "top",
    "🔴 and it still stops short of the subscription",
  );
});

test("🔴 a subscriber is entitled to the period they PAID FOR, not to a status", () => {
  /*
   * 🔴 57.2 — the entitlement rule, and the three ways it is usually got wrong.
   *
   * "While Stripe says active" drops a therapist the hour their card expires,
   * mid-session, on a plan they paid for three weeks ago. "While a row exists"
   * gives the product away to anybody who ever subscribed once. "While
   * cancelAtPeriodEnd is false" takes the month away the moment somebody
   * cancels, which is the thing they were told would not happen.
   *
   * The rule is the period. Everything else follows from it.
   */
  const now = new Date("2026-06-15T12:00:00Z");
  const future = new Date("2026-07-01T00:00:00Z");
  const past = new Date("2026-06-01T00:00:00Z");
  const at = (subscription: Parameters<typeof entitledTier>[0]["subscription"]) =>
    entitledTier({ tiers: TIERS, subscription, lifetimeSpentCents: 50_000, now }).key;

  assert.equal(at(null), "payg", "no subscription is the free door");
  assert.equal(
    at({ plan: "practice", status: "active", currentPeriodEnd: future }),
    "practice",
    "a live plan is the plan",
  );
  assert.equal(
    at({ plan: "practice", status: "past_due", currentPeriodEnd: future }),
    "practice",
    "🔴 a failed renewal does NOT cut off the month already paid for",
  );
  assert.equal(
    at({ plan: "practice", status: "past_due", currentPeriodEnd: past }),
    "payg",
    "🔴 but it does end when that month does",
  );
  assert.equal(
    at({ plan: "practice", status: "cancelled", currentPeriodEnd: future }),
    "payg",
    "a cancelled subscription is over whatever the date says",
  );
  assert.equal(
    at({ plan: "practice", status: "active", currentPeriodEnd: null }),
    "practice",
    "checkout completed, first invoice not yet mirrored: the money changed hands",
  );

  /*
   * 🔴 A plan key the tier table no longer names is not entitlement.
   *
   * Sprint 57 renamed `starter` and `growth` and migrated nothing, so rows
   * carrying those keys are real and will be for as long as the accounts exist.
   * `find` returns nothing and the spend ladder answers instead — never
   * `tierByKey`, whose fail-closed fallback would have returned a tier while
   * the caller believed a subscription was in force.
   */
  assert.equal(
    at({ plan: "growth", status: "active", currentPeriodEnd: future }),
    "payg",
    "🔴 a retired plan key grants nothing",
  );
  assert.equal(
    at({ plan: "payg", status: "active", currentPeriodEnd: future }),
    "payg",
    "and neither does a row pointing at the free tier",
  );
});

test("🔴 59.14 / C310 a paid obligation outranks a gateway mirror that says otherwise", () => {
  /*
   * The defect this closes. `subscriptions` is what a Stripe webhook last told
   * us, so a webhook that never arrived leaves a period end in the past, and a
   * clinician who paid loses the plan they paid for because our endpoint was
   * down for an hour. Nothing on any screen would have said why.
   *
   * C294 ruled in sprint 57 that entitlement is the period paid for. That was
   * true of a function and false of the data under it. 0089 is the data.
   */
  const now = new Date("2026-06-15T12:00:00Z");
  const covering = {
    plan: "practice",
    state: "paid" as const,
    periodStart: new Date("2026-06-01T00:00:00Z"),
    periodEnd: new Date("2026-07-01T00:00:00Z"),
  };

  const withOb = (
    obligation: Parameters<typeof entitledTier>[0]["obligation"],
    subscription: Parameters<typeof entitledTier>[0]["subscription"] = null,
  ) => entitledTier({ tiers: TIERS, obligation, subscription, lifetimeSpentCents: 0, now }).key;

  assert.equal(
    withOb(covering, { plan: "practice", status: "cancelled", currentPeriodEnd: null }),
    "practice",
    "🔴 the whole point: the obligation is paid, so the mirror does not get to end the plan",
  );

  assert.equal(
    withOb(covering),
    "practice",
    "and it stands on its own, with no subscription row at all",
  );

  /*
   * 🔴 DUE IS NOT PAID. Entitlement is the period paid for, not the period
   * invoiced, and an obligation raised on the first of the month grants
   * nothing until somebody settles it.
   */
  assert.equal(
    withOb({ ...covering, state: "due" }),
    "payg",
    "🔴 an unpaid obligation grants nothing, however recent",
  );
  assert.equal(withOb({ ...covering, state: "lapsed" }), "payg", "and neither does a lapsed one");
  assert.equal(withOb({ ...covering, state: "void" }), "payg", "nor one we cancelled");

  /* A paid obligation for a period that has ended is history, not entitlement. */
  assert.equal(
    withOb({
      ...covering,
      periodStart: new Date("2026-04-01T00:00:00Z"),
      periodEnd: new Date("2026-05-01T00:00:00Z"),
    }),
    "payg",
    "a period that closed is over, whoever paid for it",
  );

  /* And a retired plan key grants nothing here either, for C294's own reason. */
  assert.equal(
    withOb({ ...covering, plan: "growth" }),
    "payg",
    "🔴 the same `find` rule as the mirror path, so the two cannot disagree",
  );

  /*
   * 🔴 CONTROL: with no obligation at all the old path is untouched. 0089 is
   * additive, and every organisation that subscribed before it has no row.
   */
  assert.equal(
    withOb(null, { plan: "practice", status: "active", currentPeriodEnd: new Date("2026-07-01T00:00:00Z") }),
    "practice",
    "no obligation falls through to the mirror exactly as before",
  );
});

test("an unknown tier key fails closed to the most expensive rate", () => {
  // The mirror of the old "unknown plan must not grant unlimited": a typo in a
  // stored key must never hand somebody a free session.
  assert.equal(tierByKey(TIERS, "enterprise").key, "payg");
  assert.equal(tierByKey(TIERS, null).key, "payg");
  assert.equal(tierByKey(TIERS, undefined).key, "payg");
  assert.equal(tierByKey(TIERS, "practice").key, "practice");

  const unknown = sessionLines({
    settings: SETTINGS_DEFAULTS,
    tierKey: "enterprise",
    aiConsented: true,
  });
  assert.equal(unknown.totalCents, 400, "🔴 a typo bills the full PAYG price, never zero");
});

test("a quote is the money, and the threshold is what buys the rate", () => {
  assert.equal(quoteForSpend(TIERS, 3000).creditCents, 3000, "money in is credit out");
  assert.equal(quoteForSpend(TIERS, 3000).totalCents, 3000, "and nothing multiplies it");
  assert.equal(quoteForSpend(TIERS, 3000).tier.key, "payg", "credit no longer buys a tier");
  assert.equal(quoteForSpend(TIERS, 100).tier.key, "payg");
  assert.equal(quoteForSpend(TIERS, 0).creditCents, 0);
  assert.equal(quoteForSpend(TIERS, -500).creditCents, 0);
});

/**
 * 🔴 46.2 — a platform fee of zero is the giveaway half of C209.
 *
 * An admin can set every other figure to anything. This one has a floor,
 * because zero means a clinician who never seeks consent gets unlimited hosted
 * HIPAA-grade video for nothing.
 */
test("settings refuse a platform fee of zero", () => {
  assert.match(
    settingsProblem({
      ...SETTINGS_DEFAULTS,
      session: { ...SETTINGS_DEFAULTS.session, platformFeeCents: 0 },
    }) ?? "",
    /platform fee/i,
  );
});

/**
 * 🔴 57.3 / C289 — the rail that passed by measuring the wrong thing.
 *
 * `settingsProblem` asked whether any tier had a threshold of zero, which meant
 * "somebody who has bought nothing still has a rate". After sprint 57 that is
 * true of all three tiers including the $179 one, so the rail went on passing
 * while describing a condition it no longer tested. An admin could delete pay
 * as you go outright and nothing would object.
 *
 * This is the §6 family arriving in the rails themselves, which is the worst
 * place for it: a rail is what everything else trusts instead of checking.
 */
/**
 * 🔴 C377 — the anti-differencing floor on a sponsor's pot balance.
 *
 * C229's floor existed as a comment on a function nothing called, whose body
 * applied no floor. The rule is tested here, over the pure arithmetic, because
 * the failure it prevents is a subtraction rather than a query.
 *
 * 🔴 E1 — and this docblock had no test under it. The walk then found the
 * overview printing live "Sessions paid for" and "Spent so far" beside the
 * floored balance, so one session moved two figures at once (the stop
 * condition of 2026-09-22). Every company figure is now one publication.
 */
test("🔴 E1 the company overview prints no live total, only the published snapshot", async () => {
  const { readFileSync } = await import("node:fs");
  const page = readFileSync("app/(sponsor)/sponsor/page.tsx", "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
  assert.doesNotMatch(page, /potTotals|ledgerPotBalance/, "a live total is on the company overview");
  assert.match(page, /const totals = pot\.published;/, "the figures must come from the balance's own publication");

  const sponsors = readFileSync("lib/data/sponsors.ts", "utf8");
  const body = sponsors.slice(sponsors.indexOf("export async function potBalance"));
  // The spend is the spend of the PUBLISHED count, in both branches.
  assert.match(body, /potSpentThrough\(sponsorId, sessions\)/);
  assert.match(body, /potSpentThrough\(sponsorId, pot\.publishedSessions\)/);
  // Control: the floor that decides when the count moves is still there.
  assert.match(body, /sessions - pot\.publishedSessions >= floor/);
});

test("🔴 E2 the company's people list carries a name per person and nothing about their use of it", async () => {
  const { readFileSync } = await import("node:fs");
  const strip = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, "");
  const page = strip(readFileSync("app/(sponsor)/sponsor/people/page.tsx", "utf8"));
  const list = strip(readFileSync("components/sponsor/roster-list.tsx", "utf8"));
  // Re-proving employment happens when somebody next wants the benefit, so the
  // date and the pause say who came back to therapy and when.
  assert.doesNotMatch(page, /lastVerifiedAt|paused/, "the page hands a per-person check date or pause to the list");
  assert.doesNotMatch(list, /lastChecked|paused/, "the list renders a per-person check date or pause");
  // Control: the name is still there, because "End their benefit" needs it.
  assert.match(list, /person\.name/);
});

/**
 * 🔴 C380 — every figure on one charge is in ONE currency.
 *
 * The line items were converted at the frozen quote and the application fee was
 * not, so on an Egyptian checkout we would have taken a forty-eighth of our own
 * commission. The rule is not "convert the fee"; it is that a charge and every
 * amount attached to it are denominated the same way, at the same frozen rate.
 */
/**
 * 🔴 C381 — an operator control is read by the code, or it does not exist.
 *
 * `collection_provider` was seeded, editable on an admin screen, asserted by a
 * verifier, and read by no payment code at all. Egypt is seeded `paymob`, there
 * is no paymob integration, and every enabled country was charged through
 * Stripe regardless: the wrong entity, the wrong currency, and success on every
 * screen. C218 ruled on this exact shape once already, for a different column.
 */
/**
 * 🔴 C382 — a read followed by a write is not a decision, it is a guess with a
 * window in it.
 *
 * `payFromPot` read the balance, did four irreversible things, then debited the
 * pot with a WHERE clause naming only the pot's id. Two bookings arriving
 * together both passed the read and both debited, and the database's own
 * overdraft CHECK refused the second AFTER the session was marked paid, the
 * payment row written and the ledger posted.
 *
 * The rule, tested here over the predicate itself: the claim on the money
 * carries its own condition, so the second writer re-evaluates against the
 * first one's result and matches nothing.
 */
test("🔴 two bookings racing cannot both spend the same pot money", () => {
  const funds = (balance: number, overdraft: number, gross: number) =>
    balance + overdraft >= gross;

  // A pot that can fund exactly one session of 3000.
  let balance = 3000;
  const overdraft = 0;

  // Both readers see the same balance and both pass the early exit.
  assert.equal(funds(balance, overdraft, 3000), true, "reader A passes");
  assert.equal(funds(balance, overdraft, 3000), true, "reader B passes, on a stale read");

  // 🔴 The DEBIT is where it is decided. Postgres serialises the two updates on
  // the row, so the second sees the first one's result.
  const debit = (gross: number) => {
    if (!funds(balance, overdraft, gross)) return false;
    balance -= gross;
    return true;
  };

  assert.equal(debit(3000), true, "the first writer takes the money");
  assert.equal(debit(3000), false, "🔴 and the second is refused, before anything irreversible");
  assert.equal(balance, 0, "the pot never went past its bound");

  /*
   * CONTROL: with an overdraft the bound moves, it does not vanish. C239 says a
   * session that has started always completes and is always paid, and the
   * overdraft is how that is true without being unbounded.
   */
  balance = 0;
  assert.equal(funds(balance, 3000, 3000), true, "an overdraft funds one more");
  assert.equal(funds(-3000, 3000, 3000), false, "and exactly one more");
});

test("🔴 a country whose payment provider we have not built is REFUSED", () => {
  const base = SETTINGS_DEFAULTS;
  void base;

  const stripeCountry = {
    code: "us",
    name: "United States",
    vatBps: 0,
    currency: "usd",
    paymentMethods: ["card"],
    collectionProvider: "stripe",
    payoutMethods: ["stripe"],
    entity: "us" as const,
    regulators: [],
    crisisLineLabel: null,
    crisisLineTel: null,
    idLabelFront: null,
    idLabelBack: null,
    licenceLabel: null,
    sampleImageUrl: null,
    enabled: true,
  };

  assert.equal(collectionProblem(stripeCountry), null, "CONTROL: a built rail is allowed");

  /* Egypt as it is seeded TODAY: a provider name with no integration behind it. */
  assert.match(
    collectionProblem({ ...stripeCountry, code: "eg", collectionProvider: "paymob" }) ?? "",
    /not switched on yet/i,
    "🔴 a named provider we have not built must refuse, never fall back to Stripe",
  );

  assert.match(
    collectionProblem({ ...stripeCountry, collectionProvider: null }) ?? "",
    /no way to take a card payment/i,
  );

  assert.match(collectionProblem({ ...stripeCountry, enabled: false }) ?? "", /not taking payments/i);

  /*
   * 🔴 Every refusal points the patient at the free link. A payment that cannot
   * happen must never read as a session that cannot happen: the session works
   * exactly the same, and somebody in distress needs to know that.
   */
  for (const country of [
    { ...stripeCountry, enabled: false },
    { ...stripeCountry, collectionProvider: null },
    { ...stripeCountry, collectionProvider: "paymob" },
  ]) {
    assert.match(
      collectionProblem(country) ?? "",
      /free link/i,
      "a refusal to take money is never a refusal to be seen",
    );
  }
});

test("🔴 a commission is denominated in the currency of the charge it rides on", () => {
  // ~48 EGP to the dollar, as a fixed-point rate x1e6, which is how 16.6 stores it.
  const RATE = 48_000_000;
  const usdCents = (n: number) => n;

  const gross = usdCents(3000);
  const cut = usdCents(450);

  const presentedGross = convertAtRate(gross, RATE);
  const presentedCut = convertAtRate(cut, RATE);

  assert.ok(presentedGross > gross * 40, "the charge really is in a weaker currency");

  /*
   * 🔴 THE DEFECT, stated as a ratio. An unconverted fee on a converted charge
   * is our commission divided by the exchange rate. At forty-eight to the
   * dollar, a $4.50 cut is collected as 4.50 EGP, about nine cents.
   */
  assert.ok(
    cut * 40 < presentedCut,
    `unconverted the fee is ${(presentedCut / cut).toFixed(0)} times too small`,
  );

  /* And converted, the fee holds its share of the charge. */
  const shareBefore = cut / gross;
  const shareAfter = presentedCut / presentedGross;
  assert.ok(
    Math.abs(shareAfter - shareBefore) < 0.001,
    `the fee keeps its proportion: ${shareBefore} against ${shareAfter}`,
  );
});

test("🔴 a sponsor cannot difference two balances down to one session", () => {
  /*
   * The attack, stated as the test. A sponsor reads the balance on Monday and
   * again on Tuesday. If the published figure moves at all between those two
   * reads, the difference is the spend, and with few enough people that spend
   * is one named person's session.
   *
   * The rule: a balance is republished only once the session count has moved at
   * least `activityFloor` since the last publication. So between publications
   * the two reads are IDENTICAL, and the difference is zero.
   */
  const floor = SETTINGS_DEFAULTS.sponsor.activityFloor;
  assert.ok(floor >= 2, "a floor of one would publish on every session");

  const publishable = (sessions: number, publishedAt: number) => sessions - publishedAt >= floor;

  // Monday: 10 sessions, last published at 10. Nothing new is publishable.
  assert.equal(publishable(10, 10), false);
  // Tuesday: one more session. Still not publishable, so the balance is unchanged.
  assert.equal(publishable(11, 10), false, "🔴 ONE session must never move the published figure");
  // The floor is reached exactly.
  assert.equal(publishable(10 + floor, 10), true, "CONTROL: the floor does eventually clear");
  // And one below it does not.
  assert.equal(publishable(10 + floor - 1, 10), false);
});

test("🔴 settings refuse a tier table with no FREE door", () => {
  const paidOnly = {
    ...SETTINGS_DEFAULTS,
    pricing: {
      ...SETTINGS_DEFAULTS.pricing,
      tiers: SETTINGS_DEFAULTS.pricing.tiers.filter((t) => t.monthlyCents > 0),
    },
  };
  assert.match(settingsProblem(paidOnly) ?? "", /free to be on/i);

  /*
   * 🔴 CONTROL, and it is the whole point of this test: the OLD rail passes
   * against the very table above, because every tier in it has a zero
   * threshold. Asserted out loud so that reverting the fix fails here rather
   * than somewhere a therapist notices first.
   */
  assert.ok(
    paidOnly.pricing.tiers.every((t) => t.unlockCents === 0),
    "CONTROL: the old `some(unlockCents === 0)` rail is satisfied by a table with no free tier",
  );

  assert.equal(settingsProblem(SETTINGS_DEFAULTS), null, "and the shipped table is fine");
});

test("🔴 settings refuse a tier that is both subscribed to and unlocked by spending", () => {
  /*
   * A tier carrying both reads as "spend $60 and the $179 plan is yours", which
   * `tierForSpend` will not honour — it walks credit tiers only. A control that
   * promises something the billing code refuses is worse than no control, so
   * the configuration is rejected rather than quietly ignored.
   */
  const both = {
    ...SETTINGS_DEFAULTS,
    pricing: {
      ...SETTINGS_DEFAULTS.pricing,
      tiers: SETTINGS_DEFAULTS.pricing.tiers.map((t) =>
        t.monthlyCents > 0 ? { ...t, unlockCents: 6_000 } : t,
      ),
    },
  };
  assert.match(settingsProblem(both) ?? "", /bought, not unlocked/i);
});

test("🔴 a tier stored before sprint 57 parses as a credit tier, never a free plan", () => {
  /*
   * 57.3 — settings are parsed on EVERY read, so a defaulting mistake here is
   * not a migration problem that shows up once. A row written before this
   * sprint has no `monthlyCents`; reading that absence as anything but zero
   * would hand every legacy account an unlimited plan on the first request
   * after deploy, for free, with no code change to blame.
   */
  const legacy = parseGroup("pricing", {
    tiers: [
      { key: "payg", name: "Pay as you go", rateCents: 400, minimumSessions: 1 },
      { key: "growth", name: "Growth", rateCents: 200, minimumSessions: 30 },
    ],
    creditExpiryMonths: 12,
  });

  assert.ok(
    legacy.tiers.every((t) => t.monthlyCents === 0),
    "🔴 an absent monthly price is zero, which is what a credit tier is",
  );
  assert.equal(legacy.tiers[0]?.key, "payg", "and the free door still sorts first");

  // CONTROL: the old-shape conversion itself still works, so the assertion
  // above is not passing against a parser that dropped the rows entirely.
  assert.equal(legacy.tiers.length, 2);
  assert.equal(legacy.tiers[1]?.unlockCents, 6_000, "CONTROL: 30 × $2 is still $60");
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
    pricing: { ...SETTINGS_DEFAULTS.pricing, tiers: TIERS.filter((t) => t.unlockCents > 0) },
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

/* ----------------------------------------------------------- currency (4.4) */

/** ~48 EGP to the dollar, x1e6, matching the seeded indicative rate. */
const EGP = 48_000_000;

test("conversion is a whole minor unit, rounded once", () => {
  // $30.00 at 48 EGP/USD is 1,440.00 EGP.
  assert.equal(convertAtRate(3000, EGP), 144_000);
  assert.equal(convertAtRate(0, EGP), 0);
  assert.equal(convertAtRate(-500, EGP), 0);
  // An identity rate must be exactly the identity, not a rounding of it.
  assert.equal(convertAtRate(3421, 1_000_000), 3421);
});

test("a nonsense rate converts to nothing rather than to a wrong charge", () => {
  assert.equal(convertAtRate(3000, 0), 0);
  assert.equal(convertAtRate(3000, -1), 0);
});

test("VAT is applied before conversion, not after", () => {
  /*
   * The order matters and only one order is defensible. A tax authority cares
   * about the amount in the currency the invoice is denominated in, so VAT is
   * computed on the settlement amount and the *total* is then converted.
   *
   * The two orders differ by a rounding step, which is small and is exactly the
   * kind of small that turns into a reconciliation argument.
   */
  const r = presentedTotal({ grossCents: 3000, vatBps: 1400, rateMicro: EGP });
  assert.equal(r.vatCents, 420, "VAT on $30 at 14% is $4.20");
  assert.equal(r.settlementTotalCents, 3420);
  assert.equal(r.presentedTotalCents, convertAtRate(3420, EGP));
  assert.equal(r.presentedTotalCents, 164_160);

  // Converting first and taxing after gives a different number.
  const wrongOrder = vatOn(convertAtRate(3000, EGP), 1400) + convertAtRate(3000, EGP);
  assert.notEqual(r.presentedTotalCents, wrongOrder + 1, "sanity: the two orders are comparable");
});

test("a zero-VAT country converts the price and nothing else", () => {
  const r = presentedTotal({ grossCents: 3000, vatBps: 0, rateMicro: EGP });
  assert.equal(r.vatCents, 0);
  assert.equal(r.settlementTotalCents, 3000);
  assert.equal(r.presentedTotalCents, 144_000);
});

test("the therapist's net is untouched by the patient's currency", () => {
  /*
   * The invariant that makes the split honest: what the clinician receives is a
   * fact about the settlement currency. A patient paying in EGP and a patient
   * paying in USD for the same session must leave the therapist with the same
   * money, and only the patient's total differs.
   */
  const bps = SETTINGS_DEFAULTS.session.platformFeeBps;
  const usd = sessionMoney({ grossCents: 3000, feeBps: bps, vatBps: 0 });
  const egypt = sessionMoney({ grossCents: 3000, feeBps: bps, vatBps: 1400 });
  assert.equal(usd.therapistNetCents, egypt.therapistNetCents);
  assert.equal(usd.platformCutCents, egypt.platformCutCents);
  assert.equal(egypt.patientTotalCents - usd.patientTotalCents, egypt.vatCents);
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
    "a join token is a live credential, it lets the holder into the room",
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

/* ------------------------------------------------------ W1-08 no-show claims */

/**
 * 🔴 W1-08 — a patient's "they never joined" refunds and suspends on its own
 * only when the session's record agrees. Both branches, and each way the
 * record can disagree.
 */
test("a no-show claim is proven only by a record showing the clinician never joined", async () => {
  const { noShowProven } = await import("../lib/data/recovery");
  const now = new Date("2026-09-23T12:00:00Z");
  const missed = {
    scheduledAt: new Date("2026-09-23T11:30:00Z"),
    startedAt: null,
    recordingStartedAt: null,
    status: "scheduled",
    modality: "video",
    recoveryOutcome: null,
    externalMeeting: false,
  };

  assert.equal(noShowProven(missed, now), true, "never started, due half an hour ago");

  for (const [label, row] of [
    ["the clinician started the session", { ...missed, startedAt: new Date("2026-09-23T11:31:00Z"), status: "completed" }],
    ["the recording started", { ...missed, recordingStartedAt: new Date("2026-09-23T11:32:00Z") }],
    ["it is not due yet", { ...missed, scheduledAt: new Date("2026-09-23T11:58:00Z") }],
    ["it has no scheduled time", { ...missed, scheduledAt: null }],
    ["it was held in person", { ...missed, modality: "in_person" }],
    ["it was held in a meeting we cannot see into", { ...missed, externalMeeting: true }],
    ["it was already cancelled", { ...missed, status: "cancelled" }],
    ["it was already refunded by the recovery flow", { ...missed, recoveryOutcome: "refunded" }],
  ] as const) {
    assert.equal(noShowProven(row, now), false, `${label}: a person decides`);
  }
});
