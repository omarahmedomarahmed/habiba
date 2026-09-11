import { browser, go, PHONE } from "./lib.mjs";
const [path, state] = process.argv.slice(2);
const b = await browser();
const ctx = await b.newContext({ viewport: PHONE, storageState: `.walkthrough2/state-${state}.json` });
const p = await ctx.newPage();
await go(p, path);
console.log(await p.evaluate(()=>JSON.stringify({
  fields: [...document.querySelectorAll("input,select,textarea")].filter(e=>e.type!=="hidden").map(e=>({n:e.name,t:e.type,l:(e.labels&&e.labels[0]&&e.labels[0].innerText.trim().slice(0,40))||e.placeholder||""})),
  buttons: [...document.querySelectorAll("button")].map(b=>b.innerText.trim()).filter(Boolean),
})));
await b.close();
