import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";

import { and, eq, isNull } from "drizzle-orm";

import { audit } from "@/lib/audit";
import { controlDb } from "@/lib/db";
import { partnerSessions, partnerSubjects, partners } from "@/lib/db/schema";
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
 * link or the partner. A subject that is still unlinked is linked only by a
 * YES (only an EMPTY `person_id` is filled, as `confirmSubjectLink` does), and
 * a subject linked to somebody else is refused without saying whose.
 *
 * 🔴 Review fix: THE LINK IS BOUND TO ONE PATIENT AND ONE SESSION.
 *
 * The partner chooses every reference in the link, so the link alone proves
 * nothing about whose session it is. Two checks close that:
 *
 * - The session in the link must be ours already (opened by the consent call),
 *   live, and held for the SAME subject the link names. A partner cannot send
 *   patient B a link that pairs B's subject with patient A's session.
 * - When the subject was already linked to a person when the link was made, the
 *   link carries a keyed digest of that person (`k`, never the id itself, so
 *   the partner learns nothing), and only that person can answer it.
 *
 * And a "no" never links anybody: an unlinked subject stays unlinked, and a
 * link the patient made earlier (a claim, an earlier yes) is left alone,
 * because declining one recording is not leaving the platform (that is
 * `unlinkPartner`, its own act, with its own screen).
 */

const LINK_HOURS = 24;

type Payload = { p: string; s: string; j: string; o: number; e: number; k?: string };

function sign(body: string): string {
  return createHmac("sha256", env.authSecret).update(`partner-patient-consent:${body}`).digest("base64url");
}

/**
 * A keyed digest of a person id, so a link can name its patient without
 * handing the partner our internal id. Pure, exported for the tests.
 */
export function personDigest(personId: string): string {
  return createHmac("sha256", env.authSecret)
    .update(`partner-patient-consent-person:${personId}`)
    .digest("base64url")
    .slice(0, 32);
}

/** Pure halves, exported for the tests. */
export function patientConsentToken(input: {
  partnerId: string;
  externalSessionRef: string;
  externalSubjectRef: string;
  offsetSeconds: number;
  expiresAt: Date;
  /** The person the subject is linked to when the link is made, if any. */
  personId?: string | null;
}): string {
  const payload: Payload = {
    p: input.partnerId,
    s: input.externalSessionRef.slice(0, 200),
    j: input.externalSubjectRef.slice(0, 200),
    o: Math.max(0, Math.min(86_400, Math.floor(input.offsetSeconds))),
    e: Math.floor(input.expiresAt.getTime() / 1000),
    ...(input.personId ? { k: personDigest(input.personId) } : {}),
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

/** What a read token carries: the ask, and the patient it is bound to (a digest), if any. */
export type ReadPatientConsentAsk = PatientConsentAsk & { boundPerson: string | null };

export function readPatientConsentToken(token: string, now = new Date()): ReadPatientConsentAsk | null {
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
    boundPerson: typeof payload.k === "string" ? payload.k : null,
  };
}

/**
 * The link the consent call returns for a live session. `personId` is whoever
 * the subject is linked to right now (null while unlinked); the link is then
 * good for that person only.
 */
export function patientConsentUrl(
  ask: PatientConsentAsk & { personId?: string | null },
  now = new Date(),
): string {
  const expiresAt = new Date(now.getTime() + LINK_HOURS * 60 * 60 * 1000);
  return `${env.appUrl}/patient/partner-consent/${patientConsentToken({ ...ask, expiresAt })}`;
}

/** Who the partner's subject is linked to now, for binding the link to them. */
export async function linkedPersonOf(input: { partnerId: string; externalSubjectRef: string }): Promise<string | null> {
  const [row] = await controlDb
    .select({ personId: partnerSubjects.personId })
    .from(partnerSubjects)
    .where(
      and(
        eq(partnerSubjects.partnerId, input.partnerId),
        eq(partnerSubjects.externalRef, input.externalSubjectRef.slice(0, 200).trim()),
        isNull(partnerSubjects.revokedAt),
      ),
    )
    .limit(1);
  return row?.personId ?? null;
}

/**
 * 🔴 Review fix: WHAT THE PATIENT'S ANSWER MAY DO, DECIDED IN ONE PURE PLACE.
 *
 * - `invalid`: no live session of ours with that reference, or no live subject.
 * - `not_yours`: the session is held for another subject, the link was made
 *   for another person, or the subject is linked to another person.
 * - `record` with `link: true`: an unlinked subject and a YES; the yes links it.
 * - `record` with `link: false`: the subject is already this person's, or the
 *   answer is a NO (a no is recorded, since stopping is the safe direction, and
 *   links nobody).
 */
export type PatientAnswerPlan =
  | { kind: "refuse"; error: "invalid" | "not_yours" }
  | { kind: "record"; link: boolean };

export function patientAnswerPlan(input: {
  state: "given" | "withdrawn";
  personId: string;
  ask: Pick<ReadPatientConsentAsk, "externalSubjectRef" | "boundPerson">;
  /** Our row for the session the link names, or null when we hold none. */
  session: { externalSubjectRef: string; environment: string } | null;
  /** The live subject row the link names, or null when there is none. */
  subject: { personId: string | null } | null;
}): PatientAnswerPlan {
  if (!input.session || input.session.environment !== "live") return { kind: "refuse", error: "invalid" };
  if (input.session.externalSubjectRef !== input.ask.externalSubjectRef) {
    return { kind: "refuse", error: "not_yours" };
  }
  if (input.ask.boundPerson !== null && input.ask.boundPerson !== personDigest(input.personId)) {
    return { kind: "refuse", error: "not_yours" };
  }
  if (!input.subject) return { kind: "refuse", error: "invalid" };
  if (input.subject.personId !== null && input.subject.personId !== input.personId) {
    return { kind: "refuse", error: "not_yours" };
  }
  if (input.subject.personId === input.personId) return { kind: "record", link: false };
  return { kind: "record", link: input.state === "given" };
}

/** Our session row and the live subject row a link names. */
async function rowsFor(ask: PatientConsentAsk): Promise<{
  session: { externalSubjectRef: string; environment: string } | null;
  subject: { personId: string | null } | null;
}> {
  const [session] = await controlDb
    .select({ externalSubjectRef: partnerSessions.externalSubjectRef, environment: partnerSessions.environment })
    .from(partnerSessions)
    .where(
      and(
        eq(partnerSessions.partnerId, ask.partnerId),
        eq(partnerSessions.externalSessionRef, ask.externalSessionRef),
      ),
    )
    .limit(1);
  const [subject] = await controlDb
    .select({ personId: partnerSubjects.personId })
    .from(partnerSubjects)
    .where(
      and(
        eq(partnerSubjects.partnerId, ask.partnerId),
        eq(partnerSubjects.externalRef, ask.externalSubjectRef.trim()),
        isNull(partnerSubjects.revokedAt),
      ),
    )
    .limit(1);
  return { session: session ?? null, subject: subject ?? null };
}

/**
 * What the patient's page shows: the platform's name, where recording would
 * start, and whether this signed-in person may answer at all.
 */
export async function patientConsentPreview(
  token: string,
  personId: string,
): Promise<(PatientConsentAsk & { partnerName: string; mine: boolean; notYours: boolean }) | null> {
  const ask = readPatientConsentToken(token);
  if (!ask) return null;
  const [partner] = await controlDb
    .select({ name: partners.name })
    .from(partners)
    .where(eq(partners.id, ask.partnerId))
    .limit(1);
  if (!partner) return null;
  const plan = patientAnswerPlan({ state: "given", personId, ask, ...(await rowsFor(ask)) });
  return {
    partnerId: ask.partnerId,
    externalSessionRef: ask.externalSessionRef,
    externalSubjectRef: ask.externalSubjectRef,
    offsetSeconds: ask.offsetSeconds,
    partnerName: partner.name,
    mine: plan.kind === "record",
    notYours: plan.kind === "refuse" && plan.error === "not_yours",
  };
}

/**
 * The patient answers. `personId` is from their own session. The session must
 * be held for the subject the link names, and that subject must be theirs, or
 * still empty (and then only a YES makes it theirs). See `patientAnswerPlan`.
 */
export async function answerAsPatient(input: {
  token: string;
  personId: string;
  accountId: string;
  state: "given" | "withdrawn";
}): Promise<{ ok: true } | { error: "invalid" | "not_yours" }> {
  const ask = readPatientConsentToken(input.token);
  if (!ask) return { error: "invalid" };

  const plan = patientAnswerPlan({ state: input.state, personId: input.personId, ask, ...(await rowsFor(ask)) });
  if (plan.kind === "refuse") return { error: plan.error };

  if (plan.link) {
    /* Link an empty subject to this person, in the WHERE, so there is no window. */
    await controlDb
      .update(partnerSubjects)
      .set({ personId: input.personId })
      .where(
        and(
          eq(partnerSubjects.partnerId, ask.partnerId),
          eq(partnerSubjects.externalRef, ask.externalSubjectRef.trim()),
          isNull(partnerSubjects.personId),
          isNull(partnerSubjects.revokedAt),
        ),
      );
    /* Somebody else's yes may have landed first: then the subject is theirs. */
    const [mine] = await controlDb
      .select({ id: partnerSubjects.id })
      .from(partnerSubjects)
      .where(
        and(
          eq(partnerSubjects.partnerId, ask.partnerId),
          eq(partnerSubjects.externalRef, ask.externalSubjectRef.trim()),
          isNull(partnerSubjects.revokedAt),
          eq(partnerSubjects.personId, input.personId),
        ),
      )
      .limit(1);
    if (!mine) return { error: "not_yours" };
  }

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
