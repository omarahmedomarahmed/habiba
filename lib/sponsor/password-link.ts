import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";

import { env } from "@/lib/env";

/**
 * 🔴 W2-S05 — A COMPANY LOGIN'S RESET AND INVITE LINKS, WITH NO ROW BEHIND THEM.
 *
 * The token is `purpose.login.expiry.signature`, where the signature is an HMAC
 * with `AUTH_SECRET` over those three and the login's password hash as it
 * stands, the construction the domain mailbox link already uses. Setting a
 * password changes the hash, so the link that did it stops working: single use
 * without a column, and an expired link fails on its own date. Nothing is
 * stored that could leak, which is why W2-S05 needed no migration.
 *
 * Its own module so the construction can be read, and minted by a verifier,
 * without the database module that uses it.
 */

export const LINK_TTL_MS = {
  /* An hour: a reset is asked for by somebody who is at their screen. */
  reset: 60 * 60 * 1000,
  /* A week: an invitation waits in an inbox over a weekend. */
  invite: 7 * 24 * 60 * 60 * 1000,
} as const;

export type LinkPurpose = keyof typeof LINK_TTL_MS;

function signature(
  purpose: LinkPurpose,
  sponsorUserId: string,
  expiresMs: number,
  passwordHash: string | null,
): string {
  return createHmac("sha256", env.authSecret)
    .update(`sponsor-password:${purpose}:${sponsorUserId}:${expiresMs}:${passwordHash ?? ""}`)
    .digest("base64url");
}

/** `expiresMs` is for a verifier minting an expired link; the product takes the default. */
export function passwordLinkToken(input: {
  sponsorUserId: string;
  purpose: LinkPurpose;
  passwordHash: string | null;
  expiresMs?: number;
}): string {
  const expires = input.expiresMs ?? Date.now() + LINK_TTL_MS[input.purpose];
  const sig = signature(input.purpose, input.sponsorUserId, expires, input.passwordHash);
  return `${input.purpose}.${input.sponsorUserId}.${expires}.${sig}`;
}

/** The login a token names, if it is well formed and not expired. Not yet trusted. */
export function readPasswordLink(
  token: string,
): { purpose: LinkPurpose; sponsorUserId: string; expiresMs: number } | null {
  const [purpose, sponsorUserId, expires, sig] = token.split(".");
  if (!purpose || !sponsorUserId || !expires || !sig) return null;
  if (!(purpose in LINK_TTL_MS)) return null;
  if (!/^[0-9a-f-]{36}$/.test(sponsorUserId)) return null;
  const expiresMs = Number(expires);
  if (!Number.isFinite(expiresMs) || expiresMs <= Date.now()) return null;
  return { purpose: purpose as LinkPurpose, sponsorUserId, expiresMs };
}

/** 🔴 Constant time, against the password hash the login has NOW. */
export function passwordLinkMatches(token: string, passwordHash: string | null): boolean {
  const link = readPasswordLink(token);
  if (!link) return false;
  const expected = Buffer.from(
    signature(link.purpose, link.sponsorUserId, link.expiresMs, passwordHash),
  );
  const given = Buffer.from(token.split(".")[3] ?? "");
  return expected.length === given.length && timingSafeEqual(expected, given);
}
