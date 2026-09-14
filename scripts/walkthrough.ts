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
import { existsSync, mkdirSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";

import type { Browser, BrowserContext, Locator, Page } from "playwright";

import { launchOptions } from "./_browser";
import { ar, en, type MessageKey } from "../lib/i18n/messages";

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

/**
 * 🔴 THE WALKTHROUGH ASKS THE PRODUCT WHAT ITS OWN WORDS ARE.
 *
 * The Arabic pass died on the therapist door: every target was an English string literal, so
 * `/sign in|log in|continue/i` found nothing on a page that says تسجيل الدخول — and then `getByText`
 * matched the `<title>` element, which is `Sign in · 24Therapy` in both languages and is invisible.
 * A hardcoded English label in a bilingual walkthrough is a check that can only ever pass in one
 * language, and the language it fails in is the one nobody was looking at.
 *
 * So the labels come from `lib/i18n/messages.ts`, the same catalogue the screens render from. That
 * also makes the walkthrough a coverage test of a kind no verifier gives: if a key is missing from
 * `ar`, the Arabic pass cannot find the control and records it as a finding.
 */
let words: Record<MessageKey, string> = en;

/** Where this run's frames go. Set in `main` from `--locale`; see the note there. */
let frameDir = path.join(OUT, "frames", "en");

/** One or more catalogue entries as an exact-match pattern in whichever language is being walked. */
function say(...keys: MessageKey[]): RegExp {
  const escaped = keys.map((key) => words[key].replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  return new RegExp(`^\\s*(${escaped.join("|")})\\s*$`, "i");
}

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
  await page.screenshot({ path: path.join(frameDir, file), fullPage: false });
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
  /*
   * 🔴 VISIBLE, NOT MERELY PRESENT.
   *
   * The first version asked only for `count() > 0`, and on the Arabic pass `getByText(/sign in/i)`
   * matched `<title>Sign in · 24Therapy</title>` — an element that exists, is never rendered, and is
   * in English on every page whatever the locale. It then tried to click it for thirty seconds.
   *
   * A control a person can use is a control a person can SEE, so visibility is part of the question
   * rather than a detail of the click. This also means an element hidden behind a collapsed section
   * is correctly reported as not findable, which is the answer 52.3 wants.
   */
  const usable = async (locator: Locator): Promise<boolean> =>
    locator
      .first()
      .isVisible({ timeout: 1_000 })
      .catch(() => false);

  for (const attempt of [
    () => page.getByRole("button", { name: label }),
    () => page.getByRole("link", { name: label }),
    () => page.getByLabel(label),
    () => page.getByText(label),
  ]) {
    const locator = attempt().first();
    if (await usable(locator)) return locator;
  }

  if (fallback) {
    const locator = page.locator(fallback).first();
    if (await usable(locator)) {
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

  /*
   * 🔴 THE IDENTITY FIELD IS FOUND BY ITS LABEL, BECAUSE IT IS NOT ALWAYS AN EMAIL FIELD.
   *
   * The first version looked for `input[type="email"]` and reported that `/patient/login` "does not
   * present an email and a password field, so this principal cannot be signed in". The field is
   * there; it says **Phone number or email** and is a plain text input, because a patient may have
   * signed up with either and `type="email"` would refuse a phone number.
   *
   * So the product is right and the instrument was wrong — again, and the same way: it asserted the
   * absence of a thing by looking for one particular spelling of it. Found by label now, which is
   * the discipline the rest of this file already runs on.
   */
  const identityField = await control(
    page,
    flow,
    "door",
    /*
     * 🔴 SIX DOORS, FOUR DIFFERENT WORDS FOR THE SAME FIELD.
     *
     * "Email" for a therapist, "Work email" for staff, "Phone number or email" for a patient. Each
     * is defensible on its own door — a patient may have no address, a staff member signs in with a
     * work one — and together they are the reason this pattern has to be a list rather than a word.
     * Recorded in FINDINGS.md as an observation rather than pushed as a finding, because the
     * alternative (one word everywhere) would make the patient door wrong.
     */
    /*
     * 🔴 SIX DOORS, FIVE DIFFERENT ENGLISH WORDS FOR ONE FIELD, AND ONE ARABIC WORD FOR ALL OF THEM.
     *
     * `tauth.email` is "Email", `tauth.workEmail` is "Work email", the clinic, sponsor and partner
     * doors each say "Email address", and the patient's says "Phone number or email". In Arabic all
     * five collapse to البريد الإلكتروني except the staff one, so the translated product is more
     * consistent than the English it was translated from. Recorded in FINDINGS.md as an observation:
     * "Phone number or email" is genuinely different (a patient may have no address) and the other
     * four are the same field wearing four labels.
     */
    say("tauth.email", "tauth.workEmail", "clinic.email", "sponsor.email", "dev.email", "pfield.handle"),
    'input[name="handle"], input[type="email"]',
  );
  const passwordField = await control(
    page,
    flow,
    "door",
    say("tauth.password", "clinic.password", "sponsor.password", "dev.password", "pfield.password"),
    'input[type="password"]',
  );

  if (!identityField || !passwordField) return false;

  await identityField.fill(email);
  await passwordField.fill(password);

  const submit = await control(
    page,
    flow,
    "sign in",
    say("tauth.signIn", "pauth.signIn", "clinic.signIn", "sponsor.signIn", "dev.signIn"),
    'button[type="submit"]',
  );
  if (!submit) return false;

  const started = Date.now();
  await submit.click();

  /*
   * 🔴 WAIT FOR THE CONSEQUENCE, NOT FOR THE NETWORK TO GO QUIET.
   *
   * The first version screenshotted after `waitForLoadState("networkidle")` and then read the URL.
   * Both of those are satisfied the instant the click returns, because a server action posts and the
   * navigation has not started yet — so every one of the four portals was recorded as "the form
   * accepted the credentials and did not move", with a frame of a button reading "One moment…".
   *
   * 🔴 That is the §6 shape aimed at my own instrument: a check that passed by measuring the wrong
   * thing, where the thing measured was the absence of a navigation that had not been given time to
   * begin. Four false findings is worse than none, because a findings pass nobody can trust is a
   * findings pass nobody reads. Signing in takes about 1.9s here, most of it password hashing.
   *
   * So this waits for the URL to LEAVE the door, and reports the real elapsed time. A door that
   * genuinely does not move still fails, now after thirty seconds rather than after zero.
   */
  const moved = await page
    .waitForURL((url) => !/\/(login|sign-in)$/.test(url.pathname), { timeout: 30_000 })
    .then(() => true)
    .catch(() => false);

  await page.waitForLoadState("networkidle").catch(() => {});
  await step(page, flow, "signed-in");

  /*
   * 🔴 Did we actually get in? A sign-in that silently failed leaves the browser on the door, and
   * every screenshot after it is a picture of a sign-in form filed under a portal's name. 22R's
   * defect five was exactly this shape: a screen that said one thing while the state said another.
   */
  if (!moved) {
    findings.push({
      flow,
      step: "sign in",
      note: `Signing in at ${at} left the browser on the door for thirty seconds. The form accepted the credentials and did not move.`,
      kind: "broken",
    });
    return false;
  }

  /*
   * 🔴 And how long it took is itself a finding, because 52.3 asks what was HARD and a door that
   * takes four seconds is a door a person presses twice. Recorded rather than judged: the number is
   * in the findings and the prose decides what it means.
   */
  const elapsed = Date.now() - started;
  if (elapsed > 3_000) {
    findings.push({
      flow,
      step: "sign in",
      note: `Signing in at ${at} took ${(elapsed / 1000).toFixed(1)}s before the screen changed. A door that slow is a door somebody presses twice.`,
      kind: "slow",
    });
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
    walked.add(item.at);
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

/**
 * 🔴 EVERY ROUTE IS WALKED, OR IT IS EXEMPT WITH A REASON.
 *
 * This instrument was written at sprint 52 and read at sprint 65: it visited 56 of the
 * product's 122 routes, and everything built in between was invisible to it. Not one of
 * the clinic's staff screens, neither of the sponsor's new ones, none of the partner's
 * usage, and six of eighteen admin consoles. The last walkthrough's design verdict on the
 * admin console was formed from that sixth.
 *
 * 🔴 A STALE INSTRUMENT IS WORSE THAN NO INSTRUMENT, because it reports a clean pass.
 * The same failure as a verifier nobody runs, one layer up: this one ran, and was silent
 * about two thirds of the product.
 *
 * So the route list is derived from the filesystem at startup and compared with what the
 * flows below actually visit. A route that is neither walked nor exempt stops the run,
 * which means the next portal somebody builds cannot be quietly left out of the walk.
 */
/** Every route this run actually visited. Filled by `tour`, read at the end. */
const walked = new Set<string>();

const NOT_WALKABLE: Record<string, string> = {
  "/(public)": "the route group, which is `/` and is walked",
  "/reset-password": "needs a live reset token, which only an email can produce",
};

function routesOnDisk(dir = "app", out: string[] = []): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const at = path.join(dir, entry.name);
    if (entry.isDirectory()) routesOnDisk(at, out);
    else if (entry.name === "page.tsx") {
      const route = at
        .replace(/^app/, "")
        .replace(/\/page\.tsx$/, "")
        .replace(/\/\([a-z-]+\)/g, "");
      out.push(route === "" ? "/" : route);
    }
  }
  return out;
}

function assertEveryRouteIsWalked(): void {
  const missed = routesOnDisk()
    /* A dynamic segment needs an id this script cannot invent; the flows reach them by
       clicking rather than by address, which is the point of a click-by-click walk. */
    .filter((route) => !route.includes("["))
    .filter((route) => !walked.has(route) && !(route in NOT_WALKABLE));

  if (missed.length === 0) {
    console.log(`  every route is walked or exempt (${walked.size} walked)\n`);
    return;
  }

  console.log("\n🔴 These routes exist and this walk does not visit them:\n");
  for (const route of missed.sort()) console.log(`    ${route}`);
  console.log(
    "\n  Add them to a flow, or to NOT_WALKABLE with a reason. If a sign-in failed above,\n" +
      "  fix that first: a flow that could not get in did not walk its screens either.\n",
  );
  process.exit(1);
}

async function main() {
  guard();

  const argv = process.argv.slice(2);
  const only = argv.includes("--only") ? argv[argv.indexOf("--only") + 1] : null;
  const locale = argv.includes("--locale") ? argv[argv.indexOf("--locale") + 1]! : "en";
  words = locale === "ar" ? ar : en;

  /*
   * 🔴 ONE FOLDER PER LANGUAGE, BECAUSE THE ARABIC PASS ATE THE ENGLISH ONE.
   *
   * The first version wrote every frame to `frames/` and cleared it at the start of a full run, so
   * `--locale ar` silently replaced all 75 English frames with 75 Arabic ones under identical names.
   * The edit list needs both — two of the four cuts are bilingual and the RTL pass is the whole point
   * of the Arabic one — and a capture that can only hold one language at a time is a capture that
   * has to be run twice and copied out by hand between runs.
   */
  frameDir = path.join(OUT, "frames", locale);
  if (!only && existsSync(frameDir)) rmSync(frameDir, { recursive: true });
  mkdirSync(frameDir, { recursive: true });

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
        /*
         * 🔴 THE FOUR AUDIENCE PAGES, and two of them are new since the last pass.
         *
         * `/for-companies` did not exist and `/for-patients` was never walked, which meant
         * the last walkthrough looked at a homepage that speaks to four people and then
         * checked one and a half of their pages.
         */
        { at: "/for-patients", name: "for-patients" },
        { at: "/for-companies", name: "for-companies" },
        { at: "/for-clinics", name: "for-clinics" },
        { at: "/developers", name: "developers" },
        { at: "/integrations", name: "integrations" },
        { at: "/contact", name: "contact" },
        { at: "/privacy", name: "privacy" },
        { at: "/terms", name: "terms" },
        { at: "/security", name: "security" },
        { at: "/hipaa", name: "hipaa" },
        { at: "/radar", name: "radar" },
        /* The doors a stranger meets, which nobody had photographed. */
        { at: "/signup", name: "signup" },
        { at: "/login", name: "login" },
        { at: "/forgot-password", name: "forgot-password" },
        { at: "/verify", name: "verify" },
      ]);

      await context.close();
    },

    /* --------------------------------------------------------------- patient */
    async patient() {
      const context = await newContext(PHONE);
      const page = await context.newPage();

      await tour(page, "patient", [
        { at: "/patient/signup", name: "signup" },
        { at: "/patient/login", name: "login" },
        { at: "/patient/forgot-password", name: "forgot-password" },
        { at: "/patient/claim", name: "claim" },
      ]);

      /*
       * 🔴 THE PORTAL THIS PRODUCT IS JUDGED ON, AND THE FIRST PASS NEVER OPENED IT.
       *
       * The first version of this flow shot `/patient/login` and `/patient/signup` and stopped,
       * because `patient_accounts` held zero rows and there was nobody to sign in as. Two pictures
       * of two doors, filed as the patient walkthrough. 37R.8 asks whether the patient app looks
       * like the best mental-health app anybody has built; two doors cannot answer that.
       */
      const inside = await signIn(
        page,
        "patient",
        "/patient/login",
        "layla.demo@example.com",
        "CaptureRun2026!",
      );

      if (inside) {
        await tour(page, "patient", [
          { at: "/patient", name: "home" },
          /*
           * 🔴 THE RADAR INSIDE THE APP, which the last pass never opened.
           *
           * It is the screen this product is named after and it gained a list view, so a
           * pass that shoots the public radar and not this one has seen neither the new
           * view nor the chrome a signed-in patient meets it in.
           */
          { at: "/patient/radar", name: "radar" },
          { at: "/patient/sessions", name: "sessions" },
          { at: "/patient/messages", name: "messages" },
          { at: "/patient/residency", name: "residency" },
          { at: "/patient/homework", name: "homework" },
          { at: "/patient/journal", name: "journal" },
          { at: "/patient/assessments", name: "assessments" },
          { at: "/patient/summary", name: "summary" },
          { at: "/patient/browse", name: "browse" },
          { at: "/patient/benefit", name: "benefit" },
          { at: "/patient/billing", name: "billing" },
          { at: "/patient/record", name: "record" },
          { at: "/patient/consent", name: "consent" },
          { at: "/patient/notices", name: "notices" },
          { at: "/patient/account", name: "account" },
          { at: "/patient/profile", name: "profile" },
        ]);
      }

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
          /* New since the last pass: the QR codes and the meeting connections. */
          { at: "/settings/codes", name: "settings-codes" },
          { at: "/settings/integrations", name: "settings-integrations" },
          { at: "/onboarding", name: "onboarding" },
          { at: "/sessions/new", name: "session-new" },
          { at: "/patients/import", name: "patients-import" },
          { at: "/copilot", name: "copilot" },
          { at: "/assistant", name: "assistant" },
          { at: "/on-call", name: "on-call" },
          { at: "/support", name: "support" },
        ]);
      }

      await context.close();
    },

    /* ------------------------------------------------------------------ room */
    /*
     * 🔴 THE ROOM RUNS HERE, AND ESTABLISHING THAT WAS A PRECONDITION OF SCRIPTING ANY CUT OF IT.
     *
     * `DAILY_API_KEY` is not configured in this container, and the open question was whether that
     * makes the session room unshootable. Walked directly rather than inferred:
     *
     *   * The room RENDERS, the clock runs, the status goes Live, the transcript pane opens and says
     *     "Listening…", the copilot appears, and there are no page errors.
     *   * The VIDEO TILE does not. In its place the product says, in its own words: **"Video is not
     *     configured — The session is still recorded and transcribed. Add a Daily.co API key to
     *     enable video calls."**
     *
     * So a cut of "The 24Therapy room" made here would put that banner on screen. That is a fact for
     * the edit list rather than a thing to work around: 52 forbids stubbing a service to make a film
     * look complete, and a black rectangle reading "video is not configured" is what this build
     * honestly is. The in-person path — *Record from this device*, which is the default and the
     * majority flow — has no such gap and is shot in full.
     */
    async room() {
      const context = await newContext(PHONE);
      const page = await context.newPage();

      const inside = await signIn(
        page,
        "room",
        "/login",
        "test@24therapy.ai",
        "TestTherapist2026!",
      );
      if (!inside) {
        await context.close();
        return;
      }

      await page.goto(`${BASE}/sessions/new`, { waitUntil: "networkidle" }).catch(() => {});
      await step(page, "room", "new");

      /*
       * 🔴 The patient picker is a `<select>`, so it is chosen by option label rather than clicked.
       * Recorded here rather than as a finding: a native select IS the findable control on a phone,
       * and 41.2's derived "Where" question above it is the one that replaced the modality toggle.
       */
      await step(page, "room", "patient-chosen", async () => {
        await page.getByRole("combobox").first().selectOption({ label: "Layla Demo" });
      });

      const start = await control(page, "room", "start", say("tnew.startNow"));
      if (start) {
        await step(page, "room", "opened", async () => {
          await start.click();
          await page.waitForURL(/\/room$/, { timeout: 60_000 });
        });

        const begin = await control(page, "room", "begin", say("troom.startSession"));
        if (begin) {
          await step(page, "room", "recording", async () => {
            await begin.click();
            /* The transcript pane is the thing that proves it started, not the button changing. */
            await page.getByText(say("ttr.listening")).first().waitFor({ timeout: 30_000 });
          });
        }

        const end = await control(page, "room", "end", say("troom.endSession"));
        if (end) {
          await step(page, "room", "ended", async () => {
            await end.click();
            await page.waitForURL((url) => !/\/room$/.test(url.pathname), { timeout: 90_000 });
          });
        }
      }

      await context.close();
    },

    /* ---------------------------------------------------------------- clinic */
    async clinic() {
      const context = await newContext(DESK);
      const page = await context.newPage();

      await tour(page, "clinic", [
        { at: "/clinic/apply", name: "apply" },
        { at: "/clinic/sign-in", name: "sign-in" },
        /* 63 — the delegated member of staff has a door of their own. */
        { at: "/staff/sign-in", name: "staff-sign-in" },
      ]);

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
          /* Both new since the last pass: delegated staff, and a colleague's earnings. */
          { at: "/clinic/team", name: "team" },
          { at: "/clinic/earnings", name: "earnings" },
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

      await tour(page, "sponsor", [
        { at: "/sponsor/apply", name: "apply" },
        { at: "/sponsor/sign-in", name: "sign-in" },
      ]);

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
          /* Both new since the last pass: domain proof, and the HR connection. */
          { at: "/sponsor/domains", name: "domains" },
          { at: "/sponsor/integrations", name: "integrations" },
          { at: "/sponsor/settings", name: "settings" },
        ]);
      }

      await context.close();
    },

    /* --------------------------------------------------------------- partner */
    async partner() {
      const context = await newContext(DESK);
      const page = await context.newPage();

      await tour(page, "partner", [
        { at: "/partner/apply", name: "apply" },
        { at: "/partner/sign-in", name: "sign-in" },
      ]);

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
          { at: "/partner/usage", name: "usage" },
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
      const inside = await signIn(
        page,
        "admin",
        "/staff/sign-in",
        "admin@example.com",
        "CaptureRun2026!",
      );

      if (inside) {
        await tour(page, "admin", [
          { at: "/admin", name: "dashboard" },
          /*
           * 🔴 SIX OF EIGHTEEN ADMIN SCREENS WERE WALKED, and the design verdict on this
           * console came from that sixth. Every one of them is here now: an operator's
           * console nobody has looked at is where a rule quietly stops being enforceable.
           */
          { at: "/admin/therapists", name: "therapists" },
          { at: "/admin/verifications", name: "verifications" },
          { at: "/admin/radar", name: "radar" },
          { at: "/admin/clinics", name: "clinics" },
          { at: "/admin/sponsors", name: "sponsors" },
          { at: "/admin/partners", name: "partners" },
          { at: "/admin/benefits", name: "benefits" },
          { at: "/admin/ratings", name: "ratings" },
          { at: "/admin/taxonomy", name: "taxonomy" },
          { at: "/admin/numbers", name: "numbers" },
          { at: "/admin/settings", name: "settings" },
          { at: "/admin/strings", name: "strings" },
          { at: "/admin/support", name: "support" },
          { at: "/admin/audit", name: "audit" },
          { at: "/admin/errors", name: "errors" },
          { at: "/admin/announce", name: "announce" },
          { at: "/admin/tv", name: "tv" },
          { at: "/admin/vault", name: "vault" },
          { at: "/admin/content", name: "content" },
          { at: "/admin/checkins", name: "checkins" },
          { at: "/admin/payouts", name: "payouts" },
          { at: "/admin/usage", name: "usage" },
        ]);
      }

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

  /*
   * 🔴 ONLY ON A FULL RUN. `--only patient` is a deliberately partial walk and failing it
   * for being partial would be a gate that punishes the way people actually use the tool.
   */
  if (!only) assertEveryRouteIsWalked();

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
