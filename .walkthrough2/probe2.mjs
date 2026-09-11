import { browser, go, LAPTOP } from "./lib.mjs";
const b = await browser();
const ctx = await b.newContext({ viewport: LAPTOP, storageState: ".walkthrough2/state-therapist.json" });
const p = await ctx.newPage();
await go(p, "/onboarding");
console.log(await p.evaluate(() => {
  const el = [...document.querySelectorAll("input[name=languages]")][0];
  const s = getComputedStyle(el);
  const r = el.getBoundingClientRect();
  return JSON.stringify({ outer: el.parentElement.outerHTML.slice(0, 400), opacity: s.opacity, display: s.display, w: r.width, h: r.height, pos: s.position });
}));
await b.close();
