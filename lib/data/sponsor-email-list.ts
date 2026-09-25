import "server-only";

import { and, count, eq, inArray, isNotNull, isNull, lt, max, notInArray, sql } from "drizzle-orm";

import { controlDb } from "@/lib/db";
import { enrolments, patientNotifications, sponsorEmailList } from "@/lib/db/schema";
import { log } from "@/lib/logger";

import { hashIdentifier } from "./enrolment";

/**
 * 🔴 0162 / ruling 15 — A COMPANY'S STAFF LIST, EMAILS ONLY, AND NEVER READABLE.
 *
 * The code refused a roster for two reasons (C227): an approval queue singles
 * out the people least able to absorb it, and a complete staff list for every
 * client is a breach surface. The founder's ruling brings the list back for the
 * companies that need it (factories and call centres whose staff have no work
 * address), so it is built to keep the second reason answered: nothing here is
 * stored as an address. Each row is the salted hash an enrolment stores, which
 * can be checked and joined and cannot be read back, and nobody at the company
 * is ever told who joined or who was refused.
 */

const EMAIL = /^[^\s@,;<>"']+@[^\s@,;<>"']+\.[^\s@,;<>"']+$/;

/** Every email in what was pasted or uploaded, cleaned and counted. Nothing else is kept. */
export function parseEmailList(text: string): { emails: string[]; skipped: number } {
  const seen = new Set<string>();
  let skipped = 0;
  for (const raw of text.split(/[\s,;]+/)) {
    const value = raw.trim().replace(/^["']|["']$/g, "").toLowerCase();
    if (!value) continue;
    if (!EMAIL.test(value)) {
      /* A header like "email" or a stray name column is skipped, not refused. */
      skipped += 1;
      continue;
    }
    seen.add(value);
  }
  return { emails: [...seen], skipped };
}

/**
 * Replace the list with this one. Everybody on it is on it from now; somebody
 * on the old list and not on this one is marked removed, and keeps the benefit
 * for the grace period before it pauses. Somebody removed and uploaded again is
 * back at once.
 */
export async function replaceEmailList(
  sponsorId: string,
  emails: string[],
  now = new Date(),
): Promise<{ onList: number; removed: number }> {
  const hashes = [...new Set(emails.map((email) => hashIdentifier(sponsorId, email)))];
  return controlDb.transaction(async (tx) => {
    for (let i = 0; i < hashes.length; i += 500) {
      const chunk = hashes.slice(i, i + 500);
      await tx
        .insert(sponsorEmailList)
        .values(chunk.map((emailHash) => ({ sponsorId, emailHash, uploadedAt: now })))
        .onConflictDoUpdate({
          target: [sponsorEmailList.sponsorId, sponsorEmailList.emailHash],
          set: { uploadedAt: now, removedAt: null },
        });
    }
    const removed = await tx
      .update(sponsorEmailList)
      .set({ removedAt: now })
      .where(
        and(
          eq(sponsorEmailList.sponsorId, sponsorId),
          isNull(sponsorEmailList.removedAt),
          hashes.length > 0 ? notInArray(sponsorEmailList.emailHash, hashes) : sql`true`,
        ),
      )
      .returning({ emailHash: sponsorEmailList.emailHash });
    return { onList: hashes.length, removed: removed.length };
  });
}

/** Is this address on the company's list today. */
export async function onEmailList(sponsorId: string, email: string): Promise<boolean> {
  const [row] = await controlDb
    .select({ hash: sponsorEmailList.emailHash })
    .from(sponsorEmailList)
    .where(
      and(
        eq(sponsorEmailList.sponsorId, sponsorId),
        eq(sponsorEmailList.emailHash, hashIdentifier(sponsorId, email)),
        isNull(sponsorEmailList.removedAt),
      ),
    )
    .limit(1);
  return Boolean(row);
}

/** What the company sees: how many are on the list and when it last changed. Never who. */
export async function emailListSummary(sponsorId: string): Promise<{ onList: number; lastUpload: Date | null }> {
  const [row] = await controlDb
    .select({ onList: count(), lastUpload: max(sponsorEmailList.uploadedAt) })
    .from(sponsorEmailList)
    .where(and(eq(sponsorEmailList.sponsorId, sponsorId), isNull(sponsorEmailList.removedAt)));
  return { onList: Number(row?.onList ?? 0), lastUpload: row?.lastUpload ?? null };
}

/**
 * The daily job: a benefit that came in through the list pauses once its email
 * has been off the list for the grace period. Paused, not ended, the same state
 * the re-verification cycle uses, so a mistaken upload is undone by uploading
 * again and the person keeps their record either way.
 */
export async function pauseDroppedFromLists(graceDays: number, now = new Date()): Promise<{ paused: number }> {
  const before = new Date(now.getTime() - graceDays * 86_400_000);
  const dropped = await controlDb
    .select({ sponsorId: sponsorEmailList.sponsorId, emailHash: sponsorEmailList.emailHash })
    .from(sponsorEmailList)
    .where(and(isNotNull(sponsorEmailList.removedAt), lt(sponsorEmailList.removedAt, before)))
    .limit(2000);
  if (dropped.length === 0) return { paused: 0 };

  const paused = await controlDb
    .update(enrolments)
    .set({ pausedAt: now, updatedAt: now })
    .where(
      and(
        eq(enrolments.identifierKind, "listed_email"),
        isNull(enrolments.pausedAt),
        isNull(enrolments.removedAt),
        inArray(
          enrolments.identifierHash,
          dropped.map((row) => row.emailHash),
        ),
      ),
    )
    .returning({ personId: enrolments.personId, sponsorId: enrolments.sponsorId, hash: enrolments.identifierHash });

  /* Only the enrolment whose own company dropped it; a hash is per company, so this is a check, not a filter. */
  const mine = paused.filter((row) => dropped.some((d) => d.sponsorId === row.sponsorId && d.emailHash === row.hash));
  for (const row of mine) {
    await controlDb.insert(patientNotifications).values({
      personId: row.personId,
      kind: "benefit_paused",
      messageKey: "pnotice.benefitPaused",
    });
  }
  if (mine.length > 0) log.info("benefits paused: off the staff list past the grace period", { count: mine.length });
  return { paused: mine.length };
}
