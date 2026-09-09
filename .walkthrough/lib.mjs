import { chromium } from "playwright";
export const BASE = "http://localhost:3000";
export const SHOTS = "/home/user/habiba/docs/walkthrough";
export async function browser() {
  return chromium.launch({ args: ["--no-sandbox"], executablePath: "/opt/pw-browsers/chromium" });
}
export async function page(b) {
  const ctx = await b.newContext({ viewport: { width: 430, height: 932 }, deviceScaleFactor: 2 });
  return ctx.newPage();
}
export async function shot(p, name) {
  await p.screenshot({ path: `${SHOTS}/${name}.png`, fullPage: true });
  console.log(`   shot ${name}`);
}
export async function text(p) { return (await p.locator("body").innerText()); }
