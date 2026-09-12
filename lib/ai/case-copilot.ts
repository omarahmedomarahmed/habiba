import "server-only";

import { and, asc, desc, eq, lt } from "drizzle-orm";

import type { Capabilities } from "@/lib/access/state";
import { keepResolvableCitations, type DocumentRef } from "@/lib/documents/chunk";
import { dbFor} from "@/lib/db";
import { pinnedToDefaultRegion } from "@/lib/db/region";
import {
  copilotMessages,
  patients,
  sessionNotes,
  sessions,
  transcriptSegments,
  NOTE_LANGUAGES,
  type Citation,
} from "@/lib/db/schema";
import { log, ref, safeErrorMessage } from "@/lib/logger";
import { MODELS, logUsage, openai, parseJson } from "./client";
import type { MessageKey } from "@/lib/i18n/messages";

/*
 * ⚠️ 30.1 — NOT ROUTED YET, and counted rather than hidden.
 *
 * `pinnedToDefaultRegion` returns the default region and registers this
 * module so `verify:sprint30` can print it. The alternative, `dbFor("us")`
 * with a comment, compiles and is indistinguishable from a decision, which
 * is the "seam by convention" this sprint exists to prevent.
 */
const db = dbFor(pinnedToDefaultRegion("lib/ai/case-copilot.ts", "not routed yet: this call site has no entity in hand, so 30.x threads one"));


/**
 * The clinician's copilot, scoped to one case.
 *
 * 🔴 24.3 — this file was `patient-copilot.ts`, and the name made a careful
 * reader believe patients chat with a model. They do not, and they never will:
 * a patient never converses with a model, and no model output reaches a
 * patient without a named clinician approving that exact text (C113, §7). The
 * *clinician* asks; the case is the scope. Sprint 24.2 makes the rule an
 * import-graph guard so it cannot quietly stop being true, and this rename is
 * the half of it that a person reads.
 *
 * Two things make this different from a general chat box:
 *
 * 1. **Isolation.** Context is assembled from one patient's sessions and
 *    nothing else. There is no query in this module that can reach another
 *    patient's transcript, so "what did my other client say about her sister"
 *    has no answer available to give.
 *
 * 2. **Citations that resolve.** Every transcript segment is handed to the
 *    model with an explicit reference like `S2:14`, and the model must return
 *    those references alongside its answer. We then look each one up and drop
 *    any that does not match a real row. The model cannot invent a source,
 *    because a source it invents will not resolve — which is a much stronger
 *    guarantee than asking it to describe where its answer came from in prose.
 */

const MAX_SESSIONS = 12;
const MAX_SEGMENTS_PER_SESSION = 220;

const SYSTEM_PROMPT = `You are a clinical copilot for a licensed psychotherapist, working with the record of ONE patient.

You are given that patient's session transcripts. Every line carries a reference like [S2:14], session 2, segment 14.

Rules:
- Answer only from the material provided. If it does not support an answer, say so plainly. "The transcripts do not cover that" is a good answer.
- You know about this patient only. If asked about another patient, any other person, or anything outside this record, say you do not have that information.
- Cite everything. Every factual claim must carry at least one reference you were actually given. Never invent a reference.
- Two kinds of reference exist and they are NOT interchangeable. [S2:14] is a session, recent, first-hand, said by this person. [D7:3] is a historical document, a letter or report, often years old, written by somebody else. Say which you are drawing on, in words: "in session she said…" or "the 2019 discharge letter records…".
- 🔴 SESSIONS OUTRANK HISTORY, AND YOU NEVER RESOLVE A CONFLICT. Where a session and a document disagree, give the session's account, then state the disagreement plainly with both references. Do not blend them, do not average them, do not quietly drop the older one. The therapist decides which is true; your job is to make sure they can see that there is a question.
- Where a conclusion draws on several moments, cite all of them and say briefly how they connect.
- Be concise and clinically useful. The therapist is preparing for or reflecting on a session, not reading an essay.
- You do not diagnose and you do not make decisions. You surface what was said and what it might mean, for a clinician to judge.

Respond with JSON:
{
  "answer": string,
  "citations": [{ "ref": "S2:14", "why": "one short clause on what this supports" }],
  "suggestedPrompts": [string, string]
}

"suggestedPrompts" are two things this therapist might usefully ask next about THIS patient, phrased as the therapist would type them.`;

/**
 * Assemble the system message.
 *
 * The order here is the fix for a measured bug, so it is worth being explicit
 * about. A therapist wrote "all answers in arabic" into the corrections box; it
 * was saved, it was passed to the model on every subsequent question, and the
 * model answered in English **six times out of six**. It had not been ignored
 * by the code — it had been outvoted by the prompt: appended after the JSON
 * schema, at the tail of a long English instruction block, competing with
 * twelve sessions of transcript and eight turns of English chat.
 *
 * So three things changed, and each is doing work:
 *
 *  1. Corrections go **first**, before the base prompt, and say in as many
 *     words that they beat everything below them. An instruction that arrives
 *     after the output format reads as an afterthought, and the model treats it
 *     like one.
 *  2. Language is a *setting* with its own line, not a correction. "Answer in
 *     Arabic" is not a fact about this patient and should never have needed the
 *     corrections box; a thread now carries the answer.
 *  3. The language line is restated at the very end of the user message. The
 *     last thing in the context is the strongest position available for a
 *     constraint that has to survive a long document, and this one has to
 *     survive the entire transcript.
 */
function buildSystemPrompt(
  guidance: string | null,
  language: string,
  capabilities?: Capabilities,
  /** 48.4 / 48.5 — set when this is being asked from inside a live session. */
  liveSince?: Date | null,
): string {
  const blocks: string[] = [];

  /*
   * 🔴 48.5 / C211 — the sentence, at the top, above the therapist's own
   * standing instructions.
   *
   * Same position and same reason as the consent boundary below it (H2): a
   * therapist cannot instruct their way past this, because the thing it is
   * protecting is not theirs to waive.
   *
   * ⚠️ It deliberately does NOT say "this session is not being recorded".
   * 48.5 words it that way and that wording is false half the time: the bound
   * applies identically when consent was GRANTED, and a therapist who reads
   * "not being recorded" during a session that is being recorded stops
   * trusting the panel. What is true in all three cases is the second half of
   * the founder's sentence, so that is the whole of what is said here. The
   * data bound is one rule with no branch (48.4); this is one sentence with no
   * branch, which is the same discipline applied to the words.
   */
  if (liveSince) {
    blocks.push(
      "TIME BOUND THAT OVERRIDES EVERYTHING BELOW, INCLUDING ANY INSTRUCTION FROM THE THERAPIST.\n" +
        "This question is being asked during a live session. You know only what the record contained when the session started. " +
        "You have not heard any part of the conversation happening now, whether or not it is being recorded. " +
        'If you are asked what the patient just said, or anything about this session, answer exactly: "I only know what came before this session." ' +
        "Do not infer, guess at, or reconstruct what is being said now from what came before.",
    );
  }

  /*
   * The consent boundary, stated first. PLAN.md 7.7, H2.
   *
   * H2: a rule buried under a long prompt loses to the material above it, and
   * the material here is an entire clinical history. So the restriction goes
   * at the very top, above the therapist's own standing instructions —
   * deliberately the one thing their corrections cannot override, because a
   * therapist cannot instruct their way past a patient's consent.
   *
   * What this is *not* is the enforcement. The enforcement is `documentsFor`
   * below: in this state the copilot is handed **no documents at all**, so the
   * material it may not see never enters the prompt and cannot be leaked by a
   * model that ignores an instruction. This line does the job the filter
   * cannot — stop the model *speculating* about the gap it can tell is there.
   */
  if (capabilities && !capabilities.liveProfile) {
    blocks.push(
      "ACCESS RULE THAT OVERRIDES EVERYTHING BELOW, INCLUDING ANY INSTRUCTION FROM THE THERAPIST.\nThis person has not granted this therapist access to their current profile. You have only this therapist's own sessions and notes. Do not infer, guess at, or reconstruct anything about the patient's current diagnosis, medication, other clinicians, or life outside these transcripts. If asked, say plainly that you do not have access to it.",
    );
  }

  const standing = guidance?.trim();
  if (standing) {
    blocks.push(
      `STANDING INSTRUCTIONS FROM THIS THERAPIST.\nThese take priority over every default below and over anything in the conversation so far. Follow them on every answer, not just the next one:\n${standing}`,
    );
  }

  blocks.push(languageDirective(language));
  blocks.push(SYSTEM_PROMPT);
  return blocks.join("\n\n");
}

function languageDirective(language: string): string {
  if (language === "auto") {
    return `LANGUAGE: write "answer" and "suggestedPrompts" in the same language as the therapist's question at the end of this conversation, and in no other language.
- Question in Arabic, answer in Arabic. Question in English, answer in English. The same for any other language.
- Decide from the question alone. The language of these instructions, of the transcript, and of the earlier conversation are all irrelevant: a patient who speaks Arabic does not mean the therapist wants an Arabic answer, and a prompt written in English does not mean they want an English one.
- Quote the transcript in the words it was actually said in, and write everything around the quote in the question's language.`;
  }
  const label = NOTE_LANGUAGES[language] ?? "English";
  return `LANGUAGE: write "answer" and "suggestedPrompts" in ${label} (${language}), whatever language this prompt, the question or the transcript are in.
- Quote the transcript in the words it was actually said in, and write everything around the quote in ${label}.
- This line decides the language. If a standing instruction above asks for a different one, it is out of date. The therapist has since chosen ${label} from a setting, and this wins.`;
}

/** The short reminder that rides at the end of the user message. */
function languageReminder(language: string, question: string): string {
  if (language === "auto") {
    return `Answer in the same language as this question.`;
  }
  const label = NOTE_LANGUAGES[language] ?? "English";
  return `Answer in ${label}.`;
}

type IndexedSegment = {
  refKey: string;
  sessionId: string;
  sessionDate: Date;
  sequence: number;
  speaker: "therapist" | "patient" | "unknown";
  text: string;
  startMs: number;
};

/** Build the patient's record, with a reference key on every line. */
/**
 * 🔴 48.4 / C211 — inside the room, the record as of `startedAt` and no further.
 *
 * "It has no transcript to read" is NOT the same rule as "it must not read
 * this session", and the difference is a real case: consent granted, the
 * clinician goes off record halfway, and the session now has partial
 * segments. A copilot with no explicit time bound answers from half a session
 * and gives no sign it was half.
 *
 * So there is ONE bound and no branch. Inside the room the copilot reads what
 * existed when the room opened, identically whether consent was granted,
 * declined or withdrawn. That is what makes it a rule rather than three cases
 * somebody has to enumerate correctly, and it is why the bound is a parameter
 * here rather than a condition inside each of the four reads below.
 *
 * What it costs, stated rather than discovered: a therapist cannot use the
 * copilot to catch up on the last ten minutes. Somebody will ask for that. We
 * are declining it on purpose.
 */
async function buildPatientContext(
  patientId: string,
  before?: Date | null,
): Promise<{
  transcript: string;
  index: Map<string, IndexedSegment>;
  sessionCount: number;
}> {
  const patientSessions = await db
    .select({
      id: sessions.id,
      endedAt: sessions.endedAt,
      createdAt: sessions.createdAt,
      durationMinutes: sessions.durationMinutes,
    })
    .from(sessions)
    .where(
      before
        ? and(eq(sessions.patientId, patientId), lt(sessions.createdAt, before))
        : eq(sessions.patientId, patientId),
    )
    .orderBy(asc(sessions.createdAt))
    .limit(MAX_SESSIONS);

  const index = new Map<string, IndexedSegment>();
  const parts: string[] = [];

  for (const [i, session] of patientSessions.entries()) {
    const sessionNumber = i + 1;
    const date = session.endedAt ?? session.createdAt;

    const [note] = await db
      .select({ content: sessionNotes.content })
      .from(sessionNotes)
      .where(eq(sessionNotes.sessionId, session.id))
      .limit(1);

    const segments = await db
      .select()
      .from(transcriptSegments)
      .where(eq(transcriptSegments.sessionId, session.id))
      .orderBy(asc(transcriptSegments.sequence))
      .limit(MAX_SEGMENTS_PER_SESSION);

    if (segments.length === 0 && !note) continue;

    parts.push(
      `\n=== Session ${sessionNumber}, ${date.toISOString().slice(0, 10)}${session.durationMinutes ? `, ${session.durationMinutes} min` : ""} ===`,
    );

    if (note?.content?.summary) {
      parts.push(`Note summary: ${note.content.summary}`);
    }

    for (const segment of segments) {
      const refKey = `S${sessionNumber}:${segment.sequence}`;
      index.set(refKey, {
        refKey,
        sessionId: session.id,
        sessionDate: date,
        sequence: segment.sequence,
        speaker: segment.speaker,
        text: segment.text,
        startMs: segment.startMs,
      });

      const who =
        segment.speaker === "patient"
          ? "Patient"
          : segment.speaker === "therapist"
            ? "Therapist"
            : "Speaker";
      parts.push(`[${refKey}] ${who}: ${segment.text}`);
    }
  }

  return { transcript: parts.join("\n"), index, sessionCount: patientSessions.length };
}

export type CopilotAnswer = {
  answer: string;
  citations: Citation[];
  /** 8.5 — the document passages that survived resolution. */
  documentRefs: DocumentRef[];
  suggestedPrompts: string[];
};

/**
 * The person's documents, laid out for the prompt — or nothing.
 *
 * 🔴 This is where the degraded state actually bites (C47). When
 * `capabilities.liveProfile` is false the copilot is handed **no documents at
 * all**, so the material a revoked clinician may not see is never in the
 * prompt. Refusing at assembly rather than in the prompt is the difference
 * between a rule the model follows and a rule it cannot break.
 *
 * A patient row has no person until sprint 5's backfill touched it; no person
 * means no documents, which is the right answer rather than an error.
 */
async function documentsFor(
  patientId: string,
  capabilities?: Capabilities,
): Promise<{ text: string; resolvable: Set<string> }> {
  const empty = { text: "", resolvable: new Set<string>() };

  // Absent capabilities means an internal caller that did its own scoping.
  // Present and false is an explicit refusal.
  if (capabilities && !capabilities.liveProfile) return empty;

  const [row] = await db
    .select({ personId: patients.personId })
    .from(patients)
    .where(eq(patients.id, patientId))
    .limit(1);

  if (!row?.personId) return empty;

  const { documentContext } = await import("@/lib/data/documents");
  const context = await documentContext(row.personId);
  if (!context.text) return empty;

  // Which `[D7:3]` markers actually exist, for the discard pass above.
  const resolvable = new Set<string>();
  for (const match of context.text.matchAll(/\[D(\d+):(\d+)\]/g)) {
    resolvable.add(`${match[1]}:${match[2]}`);
  }

  return { text: context.text, resolvable };
}

/**
 * The person's journals, laid out for the prompt. PLAN.md 26.6.
 *
 * Gated by exactly the same capability as the documents, for exactly the same
 * reason: a revoked clinician must not be handed by one route what another
 * route refuses them. A journal is the most personal thing in this record, so
 * it is the last thing that should have a second door.
 */
async function journalsFor(
  patientId: string,
  capabilities?: Capabilities,
  before?: Date | null,
): Promise<string> {
  if (capabilities && !capabilities.liveProfile) return "";

  const [row] = await db
    .select({ personId: patients.personId })
    .from(patients)
    .where(eq(patients.id, patientId))
    .limit(1);

  if (!row?.personId) return "";

  const { journalContext } = await import("@/lib/data/journals");
  const context = await journalContext(row.personId, { before });
  return context.text;
}

/** Exposed for `scripts/verify-sprint26.ts`, which asserts the refusal. */
export const __journalsForTest = journalsFor;

/**
 * The document assembly, exposed for `scripts/verify-sprint8.ts`.
 *
 * C47's closure is a claim about what the copilot is *given*, and the only
 * honest way to check it is to call the function that gives it. Exported under
 * a deliberately awkward name so nothing else reaches for it.
 */

/**
 * The standing profile, laid out for the prompt. 9.3.
 *
 * Withheld in the degraded state for the same reason the documents are: it is
 * built *from* the documents, so handing it over would leak by summary what
 * `documentsFor` refuses to leak directly. That is the failure mode a
 * per-source check would miss — the profile is derived material, and derived
 * material inherits its consent.
 *
 * Conflicts are included and labelled. §3 and 9.4 both want the therapist to
 * see the disagreement, and a copilot that has the conflict but is not told it
 * is a conflict will reconcile it in prose.
 */
async function profileFor(patientId: string, capabilities?: Capabilities): Promise<string> {
  if (capabilities && !capabilities.liveProfile) return "";

  const [row] = await db
    .select({ personId: patients.personId })
    .from(patients)
    .where(eq(patients.id, patientId))
    .limit(1);
  if (!row?.personId) return "";

  const { personProfiles } = await import("@/lib/db/schema");
  const [profile] = await db
    .select()
    .from(personProfiles)
    .where(eq(personProfiles.personId, row.personId))
    .limit(1);

  if (!profile || profile.sections.length === 0) return "";

  const parts = [
    `Standing profile, rebuilt ${profile.generatedAt.toISOString().slice(0, 10)} from ${profile.sessionCount} session(s) and ${profile.documentCount} document(s). Every line carries the references it came from:`,
  ];

  for (const section of profile.sections) {
    parts.push(`## ${section.heading}\n${section.body}\nRefs: ${section.refs.join(", ")}`);
  }

  if (profile.conflicts.length > 0) {
    parts.push(
      "## UNRESOLVED CONFLICTS between the sessions and the history. Report these to the therapist as open questions. Do NOT resolve them:",
    );
    for (const conflict of profile.conflicts) {
      parts.push(`- ${conflict.text} (${conflict.refs.join(", ")})`);
    }
  }

  return parts.join("\n\n");
}

export const __documentsForTest = documentsFor;

export async function askPatientCopilot(opts: {
  threadId: string;
  patientId: string;
  organizationId: string;
  userId: string;
  question: string;
  guidance: string | null;
  /** `auto`, or an ISO 639-1 code from `NOTE_LANGUAGES`. */
  replyLanguage?: string;
  /**
   * What this clinician may read. PLAN.md 7.7.
   *
   * Optional so the one other caller (the in-session suggestions) is not
   * forced to answer a question it does not have — absent means "no
   * restriction beyond the scoping the caller already did".
   */
  capabilities?: Capabilities;
  /**
   * 🔴 48.4 / C211 — the instant the room opened, when this is asked from
   * inside a live session.
   *
   * Present means "read the record as of then and nothing after it". Absent
   * means the ordinary `/copilot` call, which reads everything, and that is
   * the right default: between sessions there is no live conversation to leak
   * from and clipping the record would simply make the copilot worse.
   *
   * One bound, applied identically whether consent was granted, declined or
   * withdrawn. No branch anywhere on the consent state, because three branches
   * is three chances to get one wrong and the wrong one is the case where the
   * patient said no.
   */
  liveSince?: Date | null;
}): Promise<CopilotAnswer> {
  const started = Date.now();
  const language = opts.replyLanguage ?? "auto";
  const standing = opts.guidance?.trim() ?? "";
  const before = opts.liveSince ?? null;
  const { transcript, index, sessionCount } = await buildPatientContext(opts.patientId, before);
  const documents = await documentsFor(opts.patientId, opts.capabilities);
  const journalText = await journalsFor(opts.patientId, opts.capabilities, before);
  const standingProfile = await profileFor(opts.patientId, opts.capabilities);

  // Documents alone are enough to answer from — that is the whole point of the
  // personal profile. Only a patient with neither is a patient with nothing.
  if ((sessionCount === 0 || !transcript.trim()) && !documents.text) {
    return {
      answer:
        "There are no recorded sessions or documents for this patient yet, so I have nothing to work from. Once you complete a session, or add something to their profile, I will have material to read.",
      citations: [],
      documentRefs: [],
      suggestedPrompts: [],
    };
  }

  // Recent turns only. The transcript is the expensive part of this prompt and
  // a long chat history adds little beyond the last few exchanges.
  const history = await db
    .select({ role: copilotMessages.role, content: copilotMessages.content })
    .from(copilotMessages)
    .where(eq(copilotMessages.threadId, opts.threadId))
    .orderBy(desc(copilotMessages.createdAt))
    .limit(8);

  const historyText = history
    .reverse()
    .filter((m) => m.role === "therapist" || m.role === "copilot")
    .map((m) => `${m.role === "therapist" ? "Therapist" : "You"}: ${m.content}`)
    .join("\n");

  try {
    const completion = await openai().chat.completions.create({
      model: MODELS.note,
      temperature: 0.3,
      response_format: { type: "json_object" },
      max_tokens: 1400,
      messages: [
        {
          role: "system",
          content: buildSystemPrompt(opts.guidance, language, opts.capabilities, before),
        },
        {
          role: "user",
          content: [
            `Patient record:\n${transcript}`,
            /*
             * 8.5 — the person's own documents, each passage carrying its own
             * `[D7:3]` marker so the model cites by copying rather than by
             * counting. A model asked to compute a citation index gets it
             * wrong, and a wrong citation is worse than none (C35's rule
             * again).
             *
             * Empty in the revoked state: `documentsFor` returns nothing when
             * `capabilities.liveProfile` is false, which is the enforcement
             * C47 was waiting on. The model cannot leak what it was not given.
             */
            documents.text
              ? `The patient's own documents. Cite a passage as [D<document>:<passage>], copying the marker exactly:\n${documents.text}`
              : "",
            /*
             * 9.3 — the standing profile, including any conflicts already
             * found between the sessions and the history. Given to the model
             * as *material it may use*, not as an answer: every line in it
             * carries its own refs, so anything quoted from here can still be
             * traced back to a session or a document.
             */
            /*
             * 26.6 — what the patient wrote about their own week, dated.
             *
             * Quoted by date rather than by a `[D7:3]` marker: the citation
             * machinery is document-shaped, and generalising it belongs to the
             * evidence layer in sprint 33 rather than to a second half-model
             * invented here. ⚠️ Incomplete until then, and said so in
             * `journalContext`.
             *
             * Withheld in the degraded state exactly as the documents are.
             */
            journalText
              ? `The patient's own journals, in their words. Attribute anything you use to its date, for example "in their journal on 2026-03-04":\n${journalText}`
              : "",
            standingProfile,
            historyText ? `Recent conversation:\n${historyText}` : "",
            /*
             * The corrections again, immediately before the question.
             *
             * Not belt and braces — measured. A single mention in the system
             * message loses to a transcript this long, and this is the last
             * thing the model reads before it starts writing.
             */
            standing ? `Remember, from this therapist:\n${standing}` : "",
            `Therapist asks: ${opts.question}`,
            languageReminder(language, opts.question),
          ]
            .filter(Boolean)
            .join("\n\n"),
        },
      ],
    });

    await logUsage({
      organizationId: opts.organizationId,
      userId: opts.userId,
      sessionId: null,
      kind: "patient_copilot",
      model: MODELS.note,
      inputTokens: completion.usage?.prompt_tokens ?? 0,
      outputTokens: completion.usage?.completion_tokens ?? 0,
      durationMs: Date.now() - started,
      status: "success",
    });

    const raw = parseJson<{
      answer?: unknown;
      citations?: unknown;
      suggestedPrompts?: unknown;
    }>(completion.choices[0]?.message?.content, {}, "case-copilot");

    const written =
      typeof raw.answer === "string" && raw.answer.trim()
        ? raw.answer.trim()
        : "I could not form an answer from this patient's record.";

    /*
     * 8.5 — a `[D7:3]` that points at nothing is deleted from the answer.
     *
     * Not flagged, not left in place: a clinician clicking a citation and
     * getting an error cannot tell "the copilot made this up" from "the app is
     * broken", and the first of those is the one that matters. The answer
     * stands on its own words instead.
     */
    const { answer, refs } = keepResolvableCitations(written, (docRef) =>
      documents.resolvable.has(`${docRef.ordinal}:${docRef.sequence}`),
    );

    return {
      answer,
      citations: resolveCitations(raw.citations, index),
      documentRefs: refs,
      suggestedPrompts: normalisePrompts(raw.suggestedPrompts),
    };
  } catch (error) {
    await logUsage({
      organizationId: opts.organizationId,
      userId: opts.userId,
      sessionId: null,
      kind: "patient_copilot",
      model: MODELS.note,
      durationMs: Date.now() - started,
      status: "error",
      errorCode: error instanceof Error ? error.name : "unknown",
    });
    log.error("patient copilot failed", {
      thread: ref(opts.threadId),
      reason: safeErrorMessage(error),
    });
    throw error;
  }
}

/**
 * Turn model-supplied references into real citations.
 *
 * A reference the model invented will not be in the index, so it is dropped.
 * This is the mechanism behind the promise that every claim is traceable: the
 * UI can only ever show a source that exists in the database.
 */
export function resolveCitations(raw: unknown, index: Map<string, IndexedSegment>): Citation[] {
  if (!Array.isArray(raw)) return [];

  const seen = new Set<string>();
  const out: Citation[] = [];

  for (const entry of raw.slice(0, 8)) {
    const record = (entry ?? {}) as Record<string, unknown>;
    const refKey = typeof record.ref === "string" ? record.ref.trim().toUpperCase() : "";
    if (!refKey || seen.has(refKey)) continue;

    const segment = index.get(refKey);
    if (!segment) continue;

    seen.add(refKey);
    out.push({
      sessionId: segment.sessionId,
      sessionDate: segment.sessionDate.toISOString(),
      sequence: segment.sequence,
      speaker: segment.speaker,
      quote: segment.text.slice(0, 400),
      atSeconds: Math.round(segment.startMs / 1000),
    });
  }

  return out;
}

function normalisePrompts(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((p): p is string => typeof p === "string")
    .map((p) => p.trim())
    .filter(Boolean)
    .slice(0, 3)
    .map((p) => p.slice(0, 160));
}

/**
 * Prompt templates offered beside every thread.
 *
 * Fixed ones apply to any patient. Patient-specific suggestions come from the
 * model on each answer, so they reflect what is actually in that record.
 *
 * ## 45.6 / C207 — three things, not one string
 *
 * This was `{ label, text }` in English, and C207 named it as one of the three
 * bodies of copy left untranslated, because the label and the prompt were the
 * same constant and nobody had decided whether translating one should
 * translate the other.
 *
 * It should, and the split is what makes that safe. A therapist working in
 * Arabic who taps a chip has `text` inserted into the thread **as their own
 * message**, so an English prompt in an Arabic conversation is the product
 * putting words in a clinician's mouth in a language they were not using.
 *
 * So each template is three things that cannot substitute for each other:
 *
 *   - `key`   the identifier. Never rendered, never translated (C203).
 *   - `label` what is written on the chip.
 *   - `text`  what is sent, and what the thread records them as having asked.
 *
 * A lib module has no translator in scope, so the two keys are named here and
 * resolved where they are rendered.
 */
export const PROMPT_TEMPLATES = [
  "prepareMe",
  "whatChanged",
  "themes",
  "riskReview",
  "homework",
  "theirWords",
  "missed",
  "progress",
] as const;

export type PromptTemplateKey = (typeof PROMPT_TEMPLATES)[number];

/** The dictionary keys for one template. Resolved by the component. */
export function promptTemplateKeys(key: PromptTemplateKey): {
  key: PromptTemplateKey;
  labelKey: MessageKey;
  textKey: MessageKey;
} {
  return {
    key,
    labelKey: `tcop.tpl.${key}.label` as MessageKey,
    textKey: `tcop.tpl.${key}.text` as MessageKey,
  };
}
