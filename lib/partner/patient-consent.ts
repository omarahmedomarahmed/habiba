import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";

import { and, eq, isNull } from "drizzle-orm";

import { audit } from "@/lib/audit";
import { controlDb } from "@/lib/db";
import { partnerSubjects, partners } from "@/lib/db/schema";
import { env } from "@/lib/env";
import { log, ref } from "@/lib/logger";

import { recordConsent } from "./consent";

/**
 * 🔴 F6: THE PATIENT'S OWN ANSWER, IN OUR SYSTEM, BEFORE ANYTHING IS RECORDED.
 *
 * The independent due diligence found that a partner could vouch for its
 * patient's consent with one API call, and we recorded on its word. Two ways
 * out were on the table: mark partner-vouched consent and never record on it,
 * or require the patient's own consent record here. We do both, which is the
 * safer of the two and the only one that leaves the product usable: a
 * partner's yes is kept and marked `partner` and opens nothing
 * (`RECORDING_SOURCES`), and the consent call hands back a link to OUR page
 * where the patient, signed in to their own 24Therapy account, answers for
 * themselves. Only that answer, filed `patient`, opens a recording.
 *
 * The link is signed, not stored: it names one partner, one session, one
 * subject, the point in the session recording would start from, and an expiry.
 * The person id always comes from the patient's own session, never from the
 * link or the partner. A subject that is still unlinked is linked by the same
 * act (only an EMPTY `person_id` is filled, as `confirmSubjectLink` does), and
 * a subject linked to somebody else is refused without saying whose.
 */

const LINK_HOURS = 24;

type Payload = { p: string; s: string; j: string; o: number; e: number };

function sign(body: string): string {
  return createHmac("sha256", env.authSecret).update(`partner-patient-consent:${body}`).digest("base64url");
}

/** Pure halves, exported for the tests. */
export function patientConsentToken(input: {
  partnerId: string;
  externalSessionRef: string;
  externalSubjectRef: string;
  offsetSeconds: number;
  expiresAt: Date;
}): string {
  const payload: Payload = {
    p: input.partnerId,
    s: input.externalSessionRef.slice(0, 200),
    j: input.externalSubjectRef.slice(0, 200),
    o: Math.max(0, Math.min(86_400, Math.floor(input.offsetSeconds))),
    e: Math.floor(input.expiresAt.getTime() / 1000),
  };
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${body}.${sign(body)}`;
}

export type PatientConsentAsk = {
  partnerId: string;
  externalSessionRef: string;
  externalSubjectRef: string;
  offsetSeconds: number;
};

export function readPatientConsentToken(token: string, now = new Date()): PatientConsentAsk | null {
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const [body, mac] = parts as [string, string];
  const want = Buffer.from(sign(body));
  const got = Buffer.from(mac);
  if (want.length !== got.length || !timingSafeEqual(want, got)) return null;
  let payload: Payload;
  try {
    payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as Payload;
  } catch {
    return null;
  }
  if (typeof payload.e !== "number" || payload.e * 1000 < now.getTime()) return null;
  if (typeof payload.p !== "string" || typeof payload.s !== "string" || typeof payload.j !== "string") return null;
  return {
    partnerId: payload.p,
    externalSessionRef: payload.s,
    externalSubjectRef: payload.j,
    offsetSeconds: Number(payload.o) || 0,
  };
}

/** The link the consent call returns for a live session. */
export function patientConsentUrl(ask: PatientConsentAsk, now = new Date()): string {
  const expiresAt = new Date(now.getTime() + LINK_HOURS * 60 * 60 * 1000);
  return `${env.appUrl}/patient/partner-consent/${patientConsentToken({ ...ask, expiresAt })}`;
}

/** What the patient's page shows: the platform's name and where recording would start. */
export async function patientConsentPreview(
  token: string,
): Promise<(PatientConsentAsk & { partnerName: string; linkedPersonId: string | null }) | null> {
  const ask = readPatientConsentToken(token);
  if (!ask) return null;
  const [row] = await controlDb
    .select({ partnerName: partners.name, personId: partnerSubjects.personId })
    .from(partners)
    .leftJoin(
      partnerSubjects,
      and(
        eq(partnerSubjects.partnerId, partners.id),
        eq(partnerSubjects.externalRef, ask.externalSubjectRef),
        isNull(partnerSubjects.revokedAt),
      ),
    )
    .where(eq(partners.id, ask.partnerId))
    .limit(1);
  if (!row) return null;
  return { ...ask, partnerName: row.partnerName, linkedPersonId: row.personId ?? null };
}

/**
 * The patient answers. `personId` is from their own session. Their subject must
 * be theirs (or still empty, and then it becomes theirs by this act).
 */
export async function answerAsPatient(input: {
  token: string;
  personId: string;
  accountId: string;
  state: "given" | "withdrawn";
}): Promise<{ ok: true } | { error: "invalid" | "taken" }> {
  const ask = readPatientConsentToken(input.token);
  if (!ask) return { error: "invalid" };

  /* Link an empty subject to this person, in the WHERE, so there is no window. */
  await controlDb
    .update(partnerSubjects)
    .set({ personId: input.personId })
    .where(
      and(
        eq(partnerSubjects.partnerId, ask.partnerId),
        eq(partnerSubjects.externalRef, ask.externalSubjectRef),
        isNull(partnerSubjects.personId),
        isNull(partnerSubjects.revokedAt),
      ),
    );

  const [mine] = await controlDb
    .select({ id: partnerSubjects.id })
    .from(partnerSubjects)
    .where(
      and(
        eq(partnerSubjects.partnerId, ask.partnerId),
        eq(partnerSubjects.externalRef, ask.externalSubjectRef),
        isNull(partnerSubjects.revokedAt),
        eq(partnerSubjects.personId, input.personId),
      ),
    )
    .limit(1);
  if (!mine) return { error: "taken" };

  const recorded = await recordConsent({
    partnerId: ask.partnerId,
    externalSessionRef: ask.externalSessionRef,
    externalSubjectRef: ask.externalSubjectRef,
    state: input.state,
    answeredAt: new Date(),
    offsetSeconds: ask.offsetSeconds,
    source: "patient",
  });
  if (recorded.error) return { error: "invalid" };

  /* Open (or close) the session's boundary now, as the partner's own call would. */
  const { openSession } = await import("./platform");
  await openSession({
    partnerId: ask.partnerId,
    environment: "live",
    externalSessionRef: ask.externalSessionRef,
    externalSubjectRef: ask.externalSubjectRef,
  });
  if (input.state === "withdrawn") {
    const { purgeSessionMaterial } = await import("./media");
    await purgeSessionMaterial({ partnerId: ask.partnerId, externalSessionRef: ask.externalSessionRef });
  }

  log.info("partner session consent answered by the patient", { partner: ref(ask.partnerId), state: input.state });
  await audit({
    actor: null,
    category: "admin",
    action: "partner.patient_consent",
    resourceType: "partner",
    resourceId: ask.partnerId,
    reason: `account ${input.accountId}: ${input.state}`,
  });
  return { ok: true };
}
