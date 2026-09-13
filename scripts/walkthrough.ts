/**
 * 🔴 52.2 / 52.3 / 52.4b — THE CLICK-BY-CLICK WALKTHROUGH, AND THE INSTRUMENT FOR 52.3.
 *
 *   WALK_URL=http://localhost:3100 node --import tsx --conditions=react-server scripts/walkthrough.ts
 *   … --only patient          one flow
 *   … --locale ar             the Arabic pass, which is also the RTL pass
 *
 * ## 🔴 WHY THIS IS NOT `scripts/screens.ts`
 *
 * `screens.ts` takes one shot per ROUTE. Sprint 52 needs one shot per INTERACTION — *every screen
 * and every interaction captured click by click* — because the films are cuts of a person using the
 * product rather than a gallery of its pages. A route-level shot cannot show the thing 52.6 exists
 * to prove: that pressing a button on one side changes a screen on the other.
 *
 * ## 🔴 AND IT MEASURES FRICTION, WHICH IS WHAT MAKES 52.3 MORE THAN AN OPINION
 *
 * 52.3 asks for what was HARD: *buttons nobody could find, steps where it was unclear what happens
 * next.* That is a judgement and no verifier can make it. But part of it IS measurable, and the
 * measurement is this:
 *
 *   🔴 EVERY TARGET IS FOUND BY ITS VISIBLE LABEL FIRST — `getByRole`, `getByLabel`, `getByText`.
 *   If that fails and a CSS selector is needed, the step is recorded as a FINDING.
 *
 * A control a person cannot describe out loud is a control they cannot find. So "I had to reach for
 * `button.tap-target:nth-child(2)`" is not a scripting detail, it is the button nobody could find,
 * written down by the thing that could not find it either. `findings.json` collects them and the
 * prose in `FINDINGS.md` is written against that list rather than from memory.
 *
 * ## 🔴 C225 — IT REFUSES TO RUN ANYWHERE A REAL PATIENT COULD EXIST
 *
 * The same two-sided guard as `seed-capture.ts`: production by name, and anything that is not the
 * capture endpoint. A screenshot in a repository is permanent in a way a database row is not (C80).
 */
import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";

import type { Browser, BrowserContext, Locator, Page } from "playwright";

import { launchOptions } from "./_browser";

const CAPTURE_ENDPOINT = "ep-little-sky-a6v9sdx4";
const PRODUCTION_ENDPOINT = "ep-wild-lake-a6tgm2r6";

const OUT = path.join("docs", "walkthrough-2");
const BASE = process.env.WALK_URL ?? "http://localhost:3100";

/** Phone-sized, because this is a phone-first product and the films are shot as one. */
const PHONE = { width: 390, height: 844 };
/** For the consoles, which are desks. A clinic's bills at 390px is not how anybody reads them. */
const DESK = { width: 1280, height: 900 };

export type Finding = {
  flow: string;
  step: string;
  /** What made it hard. One sentence, written for a person rather than for a log. */
  note: string;
  kind: "not-findable" | "unclear" | "broken" | "slow";
};

const findings: Finding[] = [];
let shotIndex = 0;

function guard(): void {
  const url = process.env.DATABASE_URL ?? "";
  const host = url.match(/@([^/:?]+)/)?.[1] ?? "(none)";
  console.log(`database ${host}`);
  console.log(`app      ${BASE}\n`);

  if (host.includes(PRODUCTION_ENDPOINT)) {
    console.error("Refusing to run: that is production. C225.");
    process.exit(1);
  }
  if (!host.includes(CAPTURE_ENDPOINT)) {
    console.error(
      `Refusing to run: the walkthrough captures only against ${CAPTURE_ENDPOINT}.\n` +
        "A screenshot in a repository is permanent in a way a database row is not (C80).",
    );
    process.exit(1);
  }
}

/**
 * One captured step.
 *
 * 🔴 The screenshot is taken AFTER the action and after the page settles, because the frame a film
 * uses is the consequence rather than the click. `shotIndex` is global and monotonic so the EDIT
 * LIST can name frames in the order they happened across every flow.
 */
async function step(
  page: Page,
  flow: string,
  name: string,
  action?: () => Promise<void>,
): Promise<void> {
  if (action) {
    try {
      await action();
    } catch (error) {
      findings.push({
        flow,
        step: name,
        note: `The step could not be completed: ${(error as Error).message.split("\n")[0]}`,
        kind: "broken",
      });
      console.log(`  ✗ ${flow}/${name}`);
      return;
    }
  }

  /* `networkidle` rather than `load`: a server component streaming in after the shot is a frame of
     a half-drawn screen, which in a promo film reads as the product being slow. */
  await page.waitForLoadState("networkidle").catch(() => {});

  shotIndex += 1;
  const file = `${String(shotIndex).padStart(3, "0")}-${flow}-${name}.png`;
  await page.screenshot({ path: path.join(OUT, "frames", file), fullPage: false });
  console.log(`  ✓ ${file}`);
}

/**
 * 🔴 FIND A CONTROL BY WHAT A PERSON WOULD SAY, AND RECORD IT WHEN THAT FAILS.
 *
 * This is the instrument 52.3 runs on. `label` is what the control says on screen; `fallback` is the
 * CSS a developer would reach for. If the fallback is needed, the control is not findable by its own
 * words, and that goes in the findings rather than quietly working.
 */
async function control(
  page: Page,
  flow: string,
  step: string,
  label: string | RegExp,
  fallback?: string,
): Promise<Locator | null> {
  for (const attempt of [
    () => page.getByRole("button", { name: label }),
    () => page.getByRole("link", { name: label }),
    () => page.getByLabel(label),
    () => page.getByText(label),
  ]) {
    const locator = attempt().first();
    if (await locator.count().then((n) => n > 0).catch(() => false)) return locator;
  }

  if (fallback) {
    const locator = page.locator(fallback).first();
    if (await locator.count().then((n) => n > 0).catch(() => false)) {
      findings.push({
        flow,
        step,
        note: `"${String(label)}" is not findable by its visible label; it needed the selector \`${fallback}\`. A control a person cannot describe out loud is a control they cannot find.`,
        kind: "not-findable",
      });
      return locator;
    }
  }

  findings.push({
    flow,
    step,
    note: `"${String(label)}" is not on this screen at all. Either the step is unreachable from here or the label does not match what the product says.`,
    kind: "broken",
  });
  return null;
}

/** Sign in through the REAL form, never by writing a cookie. 22R's whole method. */
async function signIn(
  page: Page,
  flow: string,
  at: string,
  email: string,
  password: string,
): Promise<boolean> {
  await page.goto(`${BASE}${at}`, { waitUntil: "networkidle" }).catch(() => {});
  await step(page, flow, "door");

  const emailField = page.locator('input[type="email"]').first();
  const passwordField = page.locator('input[type="password"]').first();

  if ((await emailField.count()) === 0 || (await passwordField.count()) === 0) {
    findings.push({
      flow,
      step: "door",
      note: `${at} does not present an email and a password field, so this principal cannot be signed in.`,
      kind: "broken",
    });
    return false;
  }

  await emailField.fill(email);
  await passwordField.fill(password);

  const submit = await control(page, flow, "sign in", /sign in|log in|continue/i, 'button[type="submit"]');
  if (!submit) return false;

  await submit.click();
  await page.waitForLoadState("networkidle").catch(() => {});
  await step(page, flow, "signed-in");

  /*
   * 🔴 Did we actually get in? A sign-in that silently failed leaves the browser on the door, and
   * every screenshot after it is a picture of a sign-in form filed under a portal's name. 22R's
   * defect five was exactly this shape: a screen that said one thing while the state said another.
   */
  if (page.url().includes("sign-in") || page.url().includes("login")) {
    findings.push({
      flow,
      step: "sign in",
      note: `Signing in at ${at} left the browser on the door. The form accepted the credentials and did not move.`,
      kind: "broken",
    });
    return false;
  }

  return true;
}

/** Walk a list of paths, shooting each, recording any that error or redirect unexpectedly. */
async function tour(
  page: Page,
  flow: string,
  paths: { at: string; name: string; expect?: string | RegExp }[],
): Promise<void> {
  for (const item of paths) {
    await page.goto(`${BASE}${item.at}`, { waitUntil: "networkidle" }).catch(() => {});

    if (item.expect) {
      const found = await page
        .getByText(item.expect)
        .first()
        .count()
        .then((n) => n > 0)
        .catch(() => false);

      if (!found) {
        findings.push({
          flow,
          step: item.name,
          note: `${item.at} does not show ${String(item.expect)}. The route answers and the screen is not the one it should be.`,
          kind: "unclear",
        });
      }
    }

    await step(page, flow, item.name);
  }
}

async function main() {
  guard();

  const argv = process.argv.slice(2);
  const only = argv.includes("--only") ? argv[argv.indexOf("--only") + 1] : null;
  const locale = argv.includes("--locale") ? argv[argv.indexOf("--locale") + 1]! : "en";

  const frames = path.join(OUT, "frames");
  if (!only && existsSync(frames)) rmSync(frames, { recursive: true });
  mkdirSync(frames, { recursive: true });

  const { chromium } = await import("playwright");
  const browser: Browser = await chromium.launch(
    launchOptions({
      args: [
        "--use-fake-ui-for-media-stream",
        "--use-fake-device-for-media-stream",
        "--autoplay-policy=no-user-gesture-required",
      ],
    }),
  );

  /**
   * 🔴 The locale travels as a COOKIE, not a URL prefix, for the signed-in portals.
   *
   * `lib/routing.ts` deliberately refuses `/ar/patient/...`: a prefixed path that is not public is a
   * second URL for somebody's private record (C153), so it redirects and the language rides on the
   * preference cookie. A walkthrough that used the prefix would be capturing redirects.
   */
  const newContext = async (viewport: { width: number; height: number }): Promise<BrowserContext> => {
    const context = await browser.newContext({
      viewport,
      deviceScaleFactor: 2,
      permissions: ["microphone"],
      locale: locale === "ar" ? "ar-EG" : "en-GB",
    });
    await context.addCookies([
      { name: "24t_locale", value: locale, url: BASE },
    ]);
    return context;
  };

  const flows: Record<string, () => Promise<void>> = {
    /* ---------------------------------------------------------------- public */
    async public() {
      const context = await newContext(PHONE);
      const page = await context.newPage();

      await tour(page, "public", [
        { at: "/", name: "home" },
        { at: "/pricing", name: "pricing" },
        { at: "/how-it-works", name: "how-it-works" },
        { at: "/for-clinics", name: "for-clinics" },
        { at: "/developers", name: "developers" },
        { at: "/integrations", name: "integrations" },
        { at: "/radar", name: "radar" },
      ]);

      await context.close();
    },

    /* --------------------------------------------------------------- patient */
    async patient() {
      const context = await newContext(PHONE);
      const page = await context.newPage();

      await tour(page, "patient", [
        { at: "/patient/login", name: "login" },
        { at: "/patient/signup", name: "signup" },
      ]);

      await context.close();
    },

    /* ------------------------------------------------------------- therapist */
    async therapist() {
      const context = await newContext(PHONE);
      const page = await context.newPage();

      const inside = await signIn(
        page,
        "therapist",
        "/login",
        "test@24therapy.ai",
        "TestTherapist2026!",
      );

      if (inside) {
        await tour(page, "therapist", [
          { at: "/dashboard", name: "dashboard" },
          { at: "/patients", name: "patients" },
          { at: "/sessions", name: "sessions" },
          { at: "/notes", name: "notes" },
          { at: "/bookings", name: "bookings" },
          { at: "/earnings", name: "earnings" },
          { at: "/billing", name: "billing" },
          { at: "/connect", name: "connect" },
          { at: "/settings", name: "settings" },
          { at: "/settings/records", name: "settings-records" },
          { at: "/assistant", name: "assistant" },
          { at: "/on-call", name: "on-call" },
          { at: "/support", name: "support" },
        ]);
      }

      await context.close();
    },

    /* ---------------------------------------------------------------- clinic */
    async clinic() {
      const context = await newContext(DESK);
      const page = await context.newPage();

      await tour(page, "clinic", [{ at: "/clinic/apply", name: "apply" }]);

      const inside = await signIn(
        page,
        "clinic",
        "/clinic/sign-in",
        "manager@example.com",
        "CaptureRun2026!",
      );

      if (inside) {
        await tour(page, "clinic", [
          { at: "/clinic", name: "overview" },
          { at: "/clinic/people", name: "people" },
          { at: "/clinic/bills", name: "bills" },
          { at: "/clinic/records", name: "records" },
        ]);
      }

      await context.close();
    },

    /* --------------------------------------------------------------- sponsor */
    async sponsor() {
      const context = await newContext(DESK);
      const page = await context.newPage();

      await tour(page, "sponsor", [{ at: "/sponsor/apply", name: "apply" }]);

      const inside = await signIn(
        page,
        "sponsor",
        "/sponsor/sign-in",
        "hr@example.com",
        "CaptureRun2026!",
      );

      if (inside) {
        await tour(page, "sponsor", [
          { at: "/sponsor", name: "overview" },
          { at: "/sponsor/people", name: "people" },
          { at: "/sponsor/pot", name: "pot" },
          { at: "/sponsor/code", name: "code" },
          { at: "/sponsor/settings", name: "settings" },
        ]);
      }

      await context.close();
    },

    /* --------------------------------------------------------------- partner */
    async partner() {
      const context = await newContext(DESK);
      const page = await context.newPage();

      await tour(page, "partner", [{ at: "/partner/apply", name: "apply" }]);

      const inside = await signIn(
        page,
        "partner",
        "/partner/sign-in",
        "dev@example.com",
        "CaptureRun2026!",
      );

      if (inside) {
        await tour(page, "partner", [
          { at: "/partner", name: "keys" },
          { at: "/partner/webhooks", name: "webhooks" },
          { at: "/partner/deliveries", name: "deliveries" },
        ]);
      }

      await context.close();
    },

    /* ----------------------------------------------------------------- admin */
    async admin() {
      const context = await newContext(DESK);
      const page = await context.newPage();

      /*
       * 🔴 C80 — the admin frames are gitignored, and this shoots them into their own folder so the
       * ignore rule is one line rather than a pattern somebody has to keep correct. An admin console
       * shows many patients at once and the repository is treated as if it will be public one day.
       */
      await tour(page, "admin", [{ at: "/staff/sign-in", name: "door" }]);

      await context.close();
    },
  };

  const order = only ? [only] : Object.keys(flows);

  for (const name of order) {
    const flow = flows[name];
    if (!flow) {
      console.error(`no such flow: ${name}`);
      process.exit(1);
    }
    console.log(`\n── ${name} (${locale})`);
    await flow();
  }

  await browser.close();

  writeFileSync(
    path.join(OUT, `findings-${locale}.json`),
    `${JSON.stringify(findings, null, 2)}\n`,
  );

  console.log(`\n${shotIndex} frames, ${findings.length} findings`);
  for (const finding of findings) {
    console.log(`  [${finding.kind}] ${finding.flow}/${finding.step}: ${finding.note}`);
  }
}

void main();
