import { BASE, browser, page } from "./lib.mjs";
import { signIn } from "./lib2.mjs";
const b = await browser();
const p = await page(b, "t");
await signIn(p, BASE, "yasmin@clinic.test", "walkthrough-therapist-1");
await p.goto(`${BASE}/settings`, { waitUntil: "networkidle" });
await p.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
await p.waitForTimeout(400);
console.log(await p.evaluate(() => {
  const btn = [...document.querySelectorAll("button,a")].find((e) => /Set up payouts/.test(e.textContent || ""));
  const chain = [];
  let node = btn;
  while (node && chain.length < 8) {
    const cs = getComputedStyle(node);
    chain.push(`${node.tagName}.${(node.className || "").toString().slice(0, 45)} [${cs.position}]`);
    node = node.parentElement;
  }
  return { chain, scrollY: window.scrollY, doc: document.documentElement.scrollHeight, vp: window.innerHeight };
}));
await b.close();
