import { browser, go, anatomy, text, shot, PHONE } from "./lib.mjs";
const b = await browser();
const ctx = await b.newContext({ viewport: PHONE });
const p = await ctx.newPage();
const step = async (n, chars=1600) => { console.log(`\n### ${n} ${p.url()}`, JSON.stringify(await anatomy(p))); console.log((await text(p)).slice(0,chars)); await shot(p, n); };
await go(p, "/patient/signup");
console.log("FIELDS:", await p.evaluate(()=>JSON.stringify([...document.querySelectorAll("input,select")].filter(e=>e.type!=="hidden").map(e=>({n:e.name,t:e.type,l:(e.labels&&e.labels[0]&&e.labels[0].innerText.trim().slice(0,40))||e.placeholder||""})))));
await step("p08-signup-open");
// A stranger types Layla's number.
await p.fill("input[name=firstName]", "Mahmoud");
await p.selectOption("select[name=phoneCountry]", "EG").catch(()=>{});
await p.fill("input[name=phone]", "1001234567").catch(async()=>{ console.log("no phone field"); });
await p.fill("input[name=password]", "Walkthrough-2-stranger!").catch(()=>{});
await p.getByRole("button", { name: /Create account/i }).click();
await p.waitForTimeout(6000);
await step("p09-stranger-after-signup");
await b.close();
