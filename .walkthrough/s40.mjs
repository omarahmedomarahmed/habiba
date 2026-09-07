import { BASE, browser, page, shot, text } from "./lib.mjs";
import { clearLimits, clickButton } from "./lib2.mjs";
await clearLimits();
const b = await browser();
const p = await page(b, "patient");
await p.goto(`${BASE}/patient/login`, { waitUntil: "networkidle" });
await p.fill("#handle", "+201001234567");
await p.fill("#password", "walkthrough-patient-1");
await p.click("button[type=submit]");
await p.waitForTimeout(2500);
await p.goto(`${BASE}/patient/invite/P10UHNmjg2XXFuwbZx1CngTu2-rU4mY7`, { waitUntil: "networkidle" });
// Leave "keep seeing my profile" OFF — the default, and the point of step 7.
await clickButton(p, "This is me — claim it");
await p.waitForTimeout(3000);
console.log("url:", p.url());
console.log((await text(p)).slice(0, 800));
await shot(p, "27-claimed");
await b.close();
