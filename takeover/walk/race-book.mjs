#!/usr/bin/env node
/**
 * Two patients book at the same instant against one pot. docs/PROVE-IT.md growth step 13, RR9.
 *
 * Each side opens the clinician's profile, taps its own hour and fills the sheet;
 * then both presses of Confirm are released together.
 *
 *   node takeover/walk/race-book.mjs --run growth --profile /patient/t/<id> \
 *     --sides "mariam:16:00:Mariam:mariam.demo@example.com,patientA:17:00:Omar:mr.3omar.a7mad@gmail.com"
 */
import { join } from "node:path";
import { mkdirSync } from "node:fs";
import { chromium } from "playwright";

const a = {};
for (let i = 2; i < process.argv.length; i += 2) a[process.argv[i].slice(2)] = process.argv[i + 1];
const sides = await Promise.all(
  a.sides.split(",").map(async (spec) => {
    const [name, hh, mm, first, email] = spec.split(":");
    const context = await chromium.launchPersistentContext(join("evidence", a.run, ".profiles", name), {
      executablePath: "/opt/pw-browsers/chromium",
      headless: true,
      viewport: { width: 390, height: 844 },
      timezoneId: "Africa/Cairo",
    });
    const page = context.pages()[0] ?? (await context.newPage());
    await page.goto("https://24therapy.app" + a.profile, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(3000);
    await page.getByText(`${hh}:${mm}`, { exact: true }).first().click();
    await page.waitForTimeout(1200);
    await page.locator('input[placeholder="Your first name"]').fill(first);
    await page.locator("input[type=email]").fill(email);
    const dir = join("evidence", a.run, name, "race");
    mkdirSync(dir, { recursive: true });
    await page.screenshot({ path: join(dir, `book-${hh}-before.png`) });
    return { name, hh, context, page, dir };
  }),
);
const t = Date.now();
const results = await Promise.all(
  sides.map(async (s) => {
    try {
      await s.page.getByRole("button", { name: "Confirm" }).click({ timeout: 10000 });
      return `${s.name}: confirmed at +${Date.now() - t}ms`;
    } catch (e) {
      return `${s.name}: FAILED ${String(e.message).split("\n")[0]}`;
    }
  }),
);
await new Promise((r) => setTimeout(r, 6000));
for (const s of sides) {
  await s.page.screenshot({ path: join(s.dir, `book-${s.hh}-after.png`) });
  const text = (await s.page.evaluate(() => document.body.innerText)).split("\n").filter(Boolean);
  console.log(`--- ${s.name}: ${text.filter((x) => /Booked|could not|covered|pay|employer|error/i.test(x)).slice(0, 4).join(" | ")}`);
  await s.context.close();
}
console.log(results.join("\n"));
