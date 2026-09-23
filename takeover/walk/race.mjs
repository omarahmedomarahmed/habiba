#!/usr/bin/env node
/**
 * Two people press the same button at the same instant. docs/PROVE-IT.md A2 and RR9.
 *
 * Each persona's page is loaded and screenshotted first; the clicks are then
 * released together with Promise.all, and each side is screenshotted after.
 *
 *   node takeover/walk/race.mjs --run money --as operator,operator2 --url /admin/transfers --click Confirm
 */
import { join } from "node:path";
import { mkdirSync } from "node:fs";
import { chromium } from "playwright";

const a = {};
for (let i = 2; i < process.argv.length; i += 2) a[process.argv[i].slice(2)] = process.argv[i + 1];
const BASE = process.env.WALK_BASE ?? "https://24therapy.app";
const who = a.as.split(",");
const sides = await Promise.all(
  who.map(async (name) => {
    const context = await chromium.launchPersistentContext(join("evidence", a.run, ".profiles", name), {
      executablePath: "/opt/pw-browsers/chromium",
      headless: true,
      viewport: a.mobile ? { width: 390, height: 844 } : { width: 1280, height: 860 },
    });
    const page = context.pages()[0] ?? (await context.newPage());
    await page.goto(BASE + a.url, { waitUntil: "domcontentloaded" });
    await page.waitForLoadState("networkidle", { timeout: 15000 }).catch(() => {});
    const dir = join("evidence", a.run, name, "race");
    mkdirSync(dir, { recursive: true });
    await page.screenshot({ path: join(dir, "before.png") });
    return { name, context, page, dir };
  }),
);
const t = Date.now();
const results = await Promise.all(
  sides.map(async (s) => {
    try {
      await s.page.getByRole("button", { name: a.click }).first().click({ timeout: 10000 });
      return `${s.name}: clicked at +${Date.now() - t}ms`;
    } catch (e) {
      return `${s.name}: FAILED ${String(e.message).split("\n")[0]}`;
    }
  }),
);
await new Promise((r) => setTimeout(r, 5000));
for (const s of sides) {
  await s.page.screenshot({ path: join(s.dir, "after.png") });
  const text = (await s.page.evaluate(() => document.body.innerText)).split("\n").filter(Boolean);
  console.log(`--- ${s.name} after ---`);
  console.log(text.slice(-12).join("\n"));
  await s.context.close();
}
console.log(results.join("\n"));
