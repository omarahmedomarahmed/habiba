import { BASE, browser, page, shot } from "./lib.mjs";
const b = await browser();
const p = await page(b, "patient");
await p.goto(`${BASE}/patient/invite/P10UHNmjg2XXFuwbZx1CngTu2-rU4mY7`, { waitUntil: "networkidle" });
console.log(await p.evaluate(() => {
  const nav = [...document.querySelectorAll("nav")].map((n) => n.getBoundingClientRect()).find((r) => r.height > 0 && r.bottom >= window.innerHeight - 2);
  const rows = [...document.querySelectorAll("a,button")].map((el) => {
    const r = el.getBoundingClientRect();
    return { label: (el.textContent||"").trim().slice(0,24), top: Math.round(r.top), bottom: Math.round(r.bottom),
      covered: nav ? r.bottom > nav.top && r.top < nav.bottom : null, inNav: Boolean(el.closest("nav")) };
  }).filter(r => r.label && !r.inNav);
  return { navTop: nav ? Math.round(nav.top) : null, viewport: window.innerHeight, doc: document.documentElement.scrollHeight, rows };
}));
await shot(p, "21-patient-invite-page");
await b.close();
