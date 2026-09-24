import type { EtaAddress } from "@/lib/db/schema";

import { etaNumber, type EtaNumber } from "./serialize";

/**
 * 🔴 AN ETA INVOICE OR CREDIT NOTE (Invoice v1.0 / Credit Note v1.0), AS DATA.
 *
 * One line, because what a company buys from us is one thing: credit in its
 * wellbeing pot, charged with VAT (T1, subtype V009, the general rate). The
 * amounts arrive in piastres and leave in pounds with five decimals, which is
 * the precision ETA recomputes totals at; every total is derived here from the
 * one line so the document cannot disagree with itself.
 *
 * Pure, so the whole shape is a test (`tests/eta.test.ts`).
 */

export type EtaParty = {
  /** B for a business; the id is its 9-digit tax registration number. */
  type: "B";
  id: string;
  name: string;
  address: EtaAddress & { branchID?: string };
};

export type EtaDocumentInput = {
  kind: "invoice" | "credit_note";
  issuer: EtaParty;
  receiver: EtaParty;
  internalId: string;
  issuedAt: Date;
  activityCode: string;
  item: { description: string; code: string };
  netMinor: number;
  vatMinor: number;
  vatBps: number;
  /** A credit note names the invoice it corrects. */
  references?: string[];
};

const pounds = (minor: number): EtaNumber => etaNumber(minor / 100);

/** ETA wants UTC, no fraction of a second, and nothing in the future. */
function utcSeconds(at: Date): string {
  return `${at.toISOString().slice(0, 19)}Z`;
}

export function buildEtaDocument(input: EtaDocumentInput): Record<string, unknown> {
  const net = pounds(input.netMinor);
  const vat = pounds(input.vatMinor);
  const total = pounds(input.netMinor + input.vatMinor);
  const zero = etaNumber(0);

  const document: Record<string, unknown> = {
    issuer: input.issuer,
    receiver: input.receiver,
    documentType: input.kind === "invoice" ? "I" : "C",
    documentTypeVersion: "1.0",
    dateTimeIssued: utcSeconds(input.issuedAt),
    taxpayerActivityCode: input.activityCode,
    internalID: input.internalId,
    invoiceLines: [
      {
        description: input.item.description,
        itemType: "EGS",
        itemCode: input.item.code,
        unitType: "EA",
        quantity: etaNumber(1),
        internalCode: input.item.code,
        salesTotal: net,
        total,
        valueDifference: zero,
        totalTaxableFees: zero,
        netTotal: net,
        itemsDiscount: zero,
        unitValue: { currencySold: "EGP", amountEGP: net },
        discount: { rate: zero, amount: zero },
        taxableItems: [
          { taxType: "T1", amount: vat, subType: "V009", rate: etaNumber(input.vatBps / 100) },
        ],
      },
    ],
    totalDiscountAmount: zero,
    totalSalesAmount: net,
    netAmount: net,
    taxTotals: [{ taxType: "T1", amount: vat }],
    totalAmount: total,
    extraDiscountAmount: zero,
    totalItemsDiscountAmount: zero,
  };
  if (input.kind === "credit_note") document.references = input.references ?? [];
  return document;
}

/** A 9-digit Egyptian tax registration number, digits only. */
export function isTaxRegistrationNumber(value: string): boolean {
  return /^\d{9}$/.test(value.trim());
}

/** Every address field ETA requires, present and not blank. */
export function isCompleteAddress(address: Partial<EtaAddress> | null | undefined): address is EtaAddress {
  return Boolean(
    address &&
      address.country?.trim() &&
      address.governate?.trim() &&
      address.regionCity?.trim() &&
      address.street?.trim() &&
      address.buildingNumber?.trim(),
  );
}
