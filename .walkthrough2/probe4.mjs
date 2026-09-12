import { browser, go, LAPTOP } from "./lib.mjs";
const b = await browser();
const ctx = await b.newContext({ viewport: LAPTOP, storageState: ".walkthrough2/state-therapist.json" });
const p = await ctx.newPage();
await go(p, "/dashboard");
console.log(await p.evaluate(() => {
  const els = [...document.querySelectorAll("body *")].filter((el) => {
    const r = el.getBoundingClientRect();
    return r.width > 20 && r.width < 90 && r.height > 20 && r.height < 90 && r.right > window.innerWidth - 140 && r.bottom > window.innerHeight - 140;
  });
  const btn = els.find(e=>e.tagName==="BUTTON"); return btn.outerHTML.slice(0,600);
}));
await b.close();
