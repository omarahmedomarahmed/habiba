import { writeFileSync } from "node:fs";
import { browser, go, shot, LAPTOP } from "./lib.mjs";
const b = await browser();
const ctx = await b.newContext({ viewport: LAPTOP, storageState: ".walkthrough2/state-therapist.json" });
const p = await ctx.newPage();
await go(p, "/patients/1602fb09-a0cd-418a-9c3e-08eeb7e6c6ab");
await p.getByRole("button", { name: /Issue a new one/i }).click();
await p.waitForTimeout(3500);
const link = await p.evaluate(()=>{
  const i = [...document.querySelectorAll("input,textarea")].map(x=>x.value).find(v=>v && v.includes("/patient/invite/"));
  if (i) return i;
  const m = document.body.innerText.match(/https?:\/\/\S*\/patient\/invite\/\S+/);
  return m ? m[0] : "";
});
console.log("LINK:", link);
writeFileSync(".walkthrough2/invite.txt", link);
await shot(p, "t15-invite-link");
await b.close();
