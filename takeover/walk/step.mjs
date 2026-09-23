#!/usr/bin/env node
/**
 * One step of the walk, as one person, with evidence either side.
 *
 * docs/TAKEOVER.md s9: a screenshot before every click and after every click,
 * from every persona, so the pair shows a transition rather than a state; and
 * a board every walker reads before a click and posts to after it.
 *
 *   node takeover/walk/step.mjs --run live --as patientA --label "open the orb" \
 *        [--url /patient] [--click "Pay now"] [--selector "button[aria-label=SOS]"] \
 *        [--fill "input[name=email]::someone@example.com"] [--press Enter] \
 *        [--mobile] [--wait 1500] [--text] [--board "SAW: amber orb, ROW: -"]
 *
 * Each persona keeps its own browser profile under evidence/<run>/.profiles, so
 * cookies persist between steps and no two personas share one (PROVE-IT: six
 * portals, six cookies, never one profile). Evidence goes to evidence/<run>,
 * which is gitignored.
 *
 * Output: the URL, the step number, both screenshot paths, and the visible
 * text of the page after the action (first 80 lines and the last line, and it
 * says how many were left out: T4).
 */
import { mkdirSync, readdirSync, appendFileSync, existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { chromium } from "playwright";

const BASE = process.env.WALK_BASE ?? "https://24therapy.app";

function args(argv) {
  const out = { fill: [], press: [], selector: [], select: [] };
  for (let i = 0; i < argv.length; i++) {
    const key = argv[i];
    if (!key.startsWith("--")) continue;
    const name = key.slice(2);
    const next = argv[i + 1];
    const flag = next === undefined || next.startsWith("--");
    if (name === "fill") out.fill.push(next), i++;
    else if (name === "press") out.press.push(next), i++;
    else if (name === "selector") out.selector.push(next), i++;
    else if (name === "select") out.select.push(next), i++;
    else if (flag) out[name] = true;
    else (out[name] = next), i++;
  }
  return out;
}

const a = args(process.argv.slice(2));
if (!a.run || !a.as) {
  console.error("need --run <position> and --as <persona>");
  process.exit(2);
}

const root = join("evidence", a.run);
const shots = join(root, a.as);
const profile = join(root, ".profiles", a.as);
mkdirSync(shots, { recursive: true });
mkdirSync(profile, { recursive: true });

const n = String(readdirSync(shots).filter((f) => f.endsWith("-before.png")).length + 1).padStart(3, "0");
const slug = String(a.label ?? "step").toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 40);
const before = join(shots, `${n}-${slug}-before.png`);
const after = join(shots, `${n}-${slug}-after.png`);

const mobile = Boolean(a.mobile);
const context = await chromium.launchPersistentContext(profile, {
  executablePath: process.env.WALK_CHROMIUM ?? "/opt/pw-browsers/chromium",
  headless: true,
  viewport: mobile ? { width: 390, height: 844 } : { width: 1280, height: 860 },
  deviceScaleFactor: 1,
  isMobile: mobile,
  hasTouch: mobile,
  locale: a.locale ?? "en-US",
  timezoneId: "Africa/Cairo",
  ignoreHTTPSErrors: false,
  args: ["--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream"],
  permissions: ["microphone", "camera"],
});
const page = context.pages()[0] ?? (await context.newPage());
const consoleErrors = [];
page.on("console", (m) => m.type() === "error" && consoleErrors.push(m.text().slice(0, 200)));
page.on("pageerror", (e) => consoleErrors.push(`pageerror: ${String(e.message).slice(0, 200)}`));

let failure = null;
try {
  if (a.url) {
    await page.goto(a.url.startsWith("http") ? a.url : BASE + a.url, { waitUntil: "domcontentloaded", timeout: 45000 });
    await page.waitForLoadState("networkidle", { timeout: 15000 }).catch(() => {});
  } else if (page.url() === "about:blank") {
    await page.goto(BASE, { waitUntil: "domcontentloaded" });
  }
  await page.screenshot({ path: before, fullPage: Boolean(a.full) });

  /* Clicks that open things first, then the fields they reveal, then the final button. */
  for (const sel of a.selector) {
    /* A leading "?" makes the click optional: a pop-up that is not always there. */
    if (sel.startsWith("?")) await page.locator(sel.slice(1)).first().click({ timeout: 2500 }).catch(() => {});
    else await page.locator(sel).first().click({ timeout: 15000 });
  }
  for (const pair of a.fill) {
    const at = pair.indexOf("::");
    await page.locator(pair.slice(0, at)).first().fill(pair.slice(at + 2), { timeout: 15000 });
  }
  for (const pair of a.select) {
    const at = pair.indexOf("::");
    await page.locator(pair.slice(0, at)).first().selectOption({ label: pair.slice(at + 2) }, { timeout: 15000 });
  }
  if (a.click) {
    const exact = page.getByRole("button", { name: a.click, exact: false });
    const link = page.getByRole("link", { name: a.click, exact: false });
    const target = (await exact.count()) > 0 ? exact.first() : (await link.count()) > 0 ? link.first() : page.getByText(a.click, { exact: false }).first();
    await target.click({ timeout: 15000 });
  }
  for (const key of a.press) await page.keyboard.press(key);
  await page.waitForLoadState("networkidle", { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(Number(a.wait ?? 1200));
} catch (error) {
  failure = String(error.message ?? error).split("\n")[0];
}
await page.screenshot({ path: after, fullPage: Boolean(a.full) }).catch(() => {});

const text = (await page.evaluate(() => document.body?.innerText ?? "").catch(() => ""))
  .split("\n").map((l) => l.trim()).filter(Boolean);
const dir = await page.evaluate(() => document.documentElement.dir || "ltr").catch(() => "?");
const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1).catch(() => false);

console.log(`STEP ${n} as ${a.as} :: ${a.label ?? ""}`);
console.log(`URL ${page.url()}  dir=${dir}  horizontal-scroll=${overflow}`);
console.log(`BEFORE ${before}`);
console.log(`AFTER  ${after}`);
if (failure) console.log(`ACTION FAILED: ${failure}`);
if (consoleErrors.length) console.log(`CONSOLE ERRORS (${consoleErrors.length}): ${consoleErrors.slice(0, 5).join(" | ")}`);
const limit = a.text === true ? 400 : 80;
console.log("--- screen text ---");
for (const line of text.slice(0, limit)) console.log(line);
if (text.length > limit) console.log(`... ${text.length - limit} more lines left out; last: ${text[text.length - 1]} (rerun with --text for 400)`);

if (a.board) {
  const line = `${new Date().toISOString()} | ${a.as} | ${n} ${a.label ?? ""} | ${a.board}\n`;
  appendFileSync(join(root, "BOARD.md"), line);
}
await context.close();
process.exit(failure ? 1 : 0);
