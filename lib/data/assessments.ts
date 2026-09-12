import "server-only";

import { and, desc, eq, sql } from "drizzle-orm";

import type { Actor } from "@/lib/auth/session";
import { controlDb } from "@/lib/db";
import { dbFor } from "@/lib/db";
import { pinnedToDefaultRegion } from "@/lib/db/region";
import {
  assessmentAssignments,
  assessmentResponses,
  instruments,
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

export async function recordAnswer(input: {
  assignmentId: string;
  questionKey: string;
  value: number;
  answerMs?: number | null;
}): Promise<void> {
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
export async function completeAssignment(assignmentId: string): Promise<number | null> {
  const [assignment] = await db
    .select()
    .from(assessmentAssignments)
    .where(eq(assessmentAssignments.id, assignmentId))
    .limit(1);
  if (!assignment) return null;

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

/** 56.5 — what the clinician polls while the patient is answering. */
export async function assignmentProgress(assignmentId: string): Promise<{
  status: string;
  answered: number;
  total: number;
  score: number | null;
} | null> {
  const [assignment] = await db
    .select({
      status: assessmentAssignments.status,
      score: assessmentAssignments.score,
      instrumentId: assessmentAssignments.instrumentId,
    })
    .from(assessmentAssignments)
    .where(eq(assessmentAssignments.id, assignmentId))
    .limit(1);
  if (!assignment) return null;

  const [instrument] = await controlDb
    .select({ questions: instruments.questions })
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
  };
}

/**
 * 56.9 — a patient's own history: their answers and their trend.
 *
 * 🔴 No band, no label, no clinical word. A number and a date, over time,
 * which is a true thing about their own answers and is theirs to see.
 */
export async function historyForPatient(patientId: string) {
  const rows = await db
    .select({
      id: assessmentAssignments.id,
      score: assessmentAssignments.score,
      completedAt: assessmentAssignments.completedAt,
      instrumentId: assessmentAssignments.instrumentId,
    })
    .from(assessmentAssignments)
    .where(
      and(
        eq(assessmentAssignments.patientId, patientId),
        eq(assessmentAssignments.status, "completed"),
      ),
    )
    .orderBy(desc(assessmentAssignments.completedAt))
    .limit(50);

  return rows;
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
