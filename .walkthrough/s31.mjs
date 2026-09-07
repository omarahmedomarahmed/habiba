import { BASE, browser, page, shot, text } from "./lib.mjs";
import { signIn, clickButton } from "./lib2.mjs";
const b = await browser();
const p = await page(b, "t");
await signIn(p, BASE, "yasmin@clinic.test", "walkthrough-therapist-1");
await p.goto(`${BASE}/patients/016f7f95-b109-4192-8fa3-0dd3dc972781`, { waitUntil: "networkidle" });
await clickButton(p, "Create an invite link");
await p.waitForTimeout(2000);
const t = await text(p);
const i = t.indexOf("Their own access");
console.log(t.slice(i, i + 900));
const link = await p.evaluate(() => {
  const el = [...document.querySelectorAll("input,textarea,code,a")].map((e) => e.value || e.textContent || "").find((v) => /patient\/(signup|invite)/.test(v));
  return el || null;
});
console.log("INVITE LINK:", link);
await shot(p, "19-invite-created");
await b.close();
