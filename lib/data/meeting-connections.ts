import "server-only";

import { and, desc, eq, isNull } from "drizzle-orm";

import { audit } from "@/lib/audit";
import type { Actor } from "@/lib/auth/session";
import { decryptSecret, encryptSecret } from "@/lib/crypto/secretbox";
import { controlDb } from "@/lib/db";
import { meetingConnections, type MeetingProvider } from "@/lib/db/schema";
import { log } from "@/lib/logger";

/**
 * A clinician's connected meeting accounts. PLAN.md 41.3.
 *
 * Control-plane rather than regional: a connection belongs to a `users` row,
 * which is staff rather than clinical data, and the same clinician's patients
 * may sit in different regions.
 *
 * ## 🔴 Nothing here returns a token to a caller that renders
 *
 * `listConnections` returns the provider, the account label and the dates.
 * There is no shape in which a sealed credential reaches a component, and
 * `accessTokenFor` is the single function that opens one — used by meeting
 * creation on the server and by nothing else. 41.3: a therapist never sees an
 * API key, and the way to keep that true is for there to be no path.
 */

export type ConnectionView = {
  id: string;
  provider: MeetingProvider;
  accountLabel: string | null;
  connectedAt: Date;
};

/** What the settings page renders. No credential in the shape at all. */
export async function listConnections(actor: Actor): Promise<ConnectionView[]> {
  const rows = await controlDb
    .select({
      id: meetingConnections.id,
      provider: meetingConnections.provider,
      accountLabel: meetingConnections.externalAccountLabel,
      connectedAt: meetingConnections.connectedAt,
    })
    .from(meetingConnections)
    .where(
      and(eq(meetingConnections.userId, actor.userId), isNull(meetingConnections.revokedAt)),
    )
    .orderBy(desc(meetingConnections.connectedAt));

  return rows;
}

/**
 * Store a connection the OAuth callback just completed.
 *
 * 🔴 Sealing happens BEFORE the write, and `encryptSecret` throws with no key
 * configured. So a deployment without `TOKEN_ENCRYPTION_KEY` cannot end up
 * with a plaintext refresh token in a row: the connection simply fails, and
 * the integrations page said it would.
 *
 * An existing live connection for the same provider is revoked first rather
 * than updated, so reconnecting a different Zoom account leaves a record of
 * the one that came before. `meeting_connections_live_unique` is what makes
 * skipping that a database error instead of two live rows.
 */
export async function saveConnection(input: {
  actor: Actor;
  provider: MeetingProvider;
  accessToken: string;
  refreshToken?: string | null;
  expiresAt?: Date | null;
  accountLabel?: string | null;
}): Promise<{ ok?: boolean; error?: string }> {
  let sealedAccess: string;
  let sealedRefresh: string | null;
  try {
    sealedAccess = encryptSecret(input.accessToken);
    sealedRefresh = input.refreshToken ? encryptSecret(input.refreshToken) : null;
  } catch (error) {
    return { error: error instanceof Error ? error.message : "That connection could not be stored." };
  }

  await revokeConnection(input.actor, input.provider);

  await controlDb.insert(meetingConnections).values({
    userId: input.actor.userId,
    organizationId: input.actor.organizationId,
    provider: input.provider,
    accessTokenSealed: sealedAccess,
    refreshTokenSealed: sealedRefresh,
    expiresAt: input.expiresAt ?? null,
    externalAccountLabel: input.accountLabel ?? null,
  });

  await audit({
    actor: input.actor,
    category: "auth",
    action: "meeting.connect",
    resourceType: "user",
    resourceId: input.actor.userId,
  });

  log.info("meeting account connected", { provider: input.provider });
  return { ok: true };
}

/**
 * Disconnect.
 *
 * 🔴 The credential is CLEARED, not merely marked revoked. A row that says
 * "revoked" and still carries a usable refresh token is worse than one that
 * was never revoked, because everybody reading it believes otherwise, and
 * `meeting_connections_revoked_is_empty` refuses the write that would do it.
 *
 * The row itself stays: a session recorded through a connection that has since
 * been removed still has to be explainable a year later.
 */
export async function revokeConnection(
  actor: Actor,
  provider: MeetingProvider,
): Promise<boolean> {
  const revoked = await controlDb
    .update(meetingConnections)
    .set({
      revokedAt: new Date(),
      accessTokenSealed: "",
      refreshTokenSealed: null,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(meetingConnections.userId, actor.userId),
        eq(meetingConnections.provider, provider),
        isNull(meetingConnections.revokedAt),
      ),
    )
    .returning({ id: meetingConnections.id });

  if (revoked.length > 0) {
    await audit({
      actor,
      category: "auth",
      action: "meeting.disconnect",
      resourceType: "user",
      resourceId: actor.userId,
    });
  }

  return revoked.length > 0;
}

/**
 * 🔴 The ONE function that opens a sealed credential.
 *
 * Server-side, for meeting creation, and never handed further. If this ever
 * appears in a component's import list, the rule in this file's header has
 * been broken and `verify:sprint41` says so.
 */
export async function accessTokenFor(
  userId: string,
  provider: MeetingProvider,
): Promise<string | null> {
  const [row] = await controlDb
    .select({
      sealed: meetingConnections.accessTokenSealed,
      expiresAt: meetingConnections.expiresAt,
    })
    .from(meetingConnections)
    .where(
      and(
        eq(meetingConnections.userId, userId),
        eq(meetingConnections.provider, provider),
        isNull(meetingConnections.revokedAt),
      ),
    )
    .limit(1);

  if (!row || !row.sealed) return null;

  /*
   * An expired access token is a null rather than a refresh here.
   *
   * Refreshing is a provider-specific round trip and belongs with the provider
   * adapter; what this function must not do is hand back a token it knows is
   * dead and let the caller discover it three layers away.
   */
  if (row.expiresAt && row.expiresAt.getTime() <= Date.now()) return null;

  try {
    return decryptSecret(row.sealed);
  } catch {
    // A credential that will not open is a credential we do not have. Saying
    // so is better than throwing into a session that is about to start.
    return null;
  }
}
