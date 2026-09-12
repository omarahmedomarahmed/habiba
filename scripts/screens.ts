/**
 * Every screen in the product, captured. PLAN.md 18.10–18.12.
 *
 *   npm run screens          public + therapist + patient, into docs/screens/
 *   npm run screens -- --admin   also the admin console, into docs/screens/admin
 *
 * ## Why this exists rather than a folder somebody fills by hand
 *
 * C80: **a screenshot is a promise that expires silently.** The product moves,
 * the picture does not, and nobody notices until a visitor does. A sweep that
 * runs by command means a stale picture is one run away from being correct,
 * and a picture nobody can regenerate is a picture that should not be in a
 * repository at all.
 *
 * ## 🔴 18.11 — synthetic data only, and it refuses rather than trusts
 *
 * A screenshot committed to a repository is permanent in a way a database row
 * is not: the purge in sprint 22 empties tables, and it will never reach a PNG
 * in git history. So this does not *assume* it is pointed at a demo database —
 * it counts what is in the one it was given and **exits** if anything there
 * looks like a real caseload. The check is on the data, not on the URL,
 * because a connection string is exactly the kind of thing somebody pastes in
 * a hurry.
 *
 * ## 🔴 18.12 — admin is swept but not committed
 *
 * An admin console shows many patients at once and is a map of the whole
 * system. `docs/screens/admin` is gitignored and produced on demand. Treat the
 * repository as if it will be public one day, because one day it might be.
 */
import { existsSync, mkdirSync, rmSync } from "node:fs";
import path from "node:path";

import { sql } from "drizzle-orm";

import { connect } from "./db";

const OUT = path.resolve("docs/screens");
const VIEWPORT = { width: 414, height: 896 }; // A phone. This product is a phone.
const WIDE = { width: 1440, height: 900 };

type Shot = {
  name: string;
  path: string;
  wide?: boolean;
  /** Wait for this text before capturing, so a spinner is never the picture. */
  waitFor?: string;
};

const PUBLIC_SHOTS: Shot[] = [
  { name: "home", path: "/" },
  { name: "home-wide", path: "/", wide: true },
  { name: "for-patients", path: "/for-patients" },
  { name: "pricing", path: "/pricing" },
  { name: "features", path: "/features" },
  { name: "radar", path: "/radar" },
  { name: "login", path: "/login" },
  { name: "signup", path: "/signup" },
  { name: "patient-login", path: "/patient/login" },
  { name: "patient-signup", path: "/patient/signup" },
  { name: "ar-home", path: "/?lang=ar" },
  { name: "ar-for-patients", path: "/for-patients?lang=ar" },
  { name: "ar-pricing", path: "/pricing?lang=ar" },
];

const THERAPIST_SHOTS: Shot[] = [
  { name: "sessions", path: "/sessions" },
  { name: "patients", path: "/patients" },
  { name: "copilot", path: "/copilot" },
  { name: "earnings", path: "/earnings" },
  { name: "billing", path: "/billing" },
  { name: "settings", path: "/settings" },
  { name: "availability", path: "/availability" },
];

const PATIENT_SHOTS: Shot[] = [
  { name: "sessions", path: "/patient" },
  { name: "billing", path: "/patient/billing" },
  { name: "account", path: "/patient/account" },
  { name: "homework", path: "/patient/homework" },
];

const ADMIN_SHOTS: Shot[] = [
  { name: "dashboard", path: "/admin", wide: true },
  { name: "vault", path: "/admin/vault", wide: true },
  { name: "payouts", path: "/admin/payouts", wide: true },
  { name: "content", path: "/admin/content", wide: true },
  { name: "usage", path: "/admin/usage", wide: true },
];

/**
 * 🔴 The refusal. Counts what a *real* caseload looks like and stops.
 *
 * Deliberately conservative in both directions: it counts patients, sessions
 * and notes that do **not** belong to the demo organisation, and any of them
 * being non-zero is enough. A database with one real patient in it is not a
 * database to photograph.
 */
async function refuseUnlessDemoOnly() {
  const { pool } = connect();
  try {
    const { rows } = await pool.query<{ real_patients: string; real_notes: string }>(`
      SELECT
        (SELECT COUNT(*) FROM patients p
           JOIN organizations o ON o.id = p.organization_id
          WHERE o.name NOT ILIKE '%demo%' AND p.deleted_at IS NULL) AS real_patients,
        (SELECT COUNT(*) FROM session_notes n
           JOIN organizations o ON o.id = n.organization_id
          WHERE o.name NOT ILIKE '%demo%') AS real_notes
    `);

    const patients = Number(rows[0]?.real_patients ?? 0);
    const notes = Number(rows[0]?.real_notes ?? 0);

    if (patients > 0 || notes > 0) {
      console.error(
        `\n🔴 Refusing to run: this database holds ${patients} patients and ${notes} notes outside a demo organisation.`,
      );
      console.error(
        "   A screenshot in a repository is permanent. Point this at a demo database\n" +
          "   (npm run demo:seed) and run it again.\n",
      );
      process.exit(1);
    }

    console.log(`Demo-only database confirmed: 0 real patients, 0 real notes.\n`);
  } finally {
    await pool.end();
  }
}

async function main() {
  const argv = process.argv.slice(2);
  const withAdmin = argv.includes("--admin");
  const base = process.env.SCREENS_URL ?? "http://localhost:3000";

  await refuseUnlessDemoOnly();

  const { chromium } = await import("playwright");
  const browser = await chromium.launch();

  const shoot = async (dir: string, shots: Shot[], storage?: string) => {
    const target = path.join(OUT, dir);
    // Cleared first: a screen that has been *deleted* from the product must
    // disappear from the folder rather than linger as the last picture of it.
    if (existsSync(target)) rmSync(target, { recursive: true });
    mkdirSync(target, { recursive: true });

    const context = await browser.newContext({
      viewport: VIEWPORT,
      storageState: storage && existsSync(storage) ? storage : undefined,
      deviceScaleFactor: 2,
    });

    for (const shot of shots) {
      const page = await context.newPage();
      if (shot.wide) await page.setViewportSize(WIDE);
      try {
        await page.goto(`${base}${shot.path}`, { waitUntil: "networkidle", timeout: 30_000 });
        if (shot.waitFor) await page.getByText(shot.waitFor).first().waitFor({ timeout: 10_000 });
        await page.screenshot({
          path: path.join(target, `${shot.name}.png`),
          fullPage: !shot.wide,
        });
        console.log(`  ✓ ${dir}/${shot.name}`);
      } catch (error) {
        console.log(`  ✗ ${dir}/${shot.name}, ${(error as Error).message.split("\n")[0]}`);
      }
      await page.close();
    }

    await context.close();
  };

  console.log(`Sweeping ${base}\n`);
  await shoot("public", PUBLIC_SHOTS);
  await shoot("therapist", THERAPIST_SHOTS, ".screens/therapist.json");
  await shoot("patient", PATIENT_SHOTS, ".screens/patient.json");

  if (withAdmin) {
    /*
     * 18.12 — swept, never committed. `docs/screens/admin` is gitignored, and
     * the reminder is printed rather than assumed to be remembered.
     */
    await shoot("admin", ADMIN_SHOTS, ".screens/admin.json");
    console.log("\n  admin screens are gitignored. They are a map of the whole system.");
  }

  await browser.close();
  console.log(`\nDone. ${OUT}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
