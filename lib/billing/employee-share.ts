import "server-only";

import { eq } from "drizzle-orm";

import { controlDb as db } from "@/lib/db";
import { sessionPayments } from "@/lib/db/schema";

import { bookedFor, journal, postSessionPayment } from "./ledger";
import { fundingLegs, sharesOf } from "./split-refund";

/**
 * 🔴 W2-M01: THE EMPLOYEE'S SHARE OF A PARTLY COVERED SESSION, BOOKED WHEN IT ARRIVES.
 *
 * `payFromPot` books the pot's leg at booking, because the pot's money is in
 * hand. The employee's leg is booked here, by whichever rail brought it:
 *
 *   card      from `settleSessionPayment`, as a destination charge (our fee
 *             on their share arrives as an application fee, the rest went to
 *             the clinician directly) or a held one (all of it arrives here)
 *   transfer  from `grantSession`, always held
 *
 * Their VAT rides on their leg: a pot spend carries none (C241).
 *
 * 🔴 A POT ROW BOOKED WHOLE, before W2-M01, already holds the employee's share
 * on the books: `payFromPot` used to post the full price. Its cash leg says so
 * (at least the price), and for that row only the VAT is new. Everything else
 * is booked exactly once, because each caller reaches here only through its
 * own guarded claim (`claimSessionPaid`, or the checkout's intent id).
 */
export async function bookEmployeeShare(input: {
  paymentId: string;
  capture: "destination" | "platform";
  vatCents: number;
}): Promise<{ booked: "share" | "vat_only" | "nothing" }> {
  const [row] = await db
    .select()
    .from(sessionPayments)
    .where(eq(sessionPayments.id, input.paymentId))
    .limit(1);
  if (!row) throw new Error("bookEmployeeShare: no such payment");

  const vat = Math.max(0, input.vatCents);
  const legs = fundingLegs({
    grossCents: row.grossCents,
    coverageBps: row.coverageBps ?? 0,
    sponsorShareCents: row.sponsorShareCents,
    patientShareCents: row.patientShareCents,
    platformFeeCents: row.platformFeeCents,
  });
  if (legs.employee.grossCents <= 0 && vat <= 0) return { booked: "nothing" };

  const booked = await bookedFor(row.id);
  const bookedWhole = (booked.cash ?? 0) >= row.grossCents && sharesOf({
    grossCents: row.grossCents,
    coverageBps: row.coverageBps ?? 0,
    sponsorShareCents: row.sponsorShareCents,
    patientShareCents: row.patientShareCents,
  }).employeeCents > 0;

  if (bookedWhole) {
    if (vat <= 0) return { booked: "nothing" };
    await journal({
      kind: "session_payment",
      refType: "session_payment",
      refId: row.id,
      legs: [
        { account: "cash", amountCents: vat, organizationId: row.organizationId, memo: "VAT on the patient's share of a sponsored session" },
        { account: "vat_payable", amountCents: -vat, organizationId: row.organizationId, memo: "VAT collected from the patient, owed to the tax authority" },
      ],
    });
    return { booked: "vat_only" };
  }

  await postSessionPayment({
    id: row.id,
    organizationId: row.organizationId,
    therapistId: row.therapistId,
    capture: input.capture,
    grossCents: legs.employee.grossCents,
    vatCents: vat,
    platformFeeCents: legs.employee.feeCents,
    settledInvoiceCents: 0,
    therapistNetCents: legs.employee.netCents,
  });
  return { booked: "share" };
}
