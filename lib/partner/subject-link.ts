import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";

import { and, eq, isNull } from "drizzle-orm";

import { audit } from "@/lib/audit";
import { controlDb } from "@/lib/db";
import { partnerSubjects, partners } from "@/lib/db/schema";
import { env } from "@/lib/env";
import { log, ref } from "@/lib/logger";

import type { PartnerKey } from "./route";

/**
 * 🔴 Board 932 (PT11 to PT13) — THE PERSON'S OWN ACT THAT LINKS A SUBJECT.
 *
 * `upsertSubject` says a subject is linked "by supplying something only that
 * person could have: they sign in and confirm it", and every live partner
 * subject was created unlinked (`openSession`, 68.10). Nothing ever did the
 * linking, so write-back answered 404 "No such subject." and readers answered
 * an empty list for every subject a live platform had, forever.
 *
 * This is that act, and it keeps C277 whole:
 *
 *   1. The partner asks for a link for ITS OWN subject (`subjectLinkFor`),
 *      with a live key. It gets a URL and nothing else: no person, no answer
 *      about whether anybody here matches.
 *   2. They hand the URL to their patient. The patient signs in to their own
 *      24Therapy account and confirms (`confirmSubjectLink`). The person id
 *      comes from that session, never from the partner.
 *
 * The URL is signed rather than stored: it names one subject and an expiry,
 * and linking only ever fills an EMPTY `person_id`, so a second use changes
 * nothing and a link opened by the wrong person after the right one is refused.
 * The patient cuts it again from /patient/consent (`unlinkPartner`).
 */

const LINK_DAYS = 14;

function sign(payload: string): string {
  return createHmac("sha256", env.authSecret).update(`partner-subject-link:${payload}`).digest("base64url");
}

/** Pure halves, exported for the tests. */
export function subjectLinkToken(subjectId: string, expiresAt: Date): string {
  const payload = `${subjectId}.${Math.floor(expiresAt.getTime() / 1000)}`;
  return `${payload}.${sign(payload)}`;
}

export function readSubjectLinkToken(token: string, now = new Date()): { subjectId: string } | null {
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [subjectId, exp, mac] = parts as [string, string, string];
  if (!/^[0-9a-f-]{36}$/i.test(subjectId) || !/^\d+$/.test(exp)) return null;
  const want = Buffer.from(sign(`${subjectId}.${exp}`));
  const got = Buffer.from(mac);
  if (want.length !== got.length || !timingSafeEqual(want, got)) return null;
  if (Number(exp) * 1000 < now.getTime()) return null;
  return { subjectId };
}

/**
 * The partner's side: a link for one of its own live subjects. A subject it has
 * never opened a session for is created here, unlinked, the same placeholder
 * `openSession` makes; creating one is worth nothing on its own.
 */
export async function subjectLinkFor(input: {
  key: PartnerKey;
  externalRef: string;
}): Promise<{ url: string; expiresAt: string; linked: boolean } | { error: string; status: 400 | 403 }> {
  if (input.key.environment !== "live") return { error: "Use your live key for records.", status: 403 };
  const externalRef = input.externalRef.trim();
  if (!externalRef || externalRef.length > 200) return { error: "Send a subject reference.", status: 400 };

  const { upsertSubject } = await import("./api");
  const { id } = await upsertSubject({ partnerId: input.key.partnerId, externalRef, personId: null });

  const [row] = await controlDb
    .select({ personId: partnerSubjects.personId })
    .from(partnerSubjects)
    .where(eq(partnerSubjects.id, id))
    .limit(1);

  const expiresAt = new Date(Date.now() + LINK_DAYS * 24 * 60 * 60 * 1000);
  return {
    url: `${env.appUrl}/patient/link/${subjectLinkToken(id, expiresAt)}`,
    expiresAt: expiresAt.toISOString(),
    /* Whether somebody has already confirmed it. Says nothing about who. */
    linked: Boolean(row?.personId),
  };
}

/** What the patient's screen shows before they confirm: the platform's name. */
export async function subjectLinkPreview(
  token: string,
): Promise<{ subjectId: string; partnerName: string; personId: string | null } | null> {
  const read = readSubjectLinkToken(token);
  if (!read) return null;
  const [row] = await controlDb
    .select({ partnerName: partners.name, personId: partnerSubjects.personId })
    .from(partnerSubjects)
    .innerJoin(partners, eq(partners.id, partnerSubjects.partnerId))
    .where(and(eq(partnerSubjects.id, read.subjectId), isNull(partnerSubjects.revokedAt)))
    .limit(1);
  if (!row) return null;
  return { subjectId: read.subjectId, partnerName: row.partnerName, personId: row.personId };
}

/**
 * The patient's side. `personId` is from their own session. Only an empty,
 * unrevoked subject is filled, in the WHERE clause, so there is no window.
 */
export async function confirmSubjectLink(input: {
  token: string;
  personId: string;
  accountId: string;
}): Promise<{ ok: true } | { error: "invalid" | "taken" }> {
  const read = readSubjectLinkToken(input.token);
  if (!read) return { error: "invalid" };

  const [linked] = await controlDb
    .update(partnerSubjects)
    .set({ personId: input.personId })
    .where(
      and(
        eq(partnerSubjects.id, read.subjectId),
        isNull(partnerSubjects.personId),
        isNull(partnerSubjects.revokedAt),
      ),
    )
    .returning({ partnerId: partnerSubjects.partnerId });

  if (!linked) {
    /* Already theirs is success; anybody else's is refused without saying whose. */
    const [row] = await controlDb
      .select({ personId: partnerSubjects.personId })
      .from(partnerSubjects)
      .where(and(eq(partnerSubjects.id, read.subjectId), isNull(partnerSubjects.revokedAt)))
      .limit(1);
    if (row?.personId === input.personId) return { ok: true };
    return { error: row ? "taken" : "invalid" };
  }

  log.info("partner subject linked by the patient", { subject: ref(read.subjectId) });
  await audit({
    actor: null,
    category: "admin",
    action: "partner.subject_linked",
    resourceType: "partner",
    resourceId: linked.partnerId,
    reason: `account ${input.accountId}`,
  });
  return { ok: true };
}
