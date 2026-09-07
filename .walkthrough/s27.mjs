import { BASE, browser, page } from "./lib.mjs";
import { signIn } from "./lib2.mjs";
const b = await browser();
const p = await page(b, "t");
await signIn(p, BASE, "yasmin@clinic.test", "walkthrough-therapist-1");
for (const path of ["/onboarding", "/settings", "/billing", "/patients/016f7f95-b109-4192-8fa3-0dd3dc972781"]) {
  await p.goto(`${BASE}${path}`, { waitUntil: "networkidle" });
  await p.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  await p.waitForTimeout(400);
  const geo = await p.evaluate(() => {
    const nav = [...document.querySelectorAll("nav")].map((n) => n.getBoundingClientRect()).find((r) => r.height > 0 && r.bottom >= window.innerHeight - 2);
    if (!nav) return { nav: null };
    const covered = [...document.querySelectorAll("button, a[href], input, select")]
      .map((el) => ({ el, r: el.getBoundingClientRect() }))
      .filter(({ el, r }) => r.height > 0 && !el.closest("nav") && r.bottom > nav.top && r.top < nav.bottom)
      .map(({ el, r }) => `${el.tagName}:${(el.textContent || el.getAttribute("name") || "").trim().slice(0, 28)} (bottom ${Math.round(r.bottom)} vs nav top ${Math.round(nav.top)})`);
    return { navTop: Math.round(nav.top), covered };
  });
  console.log(path, JSON.stringify(geo));
}
await b.close();
