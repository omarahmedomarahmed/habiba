/**
 * Every word in the product, measured against the pixels behind it.
 *
 *     npm run build && npm run start &        # it needs a server
 *     npm run verify:contrast
 *     npm run verify:contrast -- http://localhost:3100
 *
 * ## Why this is a browser and not a grep
 *
 * `verify:palette` reads source and enforces the rules we wrote down: which
 * ramp a file may use, which shades exist, what may not carry white. It is
 * fast, it runs in the gates, and it can only ever catch the mistakes somebody
 * thought of in advance.
 *
 * It cannot catch a colour that is fine in isolation and wrong where it lands.
 * `text-slate-400` is a legal class. On white it is 2.63:1, and there were 112
 * of them labelling the tiles on the console the founders run the company
 * from: "In the bank", "Burning", "Held for clinicians". Every one passed
 * every source check in this repository because the source was not the problem
 * — the pairing was, and the pairing only exists once it renders.
 *
 * Three more it found that no rule predicted: the payment banner at 3.65:1
 * (white on `emerald-600`, on every screen of the company portal, saying a
 * payment had succeeded), an online badge at 4.22:1 that was one step short,
 * and a dash standing in for a missing value at 1.49:1.
 *
 * ## What it does
 *
 * Walks every text node on a page, resolves the first opaque background above
 * it, and applies WCAG 1.4.3: 4.5:1 for body text, 3:1 once the type is 24px,
 * or 18.66px and bold.
 *
 * ## The two things that make it honest rather than noisy
 *
 * 🔴 **The browser converts the colour, not a regex.** Tailwind v4 emits
 * `oklch()` and `getComputedStyle` hands it back verbatim. A "grab the numbers"
 * parse reads `oklch(0.98 0.003 247)` as `rgb(0.98, 0.003, 247)` and invents
 * failures. A 1x1 canvas accepts any CSS colour syntax and returns sRGB bytes.
 * The first run of this reported six failures that were all that bug.
 *
 * 🔴 **`sr-only` is not a contrast failure.** It clips a box to one pixel
 * rather than setting `display:none`, so a hidden label is still "visible" to
 * every other test and its inherited ink sits on whatever ground is behind it.
 * The radar's filter labels reported 1.02:1 and nobody can see them. An audit
 * that cries wolf gets ignored, which costs more than the two lines it saved.
 */
import { existsSync, readdirSync } from "node:fs";

import { DEMO_PASSWORD } from "./_demo-cast";
import { LOCALE_COOKIE } from "../lib/i18n/config";
import { reporter } from "./_verify";

const { check, skipUnless, finish } = reporter();

/*
 * `VERIFY_URL` is how `verify:served` hands over the server it just started,
 * so this gate can run inside `npm run gates` rather than only by hand.
 */
const BASE =
  process.argv.find((a) => a.startsWith("http")) ??
  process.env.VERIFY_URL ??
  "http://localhost:3100";

/**
 * 🔴 THREE RUNS, BECAUSE A COLOUR IS NOT THE ONLY THING THAT DECIDES CONTRAST.
 *
 * Desktop English was the first pass and it is the least interesting one. The
 * other two change what is on screen rather than what shade it is:
 *
 *   ar    swaps direction, and swaps every string for one of a different
 *         length. A label that fit on one line in English wraps in Arabic, and
 *         a wrap can put text over a different half of a gradient or a card.
 *   390   is the width most patients hold. Stacking changes which ground a
 *         line lands on, and small screens are where the tight type lives.
 *
 * The cookie name is imported rather than typed, because a script holding its
 * own copy of a constant stops matching the day somebody renames it.
 */
const ALL_RUNS = [
  { key: "en1280", name: "en 1280", locale: "en", width: 1280, height: 900 },
  { key: "ar1280", name: "ar 1280", locale: "ar", width: 1280, height: 900 },
  { key: "en390", name: "en 390", locale: "en", width: 390, height: 844 },
  { key: "ar390", name: "ar 390", locale: "ar", width: 390, height: 844 },
];

/*
 * 🔴 AND A WAY TO RUN FEWER OF THEM, SAID OUT LOUD RATHER THAN SILENTLY.
 *
 * Four runs over every destination is minutes, and against the `next dev`
 * server `verify:served` starts it is many minutes. This repository already
 * knows where that ends: a gate that is annoying to run beside normal work is
 * a gate that gets run less.
 *
 * So `npm run gates` asks for the two ENDS of the grid, desktop English and
 * phone Arabic. Direction and width are both exercised at a third of the cost.
 *
 * That is a smoke test and it is NOT the whole grid: a defect that needs RTL
 * at a width only the desktop has would survive it. The gap is accepted and
 * stated rather than hidden, which is why the run prints which combinations it
 * covered and says PARTIAL when it is not all four. The full grid is what runs
 * before a release.
 */
const RUNS = process.env.CONTRAST_RUNS
  ? ALL_RUNS.filter((r) =>
      process.env.CONTRAST_RUNS!.split(",").includes(r.key),
    )
  : ALL_RUNS;

/** Public pages, and then one signed-in sweep per kind of person. */
const PUBLIC = [
  "/",
  "/for-patients",
  "/for-companies",
  "/for-clinics",
  "/for-therapists",
  "/pricing",
  "/radar",
  "/integrations",
  "/developers",
];

/*
 * 🔴 A PATH THAT IS NOT LISTED IS NOT MEASURED, and that is the quiet way an
 * audit like this lies. `/earnings` was missing from the first list, so a
 * whole page of money, a payout form and a withdrawal history went unlooked
 * at while the run reported green. Every destination in each portal's own
 * navigation belongs here.
 */
const SIGNED_IN = [
  {
    who: "therapist",
    door: "/login",
    email: "omarabdelgawad001@gmail.com",
    paths: [
      "/dashboard",
      "/sessions",
      "/bookings",
      "/patients",
      "/notes",
      "/copilot",
      "/earnings",
      "/billing",
      "/settings",
    ],
  },
  {
    who: "patient",
    door: "/patient/login",
    email: "mr.3omar.a7mad@gmail.com",
    field: "handle",
    paths: [
      "/patient",
      "/patient/sessions",
      "/patient/radar",
      "/patient/browse",
      "/patient/account",
      "/patient/billing",
    ],
  },
  {
    who: "company",
    door: "/sponsor/sign-in",
    email: "habiba@24therapy.app",
    paths: [
      "/sponsor",
      "/sponsor/people",
      "/sponsor/code",
      "/sponsor/pot",
      "/sponsor/domains",
      "/sponsor/integrations",
      "/sponsor/settings",
    ],
  },
  {
    who: "clinic",
    door: "/clinic/sign-in",
    email: "habibaheikal27@gmail.com",
    paths: [
      "/clinic",
      "/clinic/people",
      "/clinic/bills",
      "/clinic/earnings",
      "/clinic/team",
      "/clinic/records",
    ],
  },
  {
    who: "admin",
    door: "/staff/sign-in",
    email: "omar@24therapy.app",
    paths: [
      "/admin",
      "/admin/usage",
      "/admin/actuals",
      "/admin/vault",
      "/admin/radar",
      "/admin/settings",
      "/admin/financial-model",
      "/admin/content",
      "/admin/audit",
    ],
  },
];

/**
 * 🔴 Playwright's default resolution wants a headless shell this image does not
 * ship, while the full browser beside it is present. Discovering the binary
 * beats hardcoding a version that changes under us, and beats a bare launch
 * that fails with a path nobody recognises.
 */
function browserPath(): string | undefined {
  const root = process.env.PLAYWRIGHT_BROWSERS_PATH ?? "/opt/pw-browsers";
  if (!existsSync(root)) return undefined;
  for (const entry of readdirSync(root)) {
    if (!entry.startsWith("chromium-")) continue;
    const exe = `${root}/${entry}/chrome-linux/chrome`;
    if (existsSync(exe)) return exe;
  }
  return undefined;
}

/* The audit, as source, because it runs inside the page. */
const AUDIT = String.raw`(() => {
  const cv = document.createElement("canvas");
  cv.width = cv.height = 1;
  const ctx = cv.getContext("2d", { willReadFrequently: true });
  const toRgb = (css) => {
    ctx.clearRect(0, 0, 1, 1);
    ctx.fillStyle = "#000";
    ctx.fillStyle = css;
    ctx.fillRect(0, 0, 1, 1);
    const d = ctx.getImageData(0, 0, 1, 1).data;
    return [d[0], d[1], d[2], d[3] / 255];
  };
  const lum = (r, g, b) => {
    const f = (c) => { c /= 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
    return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
  };
  const ratio = (a, b) => {
    const la = lum(a[0], a[1], a[2]), lb = lum(b[0], b[1], b[2]);
    const hi = la > lb ? la : lb, lo = la > lb ? lb : la;
    return (hi + 0.05) / (lo + 0.05);
  };
  const groundOf = (el) => {
    for (let n = el; n; n = n.parentElement) {
      const c = toRgb(getComputedStyle(n).backgroundColor);
      if (c[3] > 0.5) return c;
    }
    return [255, 255, 255, 1];
  };

  const out = [];
  for (const el of document.querySelectorAll("*")) {
    const text = [...el.childNodes]
      .filter((n) => n.nodeType === 3)
      .map((n) => n.textContent.trim())
      .join("");
    if (!text) continue;
    const cs = getComputedStyle(el);
    if (cs.visibility === "hidden" || cs.display === "none") continue;
    if (parseFloat(cs.opacity) < 0.5) continue;
    const box = el.getBoundingClientRect();
    if (box.width <= 1 || box.height <= 1) continue;
    const size = parseFloat(cs.fontSize);
    const weight = parseInt(cs.fontWeight, 10) || 400;
    const need = size >= 24 || (size >= 18.66 && weight >= 700) ? 3 : 4.5;
    const got = ratio(toRgb(cs.color), groundOf(el));
    if (got < need) {
      const ink = toRgb(cs.color), ground = groundOf(el);
      out.push({
        text: text.slice(0, 40),
        got: Math.round(got * 100) / 100,
        need,
        size,
        weight,
        /* 🔴 The two colours, so a failure names its own fix. */
        ink: "#" + ink.slice(0, 3).map((n) => n.toString(16).padStart(2, "0")).join(""),
        ground: "#" + ground.slice(0, 3).map((n) => n.toString(16).padStart(2, "0")).join(""),
      });
    }
  }
  return out;
})()`;

type Bad = {
  text: string;
  got: number;
  need: number;
  size: number;
  weight: number;
  ink: string;
  ground: string;
};

async function main() {
  const exe = browserPath();

  const reachable = await fetch(BASE, { signal: AbortSignal.timeout(5000) })
    .then((r) => r.ok)
    .catch(() => false);

  /*
   * 🔴 SAYS SO RATHER THAN PASSING. A contrast gate that reports green because
   * no server answered is the failure mode this whole file exists to avoid.
   */
  await skipUnless(
    reachable && exe !== undefined,
    "a run with the app up",
    reachable
      ? "no chromium under PLAYWRIGHT_BROWSERS_PATH"
      : `no server at ${BASE}: run \`npm run build && npm run start\` first`,
    async () => {
      await audit(exe!);
    },
  );

  finish("contrast");
}

async function audit(exe: string) {
  /*
   * 🔴 THE FIRST LINE SAYS HOW MUCH OF THE GRID THIS RUN ACTUALLY COVERED.
   *
   * A partial run and a full run print the same `PASS` otherwise, and the
   * difference between them is the difference between "measured" and "spot
   * checked". Nobody should have to read the environment to know which they
   * are looking at.
   */
  check(
    "🔴 this run names the locale and width combinations it covered",
    RUNS.length > 0,
    RUNS.length === ALL_RUNS.length
      ? `the whole grid: ${ALL_RUNS.map((r) => r.name).join(", ")}`
      : `PARTIAL: ${RUNS.map((r) => r.name).join(", ")}, of ${String(ALL_RUNS.length)}`,
  );

  const { chromium } = await import("playwright");
  const browser = await chromium.launch({ executablePath: exe });

  /*
   * 🔴 A FIRST RUN MODAL MEANS THE PAGE BEHIND IT IS NOT BEING MEASURED.
   *
   * The therapist's dashboard opens with the alarm prompt over it. The first
   * version of this walked five therapist pages and audited the same dialog
   * five times, reporting the dashboard green on the strength of a modal. The
   * blurred page underneath was never looked at.
   *
   * So anything that offers a way out is taken before the sweep. The label
   * comes from the dictionary rather than being typed here, because a script
   * holding its own copy of a string stops matching the day somebody edits it.
   */
  const { DICTIONARIES } = await import("../lib/i18n/messages");
  const DISMISS = [
    DICTIONARIES.en["tpres.notNow"],
    DICTIONARIES.en["tplan.confirmNotNow"],
  ];

  const sweep = async (page: any, path: string, label: string) => {
    const res = await page
      .goto(`${BASE}${path}`, { waitUntil: "networkidle" })
      .catch(() => null);
    if (!res || res.status() >= 400) {
      check(
        `${label} ${path} answers`,
        false,
        `HTTP ${res ? String(res.status()) : "no response"}`,
      );
      return;
    }
    for (const word of DISMISS) {
      const button = page
        .getByRole("button", { name: word, exact: true })
        .first();
      if (await button.isVisible().catch(() => false)) {
        await button.click().catch(() => {});
        await page.waitForTimeout(250);
      }
    }
    const bad = (await page.evaluate(AUDIT)) as Bad[];
    check(
      `🔴 every word on ${label} ${path} clears WCAG 1.4.3`,
      bad.length === 0,
      bad.length === 0
        ? "all text measured against its own ground"
        : bad
            .slice(0, 4)
            .map(
              (b) =>
                `${String(b.got)}:1 needs ${String(b.need)}, ${b.ink} on ${b.ground}, ` +
                `${String(b.size)}px/${String(b.weight)} "${b.text}"`,
            )
            .join(" · "),
    );
  };

  /*
   * The locale rides on a cookie, so it is set on the CONTEXT rather than
   * clicked through the switch. Clicking would work and would also mean every
   * run depends on the switch still being where the last run left it.
   */
  const contextFor = async (
    run: (typeof RUNS)[number],
    storageState?: object,
  ) => {
    const c = await browser.newContext({
      viewport: { width: run.width, height: run.height },
      ...(storageState ? { storageState: storageState as never } : {}),
    });
    await c.addCookies([{ name: LOCALE_COOKIE, value: run.locale, url: BASE }]);
    return c;
  };

  /*
   * 🔴 SIGN IN ONCE PER PERSON, NOT ONCE PER RUN, AND THE PRODUCT TAUGHT ME WHY.
   *
   * The first four-way matrix reported nine sign-in failures, scattered: the
   * company and the clinic in Arabic, the company and the clinic at 390, then
   * every one of the five on the last run. A pattern that gets worse as a run
   * goes on is not a layout bug, and it was not: every door signs in perfectly
   * when tried on its own at 390 in Arabic.
   *
   * `app/(sponsor)/sponsor/sign-in/actions.ts` rate limits per caller ON THE
   * WAY IN rather than on a wrong password, which is the stronger design and
   * the reason this product does not hand an attacker a free guess. Twenty
   * sign-ins in one run from one caller is exactly what that limiter exists to
   * refuse, so it refused them, correctly, and my gate called the refusal a
   * defect.
   *
   * A verifier that trips the product's own defences and reports them as
   * failures teaches everybody to ignore it. So each person signs in once and
   * the session is reused across all four runs: five authentications instead
   * of twenty, and the limiter is left to do its job for real callers.
   */
  const session = new Map<string, object>();

  for (const person of SIGNED_IN) {
    const c = await browser.newContext({
      viewport: { width: 1280, height: 900 },
    });
    const p = await c.newPage();
    await p
      .goto(`${BASE}${person.door}`, { waitUntil: "domcontentloaded" })
      .catch(() => {});
    /*
     * 🔴 THE PATIENT'S DOOR ASKS FOR A HANDLE, NOT AN EMAIL, and a `.catch`
     * around the fill turned that into silence.
     *
     * The throwaway crawler this grew out of filled `input[name="email"]`,
     * swallowed the "no such element" on the patient door, submitted an empty
     * form, and then waited for a URL that "no longer ends in sign-in", which
     * was already true of the login page it was still sitting on. So it walked
     * the patient and therapist paths as a signed-out visitor, got redirected
     * back to the door every time, measured the door, and reported nine pages
     * green that it had never once loaded.
     *
     * That is why this is a `check` and not a `continue`: a verifier that
     * cannot get in has to say so, or it reports on nothing and calls it clean.
     */
    await p
      .fill(`input[name="${person.field ?? "email"}"]`, person.email)
      .catch(() => {});
    await p.fill('input[name="password"]', DEMO_PASSWORD).catch(() => {});
    await p.click('form button[type="submit"]').catch(() => {});
    const inside = await p
      .waitForURL((u: URL) => !/sign-in|login/.test(u.pathname), {
        timeout: 30_000,
      })
      .then(() => true)
      .catch(() => false);

    check(
      `${person.who} can sign in, so their screens are actually measured`,
      inside,
      person.door,
    );
    if (inside) session.set(person.who, await c.storageState());
    await c.close();
  }

  for (const run of RUNS) {
    const ctx = await contextFor(run);
    const page = await ctx.newPage();
    for (const path of PUBLIC) await sweep(page, path, `public ${run.name}`);
    await ctx.close();

    for (const person of SIGNED_IN) {
      const state = session.get(person.who);
      if (!state) continue; /* The sign-in already failed loudly above. */
      const c = await contextFor(run, state);
      const p = await c.newPage();
      for (const path of person.paths)
        await sweep(p, path, `${person.who} ${run.name}`);
      await c.close();
    }
  }

  await browser.close();
}

void main();
