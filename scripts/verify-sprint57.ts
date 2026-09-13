/**
 * Sprint 57 acceptance: the price, the plan, and the claims.
 *
 *   npm run verify:sprint57
 *
 * ## What this sprint is for
 *
 * An outside reader went through the repository and the live site and found
 * four things. Every one of them was real, and not one of them was caught by
 * the forty-two verifiers and five hundred tests already in this repository.
 * That is the finding underneath the findings, and it is what this file is for.
 *
 * The four:
 *
 *   1. **Published claims nobody could keep.** "Risk language is never missed"
 *      over a probabilistic classifier whose own evaluation names cases it
 *      misses on purpose. "Talk to a real therapist in the next sixty seconds"
 *      against a standing rule, written by us, forbidding response-time
 *      promises in a crisis product. Both survived every gate here, because
 *      marketing copy is a string and every string gate we own counts whether a
 *      string is TRANSLATED, never whether it is TRUE.
 *   2. **Five writing scripts with no production guard**, including the one
 *      that seeds publicly bookable clinicians with fabricated `DEMO-` licence
 *      numbers.
 *   3. **A price nobody could compare.** "$1 plus $2 a session" against a
 *      category that quotes a month, at roughly a third of what the
 *      best-funded competitor charges.
 *   4. **A rail that passed by measuring the wrong thing** — and then, while
 *      fixing (3), two more of exactly that shape, one of which would have
 *      given every therapist who had ever topped up a dollar the $179 plan for
 *      nothing.
 *
 * ## 🔴 Why this verifier reads the DATABASE and not `defaults.ts`
 *
 * C148, for the sixth time. Fixing a sentence in `lib/content/defaults.ts`
 * changes nothing a visitor sees: the CMS is authored-content-wins, so a slug
 * with a row is served from that row for ever. The dangerous claims are fixed
 * in the file AND have to be gone from `content_pages`, and only the second of
 * those is what the public reads. So the checks below query the rows.
 */
import { sql } from "drizzle-orm";

import { readSource, reporter } from "./_verify";
import { withPublishedContent } from "./_content-ready";

const { check, skipUnless, finish } = reporter();

async function main() {
  /*
   * 🔴 No `writesTo()`. This verifier only reads, and it is MEANT to be pointed
   * at production: half of what it checks is whether the fixes actually reached
   * the database the public is served from.
   */
  const { controlDb: db } = await import("../lib/db");
  const { subscriptions } = await import("../lib/db/schema");
  const { PLANS } = await import("../lib/db/schema");
  const { getSettings } = await import("../lib/settings");
  const { entitledTier, sessionLines, tierForSpend } = await import("../lib/billing/plans");

  const host = (process.env.DATABASE_URL ?? "").match(/@([^/:?]+)/)?.[1] ?? "(none)";
  console.log(`\nreading ${host}\n`);

  const settings = await getSettings();
  const tiers = settings.pricing.tiers;

  /* ------------------------------------- 57.1 · the schedule in the database -- */

  const free = tiers.filter((t) => t.monthlyCents === 0 && t.unlockCents === 0);
  const plans = tiers.filter((t) => t.monthlyCents > 0);

  check(
    "🔴 57.1 the LIVE tier table has exactly one free door, and it sorts first",
    free.length === 1 && tiers[0]?.key === free[0]?.key,
    tiers.map((t) => `${t.key}($${t.monthlyCents / 100}/mo, $${t.aiRateCents / 100}/ai)`).join(" → "),
  );

  check(
    "🔴 57.1 …and two monthly plans, priced from the database rather than from a file",
    plans.length === 2 && plans.every((t) => t.aiRateCents === 0 && t.unlockCents === 0),
    plans.map((t) => `${t.name} $${t.monthlyCents / 100}/mo`).join(", ") || "none configured",
  );

  /*
   * 🔴 The margin, asserted rather than believed.
   *
   * From our own recorded rate table a therapist at 25 sessions a week costs
   * about $36 a month to serve. $49 unlimited is a 26% margin against that and
   * is the number that stopped us; the cheapest plan has to clear twice the
   * cost or the plan is a way of losing money at scale.
   */
  const cheapest = plans[0];
  check(
    "🔴 57.1 the cheapest plan is at least twice the measured cost to serve a busy therapist",
    cheapest !== undefined && cheapest.monthlyCents >= 7_200,
    `$${(cheapest?.monthlyCents ?? 0) / 100}/mo against ~$36 of measured cost`,
  );

  /* ------------------------------------------ 57.1 · the two §6 rails fixed -- */

  /*
   * 🔴 THE bug this sprint nearly shipped, asserted against the live table.
   *
   * `tierForSpend` kept the last tier whose threshold the spend had passed. On
   * the old ladder that is correct. On this one every threshold is zero, so it
   * walked to the end and handed the most expensive plan to anybody who had
   * spent a penny. The unit test pins the pure function; this pins the ANSWER
   * against the schedule actually in the database, which is the pair that
   * matters — the function was never wrong on its own.
   */
  const bySpend = [1, 3_000, 6_000, 50_000, 10_000_000].map((c) => tierForSpend(tiers, c));
  check(
    "🔴 57.1 no amount of spending reaches a subscription against the LIVE schedule",
    bySpend.every((t) => t.monthlyCents === 0),
    bySpend.map((t) => t.key).join(", "),
  );

  /*
   * 🔴 C289 — the rail that guarded the free door stopped guarding anything.
   *
   * It asked whether any tier had a zero threshold. Every tier does now. This
   * asserts the replacement by constructing the table it must refuse, which is
   * the only way to prove a rail rather than assume it.
   */
  const { settingsProblem } = await import("../lib/settings/defs");
  const noFreeDoor = settingsProblem({
    ...settings,
    pricing: { ...settings.pricing, tiers: plans },
  });
  check(
    "🔴 57.1 / C289 a tier table with no free door is REFUSED",
    noFreeDoor !== null && /free to be on/i.test(noFreeDoor),
    noFreeDoor ?? "accepted, which is the defect",
  );
  check(
    "🔴 CONTROL …and the live table is accepted",
    settingsProblem(settings) === null,
    settingsProblem(settings) ?? "clean",
  );

  /* ---------------------------------------- 57.1 · a subscribed session bills -- */

  /*
   * 🔴 Both lines at zero, never no lines, and this is the whole design.
   *
   * Skipping the invoice for a subscriber is the cheap version and would make a
   * subscribed session invisible to 46.14's per-line-kind reconciler, to Total
   * View's consent rate and to cost-per-session — C221's disappearance arriving
   * through billing instead of through a null. A zero is a fact; a missing row
   * is a gap.
   */
  if (cheapest) {
    const subscribed = sessionLines({ settings, tierKey: cheapest.key, aiConsented: true });
    check(
      "🔴 57.1 a subscribed session raises BOTH invoice lines, at zero",
      subscribed.lines.length === 2 &&
        subscribed.lines.every((l) => l.amountCents === 0) &&
        subscribed.lines.map((l) => l.kind).join(",") === "platform,ai",
      subscribed.lines.map((l) => `${l.kind}=${l.amountCents}`).join(", "),
    );
  }

  const paygKey = free[0]?.key ?? tiers[0]!.key;
  const declined = sessionLines({ settings, tierKey: paygKey, aiConsented: false });
  check(
    "🔴 46.1 / C209 …and a refusal on pay as you go still costs the platform fee",
    declined.lines.length === 1 &&
      declined.lines[0]?.kind === "platform" &&
      declined.totalCents === settings.session.platformFeeCents &&
      declined.totalCents > 0,
    `${declined.totalCents}c on a refusal`,
  );

  /* ------------------------------------------------- 57.2 · the entitlement -- */

  const sourceCredits = readSource("lib/billing/credits.ts");
  check(
    "🔴 57.2 the current tier consults the subscription, not spend alone",
    /entitledTier\(/.test(sourceCredits) && /subscriptions\.currentPeriodEnd/.test(sourceCredits),
    "a plan outranks the ladder; an expired period falls back to it",
  );

  const future = new Date(Date.now() + 86_400_000);
  const past = new Date(Date.now() - 86_400_000);
  check(
    "🔴 57.2 a failed renewal keeps the month already paid for, and only that month",
    cheapest !== undefined &&
      entitledTier({
        tiers,
        subscription: { plan: cheapest.key, status: "past_due", currentPeriodEnd: future },
        lifetimeSpentCents: 0,
        now: new Date(),
      }).key === cheapest.key &&
      entitledTier({
        tiers,
        subscription: { plan: cheapest.key, status: "past_due", currentPeriodEnd: past },
        lifetimeSpentCents: 0,
        now: new Date(),
      }).key === paygKey,
    "past_due inside the period keeps the plan; past the period it does not",
  );

  /*
   * 🔴 A retired plan key grants nothing, and there is no migration behind this.
   *
   * `starter` and `growth` rows are real and will be for as long as those
   * accounts exist. A rewrite would have had to decide what a $60 rate lock is
   * worth under a subscription model, and that is a refund question rather than
   * a data question.
   */
  check(
    "🔴 57.2 a subscription row on a retired plan key grants nothing",
    entitledTier({
      tiers,
      subscription: { plan: "growth", status: "active", currentPeriodEnd: future },
      lifetimeSpentCents: 0,
      now: new Date(),
    }).key === paygKey,
  );

  /* ----------------------------------------------- 57.2 · Stripe, both ways -- */

  const sourceStripe = readSource("lib/billing/stripe.ts");
  check(
    "🔴 57.2 subscription checkout prices from platform_settings, not a Stripe product id",
    /createSubscriptionCheckout/.test(sourceStripe) &&
      /recurring:\s*\{\s*interval:\s*"month"\s*\}/.test(sourceStripe) &&
      /unit_amount:\s*tier\.monthlyCents/.test(sourceStripe),
    "an admin changing $99 to $89 changes the next charge, with no deploy",
  );

  check(
    "🔴 57.2 …and it refuses a tier key that is not a live monthly tier",
    /tier\.monthlyCents <= 0/.test(sourceStripe),
    "money and entitlement are decided by the same lookup, or they will disagree",
  );

  /*
   * 🔴 The renewal branches. Without these the local row says `active` for ever
   * and a therapist who stopped paying keeps unlimited AI indefinitely.
   */
  for (const event of [
    "customer.subscription.updated",
    "customer.subscription.deleted",
    "invoice.paid",
    "invoice.payment_failed",
  ]) {
    check(
      `🔴 57.2 the webhook handles ${event}`,
      new RegExp(`case "${event.replace(/\./g, "\\.")}"`).test(sourceStripe),
    );
  }

  check(
    "🔴 57.2 the subscription row is UPSERTED, so a plan change does not violate the unique index",
    /onConflictDoUpdate\(\{\s*target: subscriptions\.organizationId/.test(sourceStripe),
    "an organisation has at most one subscription; switching plans completes a second checkout",
  );

  /* ------------------------------------------------- 57.3 · the plan keys -- */

  check(
    "🔴 57.3 the PLANS list and the live tier table name the same tiers",
    PLANS.every((p) => tiers.some((t) => t.key === p)),
    `PLANS: ${PLANS.join(", ")} · settings: ${tiers.map((t) => t.key).join(", ")}`,
  );

  /*
   * 🔴 And nothing in the database is on a plan the tier table cannot price.
   *
   * Counted rather than assumed: `entitledTier` drops such a row to the free
   * door, which is the right behaviour and also the silent one. A number here
   * means somebody knows how many accounts are affected before a customer does.
   */
  const orphans = await db
    .select({ plan: subscriptions.plan, n: sql<number>`count(*)::int` })
    .from(subscriptions)
    .groupBy(subscriptions.plan);
  const retired = orphans.filter((row) => !tiers.some((t) => t.key === row.plan));
  check(
    "57.3 how many subscription rows sit on a retired plan key",
    true,
    retired.length === 0
      ? "none"
      : retired.map((r) => `${r.plan}=${r.n}`).join(", ") + " (each falls back to the free door)",
  );

  /* ----------------------------------- 57.6 · the claims, in the DATABASE -- */

  /*
   * 🔴 C148, sixth costume. Fixing `defaults.ts` changes nothing a visitor
   * sees: the CMS is authored-content-wins, so a slug with a row is served from
   * that row for ever. These are the rows.
   *
   * 🔴 And they are read through `withPublishedContent`, never by hand. C93:
   * the first version of this file queried `content_pages` directly, which
   * `verify:sprint21r` caught by scanning every verifier for exactly that. A
   * content check written outside the deferral goes red against a purged
   * database and stays red, and a gate that is red for a known reason is a gate
   * everybody skims.
   */
  await withPublishedContent(
    skipUnless,
    { for: "57.6", what: "the public pages", slug: "home" },
    (content) => {
      const published = JSON.stringify(content.published.map((page) => page.blocks));

      check(
        "🔴 57.6 the pages a visitor is SERVED are being read at all",
        content.published.length > 0 && published.length > 5_000,
        `${content.published.length} published rows, ${published.length} bytes of blocks`,
      );

      const BANNED: [string, RegExp][] = [
        ["a response-time promise", /in the next sixty seconds|خلال دقيقة/i],
        ["`risk language is never missed`", /never missed|لا تفوتنا أبدًا/i],
        [
          "the meta-claim that compounded the rest",
          /every claim on this page|كل ما نقوله هنا شاشة/i,
        ],
        ["`minutes rather than weeks`", /minutes rather than weeks|دقائق بدل أسابيع/i],
      ];

      for (const [what, pattern] of BANNED) {
        check(
          `🔴 57.6 ${what} is gone from the PUBLISHED rows, not only from defaults.ts`,
          !pattern.test(published),
          pattern.test(published) ? "still live" : "",
        );
      }

      /*
       * 🔴 CONTROL. Four absences in a row pass just as happily against a query
       * that returned nothing, a `blocks` column that serialised to `{}`, or a
       * regex with a typo in it. So one sentence that IS there is looked for
       * with the same machinery.
       */
      check(
        "🔴 CONTROL the same search finds a sentence that IS published",
        /Crisis Radar|رادار الأزمات/i.test(published),
        "the absence checks above are searching real content",
      );

      /*
       * 🔴 And the honest replacement is present, not merely the false claim
       * absent. Deleting the sentence would have passed every check above while
       * leaving the page silent about a detector that can miss.
       */
      check(
        "🔴 57.6 …and where the published page describes risk scanning, it says the scan can miss",
        !/risk language|لغة الخطر/i.test(published) ||
          /misses things|false alarm|judgement|تفوتها|إنذارات كاذبة|حكمك/i.test(published),
      );

      /* ------------------------------- 57.6 · the pricing page is current -- */

      check(
        "🔴 57.6 the published pricing page describes the monthly plan",
        plans.length === 0 || /a month|شهريًا/i.test(published),
        "a plan the page does not mention is a price nobody can find",
      );

      check(
        "🔴 57.6 …and no published page still denies that a subscription exists",
        plans.length === 0 || !/no subscription|بلا اشتراك/i.test(published),
        "true for a year, false the hour the plan shipped, and nothing failed",
      );
    },
  );

  /* ------------------------------------------- 57.7 · every writer is guarded -- */

  /*
   * 🔴 The gap an outside reader found, closed and then PROVED, with the two
   * exceptions named out loud rather than left as silence.
   */
  const WRITERS = [
    "scripts/demo.ts",
    "scripts/seed.ts",
    "scripts/republish.ts",
    "scripts/settings.ts",
    "scripts/shoot-room.ts",
  ];
  for (const file of WRITERS) {
    check(
      `🔴 57.7 ${file} refuses the production endpoint`,
      /writesTo\(\)/.test(readSource(file)),
    );
  }

  /*
   * 🔴 The two exceptions, and why a blanket guard was the wrong fix.
   *
   * `seed --refresh-content` is the only sanctioned way to publish content to
   * production (C148), and `republish --staging` writes the rows `render:check`
   * reads against production (C89). Guarding both would have made two documented
   * failures permanent while looking like an improvement, and nothing would have
   * failed: the render check simply reported thirteen red checks that were
   * really one missing publish.
   */
  check(
    "🔴 57.7 the seed's content-only mode can still reach production, or C148 is unfixable",
    /REFRESH_CONTENT\)\s*\{[\s\S]{0,400}?\}\s*else\s*\{\s*writesTo\(\)/.test(
      readSource("scripts/seed.ts"),
    ),
    "content_pages only: no users, no settings, no clinical data, no demo clinicians",
  );
  check(
    "🔴 57.7 …and republish's staging mode can, or the production render check is dead",
    /if \(!argv\.includes\("--staging"\)\) writesTo\(\)/.test(readSource("scripts/republish.ts")),
    "a staging locale is reachable by a script and by nobody else",
  );

  /*
   * 🔴 CONTROL. Eight `writesTo()` assertions pass against a `readSource` that
   * returned the same string every time, or against a regex that matches
   * anything. One file that should NOT have the guard proves the search works.
   */
  check(
    "🔴 CONTROL a read-only script does not carry the guard",
    !/writesTo\(\)/.test(readSource("scripts/render-check.ts")),
    "so the eight assertions above are really reading each file",
  );

  finish("sprint 57");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
