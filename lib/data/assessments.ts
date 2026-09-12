import "server-only";

import { and, desc, eq, inArray, sql } from "drizzle-orm";

import type { Actor } from "@/lib/auth/session";
import { controlDb } from "@/lib/db";
import { dbFor } from "@/lib/db";
import { pinnedToDefaultRegion } from "@/lib/db/region";
import {
  assessmentAssignments,
  assessmentResponses,
  instruments,
  patients,
  type AssignmentMode,
  type Instrument,
  type InstrumentQuestion,
} from "@/lib/db/schema";
import { log } from "@/lib/logger";

/*
 * ⚠️ 30.1 — NOT ROUTED YET, and counted rather than hidden.
 */
const db = dbFor(
  pinnedToDefaultRegion(
    "lib/data/assessments.ts",
    "not routed yet: 56 lands before the assessment surfaces are region-threaded",
  ),
);

/**
 * Assessments. PLAN.md 56.1 to 56.11, C278, C214.
 *
 * ## Why this exists at all
 *
 * It is the one thing in the product that gives the copilot **structured data
 * a transcript cannot produce**. A conversation tells you what somebody said.
 * A PHQ-9 tells you what they scored, on a scale, on a date, comparably with
 * the last one, and — 56.7 — how long they took over each answer.
 *
 * ## 🔴 What it is not allowed to become
 *
 * A number and a verdict are different things and this file keeps them apart.
 * The score reaches a clinician's screen with a band beside it; it reaches a
 * patient's screen as a number and a trend and nothing else (56.9, C113). And
 * no score may ever become a diagnosis or a risk level in the evidence layer:
 * that is C214's bound in a second costume, and it is enforced on the same
 * CHECK rather than on a second one, because one rule about what evidence may
 * conclude is easier to keep true than two.
 */

/** An instrument published and legal to administer. */
export async function publishedInstruments(): Promise<Instrument[]> {
  return controlDb
    .select()
    .from(instruments)
    .where(sql`${instruments.publishedAt} is not null`)
    .orderBy(instruments.key);
}

export async function instrumentByKey(key: string): Promise<Instrument | null> {
  const [row] = await controlDb
    .select()
    .from(instruments)
    .where(and(eq(instruments.key, key), sql`${instruments.publishedAt} is not null`))
    .orderBy(desc(instruments.version))
    .limit(1);
  return row ?? null;
}

/**
 * 🔴 56.2 / C278 — publishing refuses a licensed instrument.
 *
 * The database refuses it too (`instruments_free_only`), and both exist for
 * the reason `lib/data/facts.ts` gives about its own invariants: a rule in a
 * service survives until the next call site forgets it, and this is the one
 * where forgetting is copyright infringement inside a clinical record.
 *
 * The service layer's job is the SENTENCE. A constraint violation reaching an
 * operator as a Postgres error tells them the product is broken; this tells
 * them the instrument needs a licence, which is a thing they can act on.
 */
export async function publishInstrument(input: {
  id: string;
  actor: Actor;
}): Promise<{ ok?: boolean; error?: string }> {
  const [row] = await controlDb
    .select()
    .from(instruments)
    .where(eq(instruments.id, input.id))
    .limit(1);

  if (!row) return { error: "That instrument does not exist." };

  if (row.licence === "licensed") {
    return {
      error:
        "That instrument is licensed. It can sit here unpublished until the licence exists, and it cannot reach a patient before then.",
    };
  }

  /*
   * 🔴 56.11 — "the AI may draft it, but a person publishes".
   *
   * Clinical Arabic is a different register, and a mistranslated instrument is
   * not a typo: it changes what is being measured, and the score goes onto a
   * chart and stays there. Somebody has to have read it.
   */
  const translated = row.locales.some((locale) => locale !== "en");
  if (translated && !row.translationReviewedBy) {
    return {
      error:
        "This instrument is translated and nobody has reviewed the translation. A mistranslated question changes what is being measured, so a named person reads it before it publishes.",
    };
  }

  await controlDb
    .update(instruments)
    .set({ publishedAt: new Date(), updatedAt: new Date() })
    .where(eq(instruments.id, input.id));

  return { ok: true };
}

/** 56.4 / 56.6 — into a live room, or as homework. One assignment, two doors. */
export async function assignInstrument(input: {
  actor: Actor;
  patientId: string;
  instrumentKey: string;
  mode: AssignmentMode;
  sessionId?: string | null;
}): Promise<{ id?: string; error?: string }> {
  const instrument = await instrumentByKey(input.instrumentKey);
  if (!instrument) {
    return { error: "That assessment is not available." };
  }

  const [row] = await db
    .insert(assessmentAssignments)
    .values({
      instrumentId: instrument.id,
      instrumentVersion: instrument.version,
      patientId: input.patientId,
      organizationId: input.actor.organizationId,
      assignedByUserId: input.actor.userId,
      // 56.4 — set for a room assignment, null for homework. The only
      // difference between the two modes at this level.
      sessionId: input.mode === "room" ? (input.sessionId ?? null) : null,
      mode: input.mode,
    })
    .returning({ id: assessmentAssignments.id });

  return { id: row?.id };
}

/**
 * 🔴 56.7 — one answer, and how long it took.
 *
 * `answerMs` is measured on the client, between the question appearing and the
 * option being chosen, and it is the structured signal this sprint exists for.
 * Somebody who answers eight questions in four seconds each and then sits on
 * "thoughts that you would be better off dead" for ninety has told you
 * something no transcript would have carried.
 *
 * It is clamped rather than trusted: a client can send anything, and a
 * fifty-minute "hesitation" is a phone that went to sleep rather than a person
 * thinking. Above the cap it is recorded as null, because an honest absence
 * beats a number that will be read as meaning.
 */
const MAX_HONEST_ANSWER_MS = 5 * 60 * 1000;

/**
 * 🔴 The one assignment this person is allowed to touch.
 *
 * A person is not a patient row. `people` is the identity; `patients` is one
 * clinician's file about them, and one person can have several. An assignment
 * hangs off a patient row, so every patient-facing call resolves through
 * `patients.person_id` and matches nothing when the id belongs to somebody
 * else — the same conditional-scope rule `closeStep` uses in homework.ts, for
 * the same reason: without it an assignment id is a bearer token for answering
 * a stranger's PHQ-9.
 */
async function ownedAssignment(
  assignmentId: string,
  personId: string,
): Promise<{ id: string; instrumentId: string; status: string } | null> {
  const [row] = await db
    .select({
      id: assessmentAssignments.id,
      instrumentId: assessmentAssignments.instrumentId,
      status: assessmentAssignments.status,
    })
    .from(assessmentAssignments)
    .innerJoin(patients, eq(patients.id, assessmentAssignments.patientId))
    .where(and(eq(assessmentAssignments.id, assignmentId), eq(patients.personId, personId)))
    .limit(1);
  return row ?? null;
}

export async function recordAnswer(input: {
  assignmentId: string;
  personId: string;
  questionKey: string;
  value: number;
  answerMs?: number | null;
}): Promise<{ ok?: boolean; error?: string }> {
  const owned = await ownedAssignment(input.assignmentId, input.personId);
  if (!owned) return { error: "That assessment is not yours to answer." };

  /*
   * 🔴 A completed assignment is frozen. The score is on a chart and the
   * per-answer timings are the record of how it was arrived at; reopening it
   * would silently change both.
   */
  if (owned.status === "completed") {
    return { error: "That assessment is already finished." };
  }

  const [instrument] = await controlDb
    .select({ questions: instruments.questions })
    .from(instruments)
    .where(eq(instruments.id, owned.instrumentId))
    .limit(1);

  /*
   * The question and the value have to belong to the instrument. A client can
   * send anything, and a value outside the option set does not fail loudly —
   * it lands in a SUM and comes out as a score somebody reads as meaning.
   */
  const question = (instrument?.questions as InstrumentQuestion[] | undefined)?.find(
    (q) => q.key === input.questionKey,
  );
  if (!question) return { error: "That question is not part of this assessment." };
  if (!question.options.some((option) => option.value === input.value)) {
    return { error: "That is not one of the answers offered." };
  }

  const ms =
    typeof input.answerMs === "number" &&
    Number.isFinite(input.answerMs) &&
    input.answerMs >= 0 &&
    input.answerMs <= MAX_HONEST_ANSWER_MS
      ? Math.round(input.answerMs)
      : null;

  await db
    .insert(assessmentResponses)
    .values({
      assignmentId: input.assignmentId,
      questionKey: input.questionKey,
      value: input.value,
      answerMs: ms,
    })
    /*
     * A patient going back to change an answer updates it. Two rows for one
     * question would double-count in the score, and the score reaches a chart.
     *
     * The TIMING is replaced too, and that is the right way round: the time
     * they took to settle on the answer they kept is the interesting number,
     * not the time they took to give one they then changed.
     */
    .onConflictDoUpdate({
      target: [assessmentResponses.assignmentId, assessmentResponses.questionKey],
      set: { value: input.value, answerMs: ms, answeredAt: new Date() },
    });

  await db
    .update(assessmentAssignments)
    .set({ status: "started", startedAt: sql`COALESCE(${assessmentAssignments.startedAt}, now())`, updatedAt: new Date() })
    .where(
      and(
        eq(assessmentAssignments.id, input.assignmentId),
        eq(assessmentAssignments.status, "assigned"),
      ),
    );

  return { ok: true };
}

/**
 * Score it, once, and freeze the number.
 *
 * Stored rather than recomputed for the same reason `session_credits.rate_cents`
 * is: an instrument's scoring can be corrected in a later version, and a score
 * on somebody's chart must keep meaning what it meant the day it was taken.
 *
 * 🔴 Returns the score and NOT a band. The band is a clinician-surface
 * concept; `bandFor` is a separate call that a patient screen has no reason to
 * make (56.9).
 */
export async function completeAssignment(
  assignmentId: string,
  personId: string,
): Promise<number | null> {
  const assignment = await ownedAssignment(assignmentId, personId);
  if (!assignment) return null;
  if (assignment.status === "completed") return null;

  const answers = await db
    .select({ value: assessmentResponses.value })
    .from(assessmentResponses)
    .where(eq(assessmentResponses.assignmentId, assignmentId));

  const score = answers.reduce((total, row) => total + row.value, 0);

  await db
    .update(assessmentAssignments)
    .set({
      score,
      status: "completed",
      completedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(assessmentAssignments.id, assignmentId));

  log.info("assessment completed", { answers: answers.length });
  return score;
}

/**
 * 🔴 56.9 / C113 — the band is for the CLINICIAN, and only the clinician.
 *
 * "Moderately severe depression" beside a number on somebody's phone at eleven
 * at night is a diagnosis delivered by a form. C113 already rules that a
 * machine never tells a person what is wrong with them, and a band is exactly
 * that sentence with arithmetic in front of it.
 *
 * A separate function rather than a field on the score, so that reaching for
 * it on a patient surface is a thing somebody has to do on purpose.
 */
export function bandFor(instrument: Instrument, score: number): string | null {
  return instrument.bands.find((band) => score >= band.min && score <= band.max)?.label ?? null;
}

/**
 * 56.5 — what the clinician polls while the patient is answering.
 *
 * 🔴 Scoped to the patient whose file is open, not to the assignment id alone.
 * The caller has already established that this clinician may see this patient;
 * without the second condition an assignment id from anywhere would answer,
 * and what it answers with is how far through a PHQ-9 somebody is.
 */
export async function assignmentProgress(
  assignmentId: string,
  patientId: string,
): Promise<{
  status: string;
  answered: number;
  total: number;
  score: number | null;
  instrumentKey: string;
} | null> {
  const [assignment] = await db
    .select({
      status: assessmentAssignments.status,
      score: assessmentAssignments.score,
      instrumentId: assessmentAssignments.instrumentId,
    })
    .from(assessmentAssignments)
    .where(
      and(
        eq(assessmentAssignments.id, assignmentId),
        eq(assessmentAssignments.patientId, patientId),
      ),
    )
    .limit(1);
  if (!assignment) return null;

  const [instrument] = await controlDb
    .select({ key: instruments.key, questions: instruments.questions })
    .from(instruments)
    .where(eq(instruments.id, assignment.instrumentId))
    .limit(1);

  const [count] = await db
    .select({ answered: sql<number>`COUNT(*)::int` })
    .from(assessmentResponses)
    .where(eq(assessmentResponses.assignmentId, assignmentId));

  return {
    status: assignment.status,
    answered: count?.answered ?? 0,
    total: (instrument?.questions as InstrumentQuestion[] | undefined)?.length ?? 0,
    score: assignment.score,
    instrumentKey: instrument?.key ?? "",
  };
}

/**
 * 56.5 — every assessment on this patient's file, for the clinician.
 *
 * Unlike `historyForPerson` this one DOES carry the score and the instrument,
 * because a clinician reading a chart is the audience the band exists for. It
 * is still not a band: `bandFor` is called deliberately, on a completed score,
 * at the point of rendering.
 */
export async function assessmentsForPatient(patientId: string) {
  return db
    .select({
      id: assessmentAssignments.id,
      instrumentId: assessmentAssignments.instrumentId,
      mode: assessmentAssignments.mode,
      status: assessmentAssignments.status,
      score: assessmentAssignments.score,
      createdAt: assessmentAssignments.createdAt,
      completedAt: assessmentAssignments.completedAt,
    })
    .from(assessmentAssignments)
    .where(eq(assessmentAssignments.patientId, patientId))
    .orderBy(desc(assessmentAssignments.createdAt))
    .limit(50);
}

/**
 * 56.7 — the per-answer timings, for one completed assessment.
 *
 * 🔴 The reason this sprint exists. Somebody who answers eight questions in
 * four seconds each and then sits on item 9 for ninety has told the clinician
 * something no transcript would have carried, and a total that says "19" says
 * nothing about it.
 *
 * A null `answerMs` is shown as unknown rather than as zero or as fast: it
 * means the client sent something implausible and `recordAnswer` declined to
 * pretend otherwise.
 */
export async function answerTimings(assignmentId: string, patientId: string) {
  const [owned] = await db
    .select({ id: assessmentAssignments.id })
    .from(assessmentAssignments)
    .where(
      and(
        eq(assessmentAssignments.id, assignmentId),
        eq(assessmentAssignments.patientId, patientId),
      ),
    )
    .limit(1);
  if (!owned) return [];

  return db
    .select({
      questionKey: assessmentResponses.questionKey,
      value: assessmentResponses.value,
      answerMs: assessmentResponses.answerMs,
    })
    .from(assessmentResponses)
    .where(eq(assessmentResponses.assignmentId, assignmentId))
    .orderBy(assessmentResponses.answeredAt);
}

/**
 * 56.9 — a person's own history: their answers and their trend.
 *
 * 🔴 No band, no label, no clinical word. A number and a date, over time,
 * which is a true thing about their own answers and is theirs to see. The band
 * is not filtered out of this shape further down; it was never selected, so no
 * later component can render one by reaching into a field that happened to be
 * there.
 *
 * Person-scoped rather than patient-scoped, and deliberately so: a person
 * seeing two clinicians has two `patients` rows and one history. Their own
 * answers do not become somebody else's to partition.
 */
export async function historyForPerson(personId: string) {
  const rows = await db
    .select({
      id: assessmentAssignments.id,
      score: assessmentAssignments.score,
      completedAt: assessmentAssignments.completedAt,
      instrumentId: assessmentAssignments.instrumentId,
    })
    .from(assessmentAssignments)
    .innerJoin(patients, eq(patients.id, assessmentAssignments.patientId))
    .where(
      and(eq(patients.personId, personId), eq(assessmentAssignments.status, "completed")),
    )
    .orderBy(desc(assessmentAssignments.completedAt))
    .limit(50);

  return rows;
}

/**
 * Names for a set of instruments, in one round trip.
 *
 * A separate query rather than a join because `instruments` is control-plane
 * content and assignments are regional (30.1): the two live on different
 * connections by design, and a join here would quietly pin one to the other.
 */
export async function instrumentNames(ids: string[]): Promise<Map<string, Record<string, string>>> {
  if (ids.length === 0) return new Map();

  const rows = await controlDb
    .select({ id: instruments.id, name: instruments.name })
    .from(instruments)
    .where(inArray(instruments.id, ids));

  return new Map(rows.map((row) => [row.id, row.name as Record<string, string>]));
}

/** 56.3 / 56.6 — what is waiting for this person to answer. */
export async function openAssignmentsForPerson(personId: string) {
  return db
    .select({
      id: assessmentAssignments.id,
      instrumentId: assessmentAssignments.instrumentId,
      mode: assessmentAssignments.mode,
      createdAt: assessmentAssignments.createdAt,
    })
    .from(assessmentAssignments)
    .innerJoin(patients, eq(patients.id, assessmentAssignments.patientId))
    .where(
      and(
        eq(patients.personId, personId),
        sql`${assessmentAssignments.status} in ('assigned', 'started')`,
      ),
    )
    .orderBy(desc(assessmentAssignments.createdAt))
    .limit(20);
}

/**
 * 56.3 — one assignment, its questions, and the answers so far.
 *
 * 🔴 Returns no band and no score. The patient answering a questionnaire has
 * no business being shown a running total: a visible number changes the next
 * answer, which is the one thing that would make the instrument stop measuring
 * what it measures.
 */
export async function assignmentForAnswering(assignmentId: string, personId: string) {
  const owned = await ownedAssignment(assignmentId, personId);
  if (!owned) return null;

  const [instrument] = await controlDb
    .select({
      key: instruments.key,
      name: instruments.name,
      attribution: instruments.attribution,
      questions: instruments.questions,
    })
    .from(instruments)
    .where(eq(instruments.id, owned.instrumentId))
    .limit(1);
  if (!instrument) return null;

  const answers = await db
    .select({
      questionKey: assessmentResponses.questionKey,
      value: assessmentResponses.value,
    })
    .from(assessmentResponses)
    .where(eq(assessmentResponses.assignmentId, assignmentId));

  return {
    id: owned.id,
    status: owned.status,
    instrumentKey: instrument.key,
    name: instrument.name as Record<string, string>,
    attribution: instrument.attribution,
    questions: instrument.questions as InstrumentQuestion[],
    answers: Object.fromEntries(answers.map((a) => [a.questionKey, a.value])),
  };
}

/**
 * Seed the shipped instruments. 56.1, 56.2.
 *
 * Idempotent on `(key, version)`: re-running changes nothing, and bumping a
 * version adds a row rather than editing one, because a completed assignment
 * names the version it answered and a rewritten instrument would retroactively
 * change what somebody's score meant.
 *
 * 🔴 Seeded UNPUBLISHED. Publishing goes through `publishInstrument`, which
 * refuses a licensed instrument and refuses a translated one nobody has read.
 * A seed that published its own rows would be the one path around both.
 */
export async function seedInstruments(): Promise<{ inserted: number }> {
  const { INSTRUMENT_SEEDS } = await import("./instrument-seeds");
  let inserted = 0;

  for (const seed of INSTRUMENT_SEEDS) {
    const rows = await controlDb
      .insert(instruments)
      .values({
        key: seed.key,
        version: seed.version,
        name: seed.name,
        attribution: seed.attribution,
        licence: seed.licence,
        locales: seed.locales,
        questions: seed.questions,
        bands: seed.bands,
      })
      .onConflictDoNothing({ target: [instruments.key, instruments.version] })
      .returning({ id: instruments.id });
    inserted += rows.length;
  }

  return { inserted };
}
