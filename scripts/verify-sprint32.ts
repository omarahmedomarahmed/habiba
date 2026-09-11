/**
 * Sprint 32 acceptance: the AI is measured. PLAN.md 32.1, 32.2.
 *
 *   npm run verify:sprint32
 *
 * ## What this asserts, and what `npm run evals` asserts
 *
 * The evals produce the **numbers**. This verifies the **mechanism**: that
 * every model call is either measured or named as unmeasured with a reason,
 * that the unmeasured count can only go down, that the scorers are tested, and
 * that the gate actually fails on a regression rather than printing one.
 *
 * The split matters because the numbers cost money and the mechanism does not.
 * This runs anywhere, in a second, with no key — so the property "nothing new
 * reaches a model unmeasured and unnamed" is checked on every commit, and the
 * numbers are taken when somebody changes a prompt.
 *
 * ## 🔴 Three checks are proved as negatives (C158)
 *
 * A planted module that calls a model must be reported as unlisted; a planted
 * regression must fail the gate; and a planted worse-by-less-than-tolerance
 * move must NOT, because a gate that fires on noise is a gate people mute.
 * Each of those plants the offender at the point where its absence would show.
 */
import { rmSync, writeFileSync, readFileSync, existsSync } from "node:fs";

import { modelCallSites, SURFACES, unmeasured } from "../evals/coverage";
import { compare, type Baseline, type Measurement } from "../evals/report";
import { risk } from "../evals/suites/risk";
import { scanForCrisisLanguage } from "../lib/crisis/alerts";
import { reporter } from "./_verify";

const { check, finish } = reporter();

const RATCHET = "evals/unmeasured.json";

function readRatchet(): { unmeasured: number; measuredOn: string } {
  return JSON.parse(readFileSync(RATCHET, "utf8")) as { unmeasured: number; measuredOn: string };
}

async function main() {
  console.log("\nSprint 32, AI evaluation\n");

  /* ------------------------------------------------ every surface is accounted for -- */

  const listed = new Set(SURFACES.map((surface) => surface.file));
  const found = modelCallSites();
  const unlisted = found.filter((file) => !listed.has(file));

  check(
    "🔴 32.2 every module that calls a model is measured or named",
    unlisted.length === 0,
    unlisted.length === 0
      ? `${found.length} call sites, ${SURFACES.length - unmeasured().length} measured, ${unmeasured().length} named`
      : `unlisted: ${unlisted.join(", ")}`,
  );

  /*
   * 🔴 The planted offender, at the point where its absence would show.
   *
   * A new module that talks to a model is exactly what 32.2 is for, and the
   * check above passes trivially on a repository where nothing new was added.
   * So one is written to disk, in the shape a real one has, and the scan must
   * report it. Deleted in a `finally`, because a probe left behind fails every
   * later run for the wrong reason.
   */
  const probe = "lib/ai/_eval-probe.ts";
  try {
    writeFileSync(
      probe,
      'import { openai } from "./client";\n' +
        "export async function probe() {\n" +
        "  return openai().chat.completions.create({ model: 'gpt-4o-mini', messages: [] });\n" +
        "}\n",
    );
    const withProbe = modelCallSites().filter((file) => !listed.has(file));
    check(
      "🔴 32.2 …proved by planting a module that calls a model and is listed nowhere",
      withProbe.includes(probe),
      withProbe.length ? `caught ${withProbe.join(", ")}` : "the scan did not see it",
    );
  } finally {
    rmSync(probe, { force: true });
  }

  check(
    "32.2 the probe was cleaned up",
    !existsSync(probe),
  );

  /* ------------------------------------------------------------------- the ratchet -- */

  const ratchet = readRatchet();
  const open = unmeasured();

  check(
    "🔴 32.2 the unmeasured count may only go down",
    open.length <= ratchet.unmeasured,
    open.length === ratchet.unmeasured
      ? `${open.length} unmeasured, unchanged since ${ratchet.measuredOn}`
      : open.length < ratchet.unmeasured
        ? `${open.length} unmeasured, DOWN from ${ratchet.unmeasured}. Lower the committed figure.`
        : `${open.length}, UP from ${ratchet.unmeasured}. A new unmeasured model call is new debt and needs saying out loud.`,
  );

  check(
    "32.2 every unmeasured surface says what is missing, not TODO",
    open.every((surface) => (surface.reason ?? "").length > 60 && !/todo/i.test(surface.reason ?? "")),
    open.map((surface) => surface.file).join(", "),
  );

  /* ------------------------------------------------------------------ the scorers -- */

  const metrics = readFileSync("evals/metrics.ts", "utf8");
  const tests = readFileSync("tests/evals.test.ts", "utf8");
  const exported = [...metrics.matchAll(/export function (\w+)/g)].map((m) => m[1]!);
  const untested = exported.filter((name) => !tests.includes(name));

  check(
    "🔴 32.1 every scorer is unit-tested",
    untested.length === 0,
    untested.length === 0 ? `${exported.length} scorers` : `untested: ${untested.join(", ")}`,
  );

  check(
    "32.1 no scorer asks a model to judge another model",
    !/openai\(\)|chat\.completions/.test(metrics),
  );

  /* ------------------------------------------------------------------- the gate -- */

  const baseline = JSON.parse(readFileSync("evals/baseline.json", "utf8")) as Baseline;
  const keys = Object.keys(baseline.metrics);

  check(
    "32.1 the baseline covers all four suites",
    ["risk.", "attribution.", "notes.", "speech."].every((prefix) =>
      keys.some((key) => key.startsWith(prefix)),
    ),
    `${keys.length} metrics recorded on ${baseline.recordedOn}`,
  );

  /*
   * 🔴 The gate, proved in both directions.
   *
   * A regression must fail and noise must not. Only asserting the first would
   * be satisfied by a gate that fails on everything, which is the gate everyone
   * learns to ignore — C90's whole argument, arriving through quality instead
   * of through skips.
   */
  const sample = keys[0]!;
  const recorded = baseline.metrics[sample]!;
  const worseBy = (amount: number): Measurement => ({
    key: sample,
    label: sample,
    value: recorded.direction === "up" ? recorded.value - amount : recorded.value + amount,
    direction: recorded.direction,
    unit: "rate",
    tolerance: recorded.tolerance,
  });

  check(
    "🔴 32.1 a move past the tolerance FAILS the run",
    compare([worseBy(recorded.tolerance + 0.05)], baseline)[0]!.status === "WORSE",
    `${sample}, tolerance ${recorded.tolerance}`,
  );

  check(
    "🔴 32.1 …and a move inside it does not, because a gate that fires on noise is muted",
    compare([worseBy(Math.max(recorded.tolerance - 0.001, 0))], baseline)[0]!.status !== "WORSE",
  );

  /* ---------------------------------------------------------------- the safety one -- */

  check(
    "🔴 32.1 the risk suite needs no model, no key and no network",
    risk.needsModel === false,
  );

  const riskNumbers = risk.run();
  check(
    "32.1 …and it reports sensitivity and specificity together, never one alone",
    riskNumbers.some((m) => m.key === "risk.sensitivity") &&
      riskNumbers.some((m) => m.key === "risk.specificity"),
  );

  /*
   * 🔴 The finding this sprint exists to have made.
   *
   * The crisis scanner was a list of English phrases, and the first eval run
   * scored Arabic sensitivity at 0%: five crisis sentences, none found, in the
   * market this product is built for. Asserted on the sentence rather than on
   * the list's length, because a list can grow and still not match what a
   * person actually types (C156: assert on the rendered string).
   */
  check(
    "🔴 32.1 the crisis scanner reads Arabic",
    scanForCrisisLanguage("أحيانًا أتمنى أن أموت وأرتاح من كل هذا.").length > 0,
  );

  check(
    "32.1 …including a sentence with no diacritics, typed on a phone",
    scanForCrisisLanguage("انا بفكر انهي حياتي").length > 0,
  );

  check(
    "🔴 32.1 …and still does not alert on an idiom",
    scanForCrisisLanguage("أنا ميت من التعب بعد المذاكرة.").length === 0 &&
      scanForCrisisLanguage("I was just killing time in the car park.").length === 0,
  );

  finish("Sprint 32");
}

void main();
