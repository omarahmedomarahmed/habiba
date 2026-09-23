#!/usr/bin/env node
/**
 * A live session held open for its whole length, which one step cannot do.
 *
 * `step.mjs` opens a browser per click, which is right for pages and wrong for
 * a room: closing the browser leaves the call. This keeps one browser open,
 * plays a speech file as the microphone, runs a timeline of actions keyed to
 * seconds after the start, and screenshots every few seconds so the pair of
 * frames around each action shows the transition (docs/TAKEOVER.md s9).
 *
 *   node takeover/walk/room.mjs --run live --as drOmar --url /sessions/<id>/room \
 *     --audio evidence/audio/clinician.wav \
 *     --timeline "0:click:Start session,46:selector:button[aria-pressed],70:selector:button[aria-pressed],110:click:End session" \
 *     --until 140
 *
 * Every action and every console error is printed with its second, and a line
 * for each action is appended to evidence/<run>/BOARD.md.
 */
import { mkdirSync, appendFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { chromium } from "playwright";

const BASE = process.env.WALK_BASE ?? "https://24therapy.app";
const a = {};
for (let i = 2; i < process.argv.length; i += 2) a[process.argv[i].slice(2)] = process.argv[i + 1];

const root = join("evidence", a.run);
const shots = join(root, a.as, "room");
mkdirSync(shots, { recursive: true });

const args = ["--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream", "--autoplay-policy=no-user-gesture-required"];
if (a.audio) args.push(`--use-file-for-fake-audio-capture=${resolve(a.audio)}`);

const context = await chromium.launchPersistentContext(join(root, ".profiles", a.as), {
  executablePath: process.env.WALK_CHROMIUM ?? "/opt/pw-browsers/chromium",
  headless: true,
  viewport: a.mobile ? { width: 390, height: 844 } : { width: 1280, height: 860 },
  isMobile: Boolean(a.mobile),
  hasTouch: Boolean(a.mobile),
  timezoneId: "Africa/Cairo",
  permissions: ["microphone", "camera"],
  args,
});
const page = context.pages()[0] ?? (await context.newPage());
const t0 = Date.now();
const at = () => ((Date.now() - t0) / 1000).toFixed(1);
page.on("console", (m) => m.type() === "error" && console.log(`[${at()}s] console error: ${m.text().slice(0, 160)}`));
page.on("pageerror", (e) => console.log(`[${at()}s] PAGE ERROR: ${String(e.message).slice(0, 200)}`));

const board = (text) =>
  appendFileSync(join(root, "BOARD.md"), `${new Date().toISOString()} | ${a.as} | room | ${text}\n`);

await page.goto(BASE + a.url, { waitUntil: "domcontentloaded", timeout: 45000 });
await page.waitForTimeout(2000);

const timeline = String(a.timeline ?? "")
  .split(",")
  .filter(Boolean)
  .map((entry) => {
    const [sec, kind, ...rest] = entry.split(":");
    return { sec: Number(sec), kind, target: rest.join(":") };
  });

let shot = 0;
const snap = async (label) => {
  shot += 1;
  const file = join(shots, `${String(shot).padStart(3, "0")}-${at()}s-${label}.png`);
  await page.screenshot({ path: file }).catch(() => {});
  return file;
};

const start = Date.now();
const until = Number(a.until ?? 120);
const every = Number(a.every ?? 10);
let nextShot = 0;
for (const step of timeline) {
  while ((Date.now() - start) / 1000 < step.sec) {
    if ((Date.now() - start) / 1000 >= nextShot) {
      await snap("tick");
      nextShot += every;
    }
    await page.waitForTimeout(500);
  }
  const before = await snap(`before-${step.kind}`);
  let result = "ok";
  try {
    if (step.kind === "click") {
      const button = page.getByRole("button", { name: step.target });
      await ((await button.count()) ? button.first() : page.getByText(step.target).first()).click({ timeout: 10000 });
    } else if (step.kind === "selector") {
      await page.locator(step.target).first().click({ timeout: 10000 });
    } else if (step.kind === "goto") {
      await page.goto(BASE + step.target, { waitUntil: "domcontentloaded" });
    } else if (step.kind === "reload") {
      await page.reload({ waitUntil: "domcontentloaded" });
    }
  } catch (error) {
    result = `FAILED ${String(error.message).split("\n")[0]}`;
  }
  await page.waitForTimeout(1500);
  const after = await snap(`after-${step.kind}`);
  const line = `[${at()}s] ${step.kind} ${step.target} -> ${result} | ${before} | ${after}`;
  console.log(line);
  board(`DID: ${step.kind} "${step.target}" at ${at()}s, ${result}`);
}
while ((Date.now() - start) / 1000 < until) {
  if ((Date.now() - start) / 1000 >= nextShot) {
    await snap("tick");
    nextShot += every;
  }
  await page.waitForTimeout(500);
}
const text = (await page.evaluate(() => document.body?.innerText ?? "").catch(() => "")).split("\n").filter(Boolean);
console.log(`[${at()}s] final URL ${page.url()}`);
console.log(text.slice(0, 60).join("\n"));
await snap("final");
await context.close();
