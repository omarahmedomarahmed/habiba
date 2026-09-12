import { browser, anatomy, text, shot, BASE, PHONE } from "./lib.mjs";
const b = await browser();
const ctx = await b.newContext({ viewport: PHONE, storageState: ".walkthrough2/state-patient.json", locale: "ar-EG" });
const p = await ctx.newPage();
const ratio = (s) => { const L=[...s].filter(c=>c.match(/\p{L}/u)); const A=L.filter(c=>c>='؀'&&c<='ۿ'); return L.length? Math.round(100*A.length/L.length):0; };
for (const [path, name] of [
  ["/patient","ar01-home"],["/patient/journal","ar02-journal"],["/patient/summary","ar03-summary"],
  ["/patient/consent","ar04-consent"],["/patient/claim","ar05-claim"],["/patient/sessions","ar06-sessions"],
  ["/patient/account","ar07-account"],["/patient/billing","ar08-billing"],["/patient/record","ar09-record"],
  ["/patient/profile","ar10-profile"],["/patient/homework","ar11-homework"],["/patient/browse","ar12-browse"],
  ["/patient/residency","ar13-residency"],["/patient/radar","ar14-radar"],
]) {
  await p.goto(`${BASE}${path}`, { waitUntil: "domcontentloaded" });
  await p.waitForLoadState("networkidle", { timeout: 6000 }).catch(()=>{});
  const a = await anatomy(p); const body = await text(p);
  console.log(`${String(ratio(body)).padStart(3)}% ar  dir=${a.dir}  ovf=${a.overflow}  ${path}`);
  await shot(p, name);
}
await b.close();
