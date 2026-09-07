import { BASE, browser, page, shot, text } from "./lib.mjs";
import { clickButton, signIn } from "./lib2.mjs";
const b = await browser();
const p = await page(b, "t");
console.log("landed:", await signIn(p, BASE, "yasmin@clinic.test", "walkthrough-therapist-1"));

await p.selectOption("select[name=country]", "EG");
await p.fill("input[name=licenseBody]", "Egyptian Ministry of Health");
await p.fill("input[name=licenseNumber]", "EG-PSY-44921");
await p.fill("input[name=licenseExpiry]", "2028-06");
// The chips are labels wrapping sr-only checkboxes — a person clicks the label.
await p.locator("label", { hasText: /^Arabic$/ }).first().click();
await p.locator("label", { hasText: /^Anxiety$/ }).first().click();
await clickButton(p, "Save details");
console.log("after save:", p.url());

const inputs = p.locator("input[type=file]");
const n = await inputs.count();
for (let i = 0; i < n; i += 1) {
  await inputs.nth(i).setInputFiles("/tmp/licence.png");
  await p.waitForTimeout(300);
  const upload = p.locator("button", { hasText: "Upload" }).nth(i);
  await upload.scrollIntoViewIfNeeded();
  await upload.click({ force: true }).catch((e) => console.log("upload click failed", String(e).slice(0,80)));
  await p.waitForTimeout(2500);
}
await p.waitForLoadState("networkidle");
const t = await text(p);
console.log("--- state after uploads ---");
console.log(t.slice(t.indexOf("Nearly there")).slice(0, 600));
await shot(p, "07-onboarding-ready");
await b.close();
