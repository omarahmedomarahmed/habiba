import "server-only";

import { createHash, randomBytes } from "node:crypto";

import { and, eq, gt, isNull } from "drizzle-orm";

import { hashPassword, validatePassword } from "@/lib/auth/password";
import { controlDb } from "@/lib/db";
import { clinicAuthTokens, clinicManagers, organizations } from "@/lib/db/schema";
import { log, ref } from "@/lib/logger";

/**
 * 🔴 W2-C04 / W2-C05 — A CLINIC MANAGER SETS THEIR OWN PASSWORD, BY LINK.
 *
 * Two ways in, one mechanism:
 *
 *   - `invite`: the clinic admin adds a staff member, whose row is created with
 *     no password and so cannot sign in. The link is how THEY choose one. The
 *     admin types nobody's password, which they used to, into a form, and pass
 *     on out of band.
 *   - `password_reset`: a manager or staff member who forgot theirs asks at
 *     `/clinic/forgot-password` and gets a link by email, the clinician's shape.
 *
 * The raw token exists in the link and nowhere else: only its SHA-256 is
 * stored, a token works once, it expires, and using one ends every session the
 * principal holds, because a reset that leaves an attacker's session alive is
 * not a reset (the lesson `resetPassword` records for clinicians).
 */

export const INVITE_TTL_MS = 14 * 24 * 60 * 60 * 1000;
export const RESET_TTL_MS = 60 * 60 * 1000;

type Purpose = "invite" | "password_reset";

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/**
 * Issue a link, superseding any unused one of the same purpose, so a resent
 * invitation or a second reset request leaves exactly one link that works.
 */
export async function issueClinicToken(clinicManagerId: string, purpose: Purpose): Promise<string> {
  const now = new Date();
  await controlDb
    .update(clinicAuthTokens)
    .set({ usedAt: now })
    .where(
      and(
        eq(clinicAuthTokens.clinicManagerId, clinicManagerId),
        eq(clinicAuthTokens.purpose, purpose),
        isNull(clinicAuthTokens.usedAt),
      ),
    );

  const token = randomBytes(32).toString("base64url");
  await controlDb.insert(clinicAuthTokens).values({
    clinicManagerId,
    purpose,
    tokenHash: hashToken(token),
    expiresAt: new Date(now.getTime() + (purpose === "invite" ? INVITE_TTL_MS : RESET_TTL_MS)),
  });
  return token;
}

/** What a live link is for, so the page can greet the right person. Null when it is not live. */
export async function clinicTokenView(
  token: string,
): Promise<{ purpose: Purpose; email: string; clinicName: string } | null> {
  if (!token) return null;
  const [row] = await controlDb
    .select({
      purpose: clinicAuthTokens.purpose,
      email: clinicManagers.email,
      clinicName: organizations.name,
    })
    .from(clinicAuthTokens)
    .innerJoin(clinicManagers, eq(clinicManagers.id, clinicAuthTokens.clinicManagerId))
    .innerJoin(organizations, eq(organizations.id, clinicManagers.organizationId))
    .where(
      and(
        eq(clinicAuthTokens.tokenHash, hashToken(token)),
        isNull(clinicAuthTokens.usedAt),
        gt(clinicAuthTokens.expiresAt, new Date()),
        isNull(clinicManagers.deletedAt),
      ),
    )
    .limit(1);
  return row ?? null;
}

/**
 * Use a link. The token is CLAIMED first, in one guarded UPDATE, so two tabs
 * pressing the button cannot both set a password; then the password; then
 * every session the principal held is ended.
 */
export async function setClinicPasswordByToken(
  token: string,
  password: string,
): Promise<{ clinicManagerId?: string; error?: "password" | "link"; problem?: string }> {
  const problem = validatePassword(password);
  if (problem) return { error: "password", problem };
  const passwordHash = await hashPassword(password);

  const [claimed] = await controlDb
    .update(clinicAuthTokens)
    .set({ usedAt: new Date() })
    .where(
      and(
        eq(clinicAuthTokens.tokenHash, hashToken(token)),
        isNull(clinicAuthTokens.usedAt),
        gt(clinicAuthTokens.expiresAt, new Date()),
      ),
    )
    .returning({ clinicManagerId: clinicAuthTokens.clinicManagerId });

  if (!claimed) return { error: "link" };

  const [updated] = await controlDb
    .update(clinicManagers)
    .set({ passwordHash, updatedAt: new Date() })
    .where(and(eq(clinicManagers.id, claimed.clinicManagerId), isNull(clinicManagers.deletedAt)))
    .returning({ id: clinicManagers.id });

  if (!updated) return { error: "link" };

  const { revokeClinicSessionsFor } = await import("@/lib/data/clinic-team");
  await revokeClinicSessionsFor(updated.id);

  log.info("clinic manager set a password by link", { manager: ref(updated.id) });
  return { clinicManagerId: updated.id };
}

/**
 * A reset asked for by address. Says nothing either way to the caller: a
 * reply that differs for an unknown address lists which practices use us.
 * Returns the manager id only so the action can audit a real request.
 */
export async function requestClinicReset(email: string): Promise<string | null> {
  const address = email.trim().toLowerCase();
  if (!address.includes("@")) return null;

  const [manager] = await controlDb
    .select({ id: clinicManagers.id, email: clinicManagers.email })
    .from(clinicManagers)
    .where(and(eq(clinicManagers.email, address), isNull(clinicManagers.deletedAt)))
    .limit(1);
  if (!manager) return null;

  const token = await issueClinicToken(manager.id, "password_reset");
  const { env } = await import("@/lib/env");
  const { sendPasswordReset } = await import("@/lib/mail");
  await sendPasswordReset({
    to: manager.email,
    url: `${env.appUrl}/clinic/set-password?token=${token}`,
  });
  return manager.id;
}
