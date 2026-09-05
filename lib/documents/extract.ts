import "server-only";

import { readabilityOf } from "./formats";

/**
 * Getting text out of a stored file. PLAN.md 8.3, and the one seam C50 names.
 *
 * Returns:
 *   `string`  the text, ready to chunk
 *   `null`    we cannot read this format — the caller writes `unsupported`
 *   throws    we tried and it broke — the caller writes `failed` and retries
 *
 * The three outcomes are distinct on purpose. "Never going to work" and "did
 * not work this time" produce different screens (8.4) and different retry
 * behaviour, and one value for both makes the queue either useless or
 * infinite.
 *
 * ## What is deliberately not here: PDF and Word
 *
 * Both are in `STORED_ONLY_TYPES`, so they arrive here as `null` and are
 * labelled *not searchable* rather than parsed. That is a deferral with a
 * reason, not an omission:
 *
 * This project has no PDF or DOCX parser, and the plausible ones
 * (`unpdf`, `pdf-parse`, `mammoth`) each carry a decision about failure
 * modes that has not been made. A parser that reads a two-column discharge
 * summary in reading order — or interleaves the columns, which is the common
 * failure — puts **wrong words behind a `[D7:3]` citation**. That is C35's
 * lesson repeated: a wrong label manufactures certainty a clinician acts on,
 * and unknown is honest.
 *
 * So the seam is real and the queue works; only the parser is missing. Adding
 * it is one function and one dependency, and C50 is the ticket.
 */
export async function extractText(input: {
  blobUrl: string | null;
  mimeType: string | null;
}): Promise<string | null> {
  if (!input.blobUrl || !input.mimeType) return null;
  if (readabilityOf(input.mimeType) !== "readable") return null;

  const bytes = await fetchDocument(input.blobUrl);
  const text = new TextDecoder("utf-8", { fatal: false }).decode(bytes);

  /*
   * A file that decodes to mostly replacement characters is binary wearing a
   * text mime type — somebody's scanner labelling a TIFF as `text/plain`.
   * Storing its bytes as a "passage" would put mojibake behind a citation, so
   * it is treated as unreadable rather than as text.
   */
  const replacements = (text.match(/�/g) ?? []).length;
  if (text.length > 0 && replacements / text.length > 0.05) return null;

  const trimmed = text.trim();
  return trimmed.length > 0 ? trimmed : null;
}

/** Reads the stored bytes, whether they are on Blob or on the local disk. */
async function fetchDocument(blobUrl: string): Promise<Uint8Array> {
  if (blobUrl.startsWith("/api/uploads/")) {
    const { readFile } = await import("node:fs/promises");
    const { join } = await import("node:path");
    return new Uint8Array(
      await readFile(join(process.cwd(), ".uploads", blobUrl.slice("/api/uploads/".length))),
    );
  }

  const response = await fetch(blobUrl);
  if (!response.ok) throw new Error(`document fetch failed: ${response.status}`);
  return new Uint8Array(await response.arrayBuffer());
}
