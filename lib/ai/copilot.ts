import "server-only";

import { desc, eq } from "drizzle-orm";

import { db } from "@/lib/db";
import { transcriptSegments } from "@/lib/db/schema";
import { log, ref, safeErrorMessage } from "@/lib/logger";
import { MODELS, logUsage, openai, parseJson } from "./client";

/**
 * In-session copilot.
 *
 * Runs on the response to an audio chunk the client was already uploading, so
 * it costs no extra connection and needs no socket. It fires every
 * `SEGMENTS_PER_RUN` segments rather than every chunk, because a suggestion
 * that changes every eight seconds is noise a clinician learns to ignore — and
 * because the old implementation's two model calls per five segments worked out
 * at roughly 290 calls an hour per session.
 */
const SEGMENTS_PER_RUN = 3;
const CONTEXT_SEGMENTS = 14;

export type CopilotSuggestion = {
  kind: "explore" | "reflect" | "observation" | "risk";
  text: string;
};

const SYSTEM_PROMPT = `You are a quiet clinical copilot sitting beside a licensed psychotherapist during a live session.

You see the last few minutes of transcript. Offer at most two short prompts that would genuinely help *right now*.

Rules:
- Be brief. One sentence each, under 18 words. The therapist is reading this while listening to someone.
- Suggest, never instruct. "Worth exploring…" not "You should…".
- Only surface something if it is actually useful. Returning an empty list is the correct answer most of the time, and is strongly preferred over stating the obvious.
- Never diagnose. Never write the note.
- Use "risk" only for language suggesting harm to self or others.

Kinds: "explore" (a thread worth opening), "reflect" (something to name back), "observation" (a pattern across the session), "risk".

Respond with JSON: {"suggestions": [{"kind": "...", "text": "..."}]}`;

export function shouldRunCopilot(sequence: number): boolean {
  return sequence > 0 && sequence % SEGMENTS_PER_RUN === 0;
}

export async function generateCopilot(opts: {
  sessionId: string;
  organizationId: string;
  userId: string;
}): Promise<CopilotSuggestion[]> {
  const started = Date.now();

  try {
    const recent = await db
      .select({ speaker: transcriptSegments.speaker, text: transcriptSegments.text })
      .from(transcriptSegments)
      .where(eq(transcriptSegments.sessionId, opts.sessionId))
      .orderBy(desc(transcriptSegments.sequence))
      .limit(CONTEXT_SEGMENTS);

    if (recent.length < 2) return [];

    const transcript = recent
      .reverse()
      .map((s) => `${s.speaker === "patient" ? "Patient" : s.speaker === "therapist" ? "Therapist" : "Speaker"}: ${s.text}`)
      .join("\n");

    const completion = await openai().chat.completions.create({
      model: MODELS.copilot,
      temperature: 0.4,
      response_format: { type: "json_object" },
      max_tokens: 300,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: transcript },
      ],
    });

    await logUsage({
      organizationId: opts.organizationId,
      userId: opts.userId,
      sessionId: opts.sessionId,
      kind: "copilot",
      model: MODELS.copilot,
      inputTokens: completion.usage?.prompt_tokens ?? 0,
      outputTokens: completion.usage?.completion_tokens ?? 0,
      durationMs: Date.now() - started,
      status: "success",
    });

    const parsed = parseJson<{ suggestions?: unknown }>(
      completion.choices[0]?.message?.content,
      {},
      "copilot",
    );

    return normaliseSuggestions(parsed.suggestions);
  } catch (error) {
    await logUsage({
      organizationId: opts.organizationId,
      userId: opts.userId,
      sessionId: opts.sessionId,
      kind: "copilot",
      model: MODELS.copilot,
      durationMs: Date.now() - started,
      status: "error",
      errorCode: error instanceof Error ? error.name : "unknown",
    });
    // A failed suggestion must never disturb the session. The transcript is the
    // product; this is a garnish.
    log.warn("copilot failed", {
      session: ref(opts.sessionId),
      reason: safeErrorMessage(error),
    });
    return [];
  }
}

const KINDS = new Set<CopilotSuggestion["kind"]>(["explore", "reflect", "observation", "risk"]);

export function normaliseSuggestions(raw: unknown): CopilotSuggestion[] {
  if (!Array.isArray(raw)) return [];

  const out: CopilotSuggestion[] = [];
  for (const entry of raw.slice(0, 2)) {
    if (!entry || typeof entry !== "object") continue;
    const record = entry as Record<string, unknown>;
    const text = typeof record.text === "string" ? record.text.trim() : "";
    if (!text) continue;
    const kind = KINDS.has(record.kind as CopilotSuggestion["kind"])
      ? (record.kind as CopilotSuggestion["kind"])
      : "observation";
    out.push({ kind, text: text.slice(0, 240) });
  }
  return out;
}
