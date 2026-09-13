import "server-only";

import { createHash, randomBytes } from "node:crypto";

import { cookies, headers } from "next/headers";
import { and, eq, gt, isNull } from "drizzle-orm";

import { controlDb } from "@/lib/db";
import { sponsorAuthSessions, sponsorUsers, sponsors } from "@/lib/db/schema";
import { env } from "@/lib/env";
import { SPONSOR_COOKIE } from "@/lib/routing";
import type { SponsorRole, SponsorState } from "@/lib/db/schema";

/**
 * The sponsor's own session. PLAN.md 53.4, C230, C259, C264.
 *
 * ## 🔴 Its own module, and that is the whole point
 *
 * A sponsor is **never an `Actor`**. `lib/auth/session.ts` mints `Actor`s, which
 * carry an `organizationId` and a clinical `Role`, and every clinical query in
 * the product is scoped by that id. A sponsor with one would be a paying
 * employer inside the tenancy boundary that separates caseloads.
 *
 * So this is a third auth module beside `lib/auth` and `lib/patient-auth`,
 * shaped like the patient's for the same reasons and deliberately not sharing
 * a line with the clinician's. `verify:sprint53` asserts that
 * `lib/auth/guard.ts` does not contain the word sponsor.
 *
 * ## 🔴 What a `SponsorActor` deliberately does NOT have
 *
 * No `organizationId`, no `Role`, no `verificationStatus`, no region. Nothing
 * on this type can be passed to a function expecting an `Actor`, which is the
 * strongest form of C230: not a rule a guard enforces, a shape that does not
 * fit.
 */

const IDLE_MS = 30 * 60 * 1000;
const ABSOLUTE_MS = 8 * 60 * 60 * 1000;

export type SponsorActor = {
  sponsorUserId: string;
  sponsorId: string;
  /** What their organisation is called, for their own header. */
  sponsorName: string;
  kind: "company" | "university";
  role: SponsorRole;
  email: string;
};

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export async function createSponsorSession(sponsorUserId: string): Promise<string> {
  const token = randomBytes(32).toString("base64url");
  const hdrs = await headers();

  await controlDb.insert(sponsorAuthSessions).values({
    sponsorUserId,
    tokenHash: hashToken(token),
    absoluteExpiresAt: new Date(Date.now() + ABSOLUTE_MS),
    userAgent: hdrs.get("user-agent")?.slice(0, 300) ?? null,
  });

  const store = await cookies();
  store.set(SPONSOR_COOKIE, token, {
    httpOnly: true,
    secure: env.isProduction,
    sameSite: "lax",
    path: "/",
    maxAge: Math.floor(ABSOLUTE_MS / 1000),
  });

  return token;
}

/**
 * Resolve the cookie, or null.
 *
 * Every condition is in the WHERE clause rather than checked afterwards — a
 * revoked session, an expired one and an idle one all simply fail to match, so
 * there is no branch anybody can forget. The same construction as the patient's,
 * because it was right there.
 *
 * 🔴 A SUSPENDED OR CLOSED SPONSOR CANNOT SIGN IN, and that is in the WHERE
 * clause too. C235's crisis rule is about the PATIENT: suspending a sponsor must
 * never stand between a person and the crisis path, and it does not, because
 * nothing on the patient side reads this.
 */
export async function getSponsorActor(): Promise<SponsorActor | null> {
  const store = await cookies();
  const token = store.get(SPONSOR_COOKIE)?.value;
  if (!token) return null;

  const now = new Date();

  const [row] = await controlDb
    .select({
      sponsorUserId: sponsorUsers.id,
      sponsorId: sponsors.id,
      sponsorName: sponsors.name,
      kind: sponsors.kind,
      role: sponsorUsers.role,
      email: sponsorUsers.email,
      state: sponsors.state,
    })
    .from(sponsorAuthSessions)
    .innerJoin(sponsorUsers, eq(sponsorUsers.id, sponsorAuthSessions.sponsorUserId))
    .innerJoin(sponsors, eq(sponsors.id, sponsorUsers.sponsorId))
    .where(
      and(
        eq(sponsorAuthSessions.tokenHash, hashToken(token)),
        isNull(sponsorAuthSessions.revokedAt),
        isNull(sponsorUsers.deletedAt),
        gt(sponsorAuthSessions.absoluteExpiresAt, now),
        gt(sponsorAuthSessions.lastSeenAt, new Date(now.getTime() - IDLE_MS)),
        /* A held, suspended or closed sponsor has no portal. */
        eq(sponsors.state, "active" as SponsorState),
      ),
    )
    .limit(1);

  if (!row) return null;

  await controlDb
    .update(sponsorAuthSessions)
    .set({ lastSeenAt: now })
    .where(eq(sponsorAuthSessions.tokenHash, hashToken(token)));

  return {
    sponsorUserId: row.sponsorUserId,
    sponsorId: row.sponsorId,
    sponsorName: row.sponsorName,
    kind: row.kind,
    role: row.role,
    email: row.email,
  };
}

export async function revokeSponsorSession(): Promise<void> {
  const store = await cookies();
  const token = store.get(SPONSOR_COOKIE)?.value;
  if (token) {
    await controlDb
      .update(sponsorAuthSessions)
      .set({ revokedAt: new Date() })
      .where(eq(sponsorAuthSessions.tokenHash, hashToken(token)));
  }
  store.delete(SPONSOR_COOKIE);
}
