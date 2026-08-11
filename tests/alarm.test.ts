import assert from "node:assert/strict";
import { createServer, type Server } from "node:http";
import { globSync, readFileSync } from "node:fs";
import { after, before, test } from "node:test";
import ts from "typescript";
import { chromium, type Browser, type Page } from "playwright";

/**
 * Does the alarm actually make a sound?
 *
 * Nothing else in the suite can answer that, and the question is not academic:
 * the version of this code that shipped before did not, for two reasons that
 * were both invisible from the outside. It built its AudioContext on whichever
 * ambient click happened along, and it called `resume()` without awaiting it
 * and then scheduled every note at `context.currentTime` — which on a
 * suspended context reads zero and never moves. Every note was therefore
 * scheduled in the past, and the browser dropped all of them. The banner
 * appeared. The notification appeared. The room was silent.
 *
 * So this launches Chromium with its **real** autoplay policy — deliberately
 * not the `--autoplay-policy=no-user-gesture-required` that `e2e.test.ts` uses
 * to get through the recording flow, because that flag is exactly what would
 * hide the bug — and checks the three things that actually decide whether a
 * clinician hears a patient arrive:
 *
 *   1. Silence before a gesture, and honest about it.
 *   2. A running context after one, with a clock that has moved.
 *   3. Every note scheduled *ahead* of now, never behind it.
 *
 * `lib/alarm.ts` has no imports, so it needs transpiling but not bundling.
 */

const PORT = Number(process.env.ALARM_TEST_PORT ?? 8912);

/**
 * A Chromium already on disk, rather than a browser download at test time.
 * Same rule as `run-e2e.sh`, repeated here because this suite needs no server
 * and no database and should stay runnable on its own.
 */
const CHROMIUM =
  process.env.E2E_CHROMIUM ??
  globSync("/opt/pw-browsers/chromium-*/chrome-linux/chrome").sort().at(-1);

let browser: Browser;
let page: Page;
let server: Server;

const PAGE = `<!doctype html>
<meta charset="utf-8">
<title>alarm harness</title>
<button id="arm">arm</button>
<script type="module">
  import * as alarm from "./alarm.js";
  window.alarm = alarm;

  /*
   * Record what is handed to the audio thread, not what we hoped was.
   * The start time relative to currentTime is the whole ballgame: a negative
   * delta is a note the browser silently discards.
   */
  window.scheduled = [];
  const start = OscillatorNode.prototype.start;
  OscillatorNode.prototype.start = function (when) {
    window.scheduled.push({
      when: when ?? 0,
      at: this.context.currentTime,
      state: this.context.state,
    });
    return start.call(this, when);
  };

  document.getElementById("arm").addEventListener("click", async () => {
    window.armed = await alarm.armAlarm();
  });

  // Stands in for a hard reload by a clinician who armed the alarm before:
  // the context is built on load, with no gesture anywhere in sight.
  if (location.search.includes("preload")) {
    window.preloaded = await alarm.armAlarm({ fromGesture: false });
  }
</script>`;

before(async () => {
  const source = readFileSync(new URL("../lib/alarm.ts", import.meta.url), "utf8");
  const js = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
  }).outputText;

  server = createServer((request, response) => {
    if (request.url === "/alarm.js") {
      response.writeHead(200, { "content-type": "text/javascript" }).end(js);
      return;
    }
    response.writeHead(200, { "content-type": "text/html" }).end(PAGE);
  });
  await new Promise<void>((resolve) => server.listen(PORT, resolve));

  browser = await chromium.launch({
    ...(CHROMIUM ? { executablePath: CHROMIUM } : {}),
    // No autoplay flag. The default policy is the thing under test.
  });
  page = await browser.newPage();
  await page.goto(`http://127.0.0.1:${PORT}/`);
});

after(async () => {
  await browser?.close();
  server?.close();
});

test("says it is locked, and stays silent, until somebody asks", async () => {
  const state = await page.evaluate(() => window.alarm.alarmSnapshot());
  assert.equal(state, "locked");

  const played = await page.evaluate(() => window.alarm.playTone("ring"));
  assert.equal(played, false, "an unarmed alarm must report that it did not play");

  const count = await page.evaluate(() => window.scheduled.length);
  assert.equal(count, 0);
});

test("a real click arms it, and the clock is running afterwards", async () => {
  await page.click("#arm");
  await page.waitForFunction(() => window.armed !== undefined);

  assert.equal(await page.evaluate(() => window.armed), "ready");
  assert.equal(await page.evaluate(() => window.alarm.alarmSnapshot()), "ready");

  /*
   * The clock having moved is the actual regression test. A suspended context
   * reports `currentTime === 0` forever, which is what made every scheduled
   * note land in the past.
   */
  await page.waitForFunction(() => window.alarm.alarmClock() > 0, null, { timeout: 2_000 });
});

test("every note is scheduled ahead of now, never behind it", async () => {
  await page.evaluate(() => {
    window.scheduled = [];
    return window.alarm.playTone("ring");
  });

  const notes = await page.evaluate(() => window.scheduled);
  assert.ok(notes.length >= 2, `a ring is at least two tones, got ${notes.length}`);

  for (const note of notes) {
    assert.equal(note.state, "running", "scheduled against a context that was not running");
    assert.ok(
      note.when > note.at,
      `note scheduled ${(note.at - note.when).toFixed(4)}s in the past — it will be dropped`,
    );
  }
});

test("the urgent alarm is louder, longer and different from the booking ring", async () => {
  const ring = await page.evaluate(() => {
    window.scheduled = [];
    window.alarm.playTone("ring");
    return window.scheduled.length;
  });
  const urgent = await page.evaluate(() => {
    window.scheduled = [];
    window.alarm.playTone("urgent");
    return window.scheduled.length;
  });

  assert.ok(urgent > ring, "a patient sitting in an empty room must not sound like a booking");
});

test("it keeps ringing until it is stopped", async () => {
  await page.evaluate(() => {
    window.scheduled = [];
    window.alarm.startRinging("urgent", 300);
  });

  await page.waitForFunction(() => window.scheduled.length > 6, null, { timeout: 4_000 });
  assert.equal(await page.evaluate(() => window.alarm.isRinging()), true);

  const during = await page.evaluate(() => {
    window.alarm.stopRinging();
    return window.scheduled.length;
  });

  await page.waitForTimeout(700);
  const after_ = await page.evaluate(() => window.scheduled.length);

  assert.equal(await page.evaluate(() => window.alarm.isRinging()), false);
  assert.equal(after_, during, "stopping the alarm must actually stop it");
});

/**
 * The reload case, which is the one that actually broke in the running app.
 *
 * A clinician who armed the alarm yesterday reloads the portal. The context is
 * rebuilt on load — before any gesture — so Chrome leaves its `resume()`
 * pending indefinitely. A version of this module cached that in-flight promise
 * and handed it back to every later caller, which meant the click that *did*
 * carry a user gesture never reached the browser at all: the clinician could
 * click forever and stay silent, with the console cheerfully offering a button
 * that did nothing.
 */
test("a pre-gesture resume does not swallow the gesture that follows it", async () => {
  const fresh = await browser.newPage();
  await fresh.goto(`http://127.0.0.1:${PORT}/?preload=1`);
  await fresh.waitForFunction(() => window.preloaded !== undefined, null, { timeout: 5_000 });

  assert.equal(
    await fresh.evaluate(() => window.preloaded),
    "locked",
    "a speculative arm with no gesture must report 'locked', never 'blocked'",
  );

  await fresh.click("#arm");
  await fresh.waitForFunction(() => window.armed !== undefined, null, { timeout: 5_000 });

  assert.equal(await fresh.evaluate(() => window.armed), "ready");
  assert.equal(
    await fresh.evaluate(() => window.alarm.playTone("urgent")),
    true,
    "the alarm must work on the first click after a reload",
  );

  await fresh.close();
});

test("the tab title flashes, and is put back", async () => {
  const original = await page.title();

  await page.evaluate(() => window.alarm.flashTitle("🔴 PATIENT WAITING"));
  await page.waitForFunction(() => document.title.includes("PATIENT WAITING"), null, {
    timeout: 3_000,
  });

  await page.evaluate(() => window.alarm.stopFlashingTitle());
  assert.equal(await page.title(), original);
});

declare global {
  interface Window {
    alarm: typeof import("../lib/alarm");
    scheduled: { when: number; at: number; state: string }[];
    armed?: string;
    preloaded?: string;
  }
}
