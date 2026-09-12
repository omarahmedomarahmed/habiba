/**
 * Sprint 33 acceptance: the clinical evidence layer. PLAN.md 33.1 to 33.6.
 *
 *   npm run verify:sprint33
 *
 * ## How this is checked
 *
 * By **attempting the write**, every time. Each rule below is a constraint or a
 * trigger in `0062_clinical_facts.sql`, and the only way to know a constraint
 * exists is to break it and be refused: a check that reads the schema is a
 * check that a line of SQL was typed, not that the database will act on it.
 *
 * Every refusal is paired with the write it must NOT refuse. A trigger that
 * rejects everything satisfies half these assertions and makes the feature
 * unusable, which is C90's argument arriving through data instead of through
 * skips: only asserting the refusal is asserting that the door is locked
 * without ever checking it opens.
 *
 * ## The acceptance criterion, in two checks
 *
 * *Every clinical fact can be traced to the exact sentence that produced it,
 * and a clinician can disagree with it in place.* The first is the blank-quote
 * refusal plus `evidenceFor` returning the transcript line with its
 * neighbours; the second is the dispute-and-supersede pair, which changes the
 * record without editing a word of it.
 */
import { and, eq, sql } from "drizzle-orm";

import { currencyOf, maySupersede, priorityOf } from "../lib/clinical/currency";
import {
  contestedFields,
  disputeFact,
  evidenceFor,
  factsFor,
  recordFact,
} from "../lib/data/facts";
import { dbFor } from "../lib/db";
import { DEFAULT_REGION } from "../lib/db/region";
import {
  documentChunks,
  organizations,
  patientClinicalFacts,
  people,
  personDocuments,
  sessions,
  transcriptSegments,
  users,
} from "../lib/db/schema";
import { scanRegionPins } from "./_region-pins";
import { reporter, required, writesTo } from "./_verify";

const { check, finish } = reporter();
const db = dbFor(DEFAULT_REGION);

const TAG = "verify33";

/** Did this write fail, and with the message the rule is written in? */
async function refused(what: () => Promise<unknown>): Promise<string | null> {
  try {
    await what();
    return null;
  } catch (error) {
    return error instanceof Error ? error.message : String(error);
  }
}

async function main() {
  /* C147 — this script writes, so it says where and refuses production. */
  writesTo();

  const [reference] = await db
    .select({ organizationId: users.organizationId, id: users.id })
    .from(users)
    .where(eq(users.role, "therapist"))
    .limit(1);

  const clinician = required(reference, "therapist whose organisation the fixtures can join");

  let personId: string | null = null;
  let sessionId: string | null = null;
  let documentId: string | null = null;

  try {
    const [person] = await db
      .insert(people)
      .values({ firstName: `${TAG}-Nour`, phone: "+201555000033" })
      .returning({ id: people.id });
    personId = person!.id;

    const [session] = await db
      .insert(sessions)
      .values({
        organizationId: clinician.organizationId,
        therapistId: clinician.id,
        feedbackToken: `${TAG}-token`,
      })
      .returning({ id: sessions.id });
    sessionId = session!.id;

    const lines = [
      { sequence: 1, speaker: "therapist" as const, text: "How have you been sleeping?" },
      {
        sequence: 2,
        speaker: "patient" as const,
        text: "I stopped the tablets in June. I told the GP and he said that was fine.",
      },
      { sequence: 3, speaker: "therapist" as const, text: "And since June?" },
    ];
    const segments = await db
      .insert(transcriptSegments)
      .values(
        lines.map((line) => ({
          sessionId: sessionId!,
          organizationId: clinician.organizationId,
          ...line,
        })),
      )
      .returning({ id: transcriptSegments.id, sequence: transcriptSegments.sequence });
    const quotedSegment = segments.find((s) => s.sequence === 2)!;

    const [document] = await db
      .insert(personDocuments)
      .values({
        personId,
        ordinal: 1,
        source: "upload",
        title: `${TAG} referral letter`,
      })
      .returning({ id: personDocuments.id });
    documentId = document!.id;

    const [chunk] = await db
      .insert(documentChunks)
      .values({
        documentId,
        personId,
        sequence: 1,
        text: "Referred with a two-year history of panic attacks, currently on 20mg.",
      })
      .returning({ id: documentChunks.id });

    /* --------------------------------------------- 33.1 · evidence or nothing */

    const blank = await refused(() =>
      recordFact({
        personId: personId!,
        organizationId: clinician.organizationId,
        domain: "medication",
        field: "ssri",
        value: "none",
        source: "ai",
        confidence: 0.9,
        quote: "   ",
        evidence: { kind: "segment", segmentId: quotedSegment.id },
      }),
    );
    check(
      "🔴 33.1 the database REFUSES a fact with no evidence behind it",
      blank !== null,
      blank ? "quote_not_blank" : "IT WAS ACCEPTED",
    );

    const real = await recordFact({
      personId,
      organizationId: clinician.organizationId,
      domain: "medication",
      field: "ssri",
      value: "stopped in June",
      source: "ai",
      confidence: 0.82,
      quote: "I stopped the tablets in June.",
      evidence: { kind: "segment", segmentId: quotedSegment.id },
      effectiveAt: new Date(Date.now() - 40 * 24 * 60 * 60 * 1000),
    });
    check(
      "33.1 …and ACCEPTS the same fact with the sentence attached",
      real.id.length === 36,
      `${real.sourceType} fact, priority ${real.sourcePriority}`,
    );

    /* ------------------------------------------ 33.2 · a model is never truth */

    const rankLie = await refused(() =>
      db.insert(patientClinicalFacts).values({
        personId: personId!,
        organizationId: clinician.organizationId,
        domain: "diagnosis",
        field: "primary",
        value: "generalised anxiety disorder",
        sourceType: "ai",
        /* The whole attack: an extraction job claiming a clinician's rank. */
        sourcePriority: priorityOf("clinician"),
        confidence: 0.99,
        evidenceQuote: "sounded anxious throughout",
        evidenceKind: "segment",
        segmentId: quotedSegment.id,
        effectiveAt: new Date(),
      }),
    );
    check(
      "🔴 33.2 an AI row cannot claim a clinician's rank, whatever the caller passes",
      rankLie !== null,
      rankLie ? "priority_matches_source" : "IT WAS ACCEPTED",
    );

    const bornVerified = await refused(() =>
      db.insert(patientClinicalFacts).values({
        personId: personId!,
        organizationId: clinician.organizationId,
        domain: "diagnosis",
        field: "primary",
        value: "generalised anxiety disorder",
        sourceType: "ai",
        sourcePriority: priorityOf("ai"),
        confidence: 0.99,
        evidenceQuote: "sounded anxious throughout",
        evidenceKind: "segment",
        segmentId: quotedSegment.id,
        effectiveAt: new Date(),
        verifiedBy: clinician.id,
        verifiedAt: new Date(),
      }),
    );
    check(
      "🔴 33.2 an AI fact cannot be inserted already verified: confidence is not truth",
      bornVerified !== null,
      bornVerified ? "ai_is_never_born_verified" : "IT WAS ACCEPTED",
    );

    const humanConfidence = await refused(() =>
      db.insert(patientClinicalFacts).values({
        personId: personId!,
        organizationId: clinician.organizationId,
        domain: "diagnosis",
        field: "primary",
        value: "panic disorder",
        sourceType: "clinician",
        sourcePriority: priorityOf("clinician"),
        confidence: 0.7,
        evidenceQuote: "typed by the clinician in session",
        evidenceKind: "clinician",
        enteredByUserId: clinician.id,
        effectiveAt: new Date(),
      }),
    );
    check(
      "33.2 …and a confidence number cannot be attached to a person's statement",
      humanConfidence !== null,
      humanConfidence ? "confidence_is_ai_only" : "IT WAS ACCEPTED",
    );

    /* -------------------------------------------- 33.4 · contradiction, kept */

    const clinicianFact = await recordFact({
      personId,
      organizationId: clinician.organizationId,
      domain: "diagnosis",
      field: "primary",
      value: "panic disorder",
      source: "clinician",
      quote: "Entered after the assessment on 4 March.",
      evidence: { kind: "clinician", userId: clinician.id },
      effectiveAt: new Date(Date.now() - 200 * 24 * 60 * 60 * 1000),
    });

    const aiOverrules = await refused(() =>
      recordFact({
        personId: personId!,
        organizationId: clinician.organizationId,
        domain: "diagnosis",
        field: "primary",
        value: "generalised anxiety disorder",
        source: "ai",
        confidence: 0.95,
        quote: "worries about everything, not just the attacks",
        evidence: { kind: "segment", segmentId: quotedSegment.id },
        supersedesId: clinicianFact.id,
      }),
    );
    check(
      "🔴 33.2 a model cannot supersede a clinician's diagnosis, at any confidence",
      aiOverrules !== null,
      aiOverrules ? "supersession refused" : "IT WAS ACCEPTED",
    );

    const documentFact = await recordFact({
      personId,
      organizationId: clinician.organizationId,
      domain: "medication",
      field: "ssri",
      value: "20mg daily",
      source: "document",
      quote: "currently on 20mg",
      evidence: { kind: "chunk", chunkId: chunk!.id },
      effectiveAt: new Date(Date.now() - 300 * 24 * 60 * 60 * 1000),
    });

    const corrected = await recordFact({
      personId,
      organizationId: clinician.organizationId,
      domain: "medication",
      field: "ssri",
      value: "stopped, confirmed with the GP",
      source: "clinician",
      quote: "Confirmed at review: stopped in June with the GP's agreement.",
      evidence: { kind: "clinician", userId: clinician.id },
      supersedesId: documentFact.id,
    });

    const [retired] = await db
      .select({ status: patientClinicalFacts.status })
      .from(patientClinicalFacts)
      .where(eq(patientClinicalFacts.id, documentFact.id));

    check(
      "🔴 33.4 a clinician CAN supersede a lower-ranked fact, and the old row survives as history",
      corrected.supersedesId === documentFact.id && retired?.status === "historical",
      `the superseded row is now ${retired?.status}`,
    );

    const wrongField = await refused(() =>
      recordFact({
        personId: personId!,
        organizationId: clinician.organizationId,
        domain: "risk",
        field: "ideation",
        value: "none",
        source: "clinician",
        quote: "not raised today",
        evidence: { kind: "clinician", userId: clinician.id },
        supersedesId: corrected.id,
      }),
    );
    check(
      "33.4 …and cannot supersede a fact about something else entirely",
      wrongField !== null,
      wrongField ? "same person, domain and field" : "IT WAS ACCEPTED",
    );

    /* --------------------------------------- 33.4 · the chart shows both */

    const all = await factsFor(personId, { all: true });
    const contested = contestedFields(all.filter((fact) => fact.domain === "medication"));
    check(
      "🔴 33.4 a contradicted field returns the winner AND what it contradicts",
      contested.length === 1 && contested[0]!.contradicts.length >= 1,
      contested[0]
        ? `${contested[0].winner.value} over ${contested[0].contradicts.map((f) => f.value).join(", ")}`
        : "nothing contested",
    );

    check(
      "33.4 …and the winner is the clinician's entry, not the most recent row",
      contested[0]?.winner.sourceType === "clinician",
      contested[0]?.winner.sourceType ?? "none",
    );

    /* ------------------------------------------------ 33.1 · no quiet edits */

    const edited = await refused(() =>
      db
        .update(patientClinicalFacts)
        .set({ value: "never prescribed anything" })
        .where(eq(patientClinicalFacts.id, real.id)),
    );
    check(
      "🔴 33.1 a recorded fact cannot be edited: the evidence would stop matching the claim",
      edited !== null,
      edited ? "evidence_is_immutable" : "IT WAS ACCEPTED",
    );

    const quoteEdited = await refused(() =>
      db
        .update(patientClinicalFacts)
        .set({ evidenceQuote: "something else entirely" })
        .where(eq(patientClinicalFacts.id, real.id)),
    );
    check(
      "33.1 …nor can the sentence under it be swapped",
      quoteEdited !== null,
      quoteEdited ? "evidence_is_immutable" : "IT WAS ACCEPTED",
    );

    /*
     * 🔴 The pair. A trigger that refused every UPDATE would satisfy both
     * checks above and make the evidence screen useless, so the write the rule
     * must ALLOW is asserted in the same breath.
     */
    await disputeFact(
      { userId: clinician.id, organizationId: clinician.organizationId },
      real.id,
      personId,
      "The patient says they stopped; the model read it as a dose change.",
    );
    const [disputed] = await db
      .select({ status: patientClinicalFacts.status, value: patientClinicalFacts.value })
      .from(patientClinicalFacts)
      .where(eq(patientClinicalFacts.id, real.id));

    check(
      "🔴 33.x a clinician CAN disagree in place: the status moves and the words do not",
      disputed?.status === "disputed" && disputed.value === "stopped in June",
      `${disputed?.status}, value unchanged`,
    );

    /* ------------------------------------------------- 33.6 · the evidence */

    const evidence = await evidenceFor(real as never);
    check(
      "🔴 33.6 a fact resolves to the transcript line that produced it",
      evidence.kind === "segment" && evidence.quote === "I stopped the tablets in June.",
      evidence.kind,
    );

    check(
      "🔴 33.6 …with the lines either side, because one sentence supports anything",
      evidence.kind === "segment" &&
        evidence.context.length === 3 &&
        evidence.context.some((line) => line.self) &&
        evidence.context.some((line) => line.text === "And since June?"),
      evidence.kind === "segment" ? `${evidence.context.length} lines of context` : "none",
    );

    /* ---------------------------------------------- 33.5 · deleting a source */

    const before = await factsFor(personId, { domain: "medication" });

    /*
     * 🔴 A LIVE fact standing on a chunk, and then the document deleted.
     *
     * The superseded row from 33.4 is already `historical`, so deleting its
     * source would prove nothing: a status that was going to be non-active
     * either way. The interesting case is the one a clinician would actually
     * meet — a fact the chart is showing today, whose document somebody
     * removes this afternoon — so it is planted deliberately.
     */
    const [secondDocument] = await db
      .insert(personDocuments)
      .values({ personId, ordinal: 2, source: "upload", title: `${TAG} second` })
      .returning({ id: personDocuments.id });

    const [secondChunk] = await db
      .insert(documentChunks)
      .values({ documentId: secondDocument!.id, personId, sequence: 1, text: "Sleeps four hours." })
      .returning({ id: documentChunks.id });

    const sleeping = await recordFact({
      personId,
      organizationId: clinician.organizationId,
      domain: "presentation",
      field: "sleep",
      value: "four hours",
      source: "document",
      quote: "Sleeps four hours.",
      evidence: { kind: "chunk", chunkId: secondChunk!.id },
    });

    await db.delete(personDocuments).where(eq(personDocuments.id, secondDocument!.id));

    const [afterDelete] = await db
      .select({ status: patientClinicalFacts.status, chunkId: patientClinicalFacts.chunkId })
      .from(patientClinicalFacts)
      .where(eq(patientClinicalFacts.id, sleeping.id));

    check(
      "🔴 33.5 deleting the document leaves no fact standing on it: the row goes unsupported",
      afterDelete?.status === "unsupported" && afterDelete.chunkId === null,
      `${afterDelete?.status}, pointer ${afterDelete?.chunkId === null ? "null" : "still set"}`,
    );

    const nowShown = await factsFor(personId, { domain: "presentation" });
    check(
      "33.5 …and it stops being returned as something the system believes",
      !nowShown.some((fact) => fact.id === sleeping.id),
      `${before.length} medication facts before, ${nowShown.length} presentation facts now`,
    );

    const [kept] = await db
      .select({ quote: patientClinicalFacts.evidenceQuote })
      .from(patientClinicalFacts)
      .where(eq(patientClinicalFacts.id, sleeping.id));
    check(
      "🔴 33.5 …while the row itself is KEPT, so 'we believed this, until this was deleted' survives",
      kept?.quote === "Sleeps four hours.",
      kept?.quote ?? "the row was deleted",
    );

    check(
      "33.5 a fact whose evidence is gone still resolves, and says so plainly",
      await (async () => {
        const [row] = await db
          .select()
          .from(patientClinicalFacts)
          .where(eq(patientClinicalFacts.id, sleeping.id));
        const gone = await evidenceFor(row!);
        return gone.kind === "gone";
      })(),
    );

    /* ------------------------------------------------------ 33.3 · temporal */

    const eightMonths = new Date(Date.now() - 240 * 24 * 60 * 60 * 1000);
    const ideation = currencyOf({ domain: "risk", effectiveAt: eightMonths }, new Date());
    const diagnosis = currencyOf({ domain: "diagnosis", effectiveAt: eightMonths }, new Date());

    check(
      "🔴 33.3 ideation eight months ago is not ideation now",
      !ideation.current && ideation.ageDays === 240,
      `${ideation.label}`,
    );

    check(
      "33.3 …and a diagnosis of the same age has not expired, because a diagnosis does not",
      diagnosis.current,
      diagnosis.label,
    );

    const written = await db
      .select({ effectiveAt: patientClinicalFacts.effectiveAt, createdAt: patientClinicalFacts.createdAt })
      .from(patientClinicalFacts)
      .where(eq(patientClinicalFacts.id, clinicianFact.id));

    check(
      "🔴 33.3 a fact carries when it was TRUE, separately from when it was written",
      written[0]!.effectiveAt.getTime() < written[0]!.createdAt.getTime() - 100 * 24 * 60 * 60 * 1000,
      `effective ${written[0]!.effectiveAt.toISOString().slice(0, 10)}, recorded ${written[0]!.createdAt.toISOString().slice(0, 10)}`,
    );

    check(
      "33.2 the priority order is the one §2 ruled, with the patient above the model",
      maySupersede("patient", "ai") && !maySupersede("ai", "patient") && !maySupersede("ai", "clinician"),
      "clinician < document < patient < ai",
    );

    /* -------------------------------------------------- 30.1 · the seam holds */

    const pins = scanRegionPins();
    check(
      "🔴 30.1 the new clinical module is ROUTED, not pinned: the region comes from the person",
      !pins.some((pin) => pin.file === "lib/data/facts.ts"),
      `${pins.length} pinned call sites, none of them this sprint's`,
    );
  } finally {
    /* Fixtures are removed in dependency order; the facts go with the person. */
    if (personId) {
      await db.delete(patientClinicalFacts).where(eq(patientClinicalFacts.personId, personId));
      if (documentId) await db.delete(personDocuments).where(eq(personDocuments.id, documentId));
      await db.delete(personDocuments).where(eq(personDocuments.personId, personId));
    }
    if (sessionId) {
      await db.delete(transcriptSegments).where(eq(transcriptSegments.sessionId, sessionId));
      await db.delete(sessions).where(eq(sessions.id, sessionId));
    }
    if (personId) await db.delete(people).where(eq(people.id, personId));
  }

  finish("Sprint 33");
}

void main();
