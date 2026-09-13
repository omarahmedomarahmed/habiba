import "server-only";

import { createHash, randomBytes } from "node:crypto";

import { cookies, headers } from "next/headers";
import { and, eq, isNull } from "drizzle-orm";

import { audit } from "@/lib/audit";
import { controlDb } from "@/lib/db";
import { authSessions, users } from "@/lib/db/schema";
import { env } from "@/lib/env";
import { log, ref } from "@/lib/logger";
import { SESSION_COOKIE } from "@/lib/routing";

import type { AuthedKey } from "./keys";

/**
 * 🔴 42.3 / 55.9 — THE LAUNCH. THERE STAYS EXACTLY ONE WAY TO BE SIGNED IN.
 *
 * > *A launch mints a short-lived `auth_sessions` row with `partner_id` and
 * > `created_via`, so every existing screen works unchanged and the audit names the
 * > partner.*
 *
 * ## 🔴 Why this beats the obvious alternative, which is a second session mechanism
 *
 * A separate credential for embedded clinicians would mean every guard in the product
 * growing an "or a partner launch" branch: `requireUser`, `requireVerified`,
 * `requireRole`, `accessFor`, and the forty-odd pages that call them. The day one of
 * them forgets is the day a widget reaches a screen it should not, and the failure is
 * silent because the forgotten branch is the permissive one.
 *
 * So a launched clinician IS signed in. Ordinarily. With the same cookie, the same
 * `getActor`, the same everything, and a row that remembers where they came from and
 * expires sooner.
 *
 * ## 🔴 THE CLINICIAN MUST ALREADY EXIST AND BE VERIFIED
 *
 * A launch does not create an account and cannot. §7's second hard rule is that a grant
 * is only ever held by a clinician whose verification is approved, in the database; a
 * launch that could mint an unverified clinician would be that rule bypassed by an
 * integration, which is C267's shape in a different sprint.
 *
 * ## 🔴 SHORT-LIVED, and shorter than an ordinary session on purpose
 *
 * An ordinary session lasts eight hours because a clinician works a day. A launched
 * session lasts one, because the clinician is inside somebody else's product and will
 * be launched again next time: a long-lived session minted by an API call is a
 * credential a partner's bug can leave lying around.
 */

const LAUNCH_MS = 60 * 60 * 1000;

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export type LaunchResult =
  | { ok: true; redirectTo: string }
  | { error: string; status: 403 | 404 };

export async function launchClinician(input: {
  key: AuthedKey;
  clinicianEmail: string;
  /** Where in our product the widget wants them. Validated, never followed blindly. */
  target?: string;
}): Promise<LaunchResult> {
  const [clinician] = await controlDb
    .select({ id: users.id, verificationStatus: users.verificationStatus })
    .from(users)
    .where(
      and(eq(users.email, input.clinicianEmail.trim().toLowerCase()), isNull(users.deletedAt)),
    )
    .limit(1);

  if (!clinician) return { error: "No such clinician.", status: 404 };

  if (clinician.verificationStatus !== "verified") {
    return { error: "That clinician is not verified with us.", status: 403 };
  }

  const token = randomBytes(32).toString("base64url");
  const hdrs = await headers();

  await controlDb.insert(authSessions).values({
    userId: clinician.id,
    tokenHash: hashToken(token),
    absoluteExpiresAt: new Date(Date.now() + LAUNCH_MS),
    userAgent: hdrs.get("user-agent")?.slice(0, 300) ?? null,
    /* 🔴 42.7 — both, so the audit can say "their server, on behalf of Dr X". */
    partnerId: input.key.partnerId,
    createdVia: "partner_launch",
  });

  const store = await cookies();
  store.set(SESSION_COOKIE, token, {
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
    reason: `key ${input.key.keyId}`,
  });

  log.info("clinician launched from a partner", { partner: ref(input.key.partnerId) });

  return { ok: true, redirectTo: safeTarget(input.target) };
}

/**
 * 🔴 THE TARGET IS AN ALLOW LIST, NOT A VALIDATOR.
 *
 * A partner supplying where to send a clinician is an open redirect waiting to happen,
 * and the usual defence (reject anything with a scheme or a `//`) is a blocklist that
 * somebody eventually gets wrong. So: four destinations by name, and anything else is
 * the dashboard.
 *
 * 🔴 42.5 — AND NONE OF THEM IS A VIDEO ROOM. *The embedded widget: no video by
 * default.* A partner embedding us has their own video; launching a clinician straight
 * into our room would put two video products on one screen and make the patient's
 * consent question arrive in the wrong product.
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
