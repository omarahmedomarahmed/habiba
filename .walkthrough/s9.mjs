import { BASE, browser, page, shot, text } from "./lib.mjs";
import { signIn } from "./lib2.mjs";
const b = await browser();
const p = await page(b, "t");
await signIn(p, BASE, "yasmin@clinic.test", "walkthrough-therapist-1");

for (let round = 0; round < 4; round += 1) {
  const upload = p.locator("button", { hasText: /^Upload$/ }).first();
  if ((await upload.count()) === 0) break;
  // The file input that belongs to the same card as this button.
  const handle = await upload.elementHandle();
  const input = await handle.evaluateHandle((btn) => {
    let node = btn;
    while (node && !node.querySelector?.('input[type="file"]')) node = node.parentElement;
    return node?.querySelector('input[type="file"]');
  });
  await input.asElement().setInputFiles("/tmp/licence.png");
  await p.waitForTimeout(400);
  await upload.click({ force: true });
  await p.waitForTimeout(3000);
  const t = await text(p);
  const outstanding = t.slice(t.indexOf("Nearly there"), t.indexOf("Submit for verification"));
  console.log(`round ${round}: outstanding →`, outstanding.split("\n").slice(2).filter(Boolean).join(", ") || "nothing");
}
await shot(p, "07-onboarding-documents");
await b.close();
