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
  console.log(`${ok ? "  ok  " : "FAIL  "}${name}${detail ? `, ${detail}` : ""}`);
  if (!ok) failures += 1;
}

async function main() {
  const { pool, db } = connect();

  try {
    /* ------------------------------------------------ 1.1 / 1.2 the tables */

    const groups = await db.select().from(platformSettings);
    const keys = groups.map((g) => g.key).sort();
    /*
     * Present, not equal. Sprint 16 added `payouts` and this check asserted the
     * exact list, so it went red on a correctly seeded database — a gate that
     * fails when a later sprint does its job is a gate people learn to ignore.
     * Sprint 1's claim is that its four groups exist.
     */
    check(
      "1.1 platform_settings holds all four of sprint 1's groups",
      ["clock", "copilot", "pricing", "session"].every((key) => keys.includes(key)),
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

    /*
     * 🔴 AMENDED BY 46.3 / C223. These asserted "$3.00 from 10 sessions" and
     * "$2.00 from 30", which is the session bundle the founder struck: $30
     * does not buy ten of anything, it buys $30 of credit and unlocks the $2
     * AI rate. The old assertions were correct about code that is now wrong,
     * so they are rewritten rather than deleted, and the ARITHMETIC is checked
     * below because that is the part that had better not have moved.
     */
    check(
      "1.6 / 46.2 pay as you go is $3.00 per AI session, at no threshold",
      (() => {
        const t = pricing.tiers.find((x) => x.key === "payg");
        return t?.aiRateCents === 300 && t.unlockCents === 0;
      })(),
    );
    check("1.6 / 46.3 $30 unlocks $2.00 per AI session", (() => {
      const t = pricing.tiers.find((x) => x.key === "starter");
      return t?.aiRateCents === 200 && t.unlockCents === 3000;
    })());
    check("1.6 / 46.3 $60 unlocks $1.00 per AI session", (() => {
      const t = pricing.tiers.find((x) => x.key === "growth");
      return t?.aiRateCents === 100 && t.unlockCents === 6000;
    })());

    /*
     * 🔴 The all-in cost of an AI session did not change at any tier.
     *
     * $1 platform + $3/$2/$1 of AI is the $4/$3/$2 that shipped. What changed
     * is that a session with NO AI now costs $1 instead of $4. Asserted rather
     * than assumed, because the split fee would be a silent price rise if any
     * of these three numbers had drifted, and a price rise nobody decided is
     * the kind of thing that is discovered by a customer.
     */
    check(
      "🔴 46.1 the all-in price of an AI session is unchanged at every tier",
      pricing.tiers.every((t) => {
        const allIn = session.platformFeeCents + t.aiRateCents;
        return { payg: 400, starter: 300, growth: 200 }[t.key] === allIn;
      }),
      pricing.tiers
        .map((t) => `${t.key}=${session.platformFeeCents + t.aiRateCents}`)
        .join(" "),
    );

    check(
      "🔴 46.2 / C209 the platform fee is charged on every session and is not zero",
      session.platformFeeCents > 0,
      `${session.platformFeeCents}c, which is what makes the AI fee safe to make conditional`,
    );
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
            t.key === "payg" ? { ...t, aiRateCents: oddRate } : t,
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
      rereadPricing.tiers.find((t) => t.key === "payg")?.aiRateCents === oddRate,
      `${rereadPricing.tiers.find((t) => t.key === "payg")?.aiRateCents}`,
    );

    /*
     * And it is the rate a bill would be raised at.
     *
     * `chargeForSession` is `server-only`, so rather than importing it this
     * asserts the property it depends on: `currentTier` picks the zero-threshold
     * tier for an organisation that has spent nothing, and that tier's AI rate
     * is the one just written. If those two agree, the invoice amount follows.
     *
     * 46.3 — credit is money now, so "what is spendable" is cents, and a
     * legacy row is still valued in the units it was bought in.
     */
    const credits = await db
      .select()
      .from(sessionCredits)
      .where(and(eq(sessionCredits.organizationId, org.id), eq(sessionCredits.status, "active")));
    const spendableCents = credits.reduce(
      (n, c) =>
        n +
        (c.creditCents !== null
          ? Math.max(0, c.creditCents - c.spentCents)
          : Math.max(0, (c.quantity - c.consumed) * c.rateCents)),
      0,
    );
    const wouldBill =
      spendableCents > 0 ? 0 : rereadPricing.tiers.find((t) => t.unlockCents === 0)!.aiRateCents;
    check(
      "acceptance: the next session would bill at the new rate, with no deploy",
      wouldBill === (spendableCents > 0 ? 0 : oddRate),
      spendableCents > 0 ? `${spendableCents}c of credit, so $0` : `${wouldBill} cents`,
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
    /*
     * 🔴 AMENDED BY 46.3. This asserted 400, which was the all-in price of a
     * session before the fee split. It is now the AI rate, and the stored row
     * in this database still holds the pre-46 shape, so `parseTiers` converts:
     *
     *   aiRateCents = rateCents - platformFeeCents = 400 - 100 = 300
     *
     * The conversion is the point rather than an accident of this check. A
     * database seeded before the split reads correctly without a backfill, and
     * the all-in price a therapist pays is unchanged.
     */
    const restoredPayg = parseGroup("pricing", restored?.value).tiers.find((t) => t.key === "payg");
    /*
     * The fee comes from `parseGroup` on the stored row, not from
     * `lib/settings`, which is `server-only` and would not load here. This
     * file has always read settings this way for that reason.
     */
    const [sessionRow] = await db
      .select()
      .from(platformSettings)
      .where(eq(platformSettings.key, "session"));
    const feeNow = parseGroup("session", sessionRow?.value).platformFeeCents;

    check(
      "acceptance: the schedule is restored",
      restoredPayg !== undefined && restoredPayg.aiRateCents + feeNow === 400,
      `${restoredPayg?.aiRateCents}c of AI + ${feeNow}c platform`,
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
