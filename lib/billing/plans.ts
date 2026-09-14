/**
 * What a therapist is billed per session, and how they buy it cheaper.
 *
 * ## What changed, and why the old shape is gone
 *
 * This used to be a `PLANS` record of subscription tiers with a monthly price
 * and a feature list. It is not that any more, and the change is a product one
 * rather than a renaming: a therapist no longer subscribes, they **buy sessions
 * at a rate, and the rate is set by how many they buy at once**. There is no
 * monthly fee, no "included" allowance to reconcile at the end of a period, and
 * no `unlimited` tier — which also removes a class of bug the old shape kept
 * producing, where `perSessionCents: null` meant "free" in one branch and
 * "unset" in another.
 *
 * ## Where the numbers live
 *
 * Not here. Every figure is a row in `platform_settings`, read through
 * `lib/settings`. This module holds the *logic* over those figures and nothing
 * else, so that changing a rate is an admin action and not a deploy. The
 * functions all take the settings they need as an argument rather than fetching
 * them, which keeps them pure, testable without a database, and safe to call
 * from a component that already has the snapshot.
 */
import type { PlatformSettings, PricingTier } from "@/lib/settings/defs";

export type { PricingTier };

/**
 * The rate a therapist gets for buying `quantity` sessions at once.
 *
 * 🔴 46.3 — the threshold is MONEY SPENT, not sessions bought.
 *
 * This walked a session count. It walks cents now, and the difference is the
 * whole of C223: $30 does not buy ten of anything, it buys $30 of credit and
 * unlocks the $2 AI rate. Tiers arrive sorted by threshold ascending
 * (`parseTiers` guarantees it), so the last one they have reached is the
 * cheapest they have earned.
 *
 * A spend below every threshold still returns a tier — the zero one — because
 * "bought nothing" is pay as you go, not "no rate". `settingsProblem` refuses
 * a configuration with no zero-threshold tier for exactly this reason.
 *
 * 🔴 Sprint 57 — **a subscription is never reached by spending.** Caught by the
 * rewritten test rather than by reading, which is the only reason it is not in
 * production: with the new schedule every `unlockCents` is zero, so the old loop
 * walked past PAYG, past Practice, and left every therapist who had ever topped
 * up a single dollar sitting on the $179 Clinic tier for free.
 *
 * A tier with a monthly price is BOUGHT, not EARNED, so credit cannot select it.
 * The filter is on `monthlyCents`, not on a hard-coded key list, because the
 * schedule is admin-editable: a tier invented tomorrow gets the rule for free.
 */
export function tierForSpend(tiers: PricingTier[], spentCents: number): PricingTier {
  const spent = Math.max(0, Math.floor(spentCents));
  // Only credit tiers are on this ladder. A subscription sits off it entirely.
  const earnable = tiers.filter((t) => t.monthlyCents === 0);
  let best = earnable[0] ?? tiers[0]!;
  for (const tier of earnable) {
    if (tier.unlockCents <= spent) best = tier;
  }
  return best;
}

export function tierByKey(tiers: PricingTier[], key: string | null | undefined): PricingTier {
  // Fail closed to the most expensive tier a therapist could be on rather than
  // the cheapest: an unrecognised key must never silently grant the best rate.
  return tiers.find((t) => t.key === key) ?? tierForSpend(tiers, 0);
}

/**
 * 🔴 Sprint 57 — the tier a therapist is actually ON, subscription included.
 *
 * ## Why this is a pure function and not a query
 *
 * The entitlement rule is the thing most likely to be got wrong and the thing
 * least likely to be tested if it only exists inside a database call. So it
 * takes the subscription row, the lifetime spend and the clock, and returns the
 * tier. `currentTier` in `credits.ts` fetches; this decides.
 *
 * ## The rule, and what it refuses to do
 *
 * A subscriber is entitled **to the period they have paid for**, and that is the
 * whole rule. Not "while Stripe says active", which drops a therapist the hour
 * their card expires — mid-session, on a plan they paid for three weeks ago.
 * Not "while a row exists", which gives away the product to anybody who ever
 * subscribed once.
 *
 * So a failed renewal leaves `status = 'past_due'` and the therapist keeps the
 * month they bought. When `currentPeriodEnd` passes without payment they fall
 * back to the free door and start paying per session again, which is a real
 * consequence arriving on a date they can see rather than a surprise.
 *
 * `cancelAtPeriodEnd` is not consulted here on purpose: cancelling is a
 * statement about the NEXT period, and this function only answers about now.
 *
 * 🔴 A plan key that the settings no longer name — `growth`, from before this
 * sprint — is not entitlement. `find` returns nothing and the spend ladder
 * answers instead. That is why the lookup is a `find` over the live tiers and
 * not `tierByKey`, whose fail-closed fallback would have quietly handed every
 * legacy row the free tier while *claiming* a subscription was in force.
 */
export type SubscriptionState = {
  plan: string | null;
  status: "active" | "past_due" | "cancelled" | null;
  currentPeriodEnd: Date | null;
} | null;

/**
 * 🔴 59.14 / C310 — THE OBLIGATION, WHICH IS THE THING WE OWN.
 *
 * One row from `renewal_obligations`: the plan it buys, the period it covers,
 * and whether it is paid. Not a status a gateway chose.
 */
export type ObligationState = {
  plan: string;
  state: "due" | "paid" | "lapsed" | "void";
  periodStart: Date;
  periodEnd: Date;
} | null;

export function entitledTier(input: {
  tiers: PricingTier[];
  /**
   * 🔴 59.14 — READ FIRST, AND THE SUBSCRIPTION IS THE FALLBACK.
   *
   * A paid obligation covering now IS the entitlement, whatever the gateway
   * mirror says. That is the whole fix: `mirrorSubscription` writes what a
   * webhook tells it, so a webhook that never arrived left a period end in the
   * past, and a clinician who had paid lost their plan because our endpoint was
   * down for an hour. Nothing on any screen would have said why.
   *
   * Null means no obligation row for this period, which is every organisation
   * that subscribed before 0089 and every one whose obligations we have not
   * written yet. Those fall through to the Stripe mirror exactly as before, so
   * this is additive rather than a migration everybody has to survive.
   */
  obligation?: ObligationState;
  subscription: SubscriptionState;
  lifetimeSpentCents: number;
  now: Date;
}): PricingTier {
  const earned = tierForSpend(input.tiers, input.lifetimeSpentCents);

  /*
   * 🔴 The obligation first, and only when it is PAID and covers now.
   *
   * A `due` obligation is one nobody has paid yet: it grants nothing, because
   * entitlement is the period paid for and not the period invoiced. A `lapsed`
   * one is the same sentence after the due date. `void` never grants.
   *
   * 🔴 And the plan key is looked up with `find` over the live tiers, the same
   * as below and for the same reason: a retired key is not entitlement, and
   * `tierByKey`'s fail-closed fallback would hand back the free tier while
   * claiming a plan was in force.
   */
  const ob = input.obligation;
  if (ob && ob.state === "paid") {
    const covers =
      ob.periodStart.getTime() <= input.now.getTime() &&
      ob.periodEnd.getTime() > input.now.getTime();
    if (covers) {
      const bought = input.tiers.find((t) => t.key === ob.plan && t.monthlyCents > 0);
      if (bought) return bought;
    }
  }

  const sub = input.subscription;
  if (!sub || sub.status === "cancelled") return earned;

  const paid = input.tiers.find((t) => t.key === sub.plan && t.monthlyCents > 0);
  if (!paid) return earned;

  /*
   * A null period end is a subscription Stripe has told us nothing about yet —
   * the row exists because checkout completed and the first `invoice.paid` has
   * not landed. Honour it: the money has changed hands. The next webhook fills
   * the date in and the rule above starts applying.
   */
  if (sub.currentPeriodEnd && sub.currentPeriodEnd.getTime() <= input.now.getTime()) {
    return earned;
  }
  return paid;
}

/**
 * 🔴 46.4 — what spending `amountCents` buys.
 *
 * Credit is money. Spending $30 buys $30 of credit, spendable against any
 * line, platform fee and AI fee alike, and unlocks whatever rate that
 * threshold reaches. `totalCents === creditCents` is not a placeholder for
 * arithmetic that is coming: the money bought is the money spent, and the
 * thing the threshold bought is the rate.
 */
export function quoteForSpend(
  tiers: PricingTier[],
  amountCents: number,
): { tier: PricingTier; creditCents: number; totalCents: number } {
  const spend = Math.max(0, Math.floor(amountCents));
  const tier = tierForSpend(tiers, spend);
  return { tier, creditCents: spend, totalCents: spend };
}

/**
 * 🔴 46.1 / C209 — what one session costs the therapist, as two lines.
 *
 * The platform fee is on **every** session. Free ones, in-person ones, and the
 * ones where the patient declined recording. It buys the record, the booking,
 * the reminders, the radar placement, the note storage and the free in-room
 * copilot, which is why it survives a session with no video in it at all.
 *
 * The AI fee exists only where the patient turned the AI on.
 *
 * 🔴 The protection against coercion is the FIRST of those, not the second. A
 * single fee that vanished on a refusal would give a therapist a reason to
 * lean on the most vulnerable person in the room; a fee of zero would give
 * away hosted HIPAA-grade video to anybody who never asks. Making the AI fee
 * conditional is only safe because the platform fee is unavoidable.
 *
 * Pure, and takes the consent state rather than reading it, so the rule can be
 * asserted without a database.
 */
export type SessionLine = { kind: "platform" | "ai"; amountCents: number };

export function sessionLines(input: {
  settings: PlatformSettings;
  tierKey: string | null;
  aiConsented: boolean;
}): { lines: SessionLine[]; totalCents: number; tier: PricingTier } {
  const tier = tierByKey(input.settings.pricing.tiers, input.tierKey);

  /*
   * 🔴 Sprint 57 — an unlimited tier raises BOTH LINES AT ZERO rather than no
   * lines at all, and that is the whole design of this change.
   *
   * The cheap version is to skip the invoice when somebody is subscribed. It
   * would also make a subscribed session invisible to the reconciler, to Total
   * View's consent rate, to cost-per-session and to every report keyed on line
   * kind — the same disappearance C221 documents, arriving through billing
   * instead of through a null.
   *
   * So the record is identical for every session this product has ever run. Only
   * the amount changes. `invoices_session_unique` and
   * `invoice_lines_invoice_kind_unique` keep their meaning, 46.14's per-line-kind
   * reconciler keeps working unchanged, and a zero is a fact rather than a gap.
   */
  const unlimited = tier.monthlyCents > 0;

  const lines: SessionLine[] = [
    {
      kind: "platform",
      amountCents: unlimited ? 0 : input.settings.session.platformFeeCents,
    },
  ];
  if (input.aiConsented) {
    lines.push({ kind: "ai", amountCents: unlimited ? 0 : tier.aiRateCents });
  }

  return { lines, totalCents: lines.reduce((sum, line) => sum + line.amountCents, 0), tier };
}

/**
 * Money on an **English** surface. 19.4.
 *
 * The clinician portal and the admin console are English-only today, and this
 * is the shorthand for them: it says `en-US` out loud rather than defaulting
 * to it silently, so a screen that ought to be bilingual cannot use it by
 * accident and look correct.
 *
 * 🔴 Anything a **patient or a visitor** reads takes the locale as a
 * parameter instead — `formatMoney(cents, currency, locale)` — fed from the
 * page's chosen language exactly as the zone is (C84). Translating the
 * clinician portal is a later job; using this there is a decision, not a gap
 * that nobody noticed.
 */
export function formatUsd(cents: number): string {
  return formatMoney(cents, "USD", "en-US");
}

/**
 * Money, in a **named** locale. 12.3 / C84, and now 19.4.
 *
 * `toLocaleString(undefined, …)` uses the runtime's locale, which is the same
 * server-vs-browser split as a time zone and produces the same hydration
 * mismatch — `$1,234.50` on the server pass and `1.234,50 $` in a German
 * browser.
 *
 * 🔴 **The locale is a required argument, exactly as the zone became one in
 * 12.3.** Not because a default would be wrong today, but because a default is
 * invisible: `formatMoney(cents, "USD")` on an Arabic page looks like working
 * code and renders English formatting for ever. Making the parameter required
 * turns every such site into a type error, which is how 12.3 found all 56
 * places that needed a zone.
 *
 * Pass a BCP 47 tag from `localeTag()`, which pins the numbering system —
 * Western digits in Arabic, deliberately (see `lib/i18n/config.ts`).
 */
export function formatMoney(cents: number, currency: string, locale: string): string {
  /*
   * 🔴 An absent locale is `en-US`, never the runtime's.
   *
   * The type makes the argument required, and TypeScript found all 26 call
   * sites — but a *type* is not present at runtime, and
   * `toLocaleString(undefined, …)` silently means "ask the machine". That is
   * the C84 bug wearing a different hat, and the hydration test caught it
   * here: with the parameter merely required, the test's own two-line call
   * rendered `$1,234.50` on one machine and `1.234,50 $` on another.
   *
   * So the fallback is pinned rather than absent. Wrong language, right bytes,
   * on both passes — and the type still says what to pass.
   */
  return (cents / 100).toLocaleString(locale || "en-US", {
    style: "currency",
    currency: currency.toUpperCase(),
    minimumFractionDigits: cents % 100 === 0 ? 0 : 2,
  });
}
