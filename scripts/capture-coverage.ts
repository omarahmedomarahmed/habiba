/**
 * 🔴 76.26 — THE REAL PRODUCT, SIGNED INTO, PHOTOGRAPHED.
 *
 *   npm run seed:coverage        (against a throwaway branch)
 *   npx next dev -p 3111         (against the same branch)
 *   CAPTURE_BASE=http://localhost:3111 npm run capture:coverage
 *
 * ## Why this one drives a browser and `capture:payments` does not
 *
 * They answer different questions. `capture:payments` renders components with
 * chosen props, which is the only way to photograph a rejected payment and a
 * confirmed one side by side. This signs in and walks the product, which is the
 * only way to photograph a SERVER page: the three admin profiles are queries,
 * not props, and a component render of one would prove nothing about what the
 * query returns.
 *
 * It is also the only way to find the defects that live in the wiring rather
 * than in a component: a page that throws for a real operator, a link that goes
 * nowhere, a figure that a query computes differently from the helper that was
 * supposed to own it.
 *
 * ## The scenario on screen
 *
 * A company covering 50%, an employee who booked a $20 session, the pot paying
 * $10 at booking and the employee owing $11.40 by transfer. Seeded by
 * `seed-coverage.ts` through the product's own functions.
 */
import { mkdirSync } from "node:fs";

const OUT = "captures/coverage";
const BASE = process.env.CAPTURE_BASE ?? "http://localhost:3111";
/*
 * 🔴 TWO PASSES, BECAUSE THE QUEUE AND THE SHEET ARE NEVER BOTH INTERESTING.
 *
 * Before the payer submits, the sheet shows the account number, the line items
 * and the red instruction, and the operator's queue is empty. After they
 * submit, the queue holds a claim and the sheet is a waiting card. One branch
 * cannot be in both states, so the seeder takes `SUBMIT_PROOF` and this takes a
 * suffix, and the run is done twice.
 */
const STAGE = process.env.CAPTURE_STAGE ? `-${process.env.CAPTURE_STAGE}` : "";

/** The operator's desk, and the patient's phone. */
const DESK = { width: 1440, height: 1200 };
const PHONE = { width: 390, height: 1500 };

async function main() {
  mkdirSync(OUT, { recursive: true });

  const { chromium } = await import("playwright");
  const browser = await chromium.launch(
    process.env.PLAYWRIGHT_CHROMIUM ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM } : {},
  );

  const shot = async (page: import("playwright").Page, name: string, note: string) => {
    await page.screenshot({ path: `${OUT}/${name}${STAGE}.png`, fullPage: true });
    console.log(`  ${name.padEnd(30)} ${note}`);
  };

  /* ================================================================== */
  /*  THE PATIENT, who owes half and has no account to sign into         */
  /* ================================================================== */

  const phone = await browser.newPage({ viewport: PHONE, deviceScaleFactor: 2 });
  await phone.goto(`${BASE}/pay/join-coverage-demo`, { waitUntil: "networkidle" });
  await shot(
    phone,
    "1-patient-partial-payment",
    "The employee's half. The sheet prints what they owe and what the employer already paid.",
  );
  await phone.close();

  /* ================================================================== */
  /*  THE OPERATOR                                                       */
  /* ================================================================== */

  const desk = await browser.newPage({ viewport: DESK, deviceScaleFactor: 2 });

  await desk.goto(`${BASE}/staff/sign-in`, { waitUntil: "networkidle" });
  await desk.fill('input[type="email"], input[name="email"]', "ops.demo@example.com");
  await desk.fill('input[type="password"], input[name="password"]', "copper-meadow-demo1");
  await desk.click('button[type="submit"]');
  await desk.waitForURL(/\/admin/, { timeout: 30_000 }).catch(() => undefined);
  await desk.waitForLoadState("networkidle");

  const visit = async (path: string, name: string, note: string) => {
    await desk.goto(`${BASE}${path}`, { waitUntil: "networkidle" });
    /* A page that redirected to a sign-in is a failed capture, not a frame. */
    if (/sign-in|login/.test(desk.url())) {
      console.log(`  ${name.padEnd(30)} 🔴 BOUNCED TO ${desk.url()}`);
      return;
    }
    await shot(desk, name, note);
  };

  await visit(
    "/admin/transfers",
    "2-admin-queue-partial",
    "The operator's queue: a claim for the employee's half, with what they said it covers.",
  );

  /*
   * 🔴 THE THREE PROFILES, which are the pages this capture exists for.
   * Their ids come from the seed, read back here rather than pasted.
   */
  const { connect } = await import("./db");
  const { sql } = await import("drizzle-orm");
  const { db, pool } = connect();
  const id = async (text: ReturnType<typeof sql>) => {
    const { rows } = await db.execute(text);
    return (rows[0] as { id: string } | undefined)?.id;
  };

  const sponsorId = await id(sql`SELECT id FROM sponsors WHERE name = 'Cairo Foundry' LIMIT 1`);
  /*
   * 🔴 THE ACCOUNT, NOT THE `patients` ROW, and the first draft used the wrong
   * one and 404'd. They are different ids for different things: a `patients`
   * row is one clinic's record of a person, and a `patient_accounts` row is the
   * person's own sign-in. The admin profile is keyed on the account because it
   * is a MONEY page and money belongs to the person rather than to a clinic's
   * copy of them, which is also what the transfer queue links with.
   *
   * The capture was wrong and the product was right, which is worth writing
   * down: a fixture that disagrees with the product looks exactly like a defect
   * until somebody reads both.
   */
  const patientId = await id(
    sql`SELECT id FROM patient_accounts WHERE email = 'nour.demo@example.com' LIMIT 1`,
  );
  const therapistId = await id(
    sql`SELECT id FROM users WHERE email = 'mona.demo@example.com' LIMIT 1`,
  );
  await pool.end();

  if (sponsorId) {
    await visit(
      `/admin/sponsors/${sponsorId}`,
      "3-admin-profile-company",
      "The company's admin profile: their pot, their ledger, and what they have spent.",
    );
  }
  if (therapistId) {
    await visit(
      `/admin/therapists/${therapistId}`,
      "4-admin-profile-therapist",
      "The clinician's admin profile.",
    );
  }
  if (patientId) {
    await visit(
      `/admin/patients/${patientId}`,
      "5-admin-profile-patient",
      "The patient's admin profile. Money only, by design: no notes, no diagnoses, no clinician.",
    );
  }

  await visit(
    "/admin/vault",
    "6-admin-vault",
    "Money in, money out, what is left, and what is somebody else's.",
  );

  await desk.close();
  await browser.close();
  console.log(`\nframes in ${OUT}`);
}

main().catch((error) => {
  console.error("capture failed:", error);
  process.exitCode = 1;
});
