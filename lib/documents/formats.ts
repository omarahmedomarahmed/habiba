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

/** Formats whose text we can extract today, with no new dependency. */
export const READABLE_TYPES = ["text/plain", "text/markdown", "text/csv"] as const;

/**
 * Formats we store, show and never claim to have read.
 *
 * PDFs and Word files are in this list rather than the one above, and that is
 * a **deliberate deferral, not an oversight** — see C50. Extracting their text
 * needs a parser this project does not have, and shipping a bad one would put
 * wrong passages behind `[D7:3]` citations. A citation pointing at the wrong
 * words is the same class of error as C35's straddled turns: it manufactures
 * certainty a clinician will act on.
 */
export const STORED_ONLY_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
  "image/tiff",
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
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
      return { label: "Could not be read — not searchable", searchable: false };
    case "unsupported":
      return {
        label: isImage(input.mimeType) ? "Image — not searchable" : "Stored, but not searchable",
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
