import "server-only";

import { and, asc, desc, eq, inArray, isNull, like, notLike, or } from "drizzle-orm";

import { controlDb as db } from "@/lib/db";
import { etaDocuments, manualPayments, sponsors, type EtaDocument } from "@/lib/db/schema";
import { log, ref, safeErrorMessage } from "@/lib/logger";
import { getSettings } from "@/lib/settings";

import { buildEtaDocument, isCompleteAddress, isTaxRegistrationNumber } from "./document";
import { etaClient, etaSigner, whatEtaNeeds } from "./index";
import { serializeEta, toEtaJson } from "./serialize";

/**
 * 🔴 A TAX INVOICE FOR EVERY COMPANY TOP-UP, AND A CREDIT NOTE FOR EVERY RETURN.
 *
 * C241 kept Egyptian companies from topping up by card until e-invoicing was
 * settled; the transfer rail credited their pots with no tax document at all.
 * Now each confirmed top-up opens an invoice row at once, in the same request,
 * and the row is ADVANCED as far as it can go:
 *
 *   waiting    for what is missing, in `waiting_for`: our configuration
 *              (`whatEtaNeeds`), our own ETA details, or the company's tax
 *              details; or after a submission that failed, with the error
 *   submitted  ETA took it and gave it a uuid
 *   valid      ETA validated it; the company downloads the official PDF
 *   invalid    ETA refused it on validation; a person reads why
 *
 * Nothing here can fail the top-up itself: the money arrived and the pot is
 * credited whatever the Tax Authority is doing. A row that waits is retried by
 * the hourly job (`advanceEtaDocuments`) and the moment the company saves its
 * tax details.
 */

type Opened = { id: string } | null;

/** The invoice for a confirmed top-up, in pounds as sent: `amountMinor` is what arrived. */
export async function openTopUpInvoice(input: {
  paymentId: string;
  sponsorId: string;
  /** The share of it that is credit, the rest being VAT (the same split the ledger posted). */
  netShare: { net: number; settles: number };
}): Promise<Opened> {
  /* The pounds that arrived, read from the payment itself: the invoice is in what was paid. */
  const [paid] = await db
    .select({ minor: manualPayments.amountCents, currency: manualPayments.currency })
    .from(manualPayments)
    .where(eq(manualPayments.id, input.paymentId))
    .limit(1);
  if (!paid || paid.currency.toLowerCase() !== "egp") return null;
  const totalMinor = paid.minor;
  const netMinor = Math.round((totalMinor * input.netShare.net) / Math.max(1, input.netShare.settles));
  const vatMinor = totalMinor - netMinor;
  if (netMinor <= 0) return null;
  const [row] = await db
    .insert(etaDocuments)
    .values({
      kind: "invoice",
      purpose: "pot_topup",
      refId: input.paymentId,
      sponsorId: input.sponsorId,
      internalId: `TOPUP-${input.paymentId.slice(0, 8).toUpperCase()}`,
      netMinor,
      vatMinor,
      totalMinor,
    })
    .onConflictDoNothing()
    .returning({ id: etaDocuments.id });
  if (!row) return null;
  await advanceDocument(row.id);
  return row;
}

/**
 * The credit note for money returned from a pot. ETA requires a credit note
 * to name the invoices it corrects, so it names the company's issued top-up
 * invoices, newest first, until they cover it; with none issued yet, it waits.
 */
export async function openReturnCreditNote(input: {
  returnId: string;
  sponsorId: string;
  netMinor: number;
  vatMinor: number;
}): Promise<Opened> {
  const [latest] = await db
    .select({ id: etaDocuments.id })
    .from(etaDocuments)
    .where(and(eq(etaDocuments.sponsorId, input.sponsorId), eq(etaDocuments.kind, "invoice")))
    .orderBy(desc(etaDocuments.createdAt))
    .limit(1);

  const [row] = await db
    .insert(etaDocuments)
    .values({
      kind: "credit_note",
      purpose: "pot_return",
      refId: input.returnId,
      sponsorId: input.sponsorId,
      originalId: latest?.id ?? null,
      internalId: `RETURN-${input.returnId.slice(0, 8).toUpperCase()}`,
      netMinor: input.netMinor,
      vatMinor: input.vatMinor,
      totalMinor: input.netMinor + input.vatMinor,
    })
    .onConflictDoNothing()
    .returning({ id: etaDocuments.id });
  if (!row) return null;
  await advanceDocument(row.id);
  return row;
}

async function wait(id: string, waitingFor: string, error: string | null = null): Promise<void> {
  await db
    .update(etaDocuments)
    .set({ state: "waiting", waitingFor: waitingFor.slice(0, 300), error, updatedAt: new Date() })
    .where(and(eq(etaDocuments.id, id), eq(etaDocuments.state, "waiting")));
}

/**
 * Take one waiting document as far as it goes. Safe to call repeatedly and
 * concurrently: the move to `submitted` is conditional on `waiting`, and ETA
 * refuses an internal id it has already accepted.
 */
async function advanceDocument(id: string): Promise<EtaDocument["state"]> {
  const [doc] = await db.select().from(etaDocuments).where(eq(etaDocuments.id, id)).limit(1);
  if (!doc || doc.state !== "waiting") return doc?.state ?? "waiting";

  const needs = whatEtaNeeds();
  const client = etaClient();
  const signer = etaSigner();
  if (!client || !signer) {
    await wait(id, `configuration: ${needs.join(" ")}`);
    return "waiting";
  }

  const settings = await getSettings();
  const issuer = settings.invoice.entities.find((e) => e.entity === "eg");
  if (!issuer?.legalName || !isTaxRegistrationNumber(issuer.taxId) || !issuer.eta?.activityCode || !issuer.eta.itemCode) {
    await wait(id, "our details: the Egyptian entity's legal name, tax number, activity code and item code in settings");
    return "waiting";
  }
  const [company] = await db
    .select({
      legalName: sponsors.legalName,
      name: sponsors.name,
      taxRegistrationNumber: sponsors.taxRegistrationNumber,
      taxAddress: sponsors.taxAddress,
    })
    .from(sponsors)
    .where(eq(sponsors.id, doc.sponsorId))
    .limit(1);
  if (!company?.taxRegistrationNumber || !isTaxRegistrationNumber(company.taxRegistrationNumber) || !isCompleteAddress(company.taxAddress)) {
    await wait(id, "company details: the company's tax registration number and address");
    return "waiting";
  }

  let references: string[] | undefined;
  if (doc.kind === "credit_note") {
    const issued = await db
      .select({ etaUuid: etaDocuments.etaUuid, totalMinor: etaDocuments.totalMinor })
      .from(etaDocuments)
      .where(and(eq(etaDocuments.sponsorId, doc.sponsorId), eq(etaDocuments.kind, "invoice"), eq(etaDocuments.state, "valid")))
      .orderBy(desc(etaDocuments.createdAt));
    /*
     * 🔴 C12: what is still creditable, not what was ever invoiced. Each return
     * used to measure itself against every valid invoice, so a second return
     * could credit money the first had already taken back. Every other credit
     * note that stands or may stand counts against the total first.
     */
    const credited = await db
      .select({ totalMinor: etaDocuments.totalMinor })
      .from(etaDocuments)
      .where(
        and(
          eq(etaDocuments.sponsorId, doc.sponsorId),
          eq(etaDocuments.kind, "credit_note"),
          inArray(etaDocuments.state, ["submitted", "valid"]),
        ),
      );
    const invoiced = issued.reduce((sum, invoice) => sum + (invoice.etaUuid ? invoice.totalMinor : 0), 0);
    const alreadyCredited = credited.reduce((sum, note) => sum + note.totalMinor, 0);
    references = [];
    let covered = 0;
    for (const invoice of issued) {
      if (covered >= doc.totalMinor) break;
      if (!invoice.etaUuid) continue;
      references.push(invoice.etaUuid);
      covered += invoice.totalMinor;
    }
    if (covered < doc.totalMinor || invoiced - alreadyCredited < doc.totalMinor) {
      await wait(
        id,
        covered < doc.totalMinor
          ? "the invoices it credits to be issued first"
          : "the invoices it credits to cover it beside earlier credit notes",
      );
      return "waiting";
    }
  }

  const { entityVatBps } = await import("@/lib/billing/pot");
  const document = buildEtaDocument({
    kind: doc.kind,
    issuer: {
      type: "B",
      id: issuer.taxId.trim(),
      name: issuer.legalName,
      address: {
        branchID: issuer.eta.branchId || "0",
        country: "EG",
        governate: issuer.eta.governate,
        regionCity: issuer.eta.regionCity,
        street: issuer.eta.street,
        buildingNumber: issuer.eta.buildingNumber,
      },
    },
    receiver: {
      type: "B",
      id: company.taxRegistrationNumber.trim(),
      name: company.legalName || company.name,
      address: { ...company.taxAddress, country: company.taxAddress.country || "EG" },
    },
    internalId: doc.internalId,
    issuedAt: new Date(Date.now() - 60_000),
    activityCode: issuer.eta.activityCode,
    item: { description: "Employee wellbeing credit (24Therapy)", code: issuer.eta.itemCode },
    netMinor: doc.netMinor,
    vatMinor: doc.vatMinor,
    vatBps: await entityVatBps("eg"),
    references,
  });

  const signed = await signer.sign(serializeEta(document));
  if (!signed.ok) {
    await bumpAttempts(id, `signing: ${signed.reason}`);
    return "waiting";
  }
  document.signatures = [{ signatureType: "I", value: signed.cades }];
  const text = toEtaJson(document);

  const submitted = await client.submit(`[${text}]`);
  if (!submitted.ok) {
    await bumpAttempts(id, `submission: ${submitted.reason}`);
    return "waiting";
  }
  const accepted = submitted.accepted.find((a) => a.internalId === doc.internalId);
  if (!accepted) {
    const rejected = submitted.rejected.find((r) => r.internalId === doc.internalId);
    /*
     * 🔴 C11: refused on validation, so the same document would be refused
     * every hour for ever. It waits for a person, who fixes what ETA named and
     * presses retry in settings.
     */
    await db
      .update(etaDocuments)
      .set({
        error: (rejected?.error ?? "rejected").slice(0, 500),
        waitingFor: `${FOR_REVIEW} ETA refused it`,
        documentText: text,
        attempts: doc.attempts + 1,
        updatedAt: new Date(),
      })
      .where(eq(etaDocuments.id, id));
    log.error("ETA rejected a document", { document: ref(id), error: rejected?.error ?? "rejected" });
    return "waiting";
  }

  await db
    .update(etaDocuments)
    .set({
      state: "submitted",
      waitingFor: null,
      error: null,
      documentText: text,
      submissionUuid: submitted.submissionUuid,
      etaUuid: accepted.uuid,
      etaLongId: accepted.longId,
      attempts: doc.attempts + 1,
      submittedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(and(eq(etaDocuments.id, id), eq(etaDocuments.state, "waiting")));
  return pollDocument(id);
}

/** A document waiting on this is skipped by the hourly job until a person retries it. */
const FOR_REVIEW = "review:";
/** Two days of hourly tries at a signer or ETA that keeps failing, then a person. */
const MAX_TRIES = 48;

async function bumpAttempts(id: string, error: string): Promise<void> {
  log.error("ETA document not submitted", { document: ref(id), error });
  const [doc] = await db.select({ attempts: etaDocuments.attempts }).from(etaDocuments).where(eq(etaDocuments.id, id)).limit(1);
  const attempts = (doc?.attempts ?? 0) + 1;
  await db
    .update(etaDocuments)
    .set({
      error: error.slice(0, 500),
      attempts,
      ...(attempts >= MAX_TRIES ? { waitingFor: `${FOR_REVIEW} ${MAX_TRIES} tries failed` } : {}),
      updatedAt: new Date(),
    })
    .where(eq(etaDocuments.id, id));
}

/** Ask ETA where a submitted document is. */
async function pollDocument(id: string): Promise<EtaDocument["state"]> {
  const [doc] = await db.select().from(etaDocuments).where(eq(etaDocuments.id, id)).limit(1);
  if (!doc || doc.state !== "submitted" || !doc.etaUuid) return doc?.state ?? "waiting";
  const client = etaClient();
  if (!client) return "submitted";
  const status = await client.status(doc.etaUuid);
  if ("ok" in status) return "submitted";
  const next =
    status.status === "Valid" ? "valid" : status.status === "Invalid" || status.status === "Rejected" ? "invalid" : status.status === "Cancelled" ? "cancelled" : null;
  if (!next) return "submitted";
  await db
    .update(etaDocuments)
    .set({
      state: next,
      error: status.error,
      validatedAt: next === "valid" ? new Date() : null,
      updatedAt: new Date(),
    })
    .where(and(eq(etaDocuments.id, id), eq(etaDocuments.state, "submitted")));
  return next;
}

/**
 * The hourly job: every waiting document tried again, every submitted one asked
 * about. Oldest first, so an invoice goes before the credit note that names it.
 * A document set aside for a person is left alone unless a person asks
 * (`review`), and then it starts its count again.
 */
export async function advanceEtaDocuments(opts: { review?: boolean } = {}): Promise<{ advanced: number }> {
  if (opts.review) {
    await db
      .update(etaDocuments)
      .set({ waitingFor: null, attempts: 0, updatedAt: new Date() })
      .where(and(eq(etaDocuments.state, "waiting"), like(etaDocuments.waitingFor, `${FOR_REVIEW}%`)));
  }
  const open = await db
    .select({ id: etaDocuments.id, state: etaDocuments.state })
    .from(etaDocuments)
    .where(
      and(
        inArray(etaDocuments.state, ["waiting", "submitted"]),
        or(isNull(etaDocuments.waitingFor), notLike(etaDocuments.waitingFor, `${FOR_REVIEW}%`)),
      ),
    )
    .orderBy(asc(etaDocuments.createdAt))
    .limit(200);
  let advanced = 0;
  for (const doc of open) {
    try {
      const before = doc.state;
      const after = before === "waiting" ? await advanceDocument(doc.id) : await pollDocument(doc.id);
      if (after !== before) advanced += 1;
    } catch (error) {
      log.error("ETA advance failed", { document: ref(doc.id), reason: safeErrorMessage(error) });
    }
  }
  return { advanced };
}

/** When a company saves its tax details, what was waiting for them goes. */
export async function advanceForCompany(sponsorId: string): Promise<void> {
  const waiting = await db
    .select({ id: etaDocuments.id })
    .from(etaDocuments)
    .where(and(eq(etaDocuments.sponsorId, sponsorId), eq(etaDocuments.state, "waiting")))
    .orderBy(asc(etaDocuments.createdAt));
  for (const doc of waiting) await advanceDocument(doc.id);
}

/** A company's documents, newest first, for its own billing screen. */
export async function documentsFor(sponsorId: string) {
  return db
    .select({
      id: etaDocuments.id,
      kind: etaDocuments.kind,
      state: etaDocuments.state,
      waitingFor: etaDocuments.waitingFor,
      totalMinor: etaDocuments.totalMinor,
      internalId: etaDocuments.internalId,
      createdAt: etaDocuments.createdAt,
    })
    .from(etaDocuments)
    .where(eq(etaDocuments.sponsorId, sponsorId))
    .orderBy(desc(etaDocuments.createdAt))
    .limit(50);
}

/** The documents a person has to look at: waiting on us, or refused. */
export async function documentsNeedingAttention() {
  return db
    .select()
    .from(etaDocuments)
    .where(inArray(etaDocuments.state, ["waiting", "invalid"]))
    .orderBy(desc(etaDocuments.createdAt))
    .limit(100);
}

/** The official PDF of one of a company's own documents. */
export async function printoutFor(sponsorId: string, id: string): Promise<ArrayBuffer | null> {
  const [doc] = await db
    .select({ etaUuid: etaDocuments.etaUuid, state: etaDocuments.state })
    .from(etaDocuments)
    .where(and(eq(etaDocuments.id, id), eq(etaDocuments.sponsorId, sponsorId)))
    .limit(1);
  if (!doc?.etaUuid || doc.state !== "valid") return null;
  const client = etaClient();
  if (!client) return null;
  const printout = await client.printout(doc.etaUuid);
  return printout.ok ? printout.pdf : null;
}

