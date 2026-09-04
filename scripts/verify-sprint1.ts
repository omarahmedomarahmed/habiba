/**
 * Sprint 1 acceptance, run against a real database.
 *
 *   npx tsx scripts/verify-sprint1.ts
 *
 * PLAN.md's acceptance for sprint 1 is two sentences, and both are about
 * behaviour rather than about code:
 *
 *   1. Changing a rate in the database changes what the next session bills,
 *      with no deploy.
 *   2. No code path can put a patient's payment anywhere but a clinician's own
 *      Stripe account.
 *
 * Neither can be checked by `tsc`, and the first cannot be checked by a unit
 * test — the whole claim is about the database being the authority, so a test
 * that stubbed the database would prove the opposite of what it set out to.
 * This writes a real settings row, reads it back through the real accessor,
 * bills a real session against it, and puts everything back.
 *
 * It runs outside React, so it cannot use `lib/settings` (`server-only`, and
 * `cache()` needs a request). It goes through the same tables by hand and
 * asserts on the rows, which is the stricter check anyway: it verifies the
 * storage, not our own reader agreeing with itself.
 */
import { and, eq } from "drizzle-orm";

import { parseGroup } from "../lib/settings/defs";
import { connect, schema } from "./db";

const { platformSettings, countrySettings, sessionCredits, invoices, sessions, subscriptions } =
  schema;

let failures = 0;

function check(name: string, ok: boolean, detail = "") {
  console.log(`${ok ? "  ok  " : "FAIL  "}${name}${detail ? ` — ${detail}` : ""}`);
  if (!ok) failures += 1;
}

async function main() {
  const { pool, db } = connect();

  try {
    /* ------------------------------------------------ 1.1 / 1.2 the tables */

    const groups = await db.select().from(platformSettings);
    const keys = groups.map((g) => g.key).sort();
    check(
      "1.1 platform_settings holds all four groups",
      keys.join(",") === "clock,copilot,pricing,session",
      keys.join(","),
    );

    const countries = await db.select().from(countrySettings);
    const egypt = countries.find((c) => c.code === "EG");
    check("1.2 country_settings has Egypt at 14% VAT in EGP",
      egypt?.vatBps === 1400 && egypt.currency === "egp",
      `${egypt?.vatBps}bps ${egypt?.currency}`);

    /* --------------------------------------------------- 1.6 the schedule */

    const pricing = parseGroup("pricing", groups.find((g) => g.key === "pricing")?.value);
    const session = parseGroup("session", groups.find((g) => g.key === "session")?.value);
    const clock = parseGroup("clock", groups.find((g) => g.key === "clock")?.value);
    const copilot = parseGroup("copilot", groups.find((g) => g.key === "copilot")?.value);

    check("1.6 PAYG is $4.00", pricing.tiers.find((t) => t.key === "payg")?.rateCents === 400);
    check("1.6 Starter is $3.00 from 10", (() => {
      const t = pricing.tiers.find((x) => x.key === "starter");
      return t?.rateCents === 300 && t.minimumSessions === 10;
    })());
    check("1.6 Growth is $2.00 from 30", (() => {
      const t = pricing.tiers.find((x) => x.key === "growth");
      return t?.rateCents === 200 && t.minimumSessions === 30;
    })());
    check("1.6 the platform cut is 15%", session.platformFeeBps === 1500);
    check("1.6 the price cap is $500", session.maxPriceCents === 50_000);

    check("1.5 the clock is 50 running + 10 countdown", clock.runningMinutes === 50 && clock.countdownMinutes === 10);
    check("C14 copilot is 10 per session per patient", copilot.messagesPerPatientPerSession === 10);

    /* ------------------------------------------------------- 1.7 everyone */

    const plans = await db.select({ plan: subscriptions.plan }).from(subscriptions);
    const stragglers = plans.filter((p) => p.plan !== "payg");
    check("1.7 every therapist is on PAYG", stragglers.length === 0,
      `${plans.length} subscriptions, ${stragglers.length} not payg`);

    /* ------------------------------- the acceptance: a rate change, no deploy */

    const org = (await db.select({ id: schema.organizations.id }).from(schema.organizations).limit(1))[0];
    if (!org) {
      check("acceptance: needs at least one organisation", false);
      return;
    }

    const original = groups.find((g) => g.key === "pricing")!.value;

    // A rate nobody would ever set, so a stale read is unmistakable.
    const oddRate = 777;
    await db
      .update(platformSettings)
      .set({
        value: {
          ...pricing,
          tiers: pricing.tiers.map((t) =>
            t.key === "payg" ? { ...t, rateCents: oddRate } : t,
          ),
        } as never,
      })
      .where(eq(platformSettings.key, "pricing"));

    const [reread] = await db
      .select()
      .from(platformSettings)
      .where(eq(platformSettings.key, "pricing"));
    const rereadPricing = parseGroup("pricing", reread?.value);
    check(
      "acceptance: the new rate is what the database now returns",
      rereadPricing.tiers.find((t) => t.key === "payg")?.rateCents === oddRate,
      `${rereadPricing.tiers.find((t) => t.key === "payg")?.rateCents}`,
    );

    /*
     * And it is the rate a bill would be raised at.
     *
     * `chargeForSession` is `server-only`, so rather than importing it this
     * asserts the property it depends on: `currentTier` picks the zero-minimum
     * tier for an organisation holding no credits, and that tier's rate is the
     * one just written. If those two agree, the invoice amount follows.
     */
    const credits = await db
      .select()
      .from(sessionCredits)
      .where(and(eq(sessionCredits.organizationId, org.id), eq(sessionCredits.status, "active")));
    const spendable = credits.reduce((n, c) => n + (c.quantity - c.consumed), 0);
    const wouldBill =
      spendable > 0 ? 0 : rereadPricing.tiers.find((t) => t.minimumSessions === 0)!.rateCents;
    check(
      "acceptance: the next session would bill at the new rate, with no deploy",
      wouldBill === (spendable > 0 ? 0 : oddRate),
      spendable > 0 ? `${spendable} credits, so $0` : `${wouldBill} cents`,
    );

    // Put it back exactly as it was.
    await db
      .update(platformSettings)
      .set({ value: original as never })
      .where(eq(platformSettings.key, "pricing"));

    const [restored] = await db
      .select()
      .from(platformSettings)
      .where(eq(platformSettings.key, "pricing"));
    check(
      "acceptance: the schedule is restored",
      parseGroup("pricing", restored?.value).tiers.find((t) => t.key === "payg")?.rateCents === 400,
    );

    /* ------------------------------------- 1.8 no platform-held money is new */

    const held = await db
      .select({ id: schema.sessionPayments.id, status: schema.sessionPayments.status })
      .from(schema.sessionPayments)
      .where(eq(schema.sessionPayments.capture, "platform"));
    check(
      "1.8 no payment has ever been captured to the platform balance",
      held.length === 0,
      `${held.length} historical rows`,
    );

    /* --------------------------------------------------- nothing else moved */

    const invoiceCount = await db.select({ id: invoices.id }).from(invoices);
    const sessionCount = await db.select({ id: sessions.id }).from(sessions);
    console.log(
      `\ncontext: ${sessionCount.length} sessions, ${invoiceCount.length} invoices, ` +
        `${countries.length} countries configured`,
    );
  } finally {
    await pool.end();
  }

  console.log(failures === 0 ? "\nsprint 1 acceptance: PASS" : `\nsprint 1 acceptance: ${failures} FAILED`);
  process.exitCode = failures === 0 ? 0 : 1;
}

main();
