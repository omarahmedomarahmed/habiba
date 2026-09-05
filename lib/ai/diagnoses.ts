import "server-only";

import { and, asc, eq } from "drizzle-orm";

import { db } from "@/lib/db";
import { documentChunks, personDiagnoses, personDocuments } from "@/lib/db/schema";
import { log, ref, safeErrorMessage } from "@/lib/logger";

import { MODELS, logUsage, openai, parseJson } from "./client";

/**
 * Diagnoses, taken from documents. PLAN.md 8.9.
 *
 * 🔴 **Extract only what is written. Show the source sentence. Require
 * confirmation. Never infer from symptoms.**
 *
 * Three mechanisms enforce that, and only one of them is the prompt:
 *
 *   1. The prompt says it, above the schema (H2 — a rule under a long input
 *      loses to the input).
 *   2. `verbatimIn` **refuses** any proposal whose source sentence is not
 *      present, character for character, in the passage it claims to come
 *      from. A model that paraphrases, summarises, or invents a sentence is
 *      dropped here, deterministically, whatever the prompt achieved.
 *   3. `person_diagnoses.source_sentence` is `NOT NULL`, so a row without
 *      provenance cannot be written at all.
 *
 * This is C35's discipline applied to a second surface: refuse rather than
 * guess, because a wrong diagnosis is a label a clinician treats on.
 */

const SYSTEM = `RULE THAT OVERRIDES EVERYTHING BELOW:
You extract diagnoses that are EXPLICITLY WRITTEN in the passages given to you. You never infer a diagnosis from symptoms, behaviour, medication, or context. If a passage describes low mood and poor sleep, that is NOT a diagnosis of depression — unless the passage says so in words.

For each diagnosis actually written down, return:
  "label"          the diagnosis as the document words it, in the document's own language
  "code"           an ICD-10 or DSM code ONLY if the document states one; otherwise null
  "sourceSentence" the sentence containing it, copied EXACTLY and CHARACTER FOR CHARACTER from the passage. Do not correct spelling, do not translate, do not shorten. A sentence you have altered will be discarded.
  "ref"            the [D7:3] marker of the passage it came from

Return {"diagnoses": []} when nothing is explicitly diagnosed. An empty answer is a correct answer and is much better than a guess.

Respond with JSON: {"diagnoses": [{"label": string, "code": string|null, "sourceSentence": string, "ref": string}]}`;

export type ProposedDiagnosis = {
  label: string;
  code: string | null;
  sourceSentence: string;
  documentId: string;
  chunkId: string;
};

/**
 * Is this sentence really in that passage?
 *
 * Pure, and the reason the whole feature is safe. Whitespace is normalised —
 * a model reflowing a line break is not a fabrication — but nothing else is.
 * No case folding, no punctuation stripping, no fuzzy matching: "no history of
 * psychosis" and "history of psychosis" differ by one word, and a matcher
 * loose enough to forgive a model's edits is loose enough to accept that.
 */
export function verbatimIn(sentence: string, passage: string): boolean {
  const flatten = (s: string) => s.replace(/\s+/g, " ").trim();
  const needle = flatten(sentence);
  if (needle.length < 8) return false;
  return flatten(passage).includes(needle);
}

/** `[D7:3]` → `{ ordinal: 7, sequence: 3 }`, or null. */
export function parseRef(raw: unknown): { ordinal: number; sequence: number } | null {
  if (typeof raw !== "string") return null;
  const match = raw.match(/\[?\s*[Dd]\s*(\d{1,4})\s*:\s*(\d{1,4})\s*\]?/);
  if (!match) return null;
  return { ordinal: Number(match[1]), sequence: Number(match[2]) };
}

/**
 * Read one person's documents and propose diagnoses. Nothing is confirmed.
 *
 * Every proposal lands as `status: "proposed"`, which no screen shows as a
 * diagnosis. A human moves it, and until they do the record says only that a
 * document mentions something.
 */
export async function proposeDiagnoses(input: {
  personId: string;
  organizationId: string;
  userId: string;
}): Promise<{ proposed: number; discarded: number }> {
  const passages = await db
    .select({
      chunkId: documentChunks.id,
      documentId: personDocuments.id,
      ordinal: personDocuments.ordinal,
      sequence: documentChunks.sequence,
      text: documentChunks.text,
    })
    .from(documentChunks)
    .innerJoin(personDocuments, eq(personDocuments.id, documentChunks.documentId))
    .where(eq(personDocuments.personId, input.personId))
    .orderBy(asc(personDocuments.ordinal), asc(documentChunks.sequence))
    .limit(120);

  if (passages.length === 0) return { proposed: 0, discarded: 0 };

  const byRef = new Map(passages.map((p) => [`${p.ordinal}:${p.sequence}`, p]));
  const corpus = passages.map((p) => `[D${p.ordinal}:${p.sequence}] ${p.text}`).join("\n\n");

  const started = Date.now();
  let raw: { diagnoses?: unknown } = {};

  try {
    const completion = await openai().chat.completions.create({
      model: MODELS.note,
      // Zero, not 0.3. There is one correct answer to "what does this document
      // say" and sampling variety here is sampling error.
      temperature: 0,
      response_format: { type: "json_object" },
      max_tokens: 1200,
      messages: [
        { role: "system", content: SYSTEM },
        { role: "user", content: corpus },
      ],
    });

    await logUsage({
      organizationId: input.organizationId,
      userId: input.userId,
      sessionId: null,
      kind: "diagnosis",
      model: MODELS.note,
      inputTokens: completion.usage?.prompt_tokens ?? 0,
      outputTokens: completion.usage?.completion_tokens ?? 0,
      durationMs: Date.now() - started,
      status: "success",
    });

    raw = parseJson(completion.choices[0]?.message?.content, {}, "diagnoses");
  } catch (error) {
    log.error("diagnosis extraction failed", {
      person: ref(input.personId),
      reason: safeErrorMessage(error),
    });
    return { proposed: 0, discarded: 0 };
  }

  const candidates = Array.isArray(raw.diagnoses) ? raw.diagnoses : [];
  const kept: ProposedDiagnosis[] = [];
  let discarded = 0;

  for (const candidate of candidates) {
    if (typeof candidate !== "object" || candidate === null) {
      discarded += 1;
      continue;
    }
    const c = candidate as Record<string, unknown>;

    const label = typeof c.label === "string" ? c.label.trim() : "";
    const sentence = typeof c.sourceSentence === "string" ? c.sourceSentence.trim() : "";
    const parsed = parseRef(c.ref);

    if (!label || !sentence || !parsed) {
      discarded += 1;
      continue;
    }

    const passage = byRef.get(`${parsed.ordinal}:${parsed.sequence}`);
    if (!passage) {
      // A citation to a passage that does not exist. 8.5's rule, applied here:
      // discard rather than store something that cannot be checked.
      discarded += 1;
      continue;
    }

    /*
     * The refusal that makes this safe. A sentence the model altered is a
     * sentence the model may have composed, and a composed sentence is exactly
     * the inference §3 forbids.
     */
    if (!verbatimIn(sentence, passage.text)) {
      discarded += 1;
      continue;
    }

    kept.push({
      label,
      code: typeof c.code === "string" && c.code.trim() ? c.code.trim() : null,
      sourceSentence: sentence,
      documentId: passage.documentId,
      chunkId: passage.chunkId,
    });
  }

  for (const diagnosis of kept) {
    /*
     * Not an upsert. Re-running the extraction after a new document should not
     * silently rewrite a diagnosis a clinician already confirmed or rejected,
     * so an identical proposal is skipped rather than replaced.
     */
    const [existing] = await db
      .select({ id: personDiagnoses.id })
      .from(personDiagnoses)
      .where(
        and(
          eq(personDiagnoses.personId, input.personId),
          eq(personDiagnoses.label, diagnosis.label),
          eq(personDiagnoses.sourceChunkId, diagnosis.chunkId),
        ),
      )
      .limit(1);

    if (existing) continue;

    await db.insert(personDiagnoses).values({
      personId: input.personId,
      label: diagnosis.label,
      code: diagnosis.code,
      sourceSentence: diagnosis.sourceSentence,
      sourceDocumentId: diagnosis.documentId,
      sourceChunkId: diagnosis.chunkId,
      status: "proposed",
    });
  }

  log.info("diagnoses proposed", {
    person: ref(input.personId),
    kept: kept.length,
    discarded,
  });

  return { proposed: kept.length, discarded };
}
