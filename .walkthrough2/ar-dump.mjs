import { browser, text, BASE, PHONE } from "./lib.mjs";
const b = await browser();
const ctx = await b.newContext({ viewport: PHONE, storageState: ".walkthrough2/state-patient.json", locale: "ar-EG" });
const p = await ctx.newPage();
for (const path of process.argv.slice(2)) {
  await p.goto(`${BASE}${path}`, { waitUntil: "networkidle" }).catch(()=>{});
  console.log(`\n=== ${path}\n` + (await text(p)).replace(/\n{2,}/g,"\n").slice(0,700));
}
await b.close();
