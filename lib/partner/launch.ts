import "server-only";

import { createHash, randomBytes } from "node:crypto";

import { cookies, headers } from "next/headers";
import { and, eq, gt, isNull, lt } from "drizzle-orm";

import { audit } from "@/lib/audit";
import { controlDb } from "@/lib/db";
import {
  authSessions,
  organizations,
  partnerLaunchTokens,
  users,
  LAUNCH_TOKEN_TTL_SECONDS,
} from "@/lib/db/schema";
import { verifiedFlag } from "@/lib/data/verified";
import { env } from "@/lib/env";
import { log, ref } from "@/lib/logger";
import { SESSION_COOKIE } from "@/lib/routing";

/* 🔴 66.4 — a launch belongs to a PARTNER, so the key must have one. */
import type { PartnerKey } from "./route";

/**
 * 🔴 42.3 / 55.9 — THE LAUNCH. THERE STAYS EXACTLY ONE WAY TO BE SIGNED IN.
 *
 * > *A launch mints a short-lived `auth_sessions` row with `partner_id` and
 * > `created_via`, so every existing screen works unchanged and the audit names the
 * > partner.*
 *
 * ## 🔴 WHY THIS BEATS THE OBVIOUS ALTERNATIVE, WHICH IS A SECOND SESSION MECHANISM
 *
 * A separate credential for embedded clinicians would mean every guard in the product
 * growing an "or a partner launch" branch: `requireUser`, `requireVerified`, `requireRole`,
 * `accessFor`, and the forty-odd pages that call them. The day one of them forgets is the day
 * a widget reaches a screen it should not, and the failure is silent because the forgotten
 * branch is the permissive one.
 *
 * So a launched clinician IS signed in. Ordinarily. With the same cookie, the same `getActor`,
 * the same everything, and a row that remembers where they came from and expires sooner.
 *
 * ## 🔴 IT IS TWO STEPS, AND THE FIRST VERSION OF THIS FILE COULD NOT WORK AT ALL
 *
 * `POST /api/partner/v1/launch` is called by the PARTNER'S SERVER. The first version minted
 * the session and called `cookies().set()` there, which attaches `Set-Cookie` to the response
 * of the request being handled — and that response goes to the partner's server. The partner
 * would have held the clinician's session cookie; the clinician's browser would never have
 * received one. A 200, a URL that lands on a sign-in form, and a live session credential in
 * somebody else's HTTP client.
 *
 * So: `launchClinician` mints a two-minute single-use TOKEN and returns a URL.
 * `redeemLaunch` runs on the clinician's own browser navigation, and the cookie is set on the
 * response to THAT request, which is the only response that reaches them.
 *
 * ## 🔴 AND THE URL OPENS A TOP-LEVEL WINDOW, NOT AN IFRAME
 *
 * `next.config.ts` sends `X-Frame-Options: DENY` on every response, and the session cookie is
 * `sameSite: "lax"`, so a frame on a partner's origin would neither render nor carry a
 * cookie. Both could be relaxed per partner; neither should be. `frame-ancestors` maintained
 * per partner would put a clinical record inside a document a partner's page controls, which
 * is clickjacking over a chart, and `sameSite: "none"` would make every launched session
 * reachable cross-origin when the product's other CSRF defence is the same-origin check.
 *
 * A new window is still 55.9's *their clinician sees our panel inside their product* in the
 * sense that matters: a button in their workflow, no second sign-in, no credential of ours in
 * their hands. It is not an `<iframe>`, and that difference is named on `/developers` rather
 * than left for an integrator to discover.
 *
 * ## 🔴 THE CLINICIAN MUST ALREADY EXIST AND BE VERIFIED
 *
 * A launch does not create an account and cannot. §7's second hard rule is that a grant is
 * only ever held by a clinician whose verification is approved, in the database; a launch that
 * could mint an unverified clinician would be that rule bypassed by an integration, which is
 * C267's shape in a different sprint.
 *
 * ## 🔴 SHORT-LIVED, and shorter than an ordinary session on purpose
 *
 * An ordinary session lasts eight hours because a clinician works a day. A launched session
 * lasts one, because the clinician is inside somebody else's product and will be launched
 * again next time: a long-lived session minted by an API call is a credential a partner's bug
 * can leave lying around.
 */

const LAUNCH_MS = 60 * 60 * 1000;

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export type LaunchResult = { ok: true; url: string } | { error: string; status: 403 | 404 };

/**
 * Step one, on the partner's server. Mints a token, sets NO cookie, returns a URL.
 *
 * 🔴 There is no `cookies()` call in this function and there must never be one: the response
 * it contributes to is the partner's, not the clinician's.
 */
export async function launchClinician(input: {
  key: PartnerKey;
  clinicianEmail: string;
  /** Where in our product the widget wants them. Resolved through the allow list NOW. */
  target?: string;
}): Promise<LaunchResult> {
  /*
   * 🔴 THE CLINICIAN MUST BE ONE OF THIS PARTNER'S, AND THE FIRST VERSION DID NOT CHECK.
   *
   * It looked up the email, confirmed the clinician was verified, and minted. Any key with
   * `record:read` could therefore name ANY verified clinician in the product and get a working
   * session as them, on their own caseload, with their own notes and transcripts in it. A
   * partner sitting in front of that browser reaches every clinical word that clinician can.
   *
   * Nothing about the response would have looked wrong. The audit would have recorded a launch
   * with the right key and the right user, because that is exactly what happened.
   *
   * The association already exists and 0075 already migrated it: `organizations.partner_id`
   * with `billing_mode = 'partner_billed'` is 42.6's statement that this practice is on this
   * partner's account, set by an operator rather than by a caller. So the join IS the check,
   * in the WHERE, and a clinician who is not on this partner's account simply does not match.
   *
   * 🔴 And it is the same 404 either way. "That clinician exists but is not yours" tells a
   * partner which therapists are in the product, which is a directory answered one email at a
   * time, and refusing to build a directory is most of this sprint.
   */
  /*
   * 🔴 A SANDBOX KEY SIGNS NOBODY IN. It is self-serve and needs no approval,
   * and a launch is a working session as a real clinician on their real
   * caseload. Only a live key, which an operator approved, may do that.
   */
  if (input.key.environment !== "live") {
    return { error: "A sandbox key cannot sign a clinician in. Use your live key.", status: 403 };
  }

  const [clinician] = await controlDb
    .select({ id: users.id, verified: verifiedFlag() })
    .from(users)
    .innerJoin(organizations, eq(organizations.id, users.organizationId))
    .where(
      and(
        eq(users.email, input.clinicianEmail.trim().toLowerCase()),
        isNull(users.deletedAt),
        eq(organizations.partnerId, input.key.partnerId),
        eq(organizations.billingMode, "partner_billed"),
      ),
    )
    .limit(1);

  if (!clinician) return { error: "No such clinician.", status: 404 };

  if (!clinician.verified) {
    return { error: "That clinician is not verified with us.", status: 403 };
  }

  const token = randomBytes(32).toString("base64url");

  await controlDb.insert(partnerLaunchTokens).values({
    partnerId: input.key.partnerId,
    userId: clinician.id,
    keyId: input.key.keyId,
    tokenHash: hashToken(token),
    /*
     * 🔴 Resolved through the allow list HERE, so what is stored is one of four known paths.
     * Storing the caller's string and resolving on redemption would put an unvalidated
     * redirect target in a row, one refactor away from being followed.
     */
    target: safeTarget(input.target),
    expiresAt: new Date(Date.now() + LAUNCH_TOKEN_TTL_SECONDS * 1000),
  });

  log.info("partner launch token minted", { partner: ref(input.key.partnerId) });

  return { ok: true, url: `${env.appUrl}/api/partner/launch?token=${token}` };
}

export type RedeemResult = { ok: true; redirectTo: string } | { error: string };

/**
 * Step two, on the clinician's own browser navigation. Claims the token and signs them in.
 *
 * 🔴 THE CLAIM IS A CONDITIONAL UPDATE, NOT A READ THEN A WRITE.
 *
 * `used_at IS NULL` and `expires_at > now()` are in the WHERE, and the row is returned only
 * if the UPDATE matched. Two browsers racing on one URL therefore produce one session and one
 * refusal; a read-then-write would produce two sessions and no error.
 */
export async function redeemLaunch(token: string): Promise<RedeemResult> {
  if (!token) return { error: "That launch link is not valid." };

  const [claimed] = await controlDb
    .update(partnerLaunchTokens)
    .set({ usedAt: new Date() })
    .where(
      and(
        eq(partnerLaunchTokens.tokenHash, hashToken(token)),
        isNull(partnerLaunchTokens.usedAt),
        gt(partnerLaunchTokens.expiresAt, new Date()),
      ),
    )
    .returning({
      partnerId: partnerLaunchTokens.partnerId,
      userId: partnerLaunchTokens.userId,
      keyId: partnerLaunchTokens.keyId,
      target: partnerLaunchTokens.target,
    });

  /* One message for expired, used and never-existed. Which of the three it was is a fact
     about a partner's traffic, and telling them apart makes this a token oracle. */
  if (!claimed) return { error: "That launch link has expired. Open it again from your system." };

  /*
   * 🔴 Re-checked at redemption, not only at minting.
   *
   * Two minutes is short but not zero, and the thing that can change inside it is the one
   * thing that must not be stale: a clinician suspended or unverified between the partner's
   * call and the navigation would otherwise be signed in on a token minted while they were
   * still allowed.
   */
  const [clinician] = await controlDb
    .select({ id: users.id, verified: verifiedFlag() })
    .from(users)
    .innerJoin(organizations, eq(organizations.id, users.organizationId))
    .where(
      and(
        eq(users.id, claimed.userId),
        isNull(users.deletedAt),
        /* 🔴 The SAME two conditions the mint checked, re-asserted. A clinician whose
           practice left this partner's account inside the window must not be launched on a
           token that was valid when it was minted. */
        eq(organizations.partnerId, claimed.partnerId),
        eq(organizations.billingMode, "partner_billed"),
      ),
    )
    .limit(1);

  if (!clinician || !clinician.verified) {
    return { error: "That clinician can no longer be signed in." };
  }

  const sessionToken = randomBytes(32).toString("base64url");
  const hdrs = await headers();

  await controlDb.insert(authSessions).values({
    userId: clinician.id,
    tokenHash: hashToken(sessionToken),
    absoluteExpiresAt: new Date(Date.now() + LAUNCH_MS),
    userAgent: hdrs.get("user-agent")?.slice(0, 300) ?? null,
    /* 🔴 42.7 — both, so the audit can say "their server, on behalf of Dr X". */
    partnerId: claimed.partnerId,
    createdVia: "partner_launch",
  });

  /* 🔴 THIS is the response that reaches the clinician's browser, so this is where the
     cookie belongs. `lax` works because the navigation that carries it is top-level. */
  const store = await cookies();
  store.set(SESSION_COOKIE, sessionToken, {
    httpOnly: true,
    secure: env.isProduction,
    sameSite: "lax",
    path: "/",
    maxAge: Math.floor(LAUNCH_MS / 1000),
  });

  await audit({
    actor: null,
    category: "auth",
    action: "partner.launch",
    resourceType: "user",
    resourceId: clinician.id,
    reason: claimed.keyId ? `key ${claimed.keyId}` : "partner launch",
  });

  log.info("clinician launched from a partner", { partner: ref(claimed.partnerId) });

  return { ok: true, redirectTo: claimed.target };
}

/**
 * 🔴 THE TARGET IS AN ALLOW LIST, NOT A VALIDATOR.
 *
 * A partner supplying where to send a clinician is an open redirect waiting to happen, and
 * the usual defence (reject anything with a scheme or a `//`) is a blocklist that somebody
 * eventually gets wrong. So: four destinations by name, and anything else is the dashboard.
 *
 * 🔴 42.5 — AND NONE OF THEM IS A VIDEO ROOM. *The embedded widget: no video by default.* A
 * partner embedding us has their own video; launching a clinician straight into our room
 * would put two video products on one screen and make the patient's consent question arrive
 * in the wrong product.
 */
const LAUNCH_TARGETS: Record<string, string> = {
  dashboard: "/dashboard",
  patients: "/patients",
  sessions: "/sessions",
  notes: "/notes",
};

function safeTarget(target: string | undefined): string {
  return LAUNCH_TARGETS[(target ?? "dashboard").trim()] ?? "/dashboard";
}

/** The targets a partner may name, for the docs page to print from one source. */
export const PARTNER_LAUNCH_TARGETS = Object.keys(LAUNCH_TARGETS);

/**
 * 🔴 Delete expired launch tokens. Called from the cron, beside the webhook drain.
 *
 * Every row this removes was already dead: `redeemLaunch` requires `expires_at > now()` and
 * `used_at IS NULL`, so an unswept token opens nothing. It is deleted anyway because the row
 * NAMES A CLINICIAN and the key that asked about them, and kept for ever it becomes a log of
 * which clinicians a partner launched and when, sitting in a table nothing reads. `audit_log`
 * is where that question is answered deliberately, with retention somebody chose.
 *
 * A day's grace rather than at expiry, so a support question about a launch that failed this
 * morning still has a row to look at.
 */
export async function sweepExpiredLaunches(): Promise<number> {
  const gone = await controlDb
    .delete(partnerLaunchTokens)
    .where(lt(partnerLaunchTokens.expiresAt, new Date(Date.now() - 24 * 60 * 60 * 1000)))
    .returning({ id: partnerLaunchTokens.id });

  return gone.length;
}
