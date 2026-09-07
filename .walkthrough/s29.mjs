import { BASE, browser, page } from "./lib.mjs";
import { signIn } from "./lib2.mjs";
const b = await browser();
const p = await page(b, "t");
await signIn(p, BASE, "yasmin@clinic.test", "walkthrough-therapist-1");
for (const path of ["/settings", "/onboarding"]) {
  await p.goto(`${BASE}${path}`, { waitUntil: "networkidle" });
  for (let i = 0; i < 8; i += 1) {
    await p.mouse.wheel(0, 2000);
    await p.waitForTimeout(250);
  }
  console.log(path, await p.evaluate(() => {
    const nav = [...document.querySelectorAll("nav")].map((n) => n.getBoundingClientRect()).find((r) => r.height > 0 && r.bottom >= window.innerHeight - 2);
    const covered = [...document.querySelectorAll("button, a[href], input, select")]
      .map((el) => ({ el, r: el.getBoundingClientRect() }))
      .filter(({ el, r }) => r.height > 0 && !el.closest("nav") && nav && r.bottom > nav.top && r.top < nav.bottom)
      .map(({ el }) => (el.textContent || "").trim().slice(0, 24));
    return { atBottom: Math.round(window.scrollY + window.innerHeight) >= document.documentElement.scrollHeight - 2, covered };
  }));
}
await b.close();
