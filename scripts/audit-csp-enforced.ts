/**
 * 🔴 80.4 — WOULD ENFORCING THE POLICY BREAK THE PRODUCT? ASKED IN A BROWSER.
 *
 *     npm run audit:csp-enforced          # needs a build and a running server
 *
 * ## Why this exists rather than a source check
 *
 * `verify:csp` proves the policy has the right SHAPE: a nonce, `strict-dynamic`,
 * no `'unsafe-inline'` in `script-src`, the Daily hosts that the downloaded
 * bundle actually needs. Every one of those is a fact about a string.
 *
 * None of them answers the only question that matters on the day somebody
 * deletes `CSP_ENFORCE` from Vercel: **does a real browser, loading the real
 * pages, refuse anything?** A policy can be perfectly shaped and still block one
 * font, one image host or one inline handler that nobody remembered, and the
 * symptom is a white screen or a dead button in front of a patient.
 *
 * Report-only mode was supposed to answer this by sending violation reports, and
 * it cannot: the policy carries no `report-uri` and no `report-to`, so for as
 * long as it has been running in report-only on production **nothing has been
 * collecting the reports**. The browser logged each refusal to a console nobody
 * had open. That is the gap this closes.
 *
 * ## What it does
 *
 * Loads each public page under the ENFORCING header, with a real Chromium, and
 * fails on any console message that is a CSP refusal. `videoRoom` is exercised
 * separately because that route is the one relaxation in the whole policy.
 *
 * ## 🔴 WHAT IT CANNOT SEE, SAID RATHER THAN IMPLIED
 *
 * It loads pages as a stranger. A screen behind a sign-in, and anything that
 * only runs after somebody clicks, is not covered. The clinician's room is the
 * important one of those and it is why `'unsafe-eval'` is scoped to that route
 * rather than hoped about: `docs/DAILY-HOSTS.md` is the audit that stands in for
 * a browser there.
 */
import { spawn } from "node:child_process";

import { launchOptions } from "./_browser";
import { reporter } from "./_verify";

const { check, skipUnless, finish } = reporter();

const PORT = 3111;
const BASE = `http://127.0.0.1:${String(PORT)}`;

/**
 * The public surface, plus the two that carry the most machinery.
 *
 * Derived rather than typed would be better (T3), and `inventory.routes()` is
 * the derivation. It is not used here because most of those 125 routes are
 * behind a sign-in and would report a redirect rather than a page, which is a
 * gate measuring the harness. These are the ones a stranger actually loads.
 */
const PAGES = [
  "/",
  "/for-therapists",
  "/for-patients",
  "/for-companies",
  "/for-clinics",
  "/pricing",
  "/how-it-works",
  "/radar",
  "/login",
  "/patient/login",
  "/staff/sign-in",
  "/clinic/sign-in",
  "/sponsor/sign-in",
  "/support",
  "/privacy",
  "/terms",
  "/security",
  "/compliance",
  "/contact",
];

/** A console line the browser writes when the policy refused something. */
function isViolation(text: string): boolean {
  return /Content Security Policy|Refused to (load|execute|apply|connect|frame|evaluate)/i.test(
    text,
  );
}

async function main() {
  let chromium: typeof import("playwright").chromium;
  try {
    ({ chromium } = await import("playwright"));
  } catch {
    await skipUnless(false, "a machine with playwright", "playwright is not installed", () => {});
    finish("csp enforced");
    return;
  }

  /*
   * 🔴 `CSP_ENFORCE` IS DELETED FROM THE CHILD, NOT SET TO 1.
   *
   * `cspHeaderName()` reads `process.env.CSP_ENFORCE === "0"`, so the enforcing
   * state is the ABSENCE of the variable. Setting it to "1" would also enforce
   * and would test a state production will never be in: the founder's change is
   * a deletion. Testing the state you are about to create is the whole point.
   */
  const env: NodeJS.ProcessEnv = { ...process.env, PORT: String(PORT) };
  delete env.CSP_ENFORCE;

  const server = spawn("npm", ["run", "start", "--", "--port", String(PORT)], {
    env,
    stdio: "ignore",
  });

  /*
   * 🔴 `launchOptions()`, NOT a bare launch. `scripts/_browser.ts` resolves the
   * Chromium this environment actually ships, which is a different build from
   * the one the pinned Playwright expects. Thirteen tests were recorded as
   * "no headless shell" for four sprints and the real cause was that version
   * mismatch; a bare launch here would reproduce it.
   */
  const browser = await chromium.launch(launchOptions());
  const violations: string[] = [];
  let loaded = 0;

  try {
    /* Wait for the server, rather than sleeping a guessed number of seconds. */
    const deadline = Date.now() + 90_000;
    for (;;) {
      try {
        const res = await fetch(BASE, { signal: AbortSignal.timeout(3_000) });
        if (res.ok) break;
      } catch {
        /* not up yet */
      }
      if (Date.now() > deadline) throw new Error("the server never answered");
      await new Promise((r) => setTimeout(r, 1_000));
    }

    /*
     * 🔴 THE HEADER IS CHECKED BEFORE ANYTHING IS CONCLUDED FROM THE PAGES.
     *
     * A run against a server still in report-only would load every page, see no
     * refusals because nothing was being refused, and report a clean sweep. That
     * is the T2 shape exactly: a green line meaning "enforcing and clean" and
     * one meaning "I measured the wrong server" look identical.
     */
    const head = await fetch(BASE);
    const enforcing = head.headers.get("content-security-policy");
    const reportOnly = head.headers.get("content-security-policy-report-only");
    check(
      "🔴 the server under test is ENFORCING, not report-only",
      Boolean(enforcing) && !reportOnly,
      enforcing ? "content-security-policy" : `report-only: ${String(Boolean(reportOnly))}`,
    );

    const page = await browser.newPage();
    page.on("console", (message) => {
      const text = message.text();
      if (isViolation(text)) violations.push(`${page.url()}: ${text}`);
    });
    page.on("pageerror", (error) => {
      if (isViolation(error.message)) violations.push(`${page.url()}: ${error.message}`);
    });

    for (const path of PAGES) {
      const response = await page.goto(`${BASE}${path}`, {
        waitUntil: "networkidle",
        timeout: 45_000,
      });
      if (response && response.status() < 400) loaded += 1;
      else violations.push(`${path}: answered ${String(response?.status() ?? "nothing")}`);
    }

    check(
      "🔴 every public page loads with the policy ENFORCING and refuses nothing",
      violations.length === 0,
      violations.length === 0
        ? `${String(loaded)} of ${String(PAGES.length)} pages, no refusal in any console`
        : violations.slice(0, 8).join(" · ") +
          (violations.length > 8 ? ` · and ${String(violations.length - 8)} more` : ""),
    );

    /*
     * 🔴 CONTROL — the listener can hear a refusal, or the line above is a
     * report about a browser that was never listening.
     *
     * An inline script with no nonce is exactly what the policy exists to
     * refuse, so it must be refused. If this passes, "no violations" above means
     * no violations rather than no listening.
     */
    const before = violations.length;
    await page.setContent(
      `<html><head><meta http-equiv="Content-Security-Policy" content="script-src 'none'">` +
        `</head><body><script>window.__planted = 1</script></body></html>`,
    );
    await page.waitForTimeout(500);

    check(
      "🔴 CONTROL a script the policy should refuse IS refused, and heard",
      violations.length > before,
      violations.length > before
        ? "planted an unnonced inline script, the console said so"
        : "the listener heard nothing, so the sweep above proves nothing",
    );
  } finally {
    await browser.close();
    server.kill();
  }

  finish("csp enforced");
}

void main();
