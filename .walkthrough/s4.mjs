import { BASE, browser, page, shot, text } from "./lib.mjs";
const b = await browser();
const p = await page(b, "t");
await p.goto(`${BASE}/login`, { waitUntil: "networkidle" });
await p.fill("#email", "yasmin@clinic.test");
await p.fill("#password", "walkthrough-therapist-1");
await p.click("button[type=submit]");
await p.waitForURL((u) => !u.pathname.includes("login"), { timeout: 45000 }).catch(() => {});
await p.waitForLoadState("networkidle");

// Fill what a person would fill.
await p.selectOption("select[name=country]", "EG").catch(async () => {
  console.log("country select failed; options:", (await p.locator("select[name=country] option").allTextContents()).slice(0,5));
});
await p.fill("input[name=licenseBody]", "Egyptian Ministry of Health");
await p.fill("input[name=licenseNumber]", "EG-PSY-44921");
await p.fill("input[name=licenseExpiry]", "2028-06-30");
const langs = p.locator("input[name=languages]");
console.log("languages:", await langs.count());
await langs.nth(0).check().catch(() => {});
const specs = p.locator("input[name=specialties]");
await specs.nth(0).check().catch(() => {});
const files = await p.locator("input[type=file]").count();
console.log("file inputs on the page:", files);
await shot(p, "05-onboarding-filled");
const buttons = await p.locator("button").allTextContents();
console.log("buttons:", buttons.map(s => s.trim()).filter(Boolean));
await b.close();
