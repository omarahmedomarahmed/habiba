import { browser, go, anatomy, text, shot, PHONE } from "./lib.mjs";
const b = await browser();
const ctx = await b.newContext({ viewport: PHONE, storageState: ".walkthrough2/state-patient.json" });
const p = await ctx.newPage();
const step = async (n, chars=900) => { console.log(`\n### ${n} ${p.url()}`, JSON.stringify(await anatomy(p))); console.log((await text(p)).slice(0,chars).replace(/\n{2,}/g,"\n")); await shot(p, n); };
for (const [path, name] of [
  ["/patient", "p10-home"],
  ["/patient/sessions", "p11-sessions"],
  ["/patient/summary", "p12-summary"],
  ["/patient/journal", "p13-journal"],
  ["/patient/record", "p14-record"],
  ["/patient/profile", "p15-profile"],
  ["/patient/consent", "p16-consent"],
  ["/patient/residency", "p17-residency"],
  ["/patient/billing", "p18-billing"],
  ["/patient/homework", "p19-homework"],
  ["/patient/account", "p20-account"],
]) { await go(p, path); await step(name); }
await b.close();
