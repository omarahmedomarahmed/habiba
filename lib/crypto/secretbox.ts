import "server-only";

import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

import { env } from "@/lib/env";

/**
 * Reversible encryption for secrets we have to use again. PLAN.md 41.3.
 *
 * ## 🔴 Why this file did not exist until sprint 41
 *
 * Every secret in this product until now is either **hashed** — passwords,
 * session tokens, the ingest token, the reset code — or held in the
 * environment and never in a row. That is not an oversight, it is the better
 * design: a hash cannot be stolen and replayed, and a value nobody can decrypt
 * is a value nobody can leak.
 *
 * An OAuth refresh token breaks the pattern because it has to be **used**. We
 * present it to Zoom months later to mint a new access token, so it cannot be
 * hashed, and it cannot live in the environment because there is one per
 * clinician. It has to be stored, and it has to come back.
 *
 * So this is the one reversible primitive in the codebase, and it is
 * deliberately small: AES-256-GCM, a fresh 96-bit nonce per message,
 * authenticated so a tampered ciphertext fails to open rather than decrypting
 * to rubbish. No key derivation, no modes, no options. The key is 32 bytes
 * from the environment and nothing else.
 *
 * ## 🔴 It fails CLOSED
 *
 * With no key configured, `encryptSecret` throws. It does not fall back to
 * base64, to the auth secret, or to storing the value as it is. A product that
 * silently keeps a clinician's Zoom refresh token in plaintext because an
 * environment variable was missing is worse than one that refuses to connect
 * Zoom at all, and the refusal is visible on the integrations page the same
 * hour rather than in a breach notification a year later.
 *
 * `meetingsConfigured()` is what the surfaces call so they can say so BEFORE
 * somebody tries.
 */

const VERSION = "v1";

/**
 * The key, or null.
 *
 * Read on each call rather than at module load: a verifier that sets the
 * variable and then imports this would otherwise get whatever the process
 * started with, which is the shape of bug that makes a security helper look
 * broken when it is not.
 */
function key(): Buffer | null {
  const raw = env.tokenEncryptionKey;
  if (!raw) return null;

  const bytes = Buffer.from(raw, "base64");
  /*
   * 🔴 A short key is a misconfiguration, not a weaker mode.
   *
   * Padding it out, hashing it up to length, or falling back to a different
   * cipher would all produce something that works and is not what the operator
   * thinks they configured. AES-256 takes 32 bytes.
   */
  if (bytes.length !== 32) {
    throw new Error(
      "TOKEN_ENCRYPTION_KEY must be exactly 32 bytes, base64 encoded. Generate one with: openssl rand -base64 32",
    );
  }
  return bytes;
}

/** Whether secrets can be stored at all. The surfaces ask before offering. */
export function secretsConfigured(): boolean {
  try {
    return key() !== null;
  } catch {
    // A key that is present and the wrong length is not configured either, and
    // saying "yes" here would offer a Connect button that throws on submit.
    return false;
  }
}

export function encryptSecret(plaintext: string): string {
  const k = key();
  if (!k) {
    throw new Error(
      "Refusing to store a credential with no TOKEN_ENCRYPTION_KEY configured. Set one, or leave the integration disconnected.",
    );
  }

  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", k, iv);
  const enciphered = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();

  return [
    VERSION,
    iv.toString("base64url"),
    tag.toString("base64url"),
    enciphered.toString("base64url"),
  ].join(".");
}

/**
 * Open a sealed secret.
 *
 * 🔴 Throws on anything that is not exactly right: a missing key, an unknown
 * version, a wrong shape, a failed tag. A decrypt that returns a partial or
 * garbled value would be handed to Zoom as a refresh token and produce an
 * authentication error three layers away from the cause.
 */
export function decryptSecret(sealed: string): string {
  const k = key();
  if (!k) throw new Error("No TOKEN_ENCRYPTION_KEY configured, so this credential cannot be read.");

  const [version, iv, tag, body] = sealed.split(".");
  if (version !== VERSION || !iv || !tag || !body) {
    throw new Error("That credential is not in a format this version understands.");
  }

  const decipher = createDecipheriv("aes-256-gcm", k, Buffer.from(iv, "base64url"));
  decipher.setAuthTag(Buffer.from(tag, "base64url"));

  return Buffer.concat([
    decipher.update(Buffer.from(body, "base64url")),
    decipher.final(),
  ]).toString("utf8");
}
