import { BASE, browser, page, shot, text } from "./lib.mjs";
import { clearLimits } from "./lib2.mjs";
await clearLimits();
const b = await browser();
const p = await page(b);
await p.goto(`${BASE}/patient/login`, { waitUntil: "networkidle" });
console.log("--- sign in page ---");
console.log((await text(p)).slice(0, 700));
await shot(p, "41-patient-login-code");

await p.fill("#handle", "+201001234567");
await p.fill("#password", "walkthrough-patient-1");
await p.click("button[type=submit]");
await p.waitForTimeout(2500);
await p.goto(`${BASE}/patient/claim`, { waitUntil: "networkidle" });
console.log("\n--- claim screen, handle NOT proven ---");
console.log((await text(p)).slice(0, 600));
await shot(p, "42-claim-gated");
await b.close();
