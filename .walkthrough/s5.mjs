import { BASE, browser, page, shot, text } from "./lib.mjs";
import { writeFileSync } from "node:fs";

// A one-pixel PNG standing in for a licence photo.
const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);
writeFileSync("/tmp/licence.png", PNG);

const b = await browser();
const p = await page(b, "t");
await p.goto(`${BASE}/login`, { waitUntil: "networkidle" });
await p.fill("#email", "yasmin@clinic.test");
await p.fill("#password", "walkthrough-therapist-1");
await p.click("button[type=submit]");
await p.waitForURL((u) => !u.pathname.includes("login"), { timeout: 45000 }).catch(() => {});
await p.waitForLoadState("networkidle");
console.log("at", p.url());

await p.selectOption("select[name=country]", "EG");
await p.fill("input[name=licenseBody]", "Egyptian Ministry of Health");
await p.fill("input[name=licenseNumber]", "EG-PSY-44921");
await p.fill("input[name=licenseExpiry]", "2028-06-30");
await p.locator("input[name=languages]").nth(0).check();
await p.locator("input[name=specialties]").nth(0).check();
await p.locator("button", { hasText: "Save details" }).first().click();
await p.waitForLoadState("networkidle");
await p.waitForTimeout(1500);
console.log("saved. url:", p.url());

const fileInputs = p.locator("input[type=file]");
const n = await fileInputs.count();
for (let i = 0; i < n; i += 1) {
  await fileInputs.nth(i).setInputFiles("/tmp/licence.png");
  const upload = p.locator("button", { hasText: "Upload" }).nth(0);
  await upload.click().catch(() => {});
  await p.waitForTimeout(2500);
  console.log(`upload ${i + 1}/${n} attempted`);
}
await p.waitForLoadState("networkidle");
await shot(p, "06-onboarding-uploaded");
const t = await text(p);
console.log(t.slice(t.indexOf("Documents") >= 0 ? t.indexOf("Documents") : 0).slice(0, 900));
await b.close();
