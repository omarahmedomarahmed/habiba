import "server-only";

import { asc, desc, eq } from "drizzle-orm";

import { db } from "@/lib/db";
import {
  copilotMessages,
  sessionNotes,
  sessions,
  transcriptSegments,
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
}): Promise<CopilotAnswer> {
  const started = Date.now();
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
          content: opts.guidance
            ? `${SYSTEM_PROMPT}\n\nThe therapist has corrected you before. Honour these corrections:\n${opts.guidance}`
            : SYSTEM_PROMPT,
        },
        {
          role: "user",
          content: `Patient record:\n${transcript}\n\n${
            historyText ? `Recent conversation:\n${historyText}\n\n` : ""
          }Therapist asks: ${opts.question}`,
        },
      ],
    });

    await logUsage({
      organizationId: opts.organizationId,
      userId: opts.userId,
      sessionId: null,
      kind: "copilot",
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
      kind: "copilot",
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
