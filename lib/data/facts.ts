import "server-only";

import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";

import { audit } from "@/lib/audit";
import { fullName } from "@/lib/utils";
import { currencyOf, priorityOf, rankFacts, type FactSourceName } from "@/lib/clinical/currency";
import { dbFor } from "@/lib/db";
import { regionOfPerson } from "@/lib/db/directory";
import {
  documentChunks,
  journals,
  patientClinicalFacts,
  personDocuments,
  transcriptSegments,
  users,
  type ClinicalFact,
  type FactEvidenceKind,
  type FactSensitivity,
} from "@/lib/db/schema";

/**
 * Reading and writing the evidence layer. PLAN.md 33.1 to 33.6.
 *
 * ## 🔴 This module is ROUTED, not pinned
 *
 * A clinical fact is somebody's health record, so it lives in their
 * jurisdiction: every query here resolves `regionOfPerson(personId)` and asks
 * that region's database. It is the first clinical table added since the seam
 * (30.1) and it does not add to the 85 pinned call sites, because the person
 * is in hand at every entry point. C154's lesson holds: the region comes from
 * the PATIENT, never from the practice, since an Egyptian patient of an
 * American clinician is the ordinary case here.
 *
 * ## What this module deliberately does not do
 *
 * It does not decide what is true. Every invariant that matters — the evidence
 * cannot be blank, an AI fact cannot be born verified, a lower-ranked source
 * cannot supersede a higher one, the value cannot be edited — is in the
 * database, in `0062_clinical_facts.sql`. This module is the shape of the API
 * around them. The distinction is the point: a rule enforced here survives
 * until the next call site forgets it, and `verify:sprint33` proves each rule
 * by **attempting the write** rather than by reading this file.
 */

export type FactInput = {
  personId: string;
  organizationId: string | null;
  domain: string;
  field: string;
  value: string;
  source: FactSourceName;
  /** The row that produced it: a session, a document, a journal, a user. */
  sourceId?: string | null;
  /** 🔴 The sentence. There is no way to record a fact without one. */
  quote: string;
  evidence:
    | { kind: "segment"; segmentId: string }
    | { kind: "chunk"; chunkId: string }
    | { kind: "journal"; journalId: string }
    | { kind: "clinician"; userId: string };
  /** When it was TRUE. Defaults to now, which is right for "as of today". */
  effectiveAt?: Date;
  /** Only for a model, and the database refuses it from anything else. */
  confidence?: number | null;
  sensitivity?: FactSensitivity;
  /** The fact this one replaces. The database checks the two are comparable. */
  supersedesId?: string | null;
};

function evidenceColumns(evidence: FactInput["evidence"]): {
  evidenceKind: FactEvidenceKind;
  segmentId: string | null;
  chunkId: string | null;
  journalId: string | null;
  enteredByUserId: string | null;
} {
  return {
    evidenceKind: evidence.kind,
    segmentId: evidence.kind === "segment" ? evidence.segmentId : null,
    chunkId: evidence.kind === "chunk" ? evidence.chunkId : null,
    journalId: evidence.kind === "journal" ? evidence.journalId : null,
    enteredByUserId: evidence.kind === "clinician" ? evidence.userId : null,
  };
}

/**
 * 🔴 47.6 / C214 — what a journal may never become.
 *
 * A patient on nobody's list writes journals at eleven at night. The moment
 * those become an evidence source, the first therapist that person ever meets
 * is handed a **conclusion drawn from a stranger's diary by a machine**, and
 * anchoring is the best documented failure mode in clinical judgement. They
 * will read everything that follows through it.
 *
 * So a journal may be summarised, quoted and cited, and may never produce a
 * diagnosis, a risk level, or any statement phrased as a conclusion about the
 * person. These are the domains where a fact IS a conclusion.
 *
 * ## Why this lives here and not in a prompt
 *
 * A prompt is an instruction to a model, and the model is the thing whose
 * judgement we are declining to trust with this. A future prompt change, a
 * model swap, a jailbreak or a well-meaning tweak all lift a prompt-level
 * bound and none of them can lift this one: the write is refused, and
 * `verify:sprint47` proves it against a planted journal that invites exactly
 * that conclusion.
 *
 * ## 🔴 This is a repair, not a prevention, and C214 was written backwards
 *
 * C214 said `lib/data/facts.ts` "does not reference journals at all, so
 * nothing leaks through the evidence layer yet". It references them
 * twenty-two times and has since sprint 33. The ruling was written from a
 * grep that printed nothing because this file contained a NUL byte (C245,
 * fixed in 45.0). The door was already open.
 *
 * ## What this does NOT touch
 *
 * C123 still stands, untouched: a journal is **scanned like a transcript**,
 * `journals.riskLevel` is computed, and a clinician holding a grant is told
 * when somebody writes "I want to die" at 3am. That is the ALERTING path and
 * it is how the product keeps somebody alive. This is the INFERENCE path: no
 * journal-derived row may enter the clinical record as a standing conclusion.
 * Two rulings, one about reaching a person and one about writing them down,
 * and reading them as the same rule would switch off the first.
 */
const CONCLUSION_DOMAINS = new Set(["diagnosis", "risk"]);

export class JournalInferenceError extends Error {
  constructor(domain: string) {
    super(
      `A journal may be summarised, quoted and cited. It may never produce a ${domain}. ` +
        "C214: the bound is in the evidence layer so that a prompt change cannot lift it.",
    );
    this.name = "JournalInferenceError";
  }
}

/**
 * Record a fact.
 *
 * The priority is derived here and CHECKed there, which is belt and braces on
 * purpose: a caller that passes its own rank is a caller that can lie, and the
 * lie would be invisible in review because the row looks like a clinician's.
 */
export async function recordFact(input: FactInput): Promise<ClinicalFact> {
  /*
   * 🔴 C214, before anything else and before any database round trip.
   *
   * Checked on the EVIDENCE rather than on the source type, because `source`
   * says who is asserting and `evidence` says what they are asserting it from.
   * A clinician reading a patient's journal and typing a diagnosis is a
   * clinician's judgement about a person they are treating, which is theirs to
   * make; a row whose evidence is the journal itself is the machine drawing
   * the conclusion, which is the thing C214 forbids. The two are
   * indistinguishable by `source` alone.
   */
  if (input.evidence.kind === "journal" && CONCLUSION_DOMAINS.has(input.domain)) {
    throw new JournalInferenceError(input.domain);
  }

  const db = dbFor(await regionOfPerson(input.personId));

  const [row] = await db
    .insert(patientClinicalFacts)
    .values({
      personId: input.personId,
      organizationId: input.organizationId,
      domain: input.domain,
      field: input.field,
      value: input.value,
      sourceType: input.source,
      sourcePriority: priorityOf(input.source),
      sourceId: input.sourceId ?? null,
      evidenceQuote: input.quote,
      ...evidenceColumns(input.evidence),
      confidence: input.source === "ai" ? (input.confidence ?? null) : null,
      effectiveAt: input.effectiveAt ?? new Date(),
      supersedesId: input.supersedesId ?? null,
      sensitivity: input.sensitivity ?? "normal",
    })
    .returning();

  return row!;
}

export type ReadFact = ClinicalFact & {
  /** 33.3 — how old the thing it describes is, not how old the row is. */
  ageDays: number;
  current: boolean;
  ageLabel: string;
};

/**
 * What is believed about a person now.
 *
 * `unsupported` and `historical` rows are excluded by default, which is the
 * whole reason they have statuses rather than being deleted: they are readable
 * on the evidence screen and invisible to everything that summarises.
 */
export async function factsFor(
  personId: string,
  options: {
    domain?: string;
    /** Include historical, unsupported and resolved rows (the evidence screen). */
    all?: boolean;
    now?: Date;
    locale?: string;
  } = {},
): Promise<ReadFact[]> {
  const db = dbFor(await regionOfPerson(personId));
  const now = options.now ?? new Date();

  const rows = await db
    .select()
    .from(patientClinicalFacts)
    .where(
      and(
        eq(patientClinicalFacts.personId, personId),
        options.domain ? eq(patientClinicalFacts.domain, options.domain) : undefined,
        options.all
          ? undefined
          : inArray(patientClinicalFacts.status, ["active", "disputed"]),
      ),
    )
    .orderBy(asc(patientClinicalFacts.domain), asc(patientClinicalFacts.field));

  /*
   * 🔴 C166 — the order is decided in TypeScript, not in SQL, and that is the
   * point rather than a shortcut.
   *
   * Currency is per-domain and derived (`halfLifeDays`), so a stale row cannot
   * be recognised by a `WHERE` clause without duplicating the table of
   * half-lives into SQL — two copies of a clinical rule, drifting. The result
   * set for one person is tens of rows, so sorting them here costs nothing and
   * keeps the rule in the one place a test can reach it.
   *
   * `rankFacts` puts every CURRENT fact above every stale one, then applies the
   * source ladder. Without it a patient's two-year-old remark outranked last
   * week's discharge summary forever, which is the question C166 answers.
   */
  const ranked = rankFacts(rows, now);

  const byField = new Map<string, typeof ranked>();
  for (const row of ranked) {
    const key = `${row.domain}\u0000${row.field}`;
    byField.set(key, [...(byField.get(key) ?? []), row]);
  }

  return [...byField.values()].flat().map((row) => {
    const currency = currencyOf(row, now, options.locale);
    return { ...row, ageDays: currency.ageDays, current: currency.current, ageLabel: currency.label };
  });
}

/**
 * 🔴 33.4 — what the chart shows when two sessions disagree.
 *
 * Both rows are kept and both are returned. The winner is the highest-ranked
 * source, and among equals the one that was true most recently; the loser is
 * returned beside it as `contradicts` rather than hidden, because "session 17
 * says he stopped and session 4 says he takes 20mg" is itself clinical
 * information, and a panel that silently showed one of them would be making a
 * judgement it is not qualified to make.
 */
export type Contested = {
  domain: string;
  field: string;
  winner: ReadFact;
  contradicts: ReadFact[];
};

/**
 * 🔴 45.0 / C245 — the composite key was a NUL byte, and that hid this file.
 *
 * `${domain}\0${field}` is a correct separator and an invisible one: a file
 * containing a NUL is a **binary file** to `grep`, which prints
 * "binary file matches" and no lines. This was the only such file in the
 * repository and it is the clinical evidence layer, so every grep-based audit
 * ever run here silently skipped it — which is how C214 came to be written
 * backwards, claiming this module does not reference journals when it
 * references them twenty-two times.
 *
 * `JSON.stringify` of the pair is unambiguous for *any* string content, needs
 * no argument about which characters a domain may contain, and is text.
 * `verify:nul` fails the build on a NUL in any `.ts` or `.tsx`.
 */
export function contestedFields(facts: ReadFact[]): Contested[] {
  const byField = new Map<string, ReadFact[]>();
  for (const fact of facts) {
    const key = JSON.stringify([fact.domain, fact.field]);
    byField.set(key, [...(byField.get(key) ?? []), fact]);
  }

  const contested: Contested[] = [];
  for (const [key, group] of byField) {
    if (group.length < 2) continue;
    /* Same value said twice is agreement, not a contradiction. */
    const values = new Set(group.map((fact) => fact.value.trim().toLowerCase()));
    if (values.size < 2) continue;

    const [domain, field] = JSON.parse(key) as [string, string];
    const [winner, ...rest] = group;
    contested.push({ domain, field, winner: winner!, contradicts: rest });
  }
  return contested;
}

/* -------------------------------------------------------------- the evidence -- */

export type Evidence =
  | {
      kind: "segment";
      quote: string;
      sessionId: string;
      /** The lines either side, so a sentence is not read out of context. */
      context: { speaker: string; text: string; self: boolean }[];
    }
  | { kind: "chunk"; quote: string; documentId: string; documentName: string; sequence: number }
  | { kind: "journal"; quote: string; journalId: string; writtenAt: Date }
  | { kind: "clinician"; quote: string; userId: string | null; name: string }
  | { kind: "gone"; quote: string; reason: string };

/**
 * 33.6 — why the system believes something, back to the line that said it.
 *
 * 🔴 The transcript case returns the lines **either side** as well. A single
 * sentence pulled out of a session can support almost anything; the clinician
 * checking a fact needs to see what was being asked and what came next, which
 * is the difference between an audit trail and a citation that technically
 * exists.
 *
 * When the evidence has been deleted the fact is already `unsupported` (33.5),
 * and this returns `gone` with the quote it was recorded with, because the
 * honest answer is "this is what it said, and the source is no longer here".
 */
export async function evidenceFor(fact: ClinicalFact): Promise<Evidence> {
  const db = dbFor(await regionOfPerson(fact.personId));

  if (fact.evidenceKind === "clinician") {
    const [user] = fact.enteredByUserId
      ? await db
          .select({ firstName: users.firstName, lastName: users.lastName })
          .from(users)
          .where(eq(users.id, fact.enteredByUserId))
          .limit(1)
      : [];
    return {
      kind: "clinician",
      quote: fact.evidenceQuote,
      userId: fact.enteredByUserId,
      name: user ? fullName(user.firstName, user.lastName, "A clinician") : "a clinician who has since left",
    };
  }

  if (fact.segmentId) {
    const [segment] = await db
      .select({
        sessionId: transcriptSegments.sessionId,
        sequence: transcriptSegments.sequence,
      })
      .from(transcriptSegments)
      .where(eq(transcriptSegments.id, fact.segmentId))
      .limit(1);

    if (segment) {
      const around = await db
        .select({
          id: transcriptSegments.id,
          speaker: transcriptSegments.speaker,
          text: transcriptSegments.text,
        })
        .from(transcriptSegments)
        .where(
          and(
            eq(transcriptSegments.sessionId, segment.sessionId),
            sql`${transcriptSegments.sequence} BETWEEN ${segment.sequence - 2} AND ${segment.sequence + 2}`,
          ),
        )
        .orderBy(asc(transcriptSegments.sequence));

      return {
        kind: "segment",
        quote: fact.evidenceQuote,
        sessionId: segment.sessionId,
        context: around.map((line) => ({
          speaker: line.speaker,
          text: line.text,
          self: line.id === fact.segmentId,
        })),
      };
    }
  }

  if (fact.chunkId) {
    const [chunk] = await db
      .select({
        documentId: documentChunks.documentId,
        sequence: documentChunks.sequence,
        name: personDocuments.title,
      })
      .from(documentChunks)
      .leftJoin(personDocuments, eq(personDocuments.id, documentChunks.documentId))
      .where(eq(documentChunks.id, fact.chunkId))
      .limit(1);

    if (chunk) {
      return {
        kind: "chunk",
        quote: fact.evidenceQuote,
        documentId: chunk.documentId,
        documentName: chunk.name ?? "a document",
        sequence: chunk.sequence,
      };
    }
  }

  if (fact.journalId) {
    const [journal] = await db
      .select({ createdAt: journals.createdAt })
      .from(journals)
      .where(eq(journals.id, fact.journalId))
      .limit(1);

    if (journal) {
      return {
        kind: "journal",
        quote: fact.evidenceQuote,
        journalId: fact.journalId,
        writtenAt: journal.createdAt,
      };
    }
  }

  return {
    kind: "gone",
    quote: fact.evidenceQuote,
    reason:
      "The session, document or journal entry this came from has been deleted, so this is no longer treated as current.",
  };
}

/* ------------------------------------------------------------- the judgement -- */

/**
 * A clinician agreeing with a fact.
 *
 * Verification is the only thing that turns a model's output into something
 * the product will state plainly, and it is always a person doing it: the
 * database refuses an `ai` row that arrives already verified.
 */
export async function verifyFact(
  actor: { userId: string; organizationId: string },
  factId: string,
  personId: string,
): Promise<void> {
  const db = dbFor(await regionOfPerson(personId));

  await db
    .update(patientClinicalFacts)
    .set({ verifiedBy: actor.userId, verifiedAt: new Date(), updatedAt: new Date() })
    .where(and(eq(patientClinicalFacts.id, factId), eq(patientClinicalFacts.personId, personId)));

  await audit({
    actor,
    category: "clinical",
    action: "fact.verify",
    resourceType: "clinical_fact",
    resourceId: factId,
  });
}

/**
 * A clinician disagreeing with a fact, in place. The accept criterion of 33.
 *
 * 🔴 It does not delete anything and it does not edit the value, because the
 * database would refuse both. `disputed` means "this is on the record and the
 * clinician does not accept it", which is a different and more honest state
 * than absence: a fact that was extracted, shown, and rejected is something the
 * next reader should know happened.
 */
export async function disputeFact(
  actor: { userId: string; organizationId: string },
  factId: string,
  personId: string,
  reason: string,
): Promise<void> {
  const db = dbFor(await regionOfPerson(personId));

  await db
    .update(patientClinicalFacts)
    .set({ status: "disputed", updatedAt: new Date() })
    .where(and(eq(patientClinicalFacts.id, factId), eq(patientClinicalFacts.personId, personId)));

  await audit({
    actor,
    category: "clinical",
    action: "fact.dispute",
    resourceType: "clinical_fact",
    resourceId: factId,
    reason,
  });
}

/**
 * Replacing a fact with a corrected one. 33.4.
 *
 * Both rows survive: the database retires the old one to `historical` after the
 * new one lands, and refuses the write outright if the new source ranks below
 * the old one.
 */
export async function supersedeFact(
  actor: { userId: string; organizationId: string },
  previous: ClinicalFact,
  next: Omit<FactInput, "personId" | "organizationId" | "domain" | "field" | "supersedesId">,
): Promise<ClinicalFact> {
  const fact = await recordFact({
    ...next,
    personId: previous.personId,
    organizationId: actor.organizationId,
    domain: previous.domain,
    field: previous.field,
    supersedesId: previous.id,
  });

  await audit({
    actor,
    category: "clinical",
    action: "fact.supersede",
    resourceType: "clinical_fact",
    resourceId: fact.id,
    reason: `supersedes ${previous.id}`,
  });

  return fact;
}
