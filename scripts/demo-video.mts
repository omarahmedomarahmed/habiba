/**
 * Record the product demo, and shoot the stills, from the real application.
 *
 *   npx tsx scripts/demo-video.mts                 # against localhost:3100
 *   DEMO_BASE=https://24therapy.example npx tsx scripts/demo-video.mts
 *
 * Output lands in `demo-output/`: one webm of the whole run, plus a numbered
 * PNG per beat so a still can be pulled for a deck without re-recording.
 *
 * Two things this does that a test script would not, because the audience is
 * a person rather than an assertion:
 *
 *   A cursor. Playwright moves the mouse without drawing one, so an
 *   unmodified recording is a screen that changes by itself — which reads as a
 *   video *of* a website rather than a person *using* one. A dot is injected,
 *   follows the real pointer, and pulses on click.
 *
 *   Pacing. A test races; a demo has to be followed. Every step holds long
 *   enough to read what changed, and those holds are deliberately longer than
 *   they feel like they should be to whoever already knows what happens next.
 *
 * The fixtures are the demo clinicians from `scripts/demo.ts` — real rows in
 * the real database, on the real radar. Nothing here is mocked, which is the
 * point: what is recorded is what a viewer would get if they opened the site.
 */
import { mkdirSync, rmSync, globSync } from "node:fs";
import { chromium, type Page } from "playwright";

const BASE = process.env.DEMO_BASE ?? "http://localhost:3100";
const OUT = "demo-output";
const VIEWPORT = { width: 1280, height: 800 };

let shot = 0;

const CURSOR = `
  (() => {
    if (document.getElementById("__demo_cursor")) return;
    const dot = document.createElement("div");
    dot.id = "__demo_cursor";
    dot.style.cssText = [
      "position:fixed","z-index:2147483647","pointer-events:none",
      "width:20px","height:20px","margin:-10px 0 0 -10px","border-radius:9999px",
      "background:rgba(31,94,255,.3)","border:2px solid rgba(31,94,255,.95)",
      "box-shadow:0 2px 12px rgba(0,0,0,.3)",
      "transition:transform .1s ease-out","left:-100px","top:-100px",
    ].join(";");
    document.documentElement.appendChild(dot);
    addEventListener("mousemove", (e) => {
      dot.style.left = e.clientX + "px"; dot.style.top = e.clientY + "px";
    }, true);
    addEventListener("mousedown", () => { dot.style.transform = "scale(.55)"; }, true);
    addEventListener("mouseup", () => { dot.style.transform = "scale(1)"; }, true);
  })();
`;

async function beat(page: Page, label: string, hold = 1600) {
  await page.waitForTimeout(hold);
  shot += 1;
  const name = `${String(shot).padStart(2, "0")}-${label}`;
  await page.screenshot({ path: `${OUT}/${name}.png` });
  console.log(`  ${name}`);
}

/** Move the pointer there first, in steps, so the click reads as a gesture. */
async function travel(page: Page, locator: ReturnType<Page["locator"]>) {
  const box = await locator.boundingBox().catch(() => null);
  if (!box) return;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 25 });
  await page.waitForTimeout(400);
}

async function click(page: Page, locator: ReturnType<Page["locator"]>) {
  await travel(page, locator);
  await locator.click({ timeout: 15_000 }).catch((error) => {
    console.log(`    (could not click: ${(error as Error).message.split("\n")[0]})`);
  });
}

async function main() {
  rmSync(OUT, { recursive: true, force: true });
  mkdirSync(OUT, { recursive: true });

  const executablePath = globSync("/opt/pw-browsers/chromium-*/chrome-linux/chrome").sort().at(-1);
  const browser = await chromium.launch({
    ...(executablePath ? { executablePath } : {}),
    args: ["--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream"],
  });

  const context = await browser.newContext({
    viewport: VIEWPORT,
    deviceScaleFactor: 1,
    permissions: ["camera", "microphone"],
    recordVideo: { dir: `${OUT}/video`, size: VIEWPORT },
  });
  await context.addInitScript(CURSOR);
  const page = await context.newPage();

  /* ---------------------------------------------------- 1. the fold ------ */
  console.log("\n▸ the homepage is the radar");
  await page.goto(BASE, { waitUntil: "domcontentloaded" });
  // The globe draws client-side and the board fills from /api/radar.
  await page.waitForTimeout(4500);
  await beat(page, "home-globe", 1400);

  await page.mouse.move(640, 420, { steps: 20 });
  await page.mouse.wheel(0, 280);
  await beat(page, "home-clinicians", 1400);

  /* -------------------------------------------- 2. filter by language ---- */
  console.log("▸ filtering by language");
  const arabicFilter = page.getByRole("button", { name: /Arabic/ }).first();
  if ((await arabicFilter.count()) > 0) {
    await click(page, arabicFilter);
    await beat(page, "filter-arabic", 1800);
    await click(page, arabicFilter); // clear it again
    await page.waitForTimeout(700);
  }

  /* --------------------------------------------- 3. pick a clinician ----- */
  console.log("▸ choosing a clinician");
  await page.goto(`${BASE}/radar`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(3800);
  await beat(page, "radar-board", 1200);

  const pick = page.getByRole("button", { name: /Layla Mansour/ }).first();
  await click(page, pick);
  await beat(page, "booking-sheet", 2400);

  /* ------------------------------------------------------ 4. book -------- */
  console.log("▸ booking");
  const nameField = page.locator("#radar-name");
  if ((await nameField.count()) > 0) {
    await travel(page, nameField);
    await nameField.click();
    await nameField.type("Sam", { delay: 140 });
    await beat(page, "booking-name", 1100);

    const start = page.getByRole("button", { name: /Start now/i }).first();
    await click(page, start);
    await page.waitForURL(/\/join\//, { timeout: 30_000 }).catch(() => {});
    await beat(page, "join-arrived", 2600);
  }

  /* ------------------------------------------------- 5. consent ---------- */
  console.log("▸ the recording question");
  const consentYes = page.getByText("Yes, you may record").first();
  if ((await consentYes.count()) > 0) {
    await beat(page, "consent-question", 2600);
    await click(page, consentYes);
    await beat(page, "consent-chosen", 1000);

    const go = page.getByRole("button", { name: /Go in|Join session/i }).first();
    await click(page, go);
    await page.waitForTimeout(3500);
    await beat(page, "patient-room", 2800);
  }

  await context.close(); // flushes the video file
  await browser.close();

  const video = globSync(`${OUT}/video/*.webm`)[0];
  console.log(`\n✓ ${shot} stills in ${OUT}/`);
  console.log(video ? `✓ video: ${video}` : "! no video file was written");
}

void main();
