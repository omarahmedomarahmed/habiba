import { BASE, browser, page, text } from "./lib.mjs";
import { signIn } from "./lib2.mjs";
const b = await browser();
const p = await page(b, "t");
await signIn(p, BASE, "yasmin@clinic.test", "walkthrough-therapist-1");
await p.goto(`${BASE}/patients`, { waitUntil: "networkidle" });
console.log(await p.evaluate(() => {
  const row = [...document.querySelectorAll("*")].find((e) => e.textContent?.trim().startsWith("Mariam Saleh") && e.children.length === 0);
  let node = row, chain = [];
  while (node && chain.length < 6) {
    chain.push(`${node.tagName}${node.getAttribute?.("href") ? `[href=${node.getAttribute("href")}]` : ""}.${(node.className||"").toString().slice(0,40)}`);
    node = node.parentElement;
  }
  return chain;
}));
await b.close();
