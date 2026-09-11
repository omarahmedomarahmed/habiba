import { mkdirSync } from "node:fs";
import { chromium } from "playwright";

export const BASE = "http://localhost:3000";
export const SHOTS = "/home/user/habiba/docs/walkthrough-2";

mkdirSync(SHOTS, { recursive: true });

export const PHONE = { width: 414, height: 896 };
export const LAPTOP = { width: 1440, height: 900 };

export async function browser() {
  return chromium.launch({
    args: ["--no-sandbox"],
    executablePath: "/opt/pw-browsers/chromium",
  });
}

export async function context(b, viewport = PHONE) {
  return b.newContext({ viewport, deviceScaleFactor: 1, locale: "en-GB" });
}

export async function shot(p, name) {
  await p.screenshot({ path: `${SHOTS}/${name}.png`, fullPage: true });
  return name;
}

export async function text(p) {
  return p.locator("body").innerText();
}

/**
 * What a page is made of, measured rather than eyeballed.
 *
 * The design verdict in 37R.23b is "plain text and bare buttons, no sections,
 * no cards, no icons, nothing to rest the eye on". That is a judgement, but it
 * is a judgement about things that can be counted, so every page is counted
 * the same way and the counts sit beside the screenshot rather than replacing
 * it.
 */
export async function anatomy(p) {
  return p.evaluate(() => {
    const main = document.querySelector("main") ?? document.body;
    const vis = (el) => {
      const r = el.getBoundingClientRect();
      return r.width > 0 && r.height > 0;
    };
    const all = [...main.querySelectorAll("*")].filter(vis);
    const bordered = all.filter((el) => {
      const s = getComputedStyle(el);
      return (
        (s.borderTopWidth !== "0px" && s.borderTopStyle !== "none") ||
        s.boxShadow !== "none" ||
        (s.backgroundColor !== "rgba(0, 0, 0, 0)" && el !== main)
      );
    });
    const heading = (t) => [...main.querySelectorAll(t)].filter(vis).length;
    return {
      title: document.title,
      h1: heading("h1"),
      h2: heading("h2"),
      h3: heading("h3"),
      buttons: [...main.querySelectorAll("button, a[role=button], input[type=submit]")].filter(vis).length,
      links: [...main.querySelectorAll("a")].filter(vis).length,
      inputs: [...main.querySelectorAll("input, textarea, select")].filter(vis).length,
      svg: [...main.querySelectorAll("svg")].filter(vis).length,
      img: [...main.querySelectorAll("img")].filter(vis).length,
      tables: [...main.querySelectorAll("table")].filter(vis).length,
      lists: [...main.querySelectorAll("ul, ol")].filter(vis).length,
      panels: bordered.length,
      words: (main.innerText || "").trim().split(/\s+/).filter(Boolean).length,
      dir: document.documentElement.getAttribute("dir") || "ltr",
      lang: document.documentElement.getAttribute("lang") || "",
      /* A page that scrolls sideways on a phone is broken, in either language. */
      overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    };
  });
}

export async function go(p, path, { wait = "networkidle" } = {}) {
  const response = await p.goto(`${BASE}${path}`, { waitUntil: "domcontentloaded" });
  try {
    await p.waitForLoadState(wait, { timeout: 8000 });
  } catch {
    /* A page that never goes idle is still a page; judge what rendered. */
  }
  return response?.status() ?? 0;
}

/** Fill by label text, the way a person finds a field. */
export async function fill(p, label, value) {
  const field = p.getByLabel(label, { exact: false }).first();
  await field.waitFor({ state: "visible", timeout: 10000 });
  await field.fill(value);
}

export async function click(p, name) {
  const target = p.getByRole("button", { name, exact: false }).first();
  await target.waitFor({ state: "visible", timeout: 10000 });
  await target.click();
}

export function log(...parts) {
  console.log(...parts);
}
