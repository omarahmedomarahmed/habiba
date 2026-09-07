import { BASE, browser, page, shot, text } from "./lib.mjs";
import { signIn, clickButton } from "./lib2.mjs";
const b = await browser();
const p = await page(b, "t");
await signIn(p, BASE, "yasmin@clinic.test", "walkthrough-therapist-1");
await p.goto(`${BASE}/patients`, { waitUntil: "networkidle" });
await clickButton(p, "Add a patient");
await p.fill("input[name=firstName]", "Mariam");
await p.fill("input[name=lastName]", "Saleh");
await p.selectOption("select[name=phoneCountry]", "EG");
await p.fill("input[name=phone]", "01001234567");
await p.waitForTimeout(1500);
const before = await text(p);
console.log("Any duplicate warning before submitting?",
  /already|existing|match|same number/i.test(before) ? "YES" : "NO");
await shot(p, "17-duplicate-check");
await b.close();
