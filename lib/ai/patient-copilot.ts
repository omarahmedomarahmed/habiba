import "server-only";

import { asc, desc, eq } from "drizzle-orm";

import type { Capabilities } from "@/lib/access/state";
import { db } from "@/lib/db";
import {
  copilotMessages,
  sessionNotes,
  sessions,
  transcriptSegments,
  NOTE_LANGUAGES,
  type Citation,
} from "@/lib/db/schema";
import { log, ref, safeErrorMessage } from "@/lib/logger";
import { MODELS, logUsage, openai, parseJson } from "./client";

/**
 * The per-patient copilot.
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

You are given that patient's session transcripts. Every line carries a reference like [S2:14] — session 2, segment 14.

Rules:
- Answer only from the material provided. If it does not support an answer, say so plainly. "The transcripts do not cover that" is a good answer.
- You know about this patient only. If asked about another patient, any other person, or anything outside this record, say you do not have that information.
- Cite everything. Every factual claim must carry at least one reference you were actually given. Never invent a reference.
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
): string {
  const blocks: string[] = [];

  /*
   * The consent boundary, stated first. PLAN.md 7.7, H2.
   *
   * H2: a rule buried under a long prompt loses to the material above it, and
   * the material here is an entire clinical history. So the restriction goes
   * at the very top, above the therapist's own standing instructions —
   * deliberately the one thing their corrections cannot override, because a
   * therapist cannot instruct their way past a patient's consent.
   *
   * What this is *not* is the enforcement. Today the context is assembled
   * from one `patients` row — one clinic's own sessions and notes — which is
   * exactly what §3 leaves a revoked therapist, so there is nothing here to
   * withhold yet. The live profile and patient uploads arrive in sprint 8, and
   * `capabilities.liveProfile` is what that assembly must consult. Until then
   * this line does the only job available: stop the model *speculating* about
   * the material it does not have. See C47.
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
    return `LANGUAGE: write "answer" and "suggestedPrompts" in the same language as the therapist's question at the end of this conversation — and in no other language.
- Question in Arabic, answer in Arabic. Question in English, answer in English. The same for any other language.
- Decide from the question alone. The language of these instructions, of the transcript, and of the earlier conversation are all irrelevant: a patient who speaks Arabic does not mean the therapist wants an Arabic answer, and a prompt written in English does not mean they want an English one.
- Quote the transcript in the words it was actually said in, and write everything around the quote in the question's language.`;
  }
  const label = NOTE_LANGUAGES[language] ?? "English";
  return `LANGUAGE: write "answer" and "suggestedPrompts" in ${label} (${language}), whatever language this prompt, the question or the transcript are in.
- Quote the transcript in the words it was actually said in, and write everything around the quote in ${label}.
- This line decides the language. If a standing instruction above asks for a different one, it is out of date — the therapist has since chosen ${label} from a setting, and this wins.`;
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
async function buildPatientContext(patientId: string): Promise<{
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
    .where(eq(sessions.patientId, patientId))
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
      `\n=== Session ${sessionNumber} — ${date.toISOString().slice(0, 10)}${session.durationMinutes ? `, ${session.durationMinutes} min` : ""} ===`,
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
  suggestedPrompts: string[];
};

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
}): Promise<CopilotAnswer> {
  const started = Date.now();
  const language = opts.replyLanguage ?? "auto";
  const standing = opts.guidance?.trim() ?? "";
  const { transcript, index, sessionCount } = await buildPatientContext(opts.patientId);

  if (sessionCount === 0 || !transcript.trim()) {
    return {
      answer:
        "There are no recorded sessions for this patient yet, so I have nothing to work from. Once you complete a session I will have the transcript.",
      citations: [],
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
          content: buildSystemPrompt(opts.guidance, language, opts.capabilities),
        },
        {
          role: "user",
          content: [
            `Patient record:\n${transcript}`,
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
    }>(completion.choices[0]?.message?.content, {}, "patient-copilot");

    return {
      answer:
        typeof raw.answer === "string" && raw.answer.trim()
          ? raw.answer.trim()
          : "I could not form an answer from this patient's record.",
      citations: resolveCitations(raw.citations, index),
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
export function resolveCitations(
  raw: unknown,
  index: Map<string, IndexedSegment>,
): Citation[] {
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
 */
export const PROMPT_TEMPLATES = [
  { label: "Prepare me", text: "Prepare me for our next session. What should I have in mind?" },
  { label: "What changed", text: "What has changed for this patient since our first session?" },
  { label: "Themes", text: "What themes keep recurring across these sessions?" },
  { label: "Risk review", text: "Has anything been said that I should treat as a risk indicator?" },
  { label: "Homework", text: "What did we agree they would work on, and did they do it?" },
  { label: "Their words", text: "How does this patient describe the problem in their own words?" },
  { label: "Missed", text: "What have I not asked about that the transcripts suggest matters?" },
  { label: "Progress", text: "Is there evidence of progress toward their stated goals?" },
] as const;
