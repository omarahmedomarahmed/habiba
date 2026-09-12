import { browser, go, text, shot, PHONE, LAPTOP } from "./lib.mjs";
const b = await browser();
const tctx = await b.newContext({ viewport: LAPTOP, storageState: ".walkthrough2/state-therapist.json" });
const t = await tctx.newPage();
await go(t, "/connect");
await t.fill("input[name=code]", process.argv[2] ?? "Y67-QPV");
await t.getByRole("button", { name: /Ask them/i }).click();
await t.waitForTimeout(4000);
console.log("=== therapist after asking ===\n" + (await text(t)).split("Connect")[1]?.slice(0,700).replace(/\n{2,}/g,"\n"));
await shot(t, "t26-connect-asked");

const pctx = await b.newContext({ viewport: PHONE, storageState: ".walkthrough2/state-patient.json" });
const p = await pctx.newPage();
await go(p, "/patient/consent");
console.log("\n=== patient sees ===\n" + (await text(p)).slice(0,900).replace(/\n{2,}/g,"\n"));
await shot(p, "p24-consent-request");
console.log("BUTTONS:", await p.evaluate(()=>[...document.querySelectorAll("button")].map(b=>b.innerText.trim()).filter(Boolean).join(" | ")));
await b.close();
