import "server-only";

import { eq } from "drizzle-orm";

import { controlDb as db } from "@/lib/db";
import { sponsors } from "@/lib/db/schema";
import type { MessageKey } from "@/lib/i18n/messages";

import { isCompleteAddress, isTaxRegistrationNumber } from "./document";

/**
 * 🔴 0147: a company's tax details, as ETA needs them for an invoice to a
 * business: the registered name, the 9-digit tax registration number, and a
 * structured address. Saved by the company's admin; anything waiting for them
 * is issued the moment they are saved.
 */
export async function companyTaxDetails(sponsorId: string) {
  const [row] = await db
    .select({
      entity: sponsors.entity,
      legalName: sponsors.legalName,
      taxRegistrationNumber: sponsors.taxRegistrationNumber,
      taxAddress: sponsors.taxAddress,
    })
    .from(sponsors)
    .where(eq(sponsors.id, sponsorId))
    .limit(1);
  return {
    entity: row?.entity ?? null,
    legalName: row?.legalName ?? "",
    rin: row?.taxRegistrationNumber ?? "",
    address: row?.taxAddress ?? null,
  };
}

export async function saveCompanyTaxDetails(input: {
  sponsorId: string;
  legalName: string;
  taxRegistrationNumber: string;
  governate: string;
  regionCity: string;
  street: string;
  buildingNumber: string;
}): Promise<{ ok: true } | { error: MessageKey }> {
  const legalName = input.legalName.trim().slice(0, 200);
  const rin = input.taxRegistrationNumber.replace(/[\s-]/g, "");
  const address = {
    country: "EG",
    governate: input.governate.trim().slice(0, 100),
    regionCity: input.regionCity.trim().slice(0, 100),
    street: input.street.trim().slice(0, 200),
    buildingNumber: input.buildingNumber.trim().slice(0, 100),
  };
  if (legalName.length < 2) return { error: "sponsor.tax.errName" };
  if (!isTaxRegistrationNumber(rin)) return { error: "sponsor.tax.errRin" };
  if (!isCompleteAddress(address)) return { error: "sponsor.tax.errAddress" };

  await db
    .update(sponsors)
    .set({ legalName, taxRegistrationNumber: rin, taxAddress: address, updatedAt: new Date() })
    .where(eq(sponsors.id, input.sponsorId));

  const { advanceForCompany } = await import("./issue");
  await advanceForCompany(input.sponsorId);
  return { ok: true };
}
