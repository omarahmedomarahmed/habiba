/**
 * 🔴 Board 807: A RECEIPT IN THE MONEY THE PATIENT ACTUALLY SENT.
 *
 * The books are kept in dollars, so a receipt built from the payment row read
 * "Session $12 / Paid by your company benefit -$1.20 / You paid $10.80" to a
 * patient who sent EGP 540 by InstaPay and reads pounds on every other screen.
 * When what was taken is on record in another currency (a transfer, a gateway
 * charge, a presented price), that figure is the total, and every line is
 * restated at the one rate it implies, so the lines add up to exactly what
 * left their account. With nothing taken in another currency the figures are
 * returned as they are.
 *
 * Pure, so the arithmetic is a test (`tests/receipt-figures.test.ts`).
 */
export type ReceiptFigures = {
  currency: string;
  priceCents: number;
  coveredCents: number;
  vatCents: number;
  cardFeeCents: number;
  totalCents: number;
};

export function receiptInChargedCurrency(
  figures: ReceiptFigures,
  charged: { minor: number; currency: string } | null,
): ReceiptFigures {
  if (!charged || charged.minor <= 0 || figures.totalCents <= 0) return figures;
  if (charged.currency.toLowerCase() === figures.currency.toLowerCase()) return figures;

  const at = (cents: number) => Math.round((cents * charged.minor) / figures.totalCents);
  const vatCents = at(figures.vatCents);
  const cardFeeCents = at(figures.cardFeeCents);
  /* The total is what was taken; the price (or, when covered, the company's line) absorbs the rounding. */
  const ownShare = Math.max(0, charged.minor - vatCents - cardFeeCents);
  const covered = figures.coveredCents > 0;
  const priceCents = covered ? Math.max(ownShare, at(figures.priceCents)) : ownShare;
  return {
    currency: charged.currency.toUpperCase(),
    priceCents,
    coveredCents: covered ? priceCents - ownShare : 0,
    vatCents,
    cardFeeCents,
    totalCents: charged.minor,
  };
}
