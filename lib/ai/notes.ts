import "server-only";

import { asc, eq } from "drizzle-orm";

import { db } from "@/lib/db";
import {
  patients,
  sessionNotes,
  sessions,
  transcriptSegments,
  type NoteContent,
} from "@/lib/db/schema";
import { log, ref, safeErrorMessage } from "@/lib/logger";
import { MODELS, logUsage, openai, parseJson } from "./client";

const EMPTY_NOTE: NoteContent = {
  soap: { subjective: "", objective: "", assessment: "", plan: "" },
  summary: "",
  talkingPoints: [],
  observations: "",
  impressions: "",
  recommendations: [],
  followUp: "",
};

const SYSTEM_PROMPT = `You are a clinical documentation assistant for a licensed psychotherapist.

You are given a transcript of one therapy session and minimal context. Produce documentation the clinician can review and sign.

Rules:
- Write in the clinician's professional voice: third person, past tense, specific.
- Ground every statement in the transcript. If the transcript does not support a field, leave it empty rather than inventing content. An empty field is a normal outcome for a short or partial session.
- Do not diagnose. "impressions" holds clinical impressions for the clinician to consider, and must read as provisional.
- Never address the patient. Never include advice written to the patient.
- Refer to the person as "the patient". Do not use any name, even if one appears in the transcript.
- If the transcript contains language suggesting risk of harm to self or others, say so plainly in "assessment" and in "impressions".

Respond with a single JSON object with exactly these keys:
{
  "soap": { "subjective": string, "objective": string, "assessment": string, "plan": string },
  "summary": string,
  "talkingPoints": string[],
  "observations": string,
  "impressions": string,
  "recommendations": string[],
  "followUp": string
}`;

/**
 * Build the model context.
 *
 * The patient's name is deliberately not included. The old context builder
 * opened with `Patient: {first_name} {last_name}` followed by age, gender,
 * diagnoses and the entire transcript, with no de-identification at all. Names
 * add nothing to note quality — the clinician knows who they saw — and leaving
 * them out means the identity never reaches the provider in the first place.
 *
 * Each section is assembled defensively: one failing lookup degrades that
 * section rather than failing the whole note.
 */
async function buildContext(sessionId: string): Promise<{ context: string; transcript: string }> {
  const contextParts: string[] = [];

  const [row] = await db
    .select({
      modality: sessions.modality,
      durationMinutes: sessions.durationMinutes,
      clinical: patients.clinical,
    })
    .from(sessions)
    .leftJoin(patients, eq(patients.id, sessions.patientId))
    .where(eq(sessions.id, sessionId))
    .limit(1);

  if (row) {
    contextParts.push(
      `Session type: ${row.modality === "video" ? "video" : "in person"}`,
      `Duration: ${row.durationMinutes ?? "unknown"} minutes`,
    );
    const diagnoses = row.clinical?.diagnoses ?? [];
    const goals = row.clinical?.goals ?? [];
    if (diagnoses.length) contextParts.push(`Working diagnoses: ${diagnoses.join("; ")}`);
    if (goals.length) contextParts.push(`Treatment goals: ${goals.join("; ")}`);
  }

  const segments = await db
    .select({ speaker: transcriptSegments.speaker, text: transcriptSegments.text })
    .from(transcriptSegments)
    .where(eq(transcriptSegments.sessionId, sessionId))
    .orderBy(asc(transcriptSegments.sequence))
    // A 50-minute session is roughly 400 segments. The cap is a cost and
    // latency guard; the old query had no LIMIT at all.
    .limit(1200);

  const transcript = segments
    .map((s) => `${s.speaker === "patient" ? "Patient" : s.speaker === "therapist" ? "Therapist" : "Speaker"}: ${s.text}`)
    .join("\n");

  return { context: contextParts.join("\n"), transcript };
}

export class EmptyTranscriptError extends Error {
  constructor() {
    super("No transcript was captured for this session");
    this.name = "EmptyTranscriptError";
  }
}

export async function generateNoteContent(opts: {
  sessionId: string;
  organizationId: string;
  userId: string;
}): Promise<{ content: NoteContent; model: string }> {
  const started = Date.now();
  const { context, transcript } = await buildContext(opts.sessionId);

  if (transcript.trim().length < 80) throw new EmptyTranscriptError();

  try {
    const completion = await openai().chat.completions.create({
      model: MODELS.note,
      temperature: 0.2,
      response_format: { type: "json_object" },
      max_tokens: 3000,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        {
          role: "user",
          content: `${context ? `Context:\n${context}\n\n` : ""}Transcript:\n${transcript}`,
        },
      ],
    });

    await logUsage({
      organizationId: opts.organizationId,
      userId: opts.userId,
      sessionId: opts.sessionId,
      kind: "note",
      model: MODELS.note,
      inputTokens: completion.usage?.prompt_tokens ?? 0,
      outputTokens: completion.usage?.completion_tokens ?? 0,
      durationMs: Date.now() - started,
      status: "success",
    });

    const raw = parseJson<Record<string, unknown>>(
      completion.choices[0]?.message?.content,
      {},
      "note-generation",
    );

    return { content: normaliseNote(raw), model: MODELS.note };
  } catch (error) {
    await logUsage({
      organizationId: opts.organizationId,
      userId: opts.userId,
      sessionId: opts.sessionId,
      kind: "note",
      model: MODELS.note,
      durationMs: Date.now() - started,
      status: "error",
      errorCode: error instanceof Error ? error.name : "unknown",
    });
    log.error("note generation failed", {
      session: ref(opts.sessionId),
      reason: safeErrorMessage(error),
    });
    throw error;
  }
}

/**
 * Coerce whatever the model returned into the shape the UI renders. A model
 * that returns a string where an array was asked for should produce a slightly
 * wrong note, not a runtime crash inside a clinician's workflow.
 */
export function normaliseNote(raw: Record<string, unknown>): NoteContent {
  const asString = (v: unknown): string => (typeof v === "string" ? v.trim() : "");
  const asArray = (v: unknown): string[] => {
    if (Array.isArray(v)) return v.map(asString).filter(Boolean);
    const single = asString(v);
    return single ? [single] : [];
  };

  const soap = (raw.soap ?? {}) as Record<string, unknown>;

  return {
    soap: {
      subjective: asString(soap.subjective),
      objective: asString(soap.objective),
      assessment: asString(soap.assessment),
      plan: asString(soap.plan),
    },
    summary: asString(raw.summary),
    talkingPoints: asArray(raw.talkingPoints),
    observations: asString(raw.observations),
    impressions: asString(raw.impressions),
    recommendations: asArray(raw.recommendations),
    followUp: asString(raw.followUp),
  };
}

export function isNoteEmpty(content: NoteContent): boolean {
  return (
    !content.soap.subjective &&
    !content.soap.objective &&
    !content.soap.assessment &&
    !content.soap.plan &&
    !content.summary
  );
}

/**
 * Generate and store the note for a completed session.
 *
 * Called from `waitUntil()` after the response has been sent, so the clinician
 * is not staring at a spinner for twenty seconds. `sessions.noteStatus` is the
 * job record — the old implementation was a bare floating promise with no
 * persisted state, so a restart mid-generation lost the note permanently with
 * nothing to retry from.
 */
export async function generateAndStoreNote(opts: {
  sessionId: string;
  organizationId: string;
  therapistId: string;
  patientId: string | null;
}): Promise<void> {
  try {
    const { content, model } = await generateNoteContent({
      sessionId: opts.sessionId,
      organizationId: opts.organizationId,
      userId: opts.therapistId,
    });

    await db
      .insert(sessionNotes)
      .values({
        sessionId: opts.sessionId,
        organizationId: opts.organizationId,
        therapistId: opts.therapistId,
        patientId: opts.patientId,
        content,
        status: "draft",
        model,
      })
      .onConflictDoUpdate({
        target: sessionNotes.sessionId,
        set: { content, model, updatedAt: new Date() },
      });

    await db
      .update(sessions)
      .set({ noteStatus: "ready", updatedAt: new Date() })
      .where(eq(sessions.id, opts.sessionId));

    log.info("note generated", { session: ref(opts.sessionId) });
  } catch (error) {
    await db
      .update(sessions)
      .set({ noteStatus: "failed", updatedAt: new Date() })
      .where(eq(sessions.id, opts.sessionId));
    log.error("note generation aborted", {
      session: ref(opts.sessionId),
      reason: safeErrorMessage(error),
    });
  }
}

export { EMPTY_NOTE };
