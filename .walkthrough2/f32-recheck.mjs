import { browser, go, text, shot, PHONE, LAPTOP } from "./lib.mjs";
const b = await browser();
// 1. the orb, for an Egyptian number
const pctx = await b.newContext({ viewport: PHONE, storageState: ".walkthrough2/state-patient.json" });
const p = await pctx.newPage();
await go(p, "/patient");
await p.getByRole("button", { name: /Get help now/i }).first().click();
await p.waitForTimeout(1500);
const sheet = await text(p);
console.log("SOS SHEET:\n" + sheet.slice(sheet.indexOf("Help now"), sheet.indexOf("Help now")+400).replace(/\n{2,}/g,"\n"));
console.log("SHOWS 988:", /988/.test(sheet), "| SHOWS United States:", /United States/.test(sheet));
await shot(p, "p28-sos-fixed");
// 2. nav bar for a signed-out visitor
const octx = await b.newContext({ viewport: PHONE });
const o = await octx.newPage();
await go(o, "/patient/signup");
const out = await text(o);
console.log("\nSIGNED OUT SIGNUP shows tabs:", /Sessions\s*\n?Steps/.test(out.replace(/\s+/g," ")) || /Steps/.test(out));
console.log("SOS present:", /SOS/.test(out));
await shot(o, "p29-signup-nochrome");
await b.close();
