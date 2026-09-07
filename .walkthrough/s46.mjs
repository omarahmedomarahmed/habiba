import { BASE, browser, page, shot, text } from "./lib.mjs";
import { signIn, clickButton } from "./lib2.mjs";
const b = await browser();
const p = await page(b, "t");
await signIn(p, BASE, "yasmin@clinic.test", "walkthrough-therapist-1");
await p.goto(`${BASE}/sessions/c4b60d09-37fe-4c55-a530-c8b023d57a90`, { waitUntil: "networkidle" });
await clickButton(p, "Try again");
console.log("waiting for the note…");
for (let i = 0; i < 12; i += 1) {
  await p.waitForTimeout(5000);
  await p.reload({ waitUntil: "networkidle" });
  const t = await text(p);
  if (!/Writing your note/.test(t)) { console.log(t.slice(0, 1600)); break; }
  console.log(`   still writing (${(i + 1) * 5}s)`);
}
await shot(p, "33-note-written");
await b.close();
