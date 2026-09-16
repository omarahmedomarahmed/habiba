/**
 * 🔴 76.34 — THE THERAPIST'S MONEY SIDE, ON BOTH RAILS, PHOTOGRAPHED.
 *
 *   npx next dev -p 3177         (against the same branch as DATABASE_URL)
 *   CAPTURE_BASE=http://localhost:3177 npm run capture:therapist
 *
 * ## Why two clinicians and not one
 *
 * The whole point of this sprint's change is that the COUNTRY decides what the
 * therapist's money side looks like. A clinician in the United States is on
 * Stripe: three numbered steps, a connect button, a balance, a payout. A
 * clinician in Egypt is on a rail with no processor at all, and every one of
 * those controls is about something that does not exist for them. Before this
 * sprint they were shown all of it, with "payouts are not switched on" at the
 * top — which reads as something they have failed to do, about a thing they
 * cannot do.
 *
 * One screenshot proves nothing here. The claim is a DIFFERENCE, so the run
 * makes two clinicians, identical but for one column, and photographs both.
 *
 * ## 🔴 IT MAKES ITS OWN CAST AND DELETES IT
 *
 * Reusing a seeded therapist would mean knowing a seeded password, and a
 * capture that depends on one is a capture that breaks the next time somebody
 * reseeds. Two throwaway practices, synthetic names, deleted in a `finally`,
 * and `writesTo()` refuses production by name.
 */
import { mkdirSync } from "node:fs";
import { sql } from "drizzle-orm";

import { writesTo } from "./_verify";
import { connect } from "./db";

const OUT = "captures/therapist-money";
const BASE = process.env.CAPTURE_BASE ?? "http://localhost:3177";
const PHONE = { width: 430, height: 1700 };

const tag = `tmoney${Date.now().toString(36)}`;
/* Synthetic, and printed so the run can be repeated by hand. C225. */
const PASSWORD = "copper-meadow-demo1";

async function main() {
  writesTo();
  mkdirSync(OUT, { recursive: true });

  const { db, pool } = connect();

  const one = async <T>(text: ReturnType<typeof sql>): Promise<T> => {
    const { rows } = await db.execute(text);
    return rows[0] as T;
  };

  try {
    const { hashPassword } = await import("../lib/auth/password");
    const hash = await hashPassword(PASSWORD);

    /**
     * One solo practice and one clinician in it. The region is the only thing
     * that differs between the two, which is what makes the pair evidence.
     */
    const make = async (region: "us" | "eg", first: string) => {
      const org = await one<{ id: string }>(sql`
        INSERT INTO organizations (name, region, slug, kind)
        VALUES (${`${first} Demo`}, ${region}, ${`${tag}-${region}`}, 'solo') RETURNING id`);

      const user = await one<{ id: string }>(sql`
        INSERT INTO users (organization_id, email, first_name, last_name, role, password_hash, profile)
        VALUES (${org.id}, ${`${first.toLowerCase()}.${tag}@example.com`}, ${first}, 'Demo',
                'therapist', ${hash},
                ${JSON.stringify({ licenseType: "Psychologist", licenseNumber: "EG-44821" })}::jsonb)
        RETURNING id`);

      /*
       * 🔴 A BILL TO PAY, because the whole screen changes when there is one.
       * A clinician with nothing due sees no transfer sheet, no cart and no
       * warning bar, which is three of the five things this run is about.
       */
      await db.execute(sql`
        INSERT INTO invoices (organization_id, kind, description, amount_cents, status)
        VALUES (${org.id}, 'session', ${`Session fee, ${tag}`}, 400, 'due'),
               (${org.id}, 'session', ${`AI note, ${tag}`}, 300, 'due')`);

      return { orgId: org.id, userId: user.id, email: `${first.toLowerCase()}.${tag}@example.com` };
    };

    const eg = await make("eg", "Mona");
    const us = await make("us", "Robin");

    const { chromium } = await import("playwright");
    const browser = await chromium.launch(
      process.env.PLAYWRIGHT_CHROMIUM ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM } : {},
    );

    const walk = async (who: { email: string }, label: string) => {
      const context = await browser.newContext({ viewport: PHONE });
      const page = await context.newPage();

      await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
      await page.fill('input[type="email"], input[name="email"]', who.email);
      await page.fill('input[type="password"], input[name="password"]', PASSWORD);
      await page.click('button[type="submit"]');
      /*
       * 🔴 WAIT FOR THE SIGN-IN TO LAND, not for a number of seconds.
       *
       * A fixed pause captured one clinician and bounced the other on the same
       * run, because `next dev` compiles a route the first time it is asked for
       * and the second walk gets a warm one. A flaky capture is worse than a
       * missing one: the frame that does appear looks like proof.
       */
      await page
        .waitForURL((url) => !/\/login/.test(url.pathname), { timeout: 60_000 })
        .catch(() => undefined);
      await page.waitForTimeout(800);

      for (const [path, name] of [
        ["/billing", "billing"],
        ["/settings", "settings"],
      ] as const) {
        await page.goto(`${BASE}${path}`, { waitUntil: "networkidle" });
        /* A page that bounced to a sign-in is a failed capture, not a frame. */
        if (/login|sign-in/.test(page.url())) {
          console.log(`  MISSED ${label}-${name}: bounced to ${page.url()}`);
          continue;
        }
        await page.waitForTimeout(900);
        await page.screenshot({ path: `${OUT}/${label}-${name}.png`, fullPage: true });
        console.log(`  ${`${label}-${name}`.padEnd(24)} ${page.url()}`);

        /*
         * 🔴 AND THE TWO STATES THAT ONLY EXIST AFTER A TAP.
         *
         * The whole change is that choosing a plan now SELECTS rather than
         * buys, and that a payer has a way out of an open payment. Neither is
         * visible on a page load, so a capture that only loads pages would
         * photograph the old behaviour and the new one identically.
         */
        if (name === "billing") {
          const tier = page.getByRole("button", { name: /Practice/ }).first();
          if (await tier.count()) {
            await tier.click();
            await page.waitForTimeout(600);
            await page.screenshot({
              path: `${OUT}/${label}-upgrade-confirm.png`,
              fullPage: true,
            });
            console.log(`  ${`${label}-upgrade-confirm`.padEnd(24)} the details before the money`);
          }

          const pay = page.getByRole("button", { name: /Pay now|Open the payment/ }).first();
          if (await pay.count()) {
            await pay.click();
            await page.waitForTimeout(1500);
            await page.screenshot({ path: `${OUT}/${label}-popup.png`, fullPage: true });
            console.log(`  ${`${label}-popup`.padEnd(24)} the sheet, with the way out`);
          }
        }
      }

      await context.close();
    };

    await walk(eg, "egypt");
    await walk(us, "stripe");

    await browser.close();
  } finally {
    await db.execute(sql`DELETE FROM manual_payments WHERE organization_id IN
      (SELECT id FROM organizations WHERE slug LIKE ${`${tag}-%`})`);
    await db.execute(sql`DELETE FROM invoices WHERE organization_id IN
      (SELECT id FROM organizations WHERE slug LIKE ${`${tag}-%`})`);
    await db.execute(sql`DELETE FROM sessions WHERE organization_id IN
      (SELECT id FROM organizations WHERE slug LIKE ${`${tag}-%`})`);
    await db.execute(sql`DELETE FROM users WHERE email LIKE ${`%${tag}@example.com`}`);
    await db.execute(sql`DELETE FROM organizations WHERE slug LIKE ${`${tag}-%`}`);
    await pool.end();
  }

  console.log(`\nframes in ${OUT}/`);
}

main();
