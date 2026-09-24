/**
 * 🔴 THE TWO CONTRACTS BEHIND EGYPTIAN E-INVOICING.
 *
 * The Egyptian Tax Authority's API (`sdk.invoicing.eta.gov.eg`) takes signed
 * documents, validates them after the fact, and serves the official PDF. The
 * signature is a CAdES-BES over the document's canonical text, made with the
 * company's eSeal certificate, which lives on a USB token or in an HSM and
 * never on this server. So there are two seams: the ETA client (which a
 * simulator stands behind until our credentials exist) and the signer (which a
 * signing service holding the eSeal stands behind).
 */

export type EtaRefusal = { ok: false; reason: string };

export type EtaSubmission =
  | {
      ok: true;
      submissionUuid: string;
      accepted: { internalId: string; uuid: string; longId: string }[];
      rejected: { internalId: string; error: string }[];
    }
  | EtaRefusal;

/** ETA's own words for where a document is. */
export type EtaStatus = {
  uuid: string;
  status: "Submitted" | "Valid" | "Invalid" | "Cancelled" | "Rejected";
  error: string | null;
};

export type EtaClient = {
  readonly name: string;
  /** One or more signed documents, as the exact JSON the signatures were made for. */
  submit(documentsJson: string): Promise<EtaSubmission>;
  status(uuid: string): Promise<EtaStatus | EtaRefusal>;
  /** The official PDF, in ETA's own layout. */
  printout(uuid: string): Promise<{ ok: true; pdf: ArrayBuffer } | EtaRefusal>;
  cancel(uuid: string, reason: string): Promise<{ ok: true } | EtaRefusal>;
};

export type EtaSigner = {
  readonly name: string;
  /** A base64 CAdES-BES signature over the canonical text (`serializeEta`). */
  sign(serialized: string): Promise<{ ok: true; cades: string } | EtaRefusal>;
};
