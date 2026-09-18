/**
 * Sign in as the local admin and photograph a page, because a gate cannot read.
 *
 *     npm run build && npm run screens:prep
 *     node scripts/browser/shot.mjs <out-dir> /admin/actuals /admin/transfers
 *
 * ## 🔴 WHY THIS EXISTS
 *
 * `$3,500 7`. A month costing three and a half thousand dollars with seven
 * people on the payroll rendered as those two numbers with a margin between
 * them, in a right-aligned column of figures, and read as $35,007. Twenty-four
 * gates were green over it. The same defect turned up again the next sprint as
 * `$25,000the money we started with`, and both were found the same way: by
 * taking a picture of the page and looking at it.
 *
 * ## 🔴 IT IS POINTED AT A LOCAL SERVER, AND NEVER AT PRODUCTION
 *
 * `BASE` is a loopback address with no override. A screenshot tool that could
 * be aimed at `24t.vercel.app` is a tool that signs into the real console with
 * a password from a script, and `scripts/demo.ts` already says what publishing
 * an operator frame from a database with real-looking names would disclose.
 */
import { chromium } from "playwright";

const BASE = "http://127.0.0.1:3412";
const CHROME = process.env.CHROME_PATH ?? "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";

const [, , out, ...paths] = process.argv;
if (!out || paths.length === 0) {
  console.error("usage: node scripts/browser/shot.mjs <out-dir> <path> [path...]");
  process.exit(1);
}

const browser = await chromium.launch({ executablePath: CHROME });
const page = await browser.newPage({ viewport: { width: 1280, height: 1000 } });

await page.goto(`${BASE}/staff/sign-in`);
await page.fill('input[name="email"]', "admin@24therapy.test");
await page.fill('input[name="password"]', "Screenshots2026!");
await Promise.all([
  page.waitForURL((u) => !u.pathname.includes("sign-in"), { timeout: 30000 }),
  page.click('button[type="submit"]'),
]);

for (const path of paths) {
  await page.goto(`${BASE}${path}`, { waitUntil: "networkidle" });
  const name = `shot${path.replace(/[^a-z0-9]+/gi, "_")}.png`;
  await page.screenshot({ path: `${out}/${name}`, fullPage: true });
  console.log(`${path} -> ${name}`);
}

await browser.close();
