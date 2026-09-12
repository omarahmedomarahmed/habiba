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
 */
export function tierForSpend(tiers: PricingTier[], spentCents: number): PricingTier {
  const spent = Math.max(0, Math.floor(spentCents));
  let best = tiers[0]!;
  for (const tier of tiers) {
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

  const lines: SessionLine[] = [
    { kind: "platform", amountCents: input.settings.session.platformFeeCents },
  ];
  if (input.aiConsented) lines.push({ kind: "ai", amountCents: tier.aiRateCents });

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
