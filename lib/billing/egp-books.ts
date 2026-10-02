/**
 * 0188: a clinician's pounds, kept beside their dollars. Pure, so the rules are
 * proved without a database (tests/money-guards.test.ts).
 *
 * The books are in USD cents. An Egyptian patient pays in pounds at the rate
 * charged that day, and a clinician used to be paid at the rate on the day they
 * asked. After a devaluation that paid out more pounds than came in. Now the
 * patient payment's legs carry the pounds actually collected, payouts carry the
 * pounds that left, and a payout is refused when it would send more pounds than
 * the clinician's sessions brought in.
 *
 * Legs with no pounds on them (posted before 0188, adjustments, fees netted from
 * earnings) still count at the request's own rate, which is how every payout was
 * priced before. Full EGP books are a proposed ruling in docs/DECISIONS.md.
 */

/**
 * The clinician's share of what the patient actually paid, in piastres. Rounded
 * down, so the share can never be more than what arrived.
 */
export function payableEgpFor(input: { netCents: number; paidCents: number; collectedEgpMinor: number }): number {
  if (input.netCents <= 0 || input.paidCents <= 0 || input.collectedEgpMinor <= 0) return 0;
  return Math.floor((Math.min(input.netCents, input.paidCents) * input.collectedEgpMinor) / input.paidCents);
}

/**
 * The pounds that go back when `refundCents` of a booked payable is reversed:
 * the same proportion of the pounds it booked. `bookedCents` and
 * `bookedEgpMinor` are the payable's signed sums (negative while owed), and the
 * result is signed for the reversing leg (positive).
 */
export function egpBackFor(input: { refundCents: number; bookedCents: number; bookedEgpMinor: number }): number {
  const owedCents = -input.bookedCents;
  const owedEgp = -input.bookedEgpMinor;
  if (owedCents <= 0 || owedEgp <= 0 || input.refundCents <= 0) return 0;
  if (input.refundCents >= owedCents) return owedEgp;
  return Math.round((input.refundCents * owedEgp) / owedCents);
}

/**
 * What a clinician can be paid in pounds: the pounds their payable legs carry,
 * plus the legs that carry none converted at `rateMicro`. Both sums are the
 * ledger's signed totals (a credit to them is negative).
 */
export function egpWithdrawable(input: {
  pricedEgpMinor: number;
  unpricedCents: number;
  rateMicro: number;
}): number {
  const priced = -input.pricedEgpMinor;
  const unpriced = -input.unpricedCents;
  const converted = Math.round((unpriced * input.rateMicro) / 1_000_000);
  return priced + converted;
}

/**
 * Whether this EGP payout, with the others already approved and not yet sent,
 * would send more pounds than came in for this clinician. Returns the shortfall
 * in piastres, or 0 when it fits.
 */
export function egpShortfall(input: {
  withdrawableEgpMinor: number;
  inFlightEgpMinor: number;
  requestEgpMinor: number;
}): number {
  const room = input.withdrawableEgpMinor - Math.max(0, input.inFlightEgpMinor);
  return input.requestEgpMinor > room ? input.requestEgpMinor - Math.max(0, room) : 0;
}

/**
 * 0188: earnings become withdrawable `holdDays` after the session ended, so a
 * refund or chargeback after the session has money to come back from.
 *
 * `credits` are the clinician's session-payment credits (positive cents owed)
 * with the moment the session ended (or was due to end). Returns the cents
 * still in their holding period at `now`.
 */
export function stillHeldCents(
  credits: { cents: number; endedAt: Date | null }[],
  holdDays: number,
  now: Date,
): number {
  if (holdDays <= 0) return 0;
  const cutoff = now.getTime() - holdDays * 24 * 60 * 60 * 1000;
  return credits
    .filter((c) => c.cents > 0 && (c.endedAt === null || c.endedAt.getTime() > cutoff))
    .reduce((total, c) => total + c.cents, 0);
}
