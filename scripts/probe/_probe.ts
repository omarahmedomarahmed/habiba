/**
 * 🔴 76.58 — THE MINI SIMULATION'S HARNESS.
 *
 * ## What this is for, in one sentence
 *
 * Before twenty agents spend six months and ten dollars of model credit walking
 * the product on production, ONE run walks the main path of each user type on
 * the dev branch and reports what it hit.
 *
 * ## 🔴 THE MAIN PATH ONLY, AND THAT IS THE DESIGN
 *
 * Not edge cases. `09-THE-EDGES.md` has thirty of those and they are the six
 * month run's job. What this answers is narrower and comes first: *can a
 * therapist sign up, can a patient pay, does a session produce a note, does
 * money come out, can the operator clear a queue.* An obstacle in one of those
 * stops a wave; an edge case produces a finding.
 *
 * ## 🔴 EVERY CLAIM CARRIES A ROW ID, or it is not a claim
 *
 * "The payment went through" is what a screen says. What this records is the
 * `manual_payments` row it produced, by id, read back out of the database after
 * the browser did the pressing. The two together are evidence; either alone is
 * a screenshot or a fixture.
 *
 * ## 🔴 AND IT REFUSES PRODUCTION
 *
 * `writesTo()` with no argument. This signs people up, takes payments and
 * uploads receipts. On production that is a cast of invented people on the
 * founders' own board with nothing to sweep them up, and the six month run's
 * own cast is the one that belongs there.
 */
import type { Browser, BrowserContext, Page } from "playwright";

import { chromiumExecutable } from "../_browser";

export const BASE = process.env.PROBE_URL ?? "http://127.0.0.1:3412";

/**
 * 🔴 SURNAME `Probe`, NOT `Demo` OR `Example`.
 *
 * `verify:synthetic` accepts Demo and Example because those are the six month
 * cast's surnames. A third surname, used only here, means a `Probe` row on any
 * database is a row this rehearsal left behind and can be swept by name — and
 * that a Probe turning up in the six month run's evidence is immediately
 * legible as a mistake rather than as a patient.
 */
export const SURNAME = "Probe";
export const PASSWORD = "Probe2026!";

export function emailFor(first: string): string {
  return `${first.toLowerCase()}.${SURNAME.toLowerCase()}@example.com`;
}

/* ------------------------------------------------------------- reporting -- */

export type Finding = {
  flow: string;
  step: string;
  /** `ok` walked, `blocked` could not go on, `defect` went on and was wrong. */
  state: "ok" | "blocked" | "defect";
  /** What was seen, in a sentence somebody who was not here can read. */
  saw: string;
  /** 🔴 The row that proves it, or null where the claim is about an absence. */
  evidence: string | null;
};

const findings: Finding[] = [];

export function record(finding: Finding): void {
  findings.push(finding);
  const mark = finding.state === "ok" ? "  ok  " : finding.state === "blocked" ? " BLOCK" : " DEFECT";
  console.log(`${mark}  ${finding.flow} · ${finding.step}`);
  console.log(`         ${finding.saw}`);
  if (finding.evidence) console.log(`         evidence: ${finding.evidence}`);
}

export function report(): Finding[] {
  const blocked = findings.filter((f) => f.state === "blocked");
  const defects = findings.filter((f) => f.state === "defect");

  console.log(`\n${"-".repeat(72)}`);
  console.log(
    `  ${String(findings.length)} steps · ${String(findings.length - blocked.length - defects.length)} ok · ` +
      `${String(blocked.length)} blocked · ${String(defects.length)} defects\n`,
  );

  for (const f of [...blocked, ...defects]) {
    console.log(`  🔴 ${f.flow} · ${f.step}`);
    console.log(`     ${f.saw}\n`);
  }

  return findings;
}

/* --------------------------------------------------------------- driving -- */

export async function openBrowser(): Promise<Browser> {
  const { chromium } = await import("playwright");
  return chromium.launch({ executablePath: chromiumExecutable() });
}

/**
 * A fresh, cookie-free context per person.
 *
 * 🔴 ONE CONTEXT PER PERSON, never one page reused. Five of this product's six
 * principals are a different cookie, and a therapist's session left in the jar
 * while a patient signs up is how a probe "proves" a flow that a real stranger
 * could not walk.
 */
export async function asPerson(browser: Browser, who: string): Promise<{ ctx: BrowserContext; page: Page }> {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 1000 } });
  const page = await ctx.newPage();
  page.on("pageerror", (error) => {
    record({
      flow: who,
      step: "the page threw",
      state: "defect",
      saw: error.message.slice(0, 200),
      evidence: null,
    });
  });
  return { ctx, page };
}

/** Navigate and say what came back, because a 500 is a finding rather than a throw. */
export async function go(page: Page, path: string): Promise<number> {
  const response = await page.goto(`${BASE}${path}`, { waitUntil: "domcontentloaded" });
  return response?.status() ?? 0;
}

/** The first visible text of the page, for a report somebody can read. */
export async function gist(page: Page, limit = 160): Promise<string> {
  const text = (await page.locator("body").innerText().catch(() => "")) ?? "";
  return text.replace(/\s+/g, " ").trim().slice(0, limit);
}

/**
 * 🔴 SCREENSHOTS GO TO A DIRECTORY NOTHING COMMITS.
 *
 * `scripts/demo.ts` warns that an operator frame from a database with
 * real-looking names is a disclosure. The dev branch carries gate residue with
 * surnames like `Mansour` and `Farouk`, so nothing photographed here is
 * committable, and the path says so.
 */
export const SHOTS = process.env.PROBE_SHOTS ?? ".probe-shots";

export async function shot(page: Page, name: string): Promise<void> {
  const { mkdirSync } = await import("node:fs");
  mkdirSync(SHOTS, { recursive: true });
  await page.screenshot({ path: `${SHOTS}/${name}.png`, fullPage: true });
}
