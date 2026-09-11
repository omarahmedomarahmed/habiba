import { browser, context, go, LAPTOP } from "./lib.mjs";
const [path] = process.argv.slice(2);
const b = await browser();
const ctx = await b.newContext({ viewport: LAPTOP, storageState: "/home/user/habiba/.walkthrough2/state-therapist.json" });
const p = await ctx.newPage();
await go(p, path);
console.log(await p.evaluate(() => {
  const f = [...document.querySelectorAll("input,select,textarea")].map((el) => ({
    tag: el.tagName, type: el.type, name: el.name, id: el.id, required: el.required,
    label: (el.labels && el.labels[0] && el.labels[0].innerText.trim().slice(0,50)) || el.getAttribute("aria-label") || el.placeholder || "",
  }));
  const btns = [...document.querySelectorAll("button")].map((b) => b.innerText.trim().slice(0,40));
  return JSON.stringify({ fields: f, buttons: btns }, null, 1);
}));
await b.close();
