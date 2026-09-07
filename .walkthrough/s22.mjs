import { BASE, browser, page, shot, text } from "./lib.mjs";
import { signIn, clickButton } from "./lib2.mjs";
const b = await browser();
const p = await page(b, "t");
await signIn(p, BASE, "yasmin@clinic.test", "walkthrough-therapist-1");
await p.goto(`${BASE}/patients`, { waitUntil: "networkidle" });
await clickButton(p, "Add a patient");
await p.fill("input[name=firstName]", "Mariam");
await p.fill("input[name=lastName]", "Saleh");
await p.selectOption("select[name=phoneCountry]", "EG").catch(async () => {
  console.log("country options:", (await p.locator("select[name=phoneCountry] option").allTextContents()).slice(0, 4));
});
await p.fill("input[name=phone]", "01001234567");
await clickButton(p, "Add patient");
await p.waitForTimeout(1500);
console.log("url:", p.url());
console.log((await text(p)).slice(0, 600));
await shot(p, "16-patient-added");
await b.close();
