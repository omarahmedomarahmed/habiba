/**
 * Every page, every persona, both languages, both widths.
 *
 * Writes one JSON record per page into `.walkthrough2/sweep.json` and one
 * screenshot per page into `docs/walkthrough-2/`, so the design table in the
 * report is built from what was actually on the screen rather than from
 * memory. The counts do not replace looking at the screenshots; they decide
 * which screenshots are worth looking at first.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { browser, anatomy, shot, text, BASE, PHONE, LAPTOP } from "./lib.mjs";
import { ROUTES } from "./routes.mjs";

const ids = JSON.parse(readFileSync(".walkthrough2/ids.json", "utf8"));
const STATE = {
  out: undefined,
  therapist: ".walkthrough2/state-therapist.json",
  patient: ".walkthrough2/state-patient.json",
  admin: ".walkthrough2/state-admin.json",
};

const only = process.argv[2];
const b = await browser();
const out = [];

for (const who of ["out", "therapist", "patient", "admin"]) {
  const routes = ROUTES.filter((r) => r.who === who).filter((r) => !only || r.path.includes(only));
  if (routes.length === 0) continue;

  for (const lang of ["en", "ar"]) {
    for (const [size, viewport] of [["phone", PHONE], ["wide", LAPTOP]]) {
      const ctx = await b.newContext({ viewport, storageState: STATE[who], locale: lang === "ar" ? "ar-EG" : "en-GB" });
      const p = await ctx.newPage();
      const errors = [];
      p.on("pageerror", (e) => errors.push(String(e).slice(0, 120)));
      p.on("console", (m) => { if (m.type() === "error") errors.push(m.text().slice(0, 120)); });

      for (const route of routes) {
        let path = route.path;
        if (route.needs) {
          const value = ids[route.needs];
          if (!value) { out.push({ ...route, lang, size, status: "unreachable" }); continue; }
          path = path.replace(`:${route.needs}`, value);
        }
        const url = lang === "ar" ? `/ar${path === "/" ? "" : path}` : path;
        errors.length = 0;
        let status = 0;
        try {
          const r = await p.goto(`${BASE}${url}`, { waitUntil: "domcontentloaded", timeout: 30000 });
          status = r?.status() ?? 0;
          await p.waitForLoadState("networkidle", { timeout: 6000 }).catch(() => {});
        } catch (e) {
          out.push({ ...route, lang, size, status: "error", note: String(e).slice(0, 120) });
          continue;
        }
        const name = `${route.group}_${path.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "") || "home"}_${lang}_${size}`;
        const a = await anatomy(p).catch(() => ({}));
        const body = await text(p).catch(() => "");
        await shot(p, name).catch(() => {});
        out.push({
          path,
          url,
          who,
          group: route.group,
          lang,
          size,
          status,
          landed: new URL(p.url()).pathname,
          shot: name,
          ...a,
          errors: [...new Set(errors)].slice(0, 3),
          head: body.slice(0, 160).replace(/\s+/g, " "),
        });
        process.stdout.write(".");
      }
      await ctx.close();
    }
  }
  console.log(` ${who} done`);
}

writeFileSync(".walkthrough2/sweep.json", JSON.stringify(out, null, 1));
console.log(`\n${out.length} page visits recorded`);
await b.close();
