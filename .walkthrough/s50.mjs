import { BASE, browser, page, shot, text } from "./lib.mjs";
import { signIn, clearLimits, clickButton } from "./lib2.mjs";

// 1. The therapist issues a fresh invite.
const b = await browser();
const t = await page(b, "t");
await signIn(t, BASE, "yasmin@clinic.test", "walkthrough-therapist-1");
await t.goto(`${BASE}/patients/016f7f95-b109-4192-8fa3-0dd3dc972781`, { waitUntil: "networkidle" });
await clickButton(t, "Create an invite link");
await t.waitForTimeout(2000);
const link = await t.evaluate(() => {
  const el = [...document.querySelectorAll("input,textarea,code,a")].map((e) => e.value || e.textContent || "").find((v) => /patient\/invite/.test(v));
  return el || null;
});
console.log("invite:", link);
await t.close();

// 2. The patient claims it, through the real pages.
await clearLimits();
const p = await page(b, "patient");
await p.goto(`${BASE}/patient/login`, { waitUntil: "networkidle" });
await p.fill("#handle", "+201001234567");
await p.fill("#password", "walkthrough-patient-1");
await p.click("button[type=submit]");
await p.waitForTimeout(2500);
await p.goto(link, { waitUntil: "networkidle" });
await clickButton(p, "This is me — claim it");
await p.waitForTimeout(4000);
console.log("landed on:", p.url());
console.log((await text(p)).slice(0, 800));
await shot(p, "38-claimed-confirmation");
await b.close();
