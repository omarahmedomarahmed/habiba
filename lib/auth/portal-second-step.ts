import "server-only";

import { audit } from "@/lib/audit";
import { env } from "@/lib/env";
import type { MessageKey } from "@/lib/i18n/messages";
import { issueChallenge, readChallenge, type ChallengePortal } from "./challenge";
import { checkFactor, confirmFactorCode, factorStatus, pendingFactor, removeFactor, startFactor } from "./second-factor";

/**
 * DD-2 B2.4: a clinic manager's or a partner user's authenticator app.
 *
 * Optional (founder decision pending on making it mandatory). Once enrolled,
 * the sign-in action answers a right password with a challenge, not a
 * session, and only a right code from the app (or a recovery code) turns the
 * challenge into a session.
 */

function who(portal: ChallengePortal, id: string) {
  return portal === "clinic"
    ? { clinicManagerId: id, resourceType: "clinic_manager" }
    : { clinicManagerId: null, resourceType: "partner_user" };
}

async function record(portal: ChallengePortal, id: string, action: string, reason: string): Promise<void> {
  const { clinicManagerId, resourceType } = who(portal, id);
  await audit({ actor: null, clinicManagerId, category: "auth", action, resourceType, resourceId: id, reason });
}

/** After a right password: a challenge when this account has an app, nothing when it does not. */
export async function challengeAfterPassword(portal: ChallengePortal, id: string): Promise<string | null> {
  const status = await factorStatus({ kind: portal, id });
  return status.enrolled ? issueChallenge(env.authSecret, portal, id) : null;
}

/** The code against the challenge: the account to open a session for, or why not. */
export async function passPortalChallenge(
  portal: ChallengePortal,
  challenge: unknown,
  typed: string,
): Promise<{ ok: true; id: string } | { ok: false; error: MessageKey; expired?: boolean }> {
  const id = readChallenge(env.authSecret, portal, challenge);
  if (!id) return { ok: false, error: "auth.challengeExpired", expired: true };
  const result = await checkFactor({ kind: portal, id }, typed.trim().slice(0, 40));
  if (!result.ok) {
    await record(portal, id, "second_factor.failed", `${result.method}: ${result.reason}`);
    return { ok: false, error: result.error };
  }
  await record(portal, id, "second_factor.passed", result.method);
  return { ok: true, id };
}

/* ---------------------------------------------- their own settings -- */

export async function portalFactorView(portal: ChallengePortal, id: string, account: string) {
  const status = await factorStatus({ kind: portal, id });
  const pending = status.enrolled ? null : await pendingFactor({ kind: portal, id }, account).catch(() => null);
  return { status, pending };
}

export async function startPortalFactor(portal: ChallengePortal, id: string) {
  return startFactor({ kind: portal, id });
}

export async function confirmPortalFactor(portal: ChallengePortal, id: string, typed: string) {
  const result = await confirmFactorCode({ kind: portal, id }, typed);
  if (!result.ok) {
    await record(portal, id, "second_factor.failed", `enrolment: ${result.reason}`);
    return { ok: false as const, error: result.error };
  }
  /* The success row is the caller's, beside the act, so each portal's action file records what it did. */
  return result;
}

/** Turned off by its owner only with a code from it, so a stolen session alone cannot. */
export async function removePortalFactor(portal: ChallengePortal, id: string, typed: string) {
  const check = await checkFactor({ kind: portal, id }, typed);
  if (!check.ok) {
    await record(portal, id, "second_factor.failed", `${check.method}: ${check.reason}`);
    return { ok: false as const, error: check.error };
  }
  await removeFactor({ kind: portal, id });
  return { ok: true as const, method: check.method };
}
