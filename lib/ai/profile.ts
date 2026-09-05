import "server-only";

import { asc, desc, eq, inArray } from "drizzle-orm";

import { db } from "@/lib/db";
import {
  documentChunks,
  observations,
  personDocuments,
  personProfiles,
  sessionNotes,
  sessions,
  patients,
  transcriptSegments,
  type ProfileSection,
} from "@/lib/db/schema";
import { log, ref as logRef, safeErrorMessage } from "@/lib/logger";

import { MODELS, logUsage, openai, parseJson } from "./client";

/**
 * The rolling profile and the observation timeline. PLAN.md 9.1–9.4.
 *
 * ## Regenerated, never edited
 *
 * There is one row per person and it is replaced wholesale. Nothing here takes
 * prose from a human, and `person_profiles` has no update path that could — so
 * "never hand-edited into permanence" is a property of the code rather than a
 * habit. A clinician who disagrees with a line changes the *sources*: they flag
 * it (8.8), or they record a session that says otherwise.
 *
 * ## 9.4 is the rule that needed the most care
 *
 * > **Sessions outrank history. Surface conflicts, never resolve.**
 *
 * Both halves matter and the second is the harder one. A model asked to write
 * a coherent profile will quietly reconcile a contradiction — it will read "no
 * previous therapy" in a 2019 letter and "I saw someone for two years" in last
 * week's session and write something smooth that mentions neither. That is the
 * failure this prompt is built against: contradictions go in a **separate
 * field**, with both refs, and the profile body is told to prefer the session
 * and to say so rather than to blend.
 */

const SYSTEM = `RULE THAT OVERRIDES EVERYTHING BELOW:
1. Every sentence you write must be supported by material you were given, and must carry the reference marker of that material. A sentence you cannot cite is a sentence you must not write.
2. When the sessions and the historical documents disagree, THE SESSIONS WIN — but you must NOT smooth the disagreement away. Put it in "conflicts", quoting both sides with both references. Never resolve a conflict yourself, never average two accounts, never omit one because the other is more recent.
3. You do not diagnose. You do not predict. You describe what is in the record.

You are given two kinds of material about one person:
  [S<n>:<m>]  a segment of a therapy session — what was said, recently, by them
  [D<n>:<m>]  a passage from a document — letters, reports, history

Write a short standing profile a clinician can read in a minute before a session.

Sections, only where there is material for them:
  "Presenting problem"  — what brings them, in their own framing where possible
  "History"             — what the documents establish, marked as historical
  "What has helped"     — anything the record shows working
  "Watch for"           — risks and patterns that are stated, not inferred

Each section carries "refs": the exact markers you used, copied character for character.

Respond with JSON:
{
  "sections": [{"heading": string, "body": string, "refs": ["S2:14"]}],
  "conflicts": [{"text": "The 2019 letter says X [D3:2]; in session she said Y [S6:31].", "refs": ["D3:2","S6:31"]}],
  "observations": [{"date": "YYYY-MM-DD", "text": "one dated thing that happened or was reported", "ref": "S2:14"}]
}

"observations" are dated events for a timeline — a hospital admission, a bereavement, starting or stopping a medication. Use the date the thing HAPPENED, not the date it was written down. Omit any you cannot date from the material.`;

const MAX_SESSIONS = 8;
const MAX_SEGMENTS = 120;
const MAX_PASSAGES = 60;

type Material = {
  text: string;
  refs: Set<string>;
  sessionCount: number;
  documentCount: number;
  /** `S2:14` → the date of session 2, for dating observations sanely. */
  dates: Map<string, Date>;
};

/**
 * Everything the profile is allowed to be built from, in one string.
 *
 * Sessions are laid out **after** documents and labelled as recent, because
 * 9.4 says sessions outrank history and the last thing a model reads carries
 * the most weight. That ordering is doing real work, not tidiness.
 */
async function gather(personId: string): Promise<Material> {
  const refs = new Set<string>();
  const dates = new Map<string, Date>();
  const parts: string[] = [];

  /* ---------------------------------------------------------- documents -- */

  const passages = await db
    .select({
      ordinal: personDocuments.ordinal,
      title: personDocuments.title,
      documentDate: personDocuments.documentDate,
      createdAt: personDocuments.createdAt,
      sequence: documentChunks.sequence,
      text: documentChunks.text,
    })
    .from(documentChunks)
    .innerJoin(personDocuments, eq(personDocuments.id, documentChunks.documentId))
    .where(eq(personDocuments.personId, personId))
    .orderBy(asc(personDocuments.ordinal), asc(documentChunks.sequence))
    .limit(MAX_PASSAGES);

  const documentIds = new Set<number>();
  if (passages.length > 0) {
    parts.push("HISTORICAL DOCUMENTS. Older material, and outranked by the sessions below.");
    for (const passage of passages) {
      const ref = `D${passage.ordinal}:${passage.sequence}`;
      refs.add(ref);
      dates.set(ref, passage.documentDate ?? passage.createdAt);
      documentIds.add(passage.ordinal);
      parts.push(`[${ref}] (${passage.title}) ${passage.text}`);
    }
  }

  /* ----------------------------------------------------------- sessions -- */

  const patientRows = await db
    .select({ id: patients.id })
    .from(patients)
    .where(eq(patients.personId, personId));

  const patientIds = patientRows.map((p) => p.id);
  let sessionCount = 0;

  if (patientIds.length > 0) {
    const recent = await db
      .select({
        id: sessions.id,
        endedAt: sessions.endedAt,
        createdAt: sessions.createdAt,
      })
      .from(sessions)
      // H7: `inArray`, never a `sql.raw` join of ids.
      .where(inArray(sessions.patientId, patientIds))
      .orderBy(desc(sessions.createdAt))
      .limit(MAX_SESSIONS);

    // Oldest first inside the block, so the newest session is the last thing
    // the model reads.
    const ordered = recent.reverse();
    sessionCount = ordered.length;

    if (ordered.length > 0) {
      parts.push("\nSESSIONS. Recent, first-hand, and these WIN over the documents above.");
    }

    for (const [index, session] of ordered.entries()) {
      const number = index + 1;
      const when = session.endedAt ?? session.createdAt;

      const [note] = await db
        .select({ content: sessionNotes.content })
        .from(sessionNotes)
        .where(eq(sessionNotes.sessionId, session.id))
        .limit(1);

      const segments = await db
        .select({ sequence: transcriptSegments.sequence, text: transcriptSegments.text })
        .from(transcriptSegments)
        .where(eq(transcriptSegments.sessionId, session.id))
        .orderBy(asc(transcriptSegments.sequence))
        .limit(MAX_SEGMENTS);

      if (segments.length === 0 && !note?.content?.summary) continue;

      parts.push(`\n=== Session ${number} — ${when.toISOString().slice(0, 10)} ===`);
      if (note?.content?.summary) parts.push(`Note summary: ${note.content.summary}`);

      for (const segment of segments) {
        const ref = `S${number}:${segment.sequence}`;
        refs.add(ref);
        dates.set(ref, when);
        parts.push(`[${ref}] ${segment.text}`);
      }
    }
  }

  return {
    text: parts.join("\n"),
    refs,
    sessionCount,
    documentCount: documentIds.size,
    dates,
  };
}

/**
 * Rebuild one person's profile and timeline from their sources. 9.1 / 9.2.
 *
 * Everything is replaced, never merged. A profile built by merging would keep
 * a sentence alive after the material behind it was flagged or superseded,
 * which is the exact permanence 9.1 forbids.
 */
export async function regenerateProfile(input: {
  personId: string;
  organizationId: string;
  userId: string;
}): Promise<{ sections: number; conflicts: number; observations: number } | null> {
  const material = await gather(input.personId);
  if (!material.text.trim()) return null;

  const started = Date.now();
  let raw: { sections?: unknown; conflicts?: unknown; observations?: unknown } = {};

  try {
    const completion = await openai().chat.completions.create({
      model: MODELS.note,
      // A standing profile is a description of a record, not a piece of
      // writing. Sampling variety here is sampling error.
      temperature: 0,
      response_format: { type: "json_object" },
      max_tokens: 2000,
      messages: [
        { role: "system", content: SYSTEM },
        { role: "user", content: material.text },
      ],
    });

    await logUsage({
      organizationId: input.organizationId,
      userId: input.userId,
      sessionId: null,
      kind: "profile",
      model: MODELS.note,
      inputTokens: completion.usage?.prompt_tokens ?? 0,
      outputTokens: completion.usage?.completion_tokens ?? 0,
      durationMs: Date.now() - started,
      status: "success",
    });

    raw = parseJson(completion.choices[0]?.message?.content, {}, "profile");
  } catch (error) {
    log.error("profile generation failed", {
      person: logRef(input.personId),
      reason: safeErrorMessage(error),
    });
    return null;
  }

  const sections = keepCitedSections(raw.sections, material.refs);
  const conflicts = keepCitedConflicts(raw.conflicts, material.refs);
  const observed = keepDatedObservations(raw.observations, material);

  await db
    .insert(personProfiles)
    .values({
      personId: input.personId,
      sections,
      conflicts,
      sessionCount: material.sessionCount,
      documentCount: material.documentCount,
      model: MODELS.note,
      generatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: personProfiles.personId,
      set: {
        sections,
        conflicts,
        sessionCount: material.sessionCount,
        documentCount: material.documentCount,
        model: MODELS.note,
        generatedAt: new Date(),
      },
    });

  // Replaced, not appended: a timeline that accumulates every regeneration
  // shows the same bereavement four times.
  await db.delete(observations).where(eq(observations.personId, input.personId));
  if (observed.length > 0) {
    await db.insert(observations).values(
      observed.map((o) => ({
        personId: input.personId,
        observedAt: o.observedAt,
        text: o.text,
        source: o.ref.startsWith("S") ? ("session" as const) : ("document" as const),
        ref: o.ref,
      })),
    );
  }

  log.info("profile regenerated", {
    person: logRef(input.personId),
    sections: sections.length,
    conflicts: conflicts.length,
  });

  return {
    sections: sections.length,
    conflicts: conflicts.length,
    observations: observed.length,
  };
}

/* ------------------------------------------------------------ the filters -- */

/**
 * 9.1's "cited" made structural.
 *
 * A section whose refs are not all real is **dropped entirely**, not trimmed.
 * Trimming would leave a claim standing with fewer citations than it needs,
 * and a profile sentence supported by a reference that does not exist is worse
 * than a missing section — 8.5's rule, one level up.
 */
export function keepCitedSections(raw: unknown, known: Set<string>): ProfileSection[] {
  if (!Array.isArray(raw)) return [];

  const out: ProfileSection[] = [];
  for (const item of raw) {
    if (typeof item !== "object" || item === null) continue;
    const section = item as Record<string, unknown>;

    const heading = typeof section.heading === "string" ? section.heading.trim() : "";
    const body = typeof section.body === "string" ? section.body.trim() : "";
    const refs = Array.isArray(section.refs)
      ? section.refs.filter((r): r is string => typeof r === "string").map(normaliseRef)
      : [];

    if (!heading || !body) continue;
    if (refs.length === 0) continue;
    if (!refs.every((r) => known.has(r))) continue;

    out.push({ heading, body, refs });
  }
  return out;
}

/**
 * 9.4 — a conflict needs **both** sides, and both must be real.
 *
 * A "conflict" citing one reference is not a conflict, it is a claim that
 * happens to sit in the wrong field. Requiring two is what stops the model
 * using this box as a second summary.
 */
export function keepCitedConflicts(
  raw: unknown,
  known: Set<string>,
): { text: string; refs: string[] }[] {
  if (!Array.isArray(raw)) return [];

  const out: { text: string; refs: string[] }[] = [];
  for (const item of raw) {
    if (typeof item !== "object" || item === null) continue;
    const conflict = item as Record<string, unknown>;

    const text = typeof conflict.text === "string" ? conflict.text.trim() : "";
    const refs = Array.isArray(conflict.refs)
      ? conflict.refs.filter((r): r is string => typeof r === "string").map(normaliseRef)
      : [];

    if (!text) continue;
    if (refs.length < 2) continue;
    if (!refs.every((r) => known.has(r))) continue;

    out.push({ text, refs });
  }
  return out;
}

/**
 * 9.2 — an observation with no usable date is discarded.
 *
 * A timeline is a claim about *when*. An undated entry silently placed at
 * "today" would put a 2019 admission in this week, and a reader has no way to
 * tell the difference. A date more than a year in the future, or before 1900,
 * is a model mis-parse rather than a fact.
 */
export function keepDatedObservations(
  raw: unknown,
  material: { refs: Set<string>; dates: Map<string, Date> },
  now: Date = new Date(),
): { observedAt: Date; text: string; ref: string }[] {
  if (!Array.isArray(raw)) return [];

  const floor = new Date("1900-01-01").getTime();
  const ceiling = now.getTime() + 365 * 24 * 60 * 60 * 1000;

  const out: { observedAt: Date; text: string; ref: string }[] = [];
  for (const item of raw) {
    if (typeof item !== "object" || item === null) continue;
    const observation = item as Record<string, unknown>;

    const text = typeof observation.text === "string" ? observation.text.trim() : "";
    const ref = typeof observation.ref === "string" ? normaliseRef(observation.ref) : "";
    if (!text || !material.refs.has(ref)) continue;

    const stated = typeof observation.date === "string" ? Date.parse(observation.date) : NaN;
    if (!Number.isFinite(stated)) continue;
    if (stated < floor || stated > ceiling) continue;

    out.push({ observedAt: new Date(stated), text, ref });
  }

  return out.sort((a, b) => a.observedAt.getTime() - b.observedAt.getTime());
}

/** `[S2:14]`, `s2 : 14`, `S2:14` all become `S2:14`. */
export function normaliseRef(raw: string): string {
  const match = raw.match(/([SsDd])\s*(\d{1,4})\s*:\s*(\d{1,4})/);
  if (!match) return raw.trim();
  return `${match[1]!.toUpperCase()}${match[2]}:${match[3]}`;
}
