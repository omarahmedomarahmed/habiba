import "server-only";

import { randomBytes } from "node:crypto";

import { cookies } from "next/headers";

import { decryptSecret, encryptSecret } from "@/lib/crypto/secretbox";
import { env } from "@/lib/env";
import type { EhrVendor } from "@/lib/db/schema";

/**
 * 🔴 43.2 — THE HALF-FINISHED CONNECTION, CARRIED ACROSS THE REDIRECT.
 *
 * An OAuth flow leaves and comes back. Between those two moments we have to remember the PKCE
 * verifier (which must never reach the browser in readable form), the vendor, and the FHIR base
 * URL the operator typed.
 *
 * ## 🔴 A COOKIE RATHER THAN A TABLE, AND SEALED RATHER THAN SIGNED
 *
 * A table would mean a migration for a row whose whole life is thirty seconds, plus a sweep to
 * clean up the ones nobody finished. A cookie is the right size for the problem.
 *
 * It is SEALED with `secretbox` rather than merely signed, because the verifier is inside it: a
 * signed cookie is readable by whoever holds it, and a PKCE verifier a browser can read is a PKCE
 * verifier that no longer protects the code travelling through that same browser. Sealing costs
 * nothing here and the flow already requires a sealing key to store the token at the end.
 *
 * ## 🔴 AND THE ORGANISATION IS **NOT** TRUSTED FROM THIS COOKIE
 *
 * It is in here, and the callback re-derives it from the live session anyway and refuses a
 * mismatch. That looks redundant and is not: a cookie is a value a caller holds, and the thing it
 * would decide is WHICH ORGANISATION a hospital's credential gets attached to. Getting that wrong
 * once means one practice's Epic token stored under another practice's row, which is every
 * clinician in the second practice filing notes into the first one's charts.
 *
 * So the cookie carries it for the mismatch check, and the session decides.
 */

const COOKIE = "24t_ehr_pending";
/** Long enough for a hospital's consent screen, short enough that a stale one is not reusable. */
const TTL_SECONDS = 15 * 60;

export type Pending = {
  state: string;
  verifier: string;
  vendor: EhrVendor;
  fhirBaseUrl: string;
  tokenUrl: string;
  issuer: string;
  /** For the mismatch check on the way back. Never the authority. */
  organizationId: string;
  expiresAt: number;
};

export async function putPending(input: Omit<Pending, "state" | "expiresAt">): Promise<string> {
  const state = randomBytes(24).toString("base64url");

  const payload: Pending = {
    ...input,
    state,
    expiresAt: Date.now() + TTL_SECONDS * 1000,
  };

  const store = await cookies();
  store.set(COOKIE, encryptSecret(JSON.stringify(payload)), {
    httpOnly: true,
    secure: env.isProduction,
    /*
     * 🔴 `lax`, and it has to be, because the hospital redirects the browser back to us: a
     * `strict` cookie is not sent on a cross-site navigation, so the callback would arrive with
     * nothing and the flow would fail every time in production and work in local testing.
     */
    sameSite: "lax",
    path: "/",
    maxAge: TTL_SECONDS,
  });

  return state;
}

/**
 * Read it back, and CONSUME it.
 *
 * 🔴 Deleted whether or not it validates, so one authorisation code can be redeemed once. A
 * pending cookie that survived a failed callback would let a captured code be retried.
 */
export async function takePending(): Promise<Pending | null> {
  const store = await cookies();
  const sealed = store.get(COOKIE)?.value;
  store.delete(COOKIE);

  if (!sealed) return null;

  try {
    const payload = JSON.parse(decryptSecret(sealed)) as Pending;
    if (typeof payload?.state !== "string" || typeof payload?.verifier !== "string") return null;
    if (typeof payload.expiresAt !== "number" || payload.expiresAt < Date.now()) return null;
    return payload;
  } catch {
    /* A cookie sealed with a key we no longer hold, or tampered with. Either way, not a flow. */
    return null;
  }
}
