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
 * ## PDF and Word — C50, built in 11R.23
 *
 * `unpdf` for PDF, `mammoth` for `.docx`. The decision that was deferred twice
 * is the one about failure modes, and it is made here: a PDF whose layout
 * looks like columns is **not extracted at all**. `lib/documents/layout.ts`
 * measures it; anything it calls interleaved returns `null`, which the caller
 * writes as `unsupported`, which the screen shows as "Stored, but not
 * searchable".
 *
 * That is deliberately the timid direction. A two-column results table is
 * marked unsupported along with the genuine two-column pages, and the cost of
 * that is a document a clinician has to open themselves. The cost of the other
 * error is a dose from the right column glued to a symptom from the left,
 * behind a `[D7:3]` citation somebody acts on.
 *
 * Legacy `.doc` (`application/msword`) stays stored-only: mammoth reads the
 * OOXML format and not the old binary one, and there is no second parser worth
 * adding for a format nobody has uploaded.
 */
export async function extractText(input: {
  blobUrl: string | null;
  mimeType: string | null;
}): Promise<string | null> {
  if (!input.blobUrl || !input.mimeType) return null;
  if (readabilityOf(input.mimeType) !== "readable") return null;

  const bytes = await fetchDocument(input.blobUrl);
  const type = input.mimeType.split(";")[0]!.trim().toLowerCase();

  if (type === "application/pdf") return extractPdf(bytes);
  if (type === DOCX) return extractDocx(bytes);
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

const DOCX = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

/**
 * A PDF, in reading order, or nothing.
 *
 * Two passes over the same document proxy: `extractTextItems` for the
 * coordinates the layout check needs, then `extractText` for the text itself.
 * The proxy is opened once and handed to both, so the file is parsed once.
 *
 * `null` on an interleaved layout, on an empty result, and on a scan — a
 * photographed page inside a PDF wrapper has no text layer at all, and the
 * honest label for it is the same one an image gets.
 */
async function extractPdf(bytes: Uint8Array): Promise<string | null> {
  const { extractText: pdfText, extractTextItems, getDocumentProxy } = await import("unpdf");

  const document = await getDocumentProxy(bytes);

  const { items } = await extractTextItems(document);
  const { isInterleaved } = await import("./layout");
  if (isInterleaved(items)) return null;

  const { text } = await pdfText(document, { mergePages: false });

  /*
   * Pages joined with a blank line, so the chunker's paragraph boundaries do
   * not run the last sentence of one page into the first of the next.
   */
  const joined = text
    .map((page) => page.trim())
    .filter((page) => page.length > 0)
    .join("\n\n")
    .trim();

  return joined.length > 0 ? joined : null;
}

/**
 * A `.docx`, in document order.
 *
 * No layout check: mammoth reads the document's own XML, which *is* the
 * reading order — there are no coordinates to get wrong. Word's own column
 * layout is a rendering property applied to text that is already in order.
 */
async function extractDocx(bytes: Uint8Array): Promise<string | null> {
  const mammoth = await import("mammoth");

  const { value } = await mammoth.extractRawText({
    buffer: Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength),
  });

  const trimmed = value.trim();
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
