import { Money } from "@/components/ui/money";

/**
 * 🔴 B10: a clinician's session price, in the currency they priced in.
 *
 * The public website leads with dollars, which is right for a figure the books
 * keep in dollars and wrong for a clinician in Cairo who typed 1,000 pounds: the
 * page headlined "$20" and a patient there read a price nobody set. A price
 * written in pounds leads with those pounds, exactly as typed, and reveals the
 * dollars on hover; a dollar price follows the page's display as before.
 */
export function SessionPrice({
  sessionRateCents,
  rateEgpMinor,
}: {
  sessionRateCents: number;
  rateEgpMinor: number | null;
}) {
  return rateEgpMinor !== null ? (
    <Money cents={rateEgpMinor} currency="EGP" asIs />
  ) : (
    <Money cents={sessionRateCents} />
  );
}
