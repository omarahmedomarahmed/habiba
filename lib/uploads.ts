import "server-only";

import { randomBytes } from "node:crypto";
import { del, put } from "@vercel/blob";

import { env } from "@/lib/env";
import { log, safeErrorMessage } from "@/lib/logger";

/**
 * File uploads, on Vercel Blob.
 *
 * Everything here is *identity* material — a licence, a passport page, a
 * headshot — belonging to a clinician, not clinical data about a patient. That
 * distinction sets the rules:
 *
 *  - **Private, always.** Blobs are created with `access: "public"` in the
 *    sense that they have an unguessable URL, so the only real protection is
 *    that the URL is a secret. We therefore never put a credential URL in a
 *    page a patient can reach, never in an email, and never in a log. The
 *    random 32-byte path prefix is the access control.
 *  - **A headshot is different.** It is meant to be seen — it goes on the
 *    public radar — so it lives under a separate prefix and is treated as
 *    published from the moment it is uploaded.
 *
 * If a stricter posture is needed later (signed short-lived URLs, or moving
 * documents to S3 with SSE-KMS under a BAA), the seam is here: every read of a
 * document goes through `documentUrl`, and every write through `uploadDocument`.
 */

export const MAX_UPLOAD_BYTES = 8 * 1024 * 1024;

/**
 * Images only, and only formats a browser will render.
 *
 * PDFs are excluded deliberately: a PDF is a script host, and an admin opening
 * an unvetted one from an unverified signup is a real risk. Asking for a photo
 * of a document is also what people naturally do on a phone.
 */
export const ALLOWED_UPLOAD_TYPES = ["image/jpeg", "image/png", "image/webp", "image/heic"];

export type UploadKind = "credential" | "headshot";

export function uploadProblem(file: { size: number; type: string } | null): string | null {
  if (!file || file.size === 0) return "Choose a file.";
  if (file.size > MAX_UPLOAD_BYTES) return "That image is over 8 MB — try a photo from your phone.";
  if (!ALLOWED_UPLOAD_TYPES.includes(file.type)) {
    return "Upload a photo (JPEG, PNG, WebP or HEIC).";
  }
  return null;
}

export function uploadsConfigured(): boolean {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN);
}

/**
 * Store a file and return its URL.
 *
 * The path carries 32 random bytes, so the URL cannot be walked or guessed from
 * a user id. `addRandomSuffix` is off because we are already supplying the
 * entropy and a predictable tail makes the stored path easier to reason about.
 */
export async function uploadDocument(opts: {
  kind: UploadKind;
  userId: string;
  label: string;
  file: File;
}): Promise<{ url?: string; error?: string }> {
  if (!uploadsConfigured()) {
    return { error: "File uploads are not configured on this deployment." };
  }

  const problem = uploadProblem(opts.file);
  if (problem) return { error: problem };

  const extension = extensionFor(opts.file.type);
  const secret = randomBytes(24).toString("base64url");
  // The user id is in the path for operability — an admin tracing a blob back
  // to an account should not need a database round trip — and it grants no
  // access on its own, because the secret segment is what makes the URL work.
  const path = `${opts.kind}/${opts.userId}/${opts.label}-${secret}.${extension}`;

  try {
    const blob = await put(path, opts.file, {
      access: "public",
      addRandomSuffix: false,
      contentType: opts.file.type,
      cacheControlMaxAge: opts.kind === "headshot" ? 3600 : 0,
    });
    return { url: blob.url };
  } catch (error) {
    // Never log the path: for a credential it is the access token.
    log.error("upload failed", { kind: opts.kind, reason: safeErrorMessage(error) });
    return { error: "The upload did not go through. Try again." };
  }
}

/** Remove a stored file. Used when a document is replaced. */
export async function deleteDocument(url: string | null | undefined): Promise<void> {
  if (!url || !uploadsConfigured()) return;
  try {
    await del(url);
  } catch (error) {
    // A leaked blob is a rounding error; failing the request the user actually
    // made because cleanup failed is not.
    log.warn("upload delete failed", { reason: safeErrorMessage(error) });
  }
}

function extensionFor(type: string): string {
  if (type === "image/png") return "png";
  if (type === "image/webp") return "webp";
  if (type === "image/heic") return "heic";
  return "jpg";
}

/**
 * Only ever serve a document URL to someone entitled to it.
 *
 * A thin function rather than reading the column directly, so that the day this
 * moves behind signed URLs there is exactly one place to change — and so that
 * `grep documentUrl` finds every consumer.
 */
export function documentUrl(stored: string | null | undefined): string | null {
  if (!stored) return null;
  if (!stored.startsWith("https://")) return null;
  return stored;
}

export const uploadsBaseUrl = env.appUrl;
