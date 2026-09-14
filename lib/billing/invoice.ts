import "server-only";

import { and, asc, desc, eq, sql } from "drizzle-orm";

import { controlDb } from "@/lib/db";
import { ledgerEntries, sponsors } from "@/lib/db/schema";
import { getSettings } from "@/lib/settings";

/**
 * The corporate invoice. PLAN.md 53.15, C232, C241.
 *
 * ## 🔴 IT IS BUILT FROM THE LEDGER, NOT FROM A DOCUMENTS TABLE
 *
 * There is no `invoices` row for a pot top-up and there is not going to be one.
 * C226 says no parallel invoice path, and the reason bites here: a stored document
 * is a second record of an amount, and the first time it disagrees with the ledger
 * the customer is holding the wrong one. So the invoice is a RENDER of a ledger
 * transaction, regenerated on every view, and the number it shows is by
 * construction the number the books show.
 *
 * The invoice number is derived from the transaction's own position in this
 * sponsor's sequence of top-ups. It is stable because ledger rows are append-only
 * and nothing is ever deleted, which is the property that makes a derived number
 * safe.
 *
 * ## 🔴 VAT IS ON THE TOP-UP, WHICH IS WHY THIS DOCUMENT EXISTS AT ALL
 *
 * The taxable supply is the prepayment, in the jurisdiction of the entity holding
 * it. A session that later spends the pot carries no VAT and produces no invoice:
 * no money changes hands with anybody outside the company at that moment. One
 * supply, one document.
 *
 * ## 🔴 IT REFUSES TO RENDER WITHOUT THE LEGAL DETAILS (C241)
 *
 * *"Receipt, VAT invoice and proof of payment that LOOK LIKE THEY CAME FROM A
 * COMPANY."* A document without a legal name, an address and a tax registration
 * number is not an invoice a finance department accepts. The settings ship blank,
 * so this returns a `missing` list and the page says what an operator has to fill
 * in. A placeholder legal name would print on a document handed to a real
 * customer.
 */

export type Invoice = {
  number: string;
  issuedAt: Date;
  sponsorName: string;
  /** The amount that arrived, excluding tax, in cents. */
  netCents: number;
  vatCents: number;
  vatBps: number;
  totalCents: number;
  currency: string;
  from: { legalName: string; address: string; taxId: string };
};

/** What an operator still has to fill in before a document can be issued. */
export type InvoiceProblem = { missing: string[] };

export async function invoiceFor(
  sponsorId: string,
  txnId: string,
): Promise<Invoice | InvoiceProblem | null> {
  const [sponsor] = await controlDb
    .select({
      name: sponsors.name,
      entity: sponsors.entity,
      currency: sponsors.currency,
    })
    .from(sponsors)
    .where(eq(sponsors.id, sponsorId))
    .limit(1);

  if (!sponsor) return null;

  /*
   * 🔴 The sponsor is a CONDITION of the read, not a check after it.
   *
   * `ref_id` is matched alongside the transaction id, so a top-up belonging to
   * another organisation is not found rather than found and rejected. One
   * organisation reading another's invoice would be the worst leak in this sprint
   * and it would arrive through a URL somebody edited.
   */
  const [leg] = await controlDb
    .select({
      amountCents: ledgerEntries.amountCents,
      createdAt: ledgerEntries.createdAt,
      currency: ledgerEntries.currency,
    })
    .from(ledgerEntries)
    .where(
      and(
        eq(ledgerEntries.txnId, txnId),
        eq(ledgerEntries.txnKind, "pot_topup"),
        eq(ledgerEntries.account, "sponsor_pot"),
        eq(ledgerEntries.refType, "sponsor"),
        eq(ledgerEntries.refId, sponsorId),
      ),
    )
    .limit(1);

  if (!leg) return null;

  /*
   * The money that actually arrived for this same transaction. One extra read
   * rather than deriving it, because the pot leg no longer carries it.
   */
  const [cashLeg] = await controlDb
    .select({ amountCents: ledgerEntries.amountCents })
    .from(ledgerEntries)
    .where(
      and(
        eq(ledgerEntries.txnId, txnId),
        eq(ledgerEntries.account, "cash"),
      ),
    )
    .limit(1);

  const settings = await getSettings();
  const details = settings.invoice.entities.find((row) => row.entity === sponsor.entity);

  const missing: string[] = [];
  if (!details?.legalName) missing.push("legal name");
  if (!details?.address) missing.push("address");
  if (!details?.taxId) missing.push("tax registration number");
  if (missing.length > 0) return { missing };

  /*
   * The sequence number: how many top-ups this sponsor had made up to and
   * including this one. Ordered by time, then by id so two top-ups in the same
   * millisecond are still ordered the same way on every render.
   */
  const earlier = await controlDb
    .select({ txnId: ledgerEntries.txnId, createdAt: ledgerEntries.createdAt })
    .from(ledgerEntries)
    .where(
      and(
        eq(ledgerEntries.txnKind, "pot_topup"),
        eq(ledgerEntries.account, "sponsor_pot"),
        eq(ledgerEntries.refType, "sponsor"),
        eq(ledgerEntries.refId, sponsorId),
      ),
    )
    .orderBy(asc(ledgerEntries.createdAt), asc(ledgerEntries.id));

  const position = earlier.findIndex((row) => row.txnId === txnId) + 1;

  /*
   * 🔴 THE TOTAL IS THE CASH LEG, NOT THE POT LEG, since the VAT was split out.
   *
   * It used to be the pot leg's absolute value, which was the same number while
   * the whole top-up went into the pot. `topUpPot` now credits the pot the NET
   * and raises `vat_payable` for the tax, so the pot leg is what the sponsor may
   * spend and the cash leg is what they actually paid. An invoice states what
   * they paid, so it reads the cash.
   *
   * 🔴 Positive here, because cash is an asset and money arriving is a positive
   * leg. The pot leg is negative for the mirror reason, and printing either sign
   * wrongly would put a negative total on a customer's document.
   */
  const total = Math.abs(cashLeg?.amountCents ?? leg.amountCents);

  /*
   * 🔴 VAT is worked backwards out of the amount that actually arrived.
   *
   * The sponsor paid a number and that number is what cleared. Computing VAT
   * forwards from it would invoice for more than we were paid. So the total is the
   * total, and the net is what it was before tax.
   */
  const country = await countryVatBps(sponsor.entity);
  const net = country > 0 ? Math.round((total * 10_000) / (10_000 + country)) : total;
  const vat = total - net;

  return {
    number: `${details!.numberPrefix}-${String(position).padStart(5, "0")}`,
    issuedAt: leg.createdAt,
    sponsorName: sponsor.name,
    netCents: net,
    vatCents: vat,
    vatBps: country,
    totalCents: total,
    currency: leg.currency || sponsor.currency,
    from: {
      legalName: details!.legalName,
      address: details!.address,
      taxId: details!.taxId,
    },
  };
}

/**
 * The entity's own VAT rate, from `country_settings` rather than a constant.
 *
 * 🔴 Zero is a REAL ANSWER, not a missing one. The US entity's rate is 0 and its
 * invoice correctly shows no VAT line. So a missing row and a zero rate produce
 * the same number here, and that is right: a jurisdiction we have no row for is
 * one `topUpPot` will not take money in anyway, because the only entity it accepts
 * is `us` until C241's Egyptian question is answered.
 */
async function countryVatBps(entity: string): Promise<number> {
  const rows = await controlDb.execute(sql`
    SELECT vat_bps FROM country_settings WHERE entity = ${entity} AND enabled = true LIMIT 1`);

  const row = (rows.rows as { vat_bps: number }[])[0];
  return Number(row?.vat_bps ?? 0);
}

/**
 * Every top-up this sponsor has made, newest first, for the list of documents on
 * their pot page.
 *
 * One row per transaction, read off the pot legs. A `GROUP BY` is not needed
 * because a top-up posts exactly one `sponsor_pot` leg, and if that ever stops
 * being true the duplicate rows here are a visible symptom rather than a silent
 * double count.
 */
export async function topUpHistory(
  sponsorId: string,
): Promise<{ txnId: string; at: Date; amountCents: number }[]> {
  const rows = await controlDb
    .select({
      txnId: ledgerEntries.txnId,
      at: ledgerEntries.createdAt,
      amountCents: ledgerEntries.amountCents,
    })
    .from(ledgerEntries)
    .where(
      and(
        eq(ledgerEntries.txnKind, "pot_topup"),
        eq(ledgerEntries.account, "sponsor_pot"),
        eq(ledgerEntries.refType, "sponsor"),
        eq(ledgerEntries.refId, sponsorId),
      ),
    )
    .orderBy(desc(ledgerEntries.createdAt));

  /* Absolute value: the liability leg is negative. See the note in `invoiceFor`. */
  return rows.map((row) => ({
    txnId: row.txnId,
    at: row.at,
    amountCents: Math.abs(row.amountCents),
  }));
}
