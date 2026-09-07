import { BASE, browser, page, shot, text } from "./lib.mjs";
const b = await browser();
const p = await page(b, "therapist");

async function signIn(email, password, where = "/login") {
  await p.goto(`${BASE}${where}`, { waitUntil: "networkidle" });
  await p.fill("#email", email);
  await p.fill("#password", password);
  await p.click("button[type=submit]");
  await p.waitForURL((u) => !u.pathname.includes("login"), { timeout: 45000 }).catch(() => {});
  await p.waitForLoadState("networkidle");
  console.log("signed in →", p.url());
}

await signIn("yasmin@clinic.test", "walkthrough-therapist-1");
await shot(p, "04-therapist-landing");
console.log("---- LANDING ----\n" + (await text(p)).slice(0, 1500));
await b.close();
