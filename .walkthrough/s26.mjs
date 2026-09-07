import { BASE, browser, page } from "./lib.mjs";
import { signIn } from "./lib2.mjs";
const b = await browser();
const p = await page(b, "t");
await signIn(p, BASE, "yasmin@clinic.test", "walkthrough-therapist-1");
await p.goto(`${BASE}/patients`, { waitUntil: "networkidle" });
const geo = await p.evaluate(() => {
  const nav = [...document.querySelectorAll("nav")].map((n) => n.getBoundingClientRect()).find((r) => r.height > 0 && r.bottom >= window.innerHeight - 2);
  const link = document.querySelector('a[href^="/patients/"]')?.getBoundingClientRect();
  return {
    viewport: window.innerHeight,
    doc: document.documentElement.scrollHeight,
    nav: nav ? { top: Math.round(nav.top), bottom: Math.round(nav.bottom) } : null,
    link: link ? { top: Math.round(link.top), bottom: Math.round(link.bottom) } : null,
    overlaps: nav && link ? link.bottom > nav.top && link.top < nav.bottom : null,
  };
});
console.log(JSON.stringify(geo));
const before = p.url();
await p.locator('a[href^="/patients/"]').first().click({ timeout: 8000 }).catch((e) => console.log("click failed:", String(e).split("\n")[0]));
await p.waitForTimeout(1500);
console.log(before, "→", p.url());
await b.close();
