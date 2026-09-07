import { BASE, browser, page, shot, text } from "./lib.mjs";
const b = await browser();
const p = await page(b, "therapist");
await p.goto(`${BASE}/login`, { waitUntil: "networkidle" });
await p.fill("#email", "yasmin@clinic.test");
await p.fill("#password", "walkthrough-therapist-1");
await p.click("button[type=submit]");
await p.waitForURL((u) => !u.pathname.includes("login"), { timeout: 45000 }).catch(() => {});
await p.waitForLoadState("networkidle");
const t = await text(p);
console.log("---- ONBOARDING (fields) ----");
console.log(await p.locator("input,select,textarea,button").evaluateAll(els =>
  els.map(e => `${e.tagName.toLowerCase()}[${e.type||""}] ${e.name||e.id||""} ${(e.textContent||"").trim().slice(0,40)}`).slice(0, 40)));
console.log("---- text tail ----");
console.log(t.slice(t.indexOf("About your practice"), t.indexOf("About your practice") + 1500));
await b.close();
