import "server-only";

import { and, desc, eq, inArray, sql } from "drizzle-orm";

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
 * The invoice number is derived from the transaction's own position in the
 * ISSUER's sequence of paid top-ups (`invoicePosition`). It is stable because
 * ledger rows are append-only and nothing is ever deleted, which is the property
 * that makes a derived number safe.
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
      id: ledgerEntries.id,
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

  /*
   * 🔴 W2-A11: A WELCOME CREDIT IS NOT AN INVOICE. It is money we gave, posted
   * against `platform_expense` with no cash leg, and it rendered as "Paid $100"
   * on a document a finance team files. No money arrived, there was no supply,
   * so there is no document: the credit shows in the pot's balance, not here.
   */
  if (!cashLeg) return null;

  const settings = await getSettings();
  const details = settings.invoice.entities.find((row) => row.entity === sponsor.entity);

  const missing: string[] = [];
  if (!details?.legalName) missing.push("legal name");
  if (!details?.address) missing.push("address");
  if (!details?.taxId) missing.push("tax registration number");
  if (missing.length > 0) return { missing };

  const position = await invoicePosition({ entity: sponsor.entity, legId: leg.id });

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
 * 🔴 W2-A11: the invoice's place in its ISSUER's sequence, not its customer's.
 *
 * The number was this sponsor's own count of top-ups, so every company's first
 * invoice from the US entity was `US-00001`: one issuer, many documents, one
 * number, which no tax authority accepts. It is now the position among every
 * PAID top-up (one with a cash leg; a welcome credit is not a document) held
 * by a sponsor billed from the same entity, ordered by time and then by leg id
 * so two in one millisecond keep one order on every render.
 *
 * The issuer is the sponsor's entity, the same one the legal details above are
 * read from; `setEntity` refuses to move a sponsor whose pot holds money, so
 * an issued number cannot change issuer.
 */
async function invoicePosition(input: { entity: string; legId: string }): Promise<number> {
  const rows = await controlDb.execute(sql`
    SELECT count(*)::int AS n
      FROM ledger_entries p
      JOIN sponsors s ON s.id = p.ref_id
     WHERE p.txn_kind = 'pot_topup'
       AND p.account = 'sponsor_pot'
       AND p.ref_type = 'sponsor'
       AND s.entity = ${input.entity}
       AND EXISTS (
         SELECT 1 FROM ledger_entries c WHERE c.txn_id = p.txn_id AND c.account = 'cash'
       )
       -- The leg's own timestamp from the database: a JS Date drops the microseconds.
       AND (p.created_at, p.id) <= (SELECT l.created_at, l.id FROM ledger_entries l WHERE l.id = ${input.legId}::uuid)`);
  return Number((rows.rows as { n: number }[])[0]?.n ?? 0);
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
): Promise<{ txnId: string; at: Date; amountCents: number; position: number }[]> {
  const rows = await controlDb
    .select({
      id: ledgerEntries.id,
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

  /*
   * 🔴 W2-A11: paid top-ups only. A welcome credit has no cash leg and no
   * invoice (see `invoiceFor`), so it is not listed as one.
   */
  const txnIds = rows.map((row) => row.txnId);
  const paid = txnIds.length
    ? new Set(
        (
          await controlDb
            .select({ txnId: ledgerEntries.txnId })
            .from(ledgerEntries)
            .where(and(inArray(ledgerEntries.txnId, txnIds), eq(ledgerEntries.account, "cash")))
        ).map((row) => row.txnId),
      )
    : new Set<string>();

  const [sponsor] = await controlDb
    .select({ entity: sponsors.entity })
    .from(sponsors)
    .where(eq(sponsors.id, sponsorId))
    .limit(1);

  /* Absolute value: the liability leg is negative. See the note in `invoiceFor`. */
  return Promise.all(
    rows
      .filter((row) => paid.has(row.txnId))
      .map(async (row) => ({
        txnId: row.txnId,
        at: row.at,
        amountCents: Math.abs(row.amountCents),
        /* W2-A11: the same place in the issuer's sequence the invoice prints. */
        position: sponsor ? await invoicePosition({ entity: sponsor.entity, legId: row.id }) : 0,
      })),
  );
}
