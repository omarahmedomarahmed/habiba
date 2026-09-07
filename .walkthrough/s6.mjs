import { BASE, browser, page, shot } from "./lib.mjs";
const b = await browser();
const p = await page(b, "t");
await p.goto(`${BASE}/login`, { waitUntil: "networkidle" });
await p.fill("#email", "yasmin@clinic.test");
await p.fill("#password", "walkthrough-therapist-1");
await p.click("button[type=submit]");
await p.waitForURL((u) => !u.pathname.includes("login"), { timeout: 45000 }).catch(() => {});
await p.waitForLoadState("networkidle");

const geometry = await p.evaluate(() => {
  const nav = document.querySelector('nav[aria-label="Primary"]');
  const navBox = nav?.getBoundingClientRect();
  const out = [];
  for (const el of document.querySelectorAll("button, a[href]")) {
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) continue;
    const label = (el.textContent || "").trim().slice(0, 32);
    if (!label) continue;
    const covered =
      navBox && r.bottom > navBox.top && r.top < navBox.bottom && r.right > navBox.left && r.left < navBox.right;
    if (covered) out.push({ label, top: Math.round(r.top), navTop: Math.round(navBox.top) });
  }
  return {
    nav: navBox ? { top: Math.round(navBox.top), height: Math.round(navBox.height) } : null,
    viewport: window.innerHeight,
    bodyPaddingBottom: getComputedStyle(document.body).paddingBottom,
    mainPaddingBottom: getComputedStyle(document.querySelector("main") ?? document.body).paddingBottom,
    covered: out,
    docHeight: document.documentElement.scrollHeight,
  };
});
console.log(JSON.stringify(geometry, null, 1));

// Scroll to the bottom and look again — this is what a person does.
await p.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
await p.waitForTimeout(500);
const after = await p.evaluate(() => {
  const nav = document.querySelector('nav[aria-label="Primary"]')?.getBoundingClientRect();
  const btn = [...document.querySelectorAll("button")].find((b) => b.textContent?.includes("Save details"));
  const r = btn?.getBoundingClientRect();
  return r && nav
    ? { button: Math.round(r.top), navTop: Math.round(nav.top), coveredAtBottom: r.bottom > nav.top }
    : null;
});
console.log("at the bottom of the page:", JSON.stringify(after));
await shot(p, "06-onboarding-bottom");
await b.close();
