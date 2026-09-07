import { BASE, browser, page, shot, text } from "./lib.mjs";
const b = await browser();
const p = await page(b, "therapist");
const notes = [];

await p.goto(`${BASE}/`, { waitUntil: "networkidle" });
await shot(p, "01-home-en");
console.log("HOME:", (await text(p)).slice(0, 200).replace(/\n/g, " | "));

await p.goto(`${BASE}/signup`, { waitUntil: "networkidle" });
await shot(p, "02-therapist-signup");
console.log("SIGNUP fields:", await p.locator("input").evaluateAll(els => els.map(e => e.name || e.id)));

await p.fill("#firstName", "Yasmin");
await p.fill("#lastName", "Hassan");
await p.fill("#email", "yasmin@clinic.test");
await p.fill("#password", "walkthrough-therapist-1");
await p.click("button[type=submit]");
await p.waitForURL((u) => !u.pathname.endsWith("/signup"), { timeout: 45000 }).catch(() => {});
await p.waitForLoadState("networkidle");
console.log("AFTER SIGNUP url:", p.url());
await shot(p, "03-after-signup");
console.log((await text(p)).slice(0, 900));
await b.close();
