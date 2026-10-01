import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * DD-2 B2.4: the half-way mark between a right password and a right code, for
 * the clinic and partner doors, which have no pending session to hold it.
 *
 * After the password, a portal account with an authenticator app gets this
 * signed token instead of a session; the code form sends it back. It names
 * the portal and the account, lives five minutes, and is useless without a
 * code from the app. Pure: the secret is passed in, so the tests hold it.
 */

export type ChallengePortal = "clinic" | "partner";

export const CHALLENGE_LIFETIME_MS = 5 * 60 * 1000;

function sign(secret: string, body: string): string {
  return createHmac("sha256", secret).update(`portal-2fa:${body}`).digest("base64url");
}

export function issueChallenge(secret: string, portal: ChallengePortal, id: string, now: number = Date.now()): string {
  const body = Buffer.from(JSON.stringify({ p: portal, i: id, e: now + CHALLENGE_LIFETIME_MS })).toString("base64url");
  return `${body}.${sign(secret, body)}`;
}

/** The account the challenge names, when it is genuine, for this portal, and in date. */
export function readChallenge(
  secret: string,
  portal: ChallengePortal,
  token: unknown,
  now: number = Date.now(),
): string | null {
  if (typeof token !== "string" || token.length > 1024) return null;
  const [body, mac, extra] = token.split(".");
  if (!body || !mac || extra !== undefined) return null;
  const expected = Buffer.from(sign(secret, body));
  const given = Buffer.from(mac);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;
  try {
    const claim = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as { p?: unknown; i?: unknown; e?: unknown };
    if (claim.p !== portal || typeof claim.i !== "string" || typeof claim.e !== "number") return null;
    return claim.e > now ? claim.i : null;
  } catch {
    return null;
  }
}
