/**
 * Sprint 56 acceptance: assessments.
 *
 *   npm run verify:sprint56
 *
 * ## What this sprint is for
 *
 * It is the one thing in the product that gives the copilot **structured data
 * a transcript cannot produce**. A conversation says what somebody said; a
 * PHQ-9 says what they scored, on a date, comparably with the last one, and
 * how long they took over each answer.
 *
 * ## 🔴 The three things that would sink it, each proved by a write
 *
 *   1. Shipping a licensed instrument. Not a product mistake: copyright
 *      infringement inside a clinical record, discovered by a publisher's
 *      lawyer (C278).
 *   2. Publishing a clinical instrument in Arabic nobody has read. A
 *      mistranslated question changes what is being measured, and the score
 *      goes onto a chart and stays there (56.11).
 *   3. Letting a score become a diagnosis. C214's bound in a second costume,
 *      enforced on the same CHECK (56.8).
 *
 * Each is asserted by ATTEMPTING THE WRITE. Reading the migration would pass
 * against a database where somebody had dropped the constraint by hand, and
 * reading the service would pass against a second write path that skips it.
 */
import { randomUUID } from "node:crypto";

import { and, eq, sql } from "drizzle-orm";

import { readSource, reporter, required, writesTo } from "./_verify";

const { check, finish } = reporter();

async function main() {
  writesTo();

  const { controlDb: db } = await import("../lib/db");
  const {
    assessmentAssignments,
    assessmentResponses,
    instruments,
    patientClinicalFacts,
    patients,
    people,
    users,
  } = await import("../lib/db/schema");
  const {
    bandFor,
    completeAssignment,
    publishInstrument,
    recordAnswer,
    seedInstruments,
  } = await import("../lib/data/assessments");
  const { INSTRUMENT_SEEDS } = await import("../lib/data/instrument-seeds");
  const { SOURCE_PRIORITY } = await import("../lib/clinical/currency");

  await seedInstruments();

  const actor = required(
    (
      await db
        .select({ userId: users.id, organizationId: users.organizationId })
        .from(users)
        .limit(1)
    )[0],
    "user to assign an assessment",
  );

  /* ------------------------------------------- 56.2 / C278 · the licence guard -- */

  /*
   * 🔴 A licensed instrument, planted, and publishing it refused twice.
   *
   * Once by the service, which owes an operator a SENTENCE they can act on,
   * and once by the database, because a rule in a service survives until the
   * next call site forgets it and this is the one where forgetting is
   * infringement.
   */
  const [licensed] = await db
    .insert(instruments)
    .values({
      key: `verify56-licensed-${Date.now()}`,
      version: 1,
      name: { en: "A licensed inventory" },
      attribution: "Planted by verify:sprint56. Not a real instrument.",
      licence: "licensed",
      locales: ["en"],
      questions: [{ key: "q1", text: { en: "A question" }, options: [{ value: 0, label: { en: "No" } }] }],
      bands: [],
    })
    .returning({ id: instruments.id });

  const licensedId = required(licensed, "planted licensed instrument").id;

  try {
    const refusal = await publishInstrument({ id: licensedId, actor: actor as never });

    check(
      "🔴 56.2 / C278 a LICENSED instrument cannot be published",
      refusal.error !== undefined && /licence/i.test(refusal.error),
      refusal.error ?? "PUBLISHED",
    );

    let databaseRefused = false;
    try {
      await db
        .update(instruments)
        .set({ publishedAt: new Date() })
        .where(eq(instruments.id, licensedId));
    } catch {
      databaseRefused = true;
    }

    check(
      "🔴 56.2 …and the DATABASE refuses it too, so no second write path can ship one",
      databaseRefused,
      "instruments_free_only, validated, in 0070",
    );
  } finally {
    await db.delete(instruments).where(eq(instruments.id, licensedId));
  }

  /* --------------------------------------- 56.11 · a person publishes the Arabic -- */

  /*
   * 🔴 "The AI may draft it, but a person publishes."
   *
   * Clinical Arabic is a different register. A mistranslated question changes
   * what is being measured, the score is computed from it anyway, and the
   * number goes onto a chart and stays there. This plants a free instrument
   * that IS translated and has no reviewer, and asserts it cannot publish.
   */
  const [translated] = await db
    .insert(instruments)
    .values({
      key: `verify56-translated-${Date.now()}`,
      version: 1,
      name: { en: "A translated instrument", ar: "أداة مترجمة" },
      attribution: "Planted by verify:sprint56. Not a real instrument.",
      licence: "public_domain",
      locales: ["en", "ar"],
      questions: [{ key: "q1", text: { en: "A question", ar: "سؤال" }, options: [{ value: 0, label: { en: "No", ar: "لا" } }] }],
      bands: [],
    })
    .returning({ id: instruments.id });

  const translatedId = required(translated, "planted translated instrument").id;

  try {
    const refusal = await publishInstrument({ id: translatedId, actor: actor as never });

    check(
      "🔴 56.11 a TRANSLATED instrument cannot publish until a named person has read it",
      refusal.error !== undefined && /review/i.test(refusal.error),
      refusal.error ?? "PUBLISHED",
    );

    let databaseRefused = false;
    try {
      await db
        .update(instruments)
        .set({ publishedAt: new Date() })
        .where(eq(instruments.id, translatedId));
    } catch {
      databaseRefused = true;
    }

    check(
      "🔴 56.11 …and the DATABASE refuses that too",
      databaseRefused,
      "instruments_translation_reviewed, validated, in 0070",
    );

    /*
     * 🔴 CONTROL — and naming a reviewer lets it through.
     *
     * Without this, both checks above pass against a constraint that refuses
     * every publish, which would ship a product with no assessments at all and
     * look exactly like a working guard.
     */
    await db
      .update(instruments)
      .set({ translationReviewedBy: actor.userId, translationReviewedAt: new Date() })
      .where(eq(instruments.id, translatedId));

    const allowed = await publishInstrument({ id: translatedId, actor: actor as never });

    check(
      "🔴 CONTROL a reviewed translation DOES publish, so the guard is not refusing everything",
      allowed.ok === true,
      allowed.error ?? "published once a named person had read it",
    );
  } finally {
    await db.delete(instruments).where(eq(instruments.id, translatedId));
  }

  /* ------------------------------------------------ 56.1 · the shipped content -- */

  const shipped = await db
    .select({ key: instruments.key, licence: instruments.licence, locales: instruments.locales, attribution: instruments.attribution })
    .from(instruments)
    .where(sql`${instruments.key} in ('phq9', 'gad7')`);

  check(
    "56.1 / 56.2 PHQ-9 and GAD-7 ship, both free, both naming their source",
    shipped.length === 2 &&
      shipped.every((row) => row.licence === "public_domain" && row.attribution.length > 40),
    shipped.map((row) => `${row.key}: ${row.licence}`).join(", "),
  );

  /*
   * 🔴 And they are seeded ENGLISH-ONLY, with the Arabic drafted and unpublished.
   *
   * The Arabic exists in `instrument-seeds.ts`; `locales` is what decides
   * whether it reaches anybody. Seeding `["en", "ar"]` would publish a clinical
   * instrument nobody has read, which is the exact thing the constraint above
   * exists to stop, arriving through the seed rather than through the editor.
   */
  check(
    "🔴 56.11 the shipped instruments are English-only until somebody reviews the Arabic",
    shipped.every((row) => row.locales.length === 1 && row.locales[0] === "en") &&
      INSTRUMENT_SEEDS.every((seed) =>
        seed.questions.every((question) => typeof question.text.ar === "string"),
      ),
    "Arabic is drafted in instrument-seeds.ts and not published by it",
  );

  /* ------------------------------------------------- 56.7 · the per-answer timings -- */

  const patient = required(
    (
      await db
        .select({ id: patients.id, organizationId: patients.organizationId, personId: patients.personId })
        .from(patients)
        // 🔴 A patient row with a PERSON on it. `patients.person_id` is
        // nullable, and every patient-facing call in this sprint scopes
        // through it, so a fixture without one would make the ownership
        // checks below pass by matching nothing.
        .where(sql`${patients.personId} is not null`)
        .limit(1)
    )[0],
    "patient with a person to assign an assessment to",
  );

  const personId = required(patient.personId, "person id on the fixture patient");

  const instrument = required(
    (
      await db
        .select({ id: instruments.id })
        .from(instruments)
        .where(eq(instruments.key, "phq9"))
        .limit(1)
    )[0],
    "phq9 instrument",
  );

  const [assignment] = await db
    .insert(assessmentAssignments)
    .values({
      instrumentId: instrument.id,
      patientId: patient.id,
      organizationId: patient.organizationId,
      mode: "homework",
    })
    .returning({ id: assessmentAssignments.id });

  const assignmentId = required(assignment, "assignment").id;

  try {
    await recordAnswer({ assignmentId, personId, questionKey: "interest", value: 2, answerMs: 4_000 });
    await recordAnswer({ assignmentId, personId, questionKey: "down", value: 3, answerMs: 3_500 });
    /*
     * 🔴 The hesitation this whole table exists for: ninety seconds on item 9.
     * No transcript would have carried it.
     */
    await recordAnswer({ assignmentId, personId, questionKey: "selfHarm", value: 1, answerMs: 90_000 });

    const answers = await db
      .select({ questionKey: assessmentResponses.questionKey, answerMs: assessmentResponses.answerMs })
      .from(assessmentResponses)
      .where(eq(assessmentResponses.assignmentId, assignmentId));

    const hesitation = answers.find((row) => row.questionKey === "selfHarm");

    check(
      "🔴 56.7 how long each answer took is recorded, which is the signal a transcript cannot carry",
      answers.length === 3 && hesitation?.answerMs === 90_000,
      `${answers.length} answers; 90s on item 9 against ~4s on the others`,
    );

    /*
     * 🔴 A fifty-minute "hesitation" is a phone that went to sleep, not a
     * person thinking. Recorded as null, because an honest absence beats a
     * number that will be read as meaning.
     */
    await recordAnswer({ assignmentId, personId, questionKey: "sleep", value: 1, answerMs: 45 * 60 * 1000 });

    const [implausible] = await db
      .select({ answerMs: assessmentResponses.answerMs })
      .from(assessmentResponses)
      .where(
        and(
          eq(assessmentResponses.assignmentId, assignmentId),
          eq(assessmentResponses.questionKey, "sleep"),
        ),
      );

    check(
      "🔴 56.7 an implausible duration is recorded as ABSENT rather than as a long pause",
      implausible?.answerMs === null,
      "a phone that went to sleep is not a person thinking",
    );

    /*
     * Changing an answer updates it. Two rows for one question double-count in
     * the score, and the score reaches a chart.
     */
    await recordAnswer({ assignmentId, personId, questionKey: "interest", value: 0, answerMs: 2_000 });

    /* ------------------------------------- ownership, and the shape of an answer -- */

    /*
     * 🔴 A borrowed assignment id answers nothing.
     *
     * An assignment hangs off a `patients` row, and the patient surface has a
     * PERSON. Without scoping through `patients.person_id` the id is a bearer
     * token: anybody holding one could answer a stranger's PHQ-9, and item 9
     * of a stranger's PHQ-9 is not a row to tidy up later.
     */
    const strangerAnswer = await recordAnswer({
      assignmentId,
      personId: randomUUID(),
      questionKey: "down",
      value: 0,
      answerMs: 1_000,
    });

    check(
      "🔴 somebody else's assignment id answers nothing",
      strangerAnswer.error !== undefined,
      strangerAnswer.error ?? "RECORDED",
    );

    /*
     * A value outside the option set does not fail loudly. It lands in a SUM
     * and comes out as a score somebody reads as meaning.
     */
    const offScale = await recordAnswer({
      assignmentId,
      personId,
      questionKey: "down",
      value: 99,
      answerMs: 1_000,
    });

    check(
      "an answer outside the instrument's own option set is refused",
      offScale.error !== undefined,
      offScale.error ?? "RECORDED 99",
    );

    const bogusQuestion = await recordAnswer({
      assignmentId,
      personId,
      questionKey: "not-a-phq9-question",
      value: 1,
      answerMs: 1_000,
    });

    check(
      "an answer to a question the instrument does not contain is refused",
      bogusQuestion.error !== undefined,
      bogusQuestion.error ?? "RECORDED",
    );

    /*
     * 🔴 CONTROL — and the owner's own valid answer still records.
     *
     * Three refusals above would all pass against a `recordAnswer` that had
     * simply stopped writing, which is the §6 family exactly. This is the
     * bracket that says the guards refuse the right things and nothing else.
     */
    const ownAnswer = await recordAnswer({
      assignmentId,
      personId,
      questionKey: "down",
      value: 3,
      answerMs: 3_500,
    });

    check(
      "🔴 CONTROL the person's own valid answer still records, so the guards refuse only what they should",
      ownAnswer.ok === true,
      ownAnswer.error ?? "one stranger, one off-scale value and one unknown question refused; the real answer kept",
    );

    const strangerComplete = await completeAssignment(assignmentId, randomUUID());

    check(
      "🔴 somebody else's assignment id cannot be scored either",
      strangerComplete === null,
      strangerComplete === null ? "refused" : `SCORED ${strangerComplete}`,
    );

    const score = await completeAssignment(assignmentId, personId);

    check(
      "56.1 a changed answer updates rather than duplicating, so the score is the answers kept",
      score === 0 + 3 + 1 + 1,
      `score ${score} from 4 questions after one was changed from 2 to 0`,
    );

    /* --------------------------------- 56.8 / C214 · a score is never a conclusion -- */

    /*
     * 🔴 The same bound as a journal, on the same CHECK.
     *
     * A PHQ-9 of 19 is a number somebody chose nine answers to produce.
     * "Moderately severe depression" is a diagnosis, and a diagnosis reached
     * by arithmetic from a questionnaire and written into a chart by a machine
     * is exactly the anchoring C214 exists to prevent. The next clinician
     * reads everything through it.
     */
    const person = required(
      patient.personId
        ? { id: patient.personId }
        : (await db.select({ id: people.id }).from(people).limit(1))[0],
      "person to attach a fact to",
    );

    const attempts: { domain: string; refused: boolean }[] = [];

    for (const domain of ["diagnosis", "risk"]) {
      try {
        await db.insert(patientClinicalFacts).values({
          personId: person.id,
          organizationId: null,
          domain,
          field: domain === "diagnosis" ? "primary" : "level",
          value: domain === "diagnosis" ? "Moderately severe depression" : "high",
          sourceType: "ai",
          sourcePriority: SOURCE_PRIORITY.ai,
          evidenceQuote: "PHQ-9 = 19 on 12 September.",
          evidenceKind: "assessment",
          assessmentId: assignmentId,
          confidence: 0.95,
          effectiveAt: new Date(),
        });
        attempts.push({ domain, refused: false });
      } catch {
        attempts.push({ domain, refused: true });
      }
    }

    check(
      "🔴 56.8 / C214 a SCORE cannot become a diagnosis or a risk level",
      attempts.every((attempt) => attempt.refused),
      attempts.map((a) => `${a.domain}: ${a.refused ? "refused" : "WRITTEN"}`).join(", "),
    );

    /*
     * 🔴 CONTROL — and the copilot can still cite the score.
     *
     * C214 permits summarising, quoting and citing, and forbids concluding.
     * Without this, the check above passes against a bound that refuses every
     * assessment-derived fact, which would make the whole sprint's data
     * invisible to the copilot and look identical to a working rule.
     */
    let citable = false;
    let citeError = "";
    try {
      const [fact] = await db
        .insert(patientClinicalFacts)
        .values({
          personId: person.id,
          organizationId: null,
          domain: "presentation",
          field: "phq9",
          value: "5",
          sourceType: "ai",
          sourcePriority: SOURCE_PRIORITY.ai,
          evidenceQuote: "PHQ-9 = 5 on 12 September.",
          evidenceKind: "assessment",
          assessmentId: assignmentId,
          confidence: 0.95,
          effectiveAt: new Date(),
        })
        .returning({ id: patientClinicalFacts.id });
      citable = Boolean(fact);
      if (fact) {
        await db.delete(patientClinicalFacts).where(eq(patientClinicalFacts.id, fact.id));
      }
    } catch (error) {
      citable = false;
      citeError = error instanceof Error ? error.message : String(error);
    }

    check(
      "🔴 CONTROL a score CAN still be cited, with its date, as an observation",
      citable,
      citable ? "summarise, quote and cite is permitted; conclude is not" : citeError,
    );
  } finally {
    await db
      .delete(patientClinicalFacts)
      .where(eq(patientClinicalFacts.assessmentId, assignmentId));
    await db.delete(assessmentAssignments).where(eq(assessmentAssignments.id, assignmentId));
  }

  /* ------------------------------------------ 56.9 / C113 · no verdict for a patient -- */

  /*
   * 🔴 The band is a CLINICIAN concept and reaching for it is deliberate.
   *
   * "Moderately severe depression" beside a number on somebody's phone at
   * eleven at night is a diagnosis delivered by a form. C113 already rules
   * that a machine never tells a person what is wrong with them.
   *
   * Asserted structurally: `bandFor` is a separate function, and the patient's
   * own history query returns scores and dates with no band in its shape at
   * all. A patient surface cannot render what its query did not select.
   */
  const source = readSource("lib/data/assessments.ts");
  const historyBody = source.slice(source.indexOf("export async function historyForPatient"));

  check(
    "🔴 56.9 / C113 the patient's own history carries scores and dates, never a band",
    !/bandFor|bands/.test(historyBody.slice(0, historyBody.indexOf("\n}"))),
    "a number and a trend are theirs to see; a verdict is not ours to deliver by form",
  );

  const phq9 = required(
    INSTRUMENT_SEEDS.find((seed) => seed.key === "phq9"),
    "phq9 seed",
  );

  check(
    "56.9 …and the band exists for the clinician's screen, reached on purpose",
    bandFor({ bands: phq9.bands } as never, 19) === "Moderately severe",
    "bandFor(19) on PHQ-9",
  );

  finish("sprint 56");
}

void main();
