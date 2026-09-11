import { browser, go, text, shot, LAPTOP, PHONE, BASE } from "./lib.mjs";
const b = await browser();
// therapist: QR + evidence
const tctx = await b.newContext({ viewport: LAPTOP, storageState: ".walkthrough2/state-therapist.json" });
const t = await tctx.newPage();
await go(t, "/settings/codes");
const body = await text(t);
console.log("=== QR PAGE ===\n" + body.slice(body.indexOf("Your QR code"), body.indexOf("Your QR code")+700).replace(/\n{2,}/g,"\n"));
const code = await t.evaluate(()=>{ const m=document.body.innerText.match(/\/j\/([A-Za-z0-9-]+)/); return m?m[1]:null; });
console.log("CODE:", code);
await shot(t, "t24-qr");
await go(t, "/patients/1602fb09-a0cd-418a-9c3e-08eeb7e6c6ab/evidence");
console.log("\n=== EVIDENCE ===\n" + (await text(t)).slice(0,600).replace(/\n{2,}/g,"\n"));
await shot(t, "t25-evidence");
// public: the j/code landing
const octx = await b.newContext({ viewport: PHONE });
const o = await octx.newPage();
if (code) { await o.goto(`${BASE}/j/${code}`, { waitUntil:"networkidle" }); console.log("\n=== /j/code ===\n" + (await text(o)).slice(0,700).replace(/\n{2,}/g,"\n")); await shot(o, "p22-join-code"); }
await b.close();
