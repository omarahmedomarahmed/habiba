import { BASE, browser, page, shot, text } from "./lib.mjs";
import { clearLimits } from "./lib2.mjs";
await clearLimits();
const b = await browser();
const p = await page(b, "patient");
await p.goto(`${BASE}/patient/login`, { waitUntil: "networkidle" });
await p.fill("#handle", "+201001234567");
await p.fill("#password", "walkthrough-patient-1");
await p.click("button[type=submit]");
await p.waitForTimeout(2500);
for (const path of ["/patient", "/patient/homework", "/patient/billing", "/patient/consent", "/patient/account", "/patient/profile"]) {
  await p.goto(`${BASE}${path}`, { waitUntil: "networkidle" });
  const t = await text(p);
  console.log(`\n===== ${path} (${p.url().replace(BASE, "")}) =====`);
  console.log(t.slice(0, 480));
  await shot(p, `37-patient${path.replace(/\//g, "-")}`);
}
await b.close();
