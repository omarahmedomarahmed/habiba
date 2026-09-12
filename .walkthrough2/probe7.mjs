import { browser, go, LAPTOP } from "./lib.mjs";
const b = await browser();
const ctx = await b.newContext({ viewport: LAPTOP, storageState: ".walkthrough2/state-admin.json" });
const p = await ctx.newPage();
await go(p, "/admin");
console.log(await p.evaluate(() => {
  const out = [];
  const blue = [...document.querySelectorAll("*")].find(el => { const r=el.getBoundingClientRect(); return r.width>300 && r.height>50 && getComputedStyle(el).backgroundColor.includes("rgb(") && el.children.length===0; });
  out.push("BLOCK: " + (blue ? blue.outerHTML.slice(0,300) : "none"));
  const nav = document.querySelector("nav");
  if (nav) { const r = nav.getBoundingClientRect(); out.push(`NAV scrollW=${nav.scrollWidth} clientW=${nav.clientWidth} overflowX=${getComputedStyle(nav).overflowX} right=${Math.round(r.right)} winW=${window.innerWidth}`); }
  const last = nav ? [...nav.querySelectorAll("a")].pop() : null;
  if (last) { const r=last.getBoundingClientRect(); out.push(`LAST TAB "${last.innerText}" x=${Math.round(r.x)}..${Math.round(r.right)}`); }
  return out.join("\n");
}));
await b.close();
