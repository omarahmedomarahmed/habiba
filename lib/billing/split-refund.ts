/**
 * 🔴 W2-S12: A REFUND OF A SPLIT SESSION, AS ARITHMETIC.
 *
 * A partly covered session has one `session_payments` row and two payers. The
 * pot paid `sponsorShareCents` at booking (`payFromPot`); the employee pays
 * `patientShareCents` later, plus VAT on it where there is VAT, by card or by
 * transfer on the manual rail. A refund gives each of them what they paid and
 * nothing else:
 *
 *   - the pot gets its share back, never the whole price (it used to be
 *     credited, and journalled, the gross)
 *   - the employee's paid share goes back through its own rail: a Stripe refund
 *     of their own charge, or the manual refund queue for a transfer (W1-12)
 *   - a share never paid is simply no longer owed
 *
 * Pure, so every rule here is a test (`tests/split-refund.test.ts`) rather than
 * a paragraph. The money moves in `refundSessionPayment` and `refundToPot`.
 */

export type FrozenSplit = {
  grossCents: number;
  coverageBps: number;
  sponsorShareCents: number;
  patientShareCents: number;
};

/**
 * The two shares as they were paid.
 *
 * 🔴 A pot row from before the split (0090) carries zero coverage and two zero
 * shares, and the pot paid the whole price: that was the only way a pot paid
 * then. Reading its shares as written would return nothing to the pot.
 */
export function sharesOf(split: FrozenSplit): { potCents: number; employeeCents: number } {
  if (split.coverageBps === 0 && split.sponsorShareCents === 0 && split.patientShareCents === 0) {
    return { potCents: Math.max(0, split.grossCents), employeeCents: 0 };
  }
  return {
    potCents: Math.max(0, split.sponsorShareCents),
    employeeCents: Math.max(0, split.patientShareCents),
  };
}

/** What happens to the employee's half. */
export type EmployeeHalf =
  /** The pot paid all of it. */
  | { rail: "none"; cents: 0 }
  /** Never paid, so no longer owed. Nothing goes back because nothing came in. */
  | { rail: "unpaid"; cents: 0 }
  /** Paid by card: a Stripe refund of their own charge. */
  | { rail: "card"; cents: number }
  /** Paid by transfer (or by a rail we hold no charge for): the manual refund queue. */
  | { rail: "queue"; cents: number };

export function splitRefundPlan(input: FrozenSplit & {
  /** The patient's own VAT. A pot spend carries none (C241), so this is theirs alone. */
  vatCents: number;
  /** Whether the employee's share arrived: the session is paid, or a transfer was confirmed. */
  employeePaid: boolean;
  /** Their own charge, when they paid it by card. */
  stripePaymentIntentId: string | null;
}): { potCents: number; employee: EmployeeHalf } {
  const { potCents, employeeCents } = sharesOf(input);
  const back = employeeCents + Math.max(0, input.vatCents);

  if (employeeCents === 0) return { potCents, employee: { rail: "none", cents: 0 } };
  if (!input.employeePaid) return { potCents, employee: { rail: "unpaid", cents: 0 } };
  /*
   * 🔴 No charge on the row means no charge we can reverse. The money came in
   * some other way (a transfer), and a person sends it back; saying "refunded"
   * here is the W1-12 defect.
   */
  if (input.stripePaymentIntentId) return { potCents, employee: { rail: "card", cents: back } };
  return { potCents, employee: { rail: "queue", cents: back } };
}

/**
 * What the manual refund queue owes the payer of this row: what THEY paid.
 *
 * On a pot row that is the employee's share and its VAT. The whole price plus
 * VAT, which the queue used to open for every row, would send an employee the
 * company's money as well as their own.
 */
export function refundOwedCents(payment: FrozenSplit & {
  fundingSource: "card" | "pot";
  vatCents: number;
}): number {
  const vat = Math.max(0, payment.vatCents);
  if (payment.fundingSource !== "pot") return Math.max(0, payment.grossCents) + vat;
  return sharesOf(payment).employeeCents + vat;
}

/**
 * 🔴 W2-S10: the company's money entry, for a session or for its refund.
 *
 * One function for both, so a refund is the session's entry with its sign
 * changed by `kind` and never a different set of figures: the company's share
 * and the employee's share exactly as frozen. It used to write the refund as
 * the whole price covered and nothing from the employee.
 */
export function moneyEntryFigures(split: FrozenSplit): {
  priceCents: number;
  coverageBps: number;
  coveredCents: number;
  employeeCents: number;
} {
  const { potCents, employeeCents } = sharesOf(split);
  return {
    priceCents: Math.max(0, split.grossCents),
    coverageBps: split.coverageBps,
    coveredCents: potCents,
    employeeCents,
  };
}
