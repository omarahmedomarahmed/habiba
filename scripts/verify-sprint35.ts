/**
 * Sprint 35 acceptance: risk intelligence. PLAN.md 35.1 to 35.3.
 *
 *   npm run verify:sprint35
 *
 * ## What this proves, and what the evals measure
 *
 * The **numbers** — does the classifier beat the phrase list, per language —
 * are `npm run evals -- --suite risk-model`. This proves the three structural
 * claims that make those numbers safe to act on:
 *
 *   1. **The model cannot adjudicate.** There is no level in its schema, and
 *      the function that produces one reads nothing a model returned except a
 *      list of indicator names.
 *   2. **The keyword list is a floor.** Proved by handing the ladder an empty
 *      classification beside a keyword hit and watching the level hold.
 *   3. 🔴 **The classifier cannot reach prior context** (C170). Proved by
 *      walking this module's imports transitively, the way 24.2 walks the
 *      patient app's, with a planted offender to show the walk is not blind.
 *
 * Every refusal is paired with the write it must allow (C165).
 */
import { readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";

import { eq, sql } from "drizzle-orm";

import { traceable } from "../lib/ai/risk";
import { levelFor, RISK_INDICATORS, shouldAlert } from "../lib/crisis/level";
import { scanForCrisisLanguage } from "../lib/crisis/alerts";
import { dbFor } from "../lib/db";
import { DEFAULT_REGION } from "../lib/db/region";
import { riskAssessments } from "../lib/db/schema";
import { stripComments } from "./_dashes";
import { reporter, writesTo } from "./_verify";

const { check, finish } = reporter();
const db = dbFor(DEFAULT_REGION);

/** Every module `entry` can reach, transitively, inside this repository. */
function reaches(entry: string, target: RegExp): string[] | null {
  const seen = new Set<string>();
  const path: string[] = [];

  const walk = (file: string, trail: string[]): string[] | null => {
    if (seen.has(file)) return null;
    seen.add(file);

    let source: string;
    try {
      source = stripComments(readFileSync(file, "utf8"));
    } catch {
      return null;
    }

    const imports = [...source.matchAll(/from\s+"(@\/[^"]+|\.[^"]+)"/g)].map((m) => m[1]!);

    for (const spec of imports) {
      const resolved = resolve(spec, file);
      if (!resolved) continue;
      if (target.test(resolved)) return [...trail, resolved];
      const deeper = walk(resolved, [...trail, resolved]);
      if (deeper) return deeper;
    }
    return null;
  };

  return walk(entry, path);
}

function resolve(spec: string, from: string): string | null {
  const base = spec.startsWith("@/")
    ? spec.slice(2)
    : `${from.split("/").slice(0, -1).join("/")}/${spec}`.replace(/\/\.\//g, "/");

  const normalised = base
    .split("/")
    .reduce<string[]>((parts, part) => {
      if (part === "..") parts.pop();
      else if (part !== ".") parts.push(part);
      return parts;
    }, [])
    .join("/");

  for (const candidate of [`${normalised}.ts`, `${normalised}.tsx`, `${normalised}/index.ts`]) {
    try {
      readFileSync(candidate, "utf8");
      return candidate;
    } catch {
      /* keep looking */
    }
  }
  return null;
}

async function main() {
  writesTo();
  console.log("\nSprint 35, risk intelligence\n");

  /* ------------------------------------------- 35.3 · the model cannot adjudicate */

  const classifier = stripComments(readFileSync("lib/ai/risk.ts", "utf8"));

  check(
    "🔴 35.3 the classifier's schema has no level, score or severity to fill in",
    !/"(level|severity|score|risk_level)"\s*:/.test(classifier) &&
      !/\blevel\b\s*:\s*(string|number)/.test(classifier),
    "the model is never asked how serious it is",
  );

  check(
    "🔴 35.3 the ladder reads indicator NAMES and nothing else a model returned",
    (() => {
      const ladder = stripComments(readFileSync("lib/crisis/level.ts", "utf8"));
      /* A level computed from a confidence is a level a model decided. */
      return !/confidence/.test(ladder.replace(/confidence: number;/, ""));
    })(),
    "no confidence, no free text, no model output beyond the indicator",
  );

  const critical = levelFor(
    [
      { indicator: "ideation", quote: "x", confidence: 0.01 },
      { indicator: "plan", quote: "x", confidence: 0.01 },
      { indicator: "means", quote: "x", confidence: 0.01 },
    ],
    [],
  );
  check(
    "🔴 35.3 …so a finding at confidence 0.01 counts exactly as much as one at 0.99",
    critical === "critical",
    `${critical} at 0.01 confidence`,
  );

  /* ---------------------------------------------------- 35.2 · the keyword floor */

  check(
    "🔴 35.2 an empty classification cannot lower the keyword floor",
    levelFor([], ["want to die"]) === "elevated" &&
      levelFor([{ indicator: "protective_factor", quote: "x", confidence: 1 }], ["want to die"]) ===
        "elevated",
    "a model outage leaves exactly the old behaviour",
  );

  check(
    "35.2 …and the model can still raise it",
    levelFor(
      [
        { indicator: "ideation", quote: "x", confidence: 0.5 },
        { indicator: "plan", quote: "x", confidence: 0.5 },
      ],
      ["want to die"],
    ) === "high",
  );

  check(
    "🔴 35.2 the phrase list still reads Arabic, unchanged by this sprint",
    scanForCrisisLanguage("أتمنى أن أموت").length > 0 &&
      scanForCrisisLanguage("أنا ميت من التعب").length === 0,
  );

  /* --------------------------------------------------- C170 · the import graph */

  const CONTEXT = /lib\/(data\/facts|clinical\/context|data\/summaries|data\/memory)\.ts$/;
  const leak = reaches("lib/ai/risk.ts", CONTEXT);

  check(
    "🔴 C170 the classifier cannot reach prior context, directly or through what it imports",
    leak === null,
    leak ? `lib/ai/risk.ts -> ${leak.join(" -> ")}` : "walked to its imports, no route to the record",
  );

  /*
   * 🔴 The control. A walk that finds nothing proves nothing until it is shown
   * finding something, and this is the exact shape the mistake would take: a
   * helper that reads "a bit of history for the prompt".
   */
  const planted = "lib/ai/_verify35-helper.ts";
  const plantedEntry = "lib/ai/_verify35-entry.ts";
  try {
    writeFileSync(planted, 'import { factsFor } from "@/lib/data/facts";\nexport const f = factsFor;\n');
    writeFileSync(
      plantedEntry,
      'import { f } from "./_verify35-helper";\nexport const g = f;\n',
    );
    const caught = reaches(plantedEntry, CONTEXT);
    check(
      "🔴 C170 CONTROL, the same walk FINDS a classifier that reaches the record two hops away",
      caught !== null,
      caught ? `${plantedEntry} -> ${caught.join(" -> ")}` : "THE WALK IS BLIND",
    );
  } finally {
    rmSync(planted, { force: true });
    rmSync(plantedEntry, { force: true });
  }

  check(
    "🔴 C170 …and the prior history reaches the CLINICIAN, from a different module",
    /export async function priorRiskFor/.test(
      readFileSync("lib/data/session-risk.ts", "utf8"),
    ) && !/priorRiskFor|latestAssessment/.test(classifier),
    "priorRiskFor lives beside the screen, not beside the prompt",
  );

  /* ------------------------------------------------- 35.1 · no quote, no finding */

  const transcript = "Patient: I have written letters and put them in the drawer.";
  const { kept, dropped } = traceable(
    [
      { indicator: "plan", quote: "I have written letters", confidence: 0.8 },
      { indicator: "ideation", quote: "he seemed hopeless throughout", confidence: 0.95 },
    ],
    transcript,
  );

  check(
    "🔴 35.1 a finding that cannot quote the transcript is DROPPED, at any confidence",
    dropped === 1 && kept.length === 1 && kept[0]!.indicator === "plan",
    `kept ${kept.length}, dropped ${dropped} (the 0.95 one)`,
  );

  check(
    "35.1 every indicator the prompt lists is one the ladder knows",
    (() => {
      const prompt = readFileSync("lib/ai/risk.ts", "utf8");
      return RISK_INDICATORS.every((indicator) => prompt.includes(`- ${indicator}:`));
    })(),
    `${RISK_INDICATORS.length} indicators`,
  );

  check(
    "🔴 35.1 a plan with no stated ideation still alerts, which is the case the list cannot reach",
    shouldAlert(levelFor([{ indicator: "plan", quote: "x", confidence: 0.6 }], [])),
  );

  check(
    "🔴 35.1 a protective factor NEVER lowers a level",
    levelFor([
      { indicator: "ideation", quote: "x", confidence: 1 },
      { indicator: "plan", quote: "x", confidence: 1 },
      { indicator: "protective_factor", quote: "x", confidence: 1 },
    ]) === levelFor([
      { indicator: "ideation", quote: "x", confidence: 1 },
      { indicator: "plan", quote: "x", confidence: 1 },
    ]),
  );

  /* ------------------------------------------------ 35.3 · the pipeline untouched */

  const alerts = stripComments(readFileSync("lib/crisis/alerts.ts", "utf8"));
  check(
    "🔴 35.3 raiseCrisisAlert still writes pending BEFORE notifying and delivered after",
    alerts.indexOf("alertStatus: \"pending\"") < alerts.indexOf("delivered") &&
      /DEDUP_WINDOW_MS/.test(alerts),
    "dedup, write ordering and the sweeper are as sprint 3 left them",
  );

  check(
    "🔴 35.3 …and the crisis scanner still calls no model",
    !/openai\(\)|classifyRisk/.test(alerts),
    "lib/crisis stays a phrase list, so a patient's journal write waits on nothing",
  );

  /* ------------------------------------------------------- the schema, applied */

  const cols = await db.execute(sql`
    SELECT column_name FROM information_schema.columns
    WHERE table_name = 'risk_assessments'`);
  const names = cols.rows.map((row) => (row as { column_name: string }).column_name);

  check(
    "35.1 the findings, the model and the dropped count are columns on the row",
    ["findings", "model", "unquoted_findings"].every((column) => names.includes(column)),
    `${names.length} columns`,
  );

  const unvalidated = await db.execute(sql`
    SELECT count(*)::int AS n FROM pg_constraint WHERE NOT convalidated`);
  check(
    "H1 no unvalidated constraint anywhere in the database",
    (unvalidated.rows[0] as { n: number }).n === 0,
    `${(unvalidated.rows[0] as { n: number }).n} unvalidated`,
  );

  /* 🔴 The constraint, proved by attempting the write. */
  const refused = await (async () => {
    try {
      await db.insert(riskAssessments).values({
        sessionId: "00000000-0000-0000-0000-000000000000",
        organizationId: "00000000-0000-0000-0000-000000000000",
        therapistId: "00000000-0000-0000-0000-000000000000",
        level: "elevated",
        source: "model",
        model: null,
      });
      return false;
    } catch (error) {
      /* A foreign key failure would prove nothing about the CHECK. */
      return /risk_assessments_model_named/.test(String(error));
    }
  })();

  check(
    "🔴 35.1 a model row that does not say which model is REFUSED",
    refused,
    refused ? "risk_assessments_model_named" : "it was accepted, or failed for another reason",
  );

  /* Nothing was written: every attempt above is expected to fail. */
  const strays = await db
    .select({ id: riskAssessments.id })
    .from(riskAssessments)
    .where(eq(riskAssessments.sessionId, "00000000-0000-0000-0000-000000000000"));
  check("35.x the verifier left no rows behind", strays.length === 0);

  /* --------------------------------------------------- the module is in the list */

  const surfaces = readFileSync("evals/coverage.ts", "utf8");
  check(
    "32.2 the new model surface is measured, not merely added",
    /"lib\/ai\/risk\.ts", suite: "risk-model"/.test(surfaces),
  );

  const files = readdirSync("evals/suites");
  check(
    "35.1 the suite exists and reports per language, never averaged (C159)",
    files.includes("risk-model.ts") &&
      /risk\.combined\.sensitivity\.ar/.test(readFileSync("evals/suites/risk-model.ts", "utf8")),
  );

  finish("Sprint 35");
}

void main();
