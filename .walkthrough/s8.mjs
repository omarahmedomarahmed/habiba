import { BASE, browser, page, shot, text } from "./lib.mjs";
import { signIn } from "./lib2.mjs";
const b = await browser();
const p = await page(b, "t");
await signIn(p, BASE, "yasmin@clinic.test", "walkthrough-therapist-1");

for (let round = 0; round < 6; round += 1) {
  const buttons = p.locator("button", { hasText: /^Upload$/ });
  const count = await buttons.count();
  if (count === 0) break;
  const inputs = p.locator("input[type=file]");
  console.log(`round ${round}: ${count} Upload buttons, ${await inputs.count()} file inputs`);
  await inputs.nth(0).setInputFiles("/tmp/licence.png");
  await p.waitForTimeout(400);
  const after = await p.locator("button", { hasText: /^Upload$/ }).count();
  console.log(`   after choosing a file: ${after} Upload buttons`);
  await buttons.first().click({ force: true });
  await p.waitForTimeout(3000);
  await p.waitForLoadState("networkidle").catch(() => {});
  const t = await text(p);
  if (t.includes("could not") || t.includes("failed")) console.log("   ⚠️ ", t.split("\n").find((l) => /could not|failed/i.test(l)));
}
const t = await text(p);
console.log("--- Nearly there ---");
console.log(t.slice(t.indexOf("Nearly there")).slice(0, 500));
await shot(p, "07-onboarding-documents");
await b.close();
