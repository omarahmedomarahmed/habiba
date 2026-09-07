import { BASE, browser, page, text } from "./lib.mjs";
import { signIn } from "./lib2.mjs";
const b = await browser();
const p = await page(b, "t");
await signIn(p, BASE, "yasmin@clinic.test", "walkthrough-therapist-1");
await p.goto(`${BASE}/patients`, { waitUntil: "networkidle" });
console.log(await p.evaluate(() =>
  [...document.querySelectorAll("a,button")]
    .filter((e) => /add a patient/i.test(e.textContent || ""))
    .map((e) => ({ tag: e.tagName, href: e.getAttribute("href"), cls: e.className.slice(0, 60), visible: e.getClientRects().length > 0 }))));
await b.close();
