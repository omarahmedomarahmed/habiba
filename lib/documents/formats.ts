/**
 * What a person may upload, and what we admit we cannot read. PLAN.md 8.2 / 8.4.
 *
 * Pure and dependency-free so the policy can be asserted in a test and read by
 * a client component without dragging the server in.
 *
 * ## Two separate questions
 *
 * "May this be stored?" and "can the copilot read it?" are different, and
 * conflating them is the mistake 8.4 exists to prevent. A phone photo of a
 * discharge summary is the single most common document a patient in Egypt
 * actually has. Refusing it because we cannot index it would lose the record
 * entirely; indexing it badly — or letting a clinician *assume* it was indexed
 * — is worse still.
 *
 * So: store almost anything, and be explicit about what is searchable.
 */

/**
 * 8.2 — raised from 8 MB.
 *
 * A phone photograph of an A4 page is routinely 4–6 MB, and a multi-page scan
 * of a hospital discharge is comfortably past eight. The old cap was written
 * for a headshot. Twenty-five is enough for a twenty-page scan and still small
 * enough that a failed upload on a phone connection is recoverable.
 *
 * The clinician-identity uploads in `lib/uploads.ts` keep their own, smaller
 * cap: that flow really is one photo of one licence.
 */
export const MAX_DOCUMENT_BYTES = 25 * 1024 * 1024;

/**
 * Formats whose text we extract.
 *
 * PDF and `.docx` joined this list in 11R.23 (C50), with the condition that
 * makes them safe: a PDF whose page layout looks like columns is extracted as
 * nothing and labelled unsupported. See `lib/documents/layout.ts`.
 */
export const READABLE_TYPES = [
  "text/plain",
  "text/markdown",
  "text/csv",
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
] as const;

/**
 * Formats we store, show and never claim to have read.
 *
 * Photographs and scans, because reading them needs OCR and this product does
 * not have one — a phone photo of a discharge summary is the most common
 * document a patient in Egypt actually has, and refusing it would lose the
 * record entirely.
 *
 * Legacy `.doc` stays here too: mammoth reads OOXML, not the old binary
 * format, and a second parser is not worth adding for a format nothing in this
 * database uses.
 *
 * Being in this list is not the only way a document ends up unsearchable — a
 * PDF with no text layer, or one laid out in columns, is *readable* by type
 * and `unsupported` by outcome. The label the screen shows comes from the
 * outcome.
 */
export const STORED_ONLY_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
  "image/tiff",
  "application/msword",
] as const;

export type Readability = "readable" | "stored_only" | "rejected";

export function readabilityOf(mimeType: string): Readability {
  const type = mimeType.split(";")[0]!.trim().toLowerCase();
  if ((READABLE_TYPES as readonly string[]).includes(type)) return "readable";
  if ((STORED_ONLY_TYPES as readonly string[]).includes(type)) return "stored_only";
  return "rejected";
}

export function documentProblem(file: { size: number; type: string } | null): string | null {
  if (!file || file.size === 0) return "Choose a file.";
  if (file.size > MAX_DOCUMENT_BYTES) {
    return `That file is over ${Math.floor(MAX_DOCUMENT_BYTES / (1024 * 1024))} MB. Try photographing fewer pages at a time.`;
  }
  if (readabilityOf(file.type) === "rejected") {
    return "We can take a photo, a scan, a PDF, a Word file or plain text.";
  }
  return null;
}

/**
 * 8.4's label, in the words the screen uses.
 *
 * "Image — not searchable" rather than "processing failed" or nothing at all.
 * The sentence has one job: stop a clinician assuming the copilot read a
 * document it never saw, because a clinician who believes the copilot has seen
 * a discharge summary will not go and read it themselves.
 */
export function searchabilityLabel(input: {
  extraction: "none" | "pending" | "ready" | "unsupported" | "failed";
  mimeType: string | null;
}): { label: string; searchable: boolean } {
  switch (input.extraction) {
    case "ready":
    case "none":
      return { label: "Searchable", searchable: true };
    case "pending":
      return { label: "Being read…", searchable: false };
    case "failed":
      return { label: "Could not be read, not searchable", searchable: false };
    case "unsupported":
      return {
        label: isImage(input.mimeType) ? "Image, not searchable" : "Stored, but not searchable",
        searchable: false,
      };
  }
}

export function isImage(mimeType: string | null): boolean {
  return Boolean(mimeType?.toLowerCase().startsWith("image/"));
}

/** The extension we store a document under. Cosmetic; the mime type is the truth. */
export function extensionFor(mimeType: string): string {
  const map: Record<string, string> = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
    "image/heic": "heic",
    "image/heif": "heif",
    "image/tiff": "tiff",
    "application/pdf": "pdf",
    "application/msword": "doc",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
    "text/plain": "txt",
    "text/markdown": "md",
    "text/csv": "csv",
  };
  return map[mimeType.split(";")[0]!.trim().toLowerCase()] ?? "bin";
}
