/**
 * Sprint 74 acceptance: what somebody is entitled to, asserted by writing.
 *
 *   npm run verify:entitlement
 *
 * ## 🔴 WHY THIS ONE IS NOT A SOURCE SCAN
 *
 * `verify:rail` reads files. It is cheap, it runs everywhere, and it caught
 * real things. It could not have caught any of the three defects this file was
 * written after, because all three were true of the source and false of the
 * database:
 *
 *   1. `subscribeByTransfer` leaned on `renewal_obligations_period_unique` for
 *      idempotency. The period started at `now`, so two clicks a millisecond
 *      apart were two different periods and the therapist was billed twice.
 *      Every line of that reads correctly.
 *
 *   2. `obligationCovering` ordered by `period_end DESC` and took one row.
 *      `entitledTier` grants only on `paid`. So a DUE obligation overlapping a
 *      PAID one took the single slot and answered "nothing is entitled here" —
 *      a therapist losing the month they paid for the moment the next bill was
 *      raised. Invisible until the transfer rail put a live due row beside a
 *      paid one for the first time.
 *
 *   3. `raiseInvoice` had never once been called without a session id, and its
 *      `ON CONFLICT (session_id)` was about to meet two rows with null in it.
 *
 * So this walks the whole entitlement loop against a real database, on a
 * throwaway organisation it deletes afterwards, and asserts what comes back.
 *
 * ## 🔴 IT REFUSES PRODUCTION AND IT CLEANS UP AFTER ITSELF
 *
 * `writesTo()` refuses the production endpoint by name. The organisation it
 * makes is named Demo, lives for about a second, and is deleted in a `finally`
 * so a failing assertion does not leave rows behind.
 */
import { and, eq } from "drizzle-orm";

import { reporter, writesTo } from "./_verify";
import { controlDb as db } from "../lib/db";
import {
  invoices,
  organizations,
  renewalObligations,
  subscriptions,
} from "../lib/db/schema";

const { check, finish } = reporter();

/** The plan being subscribed to. Read from settings so a rename is caught. */
const TIER = "practice";

/**
 * 🔴 ITS PRICE IS READ, NEVER TYPED.
 *
 * ⚠️ These two assertions held `9900` as a literal and went red the moment
 * sprint 75 repriced the plan to $80. A gate that has to be edited every time a
 * price moves is a gate somebody edits without reading, and the property here
 * was never the number: it is that the bill raised equals the plan's price.
 */
async function tierPriceCents(): Promise<number> {
  const { getSettings } = await import("../lib/settings");
  const tier = (await getSettings()).pricing.tiers.find((t) => t.key === TIER);
  if (!tier) throw new Error(`No tier called ${TIER}`);
  return tier.monthlyCents;
}

async function main() {
  writesTo();

  const tag = `entitlement-demo-${Date.now()}`;
  const [created] = await db
    .insert(organizations)
    .values({
      /* 🔴 Unmistakably synthetic, like every other row any script here writes. */
      name: "Entitlement Demo Practice",
      slug: tag,
      kind: "solo",
      /* 🔴 `eg`, because the transfer rail is the thing under test. */
      region: "eg",
    })
    .returning({ id: organizations.id });

  const orgId = created!.id;

  try {
    const { organizationNeedsTransfer } = await import("../lib/billing/manual-entry");
    check(
      "🔴 an Egyptian practice is on the transfer rail, asked of its own region",
      await organizationNeedsTransfer(orgId),
      "the same column `topUpPot` refuses on, so one account is never on two rails",
    );

    const { currentTier } = await import("../lib/billing/credits");
    const { subscribeByTransfer, settleOldestObligationByTransfer } = await import(
      "../lib/billing/service"
    );

    /* ---------------------------------------------- subscribing raises a bill */

    const price = await tierPriceCents();

    const first = await subscribeByTransfer({ organizationId: orgId, tierKey: TIER });
    check(
      "🔴 subscribing by transfer raises a bill rather than a checkout, for the plan's own price",
      first.ok === true && first.amountCents === price,
      first.error ?? `${first.amountCents} cents against a listed ${price}`,
    );

    /*
     * 🔴 THE SECOND PRESS, WHICH IS THE ONE THAT WAS BROKEN.
     *
     * A therapist on a slow connection presses Subscribe twice. Before the fix
     * this raised a second obligation and a second $99 invoice.
     */
    const second = await subscribeByTransfer({ organizationId: orgId, tierKey: TIER });
    check(
      "🔴 …and pressing it again refuses rather than billing a second month",
      Boolean(second.error) && second.ok !== true,
      second.error ?? "it raised a second bill",
    );

    const billed = await db
      .select({ id: invoices.id, amountCents: invoices.amountCents, status: invoices.status })
      .from(invoices)
      .where(eq(invoices.organizationId, orgId));
    check(
      "🔴 …so there is exactly ONE due invoice, for the plan's monthly price",
      billed.length === 1 && billed[0]!.status === "due" && billed[0]!.amountCents === price,
      billed.map((b) => `${b.status} ${b.amountCents}`).join(", ") || "nothing was billed",
    );

    /* ------------------------------------- and it grants nothing until a person */

    check(
      "🔴 THE PLAN HAS NOT STARTED: a bill is not an entitlement",
      (await currentTier(orgId)).key === "payg",
      "no optimistic grant anywhere on this rail, because a claim about money is not money",
    );

    /* ------------------------------------------ an operator confirms the money */

    const settled = await settleOldestObligationByTransfer({ organizationId: orgId, ref: tag });
    check(
      "🔴 confirming the transfer settles the obligation, naming the rail that did it",
      settled.settled,
      "settling the invoice clears a debt; this is the row entitlement is read from",
    );

    check(
      "🔴 …and NOW they are on the plan they paid for",
      (await currentTier(orgId)).key === TIER,
      "before this existed a therapist could transfer $99 a month forever and stay on pay as you go",
    );

    /* ------------------- a second month raised while the first is paid and live */

    /*
     * 🔴 THE DEFECT THAT ONLY APPEARS WITH BOTH ROWS PRESENT.
     *
     * Next month's bill is raised. The paid month is still running. Ordering by
     * `period_end DESC` alone hands back the DUE row, which grants nothing.
     */
    const next = await subscribeByTransfer({ organizationId: orgId, tierKey: TIER });
    check(
      "🔴 next month can be billed while this month is still running",
      next.ok === true,
      next.error ?? "one paid month and one due month, both live",
    );

    check(
      "🔴 …and raising it does NOT take away the month they already paid for",
      (await currentTier(orgId)).key === TIER,
      "a due obligation must never mask a paid one: paid is asked before period_end",
    );

    /* --------------------------------------------- not paying drops them again */

    /*
     * 🔴 The paid month is voided and the due one lapses, which is what
     * `lapseOverdue` does on its own the day after the due date. Nothing
     * anywhere has to remember to demote anybody: the entitlement expires
     * because it was never paid.
     */
    await db
      .update(renewalObligations)
      .set({ state: "void", paidAt: null, settledVia: null, settledRef: null })
      .where(and(eq(renewalObligations.organizationId, orgId), eq(renewalObligations.state, "paid")));
    await db
      .update(renewalObligations)
      .set({ state: "lapsed" })
      .where(and(eq(renewalObligations.organizationId, orgId), eq(renewalObligations.state, "due")));

    check(
      "🔴 a month nobody paid for lapses, and the account is on pay as you go again",
      (await currentTier(orgId)).key === "payg",
      "the same landing a therapist leaving a clinic makes, by the same mechanism",
    );

    /* ------------------------------------------- 74.4 · the prorated seat bill */

    const { applySeatChange } = await import("../lib/billing/seats");
    await applySeatChange({ organizationId: orgId, fromSeats: 0, toSeats: 3 });

    const afterSeats = await db
      .select({ amountCents: invoices.amountCents, description: invoices.description })
      .from(invoices)
      .where(eq(invoices.organizationId, orgId));

    const proration = afterSeats.find((i) => i.description.includes("seats from"));
    check(
      "🔴 74.4 a mid-month seat change raises a bill for the days it bought",
      Boolean(proration) && proration!.amountCents > 0,
      proration ? `${proration.amountCents} · ${proration.description}` : "nothing was billed",
    );

    check(
      "🔴 …and the line carries the arithmetic, not just the amount",
      Boolean(proration?.description.match(/\d+ seats from \d+, for the \d+ days/)),
      proration?.description ?? "none",
    );

    /*
     * 🔴 CONTROL. Every assertion above is about a row appearing; this one
     * watches the same query find nothing, so a check that passes because it
     * looked at the wrong organisation cannot hide here.
     */
    const elsewhere = await db
      .select({ id: invoices.id })
      .from(invoices)
      .where(eq(invoices.organizationId, "00000000-0000-0000-0000-000000000000"));
    check(
      "🔴 CONTROL the same query finds nothing for an organisation that has no bills",
      elsewhere.length === 0,
      "otherwise every count above could be counting somebody else's rows",
    );
  } finally {
    /* In a `finally`, so a failed assertion still leaves the database clean. */
    await db.delete(invoices).where(eq(invoices.organizationId, orgId));
    await db.delete(renewalObligations).where(eq(renewalObligations.organizationId, orgId));
    await db.delete(subscriptions).where(eq(subscriptions.organizationId, orgId));
    await db.delete(organizations).where(eq(organizations.id, orgId));
  }

  finish("sprint 74 entitlement");
}

main();
