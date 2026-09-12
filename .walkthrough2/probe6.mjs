import { browser, go, PHONE } from "./lib.mjs";
const b = await browser();
const ctx = await b.newContext({ viewport: PHONE, storageState: ".walkthrough2/state-patient.json" });
const p = await ctx.newPage();
await go(p, "/patient");
await p.waitForTimeout(2000);
console.log(await p.evaluate(() => {
  const hits = [...document.querySelectorAll("*")].filter(el => (el.textContent||"").trim() === "SOS" || (el.getAttribute("aria-label")||"").includes("SOS"));
  const btn = hits.find(e=>e.tagName==="BUTTON"); return btn.outerHTML.slice(0,500) + "\n--\n" + hits.map(el => {
    const r = el.getBoundingClientRect(); const s = getComputedStyle(el);
    return `${el.tagName}.${el.className} rect=${Math.round(r.x)},${Math.round(r.y)},${Math.round(r.width)}x${Math.round(r.height)} vis=${s.visibility} disp=${s.display} op=${s.opacity} z=${s.zIndex} pe=${s.pointerEvents}`;
  }).join("\n");
}));
await b.close();
