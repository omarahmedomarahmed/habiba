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
    /*
     * 🔴 AMENDED AGAIN BY 57.1. The two credit thresholds this used to assert —
     * "$30 unlocks $2" and "$60 unlocks $1" — describe a rate ladder sprint 57
     * removed. H20: rewritten in the current vocabulary rather than deleted, so
     * the RULE survives the restatement. The rule was never "$30 buys a rate";
     * it was "the schedule in the database is the schedule we published".
     */
    /*
     * ⚠️ THIS ASSERTED `"9900,17900"` AND WAS RED FROM THE DAY OF THE REPRICE.
     *
     * It had been red for two sprints and nothing printed it, because
     * `verify:sprint1` is wired to npm and to nothing else: `npm run gates`
     * never called it. The same shape, on the same day, as the seats and safety
     * suites. That is now closed by the `verifiers` gate, and this check is
     * restated as the RULE rather than as two numbers.
     *
     * The rule was never "the tiers cost $99 and $179". It is that the paid
     * tiers are monthly and unlimited, that a clinic seat is ten per cent under
     * solo, and that the clinic tier IS the two-seat minimum rather than a
     * third price somebody chose. State it that way and the next reprice has to
     * survive the argument instead of editing the literal.
     */
    check(
      "🔴 57.1 the two paid tiers are monthly and unlimited, not credit ladders",
      (() => {
        const paid = pricing.tiers.filter((t) => t.monthlyCents > 0);
        if (paid.length !== 2) return false;
        if (!paid.every((t) => t.unlockCents === 0 && t.aiRateCents === 0)) return false;

        const solo = pricing.tiers.find((t) => t.key === "practice")?.monthlyCents ?? 0;
        const clinic = pricing.tiers.find((t) => t.key === "clinic")?.monthlyCents ?? 0;
        const seat = pricing.seatBands[1]?.perSeatCents ?? 0;

        return (
          solo > 0 &&
          seat === Math.round(solo * 0.9) &&
          clinic === 2 * seat
        );
      })(),
      pricing.tiers.map((t) => `${t.key}=$${t.monthlyCents / 100}/mo`).join(" "),
    );

    /*
     * 🔴 AND THE METERED DOOR IS WHAT MAKES THE SOLO PRICE DEFENSIBLE.
     *
     * $1 for the room plus $3 for the note is $4, so $80 is exactly twenty
     * sessions: a number a therapist can divide themselves, and the reason a
     * therapist doing fewer than twenty a month is right to stay metered.
     */
    check(
      "🔴 57.1 …and the solo plan is exactly twenty metered sessions",
      (() => {
        const solo = pricing.tiers.find((t) => t.key === "practice")?.monthlyCents ?? 0;
        const payg = pricing.tiers.find((t) => t.key === "payg")?.aiRateCents ?? 0;
        return payg > 0 && solo / (session.platformFeeCents + payg) === 20;
      })(),
      "below twenty a month metered is cheaper, and the product must not push them off it",
    );

    /*
     * 🔴 57.1 / C289 — exactly one tier is free to BE on, and it is the first.
     *
     * Every threshold is zero after this sprint, so "a tier with a zero
     * threshold exists" — the rail that guarded this for a year — is now true of
     * all three and guards nothing. The free door is the tier with no threshold
     * AND no monthly price, and it has to sort first or the public page takes
     * the wrong one as its headline rate.
     */
    check(
      "🔴 57.1 / C289 exactly one tier is free to be on, and it sorts first",
      (() => {
        const free = pricing.tiers.filter((t) => t.unlockCents === 0 && t.monthlyCents === 0);
        return free.length === 1 && pricing.tiers[0]?.key === free[0]?.key;
      })(),
      pricing.tiers.map((t) => t.key).join(" → "),
    );

    /*
     * 🔴 The all-in cost of a PAY-AS-YOU-GO AI session did not change.
     *
     * $1 platform + $3 of AI is the $4 that shipped. The paid tiers are not in
     * this sum because they do not have one: a subscribed session is zero on
     * both lines, which is asserted in `tests/safety.test.ts` where the pure
     * function lives. Asserted rather than assumed, because a drift here is a
     * price rise nobody decided, and those are discovered by a customer.
     */
    check(
      "🔴 46.1 / 57.1 the all-in price of a pay-as-you-go AI session is unchanged",
      (() => {
        const payg = pricing.tiers.find((t) => t.monthlyCents === 0);
        return session.platformFeeCents + (payg?.aiRateCents ?? 0) === 400;
      })(),
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

    /*
     * 🔴 AMENDED BY 57.1. This asserted that every subscription row said
     * `payg`, which was the right check while nothing could be subscribed to
     * and is now a check that would fail on our first paying customer.
     *
     * The rule underneath it survives: no row may sit on a plan that is not in
     * the live tier table. A row saying `growth` after sprint 57 renamed the
     * tiers is not an upgrade and not an error, it is a therapist whose old rate
     * lock no longer exists — `entitledTier` drops them to the free door rather
     * than honouring a key nothing prices. This counts them so the number is
     * known rather than discovered.
     */
    const plans = await db
      .select({ plan: subscriptions.plan, status: subscriptions.status })
      .from(subscriptions);
    const live = new Set(pricing.tiers.map((t) => t.key));
    const orphans = plans.filter((p) => !live.has(p.plan));
    check(
      "🔴 57.1 no subscription row sits on a plan the tier table no longer names",
      orphans.length === 0,
      `${plans.length} subscriptions, ${orphans.length} on a retired key (${[...new Set(orphans.map((o) => o.plan))].join(", ") || "none"})`,
    );

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
      /*
       * 🔴 57.1 the FREE tier, not merely a zero-threshold one.
       *
       * Every tier has a zero threshold now, so the old `find` could return the
       * $179 plan and read its AI rate of zero as the rate a bill would be
       * raised at: a check that passes by measuring the wrong tier.
       */
      spendableCents > 0
        ? 0
        : rereadPricing.tiers.find((t) => t.unlockCents === 0 && t.monthlyCents === 0)!
            .aiRateCents;
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
