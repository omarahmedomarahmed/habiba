import { browser, go, text, shot, LAPTOP, PHONE, BASE } from "./lib.mjs";
const b = await browser();
const tctx = await b.newContext({ viewport: LAPTOP, storageState: ".walkthrough2/state-therapist.json" });
const t = await tctx.newPage();
await go(t, "/settings/codes");
await t.fill("input[name=label]", "Waiting room wall");
await t.getByRole("button", { name: /Create a code/i }).click();
await t.waitForTimeout(4000);
const body = await text(t);
console.log((body.slice(body.indexOf("What is this one for"), body.indexOf("What is this one for")+600)).replace(/\n{2,}/g,"\n"));
const code = await t.evaluate(()=>{ const m=document.body.innerText.match(/\/j\/([A-Za-z0-9-]+)/) || (document.querySelector("input[readonly]")||{}).value?.match(/\/j\/([A-Za-z0-9-]+)/); return m?m[1]:null; });
console.log("CODE:", code);
await shot(t, "t24-qr-created");
if (code) {
  const octx = await b.newContext({ viewport: PHONE });
  const o = await octx.newPage();
  await o.goto(`${BASE}/j/${code}`, { waitUntil: "networkidle" });
  console.log("\n=== /j/" + code + " ===\n" + (await text(o)).slice(0,800).replace(/\n{2,}/g,"\n"));
  await shot(o, "p22-join-code");
}
await b.close();
