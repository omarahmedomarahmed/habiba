/**
 * The simulation's browser helper, shared by every agent in a round.
 * `docs/simulation/05-THE-BOARD.md` and `06-THE-AUDIO.md` are the protocol.
 *
 *   import { open, shot, board, inbox, BASE } from "../../../../home/user/habiba/scripts/sim-drive.mjs";
 *   const { page, close } = await open("T1");                 // a desktop browser, signed-in state kept per person
 *   const { page } = await open("P1", { mobile: true });       // a phone-sized one
 *   const { page } = await open("T1", { audio: "first-en-t" }); // a microphone playing .sim-audio/first-en-t.wav
 *   await shot(page, "R1", "T1", "TH1.2");
 *   board("R1", "T1", "TH1.2", "/signup", "created the account", "Save details");
 *   const text = inbox("amira.demo@example.com");              // kept messages to that address, newest first
 *
 * Each person's cookies live in `.sim-state/<key>.json` (git ignores it), saved on close, so a
 * person stays signed in between an agent's scripts. Screenshots go to
 * `docs/simulation-run/shots/<round>/`, which git ignores (07-THE-RECORD.md says why).
 */
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";

import { chromium } from "playwright";

export const BASE = process.env.SIM_BASE ?? "https://24therapy.app";
const ROOT = new URL("..", import.meta.url).pathname;
const STATE = join(ROOT, ".sim-state");
const SHOTS = join(ROOT, "docs/simulation-run/shots");
const CHROME = "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";

export async function open(who, opts = {}) {
  mkdirSync(STATE, { recursive: true });
  const args = ["--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream", "--autoplay-policy=no-user-gesture-required"];
  if (opts.audio) args.push(`--use-file-for-fake-audio-capture=${join(ROOT, ".sim-audio", `${opts.audio}.wav`)}`);
  const browser = await chromium.launch({ executablePath: CHROME, args });
  const statePath = join(STATE, `${who}.json`);
  const ctx = await browser.newContext({
    ...(opts.mobile ? { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true } : { viewport: { width: 1280, height: 900 } }),
    ...(existsSync(statePath) && !opts.fresh ? { storageState: statePath } : {}),
    permissions: ["camera", "microphone"],
    locale: opts.locale ?? "en-GB",
    timezoneId: "Africa/Cairo",
  });
  const page = await ctx.newPage();
  page.setDefaultTimeout(opts.timeout ?? 30_000);
  const close = async () => {
    await ctx.storageState({ path: statePath }).catch(() => {});
    await browser.close();
  };
  return { browser, ctx, page, close };
}

export async function shot(page, round, who, step) {
  const dir = join(SHOTS, round);
  mkdirSync(dir, { recursive: true });
  const file = join(dir, `${who}-${step}.png`);
  await page.screenshot({ path: file, fullPage: true }).catch(() => {});
  return file;
}

export function board(round, who, step, page, did, next = "", waitingOn = "") {
  return execFileSync("npm", ["run", "-s", "sim:board", "--", "post", round, who, step, page, did, next, waitingOn], {
    cwd: ROOT,
    encoding: "utf8",
  });
}

export function waitFor(step, seconds = 300) {
  try {
    execFileSync("npm", ["run", "-s", "sim:board", "--", "wait", step, String(seconds)], { cwd: ROOT, encoding: "utf8" });
    return true;
  } catch {
    return false;
  }
}

export function inbox(address) {
  return execFileSync("npm", ["run", "-s", "on:production", "--", "sim:inbox", "--", address], {
    cwd: ROOT,
    encoding: "utf8",
    env: { ...process.env },
  });
}
