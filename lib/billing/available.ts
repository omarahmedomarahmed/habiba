/**
 * 🔴 16.10: "available" excludes money already on its way, and only once.
 *
 * `held` is the ledger's balance of what we owe the clinician. A requested or
 * approved payout is still inside it, so it is subtracted: showing it invites
 * a second request for money halfway out of the door. A SENT payout is not:
 * "Mark sent" posts it to the ledger (W1-04), so `held` has already gone down
 * by it, and subtracting it here as well showed less than the clinician has.
 */
export function availableToWithdraw(
  heldCents: number,
  requests: { status: string; amountCents: number }[],
): number {
  const onTheWay = requests
    .filter((r) => r.status === "requested" || r.status === "approved")
    .reduce((total, r) => total + r.amountCents, 0);
  return Math.max(0, heldCents - onTheWay);
}
