import type { PlatformSettings } from "./defs";

type Payouts = PlatformSettings["payouts"];

/**
 * 🔴 A14: THE FIELDS THE PAYOUTS FORM OWNS, which are the ones its audit row
 * describes.
 *
 * Listed rather than diffed over the whole group, because the group also holds
 * keys this form never touches (`transferFields`, see C366) and a line about
 * those would describe an edit nobody made on this form.
 */
export const PAYOUT_FORM_FIELDS = [
  "egyptCollectionProvider",
  "egyptPayoutMethods",
  "twoPersonThresholdCents",
  "alertAfterHours",
  "netFeeFromHeldEarnings",
  "egpSpreadBps",
  "egpRateMicro",
] as const satisfies readonly (keyof Payouts)[];

/**
 * 🔴 A14: EVERY FIELD THE FORM CHANGED, OLD VALUE AND NEW, for the audit row.
 *
 * The row used to say `netting=… spread=…` and nothing else, so the two
 * settings on that form that move money most directly left no trace: the
 * four-eyes threshold, below which one person approves a payout alone, and the
 * pound rate every Egyptian payer is quoted. Raising the threshold to approve
 * one's own large payout, or nudging the rate, was an edit whose audit row
 * could not say it had happened.
 *
 * Stored units, not display units, so the row reads the same as the column it
 * describes. A save that changed nothing says so, which is itself worth
 * knowing when somebody asks who touched the rate.
 */
export function payoutSettingsChanges(before: Payouts, after: Payouts): string {
  const shown = (v: unknown) => (Array.isArray(v) ? v.join(",") : String(v));
  const changed = PAYOUT_FORM_FIELDS.filter((field) => shown(before[field]) !== shown(after[field])).map(
    (field) => `${field} ${shown(before[field])} to ${shown(after[field])}`,
  );
  return changed.length > 0 ? changed.join("; ") : "no field changed";
}
