import "server-only";

import { randomInt } from "node:crypto";
import { and, desc, eq, isNull } from "drizzle-orm";

import { db } from "@/lib/db";
import { organizations, therapistCodes, therapistRadar, users } from "@/lib/db/schema";
import type { Actor } from "@/lib/auth/session";
import { env } from "@/lib/env";

/**
 * The clinic-wall QR code. PLAN.md 25.17, C120.
 *
 * ## 🔴 What a printed code is allowed to carry
 *
 * One clinician. Not a patient, not a record, not a session, not a pre-filled
 * phone number. A poster is public by construction: anybody who walks past can
 * photograph it, and a code that identified a patient would be a patient's
 * identity published on a wall.
 *
 * So scanning it does exactly one thing: it opens signup and says which
 * practice you are joining. Everything patient-specific still runs afterwards
 * through the ordinary door, behind a proven phone or email and the full name
 * challenge. The code is a convenience for typing a URL, and it has no
 * authority.
 *
 * ## Why it is revocable and why it is short
 *
 * Revocable because a poster outlives the person on it. A clinician who leaves
 * a practice cannot go round collecting the printouts, so the code has to be
 * killable from here, and a dead code is answered with a sentence rather than
 * a 404 (somebody is standing in a waiting room reading it).
 *
 * Short because the fallback for a camera that will not focus is typing it,
 * and the alphabet drops O, 0, I and 1 for the same reason.
 */

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const LENGTH = 8;

function mint(): string {
  let out = "";
  for (let i = 0; i < LENGTH; i += 1) out += ALPHABET[randomInt(ALPHABET.length)];
  return out;
}

export type WallCode = {
  id: string;
  code: string;
  label: string | null;
  createdAt: Date;
  revokedAt: Date | null;
  url: string;
};

export function codeUrl(code: string): string {
  return `${env.appUrl}/j/${code}`;
}

export async function listCodes(actor: Actor): Promise<WallCode[]> {
  const rows = await db
    .select({
      id: therapistCodes.id,
      code: therapistCodes.code,
      label: therapistCodes.label,
      createdAt: therapistCodes.createdAt,
      revokedAt: therapistCodes.revokedAt,
    })
    .from(therapistCodes)
    .where(eq(therapistCodes.userId, actor.userId))
    .orderBy(desc(therapistCodes.createdAt))
    .limit(50);

  return rows.map((row) => ({ ...row, url: codeUrl(row.code) }));
}

/**
 * Mint one. Retries on the unique index rather than checking first: the index
 * is the authority, and a SELECT before an INSERT is a race with a window.
 */
export async function createCode(
  actor: Actor,
  label: string | null,
): Promise<{ code?: WallCode; error?: string }> {
  const live = await db
    .select({ id: therapistCodes.id })
    .from(therapistCodes)
    .where(and(eq(therapistCodes.userId, actor.userId), isNull(therapistCodes.revokedAt)));

  /*
   * A ceiling, because every live code is a poster somebody has to remember to
   * kill. Ten is more than any practice needs and small enough that the list
   * stays readable.
   */
  if (live.length >= 10) {
    return { error: "You have ten live codes already. Revoke one you are not using." };
  }

  for (let attempt = 0; attempt < 5; attempt += 1) {
    try {
      const [row] = await db
        .insert(therapistCodes)
        .values({
          userId: actor.userId,
          organizationId: actor.organizationId,
          code: mint(),
          label: label?.trim() || null,
          createdBy: actor.userId,
        })
        .returning({
          id: therapistCodes.id,
          code: therapistCodes.code,
          label: therapistCodes.label,
          createdAt: therapistCodes.createdAt,
          revokedAt: therapistCodes.revokedAt,
        });

      return { code: { ...row!, url: codeUrl(row!.code) } };
    } catch (error) {
      if (!String((error as Error).message).includes("therapist_codes_code_unique")) throw error;
    }
  }

  return { error: "Could not create a code just now. Try again." };
}

/**
 * Kill a poster. Scoped to the caller's own codes: an `id` from somebody
 * else's practice matches nothing, which is the same answer as a code that
 * never existed.
 */
export async function revokeCode(actor: Actor, id: string): Promise<{ ok: boolean }> {
  const done = await db
    .update(therapistCodes)
    .set({ revokedAt: new Date(), revokedBy: actor.userId })
    .where(
      and(
        eq(therapistCodes.id, id),
        eq(therapistCodes.userId, actor.userId),
        isNull(therapistCodes.revokedAt),
      ),
    )
    .returning({ id: therapistCodes.id });

  return { ok: done.length > 0 };
}

export type ScannedCode =
  | { state: "live"; therapistName: string; credentials: string | null; practiceName: string | null }
  | { state: "revoked" }
  | { state: "unknown" };

/**
 * What a scan resolves to.
 *
 * Three answers, not two. "Revoked" is distinguishable from "never existed"
 * because the person reading it is standing in front of the poster and needs
 * to know whether to look for another way in or to check what they typed. It
 * leaks nothing: it says a code was retired, not who retired it or whose it
 * was.
 */
export async function resolveCode(code: string): Promise<ScannedCode> {
  const normalised = code.trim().toUpperCase();
  if (!/^[A-HJ-NP-Z2-9]{8}$/.test(normalised)) return { state: "unknown" };

  const [row] = await db
    .select({
      revokedAt: therapistCodes.revokedAt,
      firstName: users.firstName,
      lastName: users.lastName,
      profile: users.profile,
      status: users.status,
      deletedAt: users.deletedAt,
      practiceName: therapistRadar.practiceName,
      organizationName: organizations.name,
    })
    .from(therapistCodes)
    .innerJoin(users, eq(users.id, therapistCodes.userId))
    .leftJoin(therapistRadar, eq(therapistRadar.userId, users.id))
    .leftJoin(organizations, eq(organizations.id, therapistCodes.organizationId))
    .where(eq(therapistCodes.code, normalised))
    .limit(1);

  if (!row) return { state: "unknown" };
  /* A clinician who has left reads as revoked, whatever the poster says. */
  if (row.revokedAt || row.deletedAt || row.status !== "active") return { state: "revoked" };

  return {
    state: "live",
    therapistName: [row.firstName, row.lastName].filter(Boolean).join(" "),
    credentials: row.profile?.credentials ?? null,
    practiceName: row.practiceName ?? row.organizationName ?? null,
  };
}
