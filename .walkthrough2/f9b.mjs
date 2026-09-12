import { browser, go, LAPTOP } from "./lib.mjs";
const b = await browser();
const ctx = await b.newContext({ viewport: LAPTOP, storageState: ".walkthrough2/state-therapist.json" });
const p = await ctx.newPage();
await go(p, "/patients/1602fb09-a0cd-418a-9c3e-08eeb7e6c6ab");
await p.getByRole("button", { name: /Create an invite link/i }).click().catch(()=>{});
await p.waitForTimeout(3000);
console.log(await p.evaluate(()=>[...document.querySelectorAll("input,textarea,code,pre")].map(i=>(i.value||i.innerText||"")).filter(Boolean).join("\n---\n")));
await b.close();
