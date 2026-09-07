import { chromium } from "playwright";
export const BASE = "http://localhost:3000";
export const SHOTS = "/home/user/habiba/docs/walkthrough";
export async function browser() {
  const b = await chromium.launch({
    args: ["--no-sandbox"],
    executablePath: "/opt/pw-browsers/chromium",
  });
  return b;
}
export async function page(b, name) {
  const ctx = await b.newContext({ viewport: { width: 430, height: 932 }, deviceScaleFactor: 2 });
  const p = await ctx.newPage();
  p.on("console", (m) => { if (m.type() === "error") console.log(`   [console] ${m.text().slice(0,140)}`); });
  p.on("pageerror", (e) => console.log(`   [pageerror] ${String(e).slice(0,140)}`));
  return p;
}
export async function shot(p, name) {
  await p.screenshot({ path: `${SHOTS}/${name}.png`, fullPage: true });
  console.log(`   📸 ${name}`);
}
export async function text(p) {
  return (await p.locator("body").innerText()).replace(/\s+\n/g, "\n");
}
