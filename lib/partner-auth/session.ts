import "server-only";

import { createHash, randomBytes } from "node:crypto";

import { cookies, headers } from "next/headers";
import { and, eq, gt, isNull } from "drizzle-orm";

import { controlDb } from "@/lib/db";
import { partnerAuthSessions, partnerUsers, partners } from "@/lib/db/schema";
import { env } from "@/lib/env";
import { PARTNER_COOKIE } from "@/lib/routing";
import type { PartnerRole, PartnerState } from "@/lib/db/schema";

/**
 * The partner developer's own session. PLAN.md 55.1, 55.2, 55.3, C264.
 *
 * ## 🔴 THE FIFTH AUTH MODULE, AND THE ARGUMENT IS THE SAME ONE FIVE TIMES
 *
 * `lib/auth` mints `Actor`s. An `Actor` carries an `organizationId` and a clinical
 * `Role`, and every clinical query in the product is scoped by that id. A developer at
 * another company holding one would be inside the tenancy boundary that separates
 * caseloads, which is the one thing the partner plane must never be.
 *
 * ## 🔴 WHAT A `PartnerActor` DOES NOT HAVE, AND WHY IT IS THE SPARSEST OF THE FIVE
 *
 * No `organizationId`. No `Role`. No `verificationStatus`. No region. And — unlike the
 * clinic manager's, which carries `clinicOrganizationId` because a clinic IS an
 * organisation (C259) — **no organisation id of any spelling at all**. A partner is not
 * a tenancy and never becomes one: the organisations their clinicians work in belong to
 * those clinicians, and a partner reaching one does it through a launched clinician's
 * ordinary session (42.3) rather than through anything on this type.
 *
 * So the sponsor's shape is the one this copies, not the clinic's. That is the right
 * ancestor: a sponsor is outside clinical tenancy, and so is a partner.
 *
 * ## 🔴 55.3 — A THERAPIST NEVER SEES AN API KEY, KEPT TRUE BY THIS FILE
 *
 * §7's rule is *a therapist holding an API key is a therapist who got lost in our
 * product*. Every key screen in the portal is behind `requirePartner`, which returns
 * this type, which no clinician session can produce: `authSessions` and
 * `partnerAuthSessions` are different tables read through different cookies. It is not a
 * permission somebody could grant a therapist by mistake, because there is no field to
 * set.
 *
 * ## 🔴 A HELD OR SUSPENDED PARTNER HAS NO PORTAL, in the WHERE clause
 *
 * 42.1's states, enforced the way the sponsor's and the clinic's are: not checked after
 * the read, but a condition of the row matching, so there is no branch to forget.
 * Suspending a partner closes their portal and stops their keys (`authenticateKey`
 * reads the same state). It reaches no session and no patient: a commercial dispute
 * with an integrator must never arrive in a room.
 */

const IDLE_MS = 30 * 60 * 1000;
const ABSOLUTE_MS = 8 * 60 * 60 * 1000;

export type PartnerActor = {
  partnerUserId: string;
  partnerId: string;
  /** What their company is called, for their own header. */
  partnerName: string;
  role: PartnerRole;
  email: string;
};

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export async function createPartnerSession(partnerUserId: string): Promise<string> {
  const token = randomBytes(32).toString("base64url");
  const hdrs = await headers();

  await controlDb.insert(partnerAuthSessions).values({
    partnerUserId,
    tokenHash: hashToken(token),
    absoluteExpiresAt: new Date(Date.now() + ABSOLUTE_MS),
    userAgent: hdrs.get("user-agent")?.slice(0, 300) ?? null,
  });

  const store = await cookies();
  store.set(PARTNER_COOKIE, token, {
    httpOnly: true,
    secure: env.isProduction,
    sameSite: "lax",
    path: "/",
    maxAge: Math.floor(ABSOLUTE_MS / 1000),
  });

  return token;
}

export async function getPartnerActor(): Promise<PartnerActor | null> {
  const store = await cookies();
  const token = store.get(PARTNER_COOKIE)?.value;
  if (!token) return null;

  const now = new Date();

  const [row] = await controlDb
    .select({
      partnerUserId: partnerUsers.id,
      partnerId: partners.id,
      partnerName: partners.name,
      role: partnerUsers.role,
      email: partnerUsers.email,
    })
    .from(partnerAuthSessions)
    .innerJoin(partnerUsers, eq(partnerUsers.id, partnerAuthSessions.partnerUserId))
    .innerJoin(partners, eq(partners.id, partnerUsers.partnerId))
    .where(
      and(
        eq(partnerAuthSessions.tokenHash, hashToken(token)),
        isNull(partnerAuthSessions.revokedAt),
        isNull(partnerUsers.deletedAt),
        gt(partnerAuthSessions.absoluteExpiresAt, now),
        gt(partnerAuthSessions.lastSeenAt, new Date(now.getTime() - IDLE_MS)),
        /* A held, suspended or closed partner has no portal. 42.1. */
        eq(partners.state, "active" as PartnerState),
      ),
    )
    .limit(1);

  if (!row) return null;

  await controlDb
    .update(partnerAuthSessions)
    .set({ lastSeenAt: now })
    .where(eq(partnerAuthSessions.tokenHash, hashToken(token)));

  return row;
}

export async function revokePartnerSession(): Promise<void> {
  const store = await cookies();
  const token = store.get(PARTNER_COOKIE)?.value;
  if (token) {
    await controlDb
      .update(partnerAuthSessions)
      .set({ revokedAt: new Date() })
      .where(eq(partnerAuthSessions.tokenHash, hashToken(token)));
  }
  store.delete(PARTNER_COOKIE);
}
