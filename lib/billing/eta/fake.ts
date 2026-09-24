import "server-only";

import { createHash, randomUUID } from "node:crypto";

import { parseEtaJson, serializeEta } from "./serialize";
import type { EtaClient, EtaSigner, EtaStatus } from "./types";

/**
 * 🔴 THE SIMULATED TAX AUTHORITY AND SIGNER, for development and `verify:eta`.
 * Never on the live deployment (`index.ts`).
 *
 * It checks what the real one would refuse outright: a document with no
 * signature, a signature that is not over this document's canonical text,
 * totals that do not add up, a business receiver with no 9-digit number, and
 * the same internal id twice. It then validates what it accepted. Its record
 * is in memory, which is what a status read asks.
 */
const documents = new Map<string, EtaStatus & { internalId: string }>();
const seenInternalIds = new Set<string>();

function fakeCades(serialized: string): string {
  return Buffer.from(`FAKE-CADES:${createHash("sha256").update(serialized).digest("hex")}`).toString("base64");
}

export const FAKE_SIGNER: EtaSigner = {
  name: "fake",
  async sign(serialized) {
    return { ok: true, cades: fakeCades(serialized) };
  },
};

type Doc = Record<string, unknown> & {
  internalID?: string;
  signatures?: { signatureType: string; value: string }[];
  receiver?: { type?: string; id?: string };
  netAmount?: { etaNumber: string };
  totalAmount?: { etaNumber: string };
  taxTotals?: { amount: { etaNumber: string } }[];
};

export const FAKE_ETA: EtaClient = {
  name: "fake",

  async submit(documentsJson) {
    const docs = parseEtaJson(documentsJson) as Doc[];
    const accepted: { internalId: string; uuid: string; longId: string }[] = [];
    const rejected: { internalId: string; error: string }[] = [];
    for (const doc of docs) {
      const internalId = String(doc.internalID ?? "");
      const signature = doc.signatures?.[0]?.value;
      const net = Number(doc.netAmount?.etaNumber ?? NaN);
      const vat = (doc.taxTotals ?? []).reduce((n, t) => n + Number(t.amount.etaNumber), 0);
      const total = Number(doc.totalAmount?.etaNumber ?? NaN);
      const problem = !signature
        ? "Document is not signed"
        : signature !== fakeCades(serializeEta(doc))
          ? "Signature is not valid for this document"
          : Math.abs(net + vat - total) > 0.00001
            ? "Total amount does not equal net plus taxes"
            : doc.receiver?.type === "B" && !/^\d{9}$/.test(String(doc.receiver?.id ?? ""))
              ? "Receiver registration number is invalid"
              : seenInternalIds.has(internalId)
                ? "Duplicate internal id"
                : null;
      if (problem) {
        rejected.push({ internalId, error: problem });
        continue;
      }
      seenInternalIds.add(internalId);
      const uuid = randomUUID().replace(/-/g, "").slice(0, 26).toUpperCase();
      documents.set(uuid, { uuid, status: "Valid", error: null, internalId });
      accepted.push({ internalId, uuid, longId: `${uuid}${randomUUID().slice(0, 8)}` });
    }
    return { ok: true, submissionUuid: randomUUID(), accepted, rejected };
  },

  async status(uuid) {
    return documents.get(uuid) ?? { ok: false, reason: "No such document" };
  },

  async printout(uuid) {
    if (!documents.has(uuid)) return { ok: false, reason: "No such document" };
    return { ok: true, pdf: new TextEncoder().encode(`%PDF-1.4\n% simulated ETA printout ${uuid}\n`).buffer as ArrayBuffer };
  },

  async cancel(uuid) {
    const doc = documents.get(uuid);
    if (!doc) return { ok: false, reason: "No such document" };
    documents.set(uuid, { ...doc, status: "Cancelled" });
    return { ok: true };
  },
};
